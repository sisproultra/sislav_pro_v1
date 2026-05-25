import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// URL Cleansing matching server & client
const cleanUrl = (urlStr: string) => {
  if (!urlStr) return '';
  try {
    let trimmed = urlStr.trim();
    if (!trimmed.toLowerCase().startsWith('http')) {
      trimmed = `https://${trimmed}`;
    }
    const parsed = new URL(trimmed);
    let cleanPath = parsed.pathname.replace(/\/rest\/v1\/?$/, '');
    if (cleanPath === '/') cleanPath = '';
    return `${parsed.origin}${cleanPath}`;
  } catch (e) {
    return urlStr.trim().replace(/\/$/, '').split('/rest/v1')[0];
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { username, sucursalId } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'El nombre de usuario es requerido' });
  }

  try {
    console.log(`🚀 [Vercel API Recovery] Solicitando recuperación de contraseña para: ${username} en sucursal: ${sucursalId}`);

    // Configuración de Supabase Admin
    const rawUrl = (process.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co').replace(/['"]/g, '').trim();
    const rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || 'N/A').replace(/['"]/g, '').trim();

    const supabaseUrl = cleanUrl(rawUrl);
    const supabaseServiceKey = rawKey;

    if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'N/A') {
      return res.status(500).json({ error: 'Supabase Admin credentials are not configured on the server.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Encontrar el empleado en la tabla usuarios_login
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('usuarios_login')
      .select('id, username, nombre_completo, telefono, sucursal_id, empresa_id, activo')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle();

    if (userError || !userRecord) {
      return res.status(404).json({ error: `El usuario "${username}" no existe o no tiene un perfil configurado en esta sucursal.` });
    }

    // 2. Verificar si está activo
    if (!userRecord.activo) {
      return res.status(400).json({ error: `El usuario "${username}" está desactivado. Contacte a soporte o administración.` });
    }

    // 3. Validar teléfono
    const telefono = userRecord.telefono ? userRecord.telefono.trim() : '';
    if (!telefono) {
      return res.status(400).json({ 
        error: `No tienes un número de teléfono de WhatsApp asociado a tu perfil de empleado. Por favor, solicita a tu administrador que actualice tu perfil agregando tu número de WhatsApp.` 
      });
    }

    // 4. Generar contraseña momentánea (1 Letra Mayúscula + 4 números)
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomLetter = letters.charAt(Math.floor(Math.random() * letters.length));
    const randomNumber = Math.floor(1000 + Math.random() * 9000).toString();
    const tempPassword = randomLetter + randomNumber;

    // 5. Configurar expiración a 10 minutos (en milisegundos)
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // 6. Preparar número limpio para historial
    let cleanPhone = telefono.replace(/\D/g, '');

    // 7. Cargar metadatos actuales del usuario de Supabase Auth para no sobreescribir otros valores e iniciar historial
    let currentMetadata: any = {};
    let recoveryHistory: any[] = [];
    try {
      const { data: authUserData, error: getUserError } = await supabaseAdmin.auth.admin.getUser(userRecord.id);
      if (!getUserError && authUserData?.user) {
        currentMetadata = authUserData.user.user_metadata || {};
        if (Array.isArray(currentMetadata.recovery_history)) {
          recoveryHistory = [...currentMetadata.recovery_history];
        }
      }
    } catch (e: any) {
      console.warn("⚠️ No se pudieron restaurar metadatos anteriores:", e.message);
    }

    // Crear nueva entrada para el historial de recuperación
    const newHistoryEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      temp_password: tempPassword,
      expires_at: new Date(expiresAt).toISOString(),
      phone: cleanPhone,
      status: 'pending'
    };
    recoveryHistory.push(newHistoryEntry);

    // Limitar historial a los últimos 10 logs
    if (recoveryHistory.length > 10) {
      recoveryHistory = recoveryHistory.slice(-10);
    }

    // 8. Actualizar contraseña del usuario en Supabase Auth con los flags y el historial correspondientes
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userRecord.id, {
      password: tempPassword,
      user_metadata: {
        ...currentMetadata,
        temp_password_active: true,
        temp_password_expires_at: expiresAt,
        temp_password_raw: tempPassword, // Guardado para auditoría de soporte administrativo
        recovery_history: recoveryHistory
      }
    });

    if (updateError) {
      throw new Error(`No se pudo actualizar la contraseña temporal: ${updateError.message}`);
    }

    // Sincronizar el password_hash en la tabla local usuarios_login para contingencias
    try {
      await supabaseAdmin
        .from('usuarios_login')
        .update({ password_hash: tempPassword })
        .eq('id', userRecord.id);
    } catch (dbErr) {
      console.warn("⚠️ No se pudo actualizar el password_hash local:", dbErr);
    }

    // 9. Cargar configuración de WhatsApp de saas_configuracion_global
    const { data: globalConfig } = await supabaseAdmin
      .from('saas_configuracion_global')
      .select('*')
      .order('id')
      .limit(1)
      .maybeSingle();

    const baseUrl = globalConfig?.url_bot;
    const apiKey = globalConfig?.apikey_bot;
    const instance = globalConfig?.instancia_bot;

    if (!baseUrl || !apiKey || !instance) {
      console.warn('⚠️ Configuración de WhatsApp incompleta en saas_configuracion_global.');
      
      // Actualizar estado en el historial como sin configurar/offline_mode
      if (recoveryHistory.length > 0) {
        recoveryHistory[recoveryHistory.length - 1].status = 'offline_mode';
        try {
          await supabaseAdmin.auth.admin.updateUserById(userRecord.id, {
            user_metadata: {
              ...currentMetadata,
              temp_password_active: true,
              temp_password_expires_at: expiresAt,
              temp_password_raw: tempPassword,
              recovery_history: recoveryHistory
            }
          });
        } catch (logErr) {
          console.warn("⚠️ Error guardando estado offline en historial:", logErr);
        }
      }

      return res.status(200).json({ 
        success: true, 
        offline: true, 
        tempPassword,
        message: 'Contraseña temporal generada pero WhatsApp no está configurado.' 
      });
    }

    // 10. Formatear el número de teléfono con el código de país
    if (cleanPhone.length === 9) {
      const countryCode = (globalConfig?.whatsapp_cod_pais || '51').replace(/\D/g, '') || '51';
      cleanPhone = `${countryCode}${cleanPhone}`;
    } else if (!telefono.startsWith('+') && !cleanPhone.startsWith('51') && cleanPhone.length === 9) {
      cleanPhone = `51${cleanPhone}`;
    }

    // 11. Construir el mensaje de WhatsApp solicitado de forma profesional
    const bodyText = `🔑 *SISLAV - RECUPERACION DE CONTRASEÑA* 🔑\n\nHola *${userRecord.nombre_completo.trim().toUpperCase()}*,\n\nHemos generado una contraseña momentánea para tu acceso al sistema:\n\n👤 *Usuario:* \`${userRecord.username}\`\n🔐 *Contraseña Temporal:* *${tempPassword}*\n\n⏱️ _Esta clave expirará en 10 minutos por motivos de seguridad._\n\nAl ingresar con esta contraseña temporal, el sistema solicitará obligatoriamente que definas tu nueva contraseña permanente para continuar.`;

    const finalBaseUrl = baseUrl.trim().startsWith('http') ? baseUrl.trim() : `https://${baseUrl.trim()}`;
    const finalEndpoint = `${finalBaseUrl}/message/sendText/${instance}`;

    // 12. Despachar mensaje a la API de Evolution
    const response = await fetch(finalEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: bodyText
      })
    });

    if (!response.ok) {
      console.error(`⚠️ Evolution API falló con status: ${response.status}`);
      
      // Actualizar historial como fallido
      if (recoveryHistory.length > 0) {
        recoveryHistory[recoveryHistory.length - 1].status = 'failed';
        try {
          await supabaseAdmin.auth.admin.updateUserById(userRecord.id, {
            user_metadata: {
              ...currentMetadata,
              temp_password_active: true,
              temp_password_expires_at: expiresAt,
              temp_password_raw: tempPassword,
              recovery_history: recoveryHistory
            }
          });
        } catch (logErr) {}
      }

      return res.status(500).json({ error: 'Fallo al despachar el mensaje de WhatsApp. Intente nuevamente.' });
    }

    // Actualizar historial como enviado
    if (recoveryHistory.length > 0) {
      recoveryHistory[recoveryHistory.length - 1].status = 'sent';
      try {
        await supabaseAdmin.auth.admin.updateUserById(userRecord.id, {
          user_metadata: {
            ...currentMetadata,
            temp_password_active: true,
            temp_password_expires_at: expiresAt,
            temp_password_raw: tempPassword,
            recovery_history: recoveryHistory
          }
        });
      } catch (logErr) {}
    }

    // Enmascarar teléfono
    const maskedPhone = telefono.length > 4 
      ? `${telefono.substring(0, 3)}***${telefono.substring(telefono.length - 2)}` 
      : telefono;

    console.log(`✅ Contraseña temporal enviada correctamente a ${cleanPhone}`);
    return res.status(200).json({ success: true, maskedPhone });

  } catch (error: any) {
    console.error(`❌ [Vercel API Recovery Exception]: ${error.message}`);
    return res.status(500).json({ error: error.message || 'Error interno al recuperar contraseña' });
  }
}

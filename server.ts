import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

// Bypass self-signed SSL/TLS certification validation issues for Evolution API instances
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Configuración de Supabase Admin (Backend)
  const rawUrl = (process.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co').replace(/['"]/g, '').trim();
  const rawKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SERVICE_KEY || 
    process.env.SUPABASE_SECRET_KEY || 
    process.env.SERVICE_ROLE_KEY || 
    process.env.SUPABASE_ADMIN_KEY || 
    'N/A'
  ).replace(/['"]/g, '').trim();

  // URL Cleansing logic matching client
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

  const supabaseUrl = cleanUrl(rawUrl);
  const supabaseServiceKey = rawKey;

  if (!process.env.VITE_SUPABASE_URL || supabaseServiceKey === 'N/A') {
    console.log('ℹ️ Nota: VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados completamente en el servidor.');
  }

  const supabaseAdmin = (supabaseUrl && supabaseServiceKey && supabaseServiceKey !== 'N/A') 
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    : null;

  if (!supabaseAdmin) {
    console.log('⚠️ Supabase Admin no inicializado. Se omitirá la inyección de metadata en el servidor.');
  }

  // --- API DE SEGUIMIENTO (TRACKING) PÚBLICO CON BYPASS DE RLS ---
  app.get('/api/tracking/:id', async (req, res) => {
    const { id } = req.params;
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase Admin no está inicializado en el servidor.');
      }

      console.log(`🔍 [API Tracking Server] Buscando ID/Código: ${id}`);
      
      const normalizeRelation = (rel: any) => {
        if (!rel) return null;
        if (Array.isArray(rel)) {
          return rel.length > 0 ? rel[0] : null;
        }
        return rel;
      };

      // 1. Intentar obtener el recojo primero (sin joins para máxima resiliencia RLS)
      const { data: pickup } = await supabaseAdmin.from('recojos_delivery').select('*').eq('id', id).maybeSingle();
      
      if (pickup) {
        console.log("✅ Recojo encontrado via backend:", pickup.id);
        const { data: company } = await supabaseAdmin.from('sucursales').select('*').eq('id', pickup.sucursal_id).maybeSingle();
        const { data: client } = await supabaseAdmin.from('clientes').select('id, nombres, puntos, sucursal_id, telefono, direccion, google_maps_url, tipo_documento, dni, latitud, longitud').eq('id', pickup.cliente_id).maybeSingle();
        const { data: invoice } = await supabaseAdmin.from('ventas').select('*, items_venta(*)').eq('pickup_id', id).maybeSingle();
        
        let pagos: any[] = [];
        if (invoice) {
          const { data: pData } = await supabaseAdmin.from('pagos_venta').select('monto, metodo_pago_id, fecha_pago').eq('venta_id', invoice.id);
          pagos = pData || [];
        }

        const mappedCompany = company ? {
          id: company.id,
          sucursal_id: company.id,
          empresa_id: company.empresa_id || company.empresa_holding_id,
          empresa_holding_id: company.empresa_id || company.empresa_holding_id,
          slug: company.slug,
          razonSocial: company.nombre_sucursal ?? company.name ?? 'SISLAV SUCURSAL',
          nombre_sucursal: company.nombre_sucursal ?? company.name ?? 'SISLAV SUCURSAL',
          primaryColor: company.color_primario ?? company.primaryColor ?? '#0054A6',
          secondaryColor: company.color_secundario ?? company.secondaryColor ?? '#10B981',
          color_primario: company.color_primario ?? company.primaryColor ?? '#0054A6',
          color_secundario: company.color_secundario ?? company.secondaryColor ?? '#10B981',
          logoUrl: company.url_logo ?? company.logoUrl,
          url_logo: company.url_logo ?? company.logoUrl,
          address: company.direccion || '',
          direccion: company.direccion || '',
          ruc: company.ruc || '00000000000',
          contactPhone: company.telefono || '',
          ticketPolicies: company.politicas_ticket || '',
          moneda_simbolo: company.moneda_simbolo || 'S/'
        } : null;

        return res.json({ 
          pickup: { ...pickup, clientes: normalizeRelation(client) }, 
          invoice: invoice ? { ...invoice, clientes: normalizeRelation(client), pagos_venta: pagos } : null, 
          company: mappedCompany
        });
      }

      // 2. Si no es recojo, intentar con venta directa
      let { data: v } = await supabaseAdmin.from('ventas').select('*, items_venta(*), clientes(*)').eq('id', id).maybeSingle();

      // 2.1 Fallback: Buscar por codigo_orden o serie-correlativo
      if (!v) {
        const { data: vByCode } = await supabaseAdmin.from('ventas').select('*, items_venta(*), clientes(*)').eq('codigo_orden', id).maybeSingle();
        v = vByCode;

        if (!v && id.includes('-')) {
          const parts = id.split('-');
          if (parts.length === 2) {
            const serieSearch = parts[0].toUpperCase();
            const correlativoSearch = parseInt(parts[1], 10);
            if (!isNaN(correlativoSearch)) {
              const { data: vByDoc } = await supabaseAdmin.from('ventas')
                .select('*, items_venta(*), clientes(*)')
                .eq('serie', serieSearch)
                .eq('correlativo', correlativoSearch)
                .maybeSingle();
              v = vByDoc;
            }
          }
        }
      }

      if (v) {
        console.log("✅ Venta encontrada via backend:", v.id);
        const { data: companyRaw } = await supabaseAdmin.from('sucursales').select('*').eq('id', v.sucursal_id).maybeSingle();
        const clientRaw = normalizeRelation(v.clientes);
        
        const { data: pagosVenta } = await supabaseAdmin.from('pagos_venta').select('*, metodos_pago(nombre)').eq('venta_id', v.id);
        const totalPagado = (pagosVenta || []).reduce((sum, p) => sum + (Number(p.monto) || 0), 0);

        const mappedCompany = companyRaw ? {
          id: companyRaw.id,
          sucursal_id: companyRaw.id,
          empresa_id: companyRaw.empresa_id || companyRaw.empresa_holding_id,
          empresa_holding_id: companyRaw.empresa_id || companyRaw.empresa_holding_id,
          slug: companyRaw.slug,
          razonSocial: companyRaw.nombre_sucursal ?? companyRaw.name ?? 'SISLAV SUCURSAL',
          nombre_sucursal: companyRaw.nombre_sucursal ?? companyRaw.name ?? 'SISLAV SUCURSAL',
          primaryColor: companyRaw.color_primario ?? companyRaw.primaryColor ?? '#0054A6',
          secondaryColor: companyRaw.color_secundario ?? companyRaw.secondaryColor ?? '#10B981',
          color_primario: companyRaw.color_primario ?? companyRaw.primaryColor ?? '#0054A6',
          color_secundario: companyRaw.color_secundario ?? companyRaw.secondaryColor ?? '#10B981',
          logoUrl: companyRaw.url_logo ?? companyRaw.logoUrl,
          url_logo: companyRaw.url_logo ?? companyRaw.logoUrl,
          address: companyRaw.direccion || '',
          direccion: companyRaw.direccion || '',
          ruc: companyRaw.ruc || '00000000000',
          contactPhone: companyRaw.telefono || '',
          ticketPolicies: companyRaw.politicas_ticket || '',
          moneda_simbolo: companyRaw.moneda_simbolo || 'S/'
        } : null;

        const mappedInvoice = {
          id: v.id,
          sucursal_id: v.sucursal_id,
          cliente_id: v.cliente_id,
          client: clientRaw ? {
            id: clientRaw.id,
            docType: clientRaw.tipo_documento_codigo || 'DNI',
            docNumber: clientRaw.dni,
            name: clientRaw.nombres,
            phone: clientRaw.telefono,
            address: clientRaw.direccion,
            points: clientRaw.puntos || 0,
            sucursal_id: clientRaw.sucursal_id
          } : { id: '', docType: '0', docNumber: '0', name: 'PUBLICO GENERAL', address: '', points: 0, sucursal_id: v.sucursal_id },
          ordenNumber: v.codigo_orden,
          serie: v.serie,
          correlativo: v.correlativo,
          type: v.tipo_documento_codigo,
          items: (v.items_venta || []).map((it: any) => ({
            id: it.id,
            name: (it.descripcion || it.nombre || 'SERVICIO').toUpperCase(),
            quantity: Number(it.cantidad || 0),
            price: Number(it.precio_unitario || 0),
            subtotal: Number(it.subtotal || 0),
            category: it.categoria || '',
            unitCode: it.codigo_unidad || 'ZZ',
            activo: true,
            stock: 0,
            cost: 0,
            estado: it.estado || 'PENDIENTE',
            status: it.estado,
            estado_id: it.estado_id,
            color: it.color,
            defectos: it.defectos,
            details: it.observaciones,
            item_id_raw: it.id,
            audioNote: it.url_audio
          })),
          payments: (pagosVenta || []).map(p => ({
            id: p.id,
            metodo_pago_id: p.metodo_pago_id,
            metodo_pago_name: (p.metodos_pago as any)?.nombre || 'EFECTIVO',
            monto: Number(p.monto),
            date: p.fecha_pago
          })),
          totals: {
            total: Number(v.total) || 0,
            igv: Number(v.total_igv) || 0,
            gravada: Number(v.total_gravada) || 0,
            exonerada: Number(v.total_exonerada) || 0,
            inafecta: Number(v.total_inafecta) || 0
          },
          date: v.fecha_recepcion || v.fecha || new Date().toISOString(),
          fecha_emision: v.fecha_emision,
          deliveryDate: v.fecha_entrega,
          orderStatus: (v.estado) || 'PENDIENTE',
          sunatStatus: v.sunat_status || (v.tipo_documento_codigo === '80' ? 'INTERNAL' : 'PENDING'),
          prePaymentAmount: totalPagado,
          qrCodeData: v.qr_code_data || null,
          sunatResponse: {
            success: v.sunat_status === 'ACCEPTED',
            description: v.sunat_description,
            hash: v.sunat_hash,
            pdfUrl: v.sunat_pdf_url,
            xmlUrl: v.sunat_xml_url,
            cdrUrl: v.sunat_cdr_url
          }
        };

        return res.json({ 
          invoice: mappedInvoice, 
          company: mappedCompany
        });
      }

      console.warn(`⚠️ [API Tracking Server] No se encontró coincidencia: ${id}`);
      return res.status(404).json({ error: 'Pedido no encontrado' });

    } catch (error: any) {
      console.error('❌ Error en server tracking API:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // --- PROXIES DE FACTURACIÓN Y APIS EXTERNAS ---

  // Proxy para SUNAT VPS dinámico (Soporta múltiples dominios)
  app.post(/^\/api-proxy\/sunat-vps\/([^\/]+)\/(.*)/, async (req: any, res: any) => {
    const host = req.params[0];
    const path = req.params[1];
    const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    const targetUrl = `https://${host}/${path}${queryString}`;
    
    console.log(`🌐 [Proxy VPS] Target: ${targetUrl}`);
    
    try {
      const headers: any = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Inyección segura del token global de Visioner7 desde el Servidor para evitar exponerlo al cliente.
      if (host.includes('visioner7')) {
        const globalToken = (process.env.VISIONER7_API_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OSwiZW1haWwiOiJqZWNvdi5jb250YWN0b0BnbWFpbC5jb20iLCJpYXQiOjE3ODA1MTI2MTYsImV4cCI6MTgxMjA0ODYxNn0.zp7dp-yUfMcjkQSH4Q3Vq506nrJvyZJ_zrpsaFimOfM").trim();
        headers['Authorization'] = `Bearer ${globalToken}`;
        console.log(`🔑 [Proxy VPS] Inyectando Bearer Token de Visioner7 de forma segura.`);
      } else if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
      }
      
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body)
      });
      
      const contentType = response.headers.get('Content-Type') || 'application/json';
      const data = await response.text();
      
      res.status(response.status).header('Content-Type', contentType).send(data);
    } catch (error: any) {
      console.error(`❌ [Proxy VPS Error]: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Error al conectar con el servidor de SUNAT a través del proxy.',
        details: error.message 
      });
    }
  });

  // Proxy para SUNAT Estándar
  app.post(/^\/api-proxy\/sunat\/(.*)/, async (req: any, res: any) => {
    const path = req.params[0] || 'post.php';
    const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    const targetUrl = `https://apisu.sysventa.com/API_SUNAT/${path}${queryString}`;
    
    console.log(`🌐 [Proxy SUNAT] Target: ${targetUrl}`);
    
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(req.body)
      });
      
      const contentType = response.headers.get('Content-Type') || 'application/json';
      const data = await response.text();
      
      res.status(response.status).header('Content-Type', contentType).send(data);
    } catch (error: any) {
      console.error(`❌ [Proxy SUNAT Error]: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Error al conectar con apisu.sysventa.com a través del proxy.',
        details: error.message 
      });
    }
  });

  // Proxy para Decolecta
  app.all(/^\/api-proxy\/decolecta\/(.*)/, async (req: any, res: any) => {
    const subpath = req.params[0];
    const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    const targetUrl = `https://api.decolecta.com/v1/${subpath}${queryString}`;
    try {
      const options: any = {
        method: req.method,
        headers: {
          'Authorization': req.headers.authorization || '',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };
      
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        options.body = JSON.stringify(req.body);
      }
      
      const response = await fetch(targetUrl, options);
      const contentType = response.headers.get('Content-Type') || 'application/json';
      const data = await response.text();
      
      res.status(response.status).header('Content-Type', contentType).send(data);
    } catch (error: any) {
      console.error(`❌ [Proxy Decolecta Error]: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // --- ENDPOINTS DE APLICACIÓN ---
  app.post('/api/auth/sync-metadata', async (req, res) => {
    const { userId, empresaHoldingId } = req.body;

    if (!userId || !empresaHoldingId) {
      return res.status(400).json({ error: 'userId y empresaHoldingId son requeridos' });
    }

    try {
      console.log(`🚀 Ejecutando sincronización de metadata para usuario: ${userId}`);
      
      if (!supabaseAdmin) {
        throw new Error('Supabase Admin no configurado. No se puede actualizar metadata del usuario.');
      }

      // EJECUCIÓN DEL CÓDIGO SOLICITADO
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: {
          empresa_holding_id: empresaHoldingId
        }
      });

      if (error) throw error;

      console.log('✅ Metadata actualizada exitosamente');
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('❌ Error en sincronización de metadata:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint: Password Recovery via WhatsApp
  app.post('/api/auth/recover-password', async (req, res) => {
    const { username, sucursalId } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'El nombre de usuario es requerido' });
    }

    try {
      console.log(`🚀 Solicitando recuperación de contraseña para: ${username} (sucursal opcional: ${sucursalId})`);

      if (!supabaseAdmin) {
        throw new Error('Supabase Admin no inicializado en el servidor.');
      }

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
        console.warn("⚠️ No se pudieron restaurar metadatos anteriores, se crearán de cero:", e.message);
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

        return res.json({ 
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

      // 12. Despachar mensaje a la API de Evolution
      const response = await fetch(`${baseUrl}/message/sendText/${instance}`, {
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
      res.json({ success: true, maskedPhone });

    } catch (error: any) {
      console.error('❌ Error en password recovery API:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint: Obtener el siguiente correlativo usando bypass de RLS con supabaseAdmin
  app.post('/api/correlativos/obtener-siguiente', async (req, res) => {
    const { branchId, targetType, targetSerie } = req.body;

    if (!branchId || !targetType) {
      return res.status(400).json({ error: 'branchId y targetType son requeridos' });
    }

    try {
      console.log(`🚀 [Server Config] Obtener correlativo para Branch: ${branchId}, Tipo: ${targetType}, Serie: ${targetSerie}`);

      if (!supabaseAdmin) {
        throw new Error('Supabase Admin no inicializado en el servidor.');
      }

      const { data: nextNumber, error: rpcError } = await supabaseAdmin.rpc('obtener_siguiente_correlativo', {
        p_sucursal_id: branchId,
        p_tipo_documento: targetType,
        p_serie: targetSerie || ''
      });

      if (rpcError) {
        console.error("❌ Error en RPC obtener_siguiente_correlativo via server:", rpcError);
        throw rpcError;
      }

      console.log(`✅ Correlativo asignado via server admin: ${nextNumber}`);
      res.json({ success: true, nextNumber });
    } catch (error: any) {
      console.error('❌ Error en obtener-siguiente correlativo API:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint: Dynamic Manifest for PWA
  app.get('/manifest.json', async (req, res) => {
    const slug = req.query.s as string;
    const ownerId = req.query.o as string;
    const isLogistica = req.query.type === 'logistica';
    
    let logoUrl = 'https://lavanderiasislav.com/logo-sislav.png';
    let name = 'SISLAV';
    let themeColor = '#4f8ef7';
    let startUrl = isLogistica ? '/logistica' : '/';

    try {
      if (ownerId) {
        const data = await getCachedMetadata(ownerId, 'empresas_holding');
        if (data) {
          logoUrl = isLogistica ? (data.url_favicon_logistica || data.url_favicon || data.url_logo) : (data.url_favicon || data.url_logo);
          logoUrl = logoUrl || 'https://lavanderiasislav.com/logo-sislav.png';
          name = data.nombre_empresa || name;
          themeColor = data.color_primario || themeColor;
          startUrl = isLogistica ? `/logistica?o=${ownerId.trim()}` : `/?o=${ownerId.trim()}`;
        }
      } else if (slug) {
        const data = await getCachedMetadata(slug, 'sucursales');
        if (data) {
          logoUrl = isLogistica ? (data.url_favicon_logistica || data.url_favicon || data.url_logo) : (data.url_favicon || data.url_logo);
          logoUrl = logoUrl || 'https://lavanderiasislav.com/logo-sislav.png';
          name = data.nombre_sucursal || name;
          themeColor = data.color_primario || themeColor;
          startUrl = isLogistica ? `/logistica?s=${slug.trim()}` : `/?s=${slug.trim()}`;
        }
      }

      if (isLogistica) {
        name = `LOGÍSTICA ${name}`;
      }
    } catch (e) {
      console.error('Error generating manifest:', e);
    }

    res.json({
      "name": isLogistica ? name : `${name} - CONTROL TOTAL`,
      "short_name": name.substring(0, 12),
      "description": `Sistema de gestión integral para ${name}`,
      "start_url": startUrl,
      "display": "standalone",
      "background_color": "#0d0f14",
      "theme_color": themeColor,
      "icons": [
        {
          "src": logoUrl,
          "sizes": "192x192",
          "type": "image/png"
        },
        {
          "src": logoUrl,
          "sizes": "512x512",
          "type": "image/png"
        }
      ],
      "orientation": "portrait",
      "scope": "/"
    });
  });

  // Cache para metadata de empresas/sucursales
  const metadataCache = new Map<string, { data: any, timestamp: number }>();
  const CACHE_TTL = 1000 * 60 * 5; // 5 minutos

  async function getCachedMetadata(id: string, type: 'sucursales' | 'empresas_holding') {
    if (!supabaseAdmin || !id) return null;
    
    const cacheKey = `${type}:${id}`;
    const cached = metadataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Si ya hay una promesa en curso para esta misma clave, podríamos esperarla, 
    // pero para simplificar y evitar bloqueos, solo retornamos null si falla.
    try {
      const queryPromise = supabaseAdmin
        .from(type)
        .select(type === 'sucursales' 
          ? 'nombre_sucursal, url_logo, url_favicon, url_favicon_logistica, color_primario'
          : 'nombre_empresa, url_logo, url_favicon, url_favicon_logistica, color_primario')
        .eq(type === 'sucursales' ? 'slug' : 'id', id.trim())
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout DB')), 2000)
      );

      const result: any = await Promise.race([queryPromise, timeoutPromise]);
      const data = result?.data;
      
      if (data) {
        metadataCache.set(cacheKey, { data, timestamp: Date.now() });
      }
      return data;
    } catch (e: any) {
      // Registrar solo una vez por clave para no saturar logs
      console.warn(`[getCachedMetadata] Omitiendo metadata para ${cacheKey}: ${e.message}`);
      return null;
    }
  }

  // Proxy para Evolution API (WhatsApp)
  app.post('/api/whatsapp/send', async (req: any, res: any) => {
    const { baseUrl, apiKey, instance, phoneNumber, text } = req.body;

    if (!baseUrl || !apiKey || !instance || !phoneNumber || !text) {
      return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos' });
    }

    try {
      let cleanNumber = phoneNumber.replace(/\D/g, '');
      
      // Intentar obtener el prefijo de país configurado globalmente
      let countryCode = '51';
      try {
        const { data: globalConfig } = await supabaseAdmin
          .from('saas_configuracion_global')
          .select('whatsapp_cod_pais')
          .maybeSingle();
        if (globalConfig?.whatsapp_cod_pais) {
          countryCode = globalConfig.whatsapp_cod_pais.replace(/\D/g, '') || '51';
        }
      } catch (dbErr) {
        console.warn("⚠️ No se pudo obtener el prefijo de WhatsApp de la BD, usando 51 por defecto:", dbErr);
      }

      if (cleanNumber.length === 9) {
        cleanNumber = `${countryCode}${cleanNumber}`;
      } else if (!phoneNumber.startsWith('+') && !cleanNumber.startsWith(countryCode) && cleanNumber.length === 9) {
        cleanNumber = `${countryCode}${cleanNumber}`;
      }

      const payload = {
        "number": cleanNumber,
        "text": text,
        "delay": 1200
      };

      let finalBaseUrl = baseUrl.trim();
      // Clean up base URL to ensure no duplicate or redundant path segments, matching EvolutionService
      if (finalBaseUrl.includes("/message/")) {
        finalBaseUrl = finalBaseUrl.split("/message/")[0];
      }
      if (finalBaseUrl.includes("/instance/")) {
        finalBaseUrl = finalBaseUrl.split("/instance/")[0];
      }
      if (!finalBaseUrl.startsWith('http')) {
        finalBaseUrl = `https://${finalBaseUrl}`;
      }
      while (finalBaseUrl.endsWith('/')) {
        finalBaseUrl = finalBaseUrl.slice(0, -1);
      }

      let finalInstance = instance.trim();
      while (finalInstance.startsWith('/')) {
        finalInstance = finalInstance.slice(1);
      }

      const finalEndpoint = `${finalBaseUrl}/message/sendText/${finalInstance}`;

      console.log(`🚀 [Server WA] Enviando mensaje a ${cleanNumber} via ${finalInstance} (Endpoint: ${finalEndpoint})`);

      let response;
      response = await fetch(finalEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { raw: responseText };
      }

      if (response.ok) {
        res.json({ success: true, data: responseData });
      } else {
        console.error(`❌ [Server WA Error]:`, responseData);
        res.status(response.status).json({ success: false, message: `Error Evolution API: ${response.status}`, details: responseData });
      }
    } catch (error: any) {
      console.error(`❌ [Server WA Exception]: ${error.message}`);
      res.status(500).json({ success: false, message: 'Error interno al enviar WhatsApp', details: error.message });
    }
  });

  // Vite middleware para desarrollo
  if (process.env.NODE_ENV !== 'production') {
    console.log('📦 Iniciando Vite en modo desarrollo...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/^(?!\/api).*$/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

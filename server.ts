import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'N/A';

  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('ℹ️ Nota: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados en el servidor.');
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

  // --- PROXIES DE FACTURACIÓN Y APIS EXTERNAS ---

  // Proxy para SUNAT VPS dinámico (Soporta múltiples dominios)
  app.post(/^\/api-proxy\/sunat-vps\/([^\/]+)\/(.*)/, async (req: any, res: any) => {
    const host = req.params[0];
    const path = req.params[1];
    const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
    const targetUrl = `https://${host}/${path}${queryString}`;
    
    console.log(`🌐 [Proxy VPS] Target: ${targetUrl}`);
    
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
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      const payload = {
        "number": cleanNumber,
        "text": text,
        "delay": 1200
      };

      let finalBaseUrl = baseUrl.trim();
      if (!finalBaseUrl.startsWith('http')) finalBaseUrl = `https://${finalBaseUrl}`;
      const finalEndpoint = `${finalBaseUrl}/message/sendText/${instance}`;

      console.log(`🚀 [Server WA] Enviando mensaje a ${cleanNumber} via ${instance}`);

      const response = await fetch(finalEndpoint, {
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

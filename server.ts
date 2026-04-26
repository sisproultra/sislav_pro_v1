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

  // Configuración de Supabase Admin (Backend)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'N/A';

  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('ℹ️ Nota: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados en el servidor.');
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Endpoint solicitado: Sincronización de Metadata
  app.post('/api/auth/sync-metadata', async (req, res) => {
    const { userId, empresaHoldingId } = req.body;

    if (!userId || !empresaHoldingId) {
      return res.status(400).json({ error: 'userId y empresaHoldingId son requeridos' });
    }

    try {
      console.log(`🚀 Ejecutando sincronización de metadata para usuario: ${userId}`);
      
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
        const { data } = await supabaseAdmin
          .from('empresas_holding')
          .select('url_logo, url_favicon, url_favicon_logistica, nombre_empresa, color_primario')
          .eq('id', ownerId.trim())
          .maybeSingle();
        
        if (data) {
          logoUrl = isLogistica ? (data.url_favicon_logistica || data.url_favicon || data.url_logo) : (data.url_favicon || data.url_logo);
          logoUrl = logoUrl || 'https://lavanderiasislav.com/logo-sislav.png';
          name = data.nombre_empresa || name;
          themeColor = data.color_primario || themeColor;
          startUrl = isLogistica ? `/logistica?o=${ownerId.trim()}` : `/?o=${ownerId.trim()}`;
        }
      } else if (slug) {
        const { data } = await supabaseAdmin
          .from('sucursales')
          .select('url_logo, url_favicon, url_favicon_logistica, nombre_sucursal, color_primario')
          .eq('slug', slug.trim())
          .maybeSingle();
        
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

  // Vite middleware para desarrollo
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    // Middleware para inyectar metadata en desarrollo
    app.use(async (req, res, next) => {
      const isHtml = req.url === '/' || req.url.startsWith('/?') || req.url.endsWith('.html');
      const slug = req.query.s as string;
      const ownerId = req.query.o as string;

      if (isHtml && (slug || ownerId)) {
        try {
          let b: any = null;
          if (slug) {
            const { data } = await supabaseAdmin
              .from('sucursales')
              .select('nombre_sucursal, url_logo, url_favicon, url_favicon_logistica, color_primario')
              .eq('slug', slug)
              .maybeSingle();
            b = data;
          } else if (ownerId) {
            const { data } = await supabaseAdmin
              .from('empresas_holding')
              .select('nombre_empresa, url_logo, url_favicon, url_favicon_logistica, color_primario')
              .eq('id', ownerId)
              .maybeSingle();
            if (data) {
              b = {
                nombre_sucursal: data.nombre_empresa,
                url_logo: data.url_logo,
                url_favicon: data.url_favicon,
                url_favicon_logistica: data.url_favicon_logistica,
                color_primario: data.color_primario
              };
            }
          }
          
          if (b) {
            const isLogistica = req.url.includes('/logistica');
            const logo = isLogistica ? (b.url_favicon_logistica || b.url_favicon || b.url_logo) : (b.url_favicon || b.url_logo || 'https://lavanderiasislav.com/logo-sislav.png');
            const originalSend = res.send;
            res.send = function(content) {
              let html = content.toString();
              const isLogistica = req.url.includes('/logistica');
              const title = isLogistica ? `LOGÍSTICA ${b.nombre_sucursal}` : `${b.nombre_sucursal} - CONTROL TOTAL`;
              const themeColor = b.color_primario || '#4f8ef7';
              let manifestUrl = ownerId ? `/manifest.json?o=${ownerId}` : (slug ? `/manifest.json?s=${slug}` : '/manifest.json');
              if (isLogistica) {
                manifestUrl += (manifestUrl.includes('?') ? '&' : '?') + 'type=logistica';
              }
              
              html = html.replace(/<title>.*?<\/title>/g, `<title>${title}</title>`);
              html = html.replace(/<meta property="og:title" content=".*?" \/>/g, `<meta property="og:title" content="${title}" />`);
              html = html.replace(/<meta property="og:image" content=".*?" \/>/g, `<meta property="og:image" content="${logo}" />`);
              html = html.replace(/<meta name="theme-color" content=".*?" \/>/g, `<meta name="theme-color" content="${themeColor}" />`);
              html = html.replace(/<link rel="icon".*?>/g, `<link rel="icon" href="${logo}" />`);
              html = html.replace(/<link rel="manifest".*?>/g, `<link rel="manifest" href="${manifestUrl}" />`);
              
              return originalSend.call(this, html);
            };
          }
        } catch (e) {}
      }
      vite.middlewares(req, res, next);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    
    app.get('*all', async (req, res) => {
      const slug = req.query.s as string;
      const ownerId = req.query.o as string;
      const indexPath = path.join(distPath, 'index.html');
      
      try {
        let html = await fs.promises.readFile(indexPath, 'utf-8');
        
        if (slug || ownerId) {
          let b: any = null;
          if (slug) {
            const { data } = await supabaseAdmin
              .from('sucursales')
              .select('nombre_sucursal, url_logo, url_favicon, url_favicon_logistica, color_primario')
              .eq('slug', slug)
              .maybeSingle();
            b = data;
          } else if (ownerId) {
            const { data } = await supabaseAdmin
              .from('empresas_holding')
              .select('nombre_empresa, url_logo, url_favicon, url_favicon_logistica, color_primario')
              .eq('id', ownerId)
              .maybeSingle();
            if (data) {
              b = {
                nombre_sucursal: data.nombre_empresa,
                url_logo: data.url_logo,
                url_favicon: data.url_favicon,
                url_favicon_logistica: data.url_favicon_logistica,
                color_primario: data.color_primario
              };
            }
          }
            
          if (b) {
            const isLogistica = req.url.includes('/logistica');
            const logo = isLogistica ? (b.url_favicon_logistica || b.url_favicon || b.url_logo) : (b.url_favicon || b.url_logo || 'https://lavanderiasislav.com/logo-sislav.png');
            const isLogistica = req.url.includes('/logistica');
            const title = isLogistica ? `LOGÍSTICA ${b.nombre_sucursal}` : `${b.nombre_sucursal} - CONTROL TOTAL`;
            const themeColor = b.color_primario || '#4f8ef7';
            let manifestUrl = ownerId ? `/manifest.json?o=${ownerId}` : (slug ? `/manifest.json?s=${slug}` : '/manifest.json');
            if (isLogistica) {
              manifestUrl += (manifestUrl.includes('?') ? '&' : '?') + 'type=logistica';
            }
            
            html = html.replace(/<title>.*?<\/title>/g, `<title>${title}</title>`);
            html = html.replace(/<meta property="og:title" content=".*?" \/>/g, `<meta property="og:title" content="${title}" />`);
            html = html.replace(/<meta property="og:description" content=".*?" \/>/g, `<meta property="og:description" content="Sistema de gestión integral para ${b.nombre_sucursal}." />`);
            html = html.replace(/<meta property="og:image" content=".*?" \/>/g, `<meta property="og:image" content="${logo}" />`);
            html = html.replace(/<meta name="theme-color" content=".*?" \/>/g, `<meta name="theme-color" content="${themeColor}" />`);
            html = html.replace(/<link rel="icon".*?>/g, `<link rel="icon" href="${logo}" />`);
            html = html.replace(/<link rel="manifest".*?>/g, `<link rel="manifest" href="${manifestUrl}" />`);
          }
        }
        res.send(html);
      } catch (e) {
        res.sendFile(indexPath);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

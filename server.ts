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
    let logoUrl = 'https://lavanderiasislav.com/logo-sislav.png';
    let name = 'SISLAV';

    try {
      if (slug) {
        const { data } = await supabaseAdmin
          .from('sucursales')
          .select('url_logo, url_favicon, nombre_sucursal')
          .eq('slug', slug)
          .maybeSingle();
        
        if (data) {
          logoUrl = data.url_favicon || data.url_logo || logoUrl;
          name = data.nombre_sucursal || name;
        }
      }
    } catch (e) {}

    res.json({
      "name": `${name} - CONTROL TOTAL`,
      "short_name": name,
      "description": `Sistema de gestión integral para ${name}`,
      "start_url": slug ? `/?s=${slug}` : "/",
      "display": "standalone",
      "background_color": "#0d0f14",
      "theme_color": "#4f8ef7",
      "icons": [
        {
          "src": logoUrl,
          "sizes": "192x192",
          "type": "image/png",
          "purpose": "any"
        },
        {
          "src": logoUrl,
          "sizes": "512x512",
          "type": "image/png",
          "purpose": "any"
        }
      ]
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
      const isHtml = req.url === '/' || req.url.endsWith('.html');
      const slug = req.query.s as string;

      if (isHtml && slug) {
        try {
          const { data: b } = await supabaseAdmin
            .from('sucursales')
            .select('nombre_sucursal, url_logo, url_favicon')
            .eq('slug', slug)
            .maybeSingle();
          
          if (b) {
            const logo = b.url_favicon || b.url_logo || 'https://lavanderiasislav.com/logo-sislav.png';
            const originalNext = next;
            
            // Interceptamos la respuesta de Vite para inyectar metadata
            const originalSend = res.send;
            res.send = function(content) {
              let html = content.toString();
              const title = `${b.nombre_sucursal} - CONTROL TOTAL`;
              
              html = html.replace(/<title>.*?<\/title>/g, `<title>${title}</title>`);
              html = html.replace(/<meta property="og:title" content=".*?" \/>/g, `<meta property="og:title" content="${title}" />`);
              html = html.replace(/<meta property="og:image" content=".*?" \/>/g, `<meta property="og:image" content="${logo}" />`);
              html = html.replace(/<link rel="icon".*?>/g, `<link rel="icon" href="${logo}" />`);
              html = html.replace(/<link rel="manifest".*?>/g, `<link rel="manifest" href="/manifest.json?s=${slug}" />`);
              
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
      const indexPath = path.join(distPath, 'index.html');
      
      try {
        let html = await fs.promises.readFile(indexPath, 'utf-8');
        
        if (slug) {
          const { data: b } = await supabaseAdmin
            .from('sucursales')
            .select('nombre_sucursal, url_logo, url_favicon')
            .eq('slug', slug)
            .maybeSingle();
            
          if (b) {
            const logo = b.url_favicon || b.url_logo || 'https://lavanderiasislav.com/logo-sislav.png';
            const title = `${b.nombre_sucursal} - CONTROL TOTAL`;
            
            html = html.replace(/<title>.*?<\/title>/g, `<title>${title}</title>`);
            html = html.replace(/<meta property="og:title" content=".*?" \/>/g, `<meta property="og:title" content="${title}" />`);
            html = html.replace(/<meta property="og:description" content=".*?" \/>/g, `<meta property="og:description" content="Sistema de gestión integral para ${b.nombre_sucursal}." />`);
            html = html.replace(/<meta property="og:image" content=".*?" \/>/g, `<meta property="og:image" content="${logo}" />`);
            html = html.replace(/<link rel="icon".*?>/g, `<link rel="icon" href="${logo}" />`);
            html = html.replace(/<link rel="manifest".*?>/g, `<link rel="manifest" href="/manifest.json?s=${slug}" />`);
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

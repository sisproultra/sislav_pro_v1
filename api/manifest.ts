import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 
                    'https://yvgshdypqanlcgxdyvls.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 
                          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Z3NoZHlwcWFubGNneGR5dmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjYyODIsImV4cCI6MjA4NTE0MjI4Mn0.B65RRA4u5-a_6E-blMvQXMKf39521esSif4XODdzfNE';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { s: slug, o: ownerId, type } = req.query;
  const isLogistica = type === 'logistica';

  let name = 'SISLAV SUCURSAL';
  let iconUrl = '/icons/icon-512.png';
  let themeColor = '#1A6EF5';
  let bgColor = '#0d0f14';
  let startUrl = '/';

  try {
    if (slug || ownerId) {
      const table = ownerId ? 'empresas_holding' : 'sucursales';
      const field = ownerId ? 'id' : 'slug';
      const value = ownerId || slug;

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?${field}=eq.${value}&select=*&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          }
        }
      );

      const data = await response.json();
      const record = Array.isArray(data) ? data[0] : data;

      if (record) {
        name = record.nombre_sucursal || 
               record.nombre_empresa || 
               'SISLAV SUCURSAL';
        
        // Para logística, usar favicon_logistica si existe
        const logoField = isLogistica 
          ? (record.url_favicon_logistica || record.url_favicon || record.url_logo)
          : (record.url_favicon || record.url_logo);
          
        if (logoField) iconUrl = logoField;
        if (record.color_primario) themeColor = record.color_primario;
        if (record.color_secundario) bgColor = record.color_secundario;
      }
    }
  } catch (e) {
    console.error('Error fetching branding for manifest:', e);
    // Fallback al manifest genérico
  }

  // Construir start_url con los parámetros originales
  if (slug) startUrl = `/?s=${slug}`;
  else if (ownerId) startUrl = `/?o=${ownerId}`;
  
  if (isLogistica) {
    startUrl += (startUrl.includes('?') ? '&' : '?') + 'type=logistica';
  }

  const manifest = {
    name: name,
    short_name: name.length > 15 ? name.substring(0, 15) : name,
    description: `Sistema de gestión — ${name}`,
    start_url: startUrl,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: bgColor,
    theme_color: themeColor,
    icons: [
      {
        src: iconUrl,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: iconUrl,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: iconUrl,
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  };

  // Headers críticos para que el browser acepte el manifest
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(manifest);
}

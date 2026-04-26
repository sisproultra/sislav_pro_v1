import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  const { s: slug, o: ownerId, type } = req.query;
  const isLogistica = type === 'logistica';
  
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Z3NoZHlwcWFubGNneGR5dmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjYyODIsImV4cCI6MjA4NTE0MjI4Mn0.B65RRA4u5-a_6E-blMvQXMKf39521esSif4XODdzfNE';

  let name = 'SISLAV';
  let shortName = 'SISLAV';
  let themeColor = '#4f8ef7';
  let logoUrl = 'https://lavanderiasislav.com/logo-sislav.png';
  let startUrl = isLogistica ? '/logistica' : '/';

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    let data: any = null;
    if (ownerId) {
      const { data: empresa } = await supabase
        .from('empresas_holding')
        .select('nombre_empresa, url_logo, url_favicon, url_favicon_logistica, color_primario')
        .eq('id', (ownerId as string).trim())
        .maybeSingle();

      if (empresa) {
        data = {
          nombre: isLogistica ? `LOGÍSTICA ${empresa.nombre_empresa}` : empresa.nombre_empresa,
          logo: isLogistica ? (empresa.url_favicon_logistica || empresa.url_favicon || empresa.url_logo) : (empresa.url_favicon || empresa.url_logo),
          color: empresa.color_primario,
          start: isLogistica ? `/logistica?o=${(ownerId as string).trim()}` : `/?o=${(ownerId as string).trim()}`
        };
      }
    } else if (slug) {
      const { data: sucursal } = await supabase
        .from('sucursales')
        .select('nombre_sucursal, url_logo, url_favicon, url_favicon_logistica, color_primario')
        .eq('slug', (slug as string).trim())
        .maybeSingle();
      
      if (sucursal) {
        data = {
          nombre: isLogistica ? `LOGÍSTICA ${sucursal.nombre_sucursal}` : sucursal.nombre_sucursal,
          logo: isLogistica ? (sucursal.url_favicon_logistica || sucursal.url_favicon || sucursal.url_logo) : (sucursal.url_favicon || sucursal.url_logo),
          color: sucursal.color_primario,
          start: isLogistica ? `/logistica?s=${(slug as string).trim()}` : `/?s=${(slug as string).trim()}`
        };
      }
    }

    if (data) {
      name = `${data.nombre} - CONTROL TOTAL`;
      shortName = data.nombre;
      themeColor = data.color || themeColor;
      logoUrl = data.logo || logoUrl;
      startUrl = data.start || startUrl;
    }
  } catch (error) {
    console.error('Error generating manifest:', error);
  }

  const manifest = {
    "name": name,
    "short_name": shortName,
    "description": `Sistema de gestión integral para ${shortName}`,
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
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=1200');
  res.status(200).send(JSON.stringify(manifest));
}

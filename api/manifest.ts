import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  const { s: slug, o: ownerId } = req.query;
  
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Z3NoZHlwcWFubGNneGR5dmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjYyODIsImV4cCI6MjA4NTE0MjI4Mn0.B65RRA4u5-a_6E-blMvQXMKf39521esSif4XODdzfNE';

  let name = 'SISLAV';
  let shortName = 'SISLAV';
  let themeColor = '#4f8ef7';
  let logoUrl = 'https://lavanderiasislav.com/logo-sislav.png';
  let startUrl = '/';

  try {
    if (slug || ownerId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      let data: any = null;
      if (slug) {
        const { data: sucursal } = await supabase
          .from('sucursales')
          .select('nombre_sucursal, url_logo, url_favicon, color_primario')
          .eq('slug', slug)
          .maybeSingle();
        data = sucursal;
        if (data) startUrl = `/?s=${slug}`;
      } else if (ownerId) {
        const { data: empresa } = await supabase
          .from('empresas_holding')
          .select('nombre_empresa, url_logo, color_primario')
          .eq('id', ownerId)
          .maybeSingle();
        if (empresa) {
          data = {
            nombre_sucursal: empresa.nombre_empresa,
            url_logo: empresa.url_logo,
            color_primario: empresa.color_primario
          };
          startUrl = `/?o=${ownerId}`;
        }
      }

      if (data) {
        name = `${data.nombre_sucursal} - CONTROL TOTAL`;
        shortName = data.nombre_sucursal;
        themeColor = data.color_primario || themeColor;
        logoUrl = data.url_favicon || data.url_logo || logoUrl;
      }
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
        "type": "image/png",
        "purpose": "any"
      },
      {
        "src": logoUrl,
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any"
      }
    ],
    "orientation": "portrait",
    "scope": "/"
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');
  res.status(200).send(JSON.stringify(manifest, null, 2));
}

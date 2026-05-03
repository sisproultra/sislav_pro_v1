import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ||
  'https://yvgshdypqanlcgxdyvls.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Z3NoZHlwcWFubGNneGR5dmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjYyODIsImV4cCI6MjA4NTE0MjI4Mn0.B65RRA4u5-a_6E-blMvQXMKf39521esSif4XODdzfNE';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { s: slug, o: ownerId, type } = req.query;
  const isLogistica = type === 'logistica';

  const baseUrl = `https://${req.headers.host}`;
  let name = 'SISLAV';
  let shortName = 'SISLAV';
  let iconUrl = `${baseUrl}/icons/icon-512.png`; // fallback absoluto
  let themeColor = '#1A6EF5';
  let bgColor = '#0d0f14';

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
        name = record.nombre_comercial ||
          record.nombre_sucursal ||
          record.nombre_empresa ||
          'SISLAV';

        shortName = name.substring(0, 12);

        const logoField = isLogistica
          ? (record.url_favicon_logistica || record.url_favicon || record.url_logo)
          : (record.url_favicon || record.url_logo);

        if (logoField) {
          // Garantizar URL absoluta
          iconUrl = logoField.startsWith('http') ? logoField : `${baseUrl}${logoField}`;
        }

        if (record.color_primario) themeColor = record.color_primario;
        if (record.color_secundario) bgColor = record.color_secundario;
      }
    }
  } catch (e) {
    console.error('Error fetching branding for manifest:', e);
  }

  // ── Íconos con tamaños correctos ──────────────────────────────────────────
  // Si la imagen está en Supabase Storage, usamos la API de transformación
  // para servir 192x192 y 512x512 desde la misma URL original.
  // El cliente solo necesita subir UNA imagen de al menos 512x512 px.
  const isSupabaseStorage = iconUrl.includes('.supabase.co/storage');

  // Limpiar params previos para no duplicarlos si ya vienen en la URL
  const iconBase = iconUrl.split('?')[0];

  const icon192 = isSupabaseStorage
    ? `${iconBase}?width=192&height=192&resize=cover`
    : iconUrl;

  const icon512 = isSupabaseStorage
    ? `${iconBase}?width=512&height=512&resize=cover`
    : iconUrl;

  // ── start_url con los params de sucursal ──────────────────────────────────
  const urlParams = new URLSearchParams();
  if (slug) urlParams.set('s', slug as string);
  if (ownerId) urlParams.set('o', ownerId as string);
  if (isLogistica) urlParams.set('type', 'logistica');
  const startUrl = urlParams.toString() ? `/?${urlParams.toString()}` : '/';

  // ── Manifest final ────────────────────────────────────────────────────────
  const manifest = {
    name,
    short_name: shortName,
    description: `Sistema de gestión — ${name}`,
    start_url: startUrl,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: bgColor,
    theme_color: themeColor,
    icons: [
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(manifest);
}

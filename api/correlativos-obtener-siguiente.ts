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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { branchId, targetType, targetSerie } = req.body;

  if (!branchId || !targetType) {
    return res.status(400).json({ error: 'branchId y targetType son requeridos' });
  }

  try {
    console.log(`🚀 [Vercel API Correlativos] Obtener correlativo para Branch: ${branchId}, Tipo: ${targetType}, Serie: ${targetSerie}`);

    // Configuración de Supabase Admin
    const rawUrl = (process.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co').replace(/['"]/g, '').trim();
    const rawKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY || 
      process.env.SUPABASE_SERVICE_KEY || 
      process.env.SUPABASE_SECRET_KEY || 
      process.env.SERVICE_ROLE_KEY || 
      process.env.SUPABASE_ADMIN_KEY || 
      'N/A'
    ).replace(/['"]/g, '').trim();

    const supabaseUrl = cleanUrl(rawUrl);
    const supabaseServiceKey = rawKey;

    if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'N/A') {
      return res.status(500).json({ 
        error: 'Las credenciales de administración (SUPABASE_SERVICE_ROLE_KEY) no están configuradas en el servidor de Vercel.' 
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: nextNumber, error: rpcError } = await supabaseAdmin.rpc('obtener_siguiente_correlativo', {
      p_sucursal_id: branchId,
      p_tipo_documento: targetType,
      p_serie: targetSerie || ''
    });

    if (rpcError) {
      console.error("❌ Error en RPC obtener_siguiente_correlativo via Vercel:", rpcError);
      return res.status(500).json({ error: rpcError.message });
    }

    console.log(`✅ Correlativo asignado via Vercel admin: ${nextNumber}`);
    res.status(200).json({ success: true, nextNumber });
  } catch (error: any) {
    console.error('❌ Error en obtener-siguiente correlativo API:', error.message);
    res.status(500).json({ error: error.message });
  }
}

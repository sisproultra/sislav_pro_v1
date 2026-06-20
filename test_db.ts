
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const cleanUrl = (urlStr: string) => {
    if (!urlStr) return '';
    try {
        let trimmed = urlStr.trim().replace(/['"]/g, '');
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

const rawUrl = process.env.VITE_SUPABASE_URL || '';
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseUrl = cleanUrl(rawUrl);
const supabaseAnonKey = rawKey.replace(/['"]/g, '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
    const ids = ['23a1c09a-9436-48aa-ae5c-434e031b6112', 'e7ccfb95-8f41-4fa7-bff4-35797b9de7f9'];
    for (const targetId of ids) {
        console.log(`🚀 Buscando ID ${targetId} en ventas...`);
        const { data: v, error: vErr } = await supabase
            .from('ventas')
            .select('id, codigo_orden, serie, correlativo, total')
            .eq('id', targetId)
            .maybeSingle();

        if (vErr) {
            console.error(`❌ Error en ID ${targetId}:`, vErr);
        } else {
            console.log(`✅ ID ${targetId}:`, v ? `ENCONTRADO (Orden: ${v.codigo_orden}, Doc: ${v.serie}-${v.correlativo}, Total: ${v.total})` : 'NO ENCONTRADO');
        }
    }
}

testQuery();

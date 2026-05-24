
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
    console.log(`🚀 Buscando en usuarios_login para inspeccionar columnas...`);
    const { data, error } = await supabase
        .from("usuarios_login")
        .select("*")
        .limit(1);

    if (error) {
        console.error('❌ Error:', error);
    } else if (!data || data.length === 0) {
        console.warn('⚠️ No se encontraron registros en usuarios_login');
    } else {
        console.log('✅ Registro encontrado. Columnas:', Object.keys(data[0]));
        console.log('✅ Ejemplo de registro:', data[0]);
    }
}

testQuery();

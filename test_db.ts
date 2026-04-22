
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
    const username = 'lavaflash';
    console.log(`🚀 Buscando en usuarios_login por username: ${username}...`);
    const { data, error } = await supabase
        .from("usuarios_login")
        .select("*")
        .eq("username", username)
        .maybeSingle();

    if (error) {
        console.error('❌ Error:', error);
    } else if (!data) {
        console.warn('⚠️ No se encontró el usuario en usuarios_login');
    } else {
        console.log('✅ Usuario encontrado en usuarios_login:', data);
    }
}

testQuery();

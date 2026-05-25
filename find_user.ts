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
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Use service role to bypass policies and find anything
const supabaseUrl = cleanUrl(rawUrl);
const supabaseKey = rawKey.replace(/['"]/g, '').trim();

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Faltan variables de entorno VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findUser() {
    const usernameSearch = 'jobregon';
    console.log(`🔍 Buscando "${usernameSearch}" en usuarios_login de Supabase...`);
    
    // 1. Buscando en usuarios_login
    const { data: dbRecords, error: dbError } = await supabase
        .from("usuarios_login")
        .select("*")
        .ilike("username", `%${usernameSearch}%`);

    if (dbError) {
        console.error('❌ Error buscando en public.usuarios_login:', dbError);
    } else {
        console.log(`✅ Coincidencias en public.usuarios_login (${dbRecords?.length || 0}):`);
        dbRecords?.forEach(r => {
            console.log({
                id: r.id,
                username: r.username,
                nombre_completo: r.nombre_completo,
                rol: r.rol,
                activo: r.activo,
                telefono: r.telefono,
                sucursal_id: r.sucursal_id,
                empresa_id: r.empresa_id
            });
        });
    }

    // 2. Buscando en auth.users si tiene acceso de admin
    console.log(`\n🔍 Buscando "${usernameSearch}" en auth.users...`);
    try {
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) {
            console.error('❌ Error buscando en auth.users:', authError);
        } else if (authUsers && authUsers.users) {
            const matches = authUsers.users.filter(u => 
                (u.email && u.email.toLowerCase().includes(usernameSearch)) ||
                (u.user_metadata && JSON.stringify(u.user_metadata).toLowerCase().includes(usernameSearch))
            );
            console.log(`✅ Coincidencias en auth.users (${matches.length}):`);
            matches.forEach(u => {
                console.log({
                    id: u.id,
                    email: u.email,
                    user_metadata: u.user_metadata,
                    created_at: u.created_at,
                    last_sign_in_at: u.last_sign_in_at
                });
            });
        }
    } catch (e) {
        console.error('❌ Error al listar auth.users:', e);
    }
}

findUser();

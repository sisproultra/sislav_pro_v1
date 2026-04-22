
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
async function check() {
    const { data: cols, error } = await supabase.from('clientes').select('*').limit(1);
    if (error) console.error(error);
    else console.log(Object.keys(cols[0] || {}));
}
check();

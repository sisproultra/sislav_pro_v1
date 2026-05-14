
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables');
  if (error) {
     const { data: data2, error: error2 } = await supabase.from('ventas').select('id').limit(1);
     console.log('Direct select from ventas:', { data: data2, error: error2 });
  } else {
     console.log('Tables:', data);
  }
}
listTables();

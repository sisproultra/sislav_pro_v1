
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function checkVentas() {
  const { data, error } = await supabase.from('ventas').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log('Columns in ventas:', Object.keys(data[0] || {}));
    console.log('Sample data:', data[0]);
  }
}

checkVentas();


import { supabase } from './services/supabaseClient';

async function checkCols() {
  const { data, error } = await supabase.from('items_venta').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log("Columns in items_venta:", Object.keys(data[0] || {}));
    console.log("Sample item data:", data[0]);
  }
}

checkCols();

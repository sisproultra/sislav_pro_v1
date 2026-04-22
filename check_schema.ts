
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSchema() {
    console.log("--- Items Venta Sample Data ---");
    const { data, error } = await supabase.from('items_venta').select('*').limit(1);
    if (error) {
        console.error("Error fetching items_venta:", error);
    } else {
        console.log("Columns found:", data && data[0] ? Object.keys(data[0]) : "No data to infer columns");
        if (data && data[0]) console.log("Sample row:", data[0]);
    }
}

checkSchema();

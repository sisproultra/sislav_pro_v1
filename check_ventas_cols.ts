
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yvgshdypqanlcgxdyvls.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Z3NoZHlwcWFubGNneGR5dmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjYyODIsImV4cCI6MjA4NTE0MjI4Mn0.B65RRA4u5-a_6E-blMvQXMKf39521esSif4XODdzfNE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkVentasColumns() {
    console.log("--- Checking ventas columns ---");
    const { data, error } = await supabase.from('ventas').select('*').limit(1);
    if (error) {
        console.error("Error fetching ventas:", error);
    } else {
        const columns = data && data[0] ? Object.keys(data[0]) : [];
        console.log("Columns found in ventas:", columns.sort());
    }
}

checkVentasColumns();


import { supabase } from './services/supabaseClient';

async function checkSucursalesColumns() {
    console.log("--- Checking sucursales columns ---");
    const { data, error } = await supabase.from('sucursales').select('*').limit(1);
    if (error) {
        console.error("Error fetching sucursales:", error);
    } else {
        const columns = data && data[0] ? Object.keys(data[0]) : [];
        console.log("Columns found:", columns);
        
        const requiredFields = [
            'nombre_comercial',
            'ubigeo',
            'urbanizacion',
            'distrito',
            'provincia',
            'departamento'
        ];
        
        const missing = requiredFields.filter(f => !columns.includes(f));
        if (missing.length > 0) {
            console.log("\nMISSING COLUMNS:", missing);
        } else {
            console.log("\nAll fiscal columns exist.");
        }
    }
}

checkSucursalesColumns();

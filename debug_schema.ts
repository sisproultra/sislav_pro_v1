
import { createClient } from '@supabase/supabase-js';

// Fallbacks para Node.js
const SUPABASE_URL = 'https://yvgshdypqanlcgxdyvls.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Z3NoZHlwcWFubGNneGR5dmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjYyODIsImV4cCI6MjA4NTE0MjI4Mn0.B65RRA4u5-a_6E-blMvQXMKf39521esSif4XODdzfNE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

async function checkTicketConfig() {
    console.log("\n--- Checking sucursal_ticket_config ---");
    const { data, error } = await supabase.from('sucursal_ticket_config').select('*').limit(1);
    if (error) {
        console.error("Error fetching sucursal_ticket_config:", error.message);
        if (error.message.includes("permission denied")) {
            console.log("CRITICAL: Permission denied. RLS is likely blocking access.");
        }
    } else {
        console.log("Success fetching sucursal_ticket_config. Fields:", data && data[0] ? Object.keys(data[0]) : "Table empty but accessible");
    }
}

async function checkBanners() {
    console.log("\n--- Checking sucursal_banners ---");
    const { data, error } = await supabase.from('sucursal_banners').select('*').limit(1);
    if (error) {
        console.error("Error fetching sucursal_banners:", error.message);
    } else {
        console.log("Success fetching sucursal_banners. Fields:", data && data[0] ? Object.keys(data[0]) : "Table empty but accessible");
    }
}

async function run() {
    await checkSucursalesColumns();
    await checkTicketConfig();
    await checkBanners();
}

run();


const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://yvgshdypqanlcgxdyvls.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '' // We might not have this, but let's try with anon key first if we have it
);

async function check() {
    console.log("Checking tables...");
    // Try to get columns via a query that fails but shows schema or just select *
    const { data: chofer_sucursales, error: err1 } = await supabase.from('chofer_sucursales').select('*').limit(0);
    console.log('chofer_sucursales error (to see if table exists):', err1);

    const { data: sucursal_conexiones, error: err2 } = await supabase.from('sucursal_conexiones').select('*').limit(0);
    console.log('sucursal_conexiones error:', err2);
}

check();


import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://yvgshdypqanlcgxdyvls.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Z3NoZHlwcWFubGNneGR5dmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjYyODIsImV4cCI6MjA4NTE0MjI4Mn0.B65RRA4u5-a_6E-blMvQXMKf39521esSif4XODdzfNE'
);

async function check() {
    console.log("Checking tables...");
    const { data: chofer_sucursales, error: err1 } = await supabase.from('chofer_sucursales').select('*').limit(1);
    console.log('chofer_sucursales sample:', chofer_sucursales);
    if (err1) console.error('Error chofer_sucursales:', err1);

    const { data: sucursal_conexiones, error: err2 } = await supabase.from('sucursal_conexiones').select('*').limit(1);
    console.log('sucursal_conexiones sample:', sucursal_conexiones);
    if (err2) console.error('Error sucursal_conexiones:', err2);
}

check();

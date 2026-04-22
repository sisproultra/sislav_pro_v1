
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yvgshdypqanlcgxdyvls.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Z3NoZHlwcWFubGNneGR5dmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjYyODIsImV4cCI6MjA4NTE0MjI4Mn0.B65RRA4u5-a_6E-blMvQXMKf39521esSif4XODdzfNE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnoseConstraint() {
    console.log("--- Inspecting unique_venta_legal constraint ---");
    // We can't see constraint definition easily, so let's find the max correlativos per serie/tipo in Ventas
    const { data: maxVentas, error: errVentas } = await supabase
        .from('ventas')
        .select('sucursal_id, tipo_documento_codigo, serie, correlativo')
        .order('correlativo', { ascending: false })
        .limit(10);
    
    if (errVentas) console.error("Error fetching last ventas:", errVentas);
    else console.log("Current top correlativos in ventas:", maxVentas);

    console.log("--- Checking dispensador_correlativos status ---");
    const { data: dispensador, error: errDisp } = await supabase
        .from('dispensador_correlativos')
        .select('*');
    
    if (errDisp) console.error("Error fetching dispensador:", errDisp);
    else console.log("State of dispensador_correlativos:", dispensador);
}

diagnoseConstraint();

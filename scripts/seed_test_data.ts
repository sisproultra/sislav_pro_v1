
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usar service role para saltar RLS en seeding

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Faltan variables de entorno. Asegúrate de tener VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
    console.log('🌱 Iniciando Seeding de base de datos para pruebas...');

    try {
        // 1. Crear Holding
        const { data: holding, error: hError } = await supabase
            .from('empresas_holding')
            .insert({
                nombre_empresa: 'HOLDING TEST AUTOMATION',
                ruc: '20123456789',
                activo: true
            })
            .select()
            .single();

        if (hError) throw hError;
        console.log('✅ Holding creado:', holding.id);

        // 2. Crear Sucursal
        const { data: sucursal, error: sError } = await supabase
            .from('sucursales')
            .insert({
                empresa_id: holding.id,
                nombre_sucursal: 'SEDE CENTRAL PRUEBAS',
                slug: 'sede-pruebas',
                direccion: 'Av. Testing 123',
                activo: true,
                color_primario: '#4f46e5',
                color_secundario: '#10b981'
            })
            .select()
            .single();

        if (sError) throw sError;
        console.log('✅ Sucursal creada:', sucursal.id);

        // 3. Crear Categorías Base
        const { error: catError } = await supabase
            .from('categorias')
            .insert([
                { sucursal_id: sucursal.id, nombre: 'LAVADO', activo: true },
                { sucursal_id: sucursal.id, nombre: 'PLANCHADO', activo: true },
                { sucursal_id: sucursal.id, nombre: 'TINTORERIA', activo: true }
            ]);
        if (catError) throw catError;
        console.log('✅ Categorías creadas');

        // 4. Crear Productos Base
        const { data: categories } = await supabase.from('categorias').select('*').eq('sucursal_id', sucursal.id);
        const lavadoId = categories?.find(c => c.nombre === 'LAVADO')?.id;

        if (lavadoId) {
            const { error: prodError } = await supabase
                .from('productos')
                .insert([
                    { sucursal_id: sucursal.id, categoria_id: lavadoId, nombre: 'LAVADO X KG', precio: 5.00, activo: true, tipo_unidad: 'KG' },
                    { sucursal_id: sucursal.id, categoria_id: lavadoId, nombre: 'EDREDON 2 PLAZAS', precio: 15.00, activo: true, tipo_unidad: 'UND' }
                ]);
            if (prodError) throw prodError;
            console.log('✅ Productos creados');
        }

        console.log('\n🚀 BASE DE DATOS LISTA PARA PRUEBAS');
        console.log('-----------------------------------');
        console.log('URL de Acceso:', `https://tu-app.vercel.app/?s=sede-pruebas`);
        console.log('-----------------------------------');

    } catch (err: any) {
        console.error('❌ Error durante el seeding:', err.message);
    }
}

seed();


import { createClient } from '@supabase/supabase-js';
import { TenantConfig } from '../types';

// Credenciales para el proyecto sislav_power
const rawUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co').replace(/['"]/g, '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Z3NoZHlwcWFubGNneGR5dmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjYyODIsImV4cCI6MjA4NTE0MjI4Mn0.B65RRA4u5-a_6E-blMvQXMKf39521esSif4XODdzfNE').replace(/['"]/g, '').trim();

// Limpieza crítica de la URL (Asegurar que sea solo el origin: https://xyz.supabase.co)
const cleanUrl = (url: string) => {
  if (!url) return '';
  try {
    let trimmed = url.trim();
    if (!trimmed.toLowerCase().startsWith('http')) {
      trimmed = `https://${trimmed}`;
    }
    const parsed = new URL(trimmed);
    
    // Si la URL termina en /rest/v1 o /rest/v1/, lo quitamos porque supabase-js lo agrega solo.
    let cleanPath = parsed.pathname.replace(/\/rest\/v1\/?$/, '');
    if (cleanPath === '/') cleanPath = '';
    
    return `${parsed.origin}${cleanPath}`;
  } catch (e) {
    console.error("❌ [SupabaseClient] Error al procesar URL:", url, e);
    return url.trim().replace(/\/$/, '').split('/rest/v1')[0];
  }
};

export const SUPABASE_URL = cleanUrl(rawUrl);
export const SUPABASE_ANON_KEY = rawKey;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test de conexión inmediato para diagnóstico
(async () => {
  console.log("🔌 [Supabase] Iniciando conexión...", { 
    url: SUPABASE_URL,
    keyPrefix: SUPABASE_ANON_KEY.substring(0, 10) + "..."
  });
  
  try {
    // Intentamos una operación mínima para validar el path
    const { error } = await supabase.from('_test_connection_').select('count', { count: 'exact', head: true }).limit(1);
    // PGRST116 o 404 (Relation not found) es BUENA SEÑAL (el path es válido)
    // PGRST125 es MALA SEÑAL (el path es inválido)
    if (error && error.code === 'PGRST125') {
      console.error("🚨 [Supabase] ERROR CRÍTICO DE PATH (PGRST125). La URL configurada parece incorrecta o mal formada.");
    } else {
      console.log("✅ [Supabase] Estructura de URL validada (Path OK).");
    }
  } catch (e) {
    console.warn("⚠️ [Supabase] No se pudo realizar el test de pre-conexión:", e);
  }
})();

export const initTenantClient = (config: TenantConfig): any => {
  console.log(`🔗 SISLAV POWER conectado: ${config.name} (${config.id})`);
  // En este entorno web, el cliente es único.
  return supabase;
};

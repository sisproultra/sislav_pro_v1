
import { createClient } from '@supabase/supabase-js';

// CREDENCIALES DEL PROYECTO YAPE_LISTENER (Independiente del sistema principal)
const YAPE_URL = 'https://ztvktgneiojwijdbrytu.supabase.co';
const YAPE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0dmt0Z25laW9qd2lqZGJyeXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2OTgyMjksImV4cCI6MjA4NDI3NDIyOX0.75bzES4T1GYPHvOPY5Bgy-TRMdmvIljPzuKiRKpjSW0';

export const yapeSupabase = createClient(YAPE_URL, YAPE_KEY);

export interface YapePayment {
    id: number;
    created_at: string;
    id_envio: string;
    monto: number;
    persona: string;
    tipo: string;
    fecha: string;
    timestamp_android: number;
    mensaje_completo: string;
    dispositivo_id: string;
    tenant_id: string;
}

/**
 * Obtiene los movimientos históricos de la tabla transacciones_yape filtrados por Tenant ID
 */
export const fetchYapeMovements = async (tenantId: string): Promise<YapePayment[]> => {
    try {
        const { data, error } = await yapeSupabase
            .from('transacciones_yape')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Error al conectar con la DB de Yape:", e);
        return [];
    }
};

/**
 * Suscripción en tiempo real para recibir notificaciones instantáneas de Yape filtradas por Tenant ID
 */
export const subscribeToYapeMovements = (tenantId: string, onNewPayment: (payload: YapePayment) => void) => {
    return yapeSupabase
        .channel(`yape-realtime-${tenantId}`)
        .on(
            'postgres_changes',
            { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'transacciones_yape',
              filter: `tenant_id=eq.${tenantId}` 
            },
            (payload) => {
                onNewPayment(payload.new as YapePayment);
            }
        )
        .subscribe();
};

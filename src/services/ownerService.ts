import { supabase } from '../../services/supabaseClient';

export interface OwnerDashboardData {
  diarias: { fecha_dia: string; nombre_sucursal: string; total: number }[];
  participacion: { nombre_sucursal: string; total: number; transacciones: number; ticket_promedio: number }[];
  por_hora: { hora: number; nombre_sucursal: string; total: number }[];
  por_semana: { dia_semana: number; nombre_sucursal: string; total: number }[];
  actualizado_al: string;
}

export const getOwnerDashboardStats = async (dias: number = 30, empresaId?: string): Promise<OwnerDashboardData> => {
  const { data, error } = await supabase.rpc('get_owner_dashboard_stats', { 
    p_dias_atras: dias,
    p_empresa_id: empresaId 
  });
  if (error) throw error;
  return data as OwnerDashboardData;
};

export const getOwnerSucursales = async (empresaId?: string) => {
  let query = supabase
    .from('sucursales')
    .select('*')
    .order('nombre_sucursal', { ascending: true });
  
  if (empresaId) {
    query = query.eq('empresa_id', empresaId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getOwnerCompanyInfo = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('empresas_holding')
    .select('*')
    .eq('id', user.app_metadata?.empresa_holding_id)
    .single();
    
  if (error) throw error;
  return data;
};

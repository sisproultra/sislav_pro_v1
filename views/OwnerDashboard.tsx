import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Users, DollarSign, Clock, Calendar, 
  LayoutDashboard, LogOut, Sun, Moon, ChevronRight, Menu, XCircle,
  Store, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2,
  Truck, MapPin, Plus, Trash2, CheckCircle2, AlertTriangle, ShieldCheck,
  ArrowDownLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getOwnerDashboardStats, getOwnerSucursales, OwnerDashboardData } from '../src/services/ownerService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  dbGetLogisticsDrivers, dbGetDriverRoutes, dbAssignDriverRoute, dbRemoveDriverRoute,
  dbGetSucursalConexiones, dbAddSucursalConexion, dbRemoveSucursalConexion
} from '../services/dbService';
import { createInitialHoldingUser } from '../services/saasService';
import { UserRole } from '../types';
import { supabase } from '../services/supabaseClient';

interface OwnerDashboardProps {
  session: any;
  onLogout: () => void;
  onSelectBranch: (branch: any) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const COLORS = ['#4f8ef7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

import { applyDynamicManifest } from '../utils/pwaUtils';

export default function OwnerDashboard({ session, onLogout, onSelectBranch, isDarkMode, toggleTheme }: OwnerDashboardProps) {
  const [data, setData] = useState<OwnerDashboardData | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [holdingInfo, setHoldingInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);

  // Aplicar manifest dinámico cuando se carga la información del holding
  useEffect(() => {
    if (holdingInfo) {
      applyDynamicManifest({
        name: holdingInfo.nombre_comercial || holdingInfo.name || 'SISLAV OWNER',
        shortName: (holdingInfo.nombre_comercial || holdingInfo.name || 'SISLAV').substring(0, 12),
        iconUrl: holdingInfo.url_favicon || holdingInfo.url_logo || 'https://lavanderiasislav.com/favicon.png',
        themeColor: holdingInfo.color_primario || '#1A6EF5',
        backgroundColor: holdingInfo.color_secundario || '#0d0f14',
        startUrl: window.location.href
      });
      document.title = `${holdingInfo.nombre_comercial || holdingInfo.name} - PANEL OWNER`;
    }
  }, [holdingInfo?.id]);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [isCustomDate, setIsCustomDate] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logistics'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const activeBranches = useMemo(() => {
    if (!selectedBranchId) return branches;
    return branches.filter(b => b.id === selectedBranchId);
  }, [branches, selectedBranchId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Robust holdingId identification
      const holdingId = session.user.holding_id || 
                       session.user.empresa_holding_id || 
                       session.user.empresa_id || 
                       localStorage.getItem('sislav_active_holding_uuid');

      if (!holdingId) {
        console.warn('OwnerDashboard: No holdingId found in session or localStorage');
        setLoading(false);
        return;
      }

      // If custom date is used, calculate days back from today to the start date
      // Note: This is a limitation of the current RPC which only accepts "days back"
      let effectiveDays = timeRange;
      if (isCustomDate && customRange.start) {
        try {
          const start = new Date(customRange.start);
          const now = new Date();
          effectiveDays = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        } catch (e) {
          console.error("Invalid custom date:", e);
        }
      }

      const [stats, sucursales, hInfo] = await Promise.all([
        getOwnerDashboardStats(effectiveDays, holdingId),
        getOwnerSucursales(holdingId),
        supabase.from('empresas_holding').select('*').eq('id', holdingId).maybeSingle().then(res => res.data)
      ]);
      setData(stats || { diarias: [], participacion: [], por_hora: [], por_semana: [], actualizado_al: new Date().toISOString() });
      setBranches(sucursales || []);
      setHoldingInfo(hInfo);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange, session.user.holding_id, session.user.empresa_id]);

  const selectedBranchName = useMemo(() => {
    return branches.find(b => b.id === selectedBranchId)?.nombre_sucursal;
  }, [branches, selectedBranchId]);

  const filteredData = useMemo(() => {
    if (!data || !selectedBranchName) return data;
    return {
      ...data,
      diarias: data.diarias.filter(d => d.nombre_sucursal === selectedBranchName),
      participacion: data.participacion.filter(d => d.nombre_sucursal === selectedBranchName),
      por_hora: data.por_hora.filter(d => d.nombre_sucursal === selectedBranchName),
      por_semana: data.por_semana.filter(d => d.nombre_sucursal === selectedBranchName),
    };
  }, [data, selectedBranchName]);

  const processedDiarias = useMemo(() => {
    if (!filteredData?.diarias || !Array.isArray(filteredData.diarias)) return [];
    const grouped = filteredData.diarias.reduce((acc: any, curr: any) => {
      if (!acc[curr.fecha_dia]) {
        acc[curr.fecha_dia] = { fecha_dia: curr.fecha_dia };
      }
      acc[curr.fecha_dia][curr.nombre_sucursal] = curr.total;
      return acc;
    }, {});
    return Object.values(grouped).sort((a: any, b: any) => a.fecha_dia.localeCompare(b.fecha_dia));
  }, [filteredData?.diarias]);

  const processedSemana = useMemo(() => {
    if (!filteredData?.por_semana || !Array.isArray(filteredData.por_semana)) return [];
    const grouped = filteredData.por_semana.reduce((acc: any, curr: any) => {
      if (!acc[curr.dia_semana]) {
        acc[curr.dia_semana] = { dia_semana: curr.dia_semana };
      }
      acc[curr.dia_semana][curr.nombre_sucursal] = curr.total;
      return acc;
    }, {});
    return Object.values(grouped).sort((a: any, b: any) => a.dia_semana - b.dia_semana);
  }, [filteredData?.por_semana]);

  const processedHora = useMemo(() => {
    if (!filteredData?.por_hora || !Array.isArray(filteredData.por_hora)) return [];
    const grouped = filteredData.por_hora.reduce((acc: any, curr: any) => {
      if (!acc[curr.hora]) {
        acc[curr.hora] = { hora: curr.hora };
      }
      acc[curr.hora][curr.nombre_sucursal] = curr.total;
      return acc;
    }, {});
    return Object.values(grouped).sort((a: any, b: any) => a.hora - b.hora);
  }, [filteredData?.por_hora]);

  const totalSales = useMemo(() => {
    if (!filteredData?.participacion || !Array.isArray(filteredData.participacion)) return 0;
    return filteredData.participacion.reduce((acc: number, curr: any) => acc + curr.total, 0);
  }, [filteredData]);

  const totalTrans = useMemo(() => {
    if (!filteredData?.participacion || !Array.isArray(filteredData.participacion)) return 0;
    return filteredData.participacion.reduce((acc: number, curr: any) => acc + curr.transacciones, 0);
  }, [filteredData]);

  const avgTicket = useMemo(() => {
    return totalTrans > 0 ? totalSales / totalTrans : 0;
  }, [totalSales, totalTrans]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
          <p className="text-text2 font-medium">Cargando inteligencia de negocio...</p>
        </div>
      </div>
    );
  }

  const themeClass = isDarkMode ? 'dark bg-[#0d0f14] text-white' : 'bg-gray-50 text-gray-900';
  const cardClass = isDarkMode ? 'bg-surface border-white/5' : 'bg-white border-gray-200 shadow-sm';
  const textSecondary = isDarkMode ? 'text-text2' : 'text-gray-500';

  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 font-sans overflow-hidden ${themeClass}`}>
      {/* MOBILE SIDEBAR */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] xl:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed inset-y-0 left-0 w-72 z-[70] p-6 shadow-2xl xl:hidden flex flex-col ${isDarkMode ? 'bg-surface border-r border-white/5' : 'bg-white border-r border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  {holdingInfo?.url_favicon ? (
                    <img src={holdingInfo.url_favicon} className="w-10 h-10 object-contain rounded-xl" alt="Favicon" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold">
                      {session.user.company_name?.charAt(0)}
                    </div>
                  )}
                  <span className="font-bold text-sm">Menú Corporativo</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">
                  <XCircle className="w-5 h-5 text-text2" />
                </button>
              </div>

              <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-text3 uppercase tracking-widest px-2">Navegación</p>
                  <button
                    onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                    className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-3 ${
                      activeTab === 'dashboard' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text2 hover:bg-white/5'
                    }`}
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    Dashboard Ejecutivo
                  </button>
                  <button
                    onClick={() => { setActiveTab('logistics'); setIsMobileMenuOpen(false); }}
                    className={`w-full px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-3 ${
                      activeTab === 'logistics' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-text2 hover:bg-white/5'
                    }`}
                  >
                    <Truck className="w-5 h-5" />
                    Logística Hub
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-text3 uppercase tracking-widest px-2">Mis Sucursales</p>
                  <div className="grid grid-cols-1 gap-2">
                    {branches.map(branch => (
                      <button
                        key={branch.id}
                        onClick={() => { onSelectBranch(branch); setIsMobileMenuOpen(false); }}
                        className={`w-full px-4 py-3 rounded-xl text-sm font-medium border transition-all flex items-center gap-3 ${
                          isDarkMode 
                            ? 'bg-bg border-white/5 hover:border-white/20 text-text2 hover:text-white' 
                            : 'bg-white border-gray-100 text-gray-600'
                        }`}
                        style={{ 
                          borderColor: !isDarkMode && branch.color_primario ? `${branch.color_primario}20` : undefined,
                          color: !isDarkMode && branch.color_primario ? branch.color_primario : undefined,
                          backgroundColor: !isDarkMode && branch.color_secundario ? `${branch.color_secundario}05` : undefined
                        }}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-white/5' : ''}`}
                             style={{ backgroundColor: !isDarkMode && branch.color_primario ? `${branch.color_primario}10` : undefined }}>
                          {branch.url_favicon ? (
                            <img src={branch.url_favicon} className="w-5 h-5 object-contain" alt="Sucursal" />
                          ) : (
                            <Store className="w-4 h-4" />
                          )}
                        </div>
                        <span className="truncate">{branch.nombre_sucursal}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 space-y-3">
                {session.user.isMasterBypass && (
                  <button 
                    onClick={() => {
                      const masterSession = {
                        user: {
                          id: 'admin',
                          username: 'admin',
                          name: UserRole.ADMIN,
                          role: UserRole.SAAS_MASTER
                        }
                      };
                      localStorage.setItem('sislav_auth_session', JSON.stringify(masterSession));
                      window.location.reload();
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-indigo-600/10 text-indigo-400 font-bold text-sm flex items-center gap-3 hover:bg-indigo-600 hover:text-white transition-all"
                  >
                    <ShieldCheck className="w-5 h-5" />
                    Volver a Master
                  </button>
                )}
                <button 
                  onClick={onLogout}
                  className="w-full px-4 py-3 rounded-xl bg-red-500/10 text-red-500 font-bold text-sm flex items-center gap-3 hover:bg-red-500 hover:text-white transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  Cerrar Sesión
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className={`shrink-0 z-50 border-b ${isDarkMode ? 'bg-surface border-white/5' : 'bg-white border-gray-200'} px-4 md:px-6 py-4`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 md:gap-8 overflow-hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="xl:hidden p-2 hover:bg-white/5 rounded-lg text-text2"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 shrink-0">
              {holdingInfo?.url_logo ? (
                <img 
                  src={holdingInfo.url_logo} 
                  alt="Logo" 
                  className="h-8 md:h-11 w-auto object-contain" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-accent/10' : 'bg-accent/5'} text-accent`}>
                  <img 
                    src={holdingInfo?.url_logo || 'https://raw.githubusercontent.com/ZapV/ZapV_Images/refs/heads/main/v5.png'} 
                    className="h-8 md:h-10 w-auto object-contain" 
                    alt="Logo Empresa"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="hidden sm:block">
                <h1 className="text-lg md:text-xl font-heading font-bold leading-none">{session.user.holding_name || session.user.company_name}</h1>
                <p className={`text-[10px] md:text-xs mt-1 ${textSecondary}`}>Panel de Control</p>
              </div>
            </div>

            <nav className="hidden xl:flex items-center gap-1 bg-bg/50 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'dashboard' ? 'bg-accent text-white' : 'text-text2 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('logistics')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'logistics' ? 'bg-accent text-white' : 'text-text2 hover:text-white'
                }`}
              >
                <Truck className="w-4 h-4" />
                Logística Hub
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {session.user.isMasterBypass && (
              <button 
                onClick={() => {
                  // Volver al modo maestro
                  const masterSession = {
                    user: {
                      id: 'admin',
                      username: 'admin',
                      name: UserRole.ADMIN,
                      role: UserRole.SAAS_MASTER
                    }
                  };
                  localStorage.setItem('sislav_auth_session', JSON.stringify(masterSession));
                  window.location.reload();
                }}
                className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all bg-indigo-600/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white text-xs font-bold uppercase tracking-widest`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Volver a Master
              </button>
            )}

            <div className="flex items-center gap-2 mr-4">
              {/* Removed branch filter from header as it will be moved below */}
            </div>

            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-all ${isDarkMode ? 'bg-bg border-white/5 text-yellow-400' : 'bg-gray-100 border-gray-200 text-gray-600'}`}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <button 
              onClick={onLogout}
              className={`p-2 rounded-xl border transition-all ${isDarkMode ? 'bg-bg border-white/5 text-red-400 hover:bg-red-500/10' : 'bg-gray-100 border-gray-200 text-red-500 hover:bg-red-50'}`}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        {activeTab === 'dashboard' ? (
          <>
            {/* TOP BAR */}
        {/* DASHBOARD HEADER */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-heading font-bold">Dashboard Ejecutivo</h2>
              <p className={`text-xs md:text-sm ${textSecondary}`}>
                {selectedBranchId ? `Filtrando datos de: ${selectedBranchName}` : 'Resumen de rendimiento de todas tus sucursales'}
              </p>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1 md:gap-2 bg-surface p-1 rounded-xl border border-white/5 self-start sm:self-auto overflow-x-auto no-scrollbar max-w-full">
                <button
                  onClick={() => {
                    setTimeRange(0);
                    setIsCustomDate(false);
                  }}
                  className={`whitespace-nowrap px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-sm font-bold transition-all ${
                    !isCustomDate && timeRange === 0 
                      ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                      : 'text-text2 hover:text-white'
                  }`}
                >
                  HOY
                </button>
                <button
                  onClick={() => {
                    setTimeRange(1);
                    setIsCustomDate(false);
                  }}
                  className={`whitespace-nowrap px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-sm font-bold transition-all ${
                    !isCustomDate && timeRange === 1 
                      ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                      : 'text-text2 hover:text-white'
                  }`}
                >
                  AYER
                </button>
                <button
                  onClick={() => setIsCustomDate(!isCustomDate)}
                  className={`whitespace-nowrap px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-sm font-bold transition-all flex items-center gap-2 ${
                    isCustomDate 
                      ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                      : 'text-text2 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                  RANGO
                </button>
              </div>

              {isCustomDate && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2"
                >
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${isDarkMode ? 'bg-bg border-white/5' : 'bg-white border-gray-100'}`}>
                    <input 
                      type="date" 
                      value={customRange.start}
                      onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                      className="bg-transparent text-[10px] md:text-xs font-bold outline-none"
                    />
                    <span className="text-[10px] text-text3">-</span>
                    <input 
                      type="date" 
                      value={customRange.end}
                      onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                      className="bg-transparent text-[10px] md:text-xs font-bold outline-none"
                    />
                  </div>
                  <button 
                    onClick={fetchData}
                    className="p-2 bg-accent text-white rounded-xl shadow-lg shrink-0 active:scale-95 transition-transform"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </div>
          </div>

          {/* BRANCH FILTER BUTTONS (SCROLLABLE ON MOBILE) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
            <button
              onClick={() => setSelectedBranchId(null)}
              className={`whitespace-nowrap px-2 py-1.5 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl text-[8px] md:text-xs font-bold border transition-all flex items-center gap-1 md:gap-3 shrink-0 snap-start ${
                !selectedBranchId 
                  ? 'bg-accent border-accent text-white shadow-xl shadow-accent/20' 
                  : (isDarkMode ? 'bg-surface border-white/10 text-text2 hover:text-white hover:border-white/20' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400')
              }`}
            >
              <div className={`p-1 md:p-1.5 rounded-lg ${!selectedBranchId ? 'bg-white/20' : (isDarkMode ? 'bg-white/5' : 'bg-gray-100/50')}`}>
                <Store className="w-3 h-3 md:w-4 md:h-4" />
              </div>
              TODAS 
              <span className="hidden sm:inline">LAS SUCURSALES</span>
            </button>
            {branches.map(branch => (
              <button
                key={branch.id}
                onClick={() => setSelectedBranchId(selectedBranchId === branch.id ? null : branch.id)}
                className={`whitespace-nowrap px-2 py-1.5 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl text-[8px] md:text-xs font-bold border transition-all flex items-center gap-1 md:gap-3 shrink-0 snap-start ${
                  selectedBranchId === branch.id 
                    ? 'shadow-xl shadow-accent/20' 
                    : (isDarkMode ? 'bg-surface border-white/10 text-text2 hover:text-white hover:border-white/20' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400')
                }`}
                style={{ 
                  backgroundColor: selectedBranchId === branch.id ? (branch.color_primario || '#4f46e5') : undefined,
                  borderColor: selectedBranchId === branch.id ? (branch.color_primario || '#4f46e5') : (!isDarkMode && branch.color_primario ? `${branch.color_primario}40` : undefined),
                  color: selectedBranchId === branch.id ? '#fff' : (!isDarkMode && branch.color_primario ? branch.color_primario : undefined),
                  boxShadow: selectedBranchId === branch.id ? `0 10px 25px -5px ${branch.color_primario || '#4f46e5'}40` : undefined
                }}
              >
                <div className="shrink-0 p-1 rounded-lg bg-white/20">
                  {branch.url_favicon ? (
                    <img src={branch.url_favicon} className="w-4 h-4 md:w-5 md:h-5 object-contain rounded-md" alt="" />
                  ) : (
                    <MapPin className="w-3 h-3 md:w-4 md:h-4" />
                  )}
                </div>
                {branch.nombre_sucursal.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <KpiCard 
            title="Ventas Totales" 
            value={`S/ ${totalSales.toLocaleString()}`} 
            icon={<DollarSign className="w-6 h-6" />}
            color="text-blue-500"
            isDarkMode={isDarkMode}
          />
          <KpiCard 
            title="Transacciones" 
            value={totalTrans.toLocaleString()} 
            icon={<Users className="w-6 h-6" />}
            color="text-emerald-500"
            isDarkMode={isDarkMode}
          />
          <KpiCard 
            title="Ticket Promedio" 
            value={`S/ ${avgTicket.toFixed(2)}`} 
            icon={<TrendingUp className="w-6 h-6" />}
            color="text-amber-500"
            isDarkMode={isDarkMode}
          />
          <KpiCard 
            title="Sucursales Activas" 
            value={branches.length.toString()} 
            icon={<Store className="w-6 h-6" />}
            color="text-purple-500"
            isDarkMode={isDarkMode}
          />
        </div>

        {/* CHARTS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* DAILY SALES - LINE CHART */}
          <div className={`p-6 rounded-3xl border ${cardClass}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" />
                Ventas Diarias por Sucursal
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={processedDiarias}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#ffffff10' : '#00000010'} vertical={false} />
                  <XAxis 
                    dataKey="fecha_dia" 
                    stroke={isDarkMode ? '#8b90a0' : '#6b7280'} 
                    fontSize={10}
                    tickFormatter={(val) => format(new Date(val), 'dd MMM', { locale: es })}
                  />
                  <YAxis stroke={isDarkMode ? '#8b90a0' : '#6b7280'} fontSize={10} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#1e2330' : '#ffffff', 
                      borderColor: isDarkMode ? '#ffffff10' : '#00000010',
                      borderRadius: '12px',
                      color: isDarkMode ? '#fff' : '#000'
                    }} 
                  />
                  <Legend />
                  {activeBranches.map((b, i) => (
                    <Line 
                      key={b.id}
                      type="monotone" 
                      dataKey={b.nombre_sucursal}
                      name={b.nombre_sucursal}
                      stroke={COLORS[branches.findIndex(branch => branch.id === b.id) % COLORS.length]} 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* WEEKLY SALES - BAR CHART */}
          <div className={`p-6 rounded-3xl border ${cardClass}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Ventas por Día de la Semana
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processedSemana}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#ffffff10' : '#00000010'} vertical={false} />
                  <XAxis 
                    dataKey="dia_semana" 
                    stroke={isDarkMode ? '#8b90a0' : '#6b7280'} 
                    fontSize={10}
                    tickFormatter={(val) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][val]}
                  />
                  <YAxis stroke={isDarkMode ? '#8b90a0' : '#6b7280'} fontSize={10} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#1e2330' : '#ffffff', 
                      borderColor: isDarkMode ? '#ffffff10' : '#00000010',
                      borderRadius: '12px'
                    }} 
                  />
                  <Legend />
                  {activeBranches.map((b, i) => (
                    <Bar 
                      key={b.id}
                      dataKey={b.nombre_sucursal}
                      name={b.nombre_sucursal}
                      fill={COLORS[branches.findIndex(branch => branch.id === b.id) % COLORS.length]} 
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PARTICIPATION - PIE CHART */}
          <div className={`p-6 rounded-3xl border ${cardClass}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                Participación en Ventas
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredData?.participacion || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="total"
                    nameKey="nombre_sucursal"
                  >
                    {(filteredData?.participacion || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[branches.findIndex(b => b.nombre_sucursal === entry.nombre_sucursal) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#1e2330' : '#ffffff', 
                      borderColor: isDarkMode ? '#ffffff10' : '#00000010',
                      borderRadius: '12px'
                    }} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SALES BY HOUR - AREA CHART */}
          <div className={`p-6 rounded-3xl border ${cardClass}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Ventas por Hora (Pico de Tráfico)
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={processedHora}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#ffffff10' : '#00000010'} vertical={false} />
                  <XAxis 
                    dataKey="hora" 
                    stroke={isDarkMode ? '#8b90a0' : '#6b7280'} 
                    fontSize={10}
                    tickFormatter={(val) => `${val}:00`}
                  />
                  <YAxis stroke={isDarkMode ? '#8b90a0' : '#6b7280'} fontSize={10} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDarkMode ? '#1e2330' : '#ffffff', 
                      borderColor: isDarkMode ? '#ffffff10' : '#00000010',
                      borderRadius: '12px'
                    }} 
                  />
                  <Legend />
                  {activeBranches.map((b, i) => (
                    <Area 
                      key={b.id}
                      type="monotone" 
                      dataKey={b.nombre_sucursal}
                      name={b.nombre_sucursal}
                      stroke={COLORS[branches.findIndex(branch => branch.id === b.id) % COLORS.length]} 
                      strokeWidth={2}
                      fill={COLORS[branches.findIndex(branch => branch.id === b.id) % COLORS.length]} 
                      fillOpacity={0.1}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* BRANCH TABLE */}
        <div className={`p-6 rounded-3xl border ${cardClass}`}>
          <h3 className="font-heading font-bold mb-6">Rendimiento por Sucursal</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`text-left border-b ${isDarkMode ? 'border-white/5' : 'border-gray-100'}`}>
                  <th className={`pb-4 font-medium ${textSecondary}`}>Sucursal</th>
                  <th className={`pb-4 font-medium ${textSecondary}`}>Ventas</th>
                  <th className={`pb-4 font-medium ${textSecondary}`}>Tickets</th>
                  <th className={`pb-4 font-medium ${textSecondary}`}>Ticket Prom.</th>
                  <th className={`pb-4 font-medium ${textSecondary}`}>Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(filteredData?.participacion || []).map((branch: any, i: number) => (
                  <tr key={i} className="group hover:bg-white/5 transition-colors">
                    <td className="py-4 font-medium">{branch.nombre_sucursal}</td>
                    <td className="py-4 font-bold text-accent">S/ {branch.total.toLocaleString()}</td>
                    <td className="py-4">{branch.transacciones}</td>
                    <td className="py-4">S/ {(branch.ticket_promedio || 0).toFixed(2)}</td>
                    <td className="py-4">
                      <button 
                        onClick={() => onSelectBranch(branches.find(b => b.nombre_sucursal === branch.nombre_sucursal))}
                        className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    ) : (
      <LogisticsManagement 
          isDarkMode={isDarkMode} 
          textSecondary={textSecondary} 
          cardClass={cardClass}
          branches={branches}
          holdingId={holdingInfo?.id}
          holdingInfo={holdingInfo}
          session={session}
        />
      )}
        </div>
      </main>
    </div>
  );
}

const PersistentLinks = ({ logisticsSubTab, selectedSourceBranch, selectedDriver, connections, driverRoutes, branches }: any) => {
  const [paths, setPaths] = useState<any[]>([]);

  useEffect(() => {
    const updatePaths = () => {
      const newPaths: any[] = [];
      
      if (logisticsSubTab === 'network' && selectedSourceBranch) {
        const fromEl = document.getElementById(`source-branch-${selectedSourceBranch.id}`);
        if (fromEl) {
          const fromRect = fromEl.getBoundingClientRect();
          const connectedDestIds = connections
            .filter((c: any) => c.sucursal_origen_id === selectedSourceBranch.id)
            .map((c: any) => c.sucursal_destino_id);

          connectedDestIds.forEach((destId: string) => {
            const toEl = document.getElementById(`network-dest-${destId}`);
            if (toEl) {
              const toRect = toEl.getBoundingClientRect();
              newPaths.push({ from: fromRect, to: toRect, id: `net-${selectedSourceBranch.id}-${destId}` });
            }
          });
        }
      } else if (logisticsSubTab === 'drivers' && selectedDriver) {
        const fromEl = document.getElementById(`driver-card-${selectedDriver.id}`);
        if (fromEl) {
          const fromRect = fromEl.getBoundingClientRect();
          const assignedBranchIds = driverRoutes.map((r: any) => r.sucursal_id);

          assignedBranchIds.forEach((branchId: string) => {
            const toEl = document.getElementById(`driver-dest-${branchId}`);
            if (toEl) {
              const toRect = toEl.getBoundingClientRect();
              newPaths.push({ from: fromRect, to: toRect, id: `dr-${selectedDriver.id}-${branchId}` });
            }
          });
        }
      }
      setPaths(newPaths);
    };

    const interval = setInterval(updatePaths, 100); // Poll for layout changes
    return () => clearInterval(interval);
  }, [logisticsSubTab, selectedSourceBranch, selectedDriver, connections, driverRoutes]);

  return (
    <div className="fixed inset-0 pointer-events-none z-[50]">
      <svg className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="persistentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4f8ef7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        {paths.map(p => {
          const isStacked = Math.abs(p.from.left - p.to.left) < 60;
          
          let startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y;

          if (isStacked) {
            // Stacked layout (Mobile)
            startX = p.from.left + p.from.width / 2;
            startY = p.from.top + p.from.height;
            endX = p.to.left + p.to.width / 2;
            endY = p.to.top;

            cp1x = startX;
            cp1y = startY + (endY - startY) * 0.5;
            cp2x = endX;
            cp2y = startY + (endY - startY) * 0.5;
          } else {
            // Horizontal layout (Desktop)
            startX = p.from.left + p.from.width;
            startY = p.from.top + p.from.height / 2;
            endX = p.to.left;
            endY = p.to.top + p.to.height / 2;

            cp1x = startX + (endX - startX) * 0.5;
            cp1y = startY;
            cp2x = startX + (endX - startX) * 0.5;
            cp2y = endY;
          }

          const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

          return (
            <path
              key={p.id}
              d={d}
              fill="none"
              stroke="url(#persistentGrad)"
              strokeWidth="3"
            />
          );
        })}
      </svg>
    </div>
  );
};

const LinkingAnimation = ({ from, to, onComplete }: { from: DOMRect, to: DOMRect, onComplete: () => void }) => {
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const endX = to.left + to.width / 2;
  const endY = to.top + to.height / 2;

  // Tree-like curvy bezier curve
  const cp1x = startX + (endX - startX) * 0.5;
  const cp1y = startY;
  const cp2x = startX + (endX - startX) * 0.5;
  const cp2y = endY;

  const path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

  return (
    <div className="fixed inset-0 pointer-events-none z-[1000]">
      <svg className="w-full h-full overflow-visible">
        <motion.path
          d={path}
          fill="none"
          stroke="url(#linkGrad)"
          strokeWidth="3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          onAnimationComplete={() => {
            setTimeout(onComplete, 400);
          }}
        />
        <defs>
          <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4f8ef7" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Moving cart icon along the path */}
      <motion.div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          offsetPath: `path('${path}')`,
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        initial={{ offsetDistance: "0%", opacity: 0, scale: 0.5 }}
        animate={{ 
          offsetDistance: "100%", 
          opacity: [0, 1, 1, 0],
          scale: [0.5, 1.2, 1.2, 0.5]
        }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="bg-accent text-white rounded-full shadow-lg z-[1001]"
      >
        <Truck size={16} />
      </motion.div>
    </div>
  );
};

function LogisticsManagement({ isDarkMode, textSecondary, cardClass, branches, holdingId, session, holdingInfo }: any) {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [driverRoutes, setDriverRoutes] = useState<any[]>([]);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: '', username: '', password: '' });
  
  const [logisticsSubTab, setLogisticsSubTab] = useState<'drivers' | 'network'>('drivers');
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedSourceBranch, setSelectedSourceBranch] = useState<any>(null);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const data = await dbGetLogisticsDrivers();
      setDrivers(data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const data = await dbGetSucursalConexiones(holdingId);
      setConnections(data || []);
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };

  useEffect(() => {
    fetchDrivers();
    fetchConnections();
  }, []);

  const fetchRoutes = async (driverId: string) => {
    try {
      const data = await dbGetDriverRoutes(driverId);
      setDriverRoutes(data || []);
    } catch (error) {
      console.error('Error fetching routes:', error);
    }
  };

  const handleSelectDriver = (driver: any) => {
    setSelectedDriver(driver);
    fetchRoutes(driver.id);
  };

  const toggleRoute = async (sucursalId: string, e: React.MouseEvent) => {
    if (!selectedDriver) return;
    const isAssigned = driverRoutes.some(r => r.sucursal_id === sucursalId);
    
    // Optimismo
    const oldRoutes = [...driverRoutes];
    if (isAssigned) {
      setDriverRoutes(prev => prev.filter(r => r.sucursal_id !== sucursalId));
    } else {
      setDriverRoutes(prev => [...prev, { sucursal_id: sucursalId, chofer_id: selectedDriver.id }]);
      
      // Animación
      const fromEl = document.getElementById(`driver-card-${selectedDriver.id}`);
      const toEl = e.currentTarget;
      if (fromEl && toEl) {
        setLinkAnim({
          from: fromEl.getBoundingClientRect(),
          to: toEl.getBoundingClientRect(),
          id: Date.now()
        });
      }
    }

    try {
      if (isAssigned) {
        await dbRemoveDriverRoute(selectedDriver.id, sucursalId);
      } else {
        await dbAssignDriverRoute(selectedDriver.id, sucursalId);
      }
      // Sincronizar por si acaso, pero ya es asíncrono e instantáneo para el usuario
      fetchRoutes(selectedDriver.id);
    } catch (error) {
      console.error('Error toggling driver route:', error);
      setDriverRoutes(oldRoutes); // Rollback
    }
  };

  const [linkAnim, setLinkAnim] = useState<{ from: DOMRect, to: DOMRect, id: number } | null>(null);
  const [needsRescale, setNeedsRescale] = useState(0);

  useEffect(() => {
    const handleResize = () => setNeedsRescale(prev => prev + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleAddDriver = async () => {
    if (!newDriver.name || !newDriver.username || !newDriver.password) return;
    try {
      await createInitialHoldingUser({
        name: newDriver.name,
        username: newDriver.username,
        password: newDriver.password,
        email: `${newDriver.username.toLowerCase()}@sislav.com`,
        empresaHoldingId: holdingId,
        role: UserRole.DELIVERY,
        holdingName: session.user.holding_name
      });
      setShowAddDriver(false);
      setNewDriver({ name: '', username: '', password: '' });
      fetchDrivers();
    } catch (error) {
      console.error('Error creating driver:', error);
      alert('Error al crear el chofer. Verifique que el usuario no exista.');
    }
  };

  const toggleConnection = async (destinoId: string, e: React.MouseEvent) => {
    if (!selectedSourceBranch) return;
    if (selectedSourceBranch.id === destinoId) return;

    const isConnected = connections.some(c => c.sucursal_origen_id === selectedSourceBranch.id && c.sucursal_destino_id === destinoId);
    
    // Optimismo
    const oldConnections = [...connections];
    if (isConnected) {
      setConnections(prev => prev.filter(c => !(c.sucursal_origen_id === selectedSourceBranch.id && c.sucursal_destino_id === destinoId)));
    } else {
      setConnections(prev => [...prev, { sucursal_origen_id: selectedSourceBranch.id, sucursal_destino_id: destinoId, empresa_holding_id: holdingId }]);
      
      // Animación
      const fromEl = document.getElementById(`source-branch-${selectedSourceBranch.id}`);
      const toEl = e.currentTarget;
      if (fromEl && toEl) {
        setLinkAnim({
          from: fromEl.getBoundingClientRect(),
          to: toEl.getBoundingClientRect(),
          id: Date.now()
        });
      }
    }
    
    try {
      if (isConnected) {
        await dbRemoveSucursalConexion(selectedSourceBranch.id, destinoId, holdingId);
      } else {
        await dbAddSucursalConexion(selectedSourceBranch.id, destinoId, holdingId);
      }
      fetchConnections();
    } catch (error) {
      console.error('Error toggling connection:', error);
      setConnections(oldConnections); // Rollback
    }
  };

  return (
    <div className="space-y-6 relative" id="logistics-container">
      {linkAnim && (
        <LinkingAnimation 
          key={linkAnim.id} 
          from={linkAnim.from} 
          to={linkAnim.to} 
          onComplete={() => setLinkAnim(null)} 
        />
      )}
      
      {/* Persistent Links Layer */}
      <PersistentLinks 
        key={`persistent-${needsRescale}`}
        logisticsSubTab={logisticsSubTab}
        selectedSourceBranch={selectedSourceBranch}
        selectedDriver={selectedDriver}
        connections={connections}
        driverRoutes={driverRoutes}
        branches={branches}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-heading font-bold">Gestión de Logística Hub</h2>
          <p className={`text-xs md:text-sm ${textSecondary}`}>Administra tus choferes, rutas y la red de conexiones entre sucursales</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setLogisticsSubTab('drivers')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${logisticsSubTab === 'drivers' ? 'bg-accent text-white shadow-lg shadow-accent/20' : isDarkMode ? 'bg-white/5 text-text2' : 'bg-gray-100 text-gray-600'}`}
          >
            Choferes
          </button>
          <button 
            onClick={() => setLogisticsSubTab('network')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${logisticsSubTab === 'network' ? 'bg-accent text-white shadow-lg shadow-accent/20' : isDarkMode ? 'bg-white/5 text-text2' : 'bg-gray-100 text-gray-600'}`}
          >
            Red Logística
          </button>
        </div>
      </div>

      {logisticsSubTab === 'drivers' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* DRIVER LIST */}
            <div className={`lg:col-span-1 p-6 rounded-3xl border ${cardClass} flex flex-col`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent" />
                  Choferes
                </h3>
                <button 
                  onClick={() => setShowAddDriver(true)}
                  className="p-2 bg-accent/10 text-accent rounded-lg hover:bg-accent hover:text-white transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto mb-6">
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
                ) : (
                  <div className="space-y-3">
                    {drivers.length === 0 ? (
                      <p className={`text-center py-8 text-sm ${textSecondary}`}>No hay choferes registrados</p>
                    ) : (
                      drivers.map(driver => (
                        <button
                          key={driver.id}
                          id={`driver-card-${driver.id}`}
                          onClick={() => handleSelectDriver(driver)}
                          className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between group ${
                            selectedDriver?.id === driver.id 
                              ? 'bg-accent/10 border-accent' 
                              : isDarkMode ? 'bg-bg border-white/5 hover:border-white/20' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                              selectedDriver?.id === driver.id ? 'bg-accent text-white' : 'bg-bg2 text-text2'
                            }`}>
                              {driver.nombre_completo.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{driver.nombre_completo}</p>
                              <p className={`text-xs ${textSecondary}`}>@{driver.username}</p>
                            </div>
                          </div>
                          <ChevronRight className={`w-4 h-4 transition-transform ${selectedDriver?.id === driver.id ? 'translate-x-1 text-accent' : 'text-text2'}`} />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* ACCESO PARA CHOFERES */}
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-blue-50 border-blue-100'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white">
                    <Truck className="w-4 h-4" />
                  </div>
                  <p className="font-bold text-xs">Acceso para Choferes</p>
                </div>
                <p className={`text-[10px] mb-3 leading-relaxed ${textSecondary}`}>
                  Copia este link y envíalo a tus choferes para que puedan ingresar a su panel PWA.
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={`${window.location.origin}/?mode=logistics${holdingInfo?.id ? `&h=${holdingInfo.id}` : ''}`}
                    className={`flex-1 px-3 py-2 rounded-lg text-[10px] border ${isDarkMode ? 'bg-bg border-white/10 text-text2' : 'bg-white border-gray-200 text-gray-600'}`}
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/?mode=logistics${holdingInfo?.id ? `&h=${holdingInfo.id}` : ''}`);
                      alert('Link copiado al portapapeles');
                    }}
                    className="p-2 bg-accent text-white rounded-lg hover:scale-105 transition-all"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          {/* ROUTES MANAGEMENT */}
          <div className={`lg:col-span-2 p-6 rounded-3xl border ${cardClass}`}>
            {!selectedDriver ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                  <MapPin className="w-8 h-8 text-accent" />
                </div>
                <h4 className="font-bold text-lg mb-2">Selecciona un Chofer</h4>
                <p className={`max-w-xs text-sm ${textSecondary}`}>Elige un chofer de la lista para gestionar sus rutas y sucursales asignadas.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-white font-bold text-xl">
                      {selectedDriver.nombre_completo.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{selectedDriver.nombre_completo}</h4>
                      <p className={`text-sm ${textSecondary}`}>Configuración de Rutas de Recojo</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Activo
                  </div>
                </div>

                <div>
                  <h5 className="font-bold text-sm mb-4 flex items-center gap-2">
                    <Store className="w-4 h-4 text-accent" />
                    Sucursales Asignadas
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {branches.map((branch: any) => {
                      const isAssigned = driverRoutes.some(r => r.sucursal_id === branch.id);
                      return (
                        <button
                          key={branch.id}
                          id={`driver-dest-${branch.id}`}
                          onClick={(e) => toggleRoute(branch.id, e)}
                          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
                            isAssigned 
                              ? 'bg-accent/5 border-accent/30' 
                              : isDarkMode ? 'bg-bg border-white/5 hover:bg-white/5' : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden ${isAssigned ? 'bg-accent text-white' : 'bg-bg2 text-text2'}`}>
                              {branch.url_favicon ? (
                                <img src={branch.url_favicon} className="w-full h-full object-contain" alt="" />
                              ) : (
                                <Store className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{branch.nombre_sucursal}</p>
                              <p className={`text-xs ${textSecondary}`}>{branch.direccion || 'Sin dirección'}</p>
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                            isAssigned ? 'bg-accent border-accent text-white' : 'border-white/10'
                          }`}>
                            {isAssigned && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-3`}>
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    <strong>Nota de Seguridad:</strong> El chofer solo podrá ver y gestionar guías de remisión de las sucursales que tenga asignadas en esta lista. Los cambios se aplican en tiempo real.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SOURCE BRANCH LIST */}
          <div className={`lg:col-span-1 p-6 rounded-3xl border ${cardClass}`}>
            <h3 className="font-heading font-bold mb-6 flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-accent" />
              Sucursal de Origen
            </h3>
            <div className="space-y-3">
              {branches.map((branch: any) => (
                <button
                  key={branch.id}
                  id={`source-branch-${branch.id}`}
                  onClick={() => setSelectedSourceBranch(branch)}
                  className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between group ${
                    selectedSourceBranch?.id === branch.id 
                      ? 'bg-accent/10 border-accent' 
                      : isDarkMode ? 'bg-bg border-white/5 hover:border-white/20' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold overflow-hidden ${
                      selectedSourceBranch?.id === branch.id ? 'bg-accent text-white' : 'bg-bg2 text-text2'
                    }`}>
                      {branch.url_favicon ? (
                        <img src={branch.url_favicon} className="w-full h-full object-contain" alt="" />
                      ) : (
                        <Store size={20} />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{branch.nombre_sucursal}</p>
                      <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase tracking-widest">
                        {branch.tipo_sucursal}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${selectedSourceBranch?.id === branch.id ? 'translate-x-1 text-accent' : 'text-text2'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* DESTINATION CONNECTIONS */}
          <div className={`lg:col-span-2 p-6 rounded-3xl border ${cardClass}`}>
            {!selectedSourceBranch ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                  <RefreshCw className="w-8 h-8 text-accent" />
                </div>
                <h4 className="font-bold text-lg mb-2">Configura la Red Logística</h4>
                <p className={`max-w-xs text-sm ${textSecondary}`}>Selecciona una sucursal de origen para definir a qué otras sucursales puede enviar prendas.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-white">
                      <ArrowUpRight size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">Origen: {selectedSourceBranch.nombre_sucursal}</h4>
                      <p className={`text-sm ${textSecondary}`}>Define los destinos permitidos para esta sucursal</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-bold text-sm mb-4 flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4 text-accent" />
                    Destinos Permitidos
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {branches.filter((b: any) => b.id !== selectedSourceBranch.id).map((branch: any) => {
                      const isConnected = connections.some(c => c.sucursal_origen_id === selectedSourceBranch.id && c.sucursal_destino_id === branch.id);
                      return (
                        <button
                          key={branch.id}
                          id={`network-dest-${branch.id}`}
                          onClick={(e) => toggleConnection(branch.id, e)}
                          className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
                            isConnected 
                              ? 'bg-emerald-500/5 border-emerald-500/30' 
                              : isDarkMode ? 'bg-bg border-white/5 hover:bg-white/5' : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden ${isConnected ? 'bg-emerald-500 text-white' : 'bg-bg2 text-text2'}`}>
                              {branch.url_favicon ? (
                                <img src={branch.url_favicon} className="w-full h-full object-contain" alt="" />
                              ) : (
                                <Store className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{branch.nombre_sucursal}</p>
                              <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase tracking-widest">
                                {branch.tipo_sucursal}
                              </span>
                            </div>
                          </div>
                          <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                            isConnected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/10'
                          }`}>
                            {isConnected && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex gap-3`}>
                  <Truck className="w-5 h-5 text-blue-500 shrink-0" />
                  <p className="text-xs text-blue-200/80 leading-relaxed">
                    <strong>Configuración de Red:</strong> Aquí defines el flujo de trabajo. Por ejemplo, vincula tus <strong>Centros de Acopio</strong> con la <strong>Planta de Lavado</strong> para permitir el envío de prendas.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD DRIVER MODAL */}
      <AnimatePresence>
        {showAddDriver && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddDriver(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className={`relative w-full max-w-md p-8 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-surface border-white/10' : 'bg-white border-gray-200'}`}
            >
              <h3 className="text-2xl font-heading font-bold mb-6">Nuevo Chofer de Logística</h3>
              <div className="space-y-4">
                <div>
                  <label className={`block text-xs font-bold uppercase mb-2 ${textSecondary}`}>Nombre Completo</label>
                  <input 
                    type="text" 
                    value={newDriver.name}
                    onChange={e => setNewDriver({...newDriver, name: e.target.value})}
                    className={`w-full px-4 py-3 rounded-xl border ${isDarkMode ? 'bg-bg border-white/10 text-white' : 'bg-gray-50 border-gray-200'}`}
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
                <div>
                  <label className={`block text-xs font-bold uppercase mb-2 ${textSecondary}`}>Usuario (Login)</label>
                  <input 
                    type="text" 
                    value={newDriver.username}
                    onChange={e => setNewDriver({...newDriver, username: e.target.value})}
                    className={`w-full px-4 py-3 rounded-xl border ${isDarkMode ? 'bg-bg border-white/10 text-white' : 'bg-gray-50 border-gray-200'}`}
                    placeholder="ej: juan_delivery"
                  />
                </div>
                <div>
                  <label className={`block text-xs font-bold uppercase mb-2 ${textSecondary}`}>PIN / Contraseña</label>
                  <input 
                    type="password" 
                    value={newDriver.password}
                    onChange={e => setNewDriver({...newDriver, password: e.target.value})}
                    className={`w-full px-4 py-3 rounded-xl border ${isDarkMode ? 'bg-bg border-white/10 text-white' : 'bg-gray-50 border-gray-200'}`}
                    placeholder="••••••"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setShowAddDriver(false)}
                    className={`flex-1 py-3 rounded-xl font-bold ${isDarkMode ? 'bg-white/5 text-text2 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleAddDriver}
                    className="flex-1 py-3 bg-accent text-white rounded-xl font-bold shadow-lg shadow-accent/20 hover:scale-105 transition-all"
                  >
                    Crear Chofer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KpiCard({ title, value, icon, color, isDarkMode }: any) {
  return (
    <div className={`p-4 md:p-6 rounded-3xl border ${isDarkMode ? 'bg-surface border-white/5' : 'bg-white border-gray-200 shadow-sm'}`}>
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className={`p-2 md:p-3 rounded-2xl bg-opacity-10 ${color.replace('text-', 'bg-')}`}>
          <div className={color}>{React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 md:w-6 md:h-6" })}</div>
        </div>
        <div className="flex items-center gap-1 text-[10px] md:text-xs text-emerald-500 font-bold">
          <ArrowUpRight className="w-3 h-3" />
          +12%
        </div>
      </div>
      <p className={`text-[10px] md:text-sm font-medium mb-0.5 md:mb-1 ${isDarkMode ? 'text-text2' : 'text-gray-500'}`}>{title}</p>
      <h4 className="text-lg md:text-2xl font-heading font-bold">{value}</h4>
    </div>
  );
}

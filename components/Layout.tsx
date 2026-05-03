import { 
  LayoutDashboard, ShoppingCart, FileText, Package, Users, Settings, 
  Store, TestTube2, LogOut, Menu, Bell, User, CheckCircle2, ClipboardList, 
  PackageOpen, ShoppingBasket, BadgeDollarSign, CreditCard, Truck, Boxes,
  Headset, Waves, WashingMachine, Shield, Layers, Ticket, Calculator,
  Megaphone, MessageSquareText, HelpCircle, Cake, MessageCircle, WifiOff, Loader2,
  Terminal, Code2, Star, Sparkles, X, Check, Calendar, Search, Sun, Moon, Wifi, ShieldAlert,
  Smartphone, FileBarChart, ArrowRight, Phone, Beaker, ShieldCheck, RotateCw, PencilLine, TrendingUp
} from 'lucide-react';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Company, Client, GlobalHelpVideo, PickupRequest, GlobalModuleConfig, Invoice, AuthSession, UserRole } from '../types';
import CalculatorModal from './CalculatorModal';
import HelpModal from './HelpModal';
import BirthdayModal from './BirthdayModal';
import StoreModal from './StoreModal';
import { EvolutionService } from '../services/evolutionService';
import { dbGetPickupRequests, dbMarkPickupAsRead, dbGetInvoices, dbMarkDeliveryAsSeen, dbGetBirthdaysToday, dbGetGuiasRemision } from '../services/dbService';

import { APP_VERSION } from './VersionGuard';

interface LayoutProps {
  currentView: string;
  setView: (view: any) => void;
  company: Company;
  children: React.ReactNode;
  onLogout?: () => void;
  onRefresh?: () => void;
  onBackToMaster?: () => void;
  onBackToOwner?: () => void;
  clients?: Client[];
  helpVideos?: GlobalHelpVideo[];
  isOwner?: boolean;
  isSaaSMaster?: boolean;
  globalModules?: Record<string, GlobalModuleConfig>;
  sucursalModules?: Record<string, any>;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
  currentUser?: AuthSession['user'];
}

interface SidebarItemProps {
  id: string;
  icon: any;
  label: string;
  currentView: string;
  sidebarSearch: string;
  setView: (view: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isDarkMode: boolean;
  primaryColor: string;
  badge?: string;
  isVisible?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ 
  id, icon: Icon, label, currentView, sidebarSearch, setView, isSidebarOpen, setIsSidebarOpen, isDarkMode, primaryColor, badge, isVisible = true
}) => {
  if (!isVisible) return null;
  const isActive = currentView === id;
  if (sidebarSearch && !label.toLowerCase().includes(sidebarSearch.toLowerCase())) return null;
  return (
    <button
      type="button"
      onClick={() => { setView(id); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all rounded-lg mb-0.5 group relative ${isActive ? 'text-white shadow-lg' : isDarkMode ? 'text-text2 hover:text-text hover:bg-bg3' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
      style={{ backgroundColor: isActive ? 'var(--brand-primary)' : 'transparent' }}
    >
      <Icon size={16} className={`min-w-[16px] transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-text3'}`} />
      {isSidebarOpen && <span className="whitespace-nowrap overflow-hidden">{label}</span>}
      {isSidebarOpen && badge && (<span className={`ml-auto px-2 py-0.5 rounded text-[9px] font-black ${badge === 'NUEVO' ? 'text-slate-900' : 'text-white'} uppercase tracking-tighter ${badge === 'NUEVO' ? 'neon-badge bg-transparent border-brand-primary' : 'animate-blink-badge bg-accent'}`}>{badge}</span>)}
      {!isSidebarOpen && (<div className="absolute left-full ml-4 px-2 py-1 bg-surface text-text text-[9px] font-bold rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl uppercase tracking-widest border border-border">{label} {badge ? `(${badge})` : ''}</div>)}
    </button>
  );
};

const NavSection: React.FC<{ label: string; isSidebarOpen: boolean }> = ({ label, isSidebarOpen }) => {
    if (!isSidebarOpen) return <div className="h-px bg-border my-3 mx-2"></div>;
    return <p className="px-3 text-[10px] font-bold text-text3 uppercase tracking-widest mt-4 mb-1.5">{label}</p>;
};

const Layout: React.FC<LayoutProps> = ({ 
  currentView, setView, company, children, onLogout, onRefresh, onBackToMaster, onBackToOwner, 
  clients = [], helpVideos = [], isOwner = false, isSaaSMaster = false, 
  globalModules = {}, sucursalModules = {},
  isDarkMode: propIsDarkMode, toggleTheme: propToggleTheme,
  currentUser
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [internalIsDarkMode, setInternalIsDarkMode] = useState(() => localStorage.getItem('sislav_theme') === 'dark');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [waStatus, setWaStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [pendingAutoRequests, setPendingAutoRequests] = useState<PickupRequest[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<Invoice[]>([]);
  const [showAutoNotifications, setShowAutoNotifications] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState<string | null>(null);

  const { data: birthdayClientsData = [] } = useQuery({
      queryKey: ['birthdayClients', company?.id],
      queryFn: () => dbGetBirthdaysToday(company?.id),
      enabled: !!company?.id,
      refetchInterval: 300000, 
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const userRole = localStorage.getItem('sislav_current_user_role') || UserRole.CAJERO;

  const isDarkMode = propIsDarkMode !== undefined ? propIsDarkMode : internalIsDarkMode;
  const toggleTheme = propToggleTheme || (() => {
    const nextMode = !internalIsDarkMode;
    setInternalIsDarkMode(nextMode);
    localStorage.setItem('sislav_theme', nextMode ? 'dark' : 'light');
  });

  const getModuleConfig = (permId: string) => {
      // 0. EXCLUSIVIDAD: Config Developer solo es para SAAS_MASTER
      if (permId === 'DEV_CONFIG' && !isSaaSMaster) return { isVisible: false, isNew: false };

      // 1. Verificar si el módulo está activo globalmente (SaaS Master Control Global)
      const globalCfg = globalModules[permId];
      if (globalCfg && globalCfg.isActive === false) return { isVisible: false, isNew: false };

      // 1.1 Verificar si el rol actual está permitido globalmente para este módulo
      if (!isSaaSMaster && globalCfg?.allowedRoles && Array.isArray(globalCfg.allowedRoles)) {
          const currentRole = currentUser?.role;
          if (currentRole && !globalCfg.allowedRoles.includes(currentRole as UserRole)) {
              return { isVisible: false, isNew: false };
          }
      }

      // 2. Verificar si el módulo está activo para esta sucursal específica
      const branchCfg = sucursalModules[permId];
      // Soporte para legacy (boolean) y nuevo formato (objeto)
      const isSucursalActive = typeof branchCfg === 'object' ? branchCfg.isActive : branchCfg;
      
      // REGLA ABSOLUTA: Si el SaaS Master desactivó el switch para esta sucursal, NADIE lo ve en la sucursal
      if (isSucursalActive === false) return { isVisible: false, isNew: false };

      // 3. Si es SaaS Master, tiene acceso total a todo lo que no esté desactivado globalmente o por sede
      // Preferir el badge "NUEVO" de la sucursal si existe, sino el global
      const isNew = typeof branchCfg === 'object' ? (branchCfg.isNew ?? !!globalCfg?.isNew) : !!globalCfg?.isNew;
      if (isSaaSMaster) return { isVisible: true, isNew };

      // 4. Verificar permisos específicos del usuario (Matriz de Permisos)
      if (!isSaaSMaster && !isOwner && currentUser?.permissions) {
          if (currentUser.permissions[permId] === false) {
              return { isVisible: false, isNew: false };
          }
          
          // Por petición del usuario: Todos los usuarios deben poder acceder a los módulos de su empresa/sucursal
          // Relaxing restricted roles for common modules
          const restrictedRoles = [UserRole.CAJERO, UserRole.OPERARIO, UserRole.DELIVERY, UserRole.CONTABILIDAD];
          if (restrictedRoles.includes(currentUser.role as UserRole) && currentUser.permissions[permId] !== true) {
              // Módulos que siempre deben ser visibles si están activos en la sucursal por petición del usuario
              const alwaysAllowed = [
                  'view:dashboard', 'view:pos', 'view:promotions', 'view:inventory', 
                  'view:orders', 'view:clients', 'view:expenses', 'view:supplies', 
                  'view:categories', 'view:agenda'
              ];
              if (!alwaysAllowed.includes(permId)) {
                  return { isVisible: false, isNew: false };
              }
          }
      }

      // 5. Lógica por Defecto por Categoría
      const basicModules = ['view:dashboard', 'view:pos', 'view:orders', 'view:inventory', 'view:clients', 'view:expenses', 'view:reports', 'view:settings', 'view:product_counting', 'view:modificaciones'];
      
      // Si es un módulo básico, es visible a menos que se apague explícitamente (manejado arriba en el paso 2)
      if (basicModules.includes(permId)) {
          return { isVisible: true, isNew };
      }

      // Para módulos premium/extra, solo son visibles si están activos en sucursalModules
      // Si no hay configuración específica (objeto vacío), los mostramos por defecto para evitar confusión inicial
      if (Object.keys(sucursalModules).length === 0) {
          return { isVisible: true, isNew };
      }
      return { isVisible: !!isSucursalActive, isNew };
  };

  useEffect(() => {
    const checkWa = async () => {
      // FIX: Corrected property names to match Company interface
      const instance = company?.whatsapp_instance;
      const token = company?.whatsapp_token;
      const name = company?.whatsapp_instance_name;

      if (!instance || !token || !name) { 
        setWaStatus('disconnected'); 
        return; 
      }
      
      try {
        const service = new EvolutionService({ 
            baseUrl: instance, 
            apiKey: token, 
            instanceName: name 
        });
        const isOk = await service.checkInstance();
        setWaStatus(isOk ? 'connected' : 'disconnected');
      } catch (e) { setWaStatus('disconnected'); }
    };
    checkWa();
    const interval = setInterval(checkWa, 30000); 
    return () => clearInterval(interval);
    // FIX: Corrected dependency property name
  }, [company?.whatsapp_instance]);

  const monitorRequests = async () => {
      const reqs = await dbGetPickupRequests();
      const seenPickups = JSON.parse(localStorage.getItem('sislav_seen_pickups') || '[]');
      const unreadPickups = reqs.filter(r => !r.isReadByAdmin && !seenPickups.includes(r.id));
      setPendingAutoRequests(unreadPickups);

      const { invoices: invs } = await dbGetInvoices();
      const seenDeliveries = JSON.parse(localStorage.getItem('sislav_seen_deliveries') || '[]');
      
      const unreadDeliveries = invs.filter(inv => 
        (inv.orderStatus === 'EN_RUTA' || inv.orderStatus === 'LISTO') && 
        !inv.vistoDelivery && 
        inv.origin !== 'TIENDA' && 
        !seenDeliveries.includes(inv.id)
      );
      setPendingDeliveries(unreadDeliveries);

      // Monitor Guías from Logistics Hub assigned to this driver
      let unreadGuias: any[] = [];
      if (currentUser?.id && currentUser.role === UserRole.DELIVERY) {
          try {
              const guias = await dbGetGuiasRemision({ 
                  chofer_id: currentUser.id,
                  estado: 'EN_TRANSITO'
              });
              unreadGuias = guias.filter(g => !seenDeliveries.includes(g.id));
          } catch (e) {
              console.error("Error monitoring guias for sound:", e);
          }
      }
      
      const isDeliveryUser = currentUser?.role === UserRole.DELIVERY;
      const shouldPlaySound = unreadPickups.length > 0 || (unreadDeliveries.length > 0 && isDeliveryUser) || unreadGuias.length > 0;
      
      if (shouldPlaySound) playNotificationSound();
      else stopNotificationSound();
  };

  useEffect(() => {
      monitorRequests();
      const interval = setInterval(monitorRequests, 15000); 
      return () => clearInterval(interval);
  }, []);

  const playNotificationSound = () => {
    if (!audioRef.current) {
        audioRef.current = new Audio('https://yvgshdypqanlcgxdyvls.supabase.co/storage/v1/object/public/laundry-assets/burbujas.mp3');
        audioRef.current.loop = true;
    }
    audioRef.current.play().catch(e => console.warn("Audio play blocked:", e));
  };

  const stopNotificationSound = () => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
  };

  const handleMarkPickupRead = async (id: string) => {
    setIsMarkingRead(id);
    try {
        await dbMarkPickupAsRead(id);
        const seen = JSON.parse(localStorage.getItem('sislav_seen_pickups') || '[]');
        if (!seen.includes(id)) { seen.push(id); localStorage.setItem('sislav_seen_pickups', JSON.stringify(seen)); }
        setPendingAutoRequests(prev => prev.filter(r => r.id !== id));
    } catch (e) { console.error(e); } finally { setIsMarkingRead(null); }
  };

  const handleMarkDeliveryRead = async (id: string) => {
    setIsMarkingRead(id);
    try {
        await dbMarkDeliveryAsSeen(id);
        const seen = JSON.parse(localStorage.getItem('sislav_seen_deliveries') || '[]');
        if (!seen.includes(id)) { seen.push(id); localStorage.setItem('sislav_seen_deliveries', JSON.stringify(seen)); }
        setPendingDeliveries(prev => prev.filter(d => d.id !== id));
    } catch (e) { console.error(e); } finally { setIsMarkingRead(null); }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingRead('all');
    try {
        const seenPickups = JSON.parse(localStorage.getItem('sislav_seen_pickups') || '[]');
        for (const req of pendingAutoRequests) {
            await dbMarkPickupAsRead(req.id);
            if (!seenPickups.includes(req.id)) seenPickups.push(req.id);
        }
        localStorage.setItem('sislav_seen_pickups', JSON.stringify(seenPickups));

        const seenDeliveries = JSON.parse(localStorage.getItem('sislav_seen_deliveries') || '[]');
        for (const d of pendingDeliveries) {
            await dbMarkDeliveryAsSeen(d.id);
            if(!seenDeliveries.includes(d.id)) seenDeliveries.push(d.id);
        }
        localStorage.setItem('sislav_seen_deliveries', JSON.stringify(seenDeliveries));

        setPendingAutoRequests([]);
        setPendingDeliveries([]);
        stopNotificationSound();
        setShowAutoNotifications(false);
    } catch (e) { console.error(e); } finally { setIsMarkingRead(null); }
  };

  const birthdayStats = useMemo(() => {
      if (!clients || !clients.length) return { today: 0, tomorrow: 0 };
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(now.getDate() + 1);
      const todayM = now.getMonth() + 1;
      const todayD = now.getDate();
      const tomorrowM = tomorrow.getMonth() + 1;
      const tomorrowD = tomorrow.getDate();

      const isBirthday = (bday: string, m: number, d: number) => {
          const mStr = String(m).padStart(2, '0');
          const dStr = String(d).padStart(2, '0');
          const clean = bday.replace(/\//g, '-');
          return clean.includes(`${mStr}-${dStr}`) || clean.includes(`${dStr}-${mStr}`);
      };

      return { 
          today: birthdayClientsData.filter(c => c.birthday && isBirthday(c.birthday, todayM, todayD)).length, 
          tomorrow: birthdayClientsData.filter(c => c.birthday && isBirthday(c.birthday, tomorrowM, tomorrowD)).length 
      };
  }, [birthdayClientsData]);

  const totalNotifications = pendingAutoRequests.length + pendingDeliveries.length;
  const primaryColorFromDoc = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim() || '#0054A6';

  return (
    <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-bg text-text' : 'bg-gray-50 text-gray-800'}`}>
      <style>{`@keyframes blink-badge { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.95); } } .animate-blink-badge { animation: blink-badge 1s infinite; }`}</style>
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 transition-all duration-500 ease-in-out flex flex-col md:relative border-r ${isDarkMode ? 'bg-bg2 border-border shadow-2xl' : 'bg-white border-slate-100 shadow-xl'} ${isSidebarOpen ? 'w-[220px] translate-x-0' : 'w-24 -translate-x-full md:w-20 md:translate-x-0'}`}>
        <div className="flex items-center gap-3 h-[56px] px-4 shrink-0 border-b border-border">
          {company?.logoUrl ? (<div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-white rounded-lg p-1.5 shadow-sm overflow-hidden"><img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" /></div>) : (<div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: 'var(--brand-primary)' }}><Store size={22} /></div>)}
          {isSidebarOpen && (
            <div className="overflow-hidden">
                <h1 className="text-sm font-display font-bold leading-none truncate uppercase tracking-tight" style={{ color: isDarkMode ? '#fff' : '#0f172a' }}>
                    {company?.razonSocial || 'SISLAV'}
                </h1>
            </div>
          )}
        </div>

        <div className="p-3 space-y-4 flex-1 overflow-y-auto no-scrollbar">
          {isSaaSMaster && onBackToMaster && (
              <button 
                  onClick={onBackToMaster}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all group shrink-0 ${isDarkMode ? 'bg-accent-glow text-accent border border-accent/20' : 'bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm'}`}
              >
                  <div className={`p-1.5 rounded-md text-white shadow-lg ${isSidebarOpen ? '' : 'mx-auto'}`} style={{ backgroundColor: 'var(--brand-primary)' }}>
                      <ShieldCheck size={16} />
                  </div>
                  {isSidebarOpen && (
                      <div className="flex flex-col items-start min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-widest leading-none mb-0.5">Sesión Master</span>
                          <span className="text-[7px] font-bold uppercase truncate opacity-70">VOLVER AL PANEL</span>
                      </div>
                  )}
              </button>
          )}

          {isOwner && onBackToOwner && (
              <button 
                  onClick={onBackToOwner}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all group shrink-0 ${isDarkMode ? 'bg-accent-glow text-accent border border-accent/20' : 'bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm'}`}
              >
                  <div className={`p-1.5 rounded-md text-white shadow-lg ${isSidebarOpen ? '' : 'mx-auto'}`} style={{ backgroundColor: 'var(--brand-primary)' }}>
                      <ArrowRight className="rotate-180" size={16} />
                  </div>
                  {isSidebarOpen && (
                      <div className="flex flex-col items-start min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-widest leading-none mb-0.5">Panel Owner</span>
                          <span className="text-[7px] font-bold uppercase truncate opacity-70">SALIR DE SUCURSAL</span>
                      </div>
                  )}
              </button>
          )}

          <div className="relative">
              {isSidebarOpen ? (
                  <><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" size={14} /><input type="text" value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-4 py-2 rounded-lg text-[11px] font-bold outline-none border border-border bg-bg3 focus:bg-surface transition-all text-text" /></>
              ) : (
                  <div className="flex justify-center"><button onClick={() => setIsSidebarOpen(true)} className={`p-2 rounded-lg border ${isDarkMode ? 'bg-bg3 border-border text-text3' : 'bg-slate-50 border-slate-100 text-slate-400'}`}><Search size={16} /></button></div>
              )}
          </div>
          
          <nav className="space-y-0.5">
            <NavSection label="Principal" isSidebarOpen={isSidebarOpen} />
            <SidebarItem id="view:dashboard" icon={LayoutDashboard} label="Dashboard" isVisible={getModuleConfig('view:dashboard').isVisible} badge={getModuleConfig('view:dashboard').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:agenda" icon={Calendar} label="Mi Tarea del Día" isVisible={getModuleConfig('view:agenda').isVisible} badge={getModuleConfig('view:agenda').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:pos" icon={ShoppingCart} label="Nueva Venta" isVisible={getModuleConfig('view:pos').isVisible} badge={getModuleConfig('view:pos').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:orders" icon={ClipboardList} label="Mis Órdenes" isVisible={getModuleConfig('view:orders').isVisible} badge={getModuleConfig('view:orders').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:operations" icon={Waves} label="Operación Lavado" isVisible={getModuleConfig('view:operations').isVisible} badge={getModuleConfig('view:operations').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:cash_closing" icon={Calculator} label="Cierre de Caja" isVisible={getModuleConfig('view:cash_closing').isVisible} badge={getModuleConfig('view:cash_closing').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:history" icon={FileText} label="Documentos Elec." isVisible={getModuleConfig('view:history').isVisible} badge={getModuleConfig('view:history').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:yape" icon={Smartphone} label="Mis Yapes" isVisible={getModuleConfig('view:yape').isVisible} badge={getModuleConfig('view:yape').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:my_reports" icon={TrendingUp} label="Mis Reportes" isVisible={getModuleConfig('view:my_reports').isVisible} badge={getModuleConfig('view:my_reports').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />

            <NavSection label="Gestión" isSidebarOpen={isSidebarOpen} />
            <SidebarItem id="view:inventory" icon={ShoppingBasket} label="Servicios" isVisible={getModuleConfig('view:inventory').isVisible} badge={getModuleConfig('view:inventory').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:clients" icon={Users} label="Clientes" isVisible={getModuleConfig('view:clients').isVisible} badge={getModuleConfig('view:clients').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:employees" icon={User} label="Empleados" isVisible={getModuleConfig('view:employees').isVisible} badge={getModuleConfig('view:employees').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:expenses" icon={BadgeDollarSign} label="Egresos" isVisible={getModuleConfig('view:expenses').isVisible} badge={getModuleConfig('view:expenses').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />

            <NavSection label="Logística" isSidebarOpen={isSidebarOpen} />
            <SidebarItem id="view:machines" icon={WashingMachine} label="Máquinas" isVisible={getModuleConfig('view:machines').isVisible} badge={getModuleConfig('view:machines').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:logistics_hub" icon={Truck} label="Logística Hub" isVisible={getModuleConfig('view:logistics_hub').isVisible} badge={getModuleConfig('view:logistics_hub').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:callcenter" icon={Headset} label="Call Center" isVisible={getModuleConfig('view:callcenter').isVisible} badge={getModuleConfig('view:callcenter').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:delivery" icon={Truck} label="Delivery" isVisible={getModuleConfig('view:delivery').isVisible} badge={getModuleConfig('view:delivery').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:supplies" icon={Beaker} label="Insumos" isVisible={getModuleConfig('view:supplies').isVisible} badge={getModuleConfig('view:supplies').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:purchases" icon={ShoppingCart} label="Compras" isVisible={getModuleConfig('view:purchases').isVisible} badge={getModuleConfig('view:purchases').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:package_inventory" icon={PackageOpen} label="Inv. Paquetes" isVisible={getModuleConfig('view:package_inventory').isVisible} badge={getModuleConfig('view:package_inventory').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:product_counting" icon={Boxes} label="Conteo Inventario" isVisible={getModuleConfig('view:product_counting').isVisible} badge={getModuleConfig('view:product_counting').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />

            <NavSection label="Marketing" isSidebarOpen={isSidebarOpen} />
            <SidebarItem id="view:loyalty" icon={Ticket} label="Fidelización" isVisible={getModuleConfig('view:loyalty').isVisible} badge={getModuleConfig('view:loyalty').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:bonus_points" icon={Star} label="Puntos Bonus" isVisible={getModuleConfig('view:bonus_points').isVisible} badge={getModuleConfig('view:bonus_points').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:promotions" icon={Sparkles} label="Promociones" isVisible={getModuleConfig('view:promotions').isVisible} badge={getModuleConfig('view:promotions').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:wa_campaign" icon={Megaphone} label="Campaña WA" isVisible={getModuleConfig('view:wa_campaign').isVisible} badge={getModuleConfig('view:wa_campaign').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />

            <NavSection label="Administración" isSidebarOpen={isSidebarOpen} />
            <SidebarItem id="view:modificaciones" icon={PencilLine} label="Modificar" isVisible={getModuleConfig('view:modificaciones').isVisible} badge={getModuleConfig('view:modificaciones').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:categories" icon={Layers} label="Categorías" isVisible={getModuleConfig('view:categories').isVisible} badge={getModuleConfig('view:categories').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:payment_methods" icon={CreditCard} label="Pagos" isVisible={getModuleConfig('view:payment_methods').isVisible} badge={getModuleConfig('view:payment_methods').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:reports" icon={FileBarChart} label="Reportes" isVisible={getModuleConfig('view:reports').isVisible} badge={getModuleConfig('view:reports').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:accounting" icon={Calculator} label="Contabilidad" isVisible={getModuleConfig('view:accounting').isVisible} badge={getModuleConfig('view:accounting').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
            <SidebarItem id="view:settings" icon={Settings} label="Ajustes" isVisible={getModuleConfig('view:settings').isVisible} badge={getModuleConfig('view:settings').isNew ? 'NUEVO' : undefined} currentView={currentView} sidebarSearch={sidebarSearch} setView={setView} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isDarkMode={isDarkMode} primaryColor={primaryColorFromDoc} />
          </nav>
        </div>

        <div className={`p-3 border-t shrink-0 ${isDarkMode ? 'border-border' : 'border-slate-100'}`}>
           <div className={`flex items-center gap-3 p-2 rounded-lg ${isDarkMode ? 'bg-bg3' : 'bg-slate-50'}`}>
              <div className="w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold flex-shrink-0 shadow-md text-xs" style={{ backgroundColor: 'var(--brand-primary)' }}>{company?.razonSocial?.charAt(0) || 'O'}</div>
              {isSidebarOpen && (
                <div className="flex-1 min-0 overflow-hidden">
                  <p className={`text-[9px] font-bold uppercase leading-none mb-1 truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {currentUser?.name || 'Invitado'}
                  </p>
                  <p className={`text-[8px] truncate font-bold uppercase tracking-widest flex items-center gap-1 ${isDarkMode ? 'text-text3' : 'text-slate-500'}`}>
                    <Shield size={10} className="shrink-0 opacity-70" />
                    {currentUser?.role || 'Visitante'}
                    {isSaaSMaster && (
                      <button 
                        onClick={() => setView('DEV_CONFIG')} 
                        className={`ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded border ${isDarkMode ? 'border-amber-500/30 text-amber-500 hover:bg-amber-500/10' : 'border-indigo-500/30 text-indigo-500 hover:bg-indigo-500/10'} font-black transition-all`}
                      >
                        <Terminal size={8} />
                        <span className="text-[7px] uppercase tracking-tighter">DEV</span>
                      </button>
                    )}
                  </p>
                  <p className={`text-[7px] font-black opacity-30 tracking-tight uppercase mt-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    v{APP_VERSION}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-1">
                {isOwner && onBackToOwner && (
                  <button 
                    onClick={onBackToOwner} 
                    className="text-text3 hover:text-accent p-1.5 transition-colors" 
                    title="Salir de Sucursal y volver al Panel"
                  >
                    <ArrowRight className="rotate-180" size={16} />
                  </button>
                )}
                <button 
                  onClick={onLogout} 
                  className="text-text3 hover:text-rose-500 p-1.5 transition-colors"
                  title="Cerrar sesión completamente"
                >
                  <LogOut size={16} />
                </button>
              </div>
           </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <header className={`h-[56px] flex items-center justify-between px-6 lg:px-8 z-10 border-b transition-colors duration-500 ${company?.sunatEnvironment === 'BETA' ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg' : isDarkMode ? 'bg-bg2 border-border' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`p-2 rounded-lg transition-all ${company?.sunatEnvironment === 'BETA' ? 'hover:bg-white/10 text-white' : isDarkMode ? 'hover:bg-bg3 text-text' : 'hover:bg-slate-50 text-slate-600'}`}><Menu size={20} /></button>
             {isOwner && onBackToOwner && (
               <button 
                onClick={onBackToOwner} 
                className={`p-2 rounded-lg transition-all flex items-center gap-2 font-bold text-[9px] uppercase tracking-widest ${company?.sunatEnvironment === 'BETA' ? 'bg-white/10 hover:bg-white/20 text-white border-white/20' : isDarkMode ? 'bg-bg3 hover:bg-surface text-text3 border border-border shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-400 border border-slate-200'}`}
               >
                  <ArrowRight className="rotate-180" size={16} />
                  <span className="hidden sm:inline">Volver al Panel</span>
               </button>
             )}
             <div className="flex gap-2 items-center">
                {company?.sunatEnvironment === 'PRODUCTION' ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-green-500/10 text-green-600 text-[8px] font-bold border border-green-500/20 uppercase">
                    <img src="https://iili.io/BxxqxVt.png" className="w-3 h-3 object-contain" alt="SUNAT" />
                    PROD
                  </span>
                ) : company?.sunatEnvironment === 'BETA' ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-orange-500 text-white text-[8px] font-bold border border-orange-400 uppercase shadow-sm">
                    <Beaker size={10} /> BETA
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 text-[8px] font-bold border border-blue-500/20 uppercase">
                    <TestTube2 size={10} /> INT
                  </span>
                )}
                <div className={`flex items-center gap-1.5 rounded-md border text-[8px] font-bold uppercase transition-all overflow-hidden pr-2 ${waStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-bg3 text-text3 border-border'}`}><div className="relative w-5 h-5 flex items-center justify-center shrink-0"><img src="https://iili.io/fXXft0Q.png" className={`w-3.5 h-3.5 object-contain ${waStatus !== 'connected' ? 'grayscale opacity-40' : ''}`} alt="WA" />{waStatus === 'connected' && <div className="absolute top-1 right-1 w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />}</div><span className="leading-none">{waStatus === 'connected' ? 'WA ON' : 'WA OFF'}</span></div>
             </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 sm:gap-2">
                {(birthdayStats.today + birthdayStats.tomorrow) > 0 && (<button onClick={() => setIsBirthdayModalOpen(true)} className="p-2 rounded-lg transition-all relative text-pink-500 bg-pink-500/10 border border-pink-500/20 shadow-sm"><Cake size={18} strokeWidth={3} /><span className="absolute -top-1 -right-1 bg-pink-600 text-white text-[7px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center border border-bg2">{birthdayStats.today + birthdayStats.tomorrow}</span></button>)}
                <button onClick={() => setShowAutoNotifications(!showAutoNotifications)} className={`p-2 rounded-lg transition-all relative ${totalNotifications > 0 ? 'text-rose-500 animate-pulse bg-rose-500/10 border border-rose-500/20 shadow-sm' : 'text-text3 hover:bg-bg3'}`}><Bell size={18} strokeWidth={totalNotifications > 0 ? 3 : 2} />{totalNotifications > 0 && <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[7px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center border border-bg2">{totalNotifications}</span>}</button>
                
                <button 
                  onClick={() => setView('view:pos')}
                  className={`p-2 rounded-lg transition-all active:scale-95 hover:scale-110 ${isDarkMode ? 'text-accent hover:bg-bg3' : 'text-indigo-600 hover:bg-indigo-50'}`}
                  title="Acceso Rápido: Nueva Venta"
                >
                  <WashingMachine size={18} strokeWidth={2.5} />
                </button>

                {onRefresh && (
                  <button 
                    onClick={onRefresh}
                    className={`p-2 rounded-lg transition-all active:scale-90 active:rotate-180 duration-500 ${isDarkMode ? 'text-text hover:bg-bg3' : 'text-slate-600 hover:bg-slate-50'}`}
                    title="Refrescar Datos"
                  >
                    <RotateCw size={18} />
                  </button>
                )}
                <button onClick={() => setIsHelpModalOpen(true)} className={`p-2 rounded-lg transition-all active:scale-90 ${isDarkMode ? 'text-text hover:bg-bg3' : 'text-slate-600 hover:bg-slate-50'}`} title="Ayuda y Tutoriales"><HelpCircle size={18} /></button>
                <button onClick={() => setIsCalculatorOpen(true)} className={`p-2 rounded-lg transition-all active:scale-90 ${isDarkMode ? 'text-text hover:bg-bg3' : 'text-slate-600 hover:bg-slate-50'}`}><Calculator size={18} /></button>
            </div>
            <div className={`p-0.5 rounded-lg flex gap-0.5 border ${company?.sunatEnvironment === 'BETA' ? 'bg-white/10 border-white/20' : isDarkMode ? 'bg-bg3 border-border' : 'bg-slate-100 border-slate-200'}`}>
                <button onClick={() => isDarkMode && toggleTheme()} className={`p-1.5 rounded-md transition-all ${!isDarkMode ? 'bg-white text-orange-500 shadow-sm' : 'text-text3'}`}><Sun size={14} fill={!isDarkMode ? "currentColor" : "none"} /></button>
                <button onClick={() => !isDarkMode && toggleTheme()} className={`p-1.5 rounded-md transition-all ${isDarkMode ? 'bg-accent text-white shadow-sm' : 'text-slate-400'}`} style={isDarkMode ? { backgroundColor: 'var(--brand-primary)' } : {}}><Moon size={14} fill={isDarkMode ? "currentColor" : "none"} /></button>
            </div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm ${company?.sunatEnvironment === 'BETA' ? 'bg-white/10 border-white/20 text-white' : 'bg-surface border-border text-text3'}`}><User size={16} /></div>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto relative ${isDarkMode ? 'bg-bg' : 'bg-gray-50'}`}>
            {children}
            {showAutoNotifications && (
                <div className="absolute top-16 right-8 w-80 max-h-[500px] bg-bg2 rounded-xl shadow-2xl border border-border z-[60] flex flex-col overflow-hidden animate-in slide-in-from-top-2">
                    <div className="p-3 bg-surface text-text flex justify-between items-center shrink-0 border-b border-border"><div className="flex items-center gap-2"><Bell size={14} className="text-accent" /><span className="text-[10px] font-bold uppercase tracking-widest">Notificaciones</span></div><button onClick={() => setShowAutoNotifications(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={14}/></button></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 bg-bg">
                        {totalNotifications === 0 ? (<div className="py-12 text-center flex flex-col items-center gap-3"><CheckCircle2 size={32} className="text-emerald-500 opacity-20" /><p className="text-[9px] font-bold text-text3 uppercase tracking-widest">No hay alertas</p></div>) : (
                            <>
                                {pendingAutoRequests.map(req => (
                                    <div key={req.id} className="bg-bg2 p-3 rounded-lg border border-border shadow-sm flex flex-col gap-2 relative group">
                                        <div className="flex justify-between items-start gap-2"><div className="min-w-0 flex-1"><p className="text-[8px] font-bold text-accent uppercase mb-1">RECOJO NUEVO</p><p className="font-bold text-text text-[10px] uppercase truncate">{(req.clientName || '').toUpperCase()}</p><p className="text-[8px] font-bold text-text2 uppercase tracking-tight truncate">{req.address}</p></div></div>
                                        <div className="flex justify-between items-center pt-2 border-t border-border"><div className="flex items-center gap-1 text-text3"><Calendar size={10} /><span className="text-[8px] font-bold">{new Date(req.scheduledDate).toLocaleDateString()}</span></div><button onClick={() => handleMarkPickupRead(req.id)} className="bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1"><Check size={10} strokeWidth={4} /> RECIBIDO</button></div>
                                    </div>
                                ))}
                                {pendingDeliveries.map(inv => (
                                    <div key={inv.id} className="bg-accent-glow p-3 rounded-lg border border-accent/20 shadow-sm flex flex-col gap-2 relative group">
                                        <div className="flex justify-between items-start gap-2"><div className="min-w-0 flex-1"><p className="text-[8px] font-bold text-rose-500 uppercase mb-1 flex items-center gap-1"><Truck size={8}/> ENTREGA EN RUTA</p><p className="font-bold text-text text-[10px] uppercase truncate">{(inv.client.name || '').toUpperCase()}</p><p className="text-[8px] font-bold text-text2 uppercase tracking-tight truncate">Orden #{inv.ordenNumber}</p></div></div>
                                        <div className="flex items-center justify-between pt-2 border-t border-accent/10"><div className="flex items-center gap-1 text-text3"><Phone size={10} /><span className="text-[8px] font-bold">{inv.client.phone}</span></div><button onClick={() => handleMarkDeliveryRead(inv.id)} className="bg-bg2 text-accent px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase hover:bg-accent hover:text-white transition-all flex items-center gap-1 shadow-sm"><Check size={10} strokeWidth={4} /> RECIBIDO</button></div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                    {totalNotifications > 0 && (<div className="p-3 bg-bg2 border-t border-border"><button onClick={handleMarkAllAsRead} className="w-full bg-accent text-white py-2 rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-accent/80 transition-all flex items-center justify-center gap-2"><Check size={12} strokeWidth={4} /> RECIBIR TODOS</button></div>)}
                </div>
            )}
        </main>
      </div>
      <CalculatorModal isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />
      <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} videos={helpVideos} />
      <BirthdayModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} clients={birthdayClientsData} company={company} />
      <StoreModal isOpen={isStoreModalOpen} onClose={() => setIsStoreModalOpen(false)} client={null} company={company} />
    </div>
  );
};

export default Layout;
import React, { useState, useEffect } from 'react';
import { Company, Client, UserRole } from '../types';
import { dbGetClients, dbUpdateClientSubscriptionStatus } from '../services/dbService';
import { 
  Crown, Plus, Search, X, Check, Calendar, Trash2, Loader2, Play, Pause,
  BadgeDollarSign, RefreshCw, BarChart3, Scale, ShieldAlert, History, Edit3
} from 'lucide-react';

interface MembershipsProps {
  company: Company;
  canManage?: boolean;
  onSaveCompany: (updatedCompany: Company) => Promise<void>;
}

export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  limitKilos: number;
  description: string;
}

export interface ClientSubscription {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  planId: string;
  planName: string;
  price: number;
  totalKilos: number;
  consumedKilos: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  paymentStatus: 'PAGADO' | 'PENDIENTE';
  status: 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'PAUSADA';
  createdAt: string;
}

export interface KiloConsumption {
  id: string;
  subscriptionId: string;
  clientId: string;
  clientName: string;
  kilograms: number;
  date: string; // ISO string text
  notes: string;
  recordedBy: string;
}

const Memberships: React.FC<MembershipsProps> = ({ company, canManage = true, onSaveCompany }) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'SUBSCRIBERS' | 'PLANS' | 'HISTORY'>('SUBSCRIBERS');
  
  // States of the module
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>([]);
  const [consumptions, setConsumptions] = useState<KiloConsumption[]>([]);
  
  // Clients list for selector
  const [systemClients, setSystemClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  
  // Filters & Searches
  const [subSearchTerm, setSubSearchTerm] = useState('');
  const [subFilter, setSubFilter] = useState<'ALL' | 'ACTIVA' | 'PENDIENTE_PAGO' | 'VENCIDA'>('ALL');
  
  // Modal states
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isConsumeModalOpen, setIsConsumeModalOpen] = useState(false);
  
  // Plan form states
  const [planEditing, setPlanEditing] = useState<MembershipPlan | null>(null);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planKilos, setPlanKilos] = useState('');
  const [planDesc, setPlanDesc] = useState('');
  
  // Subscription form states
  const [subSelectedClient, setSubSelectedClient] = useState<Client | null>(null);
  const [subClientSearch, setSubClientSearch] = useState('');
  const [subSelectedPlanId, setSubSelectedPlanId] = useState('');
  const [subStartDate, setSubStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [subEndDate, setSubEndDate] = useState('');
  const [subPaymentStatus, setSubPaymentStatus] = useState<'PAGADO' | 'PENDIENTE'>('PAGADO');
  
  // Consumption form states
  const [consumeSelectedSub, setConsumeSelectedSub] = useState<ClientSubscription | null>(null);
  const [consumeKilos, setConsumeKilos] = useState('');
  const [consumeNotes, setConsumeNotes] = useState('');
  
  // General loaders
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize and load data from modulos_config
  useEffect(() => {
    loadMembershipData();
    loadSystemClients();
  }, [company?.id]);

  const loadMembershipData = () => {
    try {
      const config = company.modulos_config || {};
      const membershipsConfig = config.membresias || {};
      
      const loadedPlans: MembershipPlan[] = membershipsConfig.plans || [];
      const loadedSubs: ClientSubscription[] = membershipsConfig.subscriptions || [];
      const loadedConsumptions: KiloConsumption[] = membershipsConfig.consumptions || [];
      
      // Auto-validate expiration dates to change status to VENCIDA on load
      const todayStr = new Date().toISOString().split('T')[0];
      const validatedSubs = loadedSubs.map(sub => {
        if (sub.status === 'ACTIVA' && sub.endDate < todayStr) {
          return { ...sub, status: 'VENCIDA' as const };
        }
        return sub;
      });

      setPlans(loadedPlans);
      setSubscriptions(validatedSubs);
      setConsumptions(loadedConsumptions);
    } catch (e) {
      console.error("Error cargando datos de membresías:", e);
    }
  };

  const loadSystemClients = async () => {
    setIsLoadingClients(true);
    try {
      const res = await dbGetClients(1, 1500, '');
      if (res && res.clients) {
        setSystemClients(res.clients);
      }
    } catch (e) {
      console.error("Error al cargar clientes:", e);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const syncSingleClientSubscribedStatus = async (clientId: string, allSubs: ClientSubscription[]) => {
    // Si tiene al menos una suscripción 'ACTIVA' o 'PAUSADA', se considera suscrito
    const hasActiveOrPaused = allSubs.some(s => s.clientId === clientId && (s.status === 'ACTIVA' || s.status === 'PAUSADA'));
    await dbUpdateClientSubscriptionStatus(clientId, hasActiveOrPaused);
    setSystemClients(prev => prev.map(c => c.id === clientId ? { ...c, suscrito: hasActiveOrPaused } : c));
  };

  // Safe wrapper to persist the config back to Supabase
  const persistConfig = async (
    updatedPlans: MembershipPlan[],
    updatedSubs: ClientSubscription[],
    updatedConsumptions: KiloConsumption[]
  ) => {
    setIsSaving(true);
    try {
      const currentConfig = company.modulos_config || {};
      const updatedConfig = {
        ...currentConfig,
        membresias: {
          plans: updatedPlans,
          subscriptions: updatedSubs,
          consumptions: updatedConsumptions
        }
      };

      const updatedCompany = {
        ...company,
        modulos_config: updatedConfig
      };

      await onSaveCompany(updatedCompany);
      
      setPlans(updatedPlans);
      setSubscriptions(updatedSubs);
      setConsumptions(updatedConsumptions);
    } catch (error: any) {
      console.error("Error de persistencia de membresías:", error);
      alert(`Error al guardar: ${error.message || "Error al sincronizar con la nube."}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Manage plans
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName || !planPrice || !planKilos) return;

    const priceNum = parseFloat(planPrice);
    const kilosNum = parseFloat(planKilos);

    let updatedPlans = [...plans];
    if (planEditing) {
      updatedPlans = updatedPlans.map(p => 
        p.id === planEditing.id 
          ? { ...p, name: planName.toUpperCase(), price: priceNum, limitKilos: kilosNum, description: planDesc.toUpperCase() } 
          : p
      );
    } else {
      const newPlan: MembershipPlan = {
        id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: planName.toUpperCase(),
        price: priceNum,
        limitKilos: kilosNum,
        description: planDesc.toUpperCase()
      };
      updatedPlans.push(newPlan);
    }

    await persistConfig(updatedPlans, subscriptions, consumptions);
    
    // Reset form
    setPlanName('');
    setPlanPrice('');
    setPlanKilos('');
    setPlanDesc('');
    setPlanEditing(null);
    setIsPlanModalOpen(false);
  };

  const handleDeletePlan = async (planId: string) => {
    // Check if any client is already subscribed to this plan
    const isUsed = subscriptions.some(s => s.planId === planId);
    if (isUsed) {
      alert("No se puede eliminar el plan porque hay clientes suscritos actualmente.");
      return;
    }

    if (!confirm("¿Está seguro de eliminar este plan de suscripción mensual?")) return;

    const updatedPlans = plans.filter(p => p.id !== planId);
    await persistConfig(updatedPlans, subscriptions, consumptions);
  };

  // Manage subscriptions
  // Auto-calculate end date when start date is edited (default 30 days)
  useEffect(() => {
    if (subStartDate) {
      const d = new Date(subStartDate);
      d.setDate(d.getDate() + 30);
      setSubEndDate(d.toISOString().split('T')[0]);
    }
  }, [subStartDate]);

  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subSelectedClient || !subSelectedPlanId || !subStartDate || !subEndDate) {
      alert("Por favor cubra todos los campos obligatorios del socio.");
      return;
    }

    const plan = plans.find(p => p.id === subSelectedPlanId);
    if (!plan) return;

    // Check if customer already has an active subscription
    const existingActive = subscriptions.find(s => s.clientId === subSelectedClient.id && (s.status === 'ACTIVA' || s.status === 'PAUSADA'));
    if (existingActive) {
      if (!confirm(`Este cliente ya tiene una membresía activa (${existingActive.planName}). ¿Desea crear otra de todas formas?`)) {
        return;
      }
    }

    const newSub: ClientSubscription = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      clientId: subSelectedClient.id,
      clientName: `${subSelectedClient.name} ${subSelectedClient.razon_social || ''}`.trim(),
      clientPhone: subSelectedClient.phone || '',
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      totalKilos: plan.limitKilos,
      consumedKilos: 0,
      startDate: subStartDate,
      endDate: subEndDate,
      paymentStatus: subPaymentStatus,
      status: 'ACTIVA',
      createdAt: new Date().toISOString()
    };

    const updatedSubs = [newSub, ...subscriptions];
    await persistConfig(plans, updatedSubs, consumptions);
    await syncSingleClientSubscribedStatus(subSelectedClient.id, updatedSubs);

    // Reset Form
    setSubSelectedClient(null);
    setSubClientSearch('');
    setSubSelectedPlanId('');
    setSubPaymentStatus('PAGADO');
    setIsSubModalOpen(false);
  };

  const handleActionSubscription = async (subId: string, action: 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'PAUSADA' | 'DELETE' | 'PAGADO' | 'PENDIENTE') => {
    const subToChange = subscriptions.find(s => s.id === subId);
    let updatedSubs = [...subscriptions];
    
    if (action === 'DELETE') {
      if (!confirm("¿Está seguro de eliminar esta suscripción completamente? Se perderá el control de kilos consumidos.")) return;
      updatedSubs = updatedSubs.filter(s => s.id !== subId);
    } else if (action === 'PAGADO' || action === 'PENDIENTE') {
      updatedSubs = updatedSubs.map(s => s.id === subId ? { ...s, paymentStatus: action } : s);
    } else {
      updatedSubs = updatedSubs.map(s => s.id === subId ? { ...s, status: action } : s);
    }

    await persistConfig(plans, updatedSubs, consumptions);
    if (subToChange) {
      await syncSingleClientSubscribedStatus(subToChange.clientId, updatedSubs);
    }
  };

  const handleRenewSubscription = async (sub: ClientSubscription) => {
    if (!confirm(`¿Desea renovar la membresía de ${sub.clientName} por otro ciclo de 30 días? Se mantendrá el mismo plan (${sub.planName}) y se reiniciarán las métricas de consumo de kilos.`)) return;

    const start = new Date().toISOString().split('T')[0];
    const end = new Date();
    end.setDate(end.getDate() + 30);
    const endStr = end.toISOString().split('T')[0];

    // Archive the older subscription to VENCIDA status
    const updatedSubs = subscriptions.map(s => {
      if (s.id === sub.id) {
        return { ...s, status: 'VENCIDA' as const };
      }
      return s;
    });

    // Create newly active subscription
    const newCycle: ClientSubscription = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      clientId: sub.clientId,
      clientName: sub.clientName,
      clientPhone: sub.clientPhone,
      planId: sub.planId,
      planName: sub.planName,
      price: sub.price,
      totalKilos: sub.totalKilos,
      consumedKilos: 0,
      startDate: start,
      endDate: endStr,
      paymentStatus: 'PAGADO', // starts fully paid on renew usually, customized inside modal later if needed
      status: 'ACTIVA',
      createdAt: new Date().toISOString()
    };

    updatedSubs.unshift(newCycle);
    await persistConfig(plans, updatedSubs, consumptions);
    await syncSingleClientSubscribedStatus(sub.clientId, updatedSubs);
  };

  // Manage Consumos
  const handleRegisterConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumeSelectedSub || !consumeKilos) {
      alert("Seleccione un socio y detalle los kilos pesados.");
      return;
    }

    const kilosToUse = parseFloat(consumeKilos);
    if (isNaN(kilosToUse) || kilosToUse <= 0) {
      alert("Indique una cantidad válida de kilogramos.");
      return;
    }

    const remainingKilos = consumeSelectedSub.totalKilos - consumeSelectedSub.consumedKilos;
    if (kilosToUse > remainingKilos) {
      if (!confirm(`El consumo de ${kilosToUse} Kg excede los kilos restantes de la membresía (${remainingKilos.toFixed(2)} Kg). ¿Desea permitir sobregiro?`)) {
        return;
      }
    }

    const userName = localStorage.getItem('sislav_current_user_name') || 'Caja';

    const newLog: KiloConsumption = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      subscriptionId: consumeSelectedSub.id,
      clientId: consumeSelectedSub.clientId,
      clientName: consumeSelectedSub.clientName,
      kilograms: kilosToUse,
      date: new Date().toISOString(),
      notes: consumeNotes.toUpperCase() || 'LAVADO REGULAR',
      recordedBy: userName
    };

    // Update subscription consumed kilos
    const updatedSubs = subscriptions.map(s => {
      if (s.id === consumeSelectedSub.id) {
        return { ...s, consumedKilos: parseFloat((s.consumedKilos + kilosToUse).toFixed(2)) };
      }
      return s;
    });

    const updatedConsumptions = [newLog, ...consumptions];

    await persistConfig(plans, updatedSubs, updatedConsumptions);

    // Reset Form
    setConsumeSelectedSub(null);
    setConsumeKilos('');
    setConsumeNotes('');
    setIsConsumeModalOpen(false);
  };

  // Filter clients for sub registration
  const filteredSystemClients = subClientSearch.trim()
    ? systemClients.filter(c => 
        `${c.name} ${c.razon_social || ''}`.toLowerCase().includes(subClientSearch.toLowerCase()) ||
        c.docNumber?.includes(subClientSearch) ||
        c.phone?.includes(subClientSearch)
      ).slice(0, 5)
    : [];

  // Filter subscriptions listing
  const filteredSubscriptions = subscriptions.filter(s => {
    const matchesSearch = s.clientName.toLowerCase().includes(subSearchTerm.toLowerCase()) || 
                          s.planName.toLowerCase().includes(subSearchTerm.toLowerCase()) ||
                          s.clientPhone.includes(subSearchTerm);
    if (!matchesSearch) return false;

    if (subFilter === 'ACTIVA') return s.status === 'ACTIVA';
    if (subFilter === 'PENDIENTE_PAGO') return s.paymentStatus === 'PENDIENTE' && s.status !== 'CANCELADA';
    if (subFilter === 'VENCIDA') return s.status === 'VENCIDA';
    return true;
  });

  const currencySymbol = company.currencySymbol || 'S/';

  // Statistics calculation
  const stats = {
    totalActive: subscriptions.filter(s => s.status === 'ACTIVA').length,
    activeKilosConsumed: consumptions.reduce((acc, c) => acc + c.kilograms, 0),
    totalRevenue: subscriptions.reduce((acc, s) => acc + (s.paymentStatus === 'PAGADO' ? s.price : 0), 0),
    pendingPayments: subscriptions.filter(s => s.paymentStatus === 'PENDIENTE' && s.status !== 'CANCELADA').length
  };

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto bg-slate-50 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-inner">
              <Crown size={30} className="fill-amber-400 stroke-amber-600 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                Módulo de Membresías
              </h1>
              <p className="text-xs text-slate-500 font-medium font-mono uppercase tracking-wider">
                Suscripciones mensuales de kilos pre-pagados para lavado frecuente.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManage && (
              <>
                <button 
                  onClick={() => setIsSubModalOpen(true)}
                  className="bg-indigo-600 text-white font-bold py-3 px-5 rounded-2xl text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all flex items-center gap-2 active:scale-95"
                >
                  <Plus size={16} strokeWidth={2.5} /> Nueva Suscripción
                </button>
                <button 
                  onClick={() => setIsConsumeModalOpen(true)}
                  className="bg-amber-500 text-white font-bold py-3 px-5 rounded-2xl text-xs uppercase tracking-widest hover:bg-amber-600 shadow-md shadow-amber-100 transition-all flex items-center gap-2 active:scale-95"
                >
                  <Scale size={16} /> Registrar Consumo
                </button>
              </>
            )}
            <button 
              onClick={() => {
                loadMembershipData();
                loadSystemClients();
                setIsRefreshing(true);
                setTimeout(() => setIsRefreshing(false), 800);
              }}
              className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-all active:scale-95 flex items-center justify-center"
              title="Sincronizar"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Dynamic Metric Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Socios Activos</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{stats.totalActive}</span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Activas</span>
            </div>
            <div className="h-1 bg-indigo-100 rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all" style={{ width: `${Math.min(stats.totalActive * 8, 100)}%` }} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Consumo Mensual</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-600">{stats.activeKilosConsumed.toFixed(1)}</span>
              <span className="text-[10px] font-mono text-slate-500">KG</span>
            </div>
            <div className="text-[9px] text-slate-400 font-bold uppercase mt-3 flex items-center gap-1">
              <Scale size={12} /> Lavados controlados
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Total Recaudado</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-600">{currencySymbol} {stats.totalRevenue.toFixed(2)}</span>
            </div>
            <div className="text-[9px] text-slate-400 font-bold uppercase mt-3 flex items-center gap-1">
              <Check size={12} className="text-emerald-500" /> Cobrado online
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Pagos por Cobrar</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black ${stats.pendingPayments > 0 ? "text-rose-600" : "text-slate-900"}`}>{stats.pendingPayments}</span>
              <span className="text-[10px] font-bold text-rose-500 uppercase">Por cobrar</span>
            </div>
            <div className="h-1 bg-rose-50 rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-rose-500 transition-all" style={{ width: `${Math.min(stats.pendingPayments * 20, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-200/60 p-1 rounded-2xl w-full md:w-max gap-1">
          <button 
            onClick={() => setActiveTab('SUBSCRIBERS')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'SUBSCRIBERS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Crown size={15} /> Socios
          </button>
          <button 
            onClick={() => setActiveTab('PLANS')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'PLANS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <BarChart3 size={15} /> Planes Mensuales {plans.length > 0 && `(${plans.length})`}
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <History size={15} /> Historial de Pesos
          </button>
        </div>

        {/* Content Render views */}
        {activeTab === 'SUBSCRIBERS' && (
          <div className="space-y-4">
            
            {/* Filter and Search Bar */}
            <div className="bg-white p-3 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-max shrink-0 gap-1 overflow-x-auto">
                <button 
                  onClick={() => setSubFilter('ALL')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${subFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  TODOS
                </button>
                <button 
                  onClick={() => setSubFilter('ACTIVA')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${subFilter === 'ACTIVA' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  ACTIVOS
                </button>
                <button 
                  onClick={() => setSubFilter('PENDIENTE_PAGO')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${subFilter === 'PENDIENTE_PAGO' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  POR COBRAR
                </button>
                <button 
                  onClick={() => setSubFilter('VENCIDA')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${subFilter === 'VENCIDA' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  VENCIDOS
                </button>
              </div>

              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  value={subSearchTerm}
                  onChange={e => setSubSearchTerm(e.target.value)}
                  placeholder="Buscar socio por nombres, teléfono o plan..."
                  className="w-full bg-slate-50 border-0 rounded-2xl pl-12 pr-4 py-3 text-xs md:text-sm font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/10 placeholder:text-slate-400 font-sans transition-all"
                />
              </div>
            </div>

            {/* Subscribers Grid List */}
            {filteredSubscriptions.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-[2.5rem] border border-slate-100 shadow-sm max-w-xl mx-auto">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Crown size={28} className="text-slate-300" />
                </div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">Sin Suscripciones Activas</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider max-w-sm mx-auto leading-relaxed">
                  No se encontraron socios que coincidan con la búsqueda. Cree una membresía para fidelizar a los clientes recurrentes de lavandería.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSubscriptions.map(sub => {
                  const remainingKilos = sub.totalKilos - sub.consumedKilos;
                  const percentUsed = Math.min((sub.consumedKilos / sub.totalKilos) * 100, 100);
                  const isVencido = sub.status === 'VENCIDA';
                  const isCanceled = sub.status === 'CANCELADA';
                  const isPausado = sub.status === 'PAUSADA';
                  
                  // Compute remaining days
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  const expDate = new Date(sub.endDate);
                  expDate.setHours(23,59,59,999);
                  const diffTime = expDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  return (
                    <div 
                      key={sub.id} 
                      className={`bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between transition-transform hover:-translate-y-1 duration-200 relative ${isVencido ? "opacity-75" : ""}`}
                    >
                      {/* Subscription Badges Banner */}
                      <div className="p-5 space-y-4">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 block tracking-tight uppercase">Socio de Lavandería</span>
                            <h3 className="font-black text-sm text-slate-900 tracking-tight leading-snug uppercase mb-1">
                              {sub.clientName}
                            </h3>
                            {sub.clientPhone && (
                              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                                📞 {sub.clientPhone}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-1 items-end">
                            <span className={`text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full ${
                              sub.status === 'ACTIVA' ? 'bg-emerald-50 text-emerald-600' :
                              sub.status === 'PAUSADA' ? 'bg-amber-50 text-amber-500' :
                              'bg-rose-50 text-rose-600'
                            }`}>
                              {sub.status}
                            </span>
                            
                            <span className={`text-[8px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full mt-1 ${
                              sub.paymentStatus === 'PAGADO' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'
                            }`}>
                              {sub.paymentStatus}
                            </span>
                          </div>
                        </div>

                        {/* Plan Specs */}
                        <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center text-xs">
                          <div>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Plan Contratado</p>
                            <p className="font-black text-slate-800 uppercase tracking-tight">{sub.planName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Inversión Mensual</p>
                            <p className="font-black text-indigo-700 tracking-tight">{currencySymbol} {sub.price.toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Progress Bar Kilos */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-slate-400 uppercase">Consumo de Kilos</span>
                            <span className="text-slate-800 font-mono">
                              {sub.consumedKilos.toFixed(1)} / {sub.totalKilos.toFixed(1)} Kg
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                percentUsed > 90 ? 'bg-rose-500' : percentUsed > 65 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${percentUsed}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[9px] font-black text-slate-400 tracking-wider">
                            <span>{percentUsed.toFixed(0)}% USANDO</span>
                            <span className="text-emerald-600">{remainingKilos.toFixed(1)} KG DISPONIBLES</span>
                          </div>
                        </div>

                        {/* Date info & Remaining days */}
                        <div className="flex justify-between items-center text-[10px] pt-1">
                          <div className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <Calendar size={13} />
                            Vence: {new Date(sub.endDate).toLocaleDateString('es-PE')}
                          </div>
                          <div>
                            {isVencido || isCanceled ? (
                              <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded uppercase">
                                Vencido
                              </span>
                            ) : isPausado ? (
                              <span className="text-[9px] font-black text-amber-500 bg-amber-50 px-2.5 py-0.5 rounded uppercase">
                                Pausado
                              </span>
                            ) : diffDays <= 3 ? (
                              <span className="text-[9px] font-black text-red-600 bg-red-50 px-2.5 py-0.5 rounded animate-pulse uppercase">
                                ¡Vence en {diffDays} días!
                              </span>
                            ) : (
                              <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded uppercase">
                                Quedan {diffDays} días
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons footer */}
                      {canManage && (
                        <div className="bg-slate-50 border-t border-slate-100 p-3 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleRenewSubscription(sub)}
                            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold py-2 rounded-xl text-[10px] uppercase tracking-wider transition-colors active:scale-95 flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw size={12} /> Renovar Ciclo
                          </button>
                          
                          <div className="relative group">
                            <select
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) handleActionSubscription(sub.id, val as any);
                                e.target.value = '';
                              }}
                              className="w-full bg-white border border-slate-200 text-slate-700 font-black py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-colors outline-none cursor-pointer text-center"
                            >
                              <option value="">Acciones...</option>
                              {sub.paymentStatus === 'PENDIENTE' && (
                                <option value="PAGADO" className="font-bold text-emerald-600">MARCAR PAGADO</option>
                              )}
                              {sub.paymentStatus === 'PAGADO' && (
                                <option value="PENDIENTE" className="font-bold text-amber-500">MARCAR PENDIENTE</option>
                              )}
                              {sub.status === 'ACTIVA' && (
                                <option value="PAUSADA" className="font-bold text-amber-500">PAUSAR</option>
                              )}
                              {sub.status === 'PAUSADA' && (
                                <option value="ACTIVA" className="font-bold text-emerald-600">REANUDAR</option>
                              )}
                              {sub.status !== 'CANCELADA' && (
                                <option value="CANCELADA" className="font-bold text-rose-600">CANCELAR/SUSPENDER</option>
                              )}
                              {sub.status === 'CANCELADA' && (
                                <option value="ACTIVA" className="font-bold text-emerald-600">RE-ACTIVAR</option>
                              )}
                              <option value="DELETE" className="font-bold text-red-600">ELIMINAR SOCIO</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PLANS VIEW */}
        {activeTab === 'PLANS' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Configuración de Planes o Tarifarios Mensuales</h3>
                <p className="text-xs text-slate-400">Define los paquetes de kilos recurrentes para tu sucursal.</p>
              </div>
              {canManage && (
                <button
                  onClick={() => {
                    setPlanEditing(null);
                    setPlanName('');
                    setPlanPrice('');
                    setPlanKilos('');
                    setPlanDesc('');
                    setIsPlanModalOpen(true);
                  }}
                  className="bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest py-3 px-5 rounded-xl hover:bg-indigo-700 shadow-md flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap"
                >
                  <Plus size={16} /> Crear Tarifario
                </button>
              )}
            </div>

            {plans.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-[2.5rem] border border-slate-100 shadow-sm max-w-xl mx-auto">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 size={28} className="text-slate-300" />
                </div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">Sin Tarifarios Registrados</h4>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider max-w-sm mx-auto mb-6">
                  Crea tu primera plantilla de plan mensual de lavandería (ej. Plan Familiar 40 Kilos por S/150).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map(plan => {
                  const subscriberCount = subscriptions.filter(s => s.planId === plan.id && s.status === 'ACTIVA').length;
                  return (
                    <div 
                      key={plan.id} 
                      className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between relative group hover:shadow-md transition-shadow"
                    >
                      <div className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Plan de Kilos
                            </span>
                            <h4 className="font-extrabold text-base text-slate-900 tracking-tight uppercase mt-1">
                              {plan.name}
                            </h4>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-indigo-700 tracking-tight">
                              {currencySymbol} {plan.price.toFixed(2)}
                            </p>
                            <p className="text-[9px] font-medium text-slate-400 block tracking-wider uppercase">Al mes</p>
                          </div>
                        </div>

                        {plan.description && (
                          <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-100 leading-relaxed font-bold uppercase">
                            {plan.description}
                          </p>
                        )}

                        <div className="border-t border-slate-100 pt-3 flex justify-between text-xs font-bold leading-none">
                          <span className="text-slate-400 uppercase flex items-center gap-1">
                            <Scale size={13} className="text-slate-300" /> Kilos Incluidos:
                          </span>
                          <span className="text-slate-800 uppercase font-mono">{plan.limitKilos.toFixed(1)} Kg mensuales</span>
                        </div>

                        <div className="flex justify-between text-xs font-bold leading-none">
                          <span className="text-slate-400 uppercase flex items-center gap-1">
                            <Crown size={13} className="text-slate-300" /> Socios Activos:
                          </span>
                          <span className="text-indigo-600 uppercase font-mono text-xs">{subscriberCount} clientes</span>
                        </div>
                      </div>

                      {canManage && (
                        <div className="bg-slate-50 border-t border-slate-100 p-2.5 flex gap-2">
                          <button
                            onClick={() => {
                              setPlanEditing(plan);
                              setPlanName(plan.name);
                              setPlanPrice(plan.price.toString());
                              setPlanKilos(plan.limitKilos.toString());
                              setPlanDesc(plan.description || '');
                              setIsPlanModalOpen(true);
                            }}
                            className="flex-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-colors active:scale-95 flex items-center justify-center gap-1"
                          >
                            <Edit3 size={11} /> Editar
                          </button>
                          
                          <button
                            onClick={() => handleDeletePlan(plan.id)}
                            className="bg-white border border-rose-100 text-rose-500 hover:bg-rose-50 font-bold py-2 px-3 rounded-xl text-[10px] uppercase tracking-wider transition-colors active:scale-95 flex items-center justify-center"
                            title="Eliminar Tarifario"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* LOG HISTORY VIEW */}
        {activeTab === 'HISTORY' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
                <History className="text-amber-500" size={18} /> Historial de Pesos / Consumos de Membresías
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Control de todos los kilogramos rebajados de los planes mensuales.</p>
            </div>

            {consumptions.length === 0 ? (
              <div className="p-12 text-center max-w-sm mx-auto">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Scale size={24} className="text-slate-300 animate-pulse" />
                </div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">Sin Consumos de Kilos</h4>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-relaxed">
                  No se han registrado consumos en las membresías de los socios aún.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                      <th className="p-4">Socio / Cliente</th>
                      <th className="p-4">Fecha y Hora</th>
                      <th className="p-4 text-center">Kilos Restados</th>
                      <th className="p-4">Efectuado en / Notas</th>
                      <th className="p-4">Operador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {consumptions.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <p className="font-extrabold text-slate-800 uppercase">{log.clientName}</p>
                        </td>
                        <td className="p-4 text-slate-500 font-medium">
                          {new Date(log.date).toLocaleString('es-PE')}
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full font-mono">
                            -{log.kilograms.toFixed(1)} Kg
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded uppercase tracking-wider">
                            {log.notes}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-600 font-semibold uppercase">{log.recordedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* CREATE/EDIT PLAN PLAN MODAL */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in transition-all">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={18} /> {planEditing ? 'Editar Plan de Kilos' : 'Nuevo Plan Mensual'}
              </h3>
              <button 
                onClick={() => setIsPlanModalOpen(false)} 
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={20}/>
              </button>
            </div>
            
            <form onSubmit={handleSavePlan} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre del Plan</label>
                <input 
                  type="text" 
                  required
                  value={planName} 
                  onChange={e => setPlanName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/15 uppercase text-xs"
                  placeholder="PLAN FAMILIAR 20KG"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Costo Mensual ({currencySymbol})
                  </label>
                  <input 
                    type="number" 
                    required 
                    step="0.01"
                    value={planPrice} 
                    onChange={e => setPlanPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-black text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/15 font-mono text-sm"
                    placeholder="120.00"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kilos Incluidos (KG)</label>
                  <input 
                    type="number" 
                    required 
                    step="0.1"
                    value={planKilos} 
                    onChange={e => setPlanKilos(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-black text-indigo-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/15 font-mono text-sm"
                    placeholder="20.0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Descripción / Condiciones</label>
                <textarea 
                  value={planDesc} 
                  onChange={e => setPlanDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/15 uppercase text-xs"
                  placeholder="SÁBANAS, TOALLAS, JOCKEY, ROPA DIARIA. NO ALFOMBRAS."
                />
              </div>

              <button 
                type="submit" 
                disabled={isSaving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl hover:-translate-y-0.5 active:translate-y-0 text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} strokeWidth={3} />}
                {planEditing ? 'ACTUALIZAR PLAN' : 'GUARDAR PLAN'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NEW SUBSCRIPTION MODAL */}
      {isSubModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in transition-all">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
                <Crown className="text-indigo-600" size={18} /> Afiliar Cliente a Membresía Mensual
              </h3>
              <button 
                onClick={() => setIsSubModalOpen(false)} 
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={20}/>
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
              
              {/* Client Selector auto-complete searching CRM */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex justify-between">
                  <span>Seleccionar Cliente</span>
                  {isLoadingClients && <span className="animate-pulse text-[9px] text-indigo-500">Cargando CRM...</span>}
                </label>
                
                {subSelectedClient ? (
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="font-extrabold text-emerald-800 text-xs uppercase leading-none">{subSelectedClient.name}</p>
                      <p className="text-[9px] font-mono font-bold text-emerald-600 mt-1 uppercase">
                        📞 {subSelectedClient.phone || 'S/ Teléfono'} | DNI: {subSelectedClient.docNumber || 'S/ Documento'}
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setSubSelectedClient(null);
                        setSubClientSearch('');
                      }}
                      className="text-emerald-700 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <X size={15} strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-4 top-3 text-slate-400" size={16} />
                    <input 
                      type="text"
                      value={subClientSearch}
                      onChange={e => setSubClientSearch(e.target.value)}
                      placeholder="Escribe para buscar cliente por DNI, Teléfono o Nombre..."
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/15"
                    />

                    {/* Autocomplete absolute results lists */}
                    {subClientSearch.trim().length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-150 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 max-h-52 overflow-y-auto">
                        {filteredSystemClients.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-xs font-bold uppercase">
                            No se encontraron clientes coincidiendo.
                          </div>
                        ) : (
                          filteredSystemClients.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setSubSelectedClient(c)}
                              className="w-full p-3.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors flex justify-between items-center"
                            >
                              <div>
                                <p className="font-black uppercase">{c.name}</p>
                                <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                  DNI: {c.docNumber || '---'} | Tel: {c.phone || '---'}
                                </p>
                              </div>
                              <Check size={14} className="text-indigo-600 opacity-0 group-hover:opacity-100" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Plans options radio selection style */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Elegir Plan Mensual</label>
                {plans.length === 0 ? (
                  <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                    Debes crear primero un plan mensual en la pestaña de Planes.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {plans.map(p => (
                      <label 
                        key={p.id} 
                        className={`p-3 border rounded-2xl flex justify-between items-center cursor-pointer transition-all ${
                          subSelectedPlanId === p.id 
                            ? 'bg-indigo-50/50 border-indigo-600 text-indigo-900 ring-2 ring-indigo-600/10' 
                            : 'bg-slate-50 border-slate-150 text-slate-700 hover:bg-slate-100/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input 
                            type="radio" 
                            name="subPlan"
                            value={p.id}
                            checked={subSelectedPlanId === p.id}
                            onChange={() => setSubSelectedPlanId(p.id)}
                            className="text-indigo-600 focus:ring-indigo-600 accent-indigo-600"
                          />
                          <div>
                            <p className="font-extrabold uppercase text-xs">{p.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-normal mt-0.5">
                              {p.limitKilos.toFixed(1)} Kg de Ropa | {p.description ? p.description.substring(0, 30) + '...' : 'Plan Estándar'}
                            </p>
                          </div>
                        </div>
                        <span className="font-black text-indigo-700 text-xs font-mono select-none">
                          {currencySymbol} {p.price.toFixed(2)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Start Date selection (auto-adds 30 days) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha de Inicio</label>
                  <input 
                    type="date"
                    required
                    value={subStartDate}
                    onChange={e => setSubStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/15 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha de Término</label>
                  <input 
                    type="date"
                    required
                    readOnly
                    value={subEndDate}
                    className="w-full bg-slate-100 border border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-500 outline-none text-xs font-mono cursor-not-allowed"
                    title="Se calcula automáticamente de manera mensual (30 días)"
                  />
                </div>
              </div>

              {/* Payment state */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Estado del Pago Inicial</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSubPaymentStatus('PAGADO')}
                    className={`p-3 font-black text-[10px] uppercase tracking-widest rounded-2xl border transition-all ${
                      subPaymentStatus === 'PAGADO' 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800' 
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    COBRADO / PAGADO
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubPaymentStatus('PENDIENTE')}
                    className={`p-3 font-black text-[10px] uppercase tracking-widest rounded-2xl border transition-all ${
                      subPaymentStatus === 'PENDIENTE' 
                        ? 'bg-amber-50 border-amber-500 text-amber-700' 
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    PENDIENTE DE PAGO
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSaving || plans.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-xl hover:-translate-y-0.5 active:translate-y-0 text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} strokeWidth={3} />}
                AFILIAR SOCIO EXCLUSIVO
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONSUME KILOGRAMS MODAL */}
      {isConsumeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in transition-all">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest flex items-center gap-2">
                <Scale className="text-amber-500" size={18} /> Registrar Consumo de Kilos
              </h3>
              <button 
                onClick={() => setIsConsumeModalOpen(false)} 
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={20}/>
              </button>
            </div>

            <form onSubmit={handleRegisterConsumption} className="p-6 space-y-4 overflow-y-auto">
              
              {/* Select active subscription */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Socio Suscrito</label>
                <select
                  required
                  value={consumeSelectedSub?.id || ''}
                  onChange={(e) => {
                    const sub = subscriptions.find(s => s.id === e.target.value);
                    setConsumeSelectedSub(sub || null);
                  }}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/15 uppercase text-xs"
                >
                  <option value="">Seleccione el socio...</option>
                  {subscriptions
                    .filter(s => s.status === 'ACTIVA')
                    .map(s => {
                      const avail = s.totalKilos - s.consumedKilos;
                      return (
                        <option key={s.id} value={s.id}>
                          {s.clientName} ({s.planName} - Quedan {avail.toFixed(1)} Kg)
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* Show subscriber summary if chosen */}
              {consumeSelectedSub && (
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-2">
                  <div className="flex justify-between text-xs font-bold leading-none">
                    <span className="text-indigo-900/60 uppercase">Kilos Disponibles:</span>
                    <span className="text-indigo-900 font-mono font-black">
                      {(consumeSelectedSub.totalKilos - consumeSelectedSub.consumedKilos).toFixed(1)} Kg de {consumeSelectedSub.totalKilos.toFixed(1)} Kg
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold leading-none">
                    <span className="text-indigo-900/60 uppercase">Vencimiento del plan:</span>
                    <span className="text-slate-600 font-mono font-bold">
                      {new Date(consumeSelectedSub.endDate).toLocaleDateString('es-PE')}
                    </span>
                  </div>
                </div>
              )}

              {/* Kilos weighed */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kilogramos Pesados (KG)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    required 
                    step="0.1"
                    min="0.1"
                    value={consumeKilos} 
                    onChange={e => setConsumeKilos(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 text-3xl font-black text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/15 font-mono"
                    placeholder="0.0"
                    autoFocus
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg select-none">KG</span>
                </div>
              </div>

              {/* Notes / Order reference link */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notas / Nro. de Órden de Venta</label>
                <input 
                  type="text"
                  value={consumeNotes}
                  onChange={e => setConsumeNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/15 uppercase text-xs"
                  placeholder="TIQUET #1029 - LAVADO DIARIO"
                />
              </div>

              <button 
                type="submit" 
                disabled={isSaving || !consumeSelectedSub}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-xl hover:-translate-y-0.5 active:translate-y-0 text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} strokeWidth={3} />}
                REGISTRAR CONSUMO DE KILOS
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Memberships;

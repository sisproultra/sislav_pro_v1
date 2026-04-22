import React, { useMemo, useState } from 'react';
import { 
  Activity, Clock, CheckCircle2, PackageCheck, AlertTriangle, 
  Users, BarChart3, Layers, Filter, RefreshCw, ArrowRight,
  TrendingUp, Timer, UserCheck, CheckCircle, PieChart as PieChartIcon,
  CalendarDays, ShoppingCart, Wallet, TrendingDown, Calendar,
  ChevronRight, Award, Briefcase, DollarSign, Cpu, Zap
} from 'lucide-react';
import { Invoice, Product, Client, Company, Expense, Category, PaymentMethodConfig, Employee, OrderStatus, Machine } from '../types';
import { roundToOneDecimal } from '../utils/calculations';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardProps {
  invoices: Invoice[];
  expenses: Expense[];
  products: Product[];
  clients: Client[];
  categories: Category[];
  paymentMethods: PaymentMethodConfig[];
  company: Company;
  employees: Employee[];
  machines: Machine[];
  onRefresh: () => void;
  onNavigateToPos: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  invoices = [], 
  expenses = [],
  clients = [],
  categories = [],
  paymentMethods = [],
  machines = [],
  company, 
  onRefresh, 
  onNavigateToPos,
}) => {
  const [viewMode, setViewMode] = useState<'operativo' | 'financiero'>('operativo');
  const primaryColor = company.primaryColor || '#6366f1';
  
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  // --- MÉTRICAS OPERATIVAS ---
  const operationalMetrics = useMemo(() => {
    const pendingToWash = invoices.filter(inv => inv.orderStatus === 'PENDIENTE' || inv.orderStatus === 'RECIBIDO' || inv.orderStatus === 'EN_LAVADO' || inv.orderStatus === 'EN_SECADO');
    const toDeliver = invoices.filter(inv => inv.orderStatus === 'LISTO' || inv.orderStatus === 'EN_RUTA');
    
    // Horario con mayor atención (Peak Hours)
    const hoursMap: Record<number, number> = {};
    invoices.forEach(inv => {
      const hour = new Date(inv.date).getHours();
      hoursMap[hour] = (hoursMap[hour] || 0) + 1;
    });
    const peakHoursData = Object.entries(hoursMap).map(([hour, count]) => ({
      hour: `${hour}:00`,
      count
    })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

    // Top 5 Categorías (Total en Dinero)
    const catMap: Record<string, number> = {};
    invoices.forEach(inv => {
      inv.items.forEach(item => {
        if (item.isAnulado || item.estado_id === 9) return;
        const cat = categories.find(c => c.id === item.categoria_id)?.name || 'Otros';
        catMap[cat] = (catMap[cat] || 0) + (item.subtotal || roundToOneDecimal(item.price * item.quantity));
      });
    });
    const topCategories = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Top 5 Clientes
    const clientMap: Record<string, { name: string, total: number }> = {};
    invoices.forEach(inv => {
      if (inv.client) {
        if (!clientMap[inv.client.id]) clientMap[inv.client.id] = { name: inv.client.name, total: 0 };
        clientMap[inv.client.id].total += inv.totals.total;
      }
    });
    const topClients = Object.values(clientMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // % Fidelización (clientes que lavaron en los últimos 30 días)
    const activeClientsCount = new Set(
      invoices
        .filter(inv => new Date(inv.date) >= thirtyDaysAgo)
        .map(inv => inv.client?.id)
        .filter(Boolean)
    ).size;
    const loyaltyRate = clients.length > 0 ? (activeClientsCount / clients.length) * 100 : 0;

    return { pendingToWash, toDeliver, peakHoursData, topCategories, topClients, loyaltyRate };
  }, [invoices, categories, clients, thirtyDaysAgo]);

  // --- MÉTRICAS FINANCIERAS ---
  const financialMetrics = useMemo(() => {
    const allMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const salesByYear: Record<string, number> = {};
    const salesByMonth: Record<string, number> = {};
    allMonths.forEach(m => salesByMonth[m] = 0);
    
    const currentDay = today.getDate();
    const monthNameShort = today.toLocaleString('es-ES', { month: 'short' }).replace('.', '');
    
    const salesByDay: Record<string, number> = {};
    const collectionsByDay: Record<string, number> = {};
    
    for (let i = 1; i <= currentDay; i++) {
      const label = `${i}-${monthNameShort}`;
      salesByDay[label] = 0;
      collectionsByDay[label] = 0;
    }

    const salesByDayOfWeek: Record<number, number> = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
    
    const daysNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    invoices.forEach(inv => {
      const d = new Date(inv.date);
      const year = d.getFullYear().toString();
      const monthIdx = d.getMonth();
      const month = allMonths[monthIdx];
      const day = d.getDate();
      const monthName = d.toLocaleString('es-ES', { month: 'short' }).replace('.', '');
      const dayLabel = `${day}-${monthName}`;
      const dow = d.getDay();

      salesByYear[year] = (salesByYear[year] || 0) + inv.totals.total;
      if (d.getFullYear() === today.getFullYear()) {
        salesByMonth[month] = (salesByMonth[month] || 0) + inv.totals.total;
      }
      
      if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
        salesByDay[dayLabel] = (salesByDay[dayLabel] || 0) + inv.totals.total;
        
        // Sumar pagos (si existen) o el total si es pago completo al momento
        const paidAmount = inv.payments?.reduce((sum, p) => sum + p.monto, 0) || inv.totals.total;
        collectionsByDay[dayLabel] = (collectionsByDay[dayLabel] || 0) + paidAmount;
      }
      
      salesByDayOfWeek[dow] += inv.totals.total;
    });

    const dowData = Object.entries(salesByDayOfWeek).map(([dow, total]) => ({ 
      name: daysNames[parseInt(dow)], 
      total 
    }));

    // Tabla comparativa de ventas por años y meses
    const allYears = Array.from(new Set(invoices.map(inv => new Date(inv.date).getFullYear()))).sort((a, b) => a - b);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    const comparisonData = months.map((m, mIdx) => {
      const row: any = { month: m };
      let rowTotal = 0;
      allYears.forEach(y => {
        const total = invoices
          .filter(inv => {
            const d = new Date(inv.date);
            return d.getFullYear() === y && d.getMonth() === mIdx;
          })
          .reduce((sum, inv) => sum + inv.totals.total, 0);
        row[y] = total;
        rowTotal += total;
      });
      row.totalGeneral = rowTotal;
      return row;
    }).filter(row => row.totalGeneral > 0);

    const yearTotals = allYears.map(y => {
      const total = invoices
        .filter(inv => new Date(inv.date).getFullYear() === y)
        .reduce((sum, inv) => sum + inv.totals.total, 0);
      return { year: y, total };
    });

    const winningYear = [...yearTotals].sort((a, b) => b.total - a.total)[0];
    const grandTotal = yearTotals.reduce((sum, y) => sum + y.total, 0);

    // Métricas de métodos de pago (usando pagos_venta / inv.payments)
    const paymentMethodsMap: Record<string, number> = {};
    invoices.forEach(inv => {
      if (inv.payments && inv.payments.length > 0) {
        inv.payments.forEach(p => {
          const method = paymentMethods.find(pm => pm.id === p.metodo_pago_id)?.name || 'Otros';
          paymentMethodsMap[method] = (paymentMethodsMap[method] || 0) + p.monto;
        });
      } else if (inv.paymentMethod) {
        paymentMethodsMap[inv.paymentMethod] = (paymentMethodsMap[inv.paymentMethod] || 0) + inv.totals.total;
      }
    });
    const paymentMethodsData = Object.entries(paymentMethodsMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { 
      yearData: Object.entries(salesByYear).map(([name, total]) => ({ name, total })).sort((a, b) => parseInt(a.name) - parseInt(b.name)),
      monthData: allMonths.map(m => ({ name: m, total: salesByMonth[m] })),
      dayData: Object.entries(salesByDay).map(([name, total]) => ({ name, total })),
      collectionData: Object.entries(collectionsByDay).map(([name, total]) => ({ name, total })),
      dowData,
      comparisonData,
      allYears,
      yearTotals,
      winningYear,
      grandTotal,
      paymentMethodsData
    };
  }, [invoices, today, paymentMethods]);

  // --- MÉTRICAS DE MÁQUINAS ---
  const machineMetrics = useMemo(() => {
    const washers = machines.filter(m => m.type === 'LAVADORA').sort((a, b) => (b.totalCycles || 0) - (a.totalCycles || 0));
    const dryers = machines.filter(m => m.type === 'SECADORA').sort((a, b) => (b.totalCycles || 0) - (a.totalCycles || 0));
    return { washers, dryers };
  }, [machines]);

  return (
    <div className="h-full bg-slate-50 p-4 md:p-8 pb-32 overflow-y-auto custom-scrollbar">
      {/* Header & View Selector */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2 tracking-tight uppercase">
              <Activity className="text-indigo-600" />
              Panel de Control
            </h1>
            <p className="text-slate-500 text-xs font-medium">Gestión inteligente de {company.razonSocial || 'Lavandería'}</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 self-start">
            <button 
              onClick={() => setViewMode('operativo')}
              className={`px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'operativo' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Briefcase size={14} />
              Operativo
            </button>
            <button 
              onClick={() => setViewMode('financiero')}
              className={`px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'financiero' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <DollarSign size={14} />
              Financiero
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'operativo' ? (
          <motion.div 
            key="operativo"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8"
          >
            {/* KPI Cards */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Pendientes Lavado</p>
                <h3 className="text-2xl font-black text-slate-900">{operationalMetrics.pendingToWash.length}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <PackageCheck size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Por Entregar</p>
                <h3 className="text-2xl font-black text-slate-900">{operationalMetrics.toDeliver.length}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Award size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Fidelización (30d)</p>
                <h3 className="text-2xl font-black text-slate-900">{operationalMetrics.loyaltyRate.toFixed(1)}%</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users size={24} />
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Total Clientes</p>
                <h3 className="text-2xl font-black text-slate-900">{clients.length}</h3>
              </div>
            </div>

            {/* Peak Hours Chart */}
            <div className="md:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                <Timer className="text-indigo-600" size={14} />
                Horarios de Mayor Atención
              </h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={operationalMetrics.peakHoursData}>
                    <defs>
                      <linearGradient id="colorPeak" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={primaryColor} stopOpacity={0.1}/>
                        <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area type="monotone" dataKey="count" stroke={primaryColor} strokeWidth={3} fillOpacity={1} fill="url(#colorPeak)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Categories */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                <Layers className="text-indigo-600" size={14} />
                Top 5 Categorías (Ventas S/)
              </h4>
              <div className="space-y-4">
                {operationalMetrics.topCategories.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400">
                        {i + 1}
                      </div>
                      <span className="text-sm text-slate-600 font-medium">{cat.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">S/ {cat.value.toFixed(2)}</span>
                  </div>
                ))}
                {operationalMetrics.topCategories.length === 0 && <p className="text-center text-slate-400 text-xs py-10">Sin datos</p>}
              </div>
            </div>

            {/* Top Clients */}
            <div className="md:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                <UserCheck className="text-indigo-600" size={14} />
                Top 5 Clientes (Ventas Totales)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {operationalMetrics.topClients.map((client, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Puesto #{i+1}</p>
                    <h5 className="text-sm font-bold text-slate-900 truncate mb-2">{client.name}</h5>
                    <p className="text-lg font-black text-slate-700">S/ {client.total.toFixed(2)}</p>
                  </div>
                ))}
                {operationalMetrics.topClients.length === 0 && <p className="col-span-5 text-center text-slate-400 text-xs py-10">Sin datos</p>}
              </div>
            </div>

            {/* Machine Status (Compact) */}
            <div className="md:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                <Cpu className="text-indigo-600" size={14} />
                Estado de Máquinas (Por Ciclos)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Washers */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" /> Lavadoras
                  </p>
                  <div className="space-y-2">
                    {machineMetrics.washers.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${m.estado_operativo === 'DISPONIBLE' ? 'bg-emerald-500' : m.estado_operativo === 'OCUPADO' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                          <div>
                            <p className="text-xs font-bold text-slate-700">{m.name}</p>
                            <p className="text-[9px] text-slate-400 font-medium uppercase">{m.capacityKg}kg • {m.estado_operativo}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-indigo-600">{m.totalCycles || 0}</p>
                          <p className="text-[8px] text-slate-400 uppercase font-bold">Ciclos</p>
                        </div>
                      </div>
                    ))}
                    {machineMetrics.washers.length === 0 && <p className="text-[10px] text-slate-400 italic">No hay lavadoras</p>}
                  </div>
                </div>

                {/* Dryers */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Secadoras
                  </p>
                  <div className="space-y-2">
                    {machineMetrics.dryers.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${m.estado_operativo === 'DISPONIBLE' ? 'bg-emerald-500' : m.estado_operativo === 'OCUPADO' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                          <div>
                            <p className="text-xs font-bold text-slate-700">{m.name}</p>
                            <p className="text-[9px] text-slate-400 font-medium uppercase">{m.capacityKg}kg • {m.estado_operativo}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-amber-600">{m.totalCycles || 0}</p>
                          <p className="text-[8px] text-slate-400 uppercase font-bold">Ciclos</p>
                        </div>
                      </div>
                    ))}
                    {machineMetrics.dryers.length === 0 && <p className="text-[10px] text-slate-400 italic">No hay secadoras</p>}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="financiero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Financial Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ventas por Día */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="text-emerald-500" size={14} />
                  Ventas por Día (Mes Actual)
                </h4>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialMetrics.dayData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} tickFormatter={(v) => `S/${v}`} />
                      <RechartsTooltip formatter={(v: any) => `S/ ${v.toFixed(2)}`} />
                      <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fontWeight: 'bold', fill: '#1e40af', formatter: (v: any) => v > 0 ? `S/${v.toFixed(0)}` : '' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recaudos por Día */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                  <DollarSign className="text-amber-500" size={14} />
                  Recaudos por Día (Mes Actual)
                </h4>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialMetrics.collectionData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} tickFormatter={(v) => `S/${v}`} />
                      <RechartsTooltip formatter={(v: any) => `S/ ${v.toFixed(2)}`} />
                      <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fontWeight: 'bold', fill: '#92400e', formatter: (v: any) => v > 0 ? `S/${v.toFixed(0)}` : '' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Day of Week Analysis */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="text-indigo-600" size={14} />
                    Análisis de Días de Mayor Venta
                  </h4>
                </div>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialMetrics.dowData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 9, fill: '#4338ca', fontWeight: 'bold', formatter: (v: any) => `S/${v.toFixed(0)}` }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Payment Methods Chart */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                  <PieChartIcon className="text-indigo-600" size={14} />
                  Distribución por Métodos de Pago
                </h4>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={financialMetrics.paymentMethodsData}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {financialMetrics.paymentMethodsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: number) => `S/ ${value.toFixed(2)}`}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {financialMetrics.paymentMethodsData.map((pm, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5] }} />
                      <span className="text-[10px] font-medium text-slate-600 truncate">{pm.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ventas por Mes */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-900 mb-6 uppercase tracking-widest">Ventas por Mes (Año Actual)</h4>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={financialMetrics.monthData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} tickFormatter={(v) => `S/${v}`} />
                      <RechartsTooltip formatter={(v: any) => `S/ ${v.toLocaleString()}`} />
                      <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Ventas por Año */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h4 className="text-[10px] font-bold text-slate-900 mb-6 uppercase tracking-widest">Histórico Anual</h4>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialMetrics.yearData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} tickFormatter={(v) => `S/${v}`} />
                      <RechartsTooltip formatter={(v: any) => `S/ ${v.toLocaleString()}`} />
                      <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fontWeight: 'bold', fill: '#4338ca', formatter: (v: any) => v > 0 ? `S/${v.toFixed(0)}` : '' }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Comparativo de Ventas Anual */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <BarChart3 className="text-indigo-600" size={14} />
                    Comparativo de Ventas Anual
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Análisis histórico por meses y años</p>
                </div>
                
                {financialMetrics.winningYear && (
                  <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <Award size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase leading-none tracking-widest">Periodo Ganador</p>
                      <p className="text-sm font-bold text-emerald-700">Año {financialMetrics.winningYear.year} <span className="text-[10px] font-medium opacity-80">(S/ {financialMetrics.winningYear.total.toLocaleString()})</span></p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6">
                <div className="h-[350px] mb-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialMetrics.comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => `S/ ${value.toLocaleString()}`}
                      />
                      {financialMetrics.allYears.map((year, idx) => (
                        <Bar 
                          key={year} 
                          dataKey={year.toString()} 
                          name={`Año ${year}`}
                          fill={[primaryColor, '#6ee7b7', '#fcd34d', '#f87171', '#a78bfa'][idx % 5]} 
                          radius={[4, 4, 0, 0]} 
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100 w-32">MES</th>
                        {financialMetrics.allYears.map(y => (
                          <th key={y} className="p-2 text-[10px] font-bold text-slate-500 uppercase text-right border-b border-slate-100">{y}</th>
                        ))}
                        <th className="p-2 text-[10px] font-bold text-indigo-600 uppercase text-right border-b border-slate-100 bg-indigo-50/30">Total general</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financialMetrics.comparisonData.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-2 text-xs font-bold text-slate-700 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            {row.month}
                          </td>
                          {financialMetrics.allYears.map(y => (
                            <td key={y} className="p-2 text-xs font-medium text-slate-600 text-right">
                              {row[y] > 0 ? row[y].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                            </td>
                          ))}
                          <td className="p-2 text-xs font-bold text-right text-slate-900 bg-indigo-50/10">
                            {row.totalGeneral.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-indigo-50/50">
                        <td className="p-2 text-xs font-black text-indigo-700 uppercase">Total general</td>
                        {financialMetrics.yearTotals.map(yt => (
                          <td key={yt.year} className="p-2 text-xs font-black text-indigo-700 text-right">
                            {yt.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        ))}
                        <td className="p-2 text-xs font-black text-white text-right bg-indigo-600">
                          {financialMetrics.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Expense History */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-900 mb-6 uppercase tracking-widest flex items-center gap-2">
                <TrendingDown className="text-rose-500" size={14} />
                Histórico de Egresos (Últimos 10)
              </h4>
              <div className="space-y-3">
                {expenses.slice(0, 10).map((exp, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-xs">
                        <Wallet size={14} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{exp.description}</p>
                        <p className="text-[10px] text-slate-400 uppercase">{exp.category} • {new Date(exp.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-rose-500">- S/ {exp.amount.toFixed(2)}</span>
                  </div>
                ))}
                {expenses.length === 0 && <p className="text-center text-slate-400 text-xs py-10">Sin gastos registrados</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;

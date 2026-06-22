import React, { useMemo, useState, useEffect } from 'react';
import { 
  Activity, Clock, CheckCircle2, PackageCheck, AlertTriangle, 
  Users, BarChart3, Layers, Filter, RefreshCw, ArrowRight,
  TrendingUp, Timer, UserCheck, CheckCircle, PieChart as PieChartIcon,
  CalendarDays, ShoppingCart, Wallet, TrendingDown, Calendar,
  ChevronRight, Award, Briefcase, DollarSign, Cpu, Zap, X, Search
} from 'lucide-react';
import { Invoice, Product, Client, Company, Expense, Category, PaymentMethodConfig, Employee, OrderStatus, Machine } from '../types';
import { roundToOneDecimal } from '../utils/calculations';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, Cell as BarCell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { dbGetDashboardReportData } from '../services/dbService';

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

const getPeruWallClockDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  let dateObj = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }
  
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(dateObj);
    const m = {} as any;
    parts.forEach(p => m[p.type] = p.value);
    
    return new Date(
      parseInt(m.year, 10),
      parseInt(m.month, 10) - 1,
      parseInt(m.day, 10),
      parseInt(m.hour, 10),
      parseInt(m.minute, 10),
      parseInt(m.second, 10)
    );
  } catch (e) {
    return dateObj;
  }
};

const parseSafeDate = (dateVal: any): Date => {
  if (dateVal instanceof Date) return dateVal;
  if (!dateVal) return new Date();
  
  if (typeof dateVal === 'string') {
    const cleaned = dateVal.trim();
    const hasTime = cleaned.includes('T') || cleaned.includes(':');
    
    if (!hasTime) {
      // 1. Si comienza con YYYY-MM-DD (e.g. "2026-05-30")
      const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);
        return new Date(year, month - 1, day, 12, 0, 0); // Mediodía local para evitar saltos de zona horaria
      }
      // 2. Si comienza con DD/MM/YYYY o DD-MM-YYYY
      const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10);
        const year = parseInt(dmyMatch[3], 10);
        return new Date(year, month - 1, day, 12, 0, 0);
      }
    }
  }
  return getPeruWallClockDate(dateVal);
};

const formatPeruDateTime = (dateVal: any) => {
  if (!dateVal) return '-';
  let dateObj: Date;
  if (dateVal instanceof Date) {
    dateObj = dateVal;
  } else if (typeof dateVal === 'string') {
    if ((dateVal.includes('T') || dateVal.includes(':')) && dateVal.length > 10) {
      dateObj = new Date(dateVal);
    } else {
      dateObj = parseSafeDate(dateVal);
    }
  } else {
    dateObj = new Date(dateVal);
  }

  if (isNaN(dateObj.getTime())) {
    return dateVal;
  }

  try {
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(dateObj);
  } catch (e) {
    return dateObj.toLocaleString();
  }
};

const Dashboard: React.FC<DashboardProps> = ({ 
  invoices = [], 
  expenses: propExpenses = [],
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
  
  // Helper para fechas locales
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Rango de fechas - Por defecto últimos 7 días como pidió el usuario
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  
  const [startDate, setStartDate] = useState(getLocalDateString(sevenDaysAgo));
  const [endDate, setEndDate] = useState(getLocalDateString(new Date()));
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  
  // Datos locales del dashboard (para el rango seleccionado)
  const [reportData, setReportData] = useState<{
    invoices: Invoice[],
    payments: any[],
    expenses: Expense[]
  }>({ invoices: [], payments: [], expenses: [] });

  // Modal de detalles por día
  const [showDayDetails, setShowDayDetails] = useState(false);
  const [drillDownType, setDrillDownType] = useState<'NONE' | 'SALES' | 'COLLECTED'>('NONE');
  const [dayDetails, setDayDetails] = useState<{
    date: string,
    salesCount: number,
    totalSales: number,
    totalCollected: number,
    payments: any[],
    invoices?: Invoice[]
  } | null>(null);

  const fetchDashboardData = async () => {
    setIsLoadingData(true);
    try {
      const data = await dbGetDashboardReportData(startDate, endDate);
      setReportData(data);
      setHasFetched(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [startDate, endDate]);

  // Usamos estrictamente los datos del reporte si ya se hizo el fetch
  const currentInvoices = hasFetched ? reportData.invoices : invoices;
  const currentExpenses = hasFetched ? reportData.expenses : propExpenses;
  const currentPayments = reportData.payments;

  // Helper para etiquetas consistentes
  const getDayLabel = (dateObj: Date) => {
    const day = dateObj.getDate();
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${day}-${months[dateObj.getMonth()]}`;
  };

  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  // --- MÉTRICAS OPERATIVAS ---
  const operationalMetrics = useMemo(() => {
    const activeInvoices = currentInvoices.filter(inv => {
      const isSalesDoc = inv.type === '01' || inv.type === '03' || inv.type === '80'; // FACTURA, BOLETA, NOTA_VENTA
      const isCancelled = inv.orderStatus === 'CANCELADO' || (inv as any).status === 'anulado' || inv.status === 'anulado';
      return isSalesDoc && !isCancelled;
    });
    const pendingToWash = activeInvoices.filter(inv => inv.orderStatus === 'PENDIENTE' || inv.orderStatus === 'RECIBIDO' || inv.orderStatus === 'EN_LAVADO' || inv.orderStatus === 'EN_SECADO');
    const toDeliver = activeInvoices.filter(inv => inv.orderStatus === 'LISTO' || inv.orderStatus === 'EN_RUTA');
    
    // Horario con mayor atención (Peak Hours)
    const hoursMap: Record<number, number> = {};
    activeInvoices.forEach(inv => {
      const hour = parseSafeDate(inv.date).getHours();
      hoursMap[hour] = (hoursMap[hour] || 0) + 1;
    });
    const peakHoursData = Object.entries(hoursMap).map(([hour, count]) => ({
      hour: `${hour}:00`,
      count
    })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

    // Top 5 Categorías (Total en Dinero)
    const catMap: Record<string, number> = {};
    activeInvoices.forEach(inv => {
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
    activeInvoices.forEach(inv => {
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
      activeInvoices
        .filter(inv => parseSafeDate(inv.date) >= thirtyDaysAgo)
        .map(inv => inv.client?.id)
        .filter(Boolean)
    ).size;
    const loyaltyRate = clients.length > 0 ? (activeClientsCount / clients.length) * 100 : 0;

    return { pendingToWash, toDeliver, peakHoursData, topCategories, topClients, loyaltyRate };
  }, [invoices, categories, clients, thirtyDaysAgo]);

  // --- MÉTRICAS FINANCIERAS ---
  const financialMetrics = useMemo(() => {
    // Solo boletas, facturas, notas de venta que NO estén anulados
    const validSalesInvoices = currentInvoices.filter(inv => {
      const isSalesDoc = inv.type === '01' || inv.type === '03' || inv.type === '80'; // FACTURA, BOLETA, NOTA_VENTA
      const isCancelled = inv.orderStatus === 'CANCELADO' || (inv as any).status === 'anulado' || inv.status === 'anulado';
      return isSalesDoc && !isCancelled;
    });

    const salesByYear: Record<string, number> = {};
    const allMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const salesByMonth: Record<string, number> = {};
    allMonths.forEach(m => salesByMonth[m] = 0);
    
    // Generar etiquetas de días para el rango seleccionado
    const salesByDay: Record<string, number> = {};
    const collectionsByDay: Record<string, number> = {};
    const dayPaymentsMap: Record<string, any[]> = {};
    
    const start = new Date(startDate + 'T12:00:00'); // Evitar saltos de día por TZ
    const end = new Date(endDate + 'T12:00:00');
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= diffDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dayLabel = getDayLabel(d);
        salesByDay[dayLabel] = 0;
        collectionsByDay[dayLabel] = 0;
        dayPaymentsMap[dayLabel] = [];
    }

    const salesByDayOfWeek: Record<number, number> = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
    const daysNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    // 1. Procesar Ventas del rango (excluyendo NOTAs DE CRÉDITO y anulaciones)
    validSalesInvoices.forEach(inv => {
      const d = parseSafeDate(inv.date);
      const year = d.getFullYear().toString();
      const monthIdx = d.getMonth();
      const month = allMonths[monthIdx];
      const dayLabel = getDayLabel(d);
      const dow = d.getDay();

      salesByYear[year] = (salesByYear[year] || 0) + inv.totals.total;
      if (salesByMonth[month] !== undefined) {
        salesByMonth[month] += inv.totals.total;
      }
      
      if (salesByDay[dayLabel] !== undefined) {
        salesByDay[dayLabel] += inv.totals.total;
      }
      
      salesByDayOfWeek[dow] += inv.totals.total;
    });

    // 2. Procesar Recaudos (Pagos) - DESDE pagos_venta
    currentPayments.forEach(p => {
        const d = parseSafeDate(p.fecha_pago);
        const dayLabel = getDayLabel(d);
        
        if (collectionsByDay[dayLabel] !== undefined) {
            collectionsByDay[dayLabel] += p.monto;
            dayPaymentsMap[dayLabel].push(p);
        }
    });

    const dowData = Object.entries(salesByDayOfWeek).map(([dow, total]) => ({ 
      name: daysNames[parseInt(dow)], 
      total 
    }));

    // Métricas de métodos de pago
    const paymentMethodsMap: Record<string, number> = {};
    currentPayments.forEach(p => {
        const method = p.metodo_pago_name || 'Otros';
        paymentMethodsMap[method] = (paymentMethodsMap[method] || 0) + p.monto;
    });
    
    const paymentMethodsData = Object.entries(paymentMethodsMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Tabla comparativa de ventas por años y meses
    const allYears = Array.from(new Set(validSalesInvoices.map(inv => parseSafeDate(inv.date).getFullYear()))).sort((a, b) => a - b);
    const monthsNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    const comparisonData = monthsNames.map((m, mIdx) => {
      const row: any = { month: m };
      let rowTotal = 0;
      allYears.forEach(y => {
        const total = validSalesInvoices
          .filter(inv => {
            const d = parseSafeDate(inv.date);
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
      const total = validSalesInvoices
        .filter(inv => parseSafeDate(inv.date).getFullYear() === y)
        .reduce((sum, inv) => sum + inv.totals.total, 0);
      return { year: y, total };
    });

    const winningYear = [...yearTotals].sort((a, b) => b.total - a.total)[0];

    return { 
      yearData: Object.entries(salesByYear).map(([name, total]) => ({ name, total })).sort((a, b) => parseInt(a.name) - parseInt(b.name)),
      monthData: allMonths.map(m => ({ name: m, total: salesByMonth[m] })),
      dayData: Object.entries(salesByDay).map(([name, total]) => ({ name, total })),
      collectionData: Object.entries(collectionsByDay).map(([name, total]) => ({ name, total })),
      dayPaymentsMap,
      dowData,
      paymentMethodsData,
      comparisonData,
      allYears,
      yearTotals,
      winningYear,
      grandTotal: validSalesInvoices.reduce((sum, inv) => sum + inv.totals.total, 0),
      validSalesInvoices
    };
  }, [currentInvoices, currentPayments, startDate, endDate]);

  const handleChartClick = (data: any) => {
    if (!data || !data.activeLabel) return;
    
    const dayLabel = data.activeLabel;
    const payments = financialMetrics.dayPaymentsMap[dayLabel] || [];
    const salesTotal = financialMetrics.dayData.find(d => d.name === dayLabel)?.total || 0;
    const collectedTotal = financialMetrics.collectionData.find(d => d.name === dayLabel)?.total || 0;
    const matchingInvoices = financialMetrics.validSalesInvoices.filter(inv => getDayLabel(parseSafeDate(inv.date)) === dayLabel);
    
    setDrillDownType('NONE');
    setDayDetails({
      date: dayLabel,
      salesCount: matchingInvoices.length,
      totalSales: salesTotal,
      totalCollected: collectedTotal,
      payments: payments,
      invoices: matchingInvoices
    });
    setShowDayDetails(true);
  };

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
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2 tracking-tight uppercase">
                <Activity className="text-indigo-600" />
                Panel de Control
              </h1>
              <p className="text-slate-500 text-xs font-medium">Gestional inteligente de {company.razonSocial || 'Lavandería'}</p>
            </div>

            {/* Filtro de Rango de Fechas */}
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
               <div className="flex items-center gap-1">
                  <Calendar size={14} className="text-slate-400" />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-[10px] font-bold border-none focus:ring-0 p-0 w-24 bg-transparent"
                  />
               </div>
               <span className="text-slate-300">|</span>
               <div className="flex items-center gap-1">
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-[10px] font-bold border-none focus:ring-0 p-0 w-24 bg-transparent"
                  />
               </div>
               {isLoadingData && <RefreshCw size={12} className="animate-spin text-indigo-600" />}
            </div>
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
                    <BarChart data={financialMetrics.dayData} onClick={handleChartClick}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} tickFormatter={(v) => `S/${v}`} />
                      <RechartsTooltip cursor={{fill: '#f1f5f9'}} formatter={(v: any) => `S/ ${v.toFixed(2)}`} />
                      <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fontWeight: 'bold', fill: '#1e40af', formatter: (v: any) => v > 0 ? `S/${v.toFixed(0)}` : '' }}>
                        {financialMetrics.dayData.map((entry, index) => (
                           <BarCell key={`cell-${index}`} style={{ cursor: 'pointer' }} />
                        ))}
                      </Bar>
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
                    <BarChart data={financialMetrics.collectionData} onClick={handleChartClick}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9}} tickFormatter={(v) => `S/${v}`} />
                      <RechartsTooltip cursor={{fill: '#f1f5f9'}} formatter={(v: any) => `S/ ${v.toFixed(2)}`} />
                      <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fontWeight: 'bold', fill: '#92400e', formatter: (v: any) => v > 0 ? `S/${v.toFixed(0)}` : '' }}>
                        {financialMetrics.collectionData.map((entry, index) => (
                           <BarCell key={`cell-${index}`} style={{ cursor: 'pointer' }} />
                        ))}
                      </Bar>
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
                {currentExpenses.slice(0, 10).map((exp, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-xs">
                        <Wallet size={14} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{exp.description}</p>
                        <p className="text-[10px] text-slate-400 uppercase">{exp.category} • {exp.date ? parseSafeDate(exp.date).toLocaleDateString() : '-'}</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-rose-500">- S/ {exp.amount.toFixed(2)}</span>
                  </div>
                ))}
                {currentExpenses.length === 0 && <p className="text-center text-slate-400 text-xs py-10">Sin gastos registrados</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDayDetails && dayDetails && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
               initial={{ scale: 0.95, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.95, opacity: 0 }}
               className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Detalle: {dayDetails.date}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Resumen de movimientos del día</p>
                </div>
                <button onClick={() => setShowDayDetails(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div 
                      onClick={() => setDrillDownType(drillDownType === 'SALES' ? 'NONE' : 'SALES')}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative overflow-hidden group ${
                        drillDownType === 'SALES' 
                          ? 'bg-blue-50/60 border-blue-200 ring-2 ring-blue-100 shadow-sm' 
                          : 'bg-slate-50 border-slate-100 hover:bg-slate-100/80 hover:border-slate-200'
                      }`}
                   >
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center justify-between">
                        <span>Ventas Totales</span>
                        <span className="text-[9px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Ver lista</span>
                      </p>
                      <h4 className="text-xl font-black text-blue-600">S/ {dayDetails.totalSales.toFixed(2)}</h4>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">{dayDetails.salesCount} Órdenes</p>
                   </div>
                   <div 
                      onClick={() => setDrillDownType(drillDownType === 'COLLECTED' ? 'NONE' : 'COLLECTED')}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer select-none relative overflow-hidden group ${
                        drillDownType === 'COLLECTED' 
                          ? 'bg-amber-50/60 border-amber-200 ring-2 ring-amber-100 shadow-sm' 
                          : 'bg-slate-50 border-slate-100 hover:bg-slate-100/80 hover:border-slate-200'
                      }`}
                   >
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center justify-between">
                        <span>Total Recaudado</span>
                        <span className="text-[9px] font-bold text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">Ver lista</span>
                      </p>
                      <h4 className="text-xl font-black text-amber-600">S/ {dayDetails.totalCollected.toFixed(2)}</h4>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">{dayDetails.payments.length} Pagos</p>
                   </div>
                </div>

                                 {drillDownType === 'NONE' && (
                   <div>
                      <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <DollarSign size={14} className="text-indigo-600" />
                        Desglose por Métodos de Pago
                      </h5>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                         {Object.entries(
                           dayDetails.payments.reduce((acc: any, p: any) => {
                             const mName = p.metodo_pago_name || 'Otros';
                             if (!acc[mName]) acc[mName] = { total: 0, count: 0 };
                             acc[mName].total += p.monto;
                             acc[mName].count += 1;
                             return acc;
                           }, {})
                         ).map(([mName, stats]: [string, any], i) => (
                           <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-shadow">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                    <Wallet size={16} className="text-indigo-600" />
                                 </div>
                                 <span className="text-xs font-bold text-slate-700">{mName}</span>
                              </div>
                              <div className="text-right">
                                 <p className="text-sm font-black text-slate-900">S/ {stats.total.toFixed(2)}</p>
                                 <p className="text-[9px] font-medium text-slate-400 uppercase">{stats.count} Movimientos</p>
                              </div>
                           </div>
                         ))}

                         {dayDetails.payments.length === 0 && (
                           <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                              <DollarSign size={24} className="mx-auto text-slate-300 mb-2" />
                              <p className="text-xs font-medium text-slate-400">No se registraron recaudos este día</p>
                           </div>
                         )}
                      </div>
                   </div>
                 )}

                 {drillDownType === 'SALES' && (
                   <div>
                      <div className="flex items-center justify-between mb-4">
                         <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                           <ShoppingCart size={14} className="text-blue-600" />
                           Detalle de Ventas ({dayDetails.invoices?.length || 0})
                         </h5>
                         <button 
                           onClick={() => setDrillDownType('NONE')}
                           className="text-[9px] font-bold text-indigo-600 hover:underline uppercase tracking-wider animate-pulse"
                         >
                           Volver al desglose
                         </button>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                         {(dayDetails.invoices || []).map((inv, idx) => (
                           <div key={idx} className="p-3 bg-white border border-slate-100 rounded-xl hover:shadow-xs transition-shadow">
                             <div className="flex justify-between items-start gap-2 mb-1.5">
                               <div>
                                 <span className="text-xs font-black text-slate-950 block">{inv.ticketNumber || inv.ordenNumber || (inv.serie && inv.correlativo ? `${inv.serie}-${String(inv.correlativo).padStart(8, '0')}` : 'S/N')}</span>
                                 <span className="text-[10px] text-slate-400 font-bold uppercase">{formatPeruDateTime(inv.date)}</span>
                               </div>
                               <span className="text-sm font-black text-blue-600">
                                 S/ {Number(inv.totals?.total || 0).toFixed(2)}
                               </span>
                             </div>
                             <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium bg-slate-50/50 p-1.5 rounded-lg border border-slate-100/50">
                               <span className="text-slate-400">Clie:</span>
                               <span className="text-slate-700 font-bold truncate max-w-[280px]">{inv.client?.name || 'Cliente Genérico'}</span>
                             </div>
                           </div>
                         ))}
                         {(dayDetails.invoices || []).length === 0 && (
                           <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                              <p className="text-xs font-medium text-slate-400">No se registraron ventas este día</p>
                           </div>
                         )}
                      </div>
                   </div>
                 )}

                 {drillDownType === 'COLLECTED' && (
                   <div>
                      <div className="flex items-center justify-between mb-4">
                         <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                           <Wallet size={14} className="text-amber-600" />
                           Detalle de Recaudos ({dayDetails.payments.length})
                         </h5>
                         <button 
                           onClick={() => setDrillDownType('NONE')}
                           className="text-[9px] font-bold text-indigo-600 hover:underline uppercase tracking-wider animate-pulse"
                         >
                           Volver al desglose
                         </button>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                         {dayDetails.payments.map((p, idx) => (
                           <div key={idx} className="p-3 bg-white border border-slate-100 rounded-xl hover:shadow-xs transition-shadow">
                             <div className="flex justify-between items-start gap-2 mb-1.5">
                               <div>
                                 <span className="text-xs font-black text-slate-950 block">{p.venta_codigo || p.ventas?.codigo_orden || 'S/N'}</span>
                                 <span className="text-[10px] text-slate-400 font-bold uppercase">{formatPeruDateTime(p.fecha_pago)}</span>
                               </div>
                               <div className="text-right">
                                 <span className="text-sm font-black text-amber-600 block">
                                   S/ {Number(p.monto).toFixed(2)}
                                 </span>
                                 <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                   {p.metodo_pago_name || 'Otros'}
                                 </span>
                               </div>
                             </div>
                             <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium bg-slate-50/50 p-1.5 rounded-lg border border-slate-100/50">
                               <span className="text-slate-400">Cliente:</span>
                               <span className="text-slate-700 font-bold truncate max-w-[280px]">{p.cliente_nombre || 'Cliente Genérico'}</span>
                             </div>
                           </div>
                         ))}
                         {dayDetails.payments.length === 0 && (
                           <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                              <p className="text-xs font-medium text-slate-400">No se registraron recaudos este día</p>
                           </div>
                         )}
                      </div>
                   </div>
                 )}

              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowDayDetails(false)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;

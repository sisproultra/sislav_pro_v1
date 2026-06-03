
import React, { useState, useMemo, useEffect } from 'react';
import { 
    FileBarChart, Search, Download, Printer, Calendar, 
    TrendingDown, ArrowRight, Table as TableIcon, Filter,
    CheckCircle2, AlertCircle, FileText, ChevronRight,
    TrendingUp, BadgeDollarSign, PieChart as PieChartIcon,
    Users, ShoppingBag, Layers, Target, Clock, Star,
    CreditCard, BarChart2, Activity, Shirt, ArrowUpRight, Trophy, PackageCheck, Info
} from 'lucide-react';
import { Expense, Company, Invoice, Client, InvoiceType, PaymentMethodConfig } from '../types';
import { dbGetPaymentsReport } from '../services/dbService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';

interface ReportsProps {
    expenses: Expense[];
    invoices: Invoice[];
    clients: Client[];
    company: Company;
    paymentMethods: PaymentMethodConfig[];
}

// FIX: Updated 'CLIENTES' to 'CLIENTS' to match the IDs used in the code
type ReportSubModule = 'VENTAS' | 'EGRESOS' | 'CLIENTS' | 'ESTADOS';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f43f5e', '#3b82f6'];

const Reports: React.FC<ReportsProps> = ({ expenses, invoices, clients, company, paymentMethods }) => {
    const [activeTab, setActiveTab] = useState<ReportSubModule>('VENTAS');
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = useState(false);

    // --- FETCH PAYMENTS IN RANGE ---
    useEffect(() => {
        const fetchPayments = async () => {
            setIsLoadingPayments(true);
            try {
                const data = await dbGetPaymentsReport(startDate, endDate);
                setPayments(data);
            } catch (err) {
                console.error("Error fetching payments report in Reports:", err);
            } finally {
                setIsLoadingPayments(false);
            }
        };
        fetchPayments();
    }, [startDate, endDate]);
    
    const currency = company.currencySymbol || 'S/';
    const primaryColor = document.documentElement.style.getPropertyValue('--primary-color') || '#4f46e5';

    // --- FILTRADO COMÚN POR FECHAS ---
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const date = inv.date.split('T')[0];
            return date >= startDate && date <= endDate;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [invoices, startDate, endDate]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            return exp.date >= startDate && exp.date <= endDate;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [expenses, startDate, endDate]);

    // --- CÁLCULOS SUB-MÓDULO VENTAS ---
    const salesStats = useMemo(() => {
        const total = filteredInvoices.reduce((sum, inv) => sum + inv.totals.total, 0);
        const collected = filteredInvoices.reduce((sum, inv) => sum + (inv.prePaymentAmount || 0), 0);
        const boletas = filteredInvoices.filter(i => i.type === InvoiceType.BOLETA).length;
        const facturas = filteredInvoices.filter(i => i.type === InvoiceType.FACTURA).length;
        const notasVenta = filteredInvoices.filter(i => i.type === InvoiceType.NOTA_VENTA).length;

        return { total, collected, boletas, facturas, notasVenta };
    }, [filteredInvoices]);

    // --- CÁLCULOS SUB-MÓDULO EGRESOS ---
    const expenseStats = useMemo(() => {
        const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const categories = filteredExpenses.reduce((acc, e) => {
            const cat = e.category || 'GENERAL';
            acc[cat] = (acc[cat] || 0) + e.amount;
            return acc;
        }, {} as Record<string, number>);

        return { total, categories };
    }, [filteredExpenses]);

    // --- CÁLCULOS SUB-MÓDULO CLIENTES ---
    const clientStats = useMemo(() => {
        const map = new Map();
        filteredInvoices.forEach(inv => {
            const current = map.get(inv.client.name) || { total: 0, orders: 0 };
            map.set(inv.client.name, { total: current.total + inv.totals.total, orders: current.orders + 1 });
        });
        const topClients = Array.from(map.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        return { topClients, totalActive: map.size };
    }, [filteredInvoices]);

    // --- CÁLCULOS SUB-MÓDULO ESTADOS ---
    const statusStats = useMemo(() => {
        const counts: Record<string, number> = { PENDING: 0, READY: 0, DELIVERED: 0, IN_ROUTE_DELIVERY: 0 };
        filteredInvoices.forEach(inv => {
            const s = inv.orderStatus || 'PENDING';
            if (counts[s] !== undefined) counts[s]++;
            else if (['WASHING', 'DRYING'].includes(s)) counts['PENDING']++;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredInvoices]);

    // --- ACCIONES DE EXPORTACIÓN ---
    const handleExport = () => {
        let dataToExport: any[] = [];
        let fileName = "";

        if (activeTab === 'VENTAS') {
            dataToExport = payments.map(p => ({
                'FECHA COBRO': p.date ? new Date(p.date).toLocaleString('es-PE') : '---',
                'TICKET/CORRELATIVO': p.ticket,
                'CLIENTE': p.clientName,
                'MONTO PAGADO': p.amount,
                'MÉTODO DE PAGO': p.methodName || 'OTROS'
            }));
            fileName = `REPORTE_INGRESOS_COBROS_${startDate}_${endDate}`;
        } else if (activeTab === 'EGRESOS') {
            dataToExport = filteredExpenses.map(e => ({
                'FECHA': e.date,
                'DESCRIPCIÓN': e.description,
                'CATEGORÍA': e.category,
                'MÉTODO': e.paymentMethod,
                'MONTO': e.amount.toFixed(2)
            }));
            fileName = `REPORTE_EGRESOS_${startDate}_${endDate}`;
        }

        if (dataToExport.length === 0) return alert("Sin datos en el rango seleccionado.");

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    };

    return (
        <div className="p-6 lg:p-10 h-full overflow-y-auto bg-slate-50 custom-scrollbar animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* 1. HEADER & GLOBAL FILTERS */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 text-indigo-600 font-bold text-xs uppercase tracking-[0.3em] mb-2">
                            <FileBarChart size={16} /> Inteligencia de Negocios
                        </div>
                        <h2 className="text-4xl font-bold text-slate-900 tracking-tight uppercase leading-none">Reportes Consolidados</h2>
                        <p className="text-slate-500 font-medium">Analítica avanzada de su operación local.</p>
                    </div>

                    <div className="flex flex-wrap gap-3 bg-white p-3 rounded-[2.5rem] border border-slate-200 shadow-sm w-full md:w-auto">
                        <div className="flex items-center gap-4 px-5 border-r border-slate-100 flex-1 md:flex-none">
                            <Calendar className="text-indigo-500" size={20} />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Desde</span>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-sm font-bold outline-none text-slate-700 cursor-pointer" />
                            </div>
                        </div>
                        <div className="flex items-center gap-4 px-5 flex-1 md:flex-none">
                            <ArrowRight className="text-slate-300" size={16} />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hasta</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-sm font-bold outline-none text-slate-700 cursor-pointer" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. SUB-MODULE NAVIGATION */}
                <div className="flex overflow-x-auto no-scrollbar bg-white p-2 rounded-[2rem] border border-slate-200 shadow-sm gap-2">
                    {[
                        { id: 'VENTAS', label: 'Ingresos', icon: BadgeDollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        { id: 'EGRESOS', label: 'Egresos', icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50' },
                        { id: 'CLIENTS', label: 'Clientes', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                        { id: 'ESTADOS', label: 'Operativo', icon: Activity, color: 'text-sky-600', bg: 'bg-sky-50' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-bold text-[11px] uppercase tracking-widest transition-all whitespace-nowrap ${
                                activeTab === tab.id 
                                ? `${tab.bg} ${tab.color} shadow-inner scale-[0.98]` 
                                : 'hover:bg-slate-50 text-slate-400'
                            }`}
                        >
                            <tab.icon size={18} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* 3. SUB-MODULE CONTENT */}
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                    
                    {/* --- VENTAS --- */}
                    {activeTab === 'VENTAS' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><BadgeDollarSign size={120} /></div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Ingresos Brutos</p>
                                    <h4 className="text-5xl font-bold text-slate-900 tabular-nums leading-none">{currency} {salesStats.total.toFixed(2)}</h4>
                                    <p className="text-[11px] font-bold text-emerald-500 uppercase mt-6 tracking-widest flex items-center gap-2">
                                        <ArrowUpRight size={16} /> Total de ventas emitidas
                                    </p>
                                </div>
                                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Efectivo en Caja (Cobradores)</p>
                                    <h4 className="text-5xl font-bold text-indigo-600 tabular-nums leading-none">{currency} {salesStats.collected.toFixed(2)}</h4>
                                    <div className="mt-6 flex gap-2">
                                        <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[9px] font-bold uppercase">Boletas: {salesStats.boletas}</span>
                                        <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[9px] font-bold uppercase">Facturas: {salesStats.facturas}</span>
                                    </div>
                                </div>
                                <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform"><CheckCircle2 size={120} /></div>
                                    <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-4">Total Comprobantes</p>
                                    <h4 className="text-6xl font-bold tabular-nums leading-none">{filteredInvoices.length}</h4>
                                    <button onClick={handleExport} className="mt-6 bg-white text-slate-900 px-8 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-lg active:scale-95 flex items-center gap-2">
                                        <Download size={14} /> Descargar Reporte Excel
                                    </button>
                                </div>
                            </div>

                            {/* Detailed Income Table */}
                            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-w-0">
                                <div className="p-8 bg-slate-50 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-xs uppercase text-slate-700 flex items-center gap-3">
                                            <TableIcon size={18} /> Detalle de Cobros Realizados
                                        </h3>
                                        <p className="text-[11px] font-medium text-slate-400">Todos los cobros recibidos en el período de fechas seleccionado.</p>
                                    </div>
                                    <button 
                                        onClick={handleExport} 
                                        className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        <Download size={14} /> Exportar Cobros Excel
                                    </button>
                                </div>
                                
                                {isLoadingPayments ? (
                                    <div className="p-16 flex flex-col items-center justify-center gap-3">
                                        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin"></div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargando cobros...</p>
                                    </div>
                                ) : payments.length === 0 ? (
                                    <div className="p-16 text-center text-slate-500 font-medium text-xs">
                                        No se encontraron cobros registrados en este rango de fechas.
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b bg-slate-50/50">
                                                    <th className="p-6">Fecha/Hora Cobro</th>
                                                    <th className="p-6">Ticket</th>
                                                    <th className="p-6">Nombre del Cliente</th>
                                                    <th className="p-6">Método de Pago</th>
                                                    <th className="p-6 text-right">Monto Pagado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 text-xs">
                                                {payments.map((p, idx) => (
                                                    <tr key={p.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-6 font-bold text-slate-500 whitespace-nowrap">
                                                            {p.date ? new Date(p.date).toLocaleString('es-PE') : '---'}
                                                        </td>
                                                        <td className="p-6 font-bold text-slate-800 uppercase">
                                                            <span className="bg-slate-100 px-3 py-1 rounded-full font-bold text-[10px] text-slate-600">
                                                                {p.ticket || '---'}
                                                            </span>
                                                        </td>
                                                        <td className="p-6 font-semibold uppercase text-slate-700">
                                                            {p.clientName}
                                                        </td>
                                                        <td className="p-6">
                                                            <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold uppercase text-[9px]">
                                                                {p.methodName || 'OTROS'}
                                                            </span>
                                                        </td>
                                                        <td className="p-6 text-right font-black text-emerald-600 text-sm">
                                                            {currency} {p.amount.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- EGRESOS --- */}
                    {activeTab === 'EGRESOS' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-4 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
                                    <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 border border-rose-100 mb-8 shadow-inner">
                                        <TrendingDown size={32} />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Total Egresos</p>
                                    <h4 className="text-5xl font-bold text-slate-900 tabular-nums leading-none">{currency} {expenseStats.total.toFixed(2)}</h4>
                                    <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                                        {Object.entries(expenseStats.categories).map(([name, amount], idx) => (
                                            <div key={idx} className="flex justify-between items-center group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-slate-900 transition-colors">{name}</span>
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">{currency} {(amount as number).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="lg:col-span-8 bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-w-0">
                                    <div className="p-8 bg-slate-50 border-b flex justify-between items-center">
                                        <h3 className="font-bold text-xs uppercase text-slate-700 flex items-center gap-3"><TableIcon size={18} /> Detalle de Egresos</h3>
                                        <button onClick={handleExport} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-emerald-50 text-emerald-600 transition-all shadow-sm">
                                            <Download size={18} />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b">
                                                    <th className="p-6">Fecha</th>
                                                    <th className="p-6">Descripción</th>
                                                    <th className="p-6">Categoría</th>
                                                    <th className="p-6 text-right">Importe</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 text-xs">
                                                {filteredExpenses.map((exp, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-6 font-bold text-slate-500">{exp.date}</td>
                                                        <td className="p-6 font-bold uppercase text-slate-800">{exp.description}</td>
                                                        <td className="p-6">
                                                            <span className="bg-slate-100 px-3 py-1 rounded-full font-bold uppercase text-[9px] text-slate-500">{exp.category}</span>
                                                        </td>
                                                        <td className="p-6 text-right font-bold text-rose-600 text-sm">-{currency} {exp.amount.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- CLIENTES --- */}
                    {/* FIX: Corrected comparison string to match type ReportSubModule */}
                    {activeTab === 'CLIENTS' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm min-w-0">
                                <h3 className="text-xl font-bold uppercase tracking-tight mb-8 flex items-center gap-3">
                                    <Trophy className="text-amber-500" size={24} /> Top 10 Clientes
                                </h3>
                                <div className="space-y-6">
                                    {clientStats.topClients.map((client, idx) => (
                                        <div key={idx} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-5">
                                                <span className="text-3xl font-bold text-slate-100 group-hover:text-indigo-100 transition-colors">#{idx + 1}</span>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm uppercase text-slate-800 truncate">{client.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{client.orders} Ordenes</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-indigo-600 text-lg tabular-nums">{currency} {client.total.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-indigo-900 text-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center justify-center text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12"><Users size={200} /></div>
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-indigo-300 mb-6 relative z-10">Captación en Periodo</h3>
                                <h4 className="text-8xl font-bold tracking-tight mb-2 relative z-10">{clientStats.totalActive}</h4>
                                <p className="text-sm font-bold uppercase tracking-widest text-indigo-200 relative z-10">Clientes Atendidos</p>
                                <div className="mt-12 bg-white/10 backdrop-blur-md px-8 py-4 rounded-3xl border border-white/10 relative z-10">
                                    <p className="text-[10px] font-bold uppercase opacity-60">Ticket Promedio Global</p>
                                    <p className="text-3xl font-bold uppercase mt-1 tabular-nums">{currency} {(salesStats.total / (filteredInvoices.length || 1)).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- ESTADOS --- */}
                    {activeTab === 'ESTADOS' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col items-center min-w-0">
                                <h3 className="text-xl font-bold uppercase tracking-tight w-full mb-10 flex justify-between items-center">
                                    Distribución Operativa
                                    <Activity className="text-sky-500" size={24} />
                                </h3>
                                <div className="w-full h-80 min-h-[320px] relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={statusStats}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={80}
                                                outerRadius={110}
                                                paddingAngle={8}
                                                dataKey="value"
                                            >
                                                {statusStats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip 
                                                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                                                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="grid grid-cols-2 gap-4 w-full mt-8">
                                    {statusStats.map((s, i) => (
                                        <div key={i} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 min-w-0">
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                            <div className="min-w-0">
                                                <p className="text-[8px] font-bold text-slate-400 uppercase truncate">{s.name}</p>
                                                <p className="text-sm font-bold text-slate-800 tabular-nums">{s.value} Unid.</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-emerald-600 text-white p-10 rounded-[3rem] shadow-xl flex items-center justify-between group overflow-hidden">
                                    <div className="space-y-2 relative z-10">
                                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Órdenes Entregadas</p>
                                        <h4 className="text-6xl font-bold tabular-nums">{statusStats.find(s=>s.name==='DELIVERED')?.value || 0}</h4>
                                    </div>
                                    <div className="bg-white/20 p-6 rounded-[2.5rem] backdrop-blur-sm group-hover:scale-110 transition-transform">
                                        <PackageCheck size={48} />
                                    </div>
                                </div>
                                <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex items-center justify-between group overflow-hidden">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En Planta (Por Lavar)</p>
                                        <h4 className="text-6xl font-bold text-slate-900 tabular-nums">{statusStats.find(s=>s.name==='PENDING')?.value || 0}</h4>
                                    </div>
                                    <div className="bg-indigo-50 p-6 rounded-[2.5rem] text-indigo-600 group-hover:rotate-12 transition-transform">
                                        <Shirt size={48} />
                                    </div>
                                </div>
                                <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100 flex items-center gap-6">
                                    <Info className="text-indigo-600 shrink-0" size={32} />
                                    <p className="text-xs font-bold text-indigo-900 uppercase leading-relaxed tracking-tight">
                                        Use estos datos para optimizar los tiempos de entrega y el uso de insumos en su planta de lavado.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Reports;
import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, LayoutGrid, List, PieChart, Info, AlertTriangle } from 'lucide-react';
import { Invoice, Company, CartItem } from '../types';

interface AgendaProps {
    invoices: Invoice[];
    company: Company;
}

type ViewMode = 'WEEK' | 'MONTH' | 'YEAR';

const Agenda: React.FC<AgendaProps> = ({ invoices, company }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('MONTH');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const currency = company.currencySymbol || 'S/';
    const primaryColor = document.documentElement.style.getPropertyValue('--primary-color') || '#0054A6';

    const getStatusColor = (count: number) => {
        if (count === 0) return 'bg-slate-50 text-slate-400 border-slate-100';
        if (count < 11) return 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20';
        if (count >= 11 && count <= 19) return 'bg-orange-500 text-white shadow-lg shadow-orange-500/20';
        return 'bg-red-600 text-white animate-agenda-blink shadow-lg shadow-red-500/40';
    };

    // Agrupar prendas por fecha de entrega
    const groupedGarments = useMemo(() => {
        const map = new Map<string, { invoice: Invoice; item: CartItem }[]>();
        invoices.forEach(inv => {
            inv.items.forEach(item => {
                const date = item.itemDeliveryDate || inv.deliveryDate;
                if (date) {
                    const dateKey = date.split('T')[0];
                    const list = map.get(dateKey) || [];
                    list.push({ invoice: inv, item });
                    map.set(dateKey, list);
                }
            });
        });
        return map;
    }, [invoices]);

    const navigate = (direction: number) => {
        const newDate = new Date(currentDate);
        if (viewMode === 'MONTH') newDate.setMonth(currentDate.getMonth() + direction);
        else if (viewMode === 'WEEK') newDate.setDate(currentDate.getDate() + direction * 7);
        else if (viewMode === 'YEAR') newDate.setFullYear(currentDate.getFullYear() + direction);
        setCurrentDate(newDate);
    };

    const daysInMonth = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const days = new Date(year, month + 1, 0).getDate();
        
        const result = [];
        // Relleno inicial
        const prevMonthDays = new Date(year, month, 0).getDate();
        for (let i = firstDay; i > 0; i--) {
            result.push({ day: prevMonthDays - i + 1, month: month - 1, year, isCurrent: false });
        }
        // Días del mes
        for (let i = 1; i <= days; i++) {
            result.push({ day: i, month, year, isCurrent: true });
        }
        return result;
    }, [currentDate]);

    const weekDays = useMemo(() => {
        const start = new Date(currentDate);
        start.setDate(currentDate.getDate() - currentDate.getDay());
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    }, [currentDate]);

    const summaryData = useMemo(() => {
        if (!selectedDate) return null;
        const dayGarments = groupedGarments.get(selectedDate) || [];
        const summary: Record<string, { quantity: number; value: number }> = {};
        const itemsList: { invoice: Invoice; item: CartItem }[] = [];

        dayGarments.forEach(({ invoice, item }) => {
            const cat = item.category || 'VARIOS';
            if (!summary[cat]) summary[cat] = { quantity: 0, value: 0 };
            summary[cat].quantity += item.quantity;
            summary[cat].value += (item.price * item.quantity);
            itemsList.push({ invoice, item });
        });

        return {
            date: selectedDate,
            totalGarments: dayGarments.length,
            uniqueOrders: new Set(dayGarments.map(g => g.invoice.id)).size,
            categories: Object.entries(summary).map(([cat, data]) => ({ category: cat, ...data })),
            itemsList
        };
    }, [selectedDate, groupedGarments]);

    return (
        <div className="p-4 lg:p-8 h-full overflow-y-auto bg-slate-50 custom-scrollbar">
            <style>{`
                @keyframes agenda-blink {
                    0%, 100% { background-color: #dc2626; box-shadow: 0 0 10px #ef4444; transform: scale(1); }
                    50% { background-color: #ef4444; box-shadow: 0 0 25px #f87171; transform: scale(1.05); }
                }
                .animate-agenda-blink {
                    animation: agenda-blink 0.8s infinite;
                }
            `}</style>

            <div className="max-w-7xl mx-auto space-y-6">
                {/* HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl text-white shadow-xl" style={{ backgroundColor: primaryColor }}>
                            <CalendarIcon size={28} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 tracking-tight uppercase leading-none">Mi Agenda</h2>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Control Operativo de Entregas</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        {(['WEEK', 'MONTH', 'YEAR'] as ViewMode[]).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === mode ? 'bg-white shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                style={viewMode === mode ? { color: primaryColor } : {}}
                            >
                                {mode === 'WEEK' ? 'Semana' : mode === 'MONTH' ? 'Mes' : 'Año'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* CONTROLES NAVEGACION */}
                <div className="flex justify-between items-center px-2">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-3 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm active:scale-90">
                            <ChevronLeft size={20} />
                        </button>
                        <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight w-48 text-center">
                            {viewMode === 'MONTH' && currentDate.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}
                            {viewMode === 'YEAR' && currentDate.getFullYear()}
                            {viewMode === 'WEEK' && `Semana ${Math.ceil(currentDate.getDate() / 7)}`}
                        </h3>
                        <button onClick={() => navigate(1)} className="p-3 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm active:scale-90">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    <div className="hidden md:flex gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Baja (0-10)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Media (11-19)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Alta (20+)</span>
                        </div>
                    </div>
                </div>

                {/* VISTA MES */}
                {viewMode === 'MONTH' && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-6">
                        <div className="grid grid-cols-7 gap-4 mb-4">
                            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                                <div key={d} className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-3 md:gap-4">
                            {daysInMonth.map((d, i) => {
                                const dateKey = `${d.year}-${String(d.month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
                                const dayGarments = groupedGarments.get(dateKey) || [];
                                const count = dayGarments.length;
                                
                                return (
                                    <div 
                                        key={i} 
                                        onClick={() => count > 0 && setSelectedDate(dateKey)}
                                        className={`aspect-square rounded-[1.5rem] md:rounded-[2.5rem] border-2 transition-all p-2 flex flex-col items-center justify-center gap-1 cursor-pointer hover:scale-105 active:scale-95 ${d.isCurrent ? 'border-transparent' : 'opacity-20 pointer-events-none border-slate-50'} ${getStatusColor(count)}`}
                                    >
                                        <span className="text-xs md:text-sm font-bold">{d.day}</span>
                                        {count > 0 && <span className="text-[8px] md:text-[9px] font-bold uppercase opacity-80">{count} Pren.</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* VISTA SEMANA */}
                {viewMode === 'WEEK' && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                        {weekDays.map((d, i) => {
                            const dateKey = d.toISOString().split('T')[0];
                            const dayGarments = groupedGarments.get(dateKey) || [];
                            const count = dayGarments.length;
                            
                            return (
                                <div 
                                    key={i} 
                                    onClick={() => count > 0 && setSelectedDate(dateKey)}
                                    className={`flex items-center justify-between p-6 rounded-[2rem] border-2 cursor-pointer transition-all hover:translate-x-2 ${getStatusColor(count)}`}
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="bg-white/20 px-5 py-2 rounded-2xl text-center min-w-[80px]">
                                            <p className="text-[9px] font-bold uppercase opacity-60 leading-none">{d.toLocaleDateString('es-PE', { weekday: 'short' })}</p>
                                            <p className="text-2xl font-bold">{d.getDate()}</p>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg uppercase tracking-tight">Prendas Programadas</h4>
                                            <p className="text-xs font-bold uppercase tracking-widest opacity-70">{count} Prendas totales para el día</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={32} className="opacity-40" />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* VISTA AÑO */}
                {viewMode === 'YEAR' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {Array.from({ length: 12 }).map((_, mIdx) => {
                            const dateKeyPrefix = `${currentDate.getFullYear()}-${String(mIdx + 1).padStart(2, '0')}`;
                            let monthCount = 0;
                            groupedGarments.forEach((invs, key) => {
                                if (key.startsWith(dateKeyPrefix)) monthCount += invs.length;
                            });

                            return (
                                <div key={mIdx} className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-3 cursor-default ${getStatusColor(monthCount)}`}>
                                    <h4 className="text-xl font-bold uppercase tracking-widest">{new Date(2000, mIdx).toLocaleDateString('es-PE', { month: 'long' })}</h4>
                                    <div className="bg-black/10 px-4 py-1 rounded-full text-[10px] font-bold uppercase">{monthCount} Prendas</div>
                                    <div className="w-full h-1 bg-white/20 rounded-full mt-2">
                                        <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(100, (monthCount/100)*100)}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODAL RESUMEN */}
            {summaryData && (
                <div className="fixed inset-0 bg-slate-950/90 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 border border-white/20 max-h-[90vh]">
                        <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl shadow-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                                    <PieChart size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl uppercase tracking-tight">Agenda de Prendas</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{summaryData.date} • {summaryData.totalGarments} Prendas • {summaryData.uniqueOrders} Órdenes</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-8">
                            {/* Resumen por Categoría */}
                            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                                <div className="p-4 bg-slate-50 border-b border-slate-100">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resumen por Categoría</h4>
                                </div>
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                            <th className="p-5 pl-8">CATEGORÍA</th>
                                            <th className="p-5 text-center">CANTIDAD</th>
                                            <th className="p-5 text-right pr-8">VALOR</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {summaryData.categories.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-5 pl-8">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: `${primaryColor}30` }}></div>
                                                        <span className="font-bold text-slate-700 uppercase text-xs tracking-tight">{row.category}</span>
                                                    </div>
                                                </td>
                                                <td className="p-5 text-center">
                                                    <span className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold min-w-[32px] inline-block">{row.quantity}</span>
                                                </td>
                                                <td className="p-5 text-right pr-8">
                                                    <span className="font-bold text-sm tabular-nums" style={{ color: primaryColor }}>{currency} {row.value.toFixed(2)}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Detalle de Prendas */}
                            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                                <div className="p-4 bg-slate-50 border-b border-slate-100">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detalle de Prendas</h4>
                                </div>
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                            <th className="p-5 pl-8">PRENDA / CLIENTE</th>
                                            <th className="p-5 text-center">CANT.</th>
                                            <th className="p-5 text-center">ORDEN</th>
                                            <th className="p-5 text-right pr-8">ESTADO</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {summaryData.itemsList.map(({ invoice, item }, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-5 pl-8">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800 uppercase text-xs">{item.name}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{invoice.client.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-5 text-center">
                                                    <span className="font-bold text-slate-700">{item.quantity}</span>
                                                </td>
                                                <td className="p-5 text-center">
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-bold">#{invoice.ordenNumber || invoice.id.substring(0, 5)}</span>
                                                </td>
                                                <td className="p-5 text-right pr-8">
                                                    <span className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                                                        {invoice.orderStatus}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-white flex justify-end">
                            <button 
                                onClick={() => setSelectedDate(null)}
                                className="px-12 py-3 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-black"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Agenda;
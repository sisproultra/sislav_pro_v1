import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, LayoutGrid, List, PieChart, Info, AlertTriangle, Box, Clock, CheckCircle2, ChevronDown, ChevronUp, Hash, User, Shirt, WashingMachine, MessageSquare, Phone, Image as ImageIcon, Mic, ExternalLink, Play, AlertCircle, Ban } from 'lucide-react';
import { Invoice, Company, CartItem, OrderStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { sendReadyNotification } from '../services/whatsappService';

interface AgendaProps {
    invoices: Invoice[];
    company: Company;
}

type ViewMode = 'WEEK' | 'MONTH' | 'YEAR';

const Agenda: React.FC<AgendaProps> = ({ invoices, company }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('MONTH');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [openOrders, setOpenOrders] = useState<Record<string, boolean>>({});
    const [viewedImage, setViewedImage] = useState<string | null>(null);
    const [isSendingWA, setIsSendingWA] = useState<string | null>(null);

    const currency = company.currencySymbol || 'S/';
    const primaryColor = document.documentElement.style.getPropertyValue('--primary-color') || '#0054A6';

    const getStatusColor = (count: number) => {
        if (count === 0) return 'bg-white text-slate-200 border-slate-50';
        if (count < 11) return 'bg-emerald-500 text-white border-emerald-400 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.5)]';
        if (count < 20) return 'bg-orange-500 text-white border-orange-400 shadow-[0_10px_30px_-10px_rgba(249,115,22,0.5)]';
        return 'bg-red-600 text-white border-red-500 shadow-[0_10px_30px_-10px_rgba(220,38,38,0.5)] animate-agenda-blink';
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

    const daySummary = useMemo(() => {
        if (!selectedDate) return null;
        const dayEntries = groupedGarments.get(selectedDate) || [];
        
        let total = 0;
        let pending = 0;
        let ready = 0;
        
        // Mapa para agrupar por orden
        const ordersMap = new Map<string, { invoice: Invoice, items: CartItem[] }>();
        
        dayEntries.forEach(({ invoice, item }) => {
            // Regla 2: Ignorar o marcar como anulados si el item o la orden lo están
            const isAnulado = item.isAnulado || invoice.orderStatus === 'CANCELADO';
            
            if (!isAnulado) {
                const qty = Number(item.quantity) || 0;
                total += qty;
                
                // Lógica de "Listo" vs "Por lavar/Pendiente"
                const statusKey = item.status || invoice.orderStatus;
                const isReady = ['LISTO', 'LISTO_PARA_RECOJO', 'EN_RUTA', 'ENTREGADO', 'ENTREGA_PARCIAL'].includes(statusKey);
                
                if (isReady) ready += qty;
                else pending += qty;
            }
            
            const orderData = ordersMap.get(invoice.id) || { invoice, items: [] };
            orderData.items.push(item);
            ordersMap.set(invoice.id, orderData);
        });

        // REGLA 5: Ordenar por hora de entrega (primero los más próximos)
        const orders = Array.from(ordersMap.values()).sort((a, b) => {
            const timeA = new Date(a.invoice.deliveryDate || 0).getTime();
            const timeB = new Date(b.invoice.deliveryDate || 0).getTime();
            return timeA - timeB;
        });

        // Al seleccionar una fecha, abrimos todas las órdenes por defecto
        const initialOpenState: Record<string, boolean> = {};
        orders.forEach(o => initialOpenState[o.invoice.id] = true);
        
        return {
            date: selectedDate,
            total,
            pending,
            ready,
            orders,
            initialOpenState
        };
    }, [selectedDate, groupedGarments]);

    // EFECTO: Expandir todos los acordeones al cambiar de fecha o al cargar resumen
    React.useEffect(() => {
        if (daySummary?.initialOpenState) {
            setOpenOrders(daySummary.initialOpenState);
        }
    }, [daySummary]);

    const toggleOrder = (orderId: string) => {
        setOpenOrders(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    const handleSendWA = async (invoice: Invoice) => {
        if (!invoice.client.phone) return alert("El cliente no tiene teléfono registrado.");
        setIsSendingWA(invoice.id);
        try {
            const res = await sendReadyNotification(invoice, company, invoice.client.phone);
            if (res.success) {
                alert("Notificación enviada con éxito.");
            } else if (res.fallbackUrl) {
                if (confirm("No se pudo enviar automáticamente. ¿Deseas abrir WhatsApp manualmente?")) {
                    window.open(res.fallbackUrl, '_blank');
                }
            } else {
                alert("Error: " + res.message);
            }
        } catch (e) {
            alert("Error al enviar notificación.");
        } finally {
            setIsSendingWA(null);
        }
    };

    const getStatusInfo = (status: OrderStatus, isItemAnulado?: boolean) => {
        if (isItemAnulado || status === 'CANCELADO') {
            return { color: 'text-red-500', bg: 'bg-red-50', icon: <Ban size={14} />, label: 'ANULADO' };
        }
        const isReady = ['LISTO', 'LISTO_PARA_RECOJO', 'EN_RUTA', 'ENTREGADO', 'ENTREGA_PARCIAL'].includes(status);
        if (isReady) return { color: 'text-emerald-500', bg: 'bg-emerald-50', icon: <CheckCircle2 size={14} />, label: 'LISTO' };
        return { color: 'text-amber-500', bg: 'bg-amber-50', icon: <Clock size={14} />, label: 'POR LAVAR' };
    };

    const getTimeStatus = (deliveryDate?: string) => {
        if (!deliveryDate) return { isUrgent: false, timeStr: '--:--' };
        const date = new Date(deliveryDate);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        
        const timeStr = date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
        return {
            isUrgent: diffHours > 0 && diffHours < 4,
            isPast: diffHours < 0,
            timeStr
        };
    };

    return (
        <div className="p-4 lg:p-8 h-full overflow-y-auto bg-slate-50 custom-scrollbar">
            <style>{`
                @keyframes agenda-blink {
                    0%, 100% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.4); transform: scale(1); }
                    50% { box-shadow: 0 0 30px rgba(239, 68, 68, 0.8); transform: scale(1.02); }
                }
                .animate-agenda-blink {
                    animation: agenda-blink 1.5s infinite ease-in-out;
                }
                @keyframes neon-pulse {
                    0%, 100% { opacity: 1; filter: brightness(1); }
                    50% { opacity: 0.8; filter: brightness(1.2); }
                }
                .animate-neon-pulse {
                    animation: neon-pulse 1s infinite alternate;
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
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">Mi Agenda de Tareas</h2>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Control Operativo y Tareas Diarias</p>
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
                                <div 
                                    key={mIdx} 
                                    className={`p-8 rounded-[3rem] border-2 transition-all flex flex-col items-center gap-4 cursor-default group hover:scale-105 ${getStatusColor(monthCount)}`}
                                >
                                    <h4 className="text-2xl font-black uppercase tracking-tight">{new Date(2000, mIdx).toLocaleDateString('es-PE', { month: 'long' })}</h4>
                                    <div className="bg-black/10 px-6 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">{monthCount} Prendas</div>
                                    <div className="w-full h-2 bg-white/20 rounded-full mt-2 overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, (monthCount/100)*100)}%` }}
                                            className="h-full bg-white rounded-full" 
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODAL RESUMEN TAREA DEL DIA */}
            <AnimatePresence>
                {daySummary && (
                    <div className="fixed inset-0 bg-slate-950/80 z-[300] flex items-center justify-center backdrop-blur-sm overflow-y-auto pt-4 pb-4 px-2 lg:px-6">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2rem] lg:rounded-[3rem] w-full lg:w-[90vw] max-w-[1400px] shadow-2xl flex flex-col border border-white/20 min-h-[80vh] max-h-fit lg:max-h-[95vh] relative"
                        >
                            {/* Cabecera del Modal */}
                            <div className="p-6 lg:p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-50 shrink-0">
                                <div className="flex items-center gap-4 lg:gap-6">
                                    <div className="p-4 rounded-[1.5rem] text-white shadow-xl hidden sm:flex" style={{ backgroundColor: primaryColor }}>
                                        <CalendarIcon size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xl lg:text-3xl text-slate-900 uppercase tracking-tight leading-none tracking-[-0.03em]">Mi Tarea del Día</h3>
                                        <p className="text-[10px] lg:text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] mt-2 flex items-center gap-2">
                                            <span className="bg-slate-900 text-white px-3 py-1 rounded-[4px]">{daySummary.date}</span>
                                            <span className="opacity-30">•</span>
                                            <span className="flex items-center gap-1.5"><Shirt size={12} className="opacity-50" /> {daySummary.orders.length} ÓRDENES</span>
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedDate(null)}
                                    className="p-3 lg:p-4 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-all active:scale-95 border border-slate-200/50"
                                >
                                    <X size={24} strokeWidth={4} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 space-y-10">
                                {/* TARJETAS DE RESUMEN TÉCNICO */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between group hover:shadow-2xl hover:border-indigo-500/20 transition-all">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Carga Total</p>
                                            <p className="text-4xl font-black text-slate-900 tabular-nums">{daySummary.total}</p>
                                            <p className="text-[10px] font-bold text-slate-300 uppercase mt-1 tracking-tighter">Prendas Registradas</p>
                                        </div>
                                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-100 group-hover:scale-110 transition-transform">
                                            <Shirt size={28} />
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between group hover:shadow-2xl hover:border-amber-500/20 transition-all">
                                        <div>
                                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Pendiente Lavado</p>
                                            <p className="text-4xl font-black text-amber-600 tabular-nums">{daySummary.pending}</p>
                                            <p className="text-[10px] font-bold text-amber-300 uppercase mt-1 tracking-tighter">Acción Requerida</p>
                                        </div>
                                        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 border border-amber-100 group-hover:scale-110 transition-transform">
                                            <WashingMachine size={28} />
                                        </div>
                                    </div>

                                    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex items-center justify-between group hover:shadow-2xl transition-all sm:col-span-2 lg:col-span-1">
                                        <div>
                                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 tracking-[0.2em]">Listas para Entrega</p>
                                            <p className="text-4xl font-black text-white tabular-nums tracking-tighter">{daySummary.ready}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Listo para despacho</p>
                                        </div>
                                        <div className="w-14 h-14 bg-white/10 text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                            <CheckCircle2 size={28} />
                                        </div>
                                    </div>
                                </div>

                                {/* LISTADO DE ÓRDENES */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1 h-5 rounded-full bg-slate-900" />
                                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Hoja de Ruta Operativa</h4>
                                        </div>
                                        <div className="h-[1px] flex-1 mx-6 bg-slate-100 hidden md:block" />
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{daySummary.orders.length} DOCUMENTOS</div>
                                    </div>

                                    {daySummary.orders.map(({ invoice, items }) => {
                                        const timeStatus = getTimeStatus(invoice.deliveryDate);
                                        const isCancelled = invoice.orderStatus === 'CANCELADO';

                                        return (
                                            <div key={invoice.id} className={`bg-white border rounded-[1.5rem] overflow-hidden transition-all duration-300 ${timeStatus.isUrgent ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-slate-100 hover:border-slate-300 shadow-sm hover:shadow-md'} ${isCancelled ? 'opacity-40 grayscale' : ''}`}>
                                                {/* Header Orden */}
                                                <div className="w-full px-6 py-5 flex flex-col md:flex-row md:items-center justify-between text-left gap-4 md:gap-6 bg-slate-50/20">
                                                    <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 flex-1 min-w-0">
                                                        <div 
                                                            className="h-10 px-4 rounded-lg text-white font-black text-xs shadow-sm shadow-black/10 shrink-0 flex items-center justify-center border-b-4 border-black/20 tracking-widest min-w-[100px]"
                                                            style={{ backgroundColor: isCancelled ? '#94a3b8' : primaryColor }}
                                                        >
                                                            ID: {invoice.ordenNumber || '---'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                                                                <span className="font-black text-slate-900 uppercase text-sm tracking-tight truncate max-w-[250px] flex items-center gap-2">
                                                                    <User size={14} className="text-slate-300" />
                                                                    {invoice.client.name}
                                                                </span>
                                                                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                                                    <Phone size={10} strokeWidth={3} className="opacity-50" />
                                                                    {invoice.client.phone || 'S/T'}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4 mt-1 flex-wrap">
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Shirt size={10} /> {items.length} ITEMS</span>
                                                                <span className="text-[9px] font-black text-indigo-600 uppercase border-b border-indigo-100">DEUDA: {currency} {(Number(invoice.totals?.total) || 0).toFixed(2)}</span>
                                                                <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.1em] flex items-center gap-1 ${invoice.orderStatus === 'LISTO' ? 'bg-emerald-500 text-white shadow-sm' : (isCancelled ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-600 border border-amber-200')}`}>
                                                                    {isCancelled ? <Ban size={8}/> : (invoice.orderStatus === 'LISTO' ? <CheckCircle2 size={8}/> : <Clock size={8}/>)}
                                                                    {invoice.orderStatus}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-row md:items-center justify-between md:justify-end gap-6 md:gap-12 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                                                        <div className={`flex flex-col items-center md:items-end ${timeStatus.isUrgent ? 'text-red-600 animate-pulse' : 'text-slate-900'}`}>
                                                            <p className="text-[8px] font-black uppercase tracking-[0.2em] leading-none mb-1 opacity-50">Hora Límite</p>
                                                            <p className="text-xl font-black tabular-nums tracking-tighter">
                                                                {timeStatus.timeStr}
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <button 
                                                                disabled={isSendingWA === invoice.id || isCancelled}
                                                                onClick={(e) => { e.stopPropagation(); handleSendWA(invoice); }}
                                                                className={`h-10 px-5 rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-95 shadow-sm group/wa ${isSendingWA === invoice.id ? 'bg-slate-100 text-slate-400' : 'bg-emerald-500 text-white hover:bg-emerald-600 border-b-4 border-emerald-700'}`}
                                                            >
                                                                {isSendingWA === invoice.id ? (
                                                                    <WashingMachine className="animate-spin" size={16} />
                                                                ) : (
                                                                    <img src="https://iili.io/BWIGQGs.png" className="w-4 h-4 object-contain group-hover/wa:scale-110 transition-transform" alt="WA" />
                                                                )}
                                                                <span className="text-[9px] font-black uppercase tracking-[0.15em] hidden sm:inline">NOTIFICAR</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Detalle Técnico Prendas */}
                                                <div className="px-5 pb-5">
                                                    <div className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden shadow-inner">
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-left text-xs border-separate border-spacing-0">
                                                                <thead>
                                                                    <tr className="bg-slate-100/30">
                                                                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[9px]">Prenda / Servicio</th>
                                                                        <th className="px-6 py-4 text-center font-black text-slate-400 uppercase tracking-widest text-[9px]">Cant.</th>
                                                                        <th className="px-6 py-4 text-center font-black text-slate-400 uppercase tracking-widest text-[9px]">Multimedia</th>
                                                                        <th className="px-6 py-4 text-right font-black text-slate-400 uppercase tracking-widest text-[9px]">Estado</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-200/50">
                                                                    {items.map((item, idx) => {
                                                                        const status = getStatusInfo(item.status || invoice.orderStatus, item.isAnulado);
                                                                        return (
                                                                            <tr key={idx} className="hover:bg-white transition-colors group">
                                                                                <td className="px-6 py-4">
                                                                                    <div className="font-black text-slate-800 uppercase text-xs">{item.name}</div>
                                                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                                                        {item.color && <span className="text-[9px] font-bold text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded uppercase">COLOR: {item.color}</span>}
                                                                                        {item.details && <span className="text-[9px] text-slate-500 italic flex items-center gap-1"><Info size={10} /> {item.details}</span>}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-center font-black text-slate-900 text-lg tabular-nums">{item.quantity}</td>
                                                                                <td className="px-6 py-4">
                                                                                    <div className="flex items-center justify-center gap-3">
                                                                                        {item.images && item.images.length > 0 ? (
                                                                                            <div className="flex -space-x-1.5">
                                                                                                {item.images.slice(0, 3).map((img, i) => (
                                                                                                    <div 
                                                                                                        key={i} 
                                                                                                        onClick={() => setViewedImage(img)}
                                                                                                        className="w-8 h-8 rounded-lg border border-white shadow-sm overflow-hidden cursor-zoom-in hover:scale-110 active:scale-95 transition-all relative group/thumb"
                                                                                                    >
                                                                                                        <img src={img} className="w-full h-full object-cover" alt="Prenda" />
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <ImageIcon size={14} className="text-slate-200" />
                                                                                        )}
                                                                                        
                                                                                        {item.audioNote ? (
                                                                                            <button 
                                                                                                onClick={() => {
                                                                                                    const audio = new Audio(item.audioNote);
                                                                                                    audio.play();
                                                                                                }}
                                                                                                className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg shadow-sm active:scale-90 transition-all hover:bg-indigo-100"
                                                                                            >
                                                                                                <Mic size={14} />
                                                                                            </button>
                                                                                        ) : (
                                                                                            <Mic size={14} className="text-slate-200" />
                                                                                        )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-right">
                                                                                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest shadow-sm ${status.bg} ${status.color}`}>
                                                                                        {status.icon}
                                                                                        {status.label}
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Footer del Modal Premium */}
                            <div className="p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-6 shrink-0 rounded-b-3xl mt-auto">
                                <div className="flex items-center gap-8">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Normal</span>
                                        </div>
                                        <p className="text-[8px] text-slate-400 font-bold ml-4">ENTREGA ESTÁNDAR</p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                            <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Crítico</span>
                                        </div>
                                        <p className="text-[8px] text-slate-400 font-bold ml-4">EXCESO DE TIEMPO (&lt;4H)</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedDate(null)}
                                    className="w-full sm:w-auto px-12 h-14 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] shadow-xl active:scale-95 transition-all hover:bg-black group flex items-center justify-center gap-4 border-b-4 border-slate-700"
                                >
                                    Cerrar Reporte <CheckCircle2 size={18} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* VISOR DE IMAGEN MAXIMIZADA */}
            <AnimatePresence>
                {viewedImage && (
                    <div 
                        className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 cursor-zoom-out"
                        onClick={() => setViewedImage(null)}
                    >
                        <motion.button 
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute top-10 right-10 text-white hover:text-red-400 transition-colors bg-white/10 p-3 rounded-full"
                        >
                            <X size={32} strokeWidth={4} />
                        </motion.button>
                        <motion.img 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            src={viewedImage} 
                            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border-4 border-white/10" 
                            alt="Visualización" 
                        />
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Agenda;

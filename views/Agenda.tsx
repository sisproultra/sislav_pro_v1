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
        if (count === 0) return 'bg-white/40 backdrop-blur-md text-slate-300 border-slate-100/50 hover:bg-white/80';
        if (count < 11) return 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white border-emerald-300 shadow-[0_15px_35px_-10px_rgba(16,185,129,0.4)]';
        if (count < 20) return 'bg-gradient-to-br from-orange-400 to-orange-600 text-white border-orange-300 shadow-[0_15px_35px_-10px_rgba(249,115,22,0.4)]';
        return 'bg-gradient-to-br from-red-500 to-rose-700 text-white border-red-400 shadow-[0_15px_35px_-10px_rgba(220,38,38,0.4)] animate-agenda-blink';
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

    const monthsToDisplay = useMemo(() => {
        const months = [];
        for (let m = 0; m < 4; m++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + m, 1);
            const year = date.getFullYear();
            const month = date.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const lastDay = new Date(year, month + 1, 0).getDate();
            
            const days = [];
            // Relleno inicial
            const prevMonthLastDay = new Date(year, month, 0).getDate();
            for (let i = firstDay; i > 0; i--) {
                days.push({ day: prevMonthLastDay - i + 1, month: month - 1, year, isCurrent: false });
            }
            // Días del mes
            for (let i = 1; i <= lastDay; i++) {
                days.push({ day: i, month, year, isCurrent: true });
            }
            months.push({ name: date.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }), days, month, year });
        }
        return months;
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
        <div className="p-4 lg:p-10 h-full overflow-y-auto bg-[#f8fafc] custom-scrollbar relative">
            {/* ATMOSPHERIC BACKGROUND ELEMENTS */}
            <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden pointer-events-none opacity-40 z-0">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-200 blur-[120px] rounded-full opacity-50" />
                <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-blue-100 blur-[100px] rounded-full opacity-40" />
            </div>

            <style>{`
                @keyframes agenda-blink {
                    0%, 100% { box-shadow: 0 0 20px rgba(220, 38, 38, 0.4); transform: scale(1); }
                    50% { box-shadow: 0 0 40px rgba(220, 38, 38, 0.7); transform: scale(1.03); }
                }
                .animate-agenda-blink {
                    animation: agenda-blink 2s infinite ease-in-out;
                }
                .glass-card {
                    background: rgba(255, 255, 255, 0.7);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.5);
                }
                .day-number {
                    font-family: 'Outfit', sans-serif;
                }
            `}</style>

            <div className="max-w-[1600px] mx-auto space-y-8 relative z-10">
                {/* HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass-card p-8 rounded-[3rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] border-white/50">
                    <div className="flex items-center gap-6">
                        <motion.div 
                            initial={{ rotate: -15, scale: 0.8 }}
                            animate={{ rotate: 0, scale: 1 }}
                            className="p-5 rounded-3xl text-white shadow-2xl" 
                            style={{ backgroundColor: primaryColor }}
                        >
                            <CalendarIcon size={32} />
                        </motion.div>
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-tight">Mi Agenda</h2>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mt-1">Operación y Tareas de Lavandería</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 bg-slate-200/50 backdrop-blur-sm p-1.5 rounded-[2rem] border border-white/20">
                        {(['WEEK', 'MONTH', 'YEAR'] as ViewMode[]).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${viewMode === mode ? 'bg-white shadow-xl text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600 hover:bg-white/30'}`}
                                style={viewMode === mode ? { color: primaryColor } : {}}
                            >
                                {mode === 'WEEK' ? 'Semana' : mode === 'MONTH' ? 'Mes' : 'Año'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* CONTROLES NAVEGACION */}
                <div className="flex flex-col sm:flex-row justify-between items-center px-4 gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="w-10 h-10 bg-white/60 backdrop-blur-md border border-white/50 rounded-xl flex items-center justify-center hover:bg-white hover:shadow-xl transition-all active:scale-90 group">
                            <ChevronLeft size={20} className="text-slate-600 group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <div className="flex flex-col items-center min-w-[180px]">
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter day-number leading-tight">
                                {viewMode === 'MONTH' && currentDate.toLocaleDateString('es-PE', { month: 'long' })}
                                {viewMode === 'YEAR' && currentDate.getFullYear()}
                                {viewMode === 'WEEK' && 'Semana'}
                            </h3>
                            <p className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.3em]">
                                {viewMode === 'MONTH' && currentDate.getFullYear()}
                                {viewMode === 'WEEK' && `Del mes de ${currentDate.toLocaleDateString('es-PE', { month: 'long' })}`}
                            </p>
                        </div>
                        <button onClick={() => navigate(1)} className="w-10 h-10 bg-white/60 backdrop-blur-md border border-white/50 rounded-xl flex items-center justify-center hover:bg-white hover:shadow-xl transition-all active:scale-90 group">
                            <ChevronRight size={20} className="text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                    
                    <div className="flex gap-6 bg-white/40 backdrop-blur-md p-3 rounded-2xl border border-white/30 px-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Leve</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Medio</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]"></div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Saturado</span>
                        </div>
                    </div>
                </div>

                {/* VISTA MES (4 MESES) */}
                {viewMode === 'MONTH' && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
                    >
                        {monthsToDisplay.map((m, mIdx) => (
                            <div key={mIdx} className="glass-card rounded-[2rem] border-white/50 shadow-lg overflow-hidden p-4">
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-3 text-center bg-slate-50/50 py-1.5 rounded-lg border border-slate-100">{m.name}</h4>
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                                        <div key={i} className="text-center text-[7px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {m.days.map((d, i) => {
                                        const dateKey = `${d.year}-${String(d.month + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
                                        const dayGarments = groupedGarments.get(dateKey) || [];
                                        const count = dayGarments.reduce((sum, { item, invoice }) => {
                                            const isAnulado = item.isAnulado || invoice.orderStatus === 'CANCELADO';
                                            return isAnulado ? sum : sum + (Number(item.quantity) || 0);
                                        }, 0);
                                        const isToday = new Date().toISOString().split('T')[0] === dateKey;
                                        
                                        return (
                                            <motion.div 
                                                key={i} 
                                                whileHover={d.isCurrent ? { scale: 1.1, zIndex: 10 } : {}}
                                                onClick={() => d.isCurrent && count > 0 && setSelectedDate(dateKey)}
                                                className={`relative aspect-square rounded-lg border transition-all p-0.5 flex flex-col items-center justify-center cursor-pointer group shadow-sm ${d.isCurrent ? 'border-transparent' : 'opacity-0 pointer-events-none border-slate-100'} ${getStatusColor(count)} ${isToday ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-50' : ''}`}
                                            >
                                                <span className="text-[10px] font-black day-number tracking-tighter">{d.day}</span>
                                                {count > 0 && d.isCurrent && (
                                                    <span className="text-[6px] font-black uppercase tracking-tighter opacity-80 bg-white/20 px-1 rounded">{count}</span>
                                                )}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </motion.div>
                )}

                {/* VISTA SEMANA */}
                {viewMode === 'WEEK' && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-card rounded-[3rem] border-white/50 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.06)] overflow-hidden p-8 space-y-4"
                    >
                        {weekDays.map((d, i) => {
                            const dateKey = d.toISOString().split('T')[0];
                            const dayGarments = groupedGarments.get(dateKey) || [];
                            const count = dayGarments.length;
                            const isToday = new Date().toISOString().split('T')[0] === dateKey;
                            
                            return (
                                <motion.div 
                                    key={i} 
                                    whileHover={{ x: 15, scale: 1.01 }}
                                    onClick={() => count > 0 && setSelectedDate(dateKey)}
                                    className={`flex items-center justify-between p-6 rounded-[2.5rem] border-2 cursor-pointer transition-all shadow-sm ${getStatusColor(count)} ${isToday ? 'ring-4 ring-indigo-400 ring-offset-4 ring-offset-slate-50' : ''}`}
                                >
                                    <div className="flex items-center gap-8">
                                        <div className="bg-white/30 backdrop-blur-md px-6 py-3 rounded-3xl text-center min-w-[100px] border border-white/20">
                                            <p className="text-[10px] font-black uppercase opacity-70 tracking-tighter leading-none mb-1">{d.toLocaleDateString('es-PE', { weekday: 'short' })}</p>
                                            <p className="text-3xl font-black day-number tracking-tighter">{d.getDate()}</p>
                                        </div>
                                        <div>
                                            <h4 className="font-black text-xl uppercase tracking-tighter leading-tight">Prendas en Agenda</h4>
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">
                                                {count === 0 ? 'Sin tareas programadas' : `${count} prendas para procesar`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {isToday && <span className="bg-white/40 text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-white/30">Hoy</span>}
                                        <ChevronRight size={32} className="opacity-30" />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* VISTA AÑO */}
                {viewMode === 'YEAR' && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8"
                    >
                        {Array.from({ length: 12 }).map((_, mIdx) => {
                            const dateKeyPrefix = `${currentDate.getFullYear()}-${String(mIdx + 1).padStart(2, '0')}`;
                            let monthCount = 0;
                            groupedGarments.forEach((invs, key) => {
                                if (key.startsWith(dateKeyPrefix)) monthCount += invs.length;
                            });

                            return (
                                <motion.div 
                                    key={mIdx} 
                                    whileHover={{ y: -15, scale: 1.05 }}
                                    className={`p-10 rounded-[4rem] border-2 transition-all flex flex-col items-center gap-6 cursor-default group shadow-lg ${getStatusColor(monthCount)}`}
                                >
                                    <h4 className="text-3xl font-black uppercase tracking-tighter day-number">{new Date(2000, mIdx).toLocaleDateString('es-PE', { month: 'long' })}</h4>
                                    <div className="bg-white/20 backdrop-blur-md px-8 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-white/20">
                                        {monthCount} Prendas
                                    </div>
                                    <div className="w-full h-2.5 bg-white/20 rounded-full mt-2 overflow-hidden border border-white/20">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, (monthCount/300)*100)}%` }}
                                            className="h-full bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]" 
                                        />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </div>

            {/* MODAL RESUMEN TAREA DEL DIA */}
            <AnimatePresence>
                {daySummary && (
                    <div className="fixed inset-0 bg-slate-950/60 z-[300] flex items-center justify-center backdrop-blur-[20px] overflow-y-auto pt-4 pb-4 px-2 lg:px-6">
                        {/* ATMOSPHERIC BACKGROUND ELEMENTS FOR MODAL */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                            <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-indigo-500 blur-[150px] rounded-full" />
                            <div className="absolute bottom-0 left-0 w-[50%] h-[50%] bg-emerald-500 blur-[150px] rounded-full" />
                        </div>

                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 100 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 100 }}
                            className="bg-white/80 backdrop-blur-3xl rounded-[3rem] lg:rounded-[5rem] w-full lg:w-[95vw] max-w-[1500px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] flex flex-col border border-white/50 min-h-[90vh] max-h-fit lg:max-h-[95vh] relative overflow-hidden"
                        >
                            {/* Cabecera del Modal */}
                            <div className="p-8 lg:p-12 border-b border-black/5 flex justify-between items-center sticky top-0 z-50 shrink-0 bg-white/40 backdrop-blur-md">
                                <div className="flex items-center gap-8">
                                    <motion.div 
                                        animate={{ rotate: [0, -10, 10, 0] }}
                                        transition={{ repeat: Infinity, duration: 4 }}
                                        className="p-6 rounded-[2.5rem] text-white shadow-2xl hidden sm:flex" 
                                        style={{ backgroundColor: primaryColor }}
                                    >
                                        <CalendarIcon size={32} />
                                    </motion.div>
                                    <div>
                                        <h3 className="font-black text-3xl lg:text-5xl text-slate-900 uppercase tracking-tighter leading-none tracking-[-0.04em]">Hoja de Ruta</h3>
                                        <div className="flex flex-wrap items-center gap-4 mt-4">
                                            <div className="bg-slate-900 text-white px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-slate-900/20">
                                                <CalendarIcon size={12} className="text-indigo-400" />
                                                {daySummary.date}
                                            </div>
                                            <div className="bg-white/50 px-5 py-1.5 rounded-full text-[11px] font-black text-slate-500 uppercase tracking-widest border border-white flex items-center gap-2">
                                                <Shirt size={12} className="text-indigo-500" />
                                                {daySummary.orders.length} ÓRDENES PROGRAMADAS
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedDate(null)}
                                    className="w-16 h-16 bg-white/80 hover:bg-white text-slate-400 hover:text-slate-900 rounded-[2rem] transition-all active:scale-90 border border-white flex items-center justify-center shadow-xl group"
                                >
                                    <X size={32} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-500" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 lg:p-14 space-y-16">
                                {/* TARJETAS DE RESUMEN TÉCNICO */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                    <motion.div 
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 }}
                                        className="bg-white p-10 rounded-[3rem] border border-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] flex items-center justify-between group hover:shadow-2xl transition-all"
                                    >
                                        <div>
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Prendas Totales</p>
                                            <p className="text-6xl font-black text-slate-900 day-number tracking-tighter tabular-nums">{daySummary.total}</p>
                                            <div className="flex items-center gap-2 mt-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Registros de Hoy</p>
                                            </div>
                                        </div>
                                        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center shrink-0 border border-indigo-100 group-hover:rotate-12 transition-transform">
                                            <Shirt size={40} />
                                        </div>
                                    </motion.div>

                                    <motion.div 
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="bg-white p-10 rounded-[3rem] border border-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] flex items-center justify-between group hover:shadow-2xl transition-all"
                                    >
                                        <div>
                                            <p className="text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] mb-2">Por Procesar</p>
                                            <p className="text-6xl font-black text-amber-600 day-number tracking-tighter tabular-nums">{daySummary.pending}</p>
                                            <div className="flex items-center gap-2 mt-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                <p className="text-[10px] font-black text-amber-300 uppercase tracking-widest">En cola de trabajo</p>
                                            </div>
                                        </div>
                                        <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-[2rem] flex items-center justify-center shrink-0 border border-amber-100 group-hover:rotate-12 transition-transform">
                                            <WashingMachine size={40} />
                                        </div>
                                    </motion.div>

                                    <motion.div 
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.3)] flex items-center justify-between group hover:shadow-2xl transition-all sm:col-span-2 lg:col-span-1"
                                    >
                                        <div>
                                            <p className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2">Para Entrega</p>
                                            <p className="text-6xl font-black text-white day-number tracking-tighter tabular-nums">{daySummary.ready}</p>
                                            <div className="flex items-center gap-2 mt-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]" />
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Listo para el cliente</p>
                                            </div>
                                        </div>
                                        <div className="w-20 h-20 bg-white/10 text-emerald-400 rounded-[2rem] flex items-center justify-center shrink-0 border border-white/10 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                            <CheckCircle2 size={40} />
                                        </div>
                                    </motion.div>
                                </div>

                                {/* LISTADO DE ÓRDENES */}
                                <div className="space-y-10">
                                    <div className="flex items-center justify-between mb-8 px-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-2 h-10 rounded-full bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.5)]" />
                                            <div>
                                                <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Detalle Operativo</h4>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Listado de tickets y clientes del día</p>
                                            </div>
                                        </div>
                                        <div className="text-[11px] font-black tracking-widest text-slate-400 uppercase bg-slate-100 px-6 py-2 rounded-full border border-slate-200">{daySummary.orders.length} TICKETS</div>
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
                            <div className="p-10 border-t border-black/5 bg-slate-50/50 backdrop-blur-md flex flex-col sm:flex-row justify-between items-center gap-8 shrink-0 rounded-b-[4rem] mt-auto">
                                <div className="flex items-center gap-12">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Entrega Normal</p>
                                            <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">ESTÁNDAR (4H+)</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest leading-none">Entrega Crítica</p>
                                            <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">MENOS DE 4 HORAS</p>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedDate(null)}
                                    className="w-full sm:w-auto px-16 h-16 bg-slate-900 text-white rounded-[2rem] font-black text-[12px] uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all hover:bg-black group flex items-center justify-center gap-6 border-b-8 border-slate-950"
                                >
                                    Cerrar Reporte <CheckCircle2 size={24} className="group-hover:translate-x-2 transition-transform duration-300" />
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
                        className="fixed inset-0 z-[600] bg-slate-950/95 backdrop-blur-[40px] flex items-center justify-center p-6 lg:p-20 cursor-zoom-out"
                        onClick={() => setViewedImage(null)}
                    >
                        <motion.button 
                            initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            className="absolute top-12 right-12 text-white hover:text-red-400 transition-all bg-white/10 hover:bg-white/20 p-5 rounded-[2rem] border border-white/20 shadow-2xl"
                        >
                            <X size={40} strokeWidth={3} />
                        </motion.button>
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0, y: 100 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: 100 }}
                            className="relative group"
                        >
                            <div className="absolute -inset-4 bg-white/20 blur-2xl rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <img 
                                src={viewedImage} 
                                className="max-w-full max-h-[85vh] object-contain rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] border-8 border-white/10 relative z-10" 
                                alt="Visualización Tarea" 
                            />
                            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-8 py-3 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full text-white text-[10px] font-black uppercase tracking-[0.4em] opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0 z-20">
                                Click para cerrar
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Agenda;

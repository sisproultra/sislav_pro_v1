import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, LayoutGrid, List, PieChart, Info, AlertTriangle, Box, Clock, CheckCircle2, ChevronDown, ChevronUp, Hash, User, Shirt, WashingMachine, MessageSquare, Phone, Image as ImageIcon, Mic, ExternalLink, Play, AlertCircle, Ban, Package, Smartphone, Eye } from 'lucide-react';
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
    const [selectedInvoiceAction, setSelectedInvoiceAction] = useState<Invoice | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

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

    const handleSendWA = (invoice: Invoice) => {
        if (!invoice.client.phone) return alert("El cliente no tiene teléfono registrado.");
        const phone = invoice.client.phone.replace(/\D/g, '');
        const message = `Hola ${invoice.client.name}, le informamos que su orden #${invoice.ordenNumber || ''} ya está procesada y lista.`;
        window.open(`https://wa.me/${phone.startsWith('51') ? phone : '51' + phone}?text=${encodeURIComponent(message)}`, '_blank');
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

            {/* MODAL RESUMEN TAREA DEL DIA - FULL SCREEN & TABLE VIEW */}
            <AnimatePresence>
                {daySummary && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-white z-[300] flex flex-col overflow-hidden"
                    >
                        {/* CABECERA FULL SCREEN */}
                        <div 
                            className="px-6 lg:px-10 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-50 shadow-sm"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-lg" style={{ backgroundColor: primaryColor }}>
                                    <WashingMachine size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.15em]">{daySummary.date}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-200" />
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">{daySummary.orders.length} ÓRDENES</span>
                                    </div>
                                    <h3 className="font-black text-xl lg:text-2xl text-slate-900 uppercase tracking-tighter leading-none">Mi Tarea del Día</h3>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <div className="hidden md:flex items-center gap-6 mr-8 text-right">
                                    <div>
                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">TOTAL PRENDAS</p>
                                        <p className="text-lg font-black text-slate-900 tracking-tighter" style={{ color: primaryColor }}>{daySummary.total.toFixed(2)}</p>
                                    </div>
                                    <div className="h-6 w-px bg-slate-100" />
                                    <div>
                                        <p className="text-[7px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">POR LAVAR</p>
                                        <p className="text-lg font-black text-amber-600 tracking-tighter">{daySummary.pending.toFixed(2)}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedDate(null)}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90 group"
                                >
                                    <X size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                                </button>
                            </div>
                        </div>

                        {/* CUERPO DEL REPORTE - VISTA TABLA COMPACTA */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/20">
                            <div className="max-w-[1200px] mx-auto p-4 lg:p-6">
                                <div className="space-y-6">
                                    {[...daySummary.orders]
                                        .sort((a, b) => {
                                            const timeA = a.invoice.deliveryDate ? new Date(a.invoice.deliveryDate).getTime() : 0;
                                            const timeB = b.invoice.deliveryDate ? new Date(b.invoice.deliveryDate).getTime() : 0;
                                            return timeA - timeB;
                                        })
                                        .map(({ invoice, items }) => {
                                            const timeStatus = getTimeStatus(invoice.deliveryDate);
                                            const isCancelled = invoice.orderStatus === 'CANCELADO';

                                            return (
                                                <div key={invoice.id} className={`bg-white rounded-2xl shadow-md border border-slate-200/60 overflow-hidden transition-all ${timeStatus.isUrgent ? 'ring-1 ring-red-100 ring-offset-2' : ''} ${isCancelled ? 'opacity-40 grayscale' : ''}`}>
                                                    {/* SECCIÓN CLIENTE / CABECERA ORDEN COMPACTA */}
                                                    <div className="px-5 py-4 bg-slate-50/40 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                                                        <div className="flex items-center gap-4 min-w-0" onClick={() => { setSelectedInvoiceAction(invoice); setShowDetailModal(true); }}>
                                                            <div className="w-12 h-12 rounded-xl text-white flex items-center justify-center shadow-md shrink-0 cursor-pointer" style={{ backgroundColor: primaryColor }}>
                                                                <User size={22} />
                                                            </div>
                                                            <div className="min-w-0 cursor-pointer">
                                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                    <span className="px-2 py-0.5 text-white text-[8px] font-black rounded-md tracking-widest" style={{ backgroundColor: primaryColor }}>ID: {invoice.ordenNumber || '---'}</span>
                                                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${invoice.orderStatus === 'LISTO' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                                        {invoice.orderStatus}
                                                                    </span>
                                                                    {timeStatus.isUrgent && (
                                                                        <span className="px-2 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-md tracking-widest animate-pulse">URGENTE</span>
                                                                    )}
                                                                </div>
                                                                <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter truncate leading-none">{invoice.client.name}</h4>
                                                                <div className="flex items-center gap-4 mt-1.5 text-slate-400">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Phone size={12} style={{ color: primaryColor }} />
                                                                        <span className="text-[10px] font-bold text-slate-500">{invoice.client.phone || 'S/T'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                                                                        <Clock size={12} style={{ color: primaryColor }} />
                                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{timeStatus.timeStr}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleSendWA(invoice); }}
                                                                className="px-4 py-2 bg-[#25D366] text-white rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg shadow-emerald-100"
                                                            >
                                                                <Smartphone size={14} fill="white" />
                                                                <span className="text-[9px] font-black uppercase tracking-widest">WhatsApp</span>
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setSelectedInvoiceAction(invoice); setShowDetailModal(true); }}
                                                                className="px-4 py-2 text-white rounded-xl transition-all hover:opacity-90 active:scale-95 flex items-center gap-2 shadow-lg"
                                                                style={{ backgroundColor: primaryColor }}
                                                            >
                                                                <Eye size={14} />
                                                                <span className="text-[9px] font-black uppercase tracking-widest">Ver</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                {/* TABLA DE PRENDAS DETALLADA COMPACTA */}
                                                <div className="overflow-x-auto">
                                                    <table className="w-full border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-50/30">
                                                                <th className="px-5 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">Prenda / Servicio</th>
                                                                <th className="px-5 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">Cant</th>
                                                                <th className="px-5 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">Multimedia</th>
                                                                <th className="px-5 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">Estado</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {items.map((item, idx) => {
                                                                const status = getStatusInfo(item.status || invoice.orderStatus, item.isAnulado);
                                                                return (
                                                                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                                                        <td className="px-5 py-3">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${status.bg} ${status.color}`}>
                                                                                    <Shirt size={18} />
                                                                                </div>
                                                                                <div>
                                                                                    <h6 className="text-[12px] font-black text-slate-800 uppercase tracking-tight transition-colors leading-none mb-1 group-hover:text-indigo-600" style={{ color: primaryColor }}>{item.name}</h6>
                                                                                    <div className="flex items-center gap-2">
                                                                                        {item.color && (
                                                                                            <span className="px-1.5 py-0.5 border border-slate-50 bg-white text-slate-400 text-[7px] font-black rounded-md uppercase">COLOR: {item.color}</span>
                                                                                        )}
                                                                                        {item.details && (
                                                                                            <span className="text-[7px] font-bold text-slate-300 italic truncate max-w-[150px]">"{item.details}"</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-5 py-3 text-center">
                                                                            <span className="text-base font-black text-slate-700 tracking-tighter tabular-nums">{item.quantity}</span>
                                                                        </td>
                                                                        <td className="px-5 py-3">

                                                                            <div className="flex items-center justify-center gap-3">
                                                                                {item.images && item.images.length > 0 ? (
                                                                                    <div className="flex -space-x-2">
                                                                                        {item.images.slice(0, 3).map((img, i) => (
                                                                                            <div 
                                                                                                key={i}
                                                                                                onClick={() => setViewedImage(img)}
                                                                                                className="w-8 h-8 rounded-lg border-2 border-white shadow-md overflow-hidden cursor-zoom-in hover:scale-110 active:scale-95 transition-all hover:z-10 bg-slate-100"
                                                                                            >
                                                                                                <img src={img} className="w-full h-full object-cover" />
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-[8px] font-bold text-slate-200 uppercase italic">Sin Fotos</span>
                                                                                )}
                                                                                {item.audioNote && (
                                                                                    <button 
                                                                                        onClick={() => {
                                                                                            const audio = new Audio(item.audioNote!);
                                                                                            audio.play();
                                                                                        }}
                                                                                        className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-all active:scale-90"
                                                                                        style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}
                                                                                    >
                                                                                        <Mic size={14} />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-right">
                                                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-sm ${status.bg} ${status.color}`}>
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
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* PIE DE PÁGINA FIXO COMPACTO */}
                        <div className="px-10 py-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-6 sticky bottom-0 z-50">
                            <div className="flex items-center gap-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,1)]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Normal</p>
                                        <p className="text-[8px] text-slate-400 font-bold mt-0.5 uppercase tracking-tighter italic">ESTÁNDAR</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center border border-red-100">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,1)]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest leading-none">Urgente</p>
                                        <p className="text-[8px] text-slate-400 font-bold mt-0.5 uppercase tracking-tighter italic">PRIORIDAD</p>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedDate(null)}
                                className="w-full sm:w-auto px-12 h-14 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-4"
                                style={{ backgroundColor: primaryColor }}
                            >
                                FINALIZAR REVISIÓN <CheckCircle2 size={18} />
                            </button>
                        </div>
                    </motion.div>
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

            {/* INVOICE DETAIL MODAL */}
            <AnimatePresence>
                {showDetailModal && selectedInvoiceAction && (
                    <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 50 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 50 }}
                            className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
                        >
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center" style={{ backgroundColor: primaryColor + '08' }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-md shrink-0" style={{ backgroundColor: primaryColor }}>
                                        <Hash size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold uppercase tracking-tight text-slate-800">Orden #{selectedInvoiceAction.ordenNumber || '---'}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Detalle del Pedido</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-xl transition-all"><X size={20} /></button>
                            </div>
                            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar bg-slate-50/50">
                                <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm space-y-3">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</span>
                                        <span className="text-sm font-black text-slate-800 uppercase leading-none">{selectedInvoiceAction.client.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teléfono</span>
                                        <span className="text-xs font-mono font-bold text-slate-600">{selectedInvoiceAction.client.phone || 'S/T'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</span>
                                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${selectedInvoiceAction.orderStatus === 'LISTO' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                            {selectedInvoiceAction.orderStatus}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha de Entrega</span>
                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                            {selectedInvoiceAction.deliveryDate ? new Date(selectedInvoiceAction.deliveryDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No definida'}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Prendas y Servicios</h4>
                                    <div className="bg-white border border-slate-200/60 rounded-3xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
                                                    <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Cant</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {(selectedInvoiceAction.items || []).map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="px-5 py-3 font-bold text-slate-700 uppercase">{item.name}</td>
                                                        <td className="px-5 py-3 text-center font-mono font-bold text-slate-600">{item.quantity}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monto Total</span>
                                    <span className="text-lg font-black text-slate-800 font-mono tracking-tighter" style={{ color: primaryColor }}>
                                        {currency} {typeof selectedInvoiceAction.totals?.total === 'number' ? selectedInvoiceAction.totals.total.toFixed(2) : '0.00'}
                                    </span>
                                </div>
                            </div>
                            <div className="p-8 bg-white border-t border-slate-100 flex gap-4">
                                <button 
                                    onClick={() => handleSendWA(selectedInvoiceAction)}
                                    className="flex-1 py-4 bg-[#25D366] text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                                >
                                    <Smartphone size={16} fill="white" /> Enviar Aviso
                                </button>
                                <button 
                                    onClick={() => setShowDetailModal(false)}
                                    className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 text-center"
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

export default Agenda;

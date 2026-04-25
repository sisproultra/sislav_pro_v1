
import React, { useState, useMemo } from 'react';
import { 
    Calendar, ArrowRight, TrendingUp, 
    BadgeDollarSign, CreditCard, ChevronRight, X, User, Receipt,
    Search, Filter, Download, FileText, Smartphone, DollarSign, Wallet
} from 'lucide-react';
import { Invoice, Company, PaymentMethodConfig, InvoiceType } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface MyReportsProps {
    invoices: Invoice[];
    paymentMethods: PaymentMethodConfig[];
    company: Company;
}

interface PaymentDetail {
    ticket: string;
    client: string;
    amount: number;
    date: string;
    invoice: Invoice;
}

const MyReports: React.FC<MyReportsProps> = ({ invoices, paymentMethods, company }) => {
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedPaymentType, setSelectedPaymentType] = useState<{ id: string, name: string, date: string } | null>(null);

    const currency = company.moneda_simbolo || 'S/';

    // --- PROCESAMIENTO DE DATOS ---
    const dailyIncome = useMemo(() => {
        const daysMap: Record<string, { total: number; payments: Record<string, { amount: number; count: number; details: PaymentDetail[] }> }> = {};

        invoices.forEach(inv => {
            const date = inv.date.split('T')[0];
            if (date < startDate || date > endDate) return;

            if (!daysMap[date]) {
                daysMap[date] = { total: 0, payments: {} };
            }

            // Procesar pagos individuales
            if (inv.payments && inv.payments.length > 0) {
                inv.payments.forEach(p => {
                    const methodId = p.metodo_pago_id;
                    const methodName = p.metodo_pago_name || 'OTROS';
                    
                    if (!daysMap[date].payments[methodId]) {
                        daysMap[date].payments[methodId] = { amount: 0, count: 0, details: [] };
                    }

                    daysMap[date].total += p.monto;
                    daysMap[date].payments[methodId].amount += p.monto;
                    daysMap[date].payments[methodId].count += 1;
                    daysMap[date].payments[methodId].details.push({
                        ticket: inv.ordenNumber || inv.correlativo.toString(),
                        client: inv.client.name,
                        amount: p.monto,
                        date: inv.date,
                        invoice: inv
                    });
                });
            } else if (inv.prePaymentAmount && inv.prePaymentAmount > 0) {
                // Fallback para facturación antigua o pagos no desglosados
                const methodId = 'legacy';
                const methodName = inv.paymentMethod || 'EFECTIVO';
                
                if (!daysMap[date].payments[methodId]) {
                    daysMap[date].payments[methodId] = { amount: 0, count: 0, details: [] };
                }

                daysMap[date].total += inv.prePaymentAmount;
                daysMap[date].payments[methodId].amount += inv.prePaymentAmount;
                daysMap[date].payments[methodId].count += 1;
                daysMap[date].payments[methodId].details.push({
                    ticket: inv.ordenNumber || inv.correlativo.toString(),
                    client: inv.client.name,
                    amount: inv.prePaymentAmount,
                    date: inv.date,
                    invoice: inv
                });
            }
        });

        return Object.entries(daysMap)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, data]) => ({ date, ...data }));
    }, [invoices, startDate, endDate]);

    const modalData = useMemo(() => {
        if (!selectedPaymentType) return [];
        const day = dailyIncome.find(d => d.date === selectedPaymentType.date);
        if (!day) return [];
        return day.payments[selectedPaymentType.id]?.details || [];
    }, [selectedPaymentType, dailyIncome]);

    const getPaymentIcon = (methodId: string) => {
        const method = paymentMethods.find(pm => pm.id === methodId);
        if (method?.name?.toLowerCase().includes('yape')) return <Smartphone size={16} />;
        if (method?.name?.toLowerCase().includes('efectivo')) return <Wallet size={16} />;
        if (method?.name?.toLowerCase().includes('tarjeta')) return <CreditCard size={16} />;
        return <DollarSign size={16} />;
    };

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-50 custom-scrollbar animate-in fade-in duration-500">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-indigo-600 font-bold text-[10px] uppercase tracking-widest">
                            <TrendingUp size={14} /> Reportes Personalizados
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Mis Reportes - Ingresos</h2>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl shadow-sm border border-slate-200">
                            <Calendar size={14} className="text-slate-400" />
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)}
                                className="text-[11px] font-bold outline-none bg-transparent text-slate-700" 
                            />
                        </div>
                        <ArrowRight size={12} className="text-slate-400" />
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl shadow-sm border border-slate-200">
                            <Calendar size={14} className="text-slate-400" />
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)}
                                className="text-[11px] font-bold outline-none bg-transparent text-slate-700" 
                            />
                        </div>
                    </div>
                </div>

                {/* LISTA POR DÍAS */}
                <div className="space-y-4">
                    {dailyIncome.length === 0 ? (
                        <div className="bg-white p-16 rounded-[2.5rem] border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-4">
                                <Search size={32} />
                            </div>
                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No hay ingresos registrados en este rango</p>
                        </div>
                    ) : (
                        dailyIncome.map((day) => (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={day.date} 
                                className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden"
                            >
                                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 font-black text-xs">
                                            {day.date.split('-')[2]}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Ingresos del día</p>
                                            <h3 className="text-sm font-black text-slate-900 uppercase">{new Date(day.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none">Total Diario</p>
                                        <p className="text-xl font-black text-indigo-600 tabular-nums">{currency} {day.total.toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {Object.entries(day.payments).map(([methodId, stats]) => {
                                        const methodName = paymentMethods.find(pm => pm.id === methodId)?.name || (methodId === 'legacy' ? 'Ventas' : 'Otros');
                                        return (
                                            <button 
                                                key={methodId}
                                                onClick={() => setSelectedPaymentType({ id: methodId, name: methodName, date: day.date })}
                                                className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all group active:scale-95"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                        {getPaymentIcon(methodId)}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate w-24">{methodName}</p>
                                                        <p className="text-xs font-black text-slate-800">{currency} {stats.amount.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>

                {/* MODAL DE DETALLE */}
                <AnimatePresence>
                    {selectedPaymentType && (
                        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-10">
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setSelectedPaymentType(null)}
                                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                            />
                            
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-full border border-white/20"
                            >
                                {/* Header Modal */}
                                <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                            {getPaymentIcon(selectedPaymentType.id)}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Detalle de Ingresos</p>
                                            <h3 className="text-2xl font-black uppercase leading-tight">{selectedPaymentType.name}</h3>
                                            <p className="text-xs font-bold opacity-80">{new Date(selectedPaymentType.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedPaymentType(null)}
                                        className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Body Modal */}
                                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                                    <div className="space-y-3">
                                        {modalData.map((d, i) => (
                                            <div 
                                                key={i} 
                                                className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                                                        <Receipt size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-800">TICKET: {d.ticket}</p>
                                                        <div className="flex items-center gap-1.5 text-slate-500">
                                                            <User size={10} />
                                                            <span className="text-[10px] font-bold uppercase">{d.client}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-indigo-600 tabular-nums">{currency} {d.amount.toFixed(2)}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {new Date(d.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer Modal */}
                                <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Total en Modal</p>
                                        <p className="text-2xl font-black text-slate-900 tabular-nums">{currency} {modalData.reduce((s, x) => s + x.amount, 0).toFixed(2)}</p>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedPaymentType(null)}
                                        className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
                                    >
                                        Cerrar Detalle
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default MyReports;

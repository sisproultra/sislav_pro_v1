
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Smartphone, Search, RefreshCcw, DollarSign, Clock, 
    Activity, ArrowUpRight, User, RefreshCw, Zap, AlertTriangle, Settings, EyeOff
} from 'lucide-react';
import { YapePayment, fetchYapeMovements, subscribeToYapeMovements } from '../services/yapeService';
import { Company } from '../types';

interface YapeMonitorProps {
    company: Company;
}

const YapeMonitor: React.FC<YapeMonitorProps> = ({ company }) => {
    const [payments, setPayments] = useState<YapePayment[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const tenantId = company.yapeTenantId;

    const loadData = async () => {
        if (!tenantId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        // Traemos siempre los últimos 100 y filtramos en cliente para mayor reactividad y soporte a modos complejos
        const data = await fetchYapeMovements(tenantId);
        setPayments(data);
        setIsLoading(false);
    };

    useEffect(() => {
        if (!tenantId) return;

        loadData();
        
        // Conexión Realtime filtrada por Tenant ID
        const subscription = subscribeToYapeMovements(tenantId, (newPayment) => {
            setPayments(prev => [newPayment, ...prev]);
            try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(() => {});
            } catch (e) {}
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [tenantId]);

    // --- LÓGICA DE FILTRADO BASADA EN AJUSTES ---
    const visiblePayments = useMemo(() => {
        let filtered = [...payments];
        const mode = company.yapeVisibilityMode || 'ALL';
        const now = new Date();

        if (mode === 'TODAY') {
            const todayStr = now.toISOString().split('T')[0];
            filtered = filtered.filter(p => {
                const isToday = p.created_at.startsWith(todayStr);
                if (!isToday) return false;

                // Soporte para rango horario dentro de TODAY
                if (company.yapeStartTime && company.yapeEndTime) {
                    const pDate = new Date(p.created_at);
                    const pTimeStr = pDate.toTimeString().substring(0, 5); // "HH:mm"
                    return pTimeStr >= company.yapeStartTime! && pTimeStr <= company.yapeEndTime!;
                }

                return true;
            });
        } else if (mode === 'CONFIG_24H' && company.yapeConfigTimestamp) {
            const configTime = new Date(company.yapeConfigTimestamp).getTime();
            const limitTime = configTime + (24 * 60 * 60 * 1000);
            filtered = filtered.filter(p => {
                const pTime = new Date(p.created_at).getTime();
                return pTime >= configTime && pTime <= limitTime;
            });
        } else if (mode === 'RANGE' && company.yapeStartTime && company.yapeEndTime) {
            filtered = filtered.filter(p => {
                const pDate = new Date(p.created_at);
                const pTimeStr = pDate.toTimeString().substring(0, 5); // "HH:mm"
                return pTimeStr >= company.yapeStartTime! && pTimeStr <= company.yapeEndTime!;
            });
        }

        // Filtro por buscador
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(p => 
                p.persona?.toLowerCase().includes(term) || 
                p.monto?.toString().includes(term) ||
                p.mensaje_completo?.toLowerCase().includes(term)
            );
        }

        return filtered;
    }, [payments, searchTerm, company.yapeVisibilityMode, company.yapeStartTime, company.yapeEndTime, company.yapeConfigTimestamp]);

    // Estadísticas calculadas sobre el set filtrado
    const ingresosMostrados = visiblePayments.reduce((sum, p) => sum + Number(p.monto), 0);
    const ultimoPago = visiblePayments.length > 0 ? visiblePayments[0] : null;

    if (!tenantId) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-10 text-center bg-slate-50">
                <div className="w-24 h-24 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-purple-100">
                    <Smartphone size={48} />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight mb-4">Módulo Yape no configurado</h2>
                <p className="text-slate-500 max-w-md font-medium leading-relaxed mb-8">
                    Para visualizar sus pagos en tiempo real, debe configurar su <b>Tenant ID</b> en el panel de <b>Configuración Avanzada</b>.
                </p>
                <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-6 py-3 rounded-2xl border border-amber-200">
                    <AlertTriangle size={20} />
                    <span className="text-xs font-bold uppercase tracking-widest">Requiere Credenciales "Yape Llegó"</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 flex flex-col p-6 lg:p-10 overflow-y-auto no-scrollbar animate-in fade-in duration-500">
            {/* Cabecera del Monitor */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 shrink-0">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-[#742484] rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-purple-200 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                        <Smartphone size={32} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-4xl font-bold text-slate-900 tracking-tight uppercase leading-none">Yape Monitor</h2>
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border border-purple-200">ID: {tenantId}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                Filtro: {company.yapeVisibilityMode === 'TODAY' ? 'Solo hoy' : 
                                       company.yapeVisibilityMode === 'RANGE' ? `De ${company.yapeStartTime} a ${company.yapeEndTime}` :
                                       company.yapeVisibilityMode === 'CONFIG_24H' ? 'Modo 24 Horas' : 'Todos'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80 group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-purple-500 transition-colors" size={20} />
                        <input 
                            type="text" 
                            placeholder="Buscar persona o monto..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white border-2 border-slate-100 rounded-[1.8rem] py-4 pl-14 pr-6 text-base font-bold outline-none focus:border-purple-200 focus:ring-8 focus:ring-purple-50 transition-all shadow-sm text-slate-700"
                        />
                    </div>
                    <button 
                        onClick={loadData}
                        disabled={isLoading}
                        className="bg-[#742484] hover:bg-purple-900 text-white px-8 py-4 rounded-[1.8rem] font-bold text-xs uppercase tracking-widest shadow-xl shadow-purple-200 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                    >
                        <RefreshCcw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* KPIs - Tablero de Control */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                        <DollarSign size={120} />
                    </div>
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-inner">
                            <DollarSign size={28} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border">Vista Actual</span>
                    </div>
                    <h4 className="text-5xl font-bold text-slate-900 tabular-nums tracking-tight">S/ {ingresosMostrados.toFixed(2)}</h4>
                    <p className="text-[11px] font-bold text-emerald-500 uppercase mt-4 tracking-widest flex items-center gap-1.5">
                        <ArrowUpRight size={14} /> Recaudación Filtrada
                    </p>
                </div>

                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-inner">
                            <Clock size={28} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border">Último</span>
                    </div>
                    <h4 className="text-5xl font-bold text-slate-900 tabular-nums tracking-tight">
                        {ultimoPago ? `S/ ${Number(ultimoPago.monto).toFixed(2)}` : 'S/ 0.00'}
                    </h4>
                    <p className="text-[11px] font-bold text-blue-500 uppercase mt-4 tracking-widest">
                        {ultimoPago ? new Date(ultimoPago.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--:--'}
                    </p>
                </div>

                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all duration-500">
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 border border-purple-100 shadow-inner">
                            <Activity size={28} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border">Mostrados</span>
                    </div>
                    <h4 className="text-5xl font-bold text-slate-900 tabular-nums tracking-tight">{visiblePayments.length}</h4>
                    <p className="text-[11px] font-bold text-purple-500 uppercase mt-4 tracking-widest italic">Transacciones en Pantalla</p>
                </div>
            </div>

            {/* Listado de Pagos */}
            <div className="space-y-8 pb-32">
                <div className="flex justify-between items-center px-4">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                        <RefreshCw size={14} className="animate-spin-slow" /> Flujo de Caja Yape ({tenantId})
                    </h3>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Live Feed</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {visiblePayments.map((p, idx) => (
                        <div 
                            key={p.id || idx} 
                            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl hover:border-purple-200 transition-all animate-in slide-in-from-bottom-4 duration-500" 
                            style={{ animationDelay: `${idx * 50}ms` }}
                        >
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 font-bold text-xl border-4 border-white shadow-inner group-hover:bg-purple-50 group-hover:text-purple-600 transition-all duration-300 uppercase">
                                    {p.persona?.charAt(0) || <User size={24}/>}
                                </div>
                                <div>
                                    <h4 className="font-bold text-base text-slate-800 uppercase tracking-tight leading-none mb-2 group-hover:text-purple-700 transition-colors">
                                        {p.persona || 'EMISOR DESCONOCIDO'}
                                    </h4>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 uppercase">
                                            <Clock size={12} className="text-slate-300" /> 
                                            {new Date(p.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                                        <span className="bg-purple-50 text-[#742484] px-3 py-1 rounded-xl text-[9px] font-bold uppercase tracking-tight border border-purple-100 animate-pulse">
                                            <Zap size={10} className="inline mr-1" fill="currentColor"/> ¡LLEGÓ YAPE!
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="text-3xl font-bold text-emerald-600 tabular-nums leading-none mb-1.5 tracking-tight">
                                    S/ {Number(p.monto).toFixed(2)}
                                </div>
                                <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">Confirmado</div>
                            </div>
                        </div>
                    ))}

                    {visiblePayments.length === 0 && !isLoading && (
                        <div className="py-40 text-center flex flex-col items-center gap-6 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 shadow-inner">
                                <EyeOff size={48} />
                            </div>
                            <div className="space-y-2">
                                <p className="text-base font-bold text-slate-400 uppercase tracking-[0.2em]">Sinyapadas en este filtro</p>
                                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Pruebe cambiando los ajustes de visibilidad en el menú Ajustes.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .animate-spin-slow { animation: spin 4s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

export default YapeMonitor;

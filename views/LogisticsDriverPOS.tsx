
import React, { useState, useEffect, useRef } from 'react';
import { 
    Truck, Package, MapPin, User, Calendar, Clock, CheckCircle2, 
    XCircle, Loader2, ArrowRight, AlertTriangle, RefreshCw, 
    LogOut, Smartphone, Box, Navigation, QrCode, Camera, X
} from 'lucide-react';
import { GuiaRemision, OrderStatus } from '../types';
import { dbGetGuiasRemision, dbUpdateGuiaEstado, dbGetGuiaDetails, dbUpdateGuiaItemStatus, getActiveUserId } from '../services/dbService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LogisticsDriverPOSProps {
    onLogout: () => void;
}

const LogisticsDriverPOS: React.FC<LogisticsDriverPOSProps> = ({ onLogout }) => {
    const [guias, setGuias] = useState<GuiaRemision[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedGuia, setSelectedGuia] = useState<GuiaRemision | null>(null);
    const [guiaItems, setGuiaItems] = useState<any[]>([]);
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [missingItems, setMissingItems] = useState<Record<string, boolean>>({});
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const notifiedGuias = useRef<Set<string>>(new Set());

    // Notification Sound
    const playNotification = () => {
        try {
            // Sonido de burbujas personalizado
            const audio = new Audio('https://yvgshdypqanlcgxdyvls.supabase.co/storage/v1/object/public/laundry-assets/burbujas.mp3');
            audio.volume = 0.6;
            audio.play();
        } catch (e) {
            console.warn("Could not play notification sound", e);
        }
    };

    useEffect(() => {
        loadMyGuias();

        // Real-time subscription for new/updated guias
        const channel = (async () => {
            const { supabase } = await import('../services/dbService');
            return supabase
                .channel('guias_remision_changes')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'guias_remision' 
                }, () => {
                    console.log("🔄 Real-time update: Reloading guias...");
                    loadMyGuias();
                })
                .subscribe();
        })();

        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            channel.then(c => c.unsubscribe());
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
    };

    const loadMyGuias = async () => {
        setIsLoading(true);
        try {
            const userId = getActiveUserId();
            // Cargamos tanto PENDIENTE como EN_TRANSITO del chofer
            const data = await dbGetGuiasRemision({ chofer_id: userId! }); 
            const filtered = data.filter(g => g.estado === 'PENDIENTE' || g.estado === 'EN_TRANSITO');
            
            // Lógica de notificación sonora para nuevas guías PENDIENTES
            const pendingIds = filtered.filter(g => g.estado === 'PENDIENTE').map(g => g.id);
            let hasNew = false;
            
            if (notifiedGuias.current.size === 0) {
                // Primera carga: registramos lo existente sin sonar
                pendingIds.forEach(id => notifiedGuias.current.add(id));
            } else {
                // Cargas posteriores (tiempo real): si hay un ID que no estaba, notificamos
                pendingIds.forEach(id => {
                    if (!notifiedGuias.current.has(id)) {
                        notifiedGuias.current.add(id);
                        hasNew = true;
                    }
                });
            }

            if (hasNew) {
                playNotification();
            }

            setGuias(filtered);
        } catch (error) {
            console.error("Error loading driver guias:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewDetails = async (guia: GuiaRemision) => {
        setSelectedGuia(guia);
        setIsLoadingDetails(true);
        setCheckedItems({});
        setMissingItems({});
        try {
            const items = await dbGetGuiaDetails(guia.id);
            setGuiaItems(items);
            // Si ya está en tránsito, marcar todos como checked por defecto para visualización
            if (guia.estado === 'EN_TRANSITO') {
            // Pre-marcar items que ya están cargados o no son faltantes
            const initialChecked: Record<string, boolean> = {};
            items.forEach((it: any) => {
                const itemId = it.item_venta_id || it.item_id;
                if (it.estado_item !== 'FALTANTE' && itemId) initialChecked[itemId] = true;
            });
            setCheckedItems(initialChecked);
            }
        } catch (error) {
            console.error("Error loading guia details:", error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const toggleItemCheck = (itemId: string) => {
        if (selectedGuia?.estado !== 'PENDIENTE') return;
        setCheckedItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
        if (missingItems[itemId]) {
            setMissingItems(prev => ({ ...prev, [itemId]: false }));
        }
    };

    const toggleItemMissing = (itemId: string) => {
        if (selectedGuia?.estado !== 'PENDIENTE') return;
        setMissingItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
        if (checkedItems[itemId]) {
            setCheckedItems(prev => ({ ...prev, [itemId]: false }));
        }
    };

    const allItemsProcessed = guiaItems.length > 0 && guiaItems.every(it => {
        const itemId = it.item_venta_id || it.item_id;
        return checkedItems[itemId] || missingItems[itemId];
    });

    const handleUpdateStatus = async (nuevoEstadoGuia: 'EN_TRANSITO' | 'ENTREGADO') => {
        if (!selectedGuia) return;
        
        const confirmMsg = nuevoEstadoGuia === 'EN_TRANSITO' 
            ? "¿Confirmas que has recogido las prendas marcadas y están bajo tu custodia?"
            : "¿Confirmas que has entregado las prendas en el destino?";
            
        if (!window.confirm(confirmMsg)) return;

        setIsUpdating(true);
        try {
            const itemsToProcess = Object.keys(checkedItems).filter(id => checkedItems[id]);
            const itemsMissing = Object.keys(missingItems).filter(id => missingItems[id]);

            // 1. Actualizar items faltantes en la guía
            for (const itemId of itemsMissing) {
                await dbUpdateGuiaItemStatus(selectedGuia.id, itemId, 'FALTANTE');
            }

            // 2. Actualizar items recibidos en la guía
            for (const itemId of itemsToProcess) {
                await dbUpdateGuiaItemStatus(selectedGuia.id, itemId, 'CARGADO');
            }

            // 3. Actualizar estado de la guía y de los items_venta (solo los procesados)
            let nuevoEstadoItem: OrderStatus;
            if (nuevoEstadoGuia === 'EN_TRANSITO') {
                nuevoEstadoItem = selectedGuia.tipo_guia === 'RECOJO' ? 'EN_TRANSITO_CENTRAL' : 'EN_TRANSITO_ACOPIO';
            } else {
                nuevoEstadoItem = selectedGuia.tipo_guia === 'RECOJO' ? 'RECIBIDO_CENTRAL' : 'RECIBIDO_ACOPIO';
            }

            await dbUpdateGuiaEstado(selectedGuia.id, nuevoEstadoGuia, nuevoEstadoItem, itemsToProcess);
            
            setSelectedGuia(null);
            loadMyGuias();
        } catch (error) {
            console.error("Error updating logistics status:", error);
            alert("Error al actualizar el estado.");
        } finally {
            setIsUpdating(false);
        }
    };

    const groupedItems = guiaItems.reduce((acc: any, item: any) => {
        const orderId = item.items_venta?.ventas?.id || 'no-order';
        if (!acc[orderId]) acc[orderId] = { 
            orderNumber: item.items_venta?.ventas?.codigo_orden || '---',
            client: item.items_venta?.ventas?.clientes?.nombre_completo || item.items_venta?.ventas?.clientes?.nombres,
            items: [] 
        };
        acc[orderId].items.push(item);
        return acc;
    }, {});

    if (selectedGuia) {
        return (
            <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-6 bg-slate-900 text-white shrink-0 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSelectedGuia(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowRight className="rotate-180" size={24} />
                        </button>
                        <div>
                            <h3 className="font-black text-xl">{selectedGuia.codigo_guia}</h3>
                            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{selectedGuia.tipo_guia}</p>
                        </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        selectedGuia.estado === 'PENDIENTE' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                    }`}>
                        {selectedGuia.estado}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
                    {/* ROUTE INFO */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Origen</p>
                                <p className="font-black text-slate-800">{selectedGuia.sucursal_origen?.nombre_sucursal}</p>
                                <p className="text-xs text-slate-500">{selectedGuia.sucursal_origen?.direccion}</p>
                            </div>
                        </div>
                        <div className="ml-5 border-l-2 border-dashed border-slate-200 h-8" />
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                <Navigation size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Destino</p>
                                <p className="font-black text-slate-800">{selectedGuia.sucursal_destino?.nombre_sucursal}</p>
                                <p className="text-xs text-slate-500">{selectedGuia.sucursal_destino?.direccion}</p>
                            </div>
                        </div>
                    </div>

                    {/* ITEMS LIST */}
                    <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Package size={14} /> Contenido de la Guía
                        </h4>
                        <div className="space-y-3">
                            {isLoadingDetails ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-accent" /></div>
                            ) : (
                                Object.entries(groupedItems).map(([orderId, group]: [string, any]) => (
                                    <div key={orderId} className="space-y-3">
                                        <div className="flex items-center gap-2 px-2">
                                            <Package size={14} className="text-slate-400" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Orden #{group.orderNumber} • {group.client}
                                            </span>
                                        </div>
                                        {group.items.map((item: any, idx: number) => {
                                            const itemId = item.item_venta_id || item.item_id;
                                            return (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => toggleItemCheck(itemId)}
                                                    className={`bg-white p-4 rounded-2xl border transition-all shadow-sm flex items-center gap-4 cursor-pointer ${
                                                        checkedItems[itemId] ? 'border-emerald-200 bg-emerald-50/30' : 
                                                        missingItems[itemId] ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'
                                                    }`}
                                                >
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                        checkedItems[itemId] ? 'bg-emerald-100 text-emerald-600' : 
                                                        missingItems[itemId] ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-400'
                                                    }`}>
                                                        {checkedItems[itemId] ? <CheckCircle2 size={20} /> : 
                                                         missingItems[itemId] ? <XCircle size={20} /> : <Box size={20} />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-black text-slate-800 leading-tight">{item.items_venta?.descripcion}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                            {item.items_venta?.cantidad} {item.items_venta?.codigo_unidad}
                                                        </p>
                                                    </div>
                                                    {selectedGuia.estado === 'PENDIENTE' && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); toggleItemMissing(itemId); }}
                                                            className={`p-2 rounded-lg transition-colors ${missingItems[itemId] ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-600'}`}
                                                        >
                                                            <AlertTriangle size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-white border-t border-slate-100 shrink-0">
                    {selectedGuia.estado === 'PENDIENTE' ? (
                        <button
                            onClick={() => handleUpdateStatus('EN_TRANSITO')}
                            disabled={isUpdating || !allItemsProcessed}
                            className="w-full py-5 bg-accent text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-accent/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                        >
                            {isUpdating ? <Loader2 className="animate-spin" /> : <><Truck size={20} /> INICIAR TRASLADO</>}
                        </button>
                    ) : (
                        <button
                            onClick={() => handleUpdateStatus('ENTREGADO')}
                            disabled={isUpdating}
                            className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
                        >
                            {isUpdating ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20} /> CONFIRMAR ENTREGA</>}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
            {/* MOBILE HEADER */}
            <header className="p-6 bg-white border-b border-slate-200 shrink-0 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/20">
                        <Truck size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 leading-none">SISLAV LOGÍSTICA</h1>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Panel del Chofer</p>
                    </div>
                </div>
                <button 
                    onClick={onLogout}
                    className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-rose-500 transition-colors"
                >
                    <LogOut size={20} />
                </button>
            </header>

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Mis Guías Asignadas</h2>
                    <button onClick={loadMyGuias} className="p-2 text-accent hover:bg-accent/10 rounded-full transition-all">
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="animate-spin text-accent" size={40} />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargando rutas...</p>
                    </div>
                ) : guias.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center p-10">
                        <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                            <Box size={32} className="text-slate-200" />
                        </div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">Todo al día</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">No tienes guías pendientes de recojo o entrega en este momento.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {guias.map((guia) => (
                            <button
                                key={guia.id}
                                onClick={() => handleViewDetails(guia)}
                                className="w-full bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm text-left flex items-center justify-between active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                        guia.estado === 'PENDIENTE' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
                                    }`}>
                                        <Truck size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-800">{guia.codigo_guia}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{guia.sucursal_origen?.nombre_sucursal}</span>
                                            <ArrowRight size={8} className="text-slate-300" />
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{guia.sucursal_destino?.nombre_sucursal}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    guia.estado === 'PENDIENTE' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                                } shadow-lg shadow-current/20`}>
                                    <ArrowRight size={16} />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </main>

            {/* SCANNER BUTTON (FLOATING) */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                <button 
                    onClick={() => setShowScanner(true)}
                    className="bg-slate-900 text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3 active:scale-95 transition-all"
                >
                    <QrCode size={20} /> ESCANEAR QR
                </button>
            </div>

            {/* PWA INSTALL PROMPT */}
            {showInstallPrompt && (
                <div className="fixed bottom-24 left-4 right-4 bg-accent text-white p-6 rounded-[2.5rem] shadow-2xl z-[300] animate-in slide-in-from-bottom-10 duration-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                            <Smartphone size={24} />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-black text-sm uppercase tracking-widest">Instalar Aplicación</h4>
                            <p className="text-[10px] font-bold opacity-80 leading-tight mt-1">
                                Instala SISLAV LOGÍSTICA en tu pantalla de inicio para un acceso más rápido y mejor experiencia.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={handleInstallClick}
                                className="px-4 py-2 bg-white text-accent rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                            >
                                INSTALAR
                            </button>
                            <button 
                                onClick={() => setShowInstallPrompt(false)}
                                className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100"
                            >
                                LUEGO
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SCANNER MODAL */}
            {showScanner && (
                <div className="fixed inset-0 bg-black z-[200] flex flex-col">
                    <div className="p-6 flex justify-between items-center text-white">
                        <h3 className="font-black text-lg uppercase tracking-widest">Escáner de Guías</h3>
                        <button onClick={() => setShowScanner(false)} className="p-2"><X size={24} /></button>
                    </div>
                    <div className="flex-1 flex items-center justify-center relative">
                        <div className="w-64 h-64 border-4 border-accent rounded-3xl relative">
                            <div className="absolute inset-0 border-2 border-white/20 rounded-2xl animate-pulse" />
                            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-accent shadow-[0_0_15px_rgba(0,163,255,0.8)] animate-scan" />
                        </div>
                        <p className="absolute bottom-20 text-white/50 text-[10px] font-bold uppercase tracking-[0.3em]">Apunta al código QR de la guía</p>
                    </div>
                    <div className="p-10 bg-slate-900 text-center">
                        <p className="text-white text-xs font-bold uppercase tracking-widest mb-4">¿No funciona el escáner?</p>
                        <button className="text-accent text-[10px] font-black uppercase tracking-widest underline">Ingresar código manualmente</button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes scan {
                    0%, 100% { top: 0; }
                    50% { top: 100%; }
                }
                .animate-scan {
                    animation: scan 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default LogisticsDriverPOS;

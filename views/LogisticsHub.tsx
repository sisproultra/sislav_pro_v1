
import React, { useState, useEffect } from 'react';
import { 
    Truck, Package, MapPin, User, Calendar, Clock, CheckCircle2, 
    XCircle, Loader2, Search, Filter, ArrowRight, ChevronDown, 
    ChevronUp, AlertTriangle, RefreshCw, Eye, Download, Printer,
    ArrowDownLeft, ArrowUpRight, Box, Plus, Send
} from 'lucide-react';
import { GuiaRemision, OrderStatus } from '../types';
import { dbGetGuiasRemision, dbGetGuiaDetails, dbUpdateGuiaEstado, getActiveBranchId, dbGetItemsPendientesLogistica, dbGetSucursalById, dbUpdateGuiaItemStatus } from '../services/dbService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import LogisticsBulkDispatchModal from '../components/LogisticsBulkDispatchModal';

const LogisticsHub: React.FC = () => {
    const [guias, setGuias] = useState<GuiaRemision[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'INCOMING' | 'OUTGOING' | 'HISTORY'>('INCOMING');
    const [selectedGuia, setSelectedGuia] = useState<GuiaRemision | null>(null);
    const [guiaItems, setGuiaItems] = useState<any[]>([]);
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [missingItems, setMissingItems] = useState<Record<string, boolean>>({});
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [summary, setSummary] = useState({ incoming: 0, outgoing: 0, pending: 0 });
    
    const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
    const [pendingItems, setPendingItems] = useState<any[]>([]);
    const [isLoadingPending, setIsLoadingPending] = useState(false);
    const [sucursalInfo, setSucursalInfo] = useState<any>(null);

    const currentBranchId = getActiveBranchId();

    useEffect(() => {
        loadGuias();
        loadSucursalInfo();
    }, [activeTab]);

    const loadSucursalInfo = async () => {
        if (!currentBranchId) return;
        try {
            const info = await dbGetSucursalById(currentBranchId);
            setSucursalInfo(info);
        } catch (e) {
            console.error(e);
        }
    };

    const handleOpenDispatch = async () => {
        if (!sucursalInfo) return;
        setIsLoadingPending(true);
        try {
            const items = await dbGetItemsPendientesLogistica(currentBranchId!, sucursalInfo.tipo_sucursal);
            // Mapear para que coincida con el formato de OperationItem si es necesario
            const mappedItems = items.map((it: any) => {
                const ventaObj = Array.isArray(it.ventas) ? it.ventas[0] : it.ventas;
                const clienteObj = Array.isArray(ventaObj?.clientes) ? ventaObj?.clientes[0] : ventaObj?.clientes;
                
                return {
                    ...it,
                    uniqueId: it.id,
                    clientName: clienteObj?.nombres || clienteObj?.nombre || clienteObj?.razon_social || 'Cliente',
                    ticketNumber: ventaObj?.codigo_orden || '---'
                };
            });
            setPendingItems(mappedItems);
            setIsDispatchModalOpen(true);
        } catch (error) {
            console.error("Error loading pending items:", error);
            alert("Error al cargar prendas pendientes.");
        } finally {
            setIsLoadingPending(false);
        }
    };

    const loadGuias = async () => {
        setIsLoading(true);
        try {
            let data: GuiaRemision[] = [];
            
            if (activeTab === 'INCOMING') {
                data = await dbGetGuiasRemision({
                    sucursal_destino_id: currentBranchId!,
                    estado: 'EN_TRANSITO'
                });
            } else if (activeTab === 'OUTGOING') {
                // Salientes: Pendientes y En Tránsito
                const pending = await dbGetGuiasRemision({
                    sucursal_origen_id: currentBranchId!,
                    estado: 'PENDIENTE'
                });
                const transit = await dbGetGuiasRemision({
                    sucursal_origen_id: currentBranchId!,
                    estado: 'EN_TRANSITO'
                });
                data = [...pending, ...transit].sort((a, b) => 
                    new Date(b.fecha_registro).getTime() - new Date(a.fecha_registro).getTime()
                );
            } else {
                // Historia: Entregadas
                data = await dbGetGuiasRemision({
                    sucursal_id: currentBranchId!,
                    estado: 'ENTREGADO'
                });
            }
            
            setGuias(data);

            // Calculate summaries for the dashboard
            if (activeTab === 'INCOMING') {
                setSummary(prev => ({ ...prev, incoming: data.length }));
            }
            
            // Fetch total pending to dispatch for the summary
            if (sucursalInfo) {
                const pendItems = await dbGetItemsPendientesLogistica(currentBranchId!, sucursalInfo.tipo_sucursal);
                setSummary(prev => ({ 
                    ...prev, 
                    pending: pendItems.length,
                    outgoing: data.filter(g => g.estado === 'EN_TRANSITO' && g.sucursal_origen_id === currentBranchId).length
                }));
            }
        } catch (error) {
            console.error("Error loading guias:", error);
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
            
            // Si es entrante y ya está en tránsito, podemos pre-marcar los que no son faltantes
            if (activeTab === 'INCOMING') {
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
        if (activeTab !== 'INCOMING') return;
        setCheckedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
        if (missingItems[itemId]) setMissingItems(prev => ({ ...prev, [itemId]: false }));
    };

    const toggleItemMissing = (itemId: string) => {
        if (activeTab !== 'INCOMING') return;
        setMissingItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
        if (checkedItems[itemId]) setCheckedItems(prev => ({ ...prev, [itemId]: false }));
    };

    const allItemsProcessed = guiaItems.length > 0 && guiaItems.every(it => {
        const itemId = it.item_venta_id || it.item_id;
        return checkedItems[itemId] || missingItems[itemId];
    });

    const handleReceiveGuia = async () => {
        if (!selectedGuia) return;
        if (!window.confirm("¿Confirmas que has recibido las prendas marcadas en esta guía?")) return;

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
                await dbUpdateGuiaItemStatus(selectedGuia.id, itemId, 'RECIBIDO');
            }

            const nuevoEstado = selectedGuia.tipo_guia === 'RECOJO' ? 'RECIBIDO_CENTRAL' : 'RECIBIDO_ACOPIO';
            
            await dbUpdateGuiaEstado(selectedGuia.id, 'ENTREGADO', nuevoEstado, itemsToProcess);
            setSelectedGuia(null);
            loadGuias();
        } catch (error) {
            console.error("Error updating guia status:", error);
            alert("Error al recibir la guía.");
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

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* HEADER */}
            <div className="p-6 bg-white border-b border-slate-200 shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-accent rounded-xl text-white shadow-lg shadow-accent/20">
                                <Truck size={24} />
                            </div>
                            LOGÍSTICA HUB & SPOKE
                        </h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión de traslados y custodia de prendas</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleOpenDispatch}
                            disabled={isLoadingPending}
                            className="px-6 py-3 bg-accent hover:bg-accent/90 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-accent/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {isLoadingPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                            NUEVO ENVÍO
                        </button>

                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                        <button 
                            onClick={() => setActiveTab('INCOMING')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'INCOMING' ? 'bg-white text-accent shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <ArrowDownLeft size={14} /> ENTRANTES
                        </button>
                        <button 
                            onClick={() => setActiveTab('OUTGOING')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'OUTGOING' ? 'bg-white text-accent shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <ArrowUpRight size={14} /> SALIENTES
                        </button>
                        <button 
                            onClick={() => setActiveTab('HISTORY')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-white text-accent shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Clock size={14} /> HISTORIAL
                        </button>
                    </div>
                </div>
            </div>
        </div>

            {/* DASHBOARD SUMMARY */}
            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white border-b border-slate-100">
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                        <Box size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pendiente de Envío</p>
                        <h4 className="text-xl font-black text-slate-800">{summary.pending} <span className="text-[10px] text-slate-400">PRENDAS</span></h4>
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Truck size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En Tránsito (Delivery)</p>
                        <h4 className="text-xl font-black text-slate-800">{summary.outgoing} <span className="text-[10px] text-slate-400">GUÍAS</span></h4>
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <ArrowDownLeft size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingresos Pendientes</p>
                        <h4 className="text-xl font-black text-slate-800">{summary.incoming} <span className="text-[10px] text-slate-400">GUÍAS</span></h4>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row p-6 gap-6">
                
                {/* LIST OF GUIAS */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="animate-spin text-accent" size={40} />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronizando logística...</p>
                        </div>
                    ) : guias.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                            <Box size={48} className="text-slate-200 mb-4" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay guías en esta sección</p>
                        </div>
                    ) : (
                        guias.map((guia) => (
                            <button
                                key={guia.id}
                                onClick={() => handleViewDetails(guia)}
                                className={`w-full p-5 rounded-[2rem] border transition-all text-left flex items-center justify-between group bg-white ${
                                    selectedGuia?.id === guia.id 
                                        ? 'border-accent shadow-xl shadow-accent/5 ring-4 ring-accent/5' 
                                        : 'border-slate-100 hover:border-slate-300 shadow-sm'
                                }`}
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                                        selectedGuia?.id === guia.id ? 'bg-accent text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                                    }`}>
                                        <Truck size={28} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg font-black text-slate-800">{guia.codigo_guia}</span>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                                                guia.tipo_guia === 'RECOJO' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                            }`}>
                                                {guia.tipo_guia}
                                            </span>
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                                                guia.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-600' : 
                                                guia.estado === 'EN_TRANSITO' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                                            }`}>
                                                {guia.estado}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            <span className="flex items-center gap-1"><MapPin size={10} /> {guia.sucursal_origen?.nombre_sucursal}</span>
                                            <ArrowRight size={10} />
                                            <span className="flex items-center gap-1"><MapPin size={10} /> {guia.sucursal_destino?.nombre_sucursal}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black text-slate-800">{format(new Date(guia.fecha_registro), 'dd MMM, HH:mm', { locale: es })}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center justify-end gap-1">
                                        <User size={10} /> {guia.chofer?.nombre_completo}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* DETAILS PANEL */}
                <div className="w-full md:w-[400px] shrink-0">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full min-h-[500px]">
                        {!selectedGuia ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                                    <Eye size={32} className="text-slate-200" />
                                </div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">Detalles de Guía</h4>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Selecciona una guía de la lista para ver el contenido y procesar el recibo.</p>
                            </div>
                        ) : (
                            <>
                                <div className="p-6 bg-slate-900 text-white shrink-0">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-[10px] font-black bg-accent px-3 py-1 rounded-full uppercase tracking-[0.2em]">Detalle de Carga</span>
                                        <button onClick={() => setSelectedGuia(null)} className="text-white/30 hover:text-white transition-colors"><XCircle size={24} /></button>
                                    </div>
                                    <h3 className="text-2xl font-black mb-1">{selectedGuia.codigo_guia}</h3>
                                    <p className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                                        <User size={12} /> Chofer: {selectedGuia.chofer?.nombre_completo}
                                    </p>
                                </div>

                                 <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                                    {isLoadingDetails ? (
                                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                                            <Loader2 className="animate-spin text-accent" size={24} />
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cargando prendas...</p>
                                        </div>
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
                                                            className={`bg-white p-4 rounded-2xl border transition-all shadow-sm flex items-center gap-4 ${activeTab === 'INCOMING' ? 'cursor-pointer' : ''} ${
                                                                checkedItems[itemId] ? 'border-emerald-200 bg-emerald-50/30' : 
                                                                missingItems[itemId] ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'
                                                            }`}
                                                        >
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                                checkedItems[itemId] ? 'bg-emerald-100 text-emerald-600' : 
                                                                missingItems[itemId] ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-400'
                                                            }`}>
                                                                {checkedItems[itemId] ? <CheckCircle2 size={20} /> : 
                                                                 missingItems[itemId] ? <XCircle size={20} /> : <Package size={20} />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-sm font-black text-slate-800 leading-tight">{item.items_venta?.descripcion}</p>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                                    {item.items_venta?.cantidad} {item.items_venta?.codigo_unidad}
                                                                </p>
                                                            </div>
                                                            {activeTab === 'INCOMING' && (
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

                                {activeTab === 'INCOMING' && (
                                    <div className="p-6 bg-white border-t border-slate-100">
                                        <button
                                            onClick={handleReceiveGuia}
                                            disabled={isUpdating || isLoadingDetails || !allItemsProcessed}
                                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                                        >
                                            {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle2 size={20} /> CONFIRMAR RECEPCIÓN</>}
                                        </button>
                                        <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest mt-4 leading-relaxed">
                                            Al confirmar, las prendas marcadas pasarán a estado "RECIBIDO" y se registrará la custodia en tu sucursal.
                                        </p>
                                    </div>
                                )}

                                {activeTab === 'OUTGOING' && (
                                    <div className="p-6 bg-white border-t border-slate-100">
                                        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                                            <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                                            <p className="text-[10px] text-amber-800 font-bold uppercase leading-tight">
                                                Esta guía está en tránsito. El chofer {selectedGuia.chofer?.nombre_completo} tiene la custodia actual.
                                            </p>
                                        </div>
                                        <button className="w-full mt-4 py-3 border-2 border-slate-200 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                                            <Printer size={14} /> REIMPRIMIR GUÍA
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <LogisticsBulkDispatchModal
                isOpen={isDispatchModalOpen}
                onClose={() => setIsDispatchModalOpen(false)}
                selectedItems={pendingItems}
                type={sucursalInfo?.tipo_sucursal === 'CENTRAL' ? 'RETORNO' : 'RECOJO'}
                onSuccess={() => {
                    loadGuias();
                    setPendingItems([]);
                }}
            />
        </div>
    );
};

export default LogisticsHub;

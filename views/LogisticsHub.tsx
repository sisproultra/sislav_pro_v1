
import React, { useState, useEffect } from 'react';
import { 
    Truck, Package, MapPin, User, Calendar, Clock, CheckCircle2, 
    XCircle, Loader2, Search, Filter, ArrowRight, ChevronDown, 
    ChevronUp, AlertTriangle, RefreshCw, Eye, Download, Printer,
    ArrowDownLeft, ArrowUpRight, Box, Plus, Send, History, BellRing
} from 'lucide-react';
import { GuiaRemision, OrderStatus, UserRole } from '../types';
import { 
    dbGetGuiasRemision, dbGetGuiaDetails, dbUpdateGuiaEstado, 
    getActiveBranchId, dbGetItemsPendientesLogistica, 
    dbGetSucursalById, dbUpdateGuiaItemStatus, dbGetItemLogisticsHistory,
    dbGetItemsEnPlanta, dbUpdateMultipleItemsStatus, getActiveUserId, getActiveUserName
} from '../services/dbService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import LogisticsBulkDispatchModal from '../components/LogisticsBulkDispatchModal';
import { printGuiaRemision } from '../utils/printUtils';

interface LogisticsHubProps {
    currentUser?: any;
}

const LogisticsHub: React.FC<LogisticsHubProps> = ({ currentUser }) => {
    const [guias, setGuias] = useState<GuiaRemision[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'INCOMING' | 'OUTGOING' | 'HISTORY' | 'PLANTA'>('INCOMING');
    
    // Search states
    const [plantaSearch, setPlantaSearch] = useState('');
    const [historySearch, setHistorySearch] = useState('');
    
    const isMaster = (currentUser?.role === UserRole.SAAS_MASTER) || (localStorage.getItem('sislav_current_user_role') === UserRole.SAAS_MASTER);
    const [selectedGuia, setSelectedGuia] = useState<GuiaRemision | null>(null);
    const [guiaItems, setGuiaItems] = useState<any[]>([]);
    const [plantaItems, setPlantaItems] = useState<any[]>([]);
    const [selectedPlantaItems, setSelectedPlantaItems] = useState<Record<string, boolean>>({});
    const [isLoadingPlanta, setIsLoadingPlanta] = useState(false);
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [missingItems, setMissingItems] = useState<Record<string, boolean>>({});
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [summary, setSummary] = useState({ incoming: 0, outgoing: 0, pending: 0 });

    // Custom Confirm/Message Modal
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm?: () => void;
        type: 'CONFIRM' | 'ALERT';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'ALERT'
    });

    const showAlert = (message: string, title: string = "Atención") => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            type: 'ALERT'
        });
    };
    
    const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
    const [pendingItems, setPendingItems] = useState<any[]>([]);
    const [isLoadingPending, setIsLoadingPending] = useState(false);
    const [sucursalInfo, setSucursalInfo] = useState<any>(null);
    const [selectedItemHistory, setSelectedItemHistory] = useState<any[] | null>(null);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [historyItemId, setHistoryItemId] = useState<string | null>(null);

    const currentBranchId = getActiveBranchId();

    useEffect(() => {
        loadGuias();
        loadSucursalInfo();
        if (activeTab === 'PLANTA') loadPlantaItems();

        // Real-time subscription for Logistics Hub
        const subscribeRealtime = async () => {
            const { supabase } = await import('../services/dbService');
            
            const guiasChannel = supabase
                .channel('logistics_hub_guias')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'guias_remision' 
                }, () => {
                    console.log("🔄 Real-time update: Reloading guias...");
                    loadGuias();
                })
                .subscribe();

            const itemsChannel = supabase
                .channel('logistics_hub_items')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'items_venta' 
                }, (payload: any) => {
                    // Solo recargar planta si el item está en planta o cambió a un estado de planta
                    if (activeTab === 'PLANTA' || payload.new?.estado?.includes('CENTRAL')) {
                        loadPlantaItems();
                    }
                    // También actualizar summary general
                    loadGuias();
                })
                .subscribe();

            return () => {
                guiasChannel.unsubscribe();
                itemsChannel.unsubscribe();
            };
        };

        const cleanupPromise = subscribeRealtime();
        return () => {
            cleanupPromise.then(cleanup => cleanup());
        };
    }, [activeTab]);

    const loadPlantaItems = async () => {
        if (!currentBranchId) return;
        setIsLoadingPlanta(true);
        try {
            const items = await dbGetItemsEnPlanta(currentBranchId);
            setPlantaItems(items);
        } catch (error) {
            console.error("Error loading planta items:", error);
        } finally {
            setIsLoadingPlanta(false);
        }
    };

    const loadSucursalInfo = async () => {
        if (!currentBranchId) return;
        try {
            const info = await dbGetSucursalById(currentBranchId);
            setSucursalInfo(info);
        } catch (e) {
            console.error(e);
        }
    };

    const handleViewItemHistory = async (e: React.MouseEvent, itemId: string) => {
        e.stopPropagation();
        setHistoryItemId(itemId);
        setIsHistoryLoading(true);
        try {
            const history = await dbGetItemLogisticsHistory(itemId);
            setSelectedItemHistory(history);
        } catch (error) {
            console.error("Error loading item history:", error);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleUpdatePlantaStatus = async (itemId: string, newStatus: string) => {
        if (!currentBranchId) return;
        setIsUpdating(true);
        try {
            const userId = getActiveUserId();
            const userName = getActiveUserName() || 'SISTEMA';
            await dbUpdateMultipleItemsStatus([itemId], newStatus, currentBranchId, userId, userName);
            loadPlantaItems();
        } catch (error) {
            console.error("Error updating planta item status:", error);
            showAlert("Error al actualizar estado.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleBulkUpdatePlantaStatus = async (newStatus: string) => {
        if (!currentBranchId) return;
        const itemIds = Object.keys(selectedPlantaItems).filter(id => selectedPlantaItems[id]);
        if (itemIds.length === 0) return;

        setIsUpdating(true);
        try {
            const userId = getActiveUserId();
            const userName = getActiveUserName() || 'SISTEMA';
            await dbUpdateMultipleItemsStatus(itemIds, newStatus, currentBranchId, userId, userName);
            setSelectedPlantaItems({});
            loadPlantaItems();
            showAlert(`Se han marcado ${itemIds.length} prendas como LISTAS.`, "Éxito");
        } catch (error) {
            console.error("Error updating multiple planta items:", error);
            showAlert("Error al actualizar las prendas masivamente.");
        } finally {
            setIsUpdating(false);
        }
    };

    const togglePlantaItemSelection = (itemId: string) => {
        setSelectedPlantaItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    };

    const toggleSelectAllPlanta = (sucursalOrders: any) => {
        const allItemIds: string[] = [];
        Object.values(sucursalOrders).forEach((order: any) => {
            order.items.forEach((item: any) => {
                if (item.estado === 'RECIBIDO_CENTRAL') {
                    allItemIds.push(item.id);
                }
            });
        });

        const allSelected = allItemIds.every(id => selectedPlantaItems[id]);
        const newSelection = { ...selectedPlantaItems };
        allItemIds.forEach(id => {
            newSelection[id] = !allSelected;
        });
        setSelectedPlantaItems(newSelection);
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
            showAlert("Error al cargar prendas pendientes.");
        } finally {
            setIsLoadingPending(false);
        }
    };

    const loadGuias = async () => {
        setIsLoading(true);
        try {
            let data: GuiaRemision[] = [];
            
            if (activeTab === 'INCOMING') {
                const transit = await dbGetGuiasRemision({
                    sucursal_destino_id: currentBranchId!,
                    estado: 'EN_TRANSITO'
                });
                const waiting = await dbGetGuiasRemision({
                    sucursal_destino_id: currentBranchId!,
                    estado: 'POR_VALIDAR'
                });
                data = [...transit, ...waiting];
            } else if (activeTab === 'OUTGOING') {
                const pending = await dbGetGuiasRemision({
                    sucursal_origen_id: currentBranchId!,
                    estado: 'PENDIENTE'
                });
                const transit = await dbGetGuiasRemision({
                    sucursal_origen_id: currentBranchId!,
                    estado: 'EN_TRANSITO'
                });
                data = [...pending, ...transit];
            } else {
                data = await dbGetGuiasRemision({
                    sucursal_id: currentBranchId!,
                    estado: 'ENTREGADO'
                });
            }
            
            const sortedData = [...data].sort((a, b) => 
                new Date(b.fecha_registro).getTime() - new Date(a.fecha_registro).getTime()
            );
            
            setGuias(sortedData);

            // DASHBOARD COUNTS - Fetch all necessary data for summary
            try {
                if (sucursalInfo) {
                    const [inc, out, pend] = await Promise.all([
                        dbGetGuiasRemision({ sucursal_destino_id: currentBranchId!, estado: 'EN_TRANSITO' }),
                        dbGetGuiasRemision({ sucursal_origen_id: currentBranchId!, estado: 'EN_TRANSITO' }),
                        dbGetItemsPendientesLogistica(currentBranchId!, sucursalInfo.tipo_sucursal)
                    ]);
                    
                    setSummary({
                        incoming: inc.length,
                        outgoing: out.length,
                        pending: pend.length
                    });
                }
            } catch (sumErr) {
                console.error("Error updating dashboard summary:", sumErr);
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
        
        setConfirmModal({
            isOpen: true,
            title: "Confirmar Recepción",
            message: "¿Confirmas que has recibido las prendas marcadas en esta guía?",
            type: 'CONFIRM',
            onConfirm: () => executeReceiveGuia()
        });
    };

    const executeReceiveGuia = async () => {
        if (!selectedGuia) return;
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

            // Si es una guía de RETORNO y está volviendo a la sucursal final (ACOPIO o TIENDA), el estado debe ser LISTO
            const esRetornoAFinal = selectedGuia.tipo_guia === 'RETORNO';
            const nuevoEstado = esRetornoAFinal ? 'LISTO' : 
                               (selectedGuia.tipo_guia === 'RECOJO' ? 'RECIBIDO_CENTRAL' : 'RECIBIDO_ACOPIO');
            
            await dbUpdateGuiaEstado(selectedGuia.id, 'ENTREGADO', nuevoEstado, itemsToProcess);
            setSelectedGuia(null);
            loadGuias();
        } catch (error) {
            console.error("Error updating guia status:", error);
            showAlert("Error al recibir la guía.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handlePrintGuia = async (guia: GuiaRemision) => {
        try {
            setIsLoadingDetails(true);
            const items = await dbGetGuiaDetails(guia.id);
            printGuiaRemision(guia, items || [], sucursalInfo);
        } catch (error) {
            console.error("Error printing guia:", error);
            showAlert("Error al preparar la impresión de la guía.");
        } finally {
            setIsLoadingDetails(false);
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

    const filteredPlantaItems = (plantaItems || []).filter(item => {
        const query = plantaSearch.toLowerCase();
        return (
            item.descripcion?.toLowerCase().includes(query) ||
            item.ventas?.codigo_orden?.toLowerCase().includes(query) ||
            item.codigo_guia?.toLowerCase().includes(query) ||
            item.ventas?.clientes?.nombre_completo?.toLowerCase().includes(query) ||
            item.ventas?.clientes?.nombres?.toLowerCase().includes(query) ||
            item.ventas?.sucursales?.nombre_sucursal?.toLowerCase().includes(query)
        );
    });

    // Agrupar items de planta por SUCURSAL de ORIGEN, luego por GUIA y luego por ORDEN
    const consolidatedPlanta = filteredPlantaItems.reduce((acc: any, item: any) => {
        const sucursalId = item.ventas?.sucursal_id || 'no-sucursal';
        const sucursalNombre = item.ventas?.sucursales?.nombre_sucursal || 'Origen Desconocido';
        const guiaCode = item.codigo_guia || 'SIN GUÍA';
        const orderId = item.ventas?.id || 'no-order';
        
        if (!acc[sucursalId]) acc[sucursalId] = { nombre: sucursalNombre, guias: {} };
        if (!acc[sucursalId].guias[guiaCode]) acc[sucursalId].guias[guiaCode] = { codigo: guiaCode, orders: {} };
        
        if (!acc[sucursalId].guias[guiaCode].orders[orderId]) {
            acc[sucursalId].guias[guiaCode].orders[orderId] = {
                codigo_orden: item.ventas?.codigo_orden || '---',
                cliente: item.ventas?.clientes?.nombre_completo || item.ventas?.clientes?.nombres || 'Cliente',
                items: []
            };
        }
        acc[sucursalId].guias[guiaCode].orders[orderId].items.push(item);
        return acc;
    }, {});

    const filteredGuias = guias.filter(guia => {
        if (activeTab !== 'HISTORY') return true;
        const query = historySearch.toLowerCase();
        return (
            guia.codigo_guia.toLowerCase().includes(query) ||
            guia.sucursal_origen?.nombre_sucursal?.toLowerCase().includes(query) ||
            guia.sucursal_destino?.nombre_sucursal?.toLowerCase().includes(query) ||
            guia.chofer?.nombre_completo?.toLowerCase().includes(query)
        );
    });

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
                            PROCESAMIENTO EN PLANTA
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
                        {(isMaster || sucursalInfo?.tipo_sucursal === 'CENTRAL' || sucursalInfo?.tipo_sucursal === 'PLANTA' || sucursalInfo?.modulos_config?.control_planta === true) && (
                            <button 
                                onClick={() => setActiveTab('PLANTA')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'PLANTA' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <RefreshCw size={14} /> CONTROL PLANTA
                            </button>
                        )}
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
                
                {/* LIST OF GUIAS & PLANTA CONTROL */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                    {activeTab === 'PLANTA' && (
                        <div className="mb-4 sticky top-0 z-10 bg-slate-50 pb-2 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="BUSCAR TICKET, PRENDA O CLIENTE EN PLANTA..." 
                                    value={plantaSearch}
                                    onChange={(e) => setPlantaSearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[2rem] text-xs font-black uppercase tracking-widest placeholder:text-slate-300 shadow-sm focus:ring-4 focus:ring-accent/5 focus:border-accent transition-all"
                                />
                            </div>

                            {Object.values(selectedPlantaItems).filter(Boolean).length > 0 && (
                                <div className="flex items-center justify-between p-4 bg-emerald-600 rounded-3xl shadow-xl shadow-emerald-100 animate-in slide-in-from-top-4 duration-300">
                                    <div className="flex items-center gap-3 text-white">
                                        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                            <CheckCircle2 size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest">Selección Masiva</p>
                                            <p className="text-xs font-bold">{Object.values(selectedPlantaItems).filter(Boolean).length} prendas seleccionadas</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleBulkUpdatePlantaStatus('EMPAQUETADO')}
                                        disabled={isUpdating}
                                        className="px-6 py-3 bg-white text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-sm hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {isUpdating ? <Loader2 className="animate-spin" size={16} /> : 'MARCAR COMO LISTO'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'HISTORY' && (
                        <div className="mb-4 sticky top-0 z-10 bg-slate-50 pb-2">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="BUSCAR EN EL HISTORIAL DE GUÍAS..." 
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[2rem] text-xs font-black uppercase tracking-widest placeholder:text-slate-300 shadow-sm focus:ring-4 focus:ring-accent/5 focus:border-accent transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'PLANTA' ? (
                        <div className="space-y-6">
                            {isLoadingPlanta ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="animate-spin text-emerald-500" size={40} />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consultando cola de producción...</p>
                                </div>
                            ) : Object.keys(consolidatedPlanta).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                                    <CheckCircle2 size={48} className="text-emerald-100 mb-4" />
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay prendas en procesamiento hoy</p>
                                </div>
                            ) : (
                                Object.entries(consolidatedPlanta).map(([sucursalId, sucursalData]: [string, any]) => (
                                    <div key={sucursalId} className="space-y-3">
                                        <div className="flex items-center justify-between px-4 py-2">
                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} className="text-emerald-500" />
                                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">ORIGEN: {sucursalData.nombre}</h3>
                                            </div>
                                            <button 
                                                onClick={() => toggleSelectAllPlanta(sucursalData.orders)}
                                                className="text-[9px] font-black text-accent uppercase tracking-widest hover:underline"
                                            >
                                                SELECCIONAR TODO EL ORIGEN
                                            </button>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 gap-6">
                                            {Object.entries(sucursalData.guias).map(([guiaCode, guiaData]: [string, any]) => (
                                                <div key={guiaCode} className="space-y-4">
                                                    <div className="flex items-center gap-2 ml-4">
                                                        <Package size={12} className="text-slate-400" />
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-emerald-600">Guía: {guiaCode}</span>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {Object.entries(guiaData.orders).map(([orderId, order]: [string, any]) => (
                                                            <div key={orderId} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                                                                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                                                    <div>
                                                                        <h4 className="text-[10px] font-black text-slate-800">#{order.codigo_orden}</h4>
                                                                        <p className="text-[8px] font-bold text-slate-400 uppercase truncate max-w-[120px]">{order.cliente}</p>
                                                                    </div>
                                                                    <div className="text-[7px] font-black bg-white border border-slate-200 px-2 py-0.5 rounded-full uppercase">
                                                                        {order.items.length} prendas
                                                                    </div>
                                                                </div>
                                                                <div className="p-1 space-y-1">
                                                                    {order.items.map((item: any) => (
                                                                        <div 
                                                                            key={item.id}
                                                                            onClick={() => item.estado === 'RECIBIDO_CENTRAL' && togglePlantaItemSelection(item.id)}
                                                                            className={`p-3 rounded-2xl flex items-center justify-between group transition-all cursor-pointer ${selectedPlantaItems[item.id] ? 'bg-emerald-50 ring-1 ring-emerald-200 shadow-sm' : 'hover:bg-slate-50'}`}
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                                                    item.estado === 'RECIBIDO_CENTRAL' ? (selectedPlantaItems[item.id] ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400') :
                                                                                    'bg-emerald-100 text-emerald-600'
                                                                                }`}>
                                                                                    {item.estado === 'RECIBIDO_CENTRAL' ? (selectedPlantaItems[item.id] ? <CheckCircle2 size={16} /> : <Box size={16} />) :
                                                                                     <CheckCircle2 size={16} />}
                                                                                </div>
                                                                                <div>
                                                                                    <h4 className="font-bold text-slate-800 text-[10px] uppercase line-clamp-1">{item.descripcion}</h4>
                                                                                    {item.detalles && <p className="text-[7px] text-indigo-500 font-bold uppercase">{item.detalles}</p>}
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-center gap-2">
                                                                                {item.estado === 'RECIBIDO_CENTRAL' && (
                                                                                    <button 
                                                                                        onClick={(e) => { e.stopPropagation(); handleUpdatePlantaStatus(item.id, 'EMPAQUETADO'); }}
                                                                                        className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[7px] font-black uppercase tracking-widest shadow-sm"
                                                                                    >
                                                                                        LISTO
                                                                                    </button>
                                                                                )}
                                                                                {item.estado === 'EMPAQUETADO' && (
                                                                                    <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                                                                                        <CheckCircle2 size={8} /> LISTO
                                                                                    </span>
                                                                                )}
                                                                                <button 
                                                                                    onClick={(e) => handleViewItemHistory(e, item.id)}
                                                                                    className="p-1 text-slate-300 hover:text-accent transition-colors shrink-0"
                                                                                >
                                                                                    <History size={12} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="animate-spin text-accent" size={40} />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronizando logística...</p>
                        </div>
                    ) : filteredGuias.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                            <Box size={48} className="text-slate-200 mb-4" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay guías en esta sección</p>
                        </div>
                    ) : (
                        filteredGuias.map((guia) => (
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
                                                guia.estado === 'EN_TRANSITO' ? 'bg-blue-100 text-blue-600' : 
                                                guia.estado === 'POR_VALIDAR' ? 'bg-orange-100 text-orange-600 animate-pulse' :
                                                'bg-emerald-100 text-emerald-600'
                                            }`}>
                                                {guia.estado === 'POR_VALIDAR' ? 'POR VALIDAR' : guia.estado}
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
                                                                <div className="flex items-center gap-3 mt-1">
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                                                        {item.items_venta?.cantidad} {item.items_venta?.codigo_unidad}
                                                                    </p>
                                                                    <button 
                                                                        onClick={(e) => handleViewItemHistory(e, item.items_venta_id || item.item_id)}
                                                                        className="flex items-center gap-1 text-[9px] font-black text-accent hover:underline uppercase tracking-tighter"
                                                                    >
                                                                        <History size={11} /> Trazabilidad
                                                                    </button>
                                                                </div>
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
                                        {selectedGuia.estado === 'POR_VALIDAR' ? (
                                            <>
                                                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 flex gap-3 mb-4">
                                                    <MapPin className="text-orange-500 shrink-0" size={18} />
                                                    <p className="text-[10px] text-orange-800 font-bold uppercase leading-tight">
                                                        El chofer indica que YA LLEGÓ. Revisa la carga físicamente antes de confirmar.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={handleReceiveGuia}
                                                    disabled={isUpdating || isLoadingDetails || !allItemsProcessed}
                                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
                                                >
                                                    {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle2 size={20} /> CONFIRMAR RECEPCIÓN</>}
                                                </button>
                                            </>
                                        ) : (
                                            <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-dashed border-slate-200 text-center space-y-3">
                                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto text-slate-300">
                                                    <Clock size={24} />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Carga en Tránsito</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                                        Podrás recibir las prendas cuando el chofer confirme su llegada al destino.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
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
                                        <button 
                                            onClick={() => handlePrintGuia(selectedGuia)}
                                            className="w-full mt-4 py-3 border-2 border-slate-200 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                                        >
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

            {/* ITEM HISTORY MODAL */}
            {historyItemId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 animate-in fade-in transition-all">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                                    <History size={20} className="text-accent" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-widest">Historial de Traslado</h3>
                                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Trazabilidad del Item</p>
                                </div>
                            </div>
                            <button onClick={() => setHistoryItemId(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><XCircle size={24} /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50">
                            {isHistoryLoading ? (
                                <div className="flex flex-col items-center justify-center py-10 gap-3">
                                    <Loader2 className="animate-spin text-accent" size={32} />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consultando historial...</p>
                                </div>
                            ) : !selectedItemHistory || selectedItemHistory.length === 0 ? (
                                <div className="text-center py-10">
                                    <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No se encontró historial para este item.</p>
                                </div>
                            ) : (
                                <div className="relative space-y-6">
                                    {/* Timeline line */}
                                    <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200" />
                                    
                                    {selectedItemHistory.map((entry, idx) => (
                                        <div key={idx} className="relative flex gap-4 pl-10">
                                            {/* Dot */}
                                            <div className={`absolute left-[13px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ring-4 ring-slate-100 ${
                                                idx === 0 ? 'bg-accent' : 'bg-slate-400'
                                            }`} />
                                            
                                            <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                                                {/* Left Accent Bar */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                                    entry.estado_nuevo.includes('RECIBIDO') ? 'bg-emerald-500' : 
                                                    entry.estado_nuevo.includes('EN_TRANSITO') ? 'bg-blue-500' : 'bg-slate-300'
                                                }`} />
                                                
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{format(new Date(entry.fecha_registro || entry.fecha_cambio), 'PPP p', { locale: es })}</p>
                                                        <h4 className={`font-black text-xs uppercase tracking-tight mt-0.5 ${
                                                            entry.estado_nuevo.includes('RECIBIDO') ? 'text-emerald-700' : 
                                                            entry.estado_nuevo.includes('EN_TRANSITO') ? 'text-blue-700' : 'text-slate-800'
                                                        }`}>
                                                            {entry.estado_nuevo.replace(/_/g, ' ')}
                                                        </h4>
                                                    </div>
                                                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-tighter">
                                                        {entry.guia?.codigo_guia || 'MOV. MANUAL'}
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-1.5 border-t border-slate-50 pt-2">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase leading-snug">
                                                        <MapPin size={10} className="inline mr-1 text-slate-400" />
                                                        Ubicación: <span className="text-slate-700">{
                                                            entry.ubicacion_tipo === 'SUCURSAL' ? 
                                                            (entry.guia?.sucursal_destino?.nombre_sucursal || 'Destino') : 
                                                            'En Tránsito (Chofer)'
                                                        }</span>
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase leading-snug">
                                                        <User size={10} className="inline mr-1 text-slate-400" />
                                                        Responsable: <span className="text-slate-700">{entry.usuario?.nombre_completo || entry.usuario_nombre || 'SISTEMA'}</span>
                                                    </p>
                                                </div>
                                                
                                                {entry.guia && (
                                                    <div className="mt-2 text-[9px] bg-slate-50 p-2 rounded-lg flex items-center justify-between">
                                                        <div className="flex items-center gap-1 text-slate-400 font-bold uppercase tracking-tighter">
                                                            <span>{entry.guia.sucursal_origen?.nombre_sucursal}</span>
                                                            <ArrowRight size={8} />
                                                            <span>{entry.guia.sucursal_destino?.nombre_sucursal}</span>
                                                        </div>
                                                        <div className="font-black text-slate-500 uppercase tracking-tighter">
                                                            {entry.guia.tipo_guia}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Las acciones marcadas con <span className="text-emerald-500">RECIBIDO</span> confirman la custodia física en sucursal.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOM CONFIRM MODAL */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center bg-accent/10 text-accent">
                                <BellRing size={32} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">{confirmModal.title}</h3>
                                <p className="text-xs font-bold text-slate-500 leading-relaxed whitespace-pre-wrap">{confirmModal.message}</p>
                            </div>
                        </div>
                        <div className="flex border-t border-slate-100">
                            {confirmModal.type === 'CONFIRM' && (
                                <button 
                                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                    className="flex-1 py-5 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 hover:bg-slate-50 transition-colors"
                                >
                                    CANCELAR
                                </button>
                            )}
                            <button 
                                onClick={() => {
                                    if (confirmModal.onConfirm) confirmModal.onConfirm();
                                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                }}
                                className={`flex-1 py-5 font-black text-[10px] uppercase tracking-[0.2em] text-white transition-all shadow-inner bg-accent hover:opacity-90`}
                            >
                                {confirmModal.type === 'CONFIRM' ? 'CONFIRMAR' : 'ENTENDIDO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LogisticsHub;

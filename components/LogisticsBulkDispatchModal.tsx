
import React, { useState, useEffect, useMemo } from 'react';
import { X, Truck, MapPin, User, CheckCircle2, Loader2, Package, ChevronDown, ChevronRight, CheckSquare, Square, Printer, Info } from 'lucide-react';
import { GuiaRemision } from '../types';
import { dbGetLogisticsDrivers, dbCreateGuiaRemision, getActiveBranchId } from '../services/dbService';
import { getOwnerSucursales } from '../src/services/ownerService';
import { format } from 'date-fns';
import LogisticsGuidePrint from './LogisticsGuidePrint';

interface LogisticsBulkDispatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedItems: any[]; // Array of items to dispatch
    onSuccess?: () => void;
    type: 'RECOJO' | 'RETORNO';
}

const LogisticsBulkDispatchModal: React.FC<LogisticsBulkDispatchModalProps> = ({ isOpen, onClose, selectedItems, onSuccess, type }) => {
    const [drivers, setDrivers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<string>('');
    const [selectedDestBranchId, setSelectedDestBranchId] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Grouping & Selection State
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [createdGuia, setCreatedGuia] = useState<GuiaRemision | null>(null);

    const currentBranchId = getActiveBranchId();

    // Group items by order
    const groupedItems = useMemo(() => {
        const groups: Record<string, any[]> = {};
        selectedItems.forEach(item => {
            const orderId = item.venta_id || item.orden_id || 'SIN_ORDEN';
            if (!groups[orderId]) groups[orderId] = [];
            groups[orderId].push(item);
        });
        return groups;
    }, [selectedItems]);

    const orderIds = Object.keys(groupedItems);

    useEffect(() => {
        if (isOpen) {
            loadData();
            // Select all by default
            const allIds = selectedItems.map(it => it.uniqueId || it.id);
            setSelectedIds(new Set(allIds));
            // Expand first order by default if exists
            if (orderIds.length > 0) {
                setExpandedOrders(new Set([orderIds[0]]));
            }
        }
    }, [isOpen, selectedItems]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [driversData, allBranchesData] = await Promise.all([
                dbGetLogisticsDrivers(),
                getOwnerSucursales()
            ]);
            setDrivers(driversData);
            
            let connections: any[] = [];
            try {
                const { data: connData } = await (await import('../services/dbService')).supabase
                    .from('sucursal_conexiones')
                    .select('sucursal_destino_id')
                    .eq('sucursal_origen_id', currentBranchId);
                connections = connData || [];
            } catch (e) {
                console.error("Error loading connections:", e);
            }

            let filteredBranches = allBranchesData.filter((b: any) => b.id !== currentBranchId);
            
            if (connections.length > 0) {
                const allowedDestIds = connections.map(c => c.sucursal_destino_id);
                filteredBranches = filteredBranches.filter((b: any) => allowedDestIds.includes(b.id));
            } else {
                if (type === 'RECOJO') {
                    filteredBranches = filteredBranches.filter((b: any) => b.tipo_sucursal === 'CENTRAL');
                } else {
                    filteredBranches = filteredBranches.filter((b: any) => b.tipo_sucursal === 'ACOPIO' || b.tipo_sucursal === 'TIENDA');
                }
            }
            
            setBranches(filteredBranches);
            if (filteredBranches.length === 1) setSelectedDestBranchId(filteredBranches[0].id);
        } catch (error) {
            console.error("Error loading logistics data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleOrder = (orderId: string) => {
        const next = new Set(expandedOrders);
        if (next.has(orderId)) next.delete(orderId);
        else next.add(orderId);
        setExpandedOrders(next);
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleOrderSelection = (orderId: string) => {
        const items = groupedItems[orderId];
        const itemIds = items.map(it => it.uniqueId || it.id);
        const allSelected = itemIds.every(id => selectedIds.has(id));
        
        const next = new Set(selectedIds);
        if (allSelected) {
            itemIds.forEach(id => next.delete(id));
        } else {
            itemIds.forEach(id => next.add(id));
        }
        setSelectedIds(next);
    };

    const toggleAll = () => {
        if (selectedIds.size === selectedItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(selectedItems.map(it => it.uniqueId || it.id)));
        }
    };

    const handleDispatch = async () => {
        if (selectedIds.size === 0) {
            alert("No hay prendas seleccionadas.");
            return;
        }
        if (!selectedDriverId) {
            alert("Selecciona un chofer para el traslado.");
            return;
        }
        if (!selectedDestBranchId) {
            alert("Selecciona la sucursal de destino.");
            return;
        }

        setIsSaving(true);
        try {
            const driver = drivers.find(d => d.id === selectedDriverId);
            const allBranches = await getOwnerSucursales();
            const destBranch = allBranches.find(b => b.id === selectedDestBranchId);
            const originBranch = allBranches.find(b => b.id === currentBranchId);

            const guia: Partial<GuiaRemision> = {
                sucursal_origen_id: currentBranchId!,
                sucursal_destino_id: selectedDestBranchId,
                chofer_id: selectedDriverId,
                tipo_guia: type,
                notas: notes,
                estado: 'PENDIENTE',
                codigo_guia: `G-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
            };

            const itemsToDispatch = selectedItems.filter(it => selectedIds.has(it.uniqueId || it.id));
            const itemsPayload = itemsToDispatch.map(it => ({
                id: it.uniqueId || it.id,
                venta_id: it.venta_id || it.orden_id
            }));
            
            const results = await dbCreateGuiaRemision(guia, itemsPayload);
            
            // Prepare data for print
            const guiaForPrint: GuiaRemision = {
                ...results,
                sucursal_origen: originBranch,
                sucursal_destino: destBranch,
                chofer: driver,
                fecha_registro: new Date().toISOString()
            };

            setCreatedGuia(guiaForPrint);
            setShowPrintPreview(true);
            
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Error creating logistics guide:", error);
            alert("Error al generar la guía de remisión.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    if (showPrintPreview && createdGuia) {
        return (
            <LogisticsGuidePrint 
                guia={createdGuia}
                items={selectedItems.filter(it => selectedIds.has(it.uniqueId || it.id))}
                onClose={() => {
                    setShowPrintPreview(false);
                    onClose();
                }}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-950/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
                
                {/* HEADER */}
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-accent p-3 rounded-2xl shadow-lg shadow-accent/20">
                            <Truck size={24} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-xl uppercase tracking-tight">Despacho Masivo Logístico</h3>
                            <p className="text-xs text-white/50 font-bold uppercase tracking-widest">
                                {type === 'RECOJO' ? 'Envío a Planta de Lavado' : 'Retorno a Centro de Acopio'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"><X size={24}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
                        {/* DESTINATION */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <MapPin size={12} /> Sucursal Destino
                            </label>
                            <select 
                                value={selectedDestBranchId}
                                onChange={(e) => setSelectedDestBranchId(e.target.value)}
                                className="w-full p-4 rounded-2xl border border-slate-100 bg-white text-sm font-bold text-slate-700 outline-none focus:border-accent shadow-sm transition-all"
                            >
                                <option value="">Seleccionar destino...</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.nombre_sucursal}</option>
                                ))}
                            </select>
                        </div>

                        {/* DRIVER */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <User size={12} /> Chofer Asignado
                            </label>
                            <select 
                                value={selectedDriverId}
                                onChange={(e) => setSelectedDriverId(e.target.value)}
                                className="w-full p-4 rounded-2xl border border-slate-100 bg-white text-sm font-bold text-slate-700 outline-none focus:border-accent shadow-sm transition-all"
                            >
                                <option value="">Seleccionar chofer...</option>
                                {drivers.map(d => (
                                    <option key={d.id} value={d.id}>{d.nombre_completo}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* ITEMS LIST (ACCORDION) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Package size={14} /> Detalle de Carga
                            </h4>
                            <button 
                                onClick={toggleAll}
                                className="text-[10px] font-black text-accent uppercase tracking-widest hover:bg-accent/10 px-3 py-1.5 rounded-lg transition-all"
                            >
                                {selectedIds.size === selectedItems.length ? 'Desmarcar Todo' : 'Marcar Todo'}
                            </button>
                        </div>

                        <div className="space-y-3">
                            {orderIds.map(orderId => {
                                const items = groupedItems[orderId];
                                const isExpanded = expandedOrders.has(orderId);
                                const orderNumber = items[0]?.ventas?.codigo_orden || items[0]?.ticketNumber || orderId;
                                const itemsSelectedInOrder = items.filter(it => selectedIds.has(it.uniqueId || it.id)).length;
                                const isAllSelectedInOrder = itemsSelectedInOrder === items.length;

                                return (
                                    <div key={orderId} className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-accent shadow-lg shadow-slate-200' : 'border-slate-100'}`}>
                                        {/* ORDER HEADER */}
                                        <div className="flex items-center p-3 md:p-4 gap-3">
                                            <button 
                                                onClick={() => toggleOrderSelection(orderId)}
                                                className={`transition-colors ${isAllSelectedInOrder ? 'text-accent' : 'text-slate-300'}`}
                                            >
                                                {isAllSelectedInOrder ? <CheckSquare size={20} /> : <Square size={20} />}
                                            </button>
                                            
                                            <div onClick={() => toggleOrder(orderId)} className="flex-1 flex items-center justify-between cursor-pointer group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-400 text-xs border border-slate-100">
                                                        #{items.length}
                                                    </div>
                                                    <div>
                                                        <h5 className="font-black text-slate-800 text-sm">ORDEN {items[0]?.ticketNumber || orderNumber}</h5>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">{itemsSelectedInOrder} de {items.length} seleccionadas</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {isExpanded ? <ChevronDown size={20} className="text-slate-300" /> : <ChevronRight size={20} className="text-slate-300" />}
                                                </div>
                                            </div>
                                        </div>

                                        {/* GARMENTS LIST */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-50 bg-slate-50/50 p-2 space-y-1">
                                                {items.map(item => {
                                                    const isSelected = selectedIds.has(item.uniqueId || item.id);
                                                    return (
                                                        <div 
                                                            key={item.uniqueId || item.id}
                                                            onClick={() => toggleSelection(item.uniqueId || item.id)}
                                                            className={`flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer ${isSelected ? 'bg-white shadow-sm border border-slate-100' : 'opacity-60 hover:opacity-100'}`}
                                                        >
                                                            <div className={`transition-colors ${isSelected ? 'text-emerald-500' : 'text-slate-200'}`}>
                                                                {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex-1">
                                                                        <h6 className="font-bold text-[11px] text-slate-700 uppercase leading-tight">{item.nombre_prenda || item.itemName || item.descripcion || 'Prenda sin nombre'}</h6>
                                                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{item.clientName || item.ventas?.clientes?.nombres || item.ventas?.clientes?.nombre || item.ventas?.clientes?.razon_social || 'S/N Cliente'}</p>
                                                                    </div>
                                                                    <span className="text-[11px] font-black text-slate-800 bg-slate-100 px-2 rounded-lg">x{item.cantidad || 1}</span>
                                                                </div>
                                                                <div className="mt-1.5 flex flex-col gap-1">
                                                                    <p className="text-[9px] text-slate-500 font-medium line-clamp-2 italic">{item.detalle || item.details || item.observaciones || 'Sin detalles'}</p>
                                                                    <div className="flex items-center gap-y-1 gap-x-2 flex-wrap text-[8px] font-black uppercase tracking-widest">
                                                                        <div className="bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                            <Info size={8} /> Entrega: {item.fecha_entrega ? format(new Date(item.fecha_entrega), 'dd/MM') : '-'}
                                                                        </div>
                                                                        {item.estado && (
                                                                            <div className="bg-emerald-50 text-emerald-500 px-2 py-0.5 rounded-full">
                                                                                {item.estado}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* NOTES */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notas de Envío</label>
                        <textarea 
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full h-24 p-4 rounded-2xl border border-slate-100 bg-white text-sm text-slate-700 outline-none focus:border-accent shadow-sm transition-all resize-none"
                            placeholder="Ej: Carga consolidada de la mañana..."
                        />
                    </div>
                </div>

                {/* FOOTER ACTION */}
                <div className="p-6 bg-white border-t border-slate-100 shrink-0">
                    <button
                        onClick={handleDispatch}
                        disabled={isSaving || isLoading || selectedIds.size === 0}
                        className={`w-full py-5 rounded-2xl font-black text-white shadow-xl transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em] ${
                            isSaving || isLoading || selectedIds.size === 0 
                                ? 'bg-slate-300 cursor-not-allowed' 
                                : 'bg-accent hover:scale-[1.01] active:scale-95 shadow-accent/20'
                        }`}
                    >
                        {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                        GENERAR GUÍA Y DESPACHAR ({selectedIds.size})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogisticsBulkDispatchModal;

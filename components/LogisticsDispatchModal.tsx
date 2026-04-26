
import React, { useState, useEffect } from 'react';
import { X, Truck, MapPin, User, CheckCircle2, Loader2, Package, ArrowRight, AlertTriangle, Search } from 'lucide-react';
import { Invoice, CartItem, GuiaRemision, UserRole } from '../types';
import LogisticsGuidePrint from './LogisticsGuidePrint';
import { dbGetLogisticsDrivers, dbCreateGuiaRemision, getActiveBranchId } from '../services/dbService';
import { getOwnerSucursales } from '../src/services/ownerService';

interface LogisticsDispatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice;
    onSuccess?: () => void;
}

const LogisticsDispatchModal: React.FC<LogisticsDispatchModalProps> = ({ isOpen, onClose, invoice, onSuccess }) => {
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [drivers, setDrivers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<string>('');
    const [selectedDestBranchId, setSelectedDestBranchId] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [createdGuia, setCreatedGuia] = useState<GuiaRemision | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const currentBranchId = getActiveBranchId();

    useEffect(() => {
        if (isOpen) {
            loadData();
            // Por defecto seleccionar todos los items que no estén ya en logística
            const initialSelected = new Set<string>();
            invoice.items.forEach(item => {
                if (!item.status || !['EN_TRANSITO_CENTRAL', 'RECIBIDO_CENTRAL', 'PROCESANDO_CENTRAL'].includes(item.status)) {
                    initialSelected.add(item.id);
                }
            });
            setSelectedItems(initialSelected);
        }
    }, [isOpen, invoice]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [driversData, branchesData] = await Promise.all([
                dbGetLogisticsDrivers(),
                getOwnerSucursales()
            ]);
            setDrivers(driversData);
            // Obtener conexiones permitidas para esta sucursal
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

            // Filtrar la sucursal actual de los destinos posibles
            let filteredBranches = branchesData.filter((b: any) => b.id !== currentBranchId);
            
            // Si hay conexiones configuradas por el OWNER, filtramos estrictamente por ellas
            if (connections.length > 0) {
                const allowedDestIds = connections.map(c => c.sucursal_destino_id);
                filteredBranches = filteredBranches.filter((b: any) => allowedDestIds.includes(b.id));
            } else {
                // Fallback: Si no hay conexiones, mostramos las centrales por defecto (comportamiento original)
                // pero permitimos ver todas si no hay centrales
                const centrals = filteredBranches.filter((b: any) => b.tipo_sucursal === 'CENTRAL');
                if (centrals.length > 0) filteredBranches = centrals;
            }

            setBranches(filteredBranches);
            
            // Si hay una central o solo un destino, seleccionarla por defecto
            if (filteredBranches.length === 1) {
                setSelectedDestBranchId(filteredBranches[0].id);
            } else {
                const central = filteredBranches.find((b: any) => b.tipo_sucursal === 'CENTRAL');
                if (central) setSelectedDestBranchId(central.id);
            }
        } catch (error) {
            console.error("Error loading logistics data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleItem = (id: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedItems(newSelected);
    };

    const handleDispatch = async () => {
        if (selectedItems.size === 0) {
            alert("Selecciona al menos una prenda para enviar.");
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
            const destBranch = branches.find(b => b.id === selectedDestBranchId);
            const isDestCentral = destBranch?.tipo_sucursal === 'CENTRAL';
            
            const guia: Partial<GuiaRemision> = {
                sucursal_origen_id: currentBranchId!,
                sucursal_destino_id: selectedDestBranchId,
                chofer_id: selectedDriverId,
                tipo_guia: isDestCentral ? 'RECOJO' : 'RETORNO',
                notas: notes,
                estado: 'PENDIENTE',
                codigo_guia: `G-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
            };

            const itemsPayload = Array.from(selectedItems).map(id => ({
                id,
                venta_id: invoice.id
            }));

            const results = await dbCreateGuiaRemision(guia, itemsPayload);
            
            const driver = drivers.find(d => d.id === selectedDriverId);
            const allBranches = await getOwnerSucursales();
            const destBranchObj = allBranches.find(b => b.id === selectedDestBranchId);
            const originBranch = allBranches.find(b => b.id === currentBranchId);

            const guiaForPrint: GuiaRemision = {
                ...results,
                sucursal_origen: originBranch,
                sucursal_destino: destBranchObj,
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
                items={invoice.items.filter(it => selectedItems.has(it.id))}
                onClose={() => {
                    setShowPrintPreview(false);
                    onClose();
                }}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-950/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* HEADER */}
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-accent p-3 rounded-2xl shadow-lg shadow-accent/20">
                            <Truck size={24} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-xl uppercase tracking-tight">Despacho Logístico Hub</h3>
                            <p className="text-xs text-white/50 font-bold uppercase tracking-widest">Orden {invoice.ordenNumber} • {invoice.client.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"><X size={24}/></button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    
                    {/* LEFT: ITEM SELECTION */}
                    <div className="flex-1 p-6 overflow-y-auto border-r border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                                <Package size={16} className="text-accent" />
                                Seleccionar Prendas
                            </h4>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setSelectedItems(new Set(invoice.items.map(i => i.id)))}
                                    className="text-[10px] font-bold text-accent hover:underline uppercase"
                                >
                                    Todo
                                </button>
                                <button 
                                    onClick={() => setSelectedItems(new Set())}
                                    className="text-[10px] font-bold text-slate-400 hover:underline uppercase"
                                >
                                    Nada
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {invoice.items.map((item) => {
                                const isSelected = selectedItems.has(item.id);
                                const isInLogistics = item.status && ['EN_TRANSITO_CENTRAL', 'RECIBIDO_CENTRAL', 'PROCESANDO_CENTRAL'].includes(item.status);

                                return (
                                    <button
                                        key={item.id}
                                        disabled={isInLogistics}
                                        onClick={() => toggleItem(item.id)}
                                        className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between group ${
                                            isInLogistics 
                                                ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                                                : isSelected 
                                                    ? 'bg-accent/5 border-accent shadow-md' 
                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                                isSelected ? 'bg-accent text-white' : 'bg-slate-100 text-slate-400'
                                            }`}>
                                                <Package size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-800">{item.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                    {item.quantity} {item.unitCode} • S/ {item.subtotal.toFixed(2)}
                                                </p>
                                                {isInLogistics && (
                                                    <p className="text-[9px] text-amber-600 font-bold uppercase mt-1 flex items-center gap-1">
                                                        <AlertTriangle size={8} /> Ya en logística ({item.status})
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {!isInLogistics && (
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                                isSelected ? 'bg-accent border-accent text-white' : 'border-slate-200'
                                            }`}>
                                                {isSelected && <CheckCircle2 size={14} />}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT: DESTINATION & DRIVER */}
                    <div className="w-full md:w-80 p-6 bg-white flex flex-col gap-6">
                        
                        {/* DESTINATION */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <MapPin size={12} /> Sucursal Destino (Central)
                            </label>
                            <select 
                                value={selectedDestBranchId}
                                onChange={(e) => setSelectedDestBranchId(e.target.value)}
                                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:border-accent transition-all"
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
                                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:border-accent transition-all"
                            >
                                <option value="">Seleccionar chofer...</option>
                                {drivers.map(d => (
                                    <option key={d.id} value={d.id}>{d.nombre_completo}</option>
                                ))}
                            </select>
                        </div>

                        {/* NOTES */}
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notas de Envío</label>
                            <textarea 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full h-24 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-accent transition-all resize-none"
                                placeholder="Ej: Cuidado con el edredón de plumas..."
                            />
                        </div>

                        {/* SUMMARY & ACTION */}
                        <div className="pt-4 border-t border-slate-100 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase">Prendas a enviar</span>
                                <span className="text-lg font-black text-slate-800">{selectedItems.size}</span>
                            </div>
                            <button
                                onClick={handleDispatch}
                                disabled={isSaving || selectedItems.size === 0}
                                className={`w-full py-4 rounded-2xl font-bold text-white shadow-xl transition-all flex items-center justify-center gap-2 ${
                                    isSaving || selectedItems.size === 0 
                                        ? 'bg-slate-300 cursor-not-allowed' 
                                        : 'bg-accent hover:scale-[1.02] active:scale-95 shadow-accent/20'
                                }`}
                            >
                                {isSaving ? <Loader2 className="animate-spin" /> : <ArrowRight size={20} />}
                                GENERAR GUÍA Y ENVIAR
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogisticsDispatchModal;

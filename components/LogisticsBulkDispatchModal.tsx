
import React, { useState, useEffect } from 'react';
import { X, Truck, MapPin, User, CheckCircle2, Loader2, Package, ArrowRight, AlertTriangle } from 'lucide-react';
import { GuiaRemision, OrderStatus } from '../types';
import { dbGetLogisticsDrivers, dbCreateGuiaRemision, getActiveBranchId, dbGetSucursalConexiones } from '../services/dbService';
import { getOwnerSucursales } from '../src/services/ownerService';

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

    const currentBranchId = getActiveBranchId();

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

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
                // Necesitamos el holding_id. Lo sacamos de la primera sucursal o del contexto si estuviera disponible.
                // Por ahora, dbGetSucursalConexiones puede inferirlo o recibirlo.
                // Como no tenemos el holding_id a mano aquí de forma directa y limpia (sin pasar por props),
                // vamos a buscar las conexiones donde el origen sea la sucursal actual.
                const { data: connData } = await (await import('../services/dbService')).supabase
                    .from('sucursal_conexiones')
                    .select('sucursal_destino_id')
                    .eq('sucursal_origen_id', currentBranchId);
                connections = connData || [];
            } catch (e) {
                console.error("Error loading connections:", e);
            }

            let filteredBranches = branchesData.filter((b: any) => b.id !== currentBranchId);
            
            // Si hay conexiones configuradas por el OWNER, filtramos estrictamente por ellas
            if (connections.length > 0) {
                const allowedDestIds = connections.map(c => c.sucursal_destino_id);
                filteredBranches = filteredBranches.filter((b: any) => allowedDestIds.includes(b.id));
            } else {
                // Fallback: Lógica por defecto si el OWNER no ha configurado nada aún
                if (type === 'RECOJO') {
                    filteredBranches = filteredBranches.filter((b: any) => b.tipo_sucursal === 'CENTRAL');
                } else {
                    filteredBranches = filteredBranches.filter((b: any) => b.tipo_sucursal === 'ACOPIO' || b.tipo_sucursal === 'TIENDA');
                }
            }
            
            setBranches(filteredBranches);
            
            if (filteredBranches.length === 1) {
                setSelectedDestBranchId(filteredBranches[0].id);
            }
        } catch (error) {
            console.error("Error loading logistics data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDispatch = async () => {
        if (selectedItems.length === 0) {
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
            const guia: Partial<GuiaRemision> = {
                sucursal_origen_id: currentBranchId!,
                sucursal_destino_id: selectedDestBranchId,
                chofer_id: selectedDriverId,
                tipo_guia: type,
                notas: notes,
                codigo_guia: `G-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
            };

            const itemIds = selectedItems.map(it => it.uniqueId || it.id);
            await dbCreateGuiaRemision(guia, itemIds);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Error creating logistics guide:", error);
            alert("Error al generar la guía de remisión.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
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

                <div className="p-8 space-y-6 overflow-y-auto">
                    
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-accent">
                                <Package size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-black text-slate-800">{selectedItems.length} Prendas Seleccionadas</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Listas para despacho logístico</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* DESTINATION */}
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <MapPin size={12} /> Sucursal Destino
                            </label>
                            <select 
                                value={selectedDestBranchId}
                                onChange={(e) => setSelectedDestBranchId(e.target.value)}
                                className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:border-accent transition-all"
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
                                className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:border-accent transition-all"
                            >
                                <option value="">Seleccionar chofer...</option>
                                {drivers.map(d => (
                                    <option key={d.id} value={d.id}>{d.nombre_completo}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* NOTES */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notas de Envío</label>
                        <textarea 
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full h-24 p-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-accent transition-all resize-none"
                            placeholder="Ej: Carga consolidada de la mañana..."
                        />
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleDispatch}
                            disabled={isSaving || isLoading || selectedItems.length === 0}
                            className={`w-full py-5 rounded-2xl font-black text-white shadow-xl transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em] ${
                                isSaving || isLoading || selectedItems.length === 0 
                                    ? 'bg-slate-300 cursor-not-allowed' 
                                    : 'bg-accent hover:scale-[1.02] active:scale-95 shadow-accent/20'
                            }`}
                        >
                            {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                            GENERAR GUÍA Y DESPACHAR
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogisticsBulkDispatchModal;

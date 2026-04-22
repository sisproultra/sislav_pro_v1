
import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, PackageCheck, Shirt, Square, CheckSquare, Loader2 } from 'lucide-react';
import { Invoice, CartItem } from '../types';

interface DeliveryItemsModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice;
    onConfirm: (itemIds: string[]) => Promise<void>;
}

const DeliveryItemsModal: React.FC<DeliveryItemsModalProps> = ({ isOpen, onClose, invoice, onConfirm }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);

    // FIX: Changed 'DELIVERED' to 'ENTREGADO' to match OrderStatus type
    const deliverableItems = invoice.items.filter(item => {
        const isCanceled = (item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO';
        return item.status !== 'ENTREGADO' && !isCanceled;
    });

    useEffect(() => {
        if (isOpen) {
            // Por defecto seleccionar todos los que faltan entregar
            setSelectedIds(new Set(deliverableItems.map(i => i.id)));
        }
    }, [isOpen, invoice]);

    if (!isOpen) return null;

    const toggleItem = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleConfirm = async () => {
        if (selectedIds.size === 0) return;
        setIsSaving(true);
        try {
            await onConfirm(Array.from(selectedIds));
            onClose();
        } catch (e) {
            alert("Error al procesar la entrega");
        } finally {
            setIsSaving(false);
        }
    };

    const selectAll = () => setSelectedIds(new Set(deliverableItems.map(i => i.id)));
    const deselectAll = () => setSelectedIds(new Set());

    return (
        <div className="fixed inset-0 bg-slate-950/80 z-[150] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/20">
                <div className="bg-emerald-600 text-white p-6 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <PackageCheck size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg uppercase tracking-tight">Entregar Prendas</h3>
                            <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">Orden #{invoice.ordenNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Seleccione las prendas a entregar</span>
                        <div className="flex gap-3">
                            <button onClick={selectAll} className="text-[9px] font-bold text-indigo-600 uppercase hover:underline">Todo</button>
                            <button onClick={deselectAll} className="text-[9px] font-bold text-slate-400 uppercase hover:underline">Ninguno</button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {deliverableItems.length === 0 ? (
                            <div className="py-10 text-center flex flex-col items-center gap-3">
                                <CheckCircle2 size={48} className="text-emerald-500 opacity-20" />
                                <p className="text-xs font-bold text-slate-400 uppercase">Todas las prendas ya fueron entregadas</p>
                            </div>
                        ) : (
                            deliverableItems.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => toggleItem(item.id)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedIds.has(item.id) ? 'bg-emerald-50 border-emerald-500 shadow-md' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        {selectedIds.has(item.id) ? <CheckSquare size={20} className="text-emerald-600" /> : <Square size={20} className="text-slate-300" />}
                                        <div className="flex flex-col">
                                            <span className={`font-bold text-sm uppercase ${selectedIds.has(item.id) ? 'text-emerald-900' : 'text-slate-700'}`}>{item.quantity} x {item.name}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">{item.category}</span>
                                        </div>
                                    </div>
                                    <div className={`p-2 rounded-xl ${selectedIds.has(item.id) ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-50 text-slate-300'}`}>
                                        <Shirt size={16} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-6 border-t bg-gray-50 shrink-0">
                    <button 
                        disabled={selectedIds.size === 0 || isSaving}
                        onClick={handleConfirm}
                        className={`w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 ${selectedIds.size > 0 ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                        {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20}/>}
                        CONFIRMAR ENTREGA ({selectedIds.size})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeliveryItemsModal;
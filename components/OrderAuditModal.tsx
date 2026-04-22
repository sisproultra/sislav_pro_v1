
import React, { useState, useEffect } from 'react';
import { X, History, Clock, User, MessageCircle, AlertCircle, Loader2 } from 'lucide-react';
import { dbGetItemHistory } from '../services/dbService';

interface OrderAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: string;
    itemName: string;
}

const OrderAuditModal: React.FC<OrderAuditModalProps> = ({ isOpen, onClose, itemId, itemName }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && itemId) {
            loadHistory();
        }
    }, [isOpen, itemId]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await dbGetItemHistory(itemId);
            setHistory(data || []);
        } catch (e) {
            console.error("Error cargando historial:", e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/80 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col h-[70vh] animate-in zoom-in-95">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-xl">
                            <History size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg uppercase tracking-tight leading-none">Historial de Estados</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{itemName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3">
                            <Loader2 size={32} className="animate-spin text-indigo-600" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consultando auditoría...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-300">
                            <AlertCircle size={48} strokeWidth={1} />
                            <p className="text-xs font-bold uppercase tracking-widest text-center">No hay registros de cambios para esta prenda</p>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
                            <div className="space-y-8 relative">
                                {history.map((log, index) => (
                                    <div key={log.id} className="flex gap-6 items-start">
                                        <div className={`w-8 h-8 rounded-full border-4 border-slate-50 flex items-center justify-center z-10 shrink-0 ${index === 0 ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-300'}`}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block mb-1">Nuevo Estado</span>
                                                    <h4 className="font-bold text-slate-900 text-sm uppercase">{log.estado_nuevo}</h4>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                        <Clock size={12} />
                                                        <span className="text-[10px] font-bold">{new Date(log.fecha_cambio).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-50">
                                                <div className="flex items-center gap-2">
                                                    <User size={14} className="text-slate-400" />
                                                    <div>
                                                        <p className="text-[8px] font-bold text-slate-300 uppercase">Procesado por</p>
                                                        <p className="text-[10px] font-bold text-slate-600 uppercase">{log.usuario || 'Sistema'}</p>
                                                    </div>
                                                </div>
                                                {log.observacion && (
                                                    <div className="flex items-center gap-2">
                                                        <MessageCircle size={14} className="text-slate-400" />
                                                        <div>
                                                            <p className="text-[8px] font-bold text-slate-300 uppercase">Observación</p>
                                                            <p className="text-[10px] font-bold text-slate-600 uppercase truncate">{log.observacion}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-white border-t border-slate-100 shrink-0">
                    <button onClick={onClose} className="w-full py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cerrar Historial</button>
                </div>
            </div>
        </div>
    );
};

export default OrderAuditModal;

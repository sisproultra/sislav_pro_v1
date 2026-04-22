
import React, { useState } from 'react';
import { Purchase, PurchaseItem, Supply, Company } from '../types';
import { X, Save, Plus, Trash2, ShoppingBasket, Loader2, Calculator, Beaker, Tag, AlertTriangle } from 'lucide-react';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (purchase: Omit<Purchase, 'id'>) => Promise<void>;
  supplies: Supply[];
  company: Company;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({ isOpen, onClose, onSave, supplies, company }) => {
  const [supplier, setSupplier] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedSupplyId, setSelectedSupplyId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lineTotal, setLineTotal] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);

  const currency = company?.currencySymbol || 'S/';

  if (!isOpen) return null;

  const handleAddItem = () => {
      const supply = supplies.find(s => s.id === selectedSupplyId);
      if (!supply) return;
      if (!quantity || parseFloat(quantity) <= 0 || !lineTotal || parseFloat(lineTotal) < 0) return;
      
      const qty = parseFloat(quantity);
      const total = parseFloat(lineTotal);
      const calculatedUnitCost = total / qty;
      
      const newItem: PurchaseItem = { 
          supplyId: supply.id, 
          name: supply.name, 
          quantity: qty, 
          unitCost: calculatedUnitCost, 
          total: total 
      };
      
      setItems([...items, newItem]);
      setSelectedSupplyId(''); 
      setQuantity(''); 
      setLineTotal('');
      setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (items.length === 0) {
          setErrorMsg("Debe agregar al menos un insumo a la compra.");
          return;
      }

      setIsSaving(true);
      setErrorMsg(null);
      try {
          await onSave({ 
              // FIX: Added sucursal_id to satisfy type requirement
              sucursal_id: company.id,
              date: new Date().toISOString(), 
              supplier: supplier.toUpperCase(), 
              items, 
              totalAmount: items.reduce((sum, i) => sum + i.total, 0) 
          });
          setSupplier(''); 
          setItems([]);
          onClose();
      } catch (err: any) {
          console.error("Transacción fallida:", err);
          setErrorMsg(err.message || "Error técnico al guardar la compra. Intente nuevamente.");
      } finally {
          setIsSaving(false);
      }
  };

  const totalPurchase = items.reduce((sum, i) => sum + i.total, 0);
  const previewUnitCost = (quantity && lineTotal) ? (parseFloat(lineTotal) / parseFloat(quantity)) : 0;

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-[150] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 border border-white/20">
        <div className="bg-emerald-600 text-white px-8 py-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <div className="bg-white/20 p-2 rounded-xl">
                    <ShoppingBasket size={24} />
                </div>
                <div>
                    <h2 className="font-bold text-xl uppercase tracking-tight">Abastecer Insumos</h2>
                    <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">Entrada de suministros a planta</p>
                </div>
            </div>
            <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                {errorMsg && (
                    <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 animate-in slide-in-from-top-2">
                        <AlertTriangle size={20} className="shrink-0" />
                        <p className="text-[11px] font-bold uppercase tracking-tight leading-tight">{errorMsg}</p>
                    </div>
                )}

                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Nombre del Proveedor</label>
                    <input 
                        type="text" 
                        required 
                        value={supplier} 
                        onChange={e => setSupplier(e.target.value.toUpperCase())} 
                        className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold uppercase outline-none focus:border-emerald-500 shadow-sm transition-all" 
                        placeholder="Ej: DISTRIBUIDORA QUÍMICA SAC" 
                    />
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                        <Plus size={12}/> Agregar Insumo a la Lista
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-12">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Seleccionar Insumo</label>
                            <select 
                                value={selectedSupplyId} 
                                onChange={e => setSelectedSupplyId(e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:bg-white"
                            >
                                <option value="">Elegir de la lista...</option>
                                {supplies.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-4">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Cantidad</label>
                            <input 
                                type="number" 
                                min="0.1" 
                                step="0.1" 
                                value={quantity} 
                                onChange={e => setQuantity(e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white" 
                                placeholder="0.0"
                            />
                        </div>
                        <div className="md:col-span-5">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Subtotal Insumo ({currency})</label>
                            <input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                value={lineTotal} 
                                onChange={e => setLineTotal(e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-emerald-600 outline-none focus:bg-white" 
                                placeholder="0.00"
                            />
                        </div>
                        <div className="md:col-span-3">
                            <button 
                                type="button" 
                                onClick={handleAddItem} 
                                className="w-full bg-slate-900 text-white p-3.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center"
                            >
                                <Plus size={20} strokeWidth={4} />
                            </button>
                        </div>
                    </div>
                    
                    {previewUnitCost > 0 && (
                        <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 flex items-center gap-2">
                            <Tag size={12} className="text-emerald-600" />
                            <span className="text-[9px] font-bold text-emerald-800 uppercase">Costo Unitario Calculado: {currency} {previewUnitCost.toFixed(4)}</span>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Resumen de Carga</h3>
                    <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr className="text-[9px] font-bold text-slate-400 uppercase">
                                    <th className="py-3 px-5">Insumo</th>
                                    <th className="py-3 px-5 text-right">Cant.</th>
                                    <th className="py-3 px-5 text-right">Unitario</th>
                                    <th className="py-3 px-5 text-right">Total</th>
                                    <th className="py-3 px-5"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.length === 0 ? (
                                    <tr><td colSpan={5} className="py-10 text-center text-slate-300 font-bold uppercase tracking-widest text-[9px]">Agregue insumos para ver el resumen</td></tr>
                                ) : items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                        <td className="py-3 px-5 font-bold text-slate-700 uppercase">{item.name}</td>
                                        <td className="py-3 px-5 text-right font-bold">{item.quantity}</td>
                                        <td className="py-3 px-5 text-right text-slate-400">{currency} {item.unitCost.toFixed(2)}</td>
                                        <td className="py-3 px-5 text-right font-bold text-slate-900">{currency} {item.total.toFixed(2)}</td>
                                        <td className="py-3 px-5 text-right">
                                            <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                                <Trash2 size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="p-8 border-t border-slate-200 bg-white flex flex-col sm:flex-row justify-between items-center gap-6 shrink-0 shadow-2xl">
                <div className="text-center sm:text-left">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Inversión de la Compra</p>
                    <div className="text-4xl font-bold text-slate-950 tracking-tight tabular-nums">
                        {currency} {totalPurchase.toFixed(2)}
                    </div>
                </div>
                <button 
                    type="submit" 
                    disabled={isSaving || items.length === 0} 
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-12 rounded-2xl shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
                    {isSaving ? 'Registrando...' : 'Confirmar Ingreso'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default PurchaseModal;

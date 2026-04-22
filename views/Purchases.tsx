import React from 'react';
import { Purchase, Company } from '../types';
// Add missing Clock import
import { ShoppingBasket, Plus, Calendar, FileText, User, Tag, Clock } from 'lucide-react';

interface PurchasesProps {
  purchases: Purchase[];
  company: Company;
  onOpenModal: () => void;
  canManage?: boolean;
}

const Purchases: React.FC<PurchasesProps> = ({ purchases, company, onOpenModal, canManage = true }) => {
  const currency = company.currencySymbol || 'S/';

  return (
    <div className="p-6 lg:p-8 h-full overflow-y-auto bg-slate-50 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
           <div>
              <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-3">
                 <ShoppingBasket className="text-emerald-600" size={32} /> Compras & Abastecimiento
              </h2>
              <p className="text-slate-500 font-medium">Registro histórico de ingresos de insumos a planta.</p>
           </div>
           {canManage && (
             <button onClick={onOpenModal} className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 flex gap-2 items-center transition-all active:scale-95 uppercase tracking-widest">
               <Plus size={24} strokeWidth={3} /> Registrar Compra
             </button>
           )}
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200">
                        <tr>
                            <th className="px-8 py-5">Fecha / Registro</th>
                            <th className="px-8 py-5">Proveedor</th>
                            <th className="px-8 py-5">Insumos Adquiridos</th>
                            <th className="px-8 py-5 text-right">Inversión Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {purchases.length === 0 ? (
                            <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px]">No hay compras registradas en el sistema</td></tr>
                        ) : (
                            purchases.map(purchase => (
                                <tr key={purchase.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-5 align-top">
                                        <div className="flex items-center gap-3 text-slate-900 font-bold">
                                            <Calendar size={14} className="text-indigo-500" />
                                            {new Date(purchase.date).toLocaleDateString('es-PE')}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1.5">
                                            {/* Fix: Added missing Clock icon component */}
                                            <Clock size={10} /> {new Date(purchase.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 align-top">
                                        <div className="font-bold text-slate-800 uppercase tracking-tight">{purchase.supplier}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1.5">
                                            <User size={10} /> SISTEMA
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 align-top">
                                        <div className="space-y-2">
                                            {purchase.items.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-2 text-[11px] font-bold text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100 w-fit">
                                                    <Tag size={10} className="text-emerald-500" />
                                                    <span className="font-bold text-emerald-600">{item.quantity}</span>
                                                    <span className="uppercase">{item.name}</span>
                                                    <span className="text-slate-400 font-medium">({currency}{item.unitCost.toFixed(2)} c/u)</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 align-top text-right">
                                        <span className="font-bold text-emerald-700 text-xl tabular-nums">{currency} {purchase.totalAmount.toFixed(2)}</span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Purchases;
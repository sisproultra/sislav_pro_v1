

import React, { useState, useRef, useEffect } from 'react';
import { Expense, Company, Employee, UserRole, PaymentMethodConfig } from '../types';
import { dbUploadImage, dbGetPaymentsForSession, dbGetExpensesForSession } from '../services/dbService';
import { Plus, X, Calendar, DollarSign, Tag, Camera, Trash2, Loader2, ImageIcon, User, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';

interface ExpensesProps {
  expenses: Expense[];
  company: Company;
  currentUser?: Employee | null;
  paymentMethods: PaymentMethodConfig[];
  activeCashSession?: any;
  onSave: (exp: Omit<Expense, 'id'>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  canManage?: boolean;
}

const Expenses: React.FC<ExpensesProps> = ({ expenses, company, currentUser, paymentMethods, activeCashSession, onSave, onDelete, canManage = true }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [sessionCashBalance, setSessionCashBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  useEffect(() => {
    if (isModalOpen && activeCashSession?.id) {
      loadCurrentBalance();
    } else {
      setSessionCashBalance(null);
    }
  }, [isModalOpen, activeCashSession?.id]);

  const loadCurrentBalance = async () => {
    if (!activeCashSession?.id) return;
    setIsLoadingBalance(true);
    try {
      const [payments, exps] = await Promise.all([
        dbGetPaymentsForSession(activeCashSession.id, company.id),
        dbGetExpensesForSession(activeCashSession.id, company.id)
      ]);

      let totalCashSales = 0;
      payments.forEach(p => {
        const method = (p.metodo_pago_name || 'EFECTIVO').toUpperCase();
        if (method.includes('EFECTIVO')) {
          totalCashSales += Number(p.monto) || 0;
        }
      });

      let totalCashExpenses = 0;
      exps.forEach(e => {
        const method = (e.paymentMethod || 'EFECTIVO').toUpperCase();
        if (method.includes('EFECTIVO')) {
          totalCashExpenses += Number(e.amount) || 0;
        }
      });

      const open = Number(activeCashSession.openingBalance) || 0;
      const balance = open + totalCashSales - totalCashExpenses;
      setSessionCashBalance(balance);
    } catch (err) {
      console.error("Error calculating current session balance:", err);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const parsedAmount = parseFloat(amount) || 0;
  const isEfectivo = paymentMethod.toUpperCase().includes('EFECTIVO');
  const isOverBalance = isEfectivo && sessionCashBalance !== null && parsedAmount > sessionCashBalance;

  const currency = company.currencySymbol || 'S/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading || isOverBalance) return;

    setIsCapturing(true);
    const finalDate = new Date().toISOString();

    // FIX: Add sucursal_id to onSave payload
    await onSave({
      sucursal_id: company.id,
      description: description.toUpperCase(),
      amount: parseFloat(amount),
      date: finalDate,
      category,
      paymentMethod,
      usuarioRegistro: (currentUser?.name || localStorage.getItem('sislav_current_user_name') || 'SISTEMA').trim().toUpperCase()
    });
    setIsModalOpen(false);
    setIsCapturing(false);
    resetForm();
  };

  const resetForm = () => {
      setDescription('');
      setAmount('');
      setCategory('');
      setPaymentMethod('EFECTIVO');
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="p-6 lg:p-8 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Egresos</h2>
            <p className="text-sm text-gray-500">Registro de salidas de dinero, recaudos y gastos operativos</p>
          </div>
          <div className="flex items-center gap-4">
              <div className="text-right">
                  <p className="text-xs text-gray-500 font-bold uppercase">Total Mes</p>
                  <p className="text-xl font-bold text-red-600">{currency} {totalExpenses.toFixed(2)}</p>
              </div>
              {canManage && (
                <button 
                  onClick={() => { resetForm(); setIsModalOpen(true); }}
                  className="bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-700 shadow-lg shadow-red-600/20"
                >
                  <Plus size={18} /> Registrar Egreso
                </button>
              )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                    <tr>
                        <th className="p-4">Fecha</th>
                        <th className="p-4">Descripción</th>
                        <th className="p-4">Categoría</th>
                        <th className="p-4">Registrado por</th>
                        <th className="p-4 text-right">Monto</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {expenses.length === 0 ? (
                        <tr><td colSpan={5} className="p-12 text-center text-gray-400">No hay egresos registrados.</td></tr>
                    ) : (
                        expenses.map((exp, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="p-4 text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-gray-400"/>
                                        <div className="flex flex-col">
                                            <span>{new Date(exp.date).toLocaleDateString()}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(exp.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 font-medium text-gray-800">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            {exp.evidencePhoto && <ImageIcon size={14} className="text-indigo-500 shrink-0" />}
                                            {exp.description}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{exp.paymentMethod || 'EFECTIVO'}</span>
                                            {!(exp.paymentMethod || 'EFECTIVO').toUpperCase().includes('EFECTIVO') && (
                                                <span className="text-[8px] bg-amber-100 text-amber-600 px-1.5 rounded font-black uppercase">Informativo</span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs uppercase font-bold">{exp.category}</span></td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                        <User size={12} /> {exp.usuarioRegistro || 'SISTEMA'}
                                    </div>
                                </td>
                                <td className="p-4 text-right font-bold text-red-600 tabular-nums">{currency} {exp.amount.toFixed(2)}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[150] flex items-center justify-center p-0 md:p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-none md:rounded-[2.5rem] w-full max-w-lg h-full md:h-auto md:max-h-[85vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/20">
             <div className="p-6 border-b flex justify-between items-center bg-red-50 shrink-0">
                 <div className="flex items-center gap-3">
                    <div className="bg-red-600 p-2 rounded-xl text-white shadow-lg">
                        <DollarSign size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-red-900 uppercase tracking-tight">Nuevo Egreso</h3>
                 </div>
                 <button onClick={() => { setIsModalOpen(false); }} className="p-2 hover:bg-red-100 rounded-full transition-colors"><X size={24} className="text-red-800"/></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-white">
                 <form onSubmit={handleSubmit} className="space-y-6">
                     <div className="space-y-1">
                         <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Descripción</label>
                         <input required value={description} onChange={e => setDescription(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-bold uppercase outline-none focus:bg-white focus:border-red-500 transition-all shadow-inner" placeholder="PAGO DE LUZ, RECIBO N°..." />
                     </div>

                     {/* Saldo de caja disponible (Efectivo) */}
                     {activeCashSession && (
                       <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all duration-200 ${
                         sessionCashBalance !== null && sessionCashBalance <= 0
                           ? 'bg-rose-50/50 border-rose-200 text-rose-900' 
                           : 'bg-emerald-50/30 border-emerald-100 text-emerald-900'
                       }`}>
                         <div>
                           <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Saldo Disponible en Caja (Efectivo)</p>
                           <p className="text-xl font-black mt-0.5">
                             {isLoadingBalance ? (
                               <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><Loader2 className="animate-spin text-emerald-600" size={12} /> Calculando saldo actual...</span>
                             ) : sessionCashBalance !== null ? (
                               `${currency} ${sessionCashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                             ) : (
                               'No disponible'
                             )}
                           </p>
                         </div>
                         <div className={`p-2 rounded-xl ${
                           sessionCashBalance !== null && sessionCashBalance <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100/60 text-emerald-800'
                         }`}>
                           <DollarSign size={20} />
                         </div>
                       </div>
                     )}

                     <div className="space-y-1">
                         <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Monto del Egreso</label>
                         <div className="relative">
                            <span className={`absolute left-5 top-1/2 -translate-y-1/2 font-bold text-lg transition-colors duration-200 ${isOverBalance ? 'text-rose-600' : 'text-red-600'}`}>{currency}</span>
                            <input 
                               type="number" 
                               step="0.01" 
                               min="0"
                               required 
                               value={amount} 
                               onChange={e => {
                                 const val = e.target.value;
                                 if (val === '' || parseFloat(val) >= 0) {
                                   setAmount(val);
                                 }
                               }} 
                               className={`w-full pl-12 pr-4 py-4 text-3xl font-bold outline-none transition-all shadow-inner rounded-2xl border-2 ${
                                 isOverBalance 
                                   ? 'bg-rose-50/50 border-rose-300 text-rose-900 focus:bg-white focus:border-rose-500 ring-2 ring-rose-100' 
                                   : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-red-500'
                               }`}
                               placeholder="0.00" 
                            />
                         </div>
                         {isOverBalance && (
                           <p className="text-[11px] font-black text-rose-600 px-1 mt-1.5 flex items-center gap-1.5 animate-pulse">
                             <AlertTriangle size={14} /> El monto excede el saldo de efectivo real en caja ({currency} {sessionCashBalance?.toFixed(2)})
                           </p>
                         )}
                     </div>
                     <div className="space-y-4">
                         <div className="space-y-1">
                             <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Categoría</label>
                             <select required value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold uppercase outline-none focus:bg-white appearance-none shadow-sm">
                                <option value="" disabled>Seleccionar...</option>
                                <option>Liquidacion</option>
                                <option>Servicios</option>
                                <option>Personal</option>
                                <option>Mantenimiento</option>
                                <option>Insumos</option>
                                <option>Recaudo</option>
                                <option>Descuento</option>
                                <option>Otros</option>
                             </select>
                         </div>
                     </div>

                     <div className="space-y-1">
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Medio de Pago</label>
                         <div className="flex flex-wrap gap-2">
                             {paymentMethods.filter(m => m.isActive && !m.isSuspended).map(method => (
                                 <button
                                     key={method.id}
                                     type="button"
                                     onClick={() => setPaymentMethod(method.name.toUpperCase())}
                                     className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${paymentMethod === method.name.toUpperCase() ? 'border-red-600 bg-red-50 text-red-600' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                                 >
                                     <span className="text-[10px] font-bold uppercase whitespace-nowrap">{method.name}</span>
                                 </button>
                             ))}
                         </div>
                     </div>
                     
                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                             <ShieldCheck size={18} />
                         </div>
                         <div className="flex-1">
                             <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-0.5">Operador Responsable</p>
                             <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{(currentUser?.name || localStorage.getItem('sislav_current_user_name') || 'SISTEMA').trim().toUpperCase()}</p>
                         </div>
                     </div>

                     <button 
                        type="submit" 
                        disabled={isCapturing || isUploading || isOverBalance}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-5 rounded-[1.8rem] shadow-2xl shadow-red-600/30 active:scale-95 transition-all flex justify-center items-center gap-3 uppercase tracking-[0.2em] text-xs disabled:opacity-50"
                     >
                        {isCapturing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} strokeWidth={3} />}
                        {isCapturing ? 'Procesando...' : 'Confirmar Registro Egreso'}
                     </button>
                 </form>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;

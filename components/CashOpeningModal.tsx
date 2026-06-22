
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Banknote, X, CheckCircle2, AlertTriangle, TrendingUp, Clock, Calculator, Loader2 } from 'lucide-react';
import { Company } from '../types';
import { dbGetLastAccumulatedBalance } from '../services/dbService';

interface CashOpeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number, turno: string) => Promise<void>;
  company: Company;
}

const CashOpeningModal: React.FC<CashOpeningModalProps> = ({ isOpen, onClose, onConfirm, company }) => {
  const [amount, setAmount] = useState('');
  const [turno, setTurno] = useState(() => new Date().getHours() < 12 ? 'MAÑANA' : 'TARDE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryColor = company.primaryColor || '#0054A6';
  const currency = company.currencySymbol || 'S/';

  useEffect(() => {
    if (isOpen && (company as any).cash_management_type === 'ACCUMULATIVE') {
      const fetchLastBalance = async () => {
        setIsLoadingBalance(true);
        try {
          if (company.id) {
            const userId = localStorage.getItem('sislav_active_user_uuid') || '';
            const balance = await dbGetLastAccumulatedBalance(company.id, userId);
            setAmount(balance.toFixed(2));
          }
        } catch (err) {
          console.error("Error al cargar saldo acumulado:", err);
        } finally {
          setIsLoadingBalance(false);
        }
      };
      fetchLastBalance();
    } else if (isOpen) {
        setAmount(''); 
    }
  }, [isOpen, company.id, (company as any).cash_management_type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (amount === '' || isNaN(val) || val < 0) {
      setError("Por favor ingrese un monto inicial válido.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(val, turno);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Error al abrir la caja. Intente de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="relative p-8 pb-4 text-center">
             <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center text-emerald-600 mx-auto border-4 border-white shadow-xl mb-4">
                <Banknote size={40} />
             </div>
             <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Apertura de Caja</h2>
             <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Obligatorio para iniciar operaciones</p>
             
             <button onClick={onClose} className="absolute right-6 top-6 p-2 hover:bg-slate-50 rounded-full text-slate-300 transition-colors">
                <X size={20} />
             </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 pt-2 space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-4"
              >
                 <AlertTriangle className="text-rose-500 shrink-0" size={20} />
                 <span className="text-rose-800 text-xs font-bold leading-tight">{error}</span>
              </motion.div>
            )}

            <div className="space-y-4">
              {/* Turno Selector - Hidden as requested */}
              <div className="hidden grid grid-cols-2 gap-3">
                 <button 
                   type="button"
                   onClick={() => setTurno('MAÑANA')}
                   className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${turno === 'MAÑANA' ? 'bg-blue-50 border-blue-600/30' : 'bg-gray-50 border-transparent text-gray-400'}`}
                 >
                    <Clock size={20} className={turno === 'MAÑANA' ? 'text-blue-600' : ''} />
                    <span className="text-[10px] font-black tracking-widest uppercase">Mañana</span>
                 </button>
                 <button 
                   type="button"
                   onClick={() => setTurno('TARDE')}
                   className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${turno === 'TARDE' ? 'bg-amber-50 border-amber-600/30' : 'bg-gray-50 border-transparent text-gray-400'}`}
                 >
                    <TrendingUp size={20} className={turno === 'TARDE' ? 'text-amber-600' : ''} />
                    <span className="text-[10px] font-black tracking-widest uppercase">Tarde</span>
                 </button>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                 <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto Inicial en Efectivo</label>
                    {isLoadingBalance && <Loader2 size={12} className="animate-spin text-slate-400" />}
                 </div>
                 <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">{currency}</div>
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
                      autoFocus
                      readOnly={isLoadingBalance || (company as any).cash_management_type === 'ACCUMULATIVE'}
                      className={`w-full pl-14 pr-6 py-6 border-2 rounded-3xl outline-none transition-all font-black text-4xl text-slate-800 shadow-inner ${((company as any).cash_management_type === 'ACCUMULATIVE') ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100 focus:bg-white focus:ring-4 focus:ring-slate-100'}`}
                      placeholder="0.00"
                    />
                 </div>
                 {(company as any).cash_management_type === 'ACCUMULATIVE' && (
                    <p className="text-[10px] font-bold text-amber-600 px-4 mt-1 italic">
                      Modo Acumulativo activo: Se carga automáticamente el saldo final de su turno anterior.
                    </p>
                 )}
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-5 rounded-3xl font-black text-lg text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:grayscale disabled:opacity-50"
                style={{ backgroundColor: primaryColor, boxShadow: `0 20px 40px -10px ${primaryColor}50` }}
              >
                 {isSubmitting ? <Calculator className="animate-spin" size={24} /> : (
                   <>
                     <span>REGISTRAR APERTURA</span>
                     <CheckCircle2 size={24} />
                   </>
                 )}
              </button>
              <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-tighter mt-4 italic px-4">
                Esta acción registrará la hora exacta de apertura y habilitará las operaciones de venta y gastos.
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CashOpeningModal;

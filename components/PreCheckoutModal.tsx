import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Ticket, Check, Trash2, Wallet, StickyNote, AlertCircle, CreditCard, Banknote, Smartphone, QrCode, Landmark, DollarSign, CalendarCheck, Edit3, Tag, Loader2 } from 'lucide-react';
import { PaymentMethodConfig, CartItem, Company } from '../types';
import { dbValidateCoupon, dbRedeemCoupon } from '../services/dbService';

interface PreCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { deliveryDate: string | undefined, notes: string, prePaymentAmount: number, discountAmount: number, paymentDetailsStr: string, paymentsList?: { methodName: string, amount: number }[] }) => void;
  totalAmount: number;
  paymentMethods: PaymentMethodConfig[];
  isDelivery?: boolean; 
  cart?: CartItem[]; 
  company: Company;
}

interface PaymentEntry {
    id: string;
    methodName: string;
    amount: number;
    isCoupon?: boolean;
    couponId?: string;
    isCash?: boolean; 
}

const TIME_OPTIONS = [
    "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", 
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM", 
    "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM"
];

const PreCheckoutModal: React.FC<PreCheckoutModalProps> = ({ isOpen, onClose, onConfirm, totalAmount, paymentMethods, isDelivery = false, cart = [], company }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('05:00 PM');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('');
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [currentAmount, setCurrentAmount] = useState('');
  const [isCouponMode, setIsCouponMode] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [showDateConfirmation, setShowDateConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const currency = company?.currencySymbol || 'S/';
  const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim() || '#0054A6';
  const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-secondary').trim() || '#10B981';

  useEffect(() => {
    if (isOpen) {
        const defaultDate = new Date();
        if (!isDelivery) defaultDate.setDate(defaultDate.getDate() + 1); 
        setDate(defaultDate.toISOString().split('T')[0]);
        setTime('05:00 PM');
        setNotes('');
        setDiscount('');
        setPayments([]);
        setCurrentAmount(''); 
        setCouponCode('');
        setIsCouponMode(false);
        setCouponError('');
        setShowDateConfirmation(false);
    }
  }, [isOpen, totalAmount, isDelivery]);

  const discountVal = parseFloat(discount) || 0;
  const netTotal = Math.max(0, totalAmount - discountVal);
  
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const pending = Math.max(0, netTotal - totalPaid);
  const hasCashPayment = payments.some(p => p.isCash);
  const rawChange = totalPaid - netTotal;
  const change = (hasCashPayment && rawChange > 0) ? rawChange : 0;

  const handleAddPayment = (method: PaymentMethodConfig) => {
      if (pending <= 0) return;
      const isCash = method.sunatCode === '009' || method.name.toLowerCase().includes('efectivo');
      let amountVal = parseFloat(currentAmount);
      
      if (isNaN(amountVal) || amountVal <= 0) { 
          amountVal = pending; 
      }

      if (!isCash && amountVal > pending) amountVal = pending;

      const newPayment: PaymentEntry = { 
          id: Date.now().toString(), 
          methodName: method.name.toUpperCase(), 
          amount: amountVal, 
          isCash: isCash 
      };
      setPayments([...payments, newPayment]);
      setCurrentAmount(''); 
  };

  const removePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id));
  };

  const handleValidateCoupon = async () => {
      if (!couponCode) return;
      try {
          const result = await dbValidateCoupon(couponCode);
          if (result.valid && result.coupon) {
              const amountToApply = pending > 0 ? Math.min(pending, result.coupon.amount) : 0;
              const newPayment: PaymentEntry = { id: 'cpn-' + Date.now(), methodName: `CUPÓN (${result.coupon.code})`, amount: amountToApply, isCoupon: true, couponId: result.coupon.id };
              setPayments([...payments, newPayment]);
              setCouponCode('');
              setIsCouponMode(false);
          } else { setCouponError(result.message || 'Error'); }
      } catch (e) { setCouponError("Error al validar cupón."); }
  };

  const getHumanFriendlyDate = () => {
      if (!date) return "";
      const selectedDate = new Date(date + 'T12:00:00');
      const today = new Date();
      today.setHours(0,0,0,0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const dayName = selectedDate.toLocaleDateString('es-PE', { weekday: 'long' });
      const dayNum = selectedDate.getDate();

      if (selectedDate.getTime() === today.getTime()) {
          return `hoy ${dayName} ${dayNum}`;
      } else if (selectedDate.getTime() === tomorrow.getTime()) {
          return `mañana ${dayName} ${dayNum}`;
      } else {
          return `el ${dayName} ${dayNum}`;
      }
  };

  const handleInitialConfirm = () => {
      setShowDateConfirmation(true);
  };

  const handleFinalConfirm = async () => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
          let finalDeliveryISO = isDelivery ? new Date().toISOString() : `${date}T${(time12h => { const [t, m] = time12h.split(' '); let [h, min] = t.split(':'); if (h === '12') h = '00'; if (m === 'PM') h = String(parseInt(h, 10) + 12); return `${h}:${min}:00`; })(time)}Z`;
          for (const p of payments) { if (p.isCoupon && p.couponId) await dbRedeemCoupon(p.couponId); }
          
          const summaryParts = payments.map(p => `${p.methodName}`);
          const paymentStr = summaryParts.length === 0 ? "PENDIENTE" : Array.from(new Set(summaryParts)).join(' + ');
          
          const paymentsList = payments.map(p => ({ 
              methodName: p.methodName, 
              amount: p.amount 
          }));

          onConfirm({ 
              deliveryDate: finalDeliveryISO, 
              notes: notes.toUpperCase(), 
              prePaymentAmount: totalPaid - change, 
              discountAmount: discountVal,
              paymentDetailsStr: paymentStr,
              paymentsList: paymentsList
          });
      } catch (e) {
          console.error(e);
          setIsProcessing(false);
      }
  };

  const getMethodIcon = (methodName: string, size: number = 16) => {
      if (methodName.includes('CUPÓN')) return <Ticket size={size} className="text-pink-500" />;
      const pm = paymentMethods.find(p => p.name.toUpperCase() === methodName.toUpperCase());
      const iconData = pm?.icon || '';
      if (iconData.startsWith('data:') || iconData.startsWith('http')) {
          return <img src={iconData} className="w-full h-full object-contain" />;
      }
      
      switch(iconData) {
          case 'banknote': return <Banknote size={size} />;
          case 'smartphone': return <Smartphone size={size} />;
          case 'qr-code': return <QrCode size={size} />;
          case 'landmark': return <Landmark size={size} />;
          case 'credit-card': return <CreditCard size={size} />;
          default: return <DollarSign size={size} />;
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 z-[150] flex items-center justify-center p-2 md:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto">
        <style>{`
            @keyframes blink-red {
                0%, 100% { color: #ef4444; }
                50% { color: #991b1b; transform: scale(1.05); }
            }
            .animate-blink-red {
                animation: blink-red 0.8s infinite;
                display: inline-block;
            }
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>

      <div className="bg-white w-full max-w-4xl rounded-2xl md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[98vh] md:max-h-[95vh] border border-white/20 relative my-auto">
        
        {/* MODAL DE CONFIRMACIÓN DE FECHA INTERMEDIO */}
        {showDateConfirmation && (
            <div className="absolute inset-0 z-[160] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                <div className="bg-white rounded-[3rem] p-8 md:p-12 w-full max-w-md shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-100 text-center flex flex-col items-center">
                    <div className="p-6 rounded-full mb-8 shadow-inner ring-8" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                        <CalendarCheck size={64} strokeWidth={2.5} className="animate-bounce" />
                    </div>
                    
                    <h4 className="text-xl font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">¿Confirmar Entrega?</h4>
                    
                    <p className="text-2xl font-bold text-slate-900 uppercase tracking-tight leading-tight mb-2">
                        La fecha de entrega es para
                    </p>
                    <p className="text-3xl font-bold uppercase tracking-tight leading-none mb-10" style={{ color: primaryColor }}>
                        {getHumanFriendlyDate()} <br/> <span className="text-slate-900">{time}</span>
                    </p>

                    <div className="w-full flex flex-col gap-4">
                        <button 
                            onClick={handleFinalConfirm}
                            disabled={isProcessing}
                            style={{ backgroundColor: primaryColor }}
                            className="w-full py-5 text-white rounded-3xl font-bold text-sm uppercase tracking-[0.25em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 shadow-indigo-600/20 disabled:opacity-50 disabled:grayscale"
                        >
                            {isProcessing ? <Loader2 className="animate-spin" /> : <><Check size={24} strokeWidth={4} /> Aceptar y Finalizar</>}
                        </button>
                        <button 
                            onClick={() => setShowDateConfirmation(false)}
                            className="w-full py-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:text-slate-600 transition-colors"
                        >
                            <Edit3 size={16} /> Modificar Fecha
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="px-4 md:px-8 py-4 md:py-5 flex justify-between items-center text-white shrink-0 shadow-lg" style={{ backgroundColor: primaryColor }}>
            <div className="flex items-center gap-2 md:gap-3">
                <div className="bg-white/10 p-1.5 md:p-2 rounded-xl border border-white/20 shadow-inner"><Wallet size={18} className="md:w-5 md:h-5" /></div>
                <h3 className="font-bold text-sm md:text-lg uppercase tracking-widest">Registro de Pago</h3>
            </div>
            <button onClick={onClose} className="hover:bg-white/10 p-1.5 md:p-2 rounded-full transition-colors"><X size={20} className="md:w-6 md:h-6" /></button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50 overflow-y-auto md:overflow-hidden">
            <div className="w-full md:w-[45%] flex flex-col p-4 md:p-6 border-b md:border-b-0 md:border-r border-slate-200 bg-white shrink-0 md:shrink">
                <div className="space-y-4 md:space-y-6">
                    <div className="grid grid-cols-1 gap-3 md:gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 md:mb-2 ml-1">Monto a agregar</label>
                            <div className="relative">
                                <span className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-xl md:text-2xl">{currency}</span>
                                <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 font-bold text-2xl md:text-4xl p-3 md:p-5 pl-10 md:pl-14 rounded-2xl md:rounded-3xl outline-none focus:ring-8 focus:ring-indigo-50 focus:border-indigo-500 focus:bg-white transition-all shadow-inner text-slate-900" placeholder={pending > 0 ? pending.toFixed(2) : "0.00"} value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} disabled={pending <= 0} autoFocus />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 md:mb-3 ml-1 text-center sm:text-left">Medios de Pago</label>
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 gap-2">
                            {paymentMethods.filter(pm => pm.isActive).map(pm => (
                                <button 
                                    key={pm.id} 
                                    onClick={() => handleAddPayment(pm)} 
                                    disabled={pending <= 0} 
                                    className="bg-white aspect-square rounded-xl md:rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 active:scale-95 transition-all shadow-sm flex items-center justify-center disabled:opacity-50 disabled:grayscale relative overflow-hidden group p-0"
                                >
                                    <div className="w-full h-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500 p-1 md:p-0">
                                        {getMethodIcon(pm.name, 28)}
                                    </div>
                                </button>
                            ))}
                            <button 
                                onClick={() => setIsCouponMode(!isCouponMode)} 
                                disabled={pending <= 0} 
                                className={`aspect-square rounded-xl md:rounded-2xl border-2 active:scale-95 transition-all shadow-sm flex flex-col items-center justify-center relative overflow-hidden disabled:opacity-50 group p-0 ${isCouponMode ? 'bg-pink-600 border-pink-700 text-white' : 'bg-white border-pink-100 text-pink-600 hover:bg-pink-50'}`}
                            >
                                <Ticket size={28} className="group-hover:scale-110 transition-transform duration-500" />
                            </button>
                        </div>
                    </div>
                    {isCouponMode && (
                        <div className="bg-pink-50 p-4 rounded-3xl border border-pink-100 animate-in slide-in-from-top-2"><div className="flex gap-2"><input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} className="flex-1 bg-white border-2 border-pink-200 rounded-xl px-4 py-2 text-sm font-bold uppercase outline-none focus:border-pink-500 text-slate-900" placeholder="CÓDIGO..." /><button onClick={handleValidateCoupon} className="bg-pink-600 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase shadow-lg">Aplicar</button></div>{couponError && <p className="text-[9px] text-red-600 font-bold mt-2 flex items-center gap-1"><AlertCircle size={10}/> {couponError}</p>}</div>
                    )}
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 no-scrollbar pt-2 border-t border-slate-50">
                        {payments.length === 0 ? (
                            <div className="py-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Sin abonos agregados</p>
                            </div>
                        ) : payments.map(p => (
                            <div key={p.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between animate-in slide-in-from-right-2"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-slate-50 border border-slate-100">{getMethodIcon(p.methodName, 18)}</div><span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">{p.methodName}</span></div><div className="flex items-center gap-3"><span className="font-bold text-xs text-slate-900">{currency} {p.amount.toFixed(2)}</span><button onClick={() => removePayment(p.id)} className="p-1.5 text-slate-200 hover:text-red-500 transition-colors bg-slate-50 rounded-lg"><Trash2 size={14}/></button></div></div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col bg-white overflow-hidden shrink-0 md:shrink">
                <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex justify-between items-end mb-4 md:mb-6"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Total de la Orden</span><span className="text-3xl md:text-5xl font-bold text-slate-950 tracking-tight tabular-nums leading-none">{currency} {netTotal.toFixed(2)}</span></div>
                    {discountVal > 0 && (
                        <div className="flex justify-between mb-4 px-2 animate-in fade-in slide-in-from-right-2">
                             <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Descuento aplicado:</span>
                             <span className="text-xs md:text-sm font-bold text-indigo-600">-{currency} {discountVal.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 md:gap-3">
                        <div className="bg-white p-2 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center"><span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase mb-0.5 md:mb-1 tracking-widest text-center leading-none">PAGADO</span><span className="text-xs md:text-sm font-bold text-emerald-600 tabular-nums">{currency} {totalPaid.toFixed(2)}</span></div>
                        <div className="bg-white p-2 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center"><span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase mb-0.5 md:mb-1 tracking-widest text-center leading-none">PENDIENTE</span><span className={`text-xs md:text-sm font-bold tabular-nums ${pending > 0 ? 'animate-blink-red' : 'text-slate-900'}`}>{currency} {pending.toFixed(2)}</span></div>
                        <div className="bg-white p-2 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center"><span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase mb-0.5 md:mb-1 tracking-widest text-center leading-none">VUELTO</span><span className="text-xs md:text-sm font-bold text-indigo-600 tabular-nums">{currency} {change.toFixed(2)}</span></div>
                    </div>
                </div>
                <div className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6 overflow-y-auto no-scrollbar md:custom-scrollbar">
                    {/* CAMPO DE DESCUENTO ESPECIAL MOVIDO AQUÍ */}
                    <div className="bg-slate-50 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 md:mb-2 ml-1 flex items-center gap-2">
                            <Tag size={12} className="text-indigo-600" /> Descuento Especial
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-xl">{currency}</span>
                            <input 
                                type="number" 
                                value={discount} 
                                onChange={e => {
                                    const val = parseFloat(e.target.value);
                                    if (isNaN(val)) setDiscount('');
                                    else if (val > totalAmount) setDiscount(totalAmount.toString());
                                    else setDiscount(e.target.value);
                                }} 
                                className="w-full bg-white border-2 border-slate-100 font-bold text-lg md:text-2xl p-2 md:p-3 pl-10 md:pl-12 rounded-xl md:rounded-2xl outline-none focus:border-indigo-500 transition-all shadow-sm text-slate-800" 
                                placeholder="0.00" 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <div className="space-y-1 md:space-y-2"><label className="block text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Calendar size={12}/> Fecha Entrega</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all" /></div>
                        <div className="space-y-1 md:space-y-2"><label className="block text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Clock size={12}/> Hora Entrega</label><div className="relative"><select value={time} onChange={e => setTime(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all appearance-none">{TIME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div></div>
                    </div>
                    <div className="space-y-1 md:space-y-2"><label className="block text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><StickyNote size={12}/> Observaciones Generales</label><textarea value={notes} onChange={e => setNotes(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all resize-none h-20 md:h-24 uppercase shadow-inner" placeholder="EJ: CLIENTE DEJA BOLSA..." /></div>
                </div>
                <div className="p-4 md:p-6 border-t border-slate-100 bg-white shrink-0">
                  <button 
                    onClick={handleInitialConfirm} 
                    style={{ backgroundColor: primaryColor }} 
                    className="w-full py-4 md:py-5 rounded-2xl md:rounded-[2.2rem] font-bold text-xs md:text-sm uppercase tracking-[0.25em] shadow-xl md:shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 md:gap-4 text-white shadow-indigo-600/20"
                  >
                    <Check strokeWidth={4} className="w-5 h-5 md:w-6 md:h-6" /> Finalizar Venta
                  </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PreCheckoutModal;
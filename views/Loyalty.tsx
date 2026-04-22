import React, { useState, useEffect } from 'react';
import { Coupon, Company } from '../types';
import { dbGetCoupons, dbCreateCoupon } from '../services/dbService';
import { Ticket, Plus, Printer, Calendar, Search, X, Check, Loader2 } from 'lucide-react';

interface LoyaltyProps {
  company: Company;
  canManage?: boolean;
}

const Loyalty: React.FC<LoyaltyProps> = ({ company, canManage = true }) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'USED' | 'EXPIRED'>('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [conditions, setConditions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => { loadCoupons(); }, []);
  const loadCoupons = async () => { const data = await dbGetCoupons(); setCoupons(data); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !expirationDate) return;
    
    setIsGenerating(true);
    try {
        await dbCreateCoupon({ 
            amount: parseFloat(amount), 
            expirationDate, 
            conditions: conditions.toUpperCase() 
        });
        
        setAmount(''); 
        setExpirationDate(''); 
        setConditions('');
        setIsModalOpen(false);
        await loadCoupons();
    } catch (error: any) {
        console.error("Error al crear cupón:", error);
        alert(`No se pudo crear el cupón: ${error.message || "Error de conexión con la base de datos"}`);
    } finally {
        setIsGenerating(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currency = company.currencySymbol || 'S/';

  const stats = {
      ACTIVE: coupons.filter(c => { const exp = new Date(c.expirationDate); exp.setHours(23, 59, 59, 999); return !c.isUsed && exp >= today; }).reduce((sum, c) => sum + c.amount, 0),
      USED: coupons.filter(c => c.isUsed).reduce((sum, c) => sum + c.amount, 0),
      EXPIRED: coupons.filter(c => { const exp = new Date(c.expirationDate); exp.setHours(23, 59, 59, 999); return !c.isUsed && exp < today; }).reduce((sum, c) => sum + c.amount, 0),
      ALL: coupons.reduce((sum, c) => sum + c.amount, 0)
  };

  const filteredCoupons = coupons.filter(c => {
      const matchesSearch = c.code.includes(searchTerm.toUpperCase());
      if (!matchesSearch) return false;
      const expDate = new Date(c.expirationDate);
      expDate.setHours(23, 59, 59, 999);
      if (filter === 'ACTIVE') return !c.isUsed && expDate >= today;
      if (filter === 'USED') return c.isUsed;
      if (filter === 'EXPIRED') return !c.isUsed && expDate < today;
      return true;
  });

  const handlePrintTicket = (coupon: Coupon) => {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${coupon.code}`;
      const expDate = new Date(coupon.expirationDate).toLocaleDateString('es-PE');
      
      const content = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <style>
              @page { margin: 0; size: 80mm auto; }
              body { 
                  font-family: 'Courier New', Courier, monospace; 
                  margin: 0; 
                  padding: 2mm 5mm; 
                  width: 70mm; 
                  color: #000;
                  background: #fff;
                  text-align: center;
              }
              .promo-badge { 
                  font-size: 11pt; 
                  font-weight: 900; 
                  color: #000;
                  margin-top: 1mm;
                  text-transform: uppercase;
                  letter-spacing: 1pt;
              }
              .amount-display { 
                  margin: 1mm 0; 
                  line-height: 1.1; 
              }
              .amount-val { 
                  font-size: 36pt; 
                  font-weight: 900; 
              }
              .amount-currency { 
                  font-size: 16pt; 
                  font-weight: 900; 
                  margin-right: 1mm; 
              }
              .code-box { 
                  border: 2px solid #000; 
                  padding: 1.5mm 4mm; 
                  margin: 2mm auto; 
                  font-size: 18pt; 
                  font-weight: 900; 
                  letter-spacing: 2pt;
                  display: inline-block;
              }
              .qr-code { 
                  width: 32mm; 
                  height: 32mm; 
                  margin: 1mm auto; 
                  display: block; 
              }
              .vencimiento { 
                  font-size: 9pt; 
                  font-weight: 900; 
                  margin: 1mm 0;
                  text-transform: uppercase;
              }
              .footer-info { 
                  font-size: 7.5pt; 
                  text-align: justify; 
                  line-height: 1.2; 
                  margin-top: 2mm;
                  border-top: 1px dashed #ccc;
                  padding-top: 1mm;
                  font-weight: bold;
              }
              .brand-footer {
                  font-size: 7pt;
                  margin-top: 2mm;
                  color: #000;
                  text-transform: uppercase;
                  font-weight: 900;
              }
          </style>
      </head>
      <body>
          <div class="promo-badge">VALE DE DSCTO</div>
          
          <div class="amount-display">
              <span class="amount-currency">${currency}</span>
              <span class="amount-val">${coupon.amount.toFixed(0)}</span>
          </div>
          
          <div class="code-box">${coupon.code}</div>
          
          <img src="${qrUrl}" class="qr-code" />
          
          <div class="vencimiento">VÁLIDO HASTA: ${expDate}</div>
          
          <div class="footer-info">
              * Este cupón es de un solo uso por cliente.<br/>
              * No acumulable con otras promociones o vales.<br/>
              * Aplicable sobre el total de su consumo.<br/>
              * El canje debe realizarse antes de la fecha indicada.
          </div>

          <div class="brand-footer">${company.razonSocial.toUpperCase()}</div>
          
          <script>
              window.onload = function() {
                  window.focus();
                  window.print();
                  setTimeout(function() { window.close(); }, 500);
              };
          </script>
      </body>
      </html>`;

      const pw = window.open('', '_blank');
      if (pw) { pw.document.write(content); pw.document.close(); }
  };

  return (
    <div className="p-6 lg:p-8 h-full overflow-y-auto bg-gray-100">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2 tracking-tight"><Ticket className="text-indigo-600" size={32} /> FIDELIZACIÓN</h2><p className="text-sm text-gray-500 font-medium">Gestión de cupones y descuentos exclusivos.</p></div>
          {canManage && (
            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-indigo-700 shadow-xl flex items-center gap-2 active:scale-95"><Plus size={18} /> CREAR CUPÓN</button>
          )}
        </div>
        <div className="flex flex-col md:flex-row gap-4 bg-white p-2 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex bg-gray-100 p-1.5 rounded-xl shrink-0 gap-1">{(['ACTIVE', 'USED', 'EXPIRED', 'ALL'] as const).map(f => (<button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center min-w-[90px] ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><span>{f === 'ACTIVE' ? 'ACTIVOS' : f === 'USED' ? 'COBRADOS' : f === 'EXPIRED' ? 'VENCIDOS' : 'TODOS'}</span><span className={`text-[10px] ${filter === f ? 'text-indigo-600' : 'text-gray-400'}`}>{currency} {stats[f].toFixed(2)}</span></button>))}</div>
            <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar código..." className="w-full pl-11 pr-4 py-3 border-none bg-transparent rounded-xl text-sm focus:ring-0 placeholder:text-gray-400 font-medium h-full"/></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCoupons.map(coupon => {
                const expDate = new Date(coupon.expirationDate); expDate.setHours(23, 59, 59, 999);
                const isExpired = expDate < today && !coupon.isUsed;
                return (
                    <div key={coupon.id} className={`flex w-full h-44 filter drop-shadow-md transition-transform hover:-translate-y-1 ${coupon.isUsed ? 'opacity-70' : 'opacity-100'}`}>
                        <div className={`flex-1 ${coupon.isUsed ? 'bg-blue-50' : isExpired ? 'bg-red-50' : 'bg-emerald-50'} rounded-l-2xl relative flex flex-col p-5 border-r-2 border-dashed border-gray-400/50 overflow-hidden`}>
                            <div className="flex justify-between items-start relative z-10"><div><h3 className="font-bold text-sm uppercase tracking-widest opacity-60 mb-1">Descuento</h3><h2 className="font-bold text-4xl tracking-tight">{currency} {coupon.amount.toFixed(2)}</h2></div><Ticket size={40} className="opacity-20" /></div>
                            <div className="mt-auto relative z-10"><div className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">Vence:</div><div className="text-lg font-bold flex items-center gap-2"><Calendar size={16} /> {new Date(coupon.expirationDate).toLocaleDateString()}</div></div>
                        </div>
                        <div className={`w-32 ${coupon.isUsed ? 'bg-blue-700' : isExpired ? 'bg-red-700' : 'bg-emerald-600'} rounded-r-2xl flex flex-col items-center justify-center p-2 relative text-white shadow-inner`}>
                            <div className="relative z-10 flex flex-col items-center h-full justify-between py-4"><div className="text-[10px] font-bold uppercase tracking-widest opacity-80">{coupon.isUsed ? 'COBRADO' : isExpired ? 'VENCIDO' : 'ACTIVO'}</div><div className="-rotate-90 whitespace-nowrap"><span className="font-mono text-xl font-bold tracking-[0.15em]">{coupon.code}</span></div><div className="flex gap-2"><button onClick={() => handlePrintTicket(coupon)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"><Printer size={16} /></button></div></div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
      
      {isModalOpen && (
          <div className="fixed inset-0 bg-indigo-900/40 z-[160] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
                  <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                      <h3 className="font-bold text-indigo-900 text-xl uppercase tracking-tight">Nuevo Cupón</h3>
                      <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
                          <X size={24}/>
                      </button>
                  </div>
                  <form onSubmit={handleCreate} className="p-8 space-y-6">
                      <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Monto de Descuento</label>
                          <div className="relative">
                              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-900 font-bold text-xl">{currency}</span>
                              <input 
                                  type="number" 
                                  required 
                                  step="0.01"
                                  value={amount} 
                                  onChange={e => setAmount(e.target.value)} 
                                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-14 pr-4 py-4 text-3xl font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-600 transition-all shadow-inner" 
                                  placeholder="0.00"
                                  autoFocus
                              />
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Fecha de Expiración</label>
                          <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input 
                                type="date" 
                                required 
                                value={expirationDate} 
                                min={new Date().toISOString().split('T')[0]}
                                onChange={e => setExpirationDate(e.target.value)} 
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-600 transition-all shadow-inner" 
                            />
                          </div>
                      </div>
                      <button 
                        type="submit" 
                        disabled={isGenerating} 
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-2xl shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em] disabled:opacity-50 disabled:grayscale"
                      >
                        {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} strokeWidth={3} />}
                        {isGenerating ? 'GENERANDO...' : 'CREAR CUPÓN PREMIADO'}
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default Loyalty;

import React, { useState, useEffect, useRef } from 'react';
import { Invoice, OrderStatus, Company } from '../types';
import { 
  Package, Search, CheckCircle2, AlertTriangle, 
  Ghost, Barcode, RotateCcw, Calendar, 
  Clock, DollarSign, ArrowRight, XCircle, ClipboardCheck,
  Ticket, Hash, Check, Trash2
} from 'lucide-react';
import { formatDateSafe } from '../utils/calculations';

interface PackageInventoryProps {
  invoices: Invoice[];
  onUpdateStatus: (id: string, status: OrderStatus) => void;
  company: Company;
}

type InventoryStep = 'SCAN' | 'PROCESSING' | 'REPORT';

interface AuditResult {
  conforme: Invoice[];   // Físico SI, Sistema SI (Pendiente/Listo)
  noConforme: Invoice[]; // Físico SI, Sistema NO (Ya entregado - Inconsistencia)
  faltante: Invoice[];   // Físico NO, Sistema SI (Perdido?)
}

const PackageInventory: React.FC<PackageInventoryProps> = ({ invoices, company }) => {
  const [step, setStep] = useState<InventoryStep>('SCAN');
  
  const [inputCode, setInputCode] = useState('');
  const [scannedInvoices, setScannedInvoices] = useState<Invoice[]>([]);
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  
  const [progress, setProgress] = useState(0);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      if (step === 'SCAN' && inputRef.current) {
          inputRef.current.focus();
      }
  }, [scannedInvoices, step]);

  const getDaysOld = (dateStr: string) => {
      const diff = new Date().getTime() - new Date(dateStr).getTime();
      return Math.floor(diff / (1000 * 3600 * 24));
  };

  const handleScan = (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputCode.trim()) return;

      const term = inputCode.trim(); 
      const termNumber = parseInt(term); 
      
      const found = invoices.find(inv => {
          if (inv.type === '07') return false; 
          if (!inv.ordenNumber) return false; 
          return inv.ordenNumber === term || parseInt(inv.ordenNumber) === termNumber;
      });

      if (found) {
          if (!scannedInvoices.some(i => i.id === found.id)) {
              setScannedInvoices(prev => [found, ...prev]);
              setLastScannedId(found.id);
          }
      } else {
          alert(`LA ORDEN N° ${term} NO EXISTE`);
      }

      setInputCode('');
  };

  const startProcessing = () => {
      if (scannedInvoices.length === 0) {
          if (!confirm("No has escaneado ningún paquete. ¿Deseas procesar para ver todo lo que falta?")) return;
      }
      setStep('PROCESSING');
      setProgress(0);
      const duration = 5000; 
      const interval = 50; 
      const steps = duration / interval;
      let currentStep = 0;
      const timer = setInterval(() => {
          currentStep++;
          const percent = Math.min(100, (currentStep / steps) * 100);
          setProgress(percent);
          if (currentStep >= steps) {
              clearInterval(timer);
              calculateAudit();
          }
      }, interval);
  };

  const calculateAudit = () => {
      const systemActive = invoices.filter(inv => 
          inv.type !== '07' && 
          inv.orderStatus !== 'ENTREGADO' &&
          inv.sunatStatus !== 'REJECTED' 
      );
      const conforme: Invoice[] = [];
      const noConforme: Invoice[] = []; 
      scannedInvoices.forEach(scanned => {
          if (scanned.orderStatus === 'ENTREGADO') noConforme.push(scanned);
          else conforme.push(scanned);
      });
      const scannedIds = new Set(scannedInvoices.map(i => i.id));
      const faltante = systemActive.filter(active => !scannedIds.has(active.id));
      setAuditResult({ conforme, noConforme, faltante });
      setStep('REPORT');
  };

  const resetInventory = () => {
      if(confirm("¿Estás seguro de iniciar un nuevo inventario? Se perderán los datos actuales.")) {
          setScannedInvoices([]);
          setLastScannedId(null);
          setAuditResult(null);
          setStep('SCAN');
          setInputCode('');
      }
  };

  if (step === 'PROCESSING') {
      return (
          <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-white p-8 absolute inset-0 z-50">
              <div className="w-full max-w-lg text-center space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="relative"><div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 rounded-full"></div><ClipboardCheck size={100} className="mx-auto text-blue-400 relative z-10 animate-bounce" strokeWidth={1.5} /></div>
                  <div><h2 className="text-4xl font-bold mb-3 tracking-tight">Procesando Inventario</h2><p className="text-slate-400 text-lg">Analizando cruce de datos físicos vs sistema...</p></div>
                  <div className="space-y-2"><div className="w-full bg-slate-800 rounded-full h-8 overflow-hidden border border-slate-700 relative shadow-inner"><div className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 transition-all duration-100 ease-linear relative" style={{ width: `${progress}%` }}><div className="absolute inset-0 bg-white/30 animate-[shimmer_1s_infinite]"></div></div></div><div className="flex justify-between text-xs font-mono text-slate-500"><span>INICIANDO</span><span>{Math.round(progress)}%</span><span>FINALIZANDO</span></div></div>
              </div>
          </div>
      );
  }

  if (step === 'REPORT' && auditResult) {
      return (
          <div className="p-6 lg:p-8 h-full overflow-y-auto bg-gray-50">
              <div className="max-w-7xl mx-auto space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                      <div className="flex items-center gap-4"><div className="bg-green-100 p-3 rounded-full text-green-600 ring-4 ring-green-50"><CheckCircle2 size={40} /></div><div><h2 className="text-3xl font-bold text-gray-800">Inventario Finalizado</h2><p className="text-gray-500">Auditoría procesada con éxito.</p></div></div>
                      <button onClick={resetInventory} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-all flex items-center gap-2 shadow-lg hover:-translate-y-1"><RotateCcw size={18} /> NUEVO INVENTARIO</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-6 rounded-2xl border-l-4 border-green-500 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">CONFORME (Ok)</p><h3 className="text-4xl font-bold text-gray-800">{auditResult.conforme.length}</h3><p className="text-xs text-green-600 font-medium mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> Correctos en almacén</p></div><Package className="text-green-100" size={64} strokeWidth={1} /></div>
                      <div className="bg-white p-6 rounded-2xl border-l-4 border-amber-500 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">NO CONFORME</p><h3 className="text-4xl font-bold text-gray-800">{auditResult.noConforme.length}</h3><p className="text-xs text-amber-600 font-medium mt-2 flex items-center gap-1"><AlertTriangle size={12} /> Figuran como "Entregados"</p></div><AlertTriangle className="text-amber-100" size={64} strokeWidth={1} /></div>
                      <div className="bg-white p-6 rounded-2xl border-l-4 border-red-500 shadow-sm flex items-center justify-between relative overflow-hidden"><div className="relative z-10"><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">FALTANTES (Pérdida?)</p><h3 className="text-4xl font-bold text-gray-800">{auditResult.faltante.length}</h3><p className="text-xs text-red-600 font-medium mt-2 flex items-center gap-1"><Ghost size={12} /> No encontrados</p></div><Ghost className="text-red-100 relative z-10" size={64} strokeWidth={1} />{auditResult.faltante.length > 0 && (<div className="absolute inset-0 bg-red-50/50 z-0 animate-pulse"></div>)}</div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
                      <div className="bg-white rounded-2xl border border-red-200 shadow-lg overflow-hidden flex flex-col h-[500px]">
                          <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center"><h3 className="font-bold text-red-800 flex items-center gap-2"><Ghost size={20} /> Paquetes Faltantes (Revisar)</h3><span className="text-xs font-bold bg-red-200 text-red-800 px-3 py-1 rounded-full">{auditResult.faltante.length}</span></div>
                          <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
                              {auditResult.faltante.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-gray-300"><CheckCircle2 size={64} className="text-green-100 mb-4" /><p className="font-bold uppercase tracking-widest text-xs">Sin faltantes en almacén</p></div>) : (
                                  <table className="w-full text-left">
                                      <thead className="bg-gray-50 sticky top-0 z-10"><tr><th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase">Orden</th><th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase">Cliente</th><th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase text-right">Antigüedad</th></tr></thead>
                                      <tbody className="divide-y">
                                          {auditResult.faltante.map(pkg => (
                                              <tr key={pkg.id} className="hover:bg-red-50/30 transition-colors">
                                                  <td className="px-6 py-4 font-bold text-slate-900">#{pkg.ordenNumber}</td>
                                                  <td className="px-6 py-4 font-bold text-slate-600 uppercase text-xs truncate max-w-[150px]">{pkg.client.name}</td>
                                                  <td className="px-6 py-4 text-right"><span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${getDaysOld(pkg.date) > 7 ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{getDaysOld(pkg.date)} DÍAS</span></td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              )}
                          </div>
                      </div>
                      <div className="bg-white rounded-2xl border border-green-200 shadow-lg overflow-hidden flex flex-col h-[500px]">
                          <div className="bg-green-50 px-6 py-4 border-b border-green-100 flex justify-between items-center"><h3 className="font-bold text-green-800 flex items-center gap-2"><CheckCircle2 size={20} /> Paquetes Conformados</h3><span className="text-xs font-bold bg-green-200 text-green-800 px-3 py-1 rounded-full">{auditResult.conforme.length}</span></div>
                          <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
                              <table className="w-full text-left">
                                  <thead className="bg-gray-50 sticky top-0 z-10"><tr><th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase">Orden</th><th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase">Cliente</th><th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase text-right">Status</th></tr></thead>
                                  <tbody className="divide-y">
                                      {auditResult.conforme.map(pkg => (
                                          <tr key={pkg.id} className="hover:bg-green-50/30 transition-colors">
                                              <td className="px-6 py-4 font-bold text-slate-900">#{pkg.ordenNumber}</td>
                                              <td className="px-6 py-4 font-bold text-slate-600 uppercase text-xs truncate max-w-[150px]">{pkg.client.name}</td>
                                              <td className="px-6 py-4 text-right"><span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-green-100 text-green-700 uppercase border border-green-200">{pkg.orderStatus}</span></td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="p-6 lg:p-10 h-full overflow-hidden bg-slate-900 flex flex-col relative">
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full animate-in fade-in slide-in-from-bottom-4">
        
        <div className="text-center mb-10 shrink-0">
            <div className="bg-blue-600 p-4 rounded-[2rem] inline-block mb-6 shadow-2xl shadow-blue-500/20 ring-4 ring-blue-500/10"><Package size={48} className="text-white" /></div>
            <h2 className="text-4xl font-bold text-white uppercase tracking-tight mb-2">Auditoría de Inventario</h2>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-[0.2em]">Escanee prendas físicas para auditar sucursal</p>
        </div>

        <div className="flex-1 flex flex-col gap-8 overflow-hidden">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-white/5 p-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 shrink-0 group hover:border-blue-500/30 transition-all">
                <form onSubmit={handleScan} className="w-full relative">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-500 group-focus-within:text-blue-400 transition-colors"><Barcode size={32} /></div>
                    <input 
                      ref={inputRef}
                      type="text" 
                      autoFocus
                      value={inputCode} 
                      onChange={e => setInputCode(e.target.value)} 
                      placeholder="ESCANEAR CÓDIGO DE BARRAS O TICKET..." 
                      className="w-full h-20 bg-black/40 border-4 border-slate-700 rounded-3xl pl-20 pr-6 text-2xl font-bold text-white outline-none focus:border-blue-600 transition-all placeholder:text-slate-600 placeholder:text-base placeholder:font-bold tracking-widest"
                    />
                </form>
                <div className="flex justify-between w-full items-center">
                    <div className="flex items-center gap-3 text-slate-400"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div><span className="text-[10px] font-bold uppercase tracking-widest">Escáner de mano activo</span></div>
                    <button onClick={startProcessing} disabled={scannedInvoices.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-30 disabled:grayscale flex items-center gap-3">PROCESAR INVENTARIO <ArrowRight size={18}/></button>
                </div>
            </div>

            <div className="flex-1 bg-black/40 rounded-[3rem] border border-white/5 overflow-hidden flex flex-col shadow-inner">
                <div className="p-6 bg-slate-800/30 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3"><Hash size={16} className="text-blue-500" /> Registro Actual Escaneado</h3>
                    <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-bold">{scannedInvoices.length} PAQUETES</div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                    {scannedInvoices.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-700 p-10 text-center">
                            <Barcode size={64} strokeWidth={1} className="mb-4 opacity-10" />
                            <p className="text-sm font-bold uppercase tracking-widest opacity-20">Esperando primer escaneo...</p>
                        </div>
                    ) : scannedInvoices.map((pkg, idx) => (
                        <div key={pkg.id} className={`p-5 rounded-3xl border flex items-center justify-between group animate-in slide-in-from-right-4 transition-all ${lastScannedId === pkg.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-[1.02]' : 'bg-slate-800/40 border-white/5 text-slate-300'}`}>
                            <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-inner ${lastScannedId === pkg.id ? 'bg-white/20' : 'bg-slate-700'}`}>
                                    {scannedInvoices.length - idx}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xl font-bold tracking-tight ${lastScannedId === pkg.id ? 'text-white' : 'text-slate-100'}`}>TICKET #{pkg.ordenNumber}</span>
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${lastScannedId === pkg.id ? 'bg-black/20' : 'bg-slate-900 text-blue-400 border border-blue-900/50'}`}>{pkg.orderStatus}</span>
                                    </div>
                                    <p className={`text-[10px] font-bold uppercase mt-1 tracking-widest ${lastScannedId === pkg.id ? 'text-white/60' : 'text-slate-500'}`}>{pkg.client.name} • {formatDateSafe(pkg.date)}</p>
                                </div>
                            </div>
                            <button onClick={() => setScannedInvoices(prev => prev.filter(i => i.id !== pkg.id))} className={`p-3 rounded-xl transition-all ${lastScannedId === pkg.id ? 'hover:bg-black/20 text-white' : 'hover:bg-rose-500/10 text-slate-600 hover:text-rose-500'}`}><Trash2 size={20}/></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }`}</style>
    </div>
  );
};

export default PackageInventory;

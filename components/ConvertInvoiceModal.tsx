import React, { useState, useEffect } from 'react';
import { X, FileText, User, Search, Plus, CheckCircle2, AlertCircle, ArrowRightLeft, Loader2, Cloud, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Invoice, InvoiceType, Client, Company } from '../types';
import ClientModal from './ClientModal';

interface ConvertInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  clients: Client[];
  onConvert: (targetType: InvoiceType, finalClient: Client) => Promise<void>;
  apiToken: string;
  onAddClient: (client: Client) => Promise<Client>;
  company?: Company;
  primaryColor?: string;
  secondaryColor?: string;
}

const ConvertInvoiceModal: React.FC<ConvertInvoiceModalProps> = ({ 
  isOpen, onClose, invoice, clients, onConvert, apiToken, onAddClient, company,
  primaryColor: propPrimaryColor,
  secondaryColor: propSecondaryColor
}) => {
  const primaryColor = propPrimaryColor || company?.primaryColor || '#4f46e5';
  const secondaryColor = propSecondaryColor || company?.secondaryColor || '#6366f1';

  const [targetType, setTargetType] = useState<InvoiceType>(InvoiceType.BOLETA);
  const [selectedClient, setSelectedClient] = useState<Client>(invoice.client);
  const [clientSearch, setClientSearch] = useState('');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isBetaMode = company?.sunatEnvironment === 'BETA';

  useEffect(() => {
    if (isOpen) {
      setSelectedClient(invoice.client);
      setTargetType(invoice.client.docType === 'RUC' ? InvoiceType.FACTURA : InvoiceType.BOLETA);
    }
  }, [isOpen, invoice]);

  if (!isOpen) return null;

  const clientSuggestions = clientSearch 
    ? clients.filter(c => 
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
        c.docNumber.includes(clientSearch)
      ).slice(0, 5) 
    : [];

  const isValidForFactura = selectedClient.docType === 'RUC';
  const canConvert = targetType === InvoiceType.FACTURA ? isValidForFactura : true;

  const handleConvertClick = async () => {
    setIsProcessing(true);
    try {
        await onConvert(targetType, selectedClient);
        onClose();
    } catch (e) {
        console.error(e);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleNewClientSave = async (c: Client) => {
    try {
        const saved = await onAddClient(c);
        setSelectedClient(saved);
        setIsClientModalOpen(false);
    } catch (e) {
        alert("Error al guardar cliente");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        <div style={{ backgroundColor: primaryColor }} className="p-6 text-white flex justify-between items-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-black/10 rounded-full blur-xl"></div>
          
          <div className="flex items-center gap-4 z-10">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/30 shadow-inner">
              <ArrowRightLeft size={24} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg uppercase tracking-wider mb-0.5">Autorizar Emisión</h3>
                {isBetaMode && (
                  <span className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse border border-orange-400">MODO BETA</span>
                )}
              </div>
              <p className="text-[10px] font-black text-white/70 uppercase tracking-widest flex items-center gap-2">
                <span className="bg-white/20 px-1.5 py-0.5 rounded">TICKET #{invoice.ordenNumber}</span>
                <span className="w-1 h-1 bg-white/40 rounded-full"></span>
                <span>TOTAL: S/ {invoice.totals.total.toFixed(2)}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all active:scale-90 z-10"><X size={24}/></button>
        </div>

        <div className="p-6 space-y-6">
          {/* SELECCIÓN DE TIPO */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
                <FileText size={14} className="text-slate-400" />
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tipo de Comprobante</label>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setTargetType(InvoiceType.BOLETA)}
                className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all border-2 relative overflow-hidden ${targetType === InvoiceType.BOLETA ? 'text-white border-transparent shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                style={targetType === InvoiceType.BOLETA ? { backgroundColor: primaryColor } : {}}
              >
                {targetType === InvoiceType.BOLETA && <div className="absolute right-2 top-2"><CheckCircle2 size={14} /></div>}
                BOLETA ELECTRÓNICA
              </button>
              <button 
                onClick={() => setTargetType(InvoiceType.FACTURA)}
                className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all border-2 relative overflow-hidden ${targetType === InvoiceType.FACTURA ? 'text-white border-transparent shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                style={targetType === InvoiceType.FACTURA ? { backgroundColor: primaryColor } : {}}
              >
                {targetType === InvoiceType.FACTURA && <div className="absolute right-2 top-2"><CheckCircle2 size={14} /></div>}
                FACTURA ELECTRÓNICA
              </button>
            </div>
          </div>

          {/* SELECCIÓN DE CLIENTE */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <User size={14} className="text-slate-400" />
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Asignar Cliente</label>
                </div>
                <button onClick={() => setIsClientModalOpen(true)} className="text-[10px] font-black px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all flex items-center gap-1">
                    <Plus size={12}/> CREAR NUEVO
                </button>
            </div>
 
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input 
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Buscar por DNI, RUC o Nombre..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-inner"
                />
                {clientSearch && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        {clientSuggestions.map(c => (
                            <div 
                                key={c.id} 
                                onClick={() => { setSelectedClient(c); setClientSearch(''); }}
                                className="p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-50 flex items-center gap-3 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                    <User size={14} />
                                </div>
                                <div className="flex-1">
                                    <p className="font-extrabold text-slate-800 text-[11px] uppercase truncate">{c.name}</p>
                                    <p className="text-[9px] text-slate-400 font-mono font-bold tracking-tighter">{c.docType}: {c.docNumber}</p>
                                </div>
                                <ArrowRightLeft size={14} className="text-slate-200" />
                            </div>
                        ))}
                        {clientSuggestions.length === 0 && <div className="p-6 text-center text-[11px] text-slate-400 font-bold uppercase tracking-widest italic bg-slate-50/50">No se encontraron resultados</div>}
                    </div>
                )}
            </div>

            <div className={`p-5 rounded-2xl border-2 transition-all flex items-center gap-5 relative overflow-hidden ${isValidForFactura || targetType === InvoiceType.BOLETA ? 'bg-indigo-50/30 border-indigo-100/50 shadow-sm' : 'bg-red-50 border-red-100'}`}>
                {/* Background decorative icon */}
                <User size={64} className={`absolute -right-4 -bottom-4 opacity-[0.03] rotate-12 ${isValidForFactura || targetType === InvoiceType.BOLETA ? 'text-indigo-600' : 'text-red-900'}`} />
                
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-1 ${isValidForFactura || targetType === InvoiceType.BOLETA ? 'bg-white text-indigo-600 shadow-indigo-100' : 'bg-white text-red-500 shadow-red-100'}`}>
                    <User size={28} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cliente Seleccionado</p>
                    <p className="font-black text-slate-900 text-sm uppercase truncate tracking-tight">{selectedClient.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${isValidForFactura || targetType === InvoiceType.BOLETA ? 'bg-indigo-100 text-indigo-600' : 'bg-red-100 text-red-600'}`}>{selectedClient.docType}</span>
                        <span className="text-[11px] font-mono font-bold text-slate-500 tracking-tighter">{selectedClient.docNumber}</span>
                    </div>
                </div>
                {targetType === InvoiceType.FACTURA && !isValidForFactura && (
                    <div className="p-2 bg-white rounded-full shadow-md text-red-500 animate-bounce">
                        <AlertCircle size={24} />
                    </div>
                )}
            </div>

            {targetType === InvoiceType.FACTURA && !isValidForFactura && (
                <div className="bg-red-100 border border-red-200 text-red-700 p-4 rounded-xl text-[10px] font-black uppercase text-center tracking-[0.15em] flex items-center justify-center gap-3 animate-in shake-1">
                    <div className="bg-red-200 p-1 rounded-lg"><AlertCircle size={14}/></div>
                    Se requiere un cliente con RUC (6) para emitir Factura
                </div>
            )}
          </div>

          <button 
            disabled={!canConvert || isProcessing}
            onClick={handleConvertClick}
            style={canConvert && !isProcessing ? { backgroundColor: primaryColor } : {}}
            className={`w-full py-5 rounded-[1.5rem] font-black text-sm tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 uppercase ${canConvert && !isProcessing ? 'text-white shadow-indigo-200 hover:brightness-110' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20}/> EMITIR {targetType === InvoiceType.BOLETA ? 'BOLETA' : 'FACTURA'}</>}
          </button>
        </div>

        {/* LOADING OVERLAY MODERNO */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/90 backdrop-blur-xl z-[120] flex flex-col items-center justify-center p-8"
            >
              <div className="w-full max-w-[280px] space-y-8 text-center">
                {/* Icono animado */}
                <div className="relative flex justify-center">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    style={{ borderColor: primaryColor }}
                    className="w-24 h-24 border-2 border-t-transparent rounded-full shadow-2xl opacity-10"
                  ></motion.div>
                  
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.1, 1],
                      opacity: [0.5, 1, 0.5]
                    }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    style={{ backgroundColor: primaryColor }}
                    className="absolute inset-0 m-auto w-16 h-16 rounded-full blur-2xl opacity-20"
                  ></motion.div>

                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    >
                      <Cloud size={40} style={{ color: primaryColor }} />
                    </motion.div>
                    <motion.div
                      className="absolute -right-1 -top-1"
                      animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                      transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                    >
                      <Sparkles size={16} style={{ color: secondaryColor }} />
                    </motion.div>
                  </div>
                </div>

                <div className="space-y-3">
                  <motion.h4 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="font-black text-slate-800 uppercase tracking-[0.2em] text-xs"
                  >
                    Emitiendo Documento
                  </motion.h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                    Sincronizando factura con servidor SUNAT
                  </p>
                </div>

                {/* Barra de progreso moderna e indeterminada */}
                <div className="space-y-3">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
                    <motion.div 
                      className="h-full absolute left-0 top-0 rounded-full"
                      style={{ backgroundColor: primaryColor }}
                      animate={{ 
                        left: ["-100%", "100%"],
                        width: ["50%", "30%", "50%"]
                      }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 1.8, 
                        ease: "easeInOut" 
                      }}
                    ></motion.div>
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Conectando...</span>
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Validando...</span>
                  </div>
                </div>

                <div className="pt-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100"
                  >
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Certificación en curso
                    </span>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ClientModal 
        isOpen={isClientModalOpen} 
        onClose={() => setIsClientModalOpen(false)} 
        onSave={handleNewClientSave} 
        apiToken={apiToken} 
        initialDocType={targetType === InvoiceType.FACTURA ? 'RUC' : 'DNI'} 
        clientsList={clients}
      />
    </div>
  );
};

export default ConvertInvoiceModal;
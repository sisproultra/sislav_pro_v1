import React, { useState, useEffect } from 'react';
import { X, FileText, User, Search, Plus, CheckCircle2, AlertCircle, ArrowRightLeft, Loader2 } from 'lucide-react';
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
}

const ConvertInvoiceModal: React.FC<ConvertInvoiceModalProps> = ({ 
  isOpen, onClose, invoice, clients, onConvert, apiToken, onAddClient, company
}) => {
  const [targetType, setTargetType] = useState<InvoiceType>(InvoiceType.BOLETA);
  const [selectedClient, setSelectedClient] = useState<Client>(invoice.client);
  const [clientSearch, setClientSearch] = useState('');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isTestMode = company?.sunatEnvironment === 'TEST';

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
    <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <ArrowRightLeft size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg uppercase tracking-tight">Convertir Documento</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Orden #{invoice.ordenNumber} • S/ {invoice.totals.total.toFixed(2)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
        </div>

        <div className="p-8 space-y-6">
          {/* SELECCIÓN DE TIPO */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Tipo de Comprobante Electrónico</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setTargetType(InvoiceType.BOLETA)}
                className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all border-2 ${targetType === InvoiceType.BOLETA ? (isTestMode ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-indigo-600 text-white border-indigo-600 shadow-lg') : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'} ${isTestMode ? 'animate-pulse bg-emerald-500 border-emerald-600 text-white' : ''}`}
              >
                BOLETA
              </button>
              <button 
                onClick={() => setTargetType(InvoiceType.FACTURA)}
                className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-all border-2 ${targetType === InvoiceType.FACTURA ? (isTestMode ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-indigo-600 text-white border-indigo-600 shadow-lg') : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'} ${isTestMode ? 'animate-pulse bg-emerald-500 border-emerald-600 text-white' : ''}`}
              >
                FACTURA
              </button>
            </div>
          </div>

          {/* SELECCIÓN DE CLIENTE */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validación de Cliente</label>
                <button onClick={() => setIsClientModalOpen(true)} className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1">
                    <Plus size={12}/> CREAR CLIENTE
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Cambiar cliente (DNI, RUC o Nombre)..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
                {clientSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                        {clientSuggestions.map(c => (
                            <div 
                                key={c.id} 
                                onClick={() => { setSelectedClient(c); setClientSearch(''); }}
                                className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 flex flex-col"
                            >
                                <span className="font-bold text-gray-800 text-xs uppercase">{c.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{c.docType}: {c.docNumber}</span>
                            </div>
                        ))}
                        {clientSuggestions.length === 0 && <div className="p-4 text-center text-xs text-slate-400 italic">No se encontraron clientes</div>}
                    </div>
                )}
            </div>

            <div className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${isValidForFactura || targetType === InvoiceType.BOLETA ? 'bg-indigo-50/50 border-indigo-100' : 'bg-red-50 border-red-100'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${isValidForFactura || targetType === InvoiceType.BOLETA ? 'bg-white text-indigo-600' : 'bg-white text-red-500'}`}>
                    <User size={24} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm uppercase truncate">{selectedClient.name}</p>
                    <p className="text-[10px] font-bold text-slate-500">{selectedClient.docType}: {selectedClient.docNumber}</p>
                </div>
                {targetType === InvoiceType.FACTURA && !isValidForFactura && (
                    <div className="text-red-600 animate-pulse">
                        <AlertCircle size={20} />
                    </div>
                )}
            </div>

            {targetType === InvoiceType.FACTURA && !isValidForFactura && (
                <div className="bg-red-600 text-white p-3 rounded-xl text-[10px] font-bold uppercase text-center tracking-widest flex items-center justify-center gap-2">
                    <AlertCircle size={14}/> Se requiere un cliente con RUC para Factura
                </div>
            )}
          </div>

          <button 
            disabled={!canConvert || isProcessing}
            onClick={handleConvertClick}
            className={`w-full py-5 rounded-2xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 ${canConvert && !isProcessing ? (isTestMode ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 animate-pulse' : 'bg-slate-900 text-white hover:bg-black shadow-slate-200') : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={24}/> EMITIR {targetType === InvoiceType.BOLETA ? 'BOLETA' : 'FACTURA'}</>}
          </button>
        </div>
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
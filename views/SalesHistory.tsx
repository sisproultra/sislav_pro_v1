
import React, { useState, useMemo } from 'react';
import { Invoice, InvoiceType, OrderStatus, IdentityDocumentType, Company, Client } from '../types';
import { 
    FileText, CheckCircle2, AlertTriangle, Eye, XCircle, Undo2, Ban, 
    FileCode, FileArchive, Search, Filter, Calendar, Trash2, 
    FileWarning, Download, Table, MessageCircle, Loader2, 
    ExternalLink, Check, ArrowRightLeft, Phone, ShieldCheck, FileCheck
} from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import VoidReasonModal from '../components/VoidReasonModal';
import ConvertInvoiceModal from '../components/ConvertInvoiceModal';
import * as XLSX from 'xlsx';
import { formatDateSafe, formatTimeSafe } from '../utils/calculations';
import { sendInvoiceViaWhatsApp, generateWhatsAppLink } from '../services/whatsappService';

interface SalesHistoryProps {
  invoices: Invoice[];
  company: Company;
  clients: Client[];
  onViewReceipt: (invoice: Invoice) => void;
  onVoidInvoice?: (invoice: Invoice, reason: string) => void; 
  onDeleteInvoice?: (invoice: Invoice) => void; 
  onConvertInvoice?: (invoice: Invoice, targetType: InvoiceType, finalClient: Client) => Promise<void>;
  onRetrySunat?: (invoice: Invoice) => Promise<void>;
  onSendSummary?: (invoices: Invoice[]) => Promise<void>;
  onAddClient: (client: Client) => Promise<Client>;
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ invoices, company, clients, onViewReceipt, onVoidInvoice, onDeleteInvoice, onConvertInvoice, onRetrySunat, onSendSummary, onAddClient }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');

  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [invoiceToVoid, setInvoiceToVoid] = useState<Invoice | null>(null);
  const [invoiceToConvert, setInvoiceToConvert] = useState<Invoice | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingSummary, setIsSendingSummary] = useState(false);
  const [sendingWaId, setSendingWaId] = useState<string | null>(null);
  const [sentSuccessIds, setSentSuccessIds] = useState<Set<string>>(new Set());

  const periods = useMemo(() => {
      const list = [];
      const now = new Date();
      for (let i = 0; i < 24; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }).toUpperCase();
          list.push({ val, label });
      }
      return list;
  }, []);

  const filteredInvoices = invoices.filter(inv => {
      if (inv.orderStatus === 'CANCELADO') return false;
      if (selectedPeriod !== 'ALL' && !inv.date.startsWith(selectedPeriod)) return false;
      const term = searchTerm.toLowerCase();
      const matchesSearch = inv.client.name.toLowerCase().includes(term) || 
                            `${inv.serie}-${inv.correlativo}`.toLowerCase().includes(term) ||
                            inv.client.docNumber.includes(term);
      if (!matchesSearch) return false;
      if (filterType !== 'ALL' && inv.type !== filterType) return false;
      if (filterStatus !== 'ALL') {
          if (filterStatus === 'ACCEPTED' && inv.sunatStatus !== 'ACCEPTED') return false;
          if (filterStatus === 'PENDING' && inv.sunatStatus !== 'PENDING' && inv.sunatStatus !== 'INTERNAL') return false;
          if (filterStatus === 'REJECTED' && inv.sunatStatus !== 'REJECTED') return false;
          if (filterStatus === 'VOIDED') {
              const isVoided = invoices.some(n => n.type === InvoiceType.NOTA_CREDITO && n.sunatStatus === 'ACCEPTED' && n.relatedDocument?.serie === inv.serie && n.relatedDocument?.correlativo === inv.correlativo);
              if (!isVoided) return false;
          }
      }
      if (filterDate && !inv.date.startsWith(filterDate)) return false;
      return true;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalSales = filteredInvoices.reduce((sum, inv) => {
    if (inv.type === InvoiceType.NOTA_CREDITO && inv.sunatStatus === 'ACCEPTED') return sum - inv.totals.total;
    if (inv.type !== InvoiceType.NOTA_CREDITO) return sum + inv.totals.total;
    return sum;
  }, 0);
  
  const getVoidingNc = (targetInv: Invoice) => {
    return invoices.find(inv => inv.type === InvoiceType.NOTA_CREDITO && inv.sunatStatus === 'ACCEPTED' && inv.relatedDocument && inv.relatedDocument.serie === targetInv.serie && String(inv.relatedDocument.correlativo) === String(targetInv.correlativo));
  };

  const handleSendWA = async (order: Invoice) => {
    if (!order.client.phone) {
        alert("El cliente no tiene un número de teléfono registrado.");
        return;
    }
    setSendingWaId(order.id);
    try {
        const res = await sendInvoiceViaWhatsApp(order, company, order.client.phone);
        if (res.success) {
            setSentSuccessIds(prev => new Set(prev).add(order.id));
        } else {
            if (res.fallbackUrl) {
                window.open(res.fallbackUrl, '_blank');
            } else {
                alert("❌ Error: " + res.message);
            }
        }
    } catch (e) {
        console.error(e);
        const link = generateWhatsAppLink(order, company, order.client.phone);
        window.open(link, '_blank');
    } finally {
        setSendingWaId(null);
    }
  };

  const handleConfirmDelete = () => {
      if (invoiceToDelete && onDeleteInvoice) {
          onDeleteInvoice(invoiceToDelete);
          setInvoiceToDelete(null);
      }
  };

  const handleConfirmVoid = (reason: string) => {
      if (invoiceToVoid && onVoidInvoice) {
          onVoidInvoice(invoiceToVoid, reason);
          setInvoiceToVoid(null);
      }
  };

  const handleSendSummary = async () => {
    const pendingBoletas = filteredInvoices.filter(inv => 
        inv.type === InvoiceType.BOLETA && 
        (inv.sunatStatus === 'PENDING' || inv.sunatStatus === 'REJECTED')
    );

    if (pendingBoletas.length === 0) {
        alert("No hay boletas pendientes para enviar en resumen hoy.");
        return;
    }

    if (!confirm(`¿Deseas enviar un Resumen Diario con ${pendingBoletas.length} boletas pendientes?`)) return;

    setIsSendingSummary(true);
    try {
        if (onSendSummary) await onSendSummary(pendingBoletas);
    } catch (e) {
        alert("Error al enviar resumen");
    } finally {
        setIsSendingSummary(false);
    }
  };

  const exportToExcel = () => {
      setIsExporting(true);
      try {
          const rows = sortedInvoices.map((inv, index) => {
              const datePart = inv.date.split('T')[0].split('-').reverse().join('-');
              let tipDocClie = inv.client.docType === 'DNI' ? '1' : (inv.client.docType === 'RUC' ? '6' : '0');
              const isNC = inv.type === InvoiceType.NOTA_CREDITO;
              const sign = isNC ? -1 : 1;
              return {
                  'COD DOC': '06', 'CORREL': index + 1, 'FECHA EMISION': datePart, 'FECHA VENC.': '', 'TIPO': inv.type, 'SERIE': inv.serie, 'NUMERO': inv.correlativo, 'TIP': tipDocClie, 'R.U.C': inv.client.docNumber, 'APELLIDOS Y NOMBRES': inv.client.name, 'BASE GRAVADA': (inv.totals.gravada * sign).toFixed(2), 'EXO': (inv.totals.exonerada * sign).toFixed(2), 'INA': (inv.totals.inafecta * sign).toFixed(2), 'IGV': (inv.totals.igv * sign).toFixed(2), 'IMPORTE TOTAL': (inv.totals.total * sign).toFixed(2), 'REF FEC': inv.relatedDocument ? inv.relatedDocument.serie : '', 'REF TIP': inv.relatedDocument ? inv.relatedDocument.type : '', 'REF NUM': inv.relatedDocument ? inv.relatedDocument.correlativo : ''
              };
          });
          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "RegVentas");
          XLSX.writeFile(wb, `REGISTRO_VENTAS_14_1_${selectedPeriod}.xlsx`);
      } catch (e) { alert("Error exportando Excel"); } finally { setIsExporting(false); }
  };

  return (
    <div className="w-full h-full p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Documentos Electrónicos</h2>
                <p className="text-gray-500">Gestión de comprobantes, estados SUNAT y archivos digitales.</p>
            </div>
            <div className="flex gap-4 items-center">
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
                     <span className="text-xs text-gray-400 block uppercase font-bold">Venta Neta Período</span>
                     <span className="text-lg font-bold text-green-600">S/ {totalSales.toFixed(2)}</span>
                </div>
                {onSendSummary && (
                    <button 
                        onClick={handleSendSummary} 
                        disabled={isSendingSummary || isExporting} 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {isSendingSummary ? <Loader2 className="animate-spin" size={18} /> : <FileCheck size={18} />} ENVIO RESUMEN DIARIO
                    </button>
                )}
                <button onClick={exportToExcel} disabled={isExporting || sortedInvoices.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 transition-all disabled:opacity-50">
                  {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />} REPORTE EXCEL (14.1)
                </button>
            </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder="Cliente, serie..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"/></div>
            <div className="relative"><select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-indigo-50 text-indigo-700 appearance-none cursor-pointer"><option value="ALL">TODOS LOS PERIODOS</option>{periods.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}</select><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" size={14} /></div>
            <div className="relative"><select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white appearance-none cursor-pointer"><option value="ALL">Todos los Tipos</option><option value={InvoiceType.BOLETA}>Boletas</option><option value={InvoiceType.FACTURA}>Facturas</option><option value={InvoiceType.NOTA_VENTA}>Notas de Venta</option><option value={InvoiceType.NOTA_CREDITO}>Notas de Crédito</option></select><Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} /></div>
            <div className="relative"><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white appearance-none cursor-pointer"><option value="ALL">Todos los Estados</option><option value="ACCEPTED">Aceptados SUNAT</option><option value="PENDING">Pendientes / Internos</option><option value="REJECTED">Rechazados</option><option value="VOIDED">Anulados (Con NC)</option></select><AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} /></div>
            <div className="relative"><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-600"/><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} /></div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {sortedInvoices.length === 0 ? (
            <div className="p-12 text-center text-gray-400"><div className="flex justify-center mb-4"><Table size={48} className="opacity-20" /></div><p>No se encontraron comprobantes.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold border-b border-gray-200">
                  <tr><th className="px-6 py-4">Fecha</th><th className="px-6 py-4">Comprobante</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4 text-right">Total</th><th className="px-6 py-4 text-center min-w-[200px]">Estado SUNAT</th><th className="px-6 py-4 text-center">Acciones</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedInvoices.map((inv) => {
                    const voidingNc = getVoidingNc(inv);
                    const isVoided = !!voidingNc;
                    // FIX: Changed status literal to ENTREGADO
                    const canDelete = inv.type === InvoiceType.NOTA_VENTA && inv.orderStatus !== 'ENTREGADO';
                    const canVoid = (inv.type === InvoiceType.BOLETA || inv.type === InvoiceType.FACTURA) && inv.sunatStatus === 'ACCEPTED' && !isVoided;
                    const canConvert = inv.type === InvoiceType.NOTA_VENTA && !isVoided;
                    const isSendingWa = sendingWaId === inv.id;
                    const isSent = sentSuccessIds.has(inv.id);
                    const rowClass = isVoided ? 'bg-red-50/50 hover:bg-red-50' : (inv.type === InvoiceType.NOTA_CREDITO ? 'bg-orange-50/30 hover:bg-orange-50' : 'hover:bg-gray-50');
                    const canRetry = (inv.type === InvoiceType.BOLETA || inv.type === InvoiceType.FACTURA || inv.type === InvoiceType.NOTA_CREDITO) && 
                                     (inv.sunatStatus === 'REJECTED' || inv.sunatStatus === 'PENDING') && !isVoided;
                    
                    return (
                      <tr key={inv.id} className={`transition-colors ${rowClass}`}>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap align-top">
                          <div className="flex flex-col gap-1">
                            <div>
                              <div className="text-[10px] text-gray-400 font-bold uppercase">Venta</div>
                              <div className="font-medium">{formatDateSafe(inv.date)}</div>
                              <div className="text-[10px]">{formatTimeSafe(inv.date)}</div>
                            </div>
                            {inv.fecha_emision && (
                              <div className="mt-1 pt-1 border-t border-gray-100">
                                <div className="text-[10px] text-indigo-400 font-bold uppercase">Emisión</div>
                                <div className="font-medium text-indigo-700">{formatDateSafe(inv.fecha_emision)}</div>
                                <div className="text-[10px] text-indigo-500">{formatTimeSafe(inv.fecha_emision)}</div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap align-top">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.type === InvoiceType.FACTURA ? 'bg-blue-100 text-blue-800' : (inv.type === InvoiceType.NOTA_VENTA ? 'bg-gray-200 text-gray-700' : (inv.type === InvoiceType.NOTA_CREDITO ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'))}`}>
                                {inv.type === InvoiceType.FACTURA ? 'FACTURA' : (inv.type === InvoiceType.NOTA_VENTA ? 'NOTA VENTA' : (inv.type === InvoiceType.NOTA_CREDITO ? 'NOTA CRÉDITO' : 'BOLETA'))}
                                </span>
                                {inv.serie}-{String(inv.correlativo).padStart(8, '0')}
                            </div>
                            
                            {/* HASH DEL COMPROBANTE - BAJO EL DOCUMENTO */}
                            {inv.sunatResponse?.hash && (
                                <div className="text-[9px] font-mono text-slate-400 flex items-center gap-1.5 mt-1 bg-slate-50 border border-slate-100 w-fit px-1.5 py-0.5 rounded">
                                    <ShieldCheck size={10} className="text-indigo-400" />
                                    {inv.sunatResponse.hash}
                                </div>
                            )}

                            {inv.relatedDocument && (
                                <div className="text-[10px] text-gray-500 flex items-center gap-1 bg-white border border-gray-200 rounded px-1 w-fit mt-1">
                                <Undo2 size={10} />Ref: {inv.relatedDocument.serie}-{inv.relatedDocument.correlativo}
                                </div>
                            )}
                            {isVoided && (
                                <div className="mt-2 text-[10px] text-red-700 font-bold flex items-center gap-1 bg-red-100 border border-red-200 rounded px-2 py-0.5 w-fit">
                                <Ban size={10} /> ANULADO POR {voidingNc?.serie}-{voidingNc?.correlativo}
                                </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 align-top">
                          <div className={`font-medium truncate max-w-[180px] ${isVoided ? 'line-through text-gray-400' : 'text-gray-900'}`} title={inv.client.name}>
                            {inv.client.name}
                          </div>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <div className="text-xs font-mono text-gray-500">{inv.client.docType}: {inv.client.docNumber}</div>
                            {inv.client.phone && (
                              <div className="text-[10px] font-bold text-indigo-500 flex items-center gap-1 uppercase tracking-tight">
                                <Phone size={10} /> {inv.client.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap align-top">
                          <span className={`font-bold ${inv.type === InvoiceType.NOTA_CREDITO ? 'text-red-600' : (isVoided ? 'line-through text-gray-400' : 'text-gray-900')}`}>
                            {inv.type === InvoiceType.NOTA_CREDITO ? '-' : ''} S/ {inv.totals.total.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center align-top relative">
                          <div className="flex flex-col items-center gap-1">
                            {inv.sunatStatus === 'ACCEPTED' ? (
                              isVoided ? (
                                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-600 border border-gray-300">
                                  <Ban size={12} /> ANULADO
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                  <CheckCircle2 size={12} /> ACEPTADO
                                </span>
                              )
                            ) : inv.sunatStatus === 'REJECTED' ? (
                              <div className="flex flex-col items-center gap-2">
                                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                    <XCircle size={12} /> RECHAZADO
                                </span>
                                {canRetry && onRetrySunat && (
                                    <button 
                                        onClick={() => onRetrySunat(inv)}
                                        className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-md hover:bg-red-700 font-bold flex items-center gap-1 shadow-sm transition-all"
                                    >
                                        <ArrowRightLeft size={10} /> RE-INTENTAR
                                    </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2">
                                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">
                                    <AlertTriangle size={12} /> {inv.type === InvoiceType.NOTA_VENTA ? 'INTERNO' : 'PENDIENTE'}
                                </span>
                                {canRetry && onRetrySunat && (
                                    <button 
                                        onClick={() => onRetrySunat(inv)}
                                        className="text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded-md hover:bg-amber-700 font-bold flex items-center gap-1 shadow-sm transition-all"
                                    >
                                        <ArrowRightLeft size={10} /> ENVIAR AHORA
                                    </button>
                                )}
                              </div>
                            )}
                            {inv.sunatResponse?.description && (
                              <p className="text-[9px] text-gray-400 leading-tight max-w-[150px] italic text-center">{inv.sunatResponse.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex justify-end gap-1 flex-wrap">
                            <button 
                              onClick={() => handleSendWA(inv)} 
                              disabled={isSendingWa} 
                              className={`p-1.5 rounded border shadow-sm transition-all flex items-center justify-center ${isSendingWa ? 'bg-slate-100 opacity-50' : 'bg-white border-emerald-100 hover:bg-emerald-50'}`} 
                              title="Enviar por WhatsApp"
                            >
                              <div className="relative">
                                {isSendingWa ? <Loader2 size={16} className="animate-spin text-emerald-600" /> : (
                                  <>
                                    <img src="https://iili.io/fXXft0Q.png" className="w-6 h-6 object-contain" alt="WA" />
                                    {isSent && (
                                      <div className="absolute -top-1 -right-1 bg-white rounded-full shadow-sm border border-green-100">
                                        <Check size={10} className="text-green-600" strokeWidth={4} />
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </button>
                            <button 
                              type="button" 
                              onClick={(e) => { e.stopPropagation(); onViewReceipt(inv); }} 
                              className="p-1.5 bg-white text-gray-500 rounded border border-gray-300 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm" 
                              title="Ver Detalle"
                            >
                              <Eye size={16} />
                            </button>
                            {canConvert && (
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setInvoiceToConvert(inv); }}
                                    className="p-1.5 bg-white text-indigo-500 rounded border border-gray-300 hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm"
                                    title="Convertir a Boleta/Factura"
                                >
                                    <ArrowRightLeft size={16} />
                                </button>
                            )}
                            {canDelete && (
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); setInvoiceToDelete(inv); }} 
                                className="p-1.5 bg-white text-red-500 rounded border border-gray-300 hover:border-red-300 transition-all shadow-sm" 
                                title="Eliminar (Físico)"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                            {canVoid && (
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); setInvoiceToVoid(inv); }} 
                                className="p-1.5 bg-white text-orange-500 rounded border border-gray-300 hover:bg-orange-300 transition-all shadow-sm" 
                                title="Anular con Nota de Crédito"
                              >
                                <FileWarning size={16} />
                              </button>
                            )}
                            
                            {/* BOTONES DE DESCARGA SUNAT - PDF, XML, CDR */}
                            {inv.sunatResponse?.pdfUrl && (
                              <a href={inv.sunatResponse.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white text-red-600 rounded border border-red-200 hover:bg-red-50 transition-all shadow-sm" title="Descargar PDF">
                                <FileText size={16} />
                              </a>
                            )}
                            {inv.sunatResponse?.xmlUrl && (
                              <a href={inv.sunatResponse.xmlUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm" title="Descargar XML">
                                <FileCode size={16} />
                              </a>
                            )}
                            {inv.sunatResponse?.cdrUrl && (
                              <a href={inv.sunatResponse.cdrUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white text-emerald-600 rounded border border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm" title="Descargar CDR">
                                <FileCheck size={16} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal 
          isOpen={!!invoiceToDelete}
          onClose={() => setInvoiceToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Eliminar Comprobante"
          message={
              <div>
                  <p>¿Estás seguro de eliminar la Nota de Venta <strong>{invoiceToDelete?.serie}-{invoiceToDelete?.correlativo}</strong>?</p>
                  <p className="text-xs text-red-500 mt-2">Esta acción no se puede deshacer y borrará el registro permanentemente.</p>
              </div>
          }
          confirmText="Sí, Eliminar"
          isDangerous={true}
      />

      <VoidReasonModal 
          isOpen={!!invoiceToVoid}
          onClose={() => setInvoiceToVoid(null)}
          onConfirm={handleConfirmVoid}
      />

      {invoiceToConvert && (
          <ConvertInvoiceModal 
            isOpen={!!invoiceToConvert} 
            onClose={() => setInvoiceToConvert(null)}
            invoice={invoiceToConvert}
            clients={clients}
            apiToken={company.apiToken}
            onAddClient={onAddClient}
            company={company}
            onConvert={async (type, client) => {
                if (onConvertInvoice) await onConvertInvoice(invoiceToConvert, type, client);
                setInvoiceToConvert(null);
            }}
          />
      )}
    </div>
  );
};

export default SalesHistory;

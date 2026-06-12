
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, InvoiceType, OrderStatus, IdentityDocumentType, Company, Client } from '../types';
import { 
    FileText, CheckCircle2, AlertTriangle, Eye, XCircle, Undo2, Ban, 
    FileCode, FileArchive, Search, Filter, Calendar, Trash2, 
    FileWarning, Download, Table, MessageCircle, Loader2, 
    ExternalLink, Check, ArrowRightLeft, Phone, ShieldCheck, FileCheck, RotateCcw,
    Printer, ChevronLeft, ChevronRight
} from 'lucide-react';
import { printInvoiceDirectly } from '../utils/printService';
import ConfirmationModal from '../components/ConfirmationModal';
import VoidReasonModal from '../components/VoidReasonModal';
import ConvertInvoiceModal from '../components/ConvertInvoiceModal';
import * as XLSX from 'xlsx';
import { formatDateSafe, formatTimeSafe, getPeruDateTime } from '../utils/calculations';
import { sendInvoiceViaWhatsApp, generateWhatsAppLink } from '../services/whatsappService';
import { useQuery } from '@tanstack/react-query';
import { dbGetInvoices } from '../services/dbService';

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
  ticketConfig?: any;
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ invoices: initialInvoices, company, clients, onViewReceipt, onVoidInvoice, onDeleteInvoice, onConvertInvoice, onRetrySunat, onSendSummary, onAddClient, ticketConfig }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => {
      const { date } = getPeruDateTime();
      const [year, month] = date.split('-');
      return `${year}-${month}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
      const { date } = getPeruDateTime();
      return date;
  });

  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [invoiceToVoid, setInvoiceToVoid] = useState<Invoice | null>(null);
  const [invoiceToConvert, setInvoiceToConvert] = useState<Invoice | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingSummary, setIsSendingSummary] = useState(false);
  const [sendingWaId, setSendingWaId] = useState<string | null>(null);
  const [sentSuccessIds, setSentSuccessIds] = useState<Set<string>>(new Set());

  // Search/Filters with Server Side retrieval of up to 1000 electronic invoices in active range
  const { data: dbData, isLoading: isQueryLoading } = useQuery({
      queryKey: ['invoices', 'electronic', company?.id, startDate, endDate, searchTerm],
      queryFn: () => dbGetInvoices(1, 1000, searchTerm, true, startDate, endDate),
      enabled: !!company?.id,
      staleTime: 10 * 1000,
  });

  const activeInvoices = dbData?.invoices || [];

  const filteredInvoices = activeInvoices.filter(inv => {
      // Un documento se considera electrónico si su tipo es Boleta/Factura,
      // o si su sunatStatus es 'ACCEPTED' y su descripción indica que es Boleta o Factura o ha sido aceptada.
      const isAcceptedElec = inv.sunatStatus === 'ACCEPTED' && 
                             inv.sunatResponse?.description && 
                             (inv.sunatResponse.description.toLowerCase().includes('boleta') || 
                              inv.sunatResponse.description.toLowerCase().includes('factura') || 
                              inv.sunatResponse.description.toLowerCase().includes('aceptada'));

      const isBaseTypeElec = inv.type === InvoiceType.BOLETA || inv.type === InvoiceType.FACTURA;

      if (!isBaseTypeElec && !isAcceptedElec) return false;

      // Permitir mostrar anulados si son comprobantes electrónicos que fueron aceptados (para ver la marca de NC)
      const isElectronicVoided = inv.orderStatus === 'CANCELADO' || (inv as any).status === 'anulado';
      
      if (inv.orderStatus === 'CANCELADO' && !isElectronicVoided) return false;
      
      const term = searchTerm.toLowerCase().trim();
      const clientName = inv.client?.name || '';
      const clientDoc = inv.client?.docNumber || '';
      const invoiceRef = `${inv.serie}-${inv.correlativo}`;
      const matchesSearch = !term || 
                            clientName.toLowerCase().includes(term) || 
                            invoiceRef.toLowerCase().includes(term) ||
                            clientDoc.includes(term);
      if (!matchesSearch) return false;

      // Filtro por rango de fechas de emisión
      const invDateStr = (inv.fecha_emision || inv.date || '').slice(0, 10);
      if (startDate && invDateStr < startDate) return false;
      if (endDate && invDateStr > endDate) return false;
      return true;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
      const dateA = new Date(a.fecha_emision || a.date).getTime();
      const dateB = new Date(b.fecha_emision || b.date).getTime();
      return dateB - dateA;
  });

  // Client Side smooth pagination for rendering table
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
      setCurrentPage(1);
  }, [startDate, endDate, searchTerm]);

  const paginatedInvoices = useMemo(() => {
      const startIdx = (currentPage - 1) * itemsPerPage;
      return sortedInvoices.slice(startIdx, startIdx + itemsPerPage);
  }, [sortedInvoices, currentPage]);

  const totalPages = Math.ceil(sortedInvoices.length / itemsPerPage);

  // Cálculo de venta neta del periodo considerando NCs aunque no se listen como filas
  const totalSales = useMemo(() => {
    return activeInvoices.filter(inv => {
        const isAcceptedElec = inv.sunatStatus === 'ACCEPTED' && 
                               inv.sunatResponse?.description && 
                               (inv.sunatResponse.description.toLowerCase().includes('boleta') || 
                                inv.sunatResponse.description.toLowerCase().includes('factura') || 
                                inv.sunatResponse.description.toLowerCase().includes('aceptada'));

        const isBaseTypeElec = inv.type === InvoiceType.BOLETA || inv.type === InvoiceType.FACTURA;
        
        if (!isBaseTypeElec && !isAcceptedElec && inv.type !== InvoiceType.NOTA_CREDITO) return false;

        const invDateStr = (inv.fecha_emision || inv.date || '').slice(0, 10);
        if (startDate && invDateStr < startDate) return false;
        if (endDate && invDateStr > endDate) return false;
        return true;
    }).reduce((sum, inv) => {
        if (inv.sunatStatus !== 'ACCEPTED') return sum;
        const isNC = inv.type === InvoiceType.NOTA_CREDITO || 
                     (inv.serie && inv.serie.toUpperCase().startsWith('F') && inv.serie.length > 1 && inv.serie[1] === 'C') ||
                     (inv.serie && inv.serie.toUpperCase().startsWith('BC')) ||
                     (inv.sunatResponse?.description && inv.sunatResponse.description.toLowerCase().includes('crédito'));
        return isNC ? sum - inv.totals.total : sum + inv.totals.total;
    }, 0);
  }, [activeInvoices, startDate, endDate]);
  
  const getVoidingNc = (targetInv: Invoice) => {
    // Primero intentar por ID relacionado si existe
    if (targetInv.relatedNcId) {
        const found = activeInvoices.find(i => i.id === targetInv.relatedNcId);
        if (found) return found;
    }
    // Si no, buscar por referencia de serie/correlativo
    return activeInvoices.find(inv => 
        inv.type === InvoiceType.NOTA_CREDITO && 
        inv.sunatStatus === 'ACCEPTED' && 
        inv.relatedDocument && 
        inv.relatedDocument.serie === targetInv.serie && 
        String(inv.relatedDocument.correlativo) === String(targetInv.correlativo)
    );
  };

  const handleDirectPrint = async (inv: Invoice) => {
    try {
        // Request 3: Only client document (shouldPrintBoth = true for clientOnly)
        await printInvoiceDirectly(inv, company, ticketConfig, true);
    } catch (error) {
        console.error("Error direct printing:", error);
    }
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
              const datePart = (inv.date || '').slice(0, 10).split('-').reverse().join('-');
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
          XLSX.writeFile(wb, `REGISTRO_VENTAS_14_1_${startDate}_${endDate}.xlsx`);
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

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Cliente, serie..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>
            <div className="relative flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Desde:</span>
                <div className="relative w-full">
                    <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-600"
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                </div>
            </div>
            <div className="relative flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Hasta:</span>
                <div className="relative w-full">
                    <input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-600"
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                </div>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isQueryLoading && activeInvoices.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="flex justify-center mb-4"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>
              <p>Cargando comprobantes electrónicos desde el servidor...</p>
            </div>
          ) : sortedInvoices.length === 0 ? (
            <div className="p-12 text-center text-gray-400"><div className="flex justify-center mb-4"><Table size={48} className="opacity-20" /></div><p>No se encontraron comprobantes.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-1.5 font-bold uppercase text-gray-500">Fecha</th>
                    <th className="px-2 py-1.5 font-bold uppercase text-gray-500">Comprobante</th>
                    <th className="px-2 py-1.5 font-bold uppercase text-gray-500">Cliente</th>
                    <th className="px-2 py-1.5 font-bold uppercase text-gray-500 text-right">Total</th>
                    <th className="px-2 py-1.5 font-bold uppercase text-gray-500 text-center w-32">Estado SUNAT</th>
                    <th className="px-2 py-1.5 font-bold uppercase text-gray-500 text-right pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedInvoices.map((inv) => {
                    const voidingNc = getVoidingNc(inv);
                    const isVoided = !!voidingNc || inv.status === 'anulado' || (inv as any).orderStatus === 'CANCELADO' || !!inv.relatedNcId;
                    
                    // Un documento se considera electrónico si su tipo es Boleta/Factura,
                    // o de lo contrario por su serie o descripción de sunatResponse.
                    const isFactura = inv.type === InvoiceType.FACTURA || 
                                      (inv.serie && inv.serie.toUpperCase().startsWith('F')) ||
                                      (inv.sunatResponse?.description && inv.sunatResponse.description.toLowerCase().includes('factura'));

                    const isBoleta = inv.type === InvoiceType.BOLETA || 
                                     (inv.serie && inv.serie.toUpperCase().startsWith('B')) ||
                                     (inv.sunatResponse?.description && inv.sunatResponse.description.toLowerCase().includes('boleta'));

                    const isNC = inv.type === InvoiceType.NOTA_CREDITO || 
                                 (inv.serie && inv.serie.toUpperCase().startsWith('F') && inv.serie.length > 1 && inv.serie[1] === 'C') ||
                                 (inv.serie && inv.serie.toUpperCase().startsWith('BC')) ||
                                 (inv.sunatResponse?.description && inv.sunatResponse.description.toLowerCase().includes('crédito'));

                    const isElec = isFactura || isBoleta || isNC;

                    // Bloquear botón de anular si ya está anulado para evitar duplicados
                    const canVoid = (isBoleta || isFactura) && inv.sunatStatus === 'ACCEPTED' && !isVoided;
                    
                    const canDelete = inv.type === InvoiceType.NOTA_VENTA && inv.orderStatus !== 'ENTREGADO';
                    const canConvert = inv.type === InvoiceType.NOTA_VENTA && !isVoided;
                    const isSendingWa = sendingWaId === inv.id;
                    const isSent = sentSuccessIds.has(inv.id);
                    const rowClass = isVoided ? 'bg-red-100 hover:bg-red-100 border-l-4 border-l-red-500 opacity-75' : (isNC ? 'bg-orange-50/30 hover:bg-orange-50' : 'hover:bg-gray-50');
                    const canRetry = isElec && 
                                     (inv.sunatStatus === 'REJECTED' || inv.sunatStatus === 'PENDING') && !isVoided;
                    
                    return (
                      <tr key={inv.id} className={`transition-colors ${rowClass}`}>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap align-top">
                          <div className="flex flex-col gap-0.5">
                            <div>
                              <div className="text-[9px] text-gray-400 font-bold uppercase">Venta</div>
                              <div className="font-semibold">{formatDateSafe(inv.date)}</div>
                              <div className="text-[9px]">{formatTimeSafe(inv.date)}</div>
                            </div>
                            {inv.fecha_emision && formatDateSafe(inv.date) !== formatDateSafe(inv.fecha_emision) && (
                              <div className="mt-0.5 pt-0.5 border-t border-gray-100">
                                <div className="text-[9px] text-indigo-400 font-bold uppercase">Emisión</div>
                                <div className="font-semibold text-indigo-700">{formatDateSafe(inv.fecha_emision)}</div>
                                <div className="text-[9px] text-indigo-500">{formatTimeSafe(inv.fecha_emision)}</div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap align-top">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isFactura ? 'bg-blue-100 text-blue-800' : (isNC ? 'bg-orange-100 text-orange-800' : (inv.type === InvoiceType.NOTA_VENTA ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'))}`}>
                                  {isFactura ? 'FACTURA' : (isNC ? 'NOTA CRÉDITO' : (inv.type === InvoiceType.NOTA_VENTA ? (company?.custom_nv_name || company?.modulos_config?.custom_nv_name || 'NOTA VENTA').toUpperCase() : 'BOLETA'))}
                                </span>
                                
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDirectPrint(inv); }}
                                    className="p-1 hover:bg-indigo-50 rounded text-brand-primary transition-all shadow-sm border border-brand-primary/20 bg-white"
                                    title="Imprimir Documento del Cliente"
                                >
                                    <Printer size={12} className="animate-pulse" />
                                </button>

                                <span className={`text-xs ${isVoided ? 'line-through text-red-600 font-black' : 'font-semibold'}`}>
                                  {inv.serie}-{String(inv.correlativo).padStart(8, '0')}
                                </span>
                                {isVoided && <span className="ml-1 px-1 py-0.5 bg-red-700 text-white text-[9px] font-black rounded uppercase shadow flex items-center gap-0.5 border border-white">
                                  <Ban size={8} /> ANULADO
                                </span>}
                            </div>
                            
                            {/* HASH DEL COMPROBANTE - BAJO EL DOCUMENTO */}
                            {inv.sunatResponse?.hash && (
                                <div className="text-[8px] font-mono text-slate-400 flex items-center gap-1 mt-0.5 bg-slate-50 border border-slate-100 w-fit px-1 py-0.2 rounded">
                                    <ShieldCheck size={8} className="text-indigo-400" />
                                    {inv.sunatResponse.hash}
                                </div>
                            )}

                            {inv.relatedDocument && (
                                <div className="text-[9px] text-gray-500 flex items-center gap-1 bg-white border border-gray-200 rounded px-1 w-fit mt-0.5">
                                <Undo2 size={8} />Ref: {inv.relatedDocument.serie}-{inv.relatedDocument.correlativo}
                                </div>
                            )}
                            {isVoided && (
                                <div className="mt-1 flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1 bg-red-600 text-white 
                                                    font-black px-1.5 py-0.5 rounded text-[9px] w-fit shadow-sm">
                                        <Ban size={10} /> ANULADO
                                        <span className="font-normal opacity-80 text-[8px]">
                                            {voidingNc ? `NC: ${voidingNc.serie}-${String(voidingNc.correlativo).padStart(8, '0')}` : 'CON NOTA DE CRÉDITO'}
                                        </span>
                                    </div>
                                    {voidingNc?.sunatResponse?.pdfUrl && (
                                        <div className="flex gap-1.5 ml-0.5">
                                            <a href={voidingNc.sunatResponse.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-[8px] text-red-500 font-bold hover:underline">
                                                <FileText size={7} /> PDF NC
                                            </a>
                                            {voidingNc.sunatResponse.xmlUrl && (
                                                <a href={voidingNc.sunatResponse.xmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-[8px] text-indigo-500 font-bold hover:underline">
                                                    <FileCode size={7} /> XML NC
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 align-top">
                          <div className={`font-semibold truncate max-w-[150px] ${isVoided ? 'line-through text-gray-400' : 'text-gray-900'}`} title={inv.client.name}>
                            {inv.client.name}
                          </div>
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            <div className="text-[10px] font-mono text-gray-500">{inv.client.docType}: {inv.client.docNumber}</div>
                            {inv.client.phone && (
                              <div className="text-[9px] font-bold text-indigo-500 flex items-center gap-1 uppercase tracking-tight">
                                <Phone size={8} /> {inv.client.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap align-top">
                          <span className={`font-bold text-xs ${isNC ? 'text-red-600' : (isVoided ? 'line-through text-gray-400' : 'text-gray-900')}`}>
                            {isNC ? '-' : ''} S/ {inv.totals.total.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center align-top relative">
                          <div className="flex flex-col items-center gap-0.5">
                            {inv.sunatStatus === 'ACCEPTED' ? (
                              isVoided ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-gray-100 text-gray-600 border border-gray-200 rounded text-[10px] font-bold">
                                    <Ban size={10} /> ANULADO
                                  </span>
                                  {inv.notes && inv.notes.includes('NC') && (
                                    <div className="flex items-center gap-0.5 text-[8px] text-red-500 font-black uppercase">
                                      <RotateCcw size={8} /> 
                                      {inv.notes.match(/\[(.*?)\]/)?.[1] || 'CON NOTA CRÉDITO'}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-green-100 text-green-700 border border-green-200 rounded text-[10px] font-bold">
                                  <CheckCircle2 size={10} /> ACEPTADO
                                </span>
                              )
                            ) : inv.sunatStatus === 'REJECTED' ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-red-100 text-red-700 border border-red-200 rounded text-[10px] font-bold">
                                    <XCircle size={10} /> RECHAZADO
                                </span>
                                {canRetry && onRetrySunat && (
                                    <button 
                                        onClick={() => onRetrySunat(inv)}
                                        className="text-[8px] bg-red-600 text-white px-1.5 py-0.2 rounded hover:bg-red-700 font-bold flex items-center gap-0.5 shadow-sm transition-all"
                                    >
                                        <ArrowRightLeft size={8} /> RE-INTENTAR
                                    </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-yellow-100 text-yellow-700 border border-yellow-200 rounded text-[10px] font-bold">
                                    <AlertTriangle size={10} /> {isElec ? 'PENDIENTE' : (inv.type === InvoiceType.NOTA_VENTA ? 'INTERNO' : 'PENDIENTE')}
                                </span>
                                {canRetry && onRetrySunat && (
                                    <button 
                                        onClick={() => onRetrySunat(inv)}
                                        className="text-[8px] bg-amber-600 text-white px-1.5 py-0.2 rounded hover:bg-amber-700 font-bold flex items-center gap-0.5 shadow-sm transition-all"
                                    >
                                        <ArrowRightLeft size={8} /> ENVIAR AHORA
                                    </button>
                                )}
                              </div>
                            )}
                            {inv.sunatResponse?.description && (
                              <p className="text-[8px] text-gray-400 leading-tight max-w-[125px] italic text-center">{inv.sunatResponse.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <div className="flex justify-end items-center gap-1 flex-wrap">
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
                              <a href={inv.sunatResponse.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-white text-red-600 rounded border border-red-200 hover:bg-red-50 transition-all shadow-sm" title="Descargar PDF Original">
                                <FileText size={16} />
                              </a>
                            )}
                            
                            {/* BOTON PDF DE LA NOTA DE CREDITO VINCULADA */}
                            {isVoided && voidingNc?.sunatResponse?.pdfUrl && (
                              <a href={voidingNc.sunatResponse.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-orange-600 text-white rounded border border-orange-700 hover:bg-orange-700 transition-all shadow-sm flex items-center gap-1" title="Descargar PDF de Anulación (NC)">
                                <FileText size={14} />
                                <span className="text-[10px] font-bold">PDF NC</span>
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
          {/* PAGINATION FOOTER */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-xs font-semibold rounded-md text-gray-700 bg-white hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-xs font-semibold rounded-md text-gray-700 bg-white hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-gray-700">
                    Mostrando <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
                    <span className="font-semibold">
                      {Math.min(currentPage * itemsPerPage, sortedInvoices.length)}
                    </span>{' '}
                    de <span className="font-semibold">{sortedInvoices.length}</span> comprobantes
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      Primero
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-xs font-semibold text-gray-700">
                      Pág {currentPage} de {totalPages}
                    </span>

                    <button
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      Último
                    </button>
                  </nav>
                </div>
              </div>
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

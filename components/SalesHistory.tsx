
import React, { useState } from 'react';
import { Invoice, InvoiceType, OrderStatus } from '../types';
import { FileText, CheckCircle2, AlertTriangle, Eye, XCircle, Undo2, Ban, FileCode, FileArchive, Search, Filter, Calendar, Trash2, FileWarning } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import VoidReasonModal from './VoidReasonModal';

interface SalesHistoryProps {
  invoices: Invoice[];
  onViewReceipt: (invoice: Invoice) => void;
  onVoidInvoice?: (invoice: Invoice, reason: string) => void; 
  onDeleteInvoice?: (invoice: Invoice) => void; // New prop
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ invoices, onViewReceipt, onVoidInvoice, onDeleteInvoice }) => {
  // Filtros State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');

  // Acciones State
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [invoiceToVoid, setInvoiceToVoid] = useState<Invoice | null>(null);

  // 1. Filtrado
  const filteredInvoices = invoices.filter(inv => {
      // Filtro por Buscador (Cliente o Serie-Correlativo)
      const term = searchTerm.toLowerCase();
      const matchesSearch = inv.client.name.toLowerCase().includes(term) || 
                            `${inv.serie}-${inv.correlativo}`.toLowerCase().includes(term) ||
                            inv.client.docNumber.includes(term);

      if (!matchesSearch) return false;

      // Filtro por Tipo
      if (filterType !== 'ALL' && inv.type !== filterType) return false;

      // Filtro por Estado (Simplificado)
      if (filterStatus !== 'ALL') {
          if (filterStatus === 'ACCEPTED' && inv.sunatStatus !== 'ACCEPTED') return false;
          if (filterStatus === 'PENDING' && inv.sunatStatus !== 'PENDING' && inv.sunatStatus !== 'INTERNAL') return false;
          if (filterStatus === 'REJECTED' && inv.sunatStatus !== 'REJECTED') return false;
          // Anulado es una lógica especial: Si es una venta pero tiene una NC aceptada asociada
          if (filterStatus === 'VOIDED') {
              const isVoided = invoices.some(n => 
                n.type === InvoiceType.NOTA_CREDITO && 
                n.sunatStatus === 'ACCEPTED' &&
                n.relatedDocument?.serie === inv.serie && 
                n.relatedDocument?.correlativo === inv.correlativo
              );
              if (!isVoided) return false;
          }
      }

      // Filtro por Fecha
      if (filterDate && !inv.date.startsWith(filterDate)) return false;

      return true;
  });

  // 2. Ordenamiento
  const sortedInvoices = [...filteredInvoices].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Calcular ventas netas (restando notas de crédito)
  const totalSales = invoices.reduce((sum, inv) => {
    if (inv.type === InvoiceType.NOTA_CREDITO && inv.sunatStatus === 'ACCEPTED') {
       return sum - inv.totals.total;
    }
    // Solo sumar si no es nota de crédito y está aceptada/pendiente (asumimos venta realizada)
    if (inv.type !== InvoiceType.NOTA_CREDITO) {
       return sum + inv.totals.total;
    }
    return sum;
  }, 0);
  
  // Helper robusto para detectar si una factura ya tiene NC asociada en el historial
  const getVoidingNc = (targetInv: Invoice) => {
    if (!targetInv) return undefined;
    
    return invoices.find(inv => 
      inv.type === InvoiceType.NOTA_CREDITO && 
      inv.sunatStatus === 'ACCEPTED' && // Solo cuenta si la NC fue aceptada
      inv.relatedDocument && 
      inv.relatedDocument.serie === targetInv.serie &&
      String(inv.relatedDocument.correlativo) === String(targetInv.correlativo)
    );
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

  return (
    <div className="w-full h-full p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Title & Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
            <div>
                <h2 className="text-2xl font-bold text-gray-800">Documentos Electrónicos</h2>
                <p className="text-gray-500">Gestión de comprobantes, estados SUNAT y archivos digitales.</p>
            </div>
            {/* KPI Summary Small */}
            <div className="flex gap-4">
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-xs text-gray-400 block uppercase font-bold">Total Emitidos</span>
                    <span className="text-lg font-bold text-gray-800">{invoices.length}</span>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
                     <span className="text-xs text-gray-400 block uppercase font-bold">Venta Neta</span>
                     <span className="text-lg font-bold text-green-600">S/ {totalSales.toFixed(2)}</span>
                </div>
            </div>
        </div>

        {/* --- FILTERS BAR --- */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            
            <div className="relative col-span-1 md:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar cliente, serie..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            <div className="relative">
                 <select 
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white appearance-none cursor-pointer"
                 >
                     <option value="ALL">Todos los Tipos</option>
                     <option value={InvoiceType.BOLETA}>Boletas</option>
                     <option value={InvoiceType.FACTURA}>Facturas</option>
                     <option value={InvoiceType.NOTA_VENTA}>Notas de Venta</option>
                     <option value={InvoiceType.NOTA_CREDITO}>Notas de Crédito</option>
                 </select>
                 <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>

            <div className="relative">
                 <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white appearance-none cursor-pointer"
                 >
                     <option value="ALL">Todos los Estados</option>
                     <option value="ACCEPTED">Aceptados SUNAT</option>
                     <option value="PENDING">Pendientes / Internos</option>
                     <option value="REJECTED">Rechazados</option>
                     <option value="VOIDED">Anulados (Con NC)</option>
                 </select>
                 <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            </div>

            <div className="relative">
                <input 
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-600"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="flex justify-center mb-4">
                 <FileText size={48} className="opacity-20" />
              </div>
              <p>No se encontraron comprobantes con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Comprobante</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-center min-w-[200px]">Estado SUNAT</th>
                    <th className="px-6 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedInvoices.map((inv) => {
                    const voidingNc = getVoidingNc(inv);
                    const isVoided = !!voidingNc;
                    
                    // LÓGICA DE BOTONES DE ACCIÓN
                    const isNotaVenta = inv.type === InvoiceType.NOTA_VENTA;
                    const isLegalDoc = inv.type === InvoiceType.BOLETA || inv.type === InvoiceType.FACTURA;
                    // FIX: Changed 'DELIVERED' to 'ENTREGADO' to match OrderStatus type
                    const canDelete = isNotaVenta && inv.orderStatus !== 'ENTREGADO';
                    const canVoid = isLegalDoc && inv.sunatStatus === 'ACCEPTED' && !isVoided;

                    // Estilos dinámicos para filas anuladas
                    const rowClass = isVoided 
                        ? 'bg-red-100 hover:bg-red-100 border-l-4 border-l-red-500 opacity-75' 
                        : (inv.type === InvoiceType.NOTA_CREDITO ? 'bg-orange-50/30 hover:bg-orange-50' : 'hover:bg-gray-50');

                    return (
                      <tr key={inv.id} className={`transition-colors ${rowClass}`}>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap align-top">
                          <div className="font-medium">{new Date(inv.date).toLocaleDateString()}</div>
                          <div className="text-xs">{new Date(inv.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap align-top">
                          <div className="flex items-center gap-2 mb-1">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.type === InvoiceType.FACTURA ? 'bg-blue-100 text-blue-800' : (inv.type === InvoiceType.NOTA_VENTA ? 'bg-gray-200 text-gray-700' : (inv.type === InvoiceType.NOTA_CREDITO ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'))}`}>
                                {inv.type === InvoiceType.FACTURA ? 'FACTURA' : (inv.type === InvoiceType.NOTA_VENTA ? 'NOTA VENTA' : (inv.type === InvoiceType.NOTA_CREDITO ? 'NOTA CRÉDITO' : 'BOLETA'))}
                             </span>
                             {inv.serie}-{String(inv.correlativo).padStart(8, '0')}
                          </div>
                          
                          {inv.relatedDocument && (
                              <div className="text-[10px] text-gray-500 flex items-center gap-1 bg-white border border-gray-200 rounded px-1 w-fit mt-1">
                                  <Undo2 size={10} />
                                  Ref: {inv.relatedDocument.serie}-{inv.relatedDocument.correlativo}
                              </div>
                          )}
                          
                          {isVoided && (
                              <div className="mt-2 flex items-center gap-1.5 bg-red-600 text-white 
                                              font-black px-3 py-1 rounded-lg text-[11px] w-fit shadow-sm">
                                  <Ban size={12} /> ANULADO
                                  <span className="font-normal opacity-80 text-[9px]">
                                      NC: {voidingNc?.serie}-{String(voidingNc?.correlativo).padStart(8,'0')}
                                  </span>
                              </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 align-top">
                          <div className={`font-medium truncate max-w-[180px] ${isVoided ? 'line-through text-gray-400' : 'text-gray-900'}`} title={inv.client.name}>
                              {inv.client.name}
                          </div>
                          <div className="text-xs font-mono text-gray-500">{inv.client.docType}: {inv.client.docNumber}</div>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap align-top">
                          <span className={`font-bold ${inv.type === InvoiceType.NOTA_CREDITO ? 'text-red-600' : (isVoided ? 'line-through text-gray-400' : 'text-gray-900')}`}>
                             {inv.type === InvoiceType.NOTA_CREDITO ? '-' : ''} S/ {inv.totals.total.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center align-top">
                          <div className="flex flex-col items-center gap-2">
                              {/* BADGE DE ESTADO */}
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
                              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                  <XCircle size={12} /> RECHAZADO
                              </span>
                              ) : (
                              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">
                                  <AlertTriangle size={12} /> {inv.type === InvoiceType.NOTA_VENTA ? 'INTERNO' : 'PENDIENTE'}
                              </span>
                              )}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex justify-end gap-2">
                                {/* Botón Ver */}
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onViewReceipt(inv); }}
                                    className="p-1.5 bg-white text-gray-500 rounded border border-gray-300 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm"
                                    title="Ver Detalle"
                                >
                                    <Eye size={16} />
                                </button>

                                {/* BOTÓN ELIMINAR (Solo NV no entregada) */}
                                {canDelete && (
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setInvoiceToDelete(inv); }}
                                        className="p-1.5 bg-white text-red-500 rounded border border-gray-300 hover:bg-red-50 hover:border-red-300 transition-all shadow-sm"
                                        title="Eliminar (Físico)"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}

                                {/* BOTÓN ANULAR (Solo Fiscal Aceptado) */}
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
                                
                                {/* Botones Descarga (Si existen) */}
                                {inv.sunatResponse?.pdfUrl && (
                                    <a 
                                        href={inv.sunatResponse.pdfUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                        className="p-1.5 bg-white text-gray-500 rounded border border-gray-300 hover:text-red-600 hover:border-red-300 transition-all shadow-sm"
                                        title="PDF"
                                    >
                                        <FileText size={16} />
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
    </div>
  );
};

export default SalesHistory;

import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, OrderStatus, Machine, UnitCode } from '../types';
import { Waves, Wind, CheckCircle2, Clock, Play, X, AlertTriangle, Shirt, CheckSquare, Square, Calendar, User, List, ArrowRight, Search, Check, WashingMachine, Scale, Eye, Store, Truck, ChevronDown, ChevronUp, FileSpreadsheet, Printer, Send } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import LogisticsBulkDispatchModal from '../components/LogisticsBulkDispatchModal';
import * as XLSX from 'xlsx';

interface OperationsProps {
  invoices: Invoice[];
  machines: Machine[];
  activeItems?: any[];
  onUpdateItemStatus: (orderId: string, itemIds: string[], status: OrderStatus, machineId?: string, duration?: number, totalKg?: number) => void;
  sucursal?: any;
  canManage?: boolean;
}

interface OperationItem {
    uniqueId: string; 
    orderId: string;
    itemIndex: number;
    ticketNumber: string;
    clientName: string;
    itemName: string;
    quantity: number;
    status: OrderStatus;
    date: string;
    deliveryDate: string;
    unitCode?: string; 
}

const getTargetDate = (invoice: Invoice, itemDeliveryDate?: string): string => {
    if (itemDeliveryDate) return itemDeliveryDate;
    if (invoice.deliveryDate) return invoice.deliveryDate;
    const creation = new Date(invoice.date);
    if (isNaN(creation.getTime())) return new Date().toISOString();
    return new Date(creation.getTime() + 86400000).toISOString();
};

const getUrgencyStyles = (deliveryDateStr: string) => {
    const now = new Date();
    const delivery = new Date(deliveryDateStr);
    if (isNaN(delivery.getTime())) return { color: 'bg-gray-400', label: 'TIEMPO' };
    
    const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dDel = new Date(delivery.getFullYear(), delivery.getMonth(), delivery.getDate());
    const diffDays = Math.floor((dDel.getTime() - dNow.getTime()) / 86400000);

    if (diffDays <= 0) return { color: 'bg-red-500', label: 'HOY' };
    if (diffDays === 1) return { color: 'bg-orange-500', label: 'MAÑANA' };
    return { color: 'bg-green-500', label: 'A TIEMPO' };
};

const getClientColor = (name: string) => {
    const colors = ['border-l-red-500', 'border-l-orange-500', 'border-l-amber-500', 'border-l-yellow-500', 'border-l-lime-500', 'border-l-green-500', 'border-l-emerald-500', 'border-l-teal-500', 'border-l-cyan-500', 'border-l-sky-500', 'border-l-blue-500', 'border-l-indigo-500', 'border-l-violet-500', 'border-l-purple-500', 'border-l-fuchsia-500', 'border-l-pink-500', 'border-l-rose-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

const Operations: React.FC<OperationsProps> = ({ invoices, machines, activeItems = [], onUpdateItemStatus, sucursal, canManage = true }) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set()); 
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<OrderStatus>('PENDIENTE');
  const [itemsToProcess, setItemsToProcess] = useState<OperationItem[]>([]);
  const [isConfirmFinishOpen, setIsConfirmFinishOpen] = useState(false);
  const [duration, setDuration] = useState('30');

  const [isLogisticsModalOpen, setIsLogisticsModalOpen] = useState(false);
  const [logisticsItems, setLogisticsItems] = useState<OperationItem[]>([]);

  // Optimistic UI State
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, OrderStatus>>({});

  const [isReportFilterModalOpen, setIsReportFilterModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
  const [pendingReportAction, setPendingReportAction] = useState<'EXCEL' | 'PRINT' | null>(null);

  // Limpiar overrides optimistas cuando la base de datos real se sincroniza
  useEffect(() => {
    if (Object.keys(optimisticStatuses).length === 0) return;
    
    setOptimisticStatuses(prev => {
        const next = { ...prev };
        let changed = false;
        
        invoices.forEach(inv => {
            inv.items.forEach(item => {
                // Si el estado real ya es igual al optimista o posterior, removemos el override
                if (next[item.id] && item.status === next[item.id]) {
                    delete next[item.id];
                    changed = true;
                }
            });
        });
        
        return changed ? next : prev;
    });
  }, [invoices]);

  // Filtro de Órdenes Pendientes (PENDIENTE, RECIBIDO o RECIBIDO_CENTRAL)
  const pendingOrders = useMemo(() => {
      return invoices.filter(inv => {
          if (inv.orderStatus === 'CANCELADO') return false;
          if (inv.type === '07') return false;
          return inv.items.some(i => {
              if (i.estado_id === 9 || i.estado === 'CANCELADO') return false;
              const status = optimisticStatuses[i.id] || i.status || 'PENDIENTE';
              return status === 'PENDIENTE' || status === 'RECIBIDO' || status === 'RECIBIDO_CENTRAL';
          });
      }).filter(inv => {
          if (!searchTerm) return true;
          const search = searchTerm.toLowerCase();
          return (
              inv.client.name.toLowerCase().includes(search) || 
              (inv.ordenNumber && inv.ordenNumber.includes(searchTerm)) ||
              inv.items.some(it => it.name.toLowerCase().includes(search))
          );
      });
  }, [invoices, searchTerm, optimisticStatuses]);

  // Corrected activeItems below to actually use item.unitCode properly
    const refinedActiveItems = useMemo(() => {
      const items: OperationItem[] = [];
      invoices.forEach(inv => {
          if (inv.orderStatus === 'CANCELADO') return;
          if (inv.type === '07') return;
          inv.items.forEach((item, idx) => {
              if (item.estado_id === 9 || item.estado === 'CANCELADO') return;
              const status = optimisticStatuses[item.id] || (item.status as OrderStatus) || 'PENDIENTE';
              if (status === 'EN_LAVADO' || status === 'EN_SECADO' || status === 'LISTO') {
                  if (!searchTerm || inv.client.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                      // FIX: itemIndex is now correctly assigned from forEach idx parameter
                      items.push({ 
                          uniqueId: item.id, 
                          orderId: inv.id, 
                          itemIndex: idx, 
                          ticketNumber: inv.ordenNumber || '---', 
                          clientName: inv.client.name, 
                          itemName: item.name, 
                          quantity: item.quantity, 
                          status: status, 
                          unitCode: item.unitCode,
                          date: inv.date, 
                          deliveryDate: getTargetDate(inv, item.itemDeliveryDate) 
                      });
                  }
              }
          });
      });
      return items.sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime());
  }, [invoices, searchTerm, optimisticStatuses]);

  const toggleGlobalSelection = (uid: string) => { 
      const n = new Set(selectedItems); 
      n.has(uid) ? n.delete(uid) : n.add(uid); 
      setSelectedItems(n); 
  };
  
  const toggleOrderExpansion = (orderId: string) => {
    const n = new Set(expandedOrders);
    if (n.has(orderId)) n.delete(orderId);
    else n.add(orderId);
    setExpandedOrders(n);
  };

  const handleSelectAllInColumn = (columnStatus: OrderStatus) => {
      const itemsInColumn = refinedActiveItems.filter(i => i.status === columnStatus);
      const allSelected = itemsInColumn.every(i => selectedItems.has(i.uniqueId));
      
      const n = new Set(selectedItems);
      itemsInColumn.forEach(item => {
          if (allSelected) n.delete(item.uniqueId);
          else n.add(item.uniqueId);
      });
      setSelectedItems(n);
  };

  const handleSelectAllInOrder = (order: Invoice) => {
    const n = new Set(selectedItems);
    const pendingInThisOrder = order.items.filter(it => {
        if (it.estado_id === 9 || it.estado === 'CANCELADO') return false;
        const status = optimisticStatuses[it.id] || it.status || 'PENDIENTE';
        return status === 'PENDIENTE' || status === 'RECIBIDO' || status === 'RECIBIDO_CENTRAL';
    });
    const allSelectedInOrder = pendingInThisOrder.every(it => n.has(it.id));
    
    pendingInThisOrder.forEach(it => {
      if (allSelectedInOrder) n.delete(it.id);
      else n.add(it.id);
    });
    setSelectedItems(n);
  };

  const handleActionClick = (next: OrderStatus, list: OperationItem[]) => {
      if (list.length === 0) return;
      setTargetStatus(next);
      setItemsToProcess(list);
      if (next === 'LISTO') setIsConfirmFinishOpen(true); 
      else setIsMachineModalOpen(true);
  };

  const handleLogisticsDispatch = (list: OperationItem[]) => {
      if (list.length === 0) return;
      setLogisticsItems(list);
      setIsLogisticsModalOpen(true);
  };

  const handleConfirmMachineSelection = (machineId: string) => {
      const dur = parseInt(duration) || 30;
      const totalKg = itemsToProcess.reduce((sum, it) => {
          return sum + (it.unitCode === 'KGM' ? Number(it.quantity) : 0);
      }, 0);

      // --- OPTIMISTIC UPDATE ---
      const newOverrides = { ...optimisticStatuses };
      itemsToProcess.forEach(it => {
          newOverrides[it.uniqueId] = targetStatus;
      });
      setOptimisticStatuses(newOverrides);
      // -------------------------

      const groupedByOrder: Record<string, string[]> = {};
      itemsToProcess.forEach(item => {
          if (!groupedByOrder[item.orderId]) groupedByOrder[item.orderId] = [];
          groupedByOrder[item.orderId].push(item.uniqueId);
      });

      // Execute updates sequentially or in parallel
      Promise.all(Object.entries(groupedByOrder).map(([orderId, itemIds]) => {
          return onUpdateItemStatus(orderId, itemIds, targetStatus, machineId, dur, totalKg);
      })).catch(err => {
          console.error("Error updating item statuses:", err);
          // Rollback optimistic update if needed, but usually App.tsx handles it
      });

      setSelectedItems(new Set());
      setIsMachineModalOpen(false);
  };

    const getSelectedDataList = (columnStatus: OrderStatus) => {
      if (columnStatus === 'PENDIENTE') {
          const list: OperationItem[] = [];
          invoices.forEach(inv => {
              if (inv.orderStatus === 'CANCELADO') return;
              inv.items.forEach((item, idx) => {
                  const uid = item.id;
                  const status = optimisticStatuses[uid] || item.status || 'PENDIENTE';
                  if (selectedItems.has(uid) && (status === 'PENDIENTE' || status === 'RECIBIDO' || status === 'RECIBIDO_CENTRAL')) {
                      list.push({ 
                          uniqueId: uid, 
                          orderId: inv.id, 
                          itemIndex: idx, 
                          ticketNumber: inv.ordenNumber || '---', 
                          clientName: inv.client.name, 
                          itemName: item.name, 
                          quantity: item.quantity, 
                          status: 'PENDIENTE', 
                          unitCode: item.unitCode,
                          date: inv.date, 
                          deliveryDate: getTargetDate(inv, item.itemDeliveryDate) 
                      });
                  }
              });
          });
          return list;
      }
      if (columnStatus === 'LISTO') {
          return refinedActiveItems.filter(i => i.status === 'LISTO' && selectedItems.has(i.uniqueId));
      }
      return refinedActiveItems.filter(i => i.status === columnStatus && selectedItems.has(i.uniqueId));
  };

  const handleGenerateReport = () => {
      if (pendingReportAction === 'EXCEL') {
          handleDownloadExcelPendientes();
      } else if (pendingReportAction === 'PRINT') {
          handlePrintPendientes();
      }
      setIsReportFilterModalOpen(false);
  };

  const getFilteredItemsForReport = () => {
    const list: any[] = [];
    invoices.forEach(inv => {
        if (inv.type === '07') return;
        inv.items.forEach(it => {
            const status = optimisticStatuses[it.id] || it.status || 'PENDIENTE';
            if (status === 'PENDIENTE' || status === 'RECIBIDO' || status === 'RECIBIDO_CENTRAL') {
                const targetDateStr = getTargetDate(inv, it.itemDeliveryDate);
                const deliveryDateObj = new Date(targetDateStr);
                const deliveryStr = targetDateStr.split('T')[0];
                if (deliveryStr >= reportStartDate && deliveryStr <= reportEndDate) {
                    const urgency = getUrgencyStyles(targetDateStr);
                    list.push({ 
                        ticket: inv.ordenNumber || '---', 
                        client: inv.client.name.toUpperCase(), 
                        item: it.name.toUpperCase(), 
                        quantity: it.quantity,
                        delivery: deliveryDateObj, 
                        label: urgency.label, 
                        isToday: urgency.label === 'HOY' 
                    });
                }
            }
        });
    });
    return list.sort((a, b) => a.delivery.getTime() - b.delivery.getTime());
  };

  const handleDownloadExcelPendientes = () => {
    const items = getFilteredItemsForReport();
    if (items.length === 0) return alert("No hay prendas pendientes en el rango seleccionado.");
    const dataToExport = items.map(i => ({ 
        'N° TICKET': i.ticket, 
        'NOMBRE CLIENTE': i.client, 
        'PRENDA': i.item, 
        'CANTIDAD': i.quantity,
        'FECHA DE ENTREGA': i.delivery.toLocaleDateString(), 
        'HORA DE ENTREGA': i.delivery.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase() 
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pendientes");
    XLSX.writeFile(wb, `PENDIENTES_LAVADO_${reportStartDate}_AL_${reportEndDate}.xlsx`);
  };

  const handlePrintPendientes = () => {
    const itemsToPrint = getFilteredItemsForReport();
    if (itemsToPrint.length === 0) return alert("No hay prendas pendientes en el rango seleccionado.");
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const htmlContent = `<html><head><title>Pendientes</title><style>@page { margin: 0; size: 80mm auto; } body { margin: 0; padding: 4mm; width: 72mm; font-family: monospace; font-size: 9pt; color: #000; } .title { text-align: center; font-weight: bold; font-size: 11pt; margin-bottom: 2mm; padding-bottom: 2mm; border-bottom: 1px solid #000; } table { width: 100%; border-collapse: collapse; } th { text-align: left; border-bottom: 1px solid #000; padding: 1mm 0; } td { padding: 1.5mm 0; border-bottom: 0.1mm solid #eee; vertical-align: top; }</style></head><body><div class="title">PENDIENTES POR LAVAR</div><table><thead><tr><th width="20%">ORDEN</th><th>PRENDA / CLIENTE</th><th width="30%">ENTREGA</th></tr></thead><tbody>${itemsToPrint.map(i => `<tr><td>${i.ticket}</td><td><strong>${i.item}</strong><br/>${i.client}</td><td>${i.label}<br/>${i.delivery.toLocaleDateString()}</td></tr>`).join('')}</tbody></table><script>window.onload = function() { window.print(); window.close(); };</script></body></html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="p-6 lg:p-8 h-full bg-slate-100 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-6 shrink-0">
            <div><h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Waves className="text-blue-600" /> Operaciones de Planta</h2></div>
            <div className="flex gap-4 items-center">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder="Buscar cliente o ticket..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                </div>
            </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-hidden">
            {/* COLUMNA 1: PENDIENTES (Incluye RECIBIDO) */}
            <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                    <span className="font-bold text-[10px] uppercase tracking-[0.15em] text-slate-500">PENDIENTES POR LAVAR</span>
                    <div className="flex gap-2 items-center">
                        <button onClick={() => { setPendingReportAction('EXCEL'); setIsReportFilterModalOpen(true); }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"><FileSpreadsheet size={18} /></button>
                        <button onClick={() => { setPendingReportAction('PRINT'); setIsReportFilterModalOpen(true); }} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Printer size={18} /></button>
                        <div className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{pendingOrders.length}</div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {pendingOrders.map(order => {
                        let highestUrgency = 'bg-green-500';
                        const pendingInThisOrder = order.items.filter(it => {
                            const isCanceled = it.estado_id === 9 || (it as any).estado === 'ANULADO' || (it.status as any) === 'ANULADO' || it.status === 'CANCELADO';
                            if (isCanceled) return false;
                            const status = optimisticStatuses[it.id] || it.status || 'PENDIENTE';
                            return status === 'PENDIENTE' || status === 'RECIBIDO';
                        });

                        pendingInThisOrder.forEach(it => { 
                            const st = getUrgencyStyles(getTargetDate(order, it.itemDeliveryDate)); 
                            if (st.color === 'bg-red-500') highestUrgency = 'bg-red-500'; 
                            else if (st.color === 'bg-orange-500' && highestUrgency !== 'bg-red-500') highestUrgency = 'bg-orange-500'; 
                        });

                        const isExpanded = expandedOrders.has(order.id);
                        return (
                            <div key={order.id} className={`bg-white border transition-all relative overflow-hidden flex flex-col rounded-2xl ${isExpanded ? 'border-indigo-300 ring-1 ring-indigo-50 shadow-md' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}>
                                <div className={`absolute top-0 left-0 w-1 h-full ${highestUrgency}`}></div>
                                <div onClick={() => toggleOrderExpansion(order.id)} className="p-4 cursor-pointer flex justify-between items-start">
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center gap-2"><span className="font-bold text-slate-800 text-sm uppercase truncate">{order.client.name}</span><div className={`w-2 h-2 rounded-full ${highestUrgency} animate-pulse`}></div></div>
                                        <div className="flex items-center gap-2 mt-1"><span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">{order.ordenNumber}</span><span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">{order.origin === 'TIENDA' ? <Store size={10}/> : <Truck size={10}/>} {order.origin === 'TIENDA' ? 'Tienda' : 'Delivery'}</span></div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0"><span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{pendingInThisOrder.length} Prendas</span>{isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}</div>
                                </div>
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-slate-50 bg-slate-50/30 animate-in slide-in-from-top-2">
                                        <div className="flex justify-between items-center py-2 mb-2 border-b border-slate-100"><span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Seleccionar Prendas</span><button onClick={(e) => { e.stopPropagation(); handleSelectAllInOrder(order); }} className="text-[8px] font-bold text-indigo-600 hover:underline uppercase">TODO</button></div>
                                        <div className="space-y-1.5">{order.items.map((it) => { 
                                            const isCanceled = it.estado_id === 9 || (it as any).estado === 'ANULADO' || (it.status as any) === 'ANULADO' || it.status === 'CANCELADO';
                                            if (isCanceled) return null;
                                            const status = optimisticStatuses[it.id] || it.status || 'PENDIENTE';
                                            if (status !== 'PENDIENTE' && status !== 'RECIBIDO' && status !== 'RECIBIDO_CENTRAL') return null; 
                                            const uid = it.id; 
                                            const isSelected = selectedItems.has(uid); 
                                            const urgency = getUrgencyStyles(getTargetDate(order, it.itemDeliveryDate)); 
                                            return ( 
                                                <div key={uid} onClick={(e) => { e.stopPropagation(); toggleGlobalSelection(uid); }} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer group ${isSelected ? 'bg-white border-indigo-400 shadow-sm' : 'bg-white/50 border-slate-100 hover:border-slate-200'}`}> 
                                                    <div className="flex items-center gap-3"> {isSelected ? <CheckSquare className="text-indigo-600" size={16} /> : <Square className="text-slate-300" size={16} />} <div className="flex flex-col"> <span className="text-[11px] font-bold text-slate-700 uppercase leading-none">{it.quantity} x {it.name}</span> {it.details && <span className="text-[9px] text-indigo-500 font-bold uppercase mt-0.5">{it.details}</span>} <div className="flex items-center gap-1.5 mt-1"><div className={`w-1.5 h-1.5 rounded-full ${urgency.color}`}></div><span className="text-[8px] font-bold text-slate-400 uppercase">Entrega: {urgency.label}</span></div> </div> </div> </div> 
                                            ); 
                                        })}</div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="p-4 border-t bg-slate-50 flex flex-col gap-2">
                    {selectedItems.size > 0 && (
                        <div className="flex justify-between items-center mb-1 px-1">
                            <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">{selectedItems.size} Seleccionados</span>
                            <button onClick={() => setSelectedItems(new Set())} className="text-[9px] font-bold text-rose-500 hover:underline uppercase">Limpiar</button>
                        </div>
                    )}
                    {canManage && sucursal?.tipo_sucursal === 'ACOPIO' && (
                        <button 
                            onClick={() => handleLogisticsDispatch(getSelectedDataList('PENDIENTE'))} 
                            disabled={getSelectedDataList('PENDIENTE').length === 0} 
                            className="w-full bg-accent hover:bg-accent/90 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Send size={16} /> ENVIAR A PLANTA ({getSelectedDataList('PENDIENTE').length})
                        </button>
                    )}
                    {canManage && (
                        <button 
                            onClick={() => handleActionClick('EN_LAVADO', getSelectedDataList('PENDIENTE'))} 
                            disabled={getSelectedDataList('PENDIENTE').length === 0} 
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Play size={16} fill="currentColor" /> INICIAR LAVADO ({getSelectedDataList('PENDIENTE').length})
                        </button>
                    )}
                </div>
            </div>

            {/* COLUMNA 2: EN LAVADO */}
            <div className="flex flex-col bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-blue-50 border-b flex justify-between items-center">
                    <div className="flex items-center gap-3"><span className="font-bold text-[10px] uppercase tracking-[0.15em] text-blue-800 flex items-center gap-2"><Waves size={14}/> EN LAVADO</span><button onClick={() => handleSelectAllInColumn('EN_LAVADO')} className="text-[9px] font-bold text-blue-600 hover:underline">TODO</button></div>
                    <div className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{refinedActiveItems.filter(i=>i.status==='EN_LAVADO').length}</div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-blue-50/20">
                    {refinedActiveItems.filter(i=>i.status==='EN_LAVADO').map(item => (
                        <div key={item.uniqueId} onClick={() => toggleGlobalSelection(item.uniqueId)} className={`p-3 rounded-r-xl border-y border-r border-l-4 transition-all flex flex-col gap-2 relative group ${getClientColor(item.clientName)} ${selectedItems.has(item.uniqueId) ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer'}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">{selectedItems.has(item.uniqueId) ? <CheckSquare className="text-indigo-600" size={18} /> : <Square className="text-gray-300 group-hover:text-gray-400" size={18} />}<span className="font-bold text-gray-800 text-sm truncate max-w-[120px]">{item.clientName}</span></div>
                                <span className="bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{item.ticketNumber}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-600 pl-6"><div className="flex items-center gap-1 font-medium"><Shirt size={12} /> {item.quantity} x {item.itemName}</div></div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t bg-blue-50 flex flex-col gap-2">
                    {selectedItems.size > 0 && refinedActiveItems.some(i => i.status === 'EN_LAVADO' && selectedItems.has(i.uniqueId)) && (
                        <div className="flex justify-between items-center mb-1 px-1">
                            <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">{refinedActiveItems.filter(i => i.status === 'EN_LAVADO' && selectedItems.has(i.uniqueId)).length} Seleccionados</span>
                            <button onClick={() => {
                                const n = new Set(selectedItems);
                                refinedActiveItems.filter(i => i.status === 'EN_LAVADO').forEach(i => n.delete(i.uniqueId));
                                setSelectedItems(n);
                            }} className="text-[9px] font-bold text-rose-500 hover:underline uppercase">Limpiar</button>
                        </div>
                    )}
                    {canManage && (
                        <button onClick={()=>handleActionClick('EN_SECADO', getSelectedDataList('EN_LAVADO'))} disabled={getSelectedDataList('EN_LAVADO').length === 0} className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"><Wind size={16} /> PASAR A SECADO ({getSelectedDataList('EN_LAVADO').length})</button>
                    )}
                </div>
            </div>

            {/* COLUMNA 3: EN SECADO */}
            <div className="flex flex-col bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-orange-50 border-b flex justify-between items-center">
                    <div className="flex items-center gap-3"><span className="font-bold text-[10px] uppercase tracking-[0.15em] text-orange-800 flex items-center gap-2"><Wind size={14}/> EN SECADO</span><button onClick={() => handleSelectAllInColumn('EN_SECADO')} className="text-[9px] font-bold text-orange-600 hover:underline">TODO</button></div>
                    <div className="bg-orange-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{refinedActiveItems.filter(i=>i.status==='EN_SECADO').length}</div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-orange-50/20">
                    {refinedActiveItems.filter(i=>i.status==='EN_SECADO').map(item => (
                        <div key={item.uniqueId} onClick={() => toggleGlobalSelection(item.uniqueId)} className={`p-3 rounded-r-xl border-y border-r border-l-4 transition-all flex flex-col gap-2 relative group ${getClientColor(item.clientName)} ${selectedItems.has(item.uniqueId) ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer'}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">{selectedItems.has(item.uniqueId) ? <CheckSquare className="text-indigo-600" size={18} /> : <Square className="text-gray-300 group-hover:text-gray-400" size={18} />}<span className="font-bold text-gray-800 text-sm truncate max-w-[120px]">{item.clientName}</span></div>
                                <span className="bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{item.ticketNumber}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-600 pl-6"><div className="flex items-center gap-1 font-medium"><Shirt size={12} /> {item.quantity} x {item.itemName}</div></div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t bg-orange-50 flex flex-col gap-2">
                    {selectedItems.size > 0 && refinedActiveItems.some(i => i.status === 'EN_SECADO' && selectedItems.has(i.uniqueId)) && (
                        <div className="flex justify-between items-center mb-1 px-1">
                            <span className="text-[9px] font-bold text-orange-600 uppercase tracking-widest">{refinedActiveItems.filter(i => i.status === 'EN_SECADO' && selectedItems.has(i.uniqueId)).length} Seleccionados</span>
                            <button onClick={() => {
                                const n = new Set(selectedItems);
                                refinedActiveItems.filter(i => i.status === 'EN_SECADO').forEach(i => n.delete(i.uniqueId));
                                setSelectedItems(n);
                            }} className="text-[9px] font-bold text-rose-500 hover:underline uppercase">Limpiar</button>
                        </div>
                    )}
                    {canManage && (
                        <button onClick={()=>handleActionClick('LISTO', getSelectedDataList('EN_SECADO'))} disabled={getSelectedDataList('EN_SECADO').length === 0} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-200 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"><CheckCircle2 size={16} /> FINALIZAR PROCESO ({getSelectedDataList('EN_SECADO').length})</button>
                    )}
                </div>
            </div>

            {/* COLUMNA 4: LISTO (Solo para CENTRAL) */}
            {sucursal?.tipo_sucursal === 'CENTRAL' && (
                <div className="flex flex-col bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
                    <div className="p-4 bg-emerald-50 border-b flex justify-between items-center">
                        <div className="flex items-center gap-3"><span className="font-bold text-[10px] uppercase tracking-[0.15em] text-emerald-800 flex items-center gap-2"><CheckCircle2 size={14}/> LISTO PARA RETORNO</span><button onClick={() => handleSelectAllInColumn('LISTO')} className="text-[9px] font-bold text-emerald-600 hover:underline">TODO</button></div>
                        <div className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{refinedActiveItems.filter(i=>i.status==='LISTO').length}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-emerald-50/20">
                        {refinedActiveItems.filter(i=>i.status==='LISTO').map(item => (
                            <div key={item.uniqueId} onClick={() => toggleGlobalSelection(item.uniqueId)} className={`p-3 rounded-r-xl border-y border-r border-l-4 transition-all flex flex-col gap-2 relative group ${getClientColor(item.clientName)} ${selectedItems.has(item.uniqueId) ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">{selectedItems.has(item.uniqueId) ? <CheckSquare className="text-indigo-600" size={18} /> : <Square className="text-gray-300 group-hover:text-gray-400" size={18} />}<span className="font-bold text-gray-800 text-sm truncate max-w-[120px]">{item.clientName}</span></div>
                                    <span className="bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{item.ticketNumber}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-600 pl-6"><div className="flex items-center gap-1 font-medium"><Shirt size={12} /> {item.quantity} x {item.itemName}</div></div>
                            </div>
                        ))}
                    </div>
                    {canManage && (
                        <div className="p-4 border-t bg-emerald-50">
                            <button onClick={()=>handleLogisticsDispatch(getSelectedDataList('LISTO'))} disabled={getSelectedDataList('LISTO').length === 0} className="w-full bg-accent hover:bg-accent/90 disabled:bg-slate-200 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"><Send size={16} /> ENVIAR A ACOPIO ({getSelectedDataList('LISTO').length})</button>
                        </div>
                    )}
                </div>
            )}
        </div>

        {isReportFilterModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in"><div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 border border-slate-100 flex flex-col"><div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0"><div className="flex items-center gap-3"><div className="bg-indigo-600 p-2 rounded-xl"><Calendar size={20} /></div><h3 className="font-bold text-lg uppercase tracking-tight">Rango de Entrega</h3></div><button onClick={()=>setIsReportFilterModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full"><X size={24}/></button></div><div className="p-8 space-y-6"><div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3 mb-2"><AlertTriangle className="text-indigo-600 shrink-0 mt-0.5" size={16} /><p className="text-[10px] text-indigo-800 font-bold uppercase leading-tight">El reporte filtrará solo las prendas cuyo estado sea "PENDIENTE" y cuya fecha de entrega esté dentro del rango.</p></div><div className="space-y-4"><div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Fecha Inicial</label><input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner"/></div><div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Fecha Final</label><input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner"/></div></div><button onClick={handleGenerateReport} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em]"><CheckCircle2 size={18}/> GENERAR REPORTE</button></div></div></div>
        )}

        {isMachineModalOpen && (
            <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/20 flex flex-col max-h-[90vh]">
                    <div className="p-8 border-b border-white/5 bg-slate-900 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4"><div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">{targetStatus === 'EN_LAVADO' ? <WashingMachine size={24}/> : <Wind size={24}/>}</div><div><h3 className="font-bold text-2xl uppercase tracking-tight text-white">Seleccionar Máquina de {targetStatus === 'EN_LAVADO' ? 'Lavado' : 'Secado'}</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{itemsToProcess.length} Prendas seleccionadas</p></div></div>
                        <button onClick={()=>setIsMachineModalOpen(false)} className="hover:bg-white/10 p-2 rounded-full text-slate-400"><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {machines.filter(m => {
                                const isReallyBusy = m.estado_operativo === 'OCUPADO' && activeItems.some(item => 
                                    m.currentOrderId?.split(',').map(id => id.trim()).includes(item.venta_id) && 
                                    item.estado === (m.type === 'LAVADORA' ? 'EN_LAVADO' : 'EN_SECADO')
                                );
                                return !isReallyBusy && m.estado_operativo !== 'MANTENIMIENTO' && (targetStatus === 'EN_LAVADO' ? m.type === 'LAVADORA' : m.type === 'SECADORA');
                            }).map(machine => (
                                <div key={machine.id} onClick={() => handleConfirmMachineSelection(machine.id)} className="bg-slate-800 border-2 border-slate-700 rounded-3xl p-4 flex flex-col items-center gap-4 cursor-pointer hover:border-indigo-500 hover:bg-slate-800/80 transition-all group active:scale-95">
                                    <div className="w-24 h-24 flex items-center justify-center bg-slate-900 rounded-2xl p-3 shadow-inner"><img src={machine.imageUrl} className="w-full h-full object-contain drop-shadow-xl group-hover:scale-110 transition-transform" /></div>
                                    <div className="text-center"><h4 className="text-white font-bold text-xs uppercase tracking-wider mb-1">{machine.name}</h4><div className="flex items-center justify-center gap-1.5 text-indigo-400"><Scale size={12}/><span className="text-[10px] font-bold uppercase">{machine.capacityKg} KG</span></div></div>
                                    <div className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight size={14}/> ASIGNAR</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-8 border-t border-white/5 bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                        <div className="flex items-center gap-4 w-full sm:w-auto"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tiempo Estimado (min):</label><input type="number" value={duration} onChange={e=>setDuration(e.target.value)} className="w-24 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 font-bold text-sm outline-none focus:border-indigo-500"/></div>
                        <button onClick={()=>setIsMachineModalOpen(false)} className="px-10 py-3 bg-slate-800 text-slate-400 rounded-xl font-bold text-[10px] uppercase tracking-widest">Cerrar</button>
                    </div>
                </div>
            </div>
        )}

        <ConfirmationModal 
            isOpen={isConfirmFinishOpen} 
            onClose={()=>setIsConfirmFinishOpen(false)} 
            onConfirm={()=>{ 
                const totalKg = itemsToProcess.reduce((sum, it) => {
                    return sum + (it.unitCode === 'KGM' ? Number(it.quantity) : 0);
                }, 0);

                // --- OPTIMISTIC UPDATE ---
                const newOverrides = { ...optimisticStatuses };
                itemsToProcess.forEach(it => {
                    newOverrides[it.uniqueId] = 'LISTO';
                });
                setOptimisticStatuses(newOverrides);
                // -------------------------

                const groupedByOrder: Record<string, string[]> = {};
                itemsToProcess.forEach(item => {
                    if (!groupedByOrder[item.orderId]) groupedByOrder[item.orderId] = [];
                    groupedByOrder[item.orderId].push(item.uniqueId);
                });

                Promise.all(Object.entries(groupedByOrder).map(([orderId, itemIds]) => { 
                    return onUpdateItemStatus(orderId, itemIds, 'LISTO', undefined, undefined, totalKg); 
                })).catch(err => {
                    console.error("Error updating item statuses to LISTO:", err);
                });

                setSelectedItems(new Set()); 
                setIsConfirmFinishOpen(false); 
            }} 
            title="Finalizar Procesamiento" 
            message={`¿Desea marcar estas ${itemsToProcess.length} prendas como LISTAS PARA ENTREGA?`} 
            confirmText="Sí, Terminar" 
        />

        <LogisticsBulkDispatchModal
            isOpen={isLogisticsModalOpen}
            onClose={() => setIsLogisticsModalOpen(false)}
            selectedItems={logisticsItems}
            type={sucursal?.tipo_sucursal === 'CENTRAL' ? 'RETORNO' : 'RECOJO'}
            onSuccess={() => {
                setSelectedItems(new Set());
                setLogisticsItems([]);
            }}
        />
    </div>
  );
};

export default Operations;

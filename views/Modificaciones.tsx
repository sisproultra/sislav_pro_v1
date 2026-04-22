
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Invoice, Company, PaymentMethodConfig, OrderStatus, Product, CartItem } from '../types';
import { 
  PencilLine, CheckCircle2, AlertTriangle, Search, Filter, 
  Trash2, CreditCard, RotateCcw, AlertCircle, Info, Check, 
  Undo2, ShieldCheck, Clock, DollarSign, ChevronLeft, ChevronRight,
  Plus, Minus, Save, Receipt, User, Loader2, Calendar, CalendarCheck, Wallet
} from 'lucide-react';
import { formatDateSafe, formatTimeSafe } from '../utils/calculations';
import { 
  dbGetActiveCashClosingDate, 
  dbRemovePayment, 
  dbUpdatePaymentTransactionMethod, 
  dbRestoreOrderToReady,
  dbUpdateOrderItems,
  dbAdjustClientBalance,
  dbSaveExpense,
  dbAddPayment,
  getActiveBranchId,
  dbGetGlobalColors
} from '../services/dbService';
import { GlobalColor } from '../types';
import CartItemDetailModal from '../components/CartItemDetailModal';

interface ModificacionesProps {
  invoices: Invoice[];
  products: Product[];
  company: Company;
  paymentMethods: PaymentMethodConfig[];
  onRefresh: () => void;
  canManage?: boolean;
  checkCajaOpen?: (action: () => void) => void;
}

const Modificaciones: React.FC<ModificacionesProps> = ({ invoices, products, company, paymentMethods, onRefresh, canManage = true, checkCajaOpen }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [lastClosingDate, setLastClosingDate] = useState<Date>(new Date(0));
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [showConfirmAdjustment, setShowConfirmAdjustment] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Estados para Ajuste de Ítems
  const [adjustmentCart, setAdjustmentCart] = useState<CartItem[]>([]);
  const [processType, setProcessType] = useState<'REFUND' | 'CREDIT' | 'PAYMENT' | 'NONE'>('NONE');
  const [refundPaymentMethod, setRefundPaymentMethod] = useState('');
  
  const [selectedItemToDetail, setSelectedItemToDetail] = useState<CartItem | null>(null);
  const [itemToAnular, setItemToAnular] = useState<CartItem | null>(null);
  const [isAddingNewItemViaModal, setIsAddingNewItemViaModal] = useState(false);
  const [sessionPayments, setSessionPayments] = useState<{methodId: string, amount: number, date: string}[]>([]);
  const [globalColors, setGlobalColors] = useState<GlobalColor[]>([]);

  const primaryColor = company?.primaryColor || '#22c55e';

  useEffect(() => {
    loadClosingDate();
    loadGlobalColors();
  }, []);

  const loadGlobalColors = async () => {
    const colors = await dbGetGlobalColors();
    setGlobalColors(colors);
  };

  const loadClosingDate = async () => {
    setIsLoading(true);
    try {
      const date = await dbGetActiveCashClosingDate();
      setLastClosingDate(date);
    } catch (error) {
      console.error("Error loading closing date:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const modifiableInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const invDate = new Date(inv.date);
      // Solo permitimos modificar si es posterior al último cierre de caja
      return invDate > lastClosingDate;
    });
  }, [invoices, lastClosingDate]);

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = modifiableInvoices.filter(inv => 
      inv.ordenNumber?.toLowerCase().includes(term) || 
      inv.client.name.toLowerCase().includes(term) ||
      inv.ticketNumber?.toLowerCase().includes(term)
    );
    return filtered;
  }, [modifiableInvoices, searchTerm]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  // Reset to page 1 on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleRestoreStatus = async (invoice: Invoice) => {
    if (!window.confirm(`¿Está seguro de revertir el estado de la orden ${invoice.ordenNumber}? Se marcará como LISTO y se eliminará la fecha de entrega.`)) return;
    
    setIsActionLoading(true);
    try {
      await dbRestoreOrderToReady(invoice.id);
      onRefresh();
      alert("Estado revertido exitosamente.");
    } catch (error: any) {
      alert("Error al revertir estado: " + error.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Lógica de Ajuste de Ítems
  const handleOpenAdjustment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setAdjustmentCart([...invoice.items]);
    setIsAdjustmentModalOpen(true);
    setRefundPaymentMethod(''); // Reset payment method to empty (NOT MANDATORY)
    setProcessType('NONE');
  };

  const calculateNewTotals = (cart: CartItem[]) => {
    const total = cart.reduce((sum, it) => sum + it.subtotal, 0);
    return {
      total,
      igv: 0,
      gravada: 0,
      exonerada: total,
      inafecta: 0
    };
  };

  const currentAdjustmentTotal = useMemo(() => {
    return adjustmentCart.reduce((sum, it) => {
      if (it.isAnulado || it.estado_id === 9) return sum;
      return sum + it.subtotal;
    }, 0);
  }, [adjustmentCart]);

  const adjustmentDifference = useMemo(() => {
    if (!selectedInvoice) return 0;
    return currentAdjustmentTotal - selectedInvoice.totals.total;
  }, [currentAdjustmentTotal, selectedInvoice]);

  const handleUpdateAdjustmentCart = (productId: string, delta: number) => {
      const index = adjustmentCart.findIndex(it => it.id === productId);
      if (index === -1) return;
      
      const item = adjustmentCart[index];
      const isAnuladoLocal = item.isAnulado || item.estado_id === 9;
      
      if (isAnuladoLocal && delta < 0) return;

      if (delta < 0 && item.quantity + delta <= 0) {
          setItemToAnular(item);
          return;
      }

      setAdjustmentCart(prev => {
          const newCart = [...prev];
          const newItem = { ...newCart[index] };
          newItem.quantity = Math.max(0, newItem.quantity + delta);
          newItem.subtotal = newItem.quantity * newItem.price;
          
          if (newItem.quantity <= 0) {
              newItem.isAnulado = true;
              newItem.estado_id = 9;
          } else {
              delete newItem.isAnulado;
              if (newItem.estado_id === 9) newItem.estado_id = 2; // RECIBIDO por defecto si se reactiva
          }
          
          newCart[index] = newItem;
          return newCart;
      });
  };

  const confirmAnularItem = () => {
      if (!itemToAnular) return;
      setAdjustmentCart(prev => prev.map(it => it.id === itemToAnular.id ? {
          ...it,
          isAnulado: true,
          estado_id: 9,
          status: 'CANCELADO'
      } : it));
      setItemToAnular(null);
  };

  const sortedAdjustmentCart = useMemo(() => {
      return [...adjustmentCart].sort((a, b) => {
          const aAnulado = (a.isAnulado || a.estado_id === 9) ? 1 : 0;
          const bAnulado = (b.isAnulado || b.estado_id === 9) ? 1 : 0;
          return aAnulado - bAnulado;
      });
  }, [adjustmentCart]);

  const handleUpdateItemDetails = (
    details: string, 
    images: string[], 
    audio?: string, 
    date?: string, 
    paymentMethodId?: string, 
    selectedProduct?: Product
  ) => {
      if (isAddingNewItemViaModal && selectedProduct) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(17, 0, 0, 0);

          const newItem: CartItem = {
              ...selectedProduct,
              id: `new-${Date.now()}`,
              quantity: 1,
              subtotal: selectedProduct.price,
              details,
              images,
              audioNote: audio,
              es_ajuste: true,
              status: 'RECIBIDO',
              estado_id: 2,
              itemDeliveryDate: date || tomorrow.toISOString()
          };

          setAdjustmentCart(prev => [...prev, newItem]);

          if (paymentMethodId) {
              setSessionPayments(prev => [...prev, {
                  methodId: paymentMethodId,
                  amount: selectedProduct.price,
                  date: new Date().toISOString()
              }]);
          }
          setIsAddingNewItemViaModal(false);
          return;
      }

      if (!selectedItemToDetail) return;
      setAdjustmentCart(prev => prev.map(it => it.id === selectedItemToDetail.id ? {
          ...it,
          details,
          images,
          audioNote: audio,
          itemDeliveryDate: date
      } : it));

      if (paymentMethodId) {
          setSessionPayments(prev => [...prev, {
              methodId: paymentMethodId,
              amount: selectedItemToDetail.price * selectedItemToDetail.quantity,
              date: new Date().toISOString()
          }]);
      }
      setSelectedItemToDetail(null);
  };

  const handleConfirmAdjustment = async () => {
      // Alerta inmediata de depuración
      console.log("[handleConfirmAdjustment] Pulsado");
      
      if (!selectedInvoice) {
          alert("Error: No hay orden seleccionada.");
          return;
      }

      // 1. Filtrar items activos (los que NO están anulados ni tienen estado_id 9)
      const activeItems = adjustmentCart.filter(it => !it.isAnulado && it.estado_id !== 9);
      
      if (activeItems.length === 0) {
          alert("La orden no puede quedar vacía. Por favor mantenga al menos una prenda activa.");
          return;
      }

      // 2. Calcular diferencia
      const invoiceTotalOriginal = selectedInvoice.totals?.total || 0;
      const difference = currentAdjustmentTotal - invoiceTotalOriginal;

      console.log("[handleConfirmAdjustment] Total Original:", invoiceTotalOriginal);
      console.log("[handleConfirmAdjustment] Total Nuevo:", currentAdjustmentTotal);
      console.log("[handleConfirmAdjustment] Diferencia:", difference);

      // 3. Validar gestión de diferencia si el total bajó POR DEBAJO de lo ya pagado
      const paidAmount = selectedInvoice.prePaymentAmount || 0;
      if (currentAdjustmentTotal < paidAmount - 0.01 && processType === 'NONE') {
          alert("El nuevo total es menor a lo ya pagado. Por favor seleccione si desea aplicar el saldo a favor al cliente o realizar una devolución.");
          return;
      }

      // 4. Mostrar modal de confirmación en lugar de window.confirm
      setShowConfirmAdjustment(true);
  };

  const executeAdjustment = async () => {
    if (!selectedInvoice) return;
    
    const invoiceTotalOriginal = selectedInvoice.totals?.total || 0;
    const difference = currentAdjustmentTotal - invoiceTotalOriginal;
    const paidAmount = selectedInvoice.prePaymentAmount || 0;
    const activeItems = adjustmentCart.filter(it => !it.isAnulado && it.estado_id !== 9);

    const performAdjustment = async () => {
        setIsActionLoading(true);
        setShowConfirmAdjustment(false);
        try {
            console.log("[handleConfirmAdjustment] Iniciando guardado en DB...");
            
            // Actualización de ítems y totales
            const newTotals = calculateNewTotals(activeItems);
            await dbUpdateOrderItems(selectedInvoice.id, activeItems, newTotals);
            
            // Manejo de diferencia financiera (Solo si lo pagado supera al nuevo total)
            if (currentAdjustmentTotal < paidAmount - 0.01) {
                const surplus = paidAmount - currentAdjustmentTotal;
                if (processType === 'CREDIT') {
                    const clientId = selectedInvoice.client?.id || selectedInvoice.cliente_id;
                    if (clientId && clientId !== 'temp') {
                        await dbAdjustClientBalance(clientId, surplus);
                    }
                } else if (processType === 'REFUND') {
                    const method = paymentMethods.find(m => m.id === refundPaymentMethod);
                    await dbSaveExpense({
                        amount: surplus,
                        description: `DEVOLUCIÓN AJUSTE ORDEN ${selectedInvoice.ordenNumber}`,
                        category: 'DEVOLUCION',
                        paymentMethod: method?.name || 'EFECTIVO',
                        date: new Date().toISOString(),
                        sucursal_id: getActiveBranchId()!
                    });
                }
            }

            // Registrar pagos adicionales si los hay
            for (const sp of sessionPayments) {
                const method = paymentMethods.find(m => m.id === sp.methodId);
                await dbAddPayment(selectedInvoice.id, sp.amount, method?.name || 'OTRO');
            }

            console.log("[handleConfirmAdjustment] Éxito absoluto");
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 2000);
            
            setSessionPayments([]);
            setIsAdjustmentModalOpen(false);
            onRefresh();
        } catch (error: any) {
            console.error("[handleConfirmAdjustment] ERROR:", error);
            alert("ERROR AL GUARDAR: " + (error.message || "Error desconocido en el servidor"));
        } finally {
            setIsActionLoading(false);
        }
    };

    if (checkCajaOpen) {
        checkCajaOpen(() => performAdjustment());
    } else {
        performAdjustment();
    }
  };

  const handleRemovePayment = async (payId: string) => {
    if (!window.confirm("¿Está seguro de eliminar este pago? Esta acción no se puede deshacer.")) return;
    
    setIsActionLoading(true);
    try {
      await dbRemovePayment(payId);
      onRefresh();
      // Update local state if modal is open
      if (selectedInvoice) {
        setSelectedInvoice({
          ...selectedInvoice,
          payments: selectedInvoice.payments?.filter(p => p.id !== payId)
        });
      }
    } catch (error: any) {
      alert("Error al eliminar pago: " + error.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleChangePaymentMethod = async (payId: string, methodId: string) => {
    setIsActionLoading(true);
    try {
      await dbUpdatePaymentTransactionMethod(payId, methodId);
      onRefresh();
      // Update local state if modal is open
      if (selectedInvoice) {
        setSelectedInvoice({
          ...selectedInvoice,
          payments: selectedInvoice.payments?.map(p => p.id === payId ? { ...p, metodo_pago_id: methodId } : p)
        });
      }
    } catch (error: any) {
      alert("Error al actualizar método de pago: " + error.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4 bg-white h-full grow">
        <RotateCcw className="animate-spin text-indigo-600" size={40} />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando datos de operación...</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50/50 p-4 lg:p-8 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto p-4 lg:p-8 pb-40 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <PencilLine style={{ color: primaryColor }} size={28} />
            MODIFICAR OPERACIONES
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] flex items-center gap-1.5 mt-2">
            <ShieldCheck size={14} className="text-emerald-500" />
            Ventas registradas posteriores al cierre de caja: {lastClosingDate.getTime() === 0 ? 'SIN CIERRES' : lastClosingDate.toLocaleString()}
          </p>
        </div>

        <div className="relative w-full lg:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por orden, cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold uppercase tracking-wider focus:bg-white focus:ring-4 focus:outline-none transition-all placeholder:text-slate-400 shadow-sm"
            style={{ '--tw-ring-color': `${primaryColor}20`, borderColor: '#f1f5f9' } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Records Section */}
      <div className="space-y-4">
        {/* Mobile View (Cards) */}
        <div className="grid grid-cols-1 gap-4 lg:hidden">
          {paginatedInvoices.length === 0 ? (
            <div className="bg-white p-12 rounded-[2rem] border border-slate-200 text-center shadow-sm">
              <Search size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay registros para este turno.</p>
            </div>
          ) : (
            paginatedInvoices.map((inv) => (
              <div key={inv.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm font-black text-slate-900 tracking-tight">{inv.ordenNumber}</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Clock size={10} className="text-slate-400" />
                      <span className="text-[9px] text-slate-400 uppercase font-black">
                        {formatTimeSafe(inv.date)} - {formatDateSafe(inv.date)}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest inline-flex items-center gap-1 ${
                    inv.orderStatus === 'ENTREGADO' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    inv.orderStatus === 'LISTO' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                    'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {inv.orderStatus}
                  </span>
                </div>

                <div className="flex flex-col gap-1 pb-3 border-b border-slate-50">
                  <span className="text-[11px] font-black text-slate-700 uppercase">{inv.client.name}</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{inv.client.docNumber}</span>
                </div>

                <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900" style={{ color: primaryColor }}>
                      {company.currencySymbol} {inv.prePaymentAmount?.toFixed(2)}
                    </span>
                    <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">
                      {inv.payments?.length || 0} PAGO(S)
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                        onClick={() => handleOpenAdjustment(inv)}
                        className="p-3 bg-white border border-slate-200 text-indigo-600 rounded-xl transition-all shadow-sm active:scale-95"
                        title="Ajustar Ítems"
                      >
                        <Receipt size={14} />
                      </button>
                    {inv.orderStatus === 'ENTREGADO' && canManage && (
                      <button 
                        onClick={() => handleRestoreStatus(inv)}
                        className="p-3 bg-white border border-slate-200 text-orange-600 rounded-xl transition-all shadow-sm active:scale-95"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {canManage && (
                      <button 
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setIsPayModalOpen(true);
                        }}
                        style={{ backgroundColor: primaryColor }}
                        className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md active:scale-95"
                      >
                        <CreditCard size={12} />
                        PAGOS
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden lg:block bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse bg-white">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Orden / Fecha</th>
                  <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Cliente</th>
                  <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Estado</th>
                  <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Pagado</th>
                  <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Search size={32} className="text-slate-200" />
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No hay registros modificables para este turno.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-indigo-50/30 transition-colors group bg-white">
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 tracking-tight">{inv.ordenNumber}</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Clock size={10} className="text-slate-400" />
                            <span className="text-[10px] text-slate-400 uppercase font-black tracking-tight">
                              {formatTimeSafe(inv.date)} - {formatDateSafe(inv.date)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col max-w-[200px]">
                          <span className="text-xs font-black text-slate-700 truncate uppercase tracking-tight">{inv.client.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{inv.client.docNumber}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 ${
                          inv.orderStatus === 'ENTREGADO' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          inv.orderStatus === 'LISTO' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                          'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            inv.orderStatus === 'ENTREGADO' ? 'bg-emerald-500' :
                            inv.orderStatus === 'LISTO' ? 'bg-blue-500' :
                            'bg-amber-500'
                          }`} />
                          {inv.orderStatus}
                        </span>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900" style={{ color: primaryColor }}>
                            {company.currencySymbol} {inv.prePaymentAmount?.toFixed(2)}
                          </span>
                          <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">
                            {inv.payments?.length || 0} PAGO(S) RECIBIDO(S)
                          </p>
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                           <button 
                              onClick={() => handleOpenAdjustment(inv)}
                              title="Ajustar Ítems / Prendas"
                              className="p-3 bg-white border border-slate-100 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all shadow-sm active:scale-95 group/btn"
                            >
                              <Receipt size={16} />
                            </button>
                          {inv.orderStatus === 'ENTREGADO' && canManage && (
                            <button 
                              onClick={() => handleRestoreStatus(inv)}
                              title="Revertir Entrega"
                              className="p-3 bg-white border border-slate-100 text-orange-600 hover:bg-orange-600 hover:text-white rounded-2xl transition-all shadow-sm active:scale-95 group/btn"
                            >
                              <RotateCcw size={16} className="group-hover/btn:rotate-180 duration-500 transition-transform" />
                            </button>
                          )}
                          {canManage && (
                            <button 
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setIsPayModalOpen(true);
                              }}
                              style={{ backgroundColor: primaryColor }}
                              className="flex items-center gap-2 px-5 py-2.5 text-white hover:brightness-110 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                            >
                              <CreditCard size={14} />
                              PAGOS
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        {filteredInvoices.length > itemsPerPage && (
          <div className="p-6 bg-white border border-slate-200 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex flex-col text-center sm:text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1.5">Navegación de registros</p>
              <p className="text-[11px] font-bold text-slate-600">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} de {filteredInvoices.length}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="w-10 h-10 flex items-center justify-center border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-30 transition-all bg-white shadow-sm"
              >
                <ChevronLeft size={18} className="text-slate-600" />
              </button>
              
              <div className="hidden sm:flex items-center gap-1.5">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 2 + i;
                    if (pageNum + (5 - i - 1) > totalPages) {
                      pageNum = totalPages - 4 + i;
                    }
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      style={currentPage === pageNum ? { backgroundColor: primaryColor } : {}}
                      className={`min-w-[36px] h-9 rounded-xl text-[10px] font-bold transition-all uppercase ${
                        currentPage === pageNum 
                        ? 'text-white shadow-lg' 
                        : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              {/* Mobile page indicator */}
              <div className="sm:hidden text-[11px] font-black text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
                {currentPage} / {totalPages}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="w-10 h-10 flex items-center justify-center border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-30 transition-all bg-white shadow-sm"
              >
                <ChevronRight size={18} className="text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Management Modal */}
      {isPayModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            onClick={() => setIsPayModalOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden relative shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] sm:max-h-[85vh]">
            <div className="bg-slate-50 p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none mb-2 uppercase">GESTIONAR PAGOS</h3>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate max-w-[250px] sm:max-w-none">{selectedInvoice.ordenNumber} • {selectedInvoice.client.name}</p>
              </div>
              <button onClick={() => setIsPayModalOpen(false)} className="p-2.5 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto text-left grow custom-scrollbar">
              {(!selectedInvoice.payments || selectedInvoice.payments.length === 0) ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-300">
                    <CreditCard size={32} />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No hay pagos registrados.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedInvoice.payments.map((p, idx) => {
                    return (
                      <div key={p.id || idx} className="p-4 sm:p-5 bg-white border border-slate-100 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-4 text-left w-full sm:w-auto">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}>
                            <DollarSign size={20} className="sm:w-6 sm:h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 tracking-tight">{company.currencySymbol} {p.monto.toFixed(2)}</p>
                            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.date ? formatDateSafe(p.date) : 'FECHA DESCONOCIDA'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          <select 
                            value={p.metodo_pago_id}
                            disabled={isActionLoading}
                            onChange={(e) => handleChangePaymentMethod(p.id!, e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold uppercase outline-none focus:ring-2 transition-all cursor-pointer grow sm:grow-0"
                            style={{ '--tw-ring-color': `${primaryColor}40` } as React.CSSProperties}
                          >
                            {paymentMethods.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>

                          <button 
                            disabled={isActionLoading}
                            onClick={() => handleRemovePayment(p.id!)}
                            className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-95 border border-transparent hover:border-rose-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-100 p-4 sm:p-5 rounded-3xl flex items-start gap-4">
                 <div className="p-2 rounded-xl bg-amber-100 text-amber-600 shrink-0">
                    <Info size={18} />
                 </div>
                 <p className="text-[10px] sm:text-[11px] font-medium text-amber-700 leading-relaxed uppercase tracking-tight">
                    Cualquier cambio aquí se reflejará inmediatamente en el cierre de caja. 
                    Asegúrese de sintonizar el dinero físico con este ajuste.
                 </p>
              </div>
            </div>

            <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button 
                onClick={() => setIsPayModalOpen(false)}
                className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all hover:bg-black hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-slate-200"
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {isAdjustmentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center animate-in fade-in duration-300">
          <div 
            onClick={() => { if (!isActionLoading) setIsAdjustmentModalOpen(false); }}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />
          <div className="bg-slate-50 w-full h-[100dvh] md:h-[95dvh] md:max-w-6xl md:rounded-[3rem] overflow-hidden relative shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 duration-500">
            {/* Header */}
            <div className="bg-white p-5 sm:p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 sm:gap-4 text-left">
                <div className="p-2 sm:p-3 bg-indigo-50 rounded-xl sm:rounded-2xl text-indigo-600">
                    <Receipt className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <div>
                    <h3 className="text-sm sm:text-2xl font-black text-slate-900 tracking-tight leading-none mb-0.5 sm:mb-1 uppercase">AJUSTAR ORDEN</h3>
                    <p className="text-[9px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-widest truncate">{selectedInvoice.ordenNumber} • {selectedInvoice.client.name.toUpperCase()}</p>
                </div>
              </div>
              <button disabled={isActionLoading} onClick={() => setIsAdjustmentModalOpen(false)} className="p-2 sm:p-3 hover:bg-slate-100 rounded-xl sm:rounded-2xl transition-all text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row gap-0 custom-scrollbar">
                
                {/* Left Side: Cart Items */}
                <div className="w-full md:flex-1 md:overflow-y-auto p-3 sm:p-8 space-y-4 sm:space-y-6 custom-scrollbar bg-white">
                    <div className="flex items-center justify-between sticky top-0 bg-white z-10 py-1 sm:py-2 border-b border-slate-50 mb-2 sm:mb-4">
                        <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Servicios / Prendas</label>
                        <button 
                            type="button"
                            onClick={() => setIsAddingNewItemViaModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                        >
                            <Plus size={14} /> AGREGAR PRENDA
                        </button>
                    </div>

                    {/* Buscador eliminado de aquí (ahora está en el modal) */}

                    <div className="space-y-4">
                        {sortedAdjustmentCart.map((it, idx) => {
                            const isAnulado = it.isAnulado || it.estado_id === 9;
                            return (
                                <div key={it.id || idx} className={`p-4 sm:p-5 border rounded-2xl sm:rounded-[2rem] flex flex-col gap-4 shadow-sm transition-all group relative overflow-hidden ${ 
                                    isAnulado 
                                        ? 'bg-red-50 border-red-200' 
                                        : it.es_ajuste 
                                            ? 'bg-indigo-50/50 border-indigo-200' 
                                            : 'bg-slate-50 border-slate-100'
                                }`}>
                                    
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 overflow-hidden text-left">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className={`text-sm font-black uppercase tracking-tight leading-tight truncate ${isAnulado ? 'text-red-900' : 'text-slate-800'}`}>
                                                    {it.name}
                                                </p>
                                                {isAnulado && (
                                                    <span className="px-2 py-0.5 bg-red-600 text-white text-[8px] font-black rounded-md shadow-sm uppercase">ANULADO</span>
                                                )}
                                                {it.es_ajuste && !isAnulado && (
                                                    <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded-md shadow-sm uppercase">ADICIONAL</span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{company.currencySymbol}{it.price.toFixed(2)} / {it.unitCode}</p>
                                                {it.itemDeliveryDate && (
                                                    <div className={`flex items-center gap-1 text-[9px] font-black uppercase ${isAnulado ? 'text-red-400' : 'text-indigo-500'}`}>
                                                        <Clock size={12} /> {formatDateSafe(it.itemDeliveryDate)} {formatTimeSafe(it.itemDeliveryDate)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
    
                                        <div className="flex items-center gap-3">
                                            <div className={`flex items-center bg-white border rounded-xl sm:rounded-2xl overflow-hidden shadow-sm h-9 sm:h-10 ${isAnulado ? 'border-red-100 opacity-50' : 'border-slate-200'}`}>
                                                <button 
                                                    onClick={() => handleUpdateAdjustmentCart(it.id, -1)}
                                                    className={`px-2 sm:px-3 h-full transition-colors ${isAnulado ? 'text-red-200 cursor-not-allowed' : 'hover:bg-slate-50 text-slate-400 hover:text-red-600'}`}
                                                    disabled={isAnulado}
                                                >
                                                    {it.quantity > 1 ? <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                                                </button>
                                                <span className={`px-2 sm:px-3 text-xs sm:text-sm font-black border-x min-w-[35px] sm:min-w-[50px] text-center ${isAnulado ? 'text-red-900 border-red-50 bg-red-50/50' : 'text-slate-900 border-slate-100'}`}>
                                                    {it.quantity}
                                                </span>
                                                <button 
                                                    disabled
                                                    className="px-2 sm:px-3 h-full text-slate-100 cursor-not-allowed"
                                                >
                                                    <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                </button>
                                            </div>
                                            <div className="min-w-[60px] sm:min-w-[70px] text-right">
                                                <p className={`text-xs sm:text-sm font-black ${isAnulado ? 'text-red-900 line-through' : 'text-slate-900'}`}>{company.currencySymbol}{it.subtotal.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
    
                                    {/* Item Action: Edit Details */}
                                    {!isAnulado && (
                                        <div className="flex items-center justify-between pt-3 border-t border-slate-200/50">
                                            <button 
                                                onClick={() => setSelectedItemToDetail(it)}
                                                className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors"
                                            >
                                                <PencilLine size={14} /> {it.details || it.itemDeliveryDate ? 'VER / EDITAR DETALLES' : 'CONFIGURAR PRENDA'}
                                            </button>
                                            
                                            {it.details && (
                                                <div className="text-[9px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase truncate max-w-[200px]">
                                                    {it.details}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {adjustmentCart.length === 0 && (
                            <div className="py-20 text-center space-y-4 opacity-30">
                                <Search size={64} className="mx-auto" />
                                <p className="text-xs font-black uppercase tracking-[0.3em]">No hay prendas en la orden</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Financial Summary & Payments */}
                <div className="w-full md:w-[380px] lg:w-[420px] bg-slate-50 border-t md:border-t-0 md:border-l border-slate-100 p-4 sm:p-8 flex flex-col gap-4 sm:gap-6 md:overflow-y-auto custom-scrollbar shadow-[0_-10px_20px_rgba(0,0,0,0.02)] md:shadow-none">
                    
                    {/* Previous Payments */}
                    <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center gap-2 text-slate-400 border-b border-slate-200 pb-1 sm:pb-2">
                            <Wallet size={14} className="sm:w-4 sm:h-4" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Historial de Pagos</span>
                        </div>
                        <div className="space-y-2">
                             {(!selectedInvoice.payments || selectedInvoice.payments.length === 0) && sessionPayments.length === 0 ? (
                                 <p className="text-[10px] font-bold text-slate-300 uppercase text-center py-2 italic font-mono">Sin pagos registrados</p>
                             ) : (
                                 <>
                                    {selectedInvoice.payments?.map((p, idx) => {
                                        const method = paymentMethods.find(m => m.id === p.metodo_pago_id);
                                        return (
                                            <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{method?.name || 'OTRO'}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 italic">{p.date ? formatDateSafe(p.date) : 'ANTERIOR'}</p>
                                                </div>
                                                <p className="text-xs font-black text-slate-900">{company.currencySymbol}{p.monto.toFixed(2)}</p>
                                            </div>
                                        );
                                    })}
                                    {sessionPayments.map((p, idx) => {
                                        const method = paymentMethods.find(m => m.id === p.methodId);
                                        return (
                                            <div key={`session-${idx}`} className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 flex items-center justify-between shadow-sm animate-in fade-in zoom-in duration-300">
                                                <div>
                                                    <div className="flex items-center gap-1">
                                                        <p className="text-[10px] font-black text-emerald-800 uppercase tracking-tight">{method?.name || 'OTRO'}</p>
                                                        <span className="text-[7px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-black uppercase">NUEVO</span>
                                                    </div>
                                                    <p className="text-[8px] font-bold text-emerald-400 italic">POR REGISTRAR</p>
                                                </div>
                                                <p className="text-xs font-black text-emerald-900">{company.currencySymbol}{p.amount.toFixed(2)}</p>
                                            </div>
                                        );
                                    })}
                                 </>
                             )}
                        </div>
                    </div>

                    {/* Financial Totals */}
                    <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white space-y-4 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <DollarSign size={80} />
                        </div>
                        
                        <div className="flex justify-between items-center text-slate-400 border-b border-white/5 pb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest">Total Inicial</span>
                            <span className="text-xs font-bold line-through opacity-60 italic">{company.currencySymbol}{selectedInvoice.totals.total.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest">Monto Actualizado</span>
                            <span className="text-2xl font-black tabular-nums tracking-tighter" style={{ color: primaryColor }}>{company.currencySymbol}{currentAdjustmentTotal.toFixed(2)}</span>
                        </div>

                        <div className={`p-4 rounded-2xl flex items-center justify-between border-2 transition-colors ${
                            adjustmentDifference > 0 
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                                : adjustmentDifference < 0 
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-white/5 border-white/10 text-slate-400'
                        }`}>
                            <div className="flex items-center gap-2">
                                 {adjustmentDifference > 0 ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                                 <span className="text-[9px] font-black uppercase tracking-widest">
                                    {adjustmentDifference > 0 ? 'INCREMENTO (DEUDA)' : adjustmentDifference < 0 ? 'A FAVOR DEL CLIENTE' : 'IGUAL'}
                                 </span>
                            </div>
                            <span className="text-sm font-black tabular-nums">{company.currencySymbol}{Math.abs(adjustmentDifference).toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Financial Processing Options */}
                    {adjustmentDifference !== 0 && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                             <div className="flex items-center gap-2 text-slate-400 px-1">
                                <AlertTriangle size={14} />
                                <span className="text-[9px] font-black uppercase tracking-widest">Gestión de Diferencia</span>
                             </div>
                             
                             {adjustmentDifference < 0 ? (
                                 <div className="grid grid-cols-1 gap-2">
                                     <button 
                                        onClick={() => setProcessType('CREDIT')}
                                        className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-left ${processType === 'CREDIT' ? 'border-indigo-600 bg-indigo-50' : 'border-white bg-white hover:border-slate-200'}`}
                                     >
                                         <div className={`p-2 rounded-xl ${processType === 'CREDIT' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-300'}`}><User size={20} /></div>
                                         <div>
                                            <p className={`text-[10px] font-black uppercase ${processType === 'CREDIT' ? 'text-indigo-900' : 'text-slate-400'}`}>Saldo a Favor</p>
                                            <p className="text-[8px] font-bold text-slate-400">PARA FUTURAS VENTAS</p>
                                         </div>
                                     </button>
                                     <button 
                                        onClick={() => setProcessType('REFUND')}
                                        className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-left ${processType === 'REFUND' ? 'border-red-600 bg-red-50' : 'border-white bg-white hover:border-slate-200'}`}
                                     >
                                         <div className={`p-2 rounded-xl ${processType === 'REFUND' ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-300'}`}><RotateCcw size={20} /></div>
                                         <div>
                                            <p className={`text-[10px] font-black uppercase ${processType === 'REFUND' ? 'text-red-900' : 'text-slate-400'}`}>Devolver Dinero</p>
                                            <p className="text-[8px] font-bold text-slate-400">REGISTRAR COMO EGRESO</p>
                                         </div>
                                     </button>
                                 </div>
                             ) : (
                                 <div className="space-y-3">
                                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                                          <p className="text-[9px] font-bold text-amber-700 leading-tight uppercase tracking-tight">El cliente debe abonar la diferencia. Seleccione método de pago si aplica el cobro en este momento.</p>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                          {paymentMethods.filter(m => m.isActive).map(m => (
                                              <button
                                                  key={m.id}
                                                  onClick={() => setRefundPaymentMethod(refundPaymentMethod === m.id ? '' : m.id)}
                                                  className={`px-3 py-4 rounded-2xl border-2 text-[9px] font-black uppercase transition-all shadow-sm ${refundPaymentMethod === m.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-white text-slate-400 bg-white'}`}
                                              >
                                                  {m.name}
                                              </button>
                                          ))}
                                      </div>
                                 </div>
                             )}

                             {(processType === 'REFUND' && adjustmentDifference < 0) && (
                                 <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
                                      <p className="text-[10px] text-red-500 uppercase font-black px-1 tracking-widest">¿Cómo devuelve el dinero?</p>
                                      <div className="grid grid-cols-2 gap-2">
                                          {paymentMethods.filter(m => m.isActive).map(m => (
                                              <button
                                                  key={m.id}
                                                  onClick={() => setRefundPaymentMethod(m.id)}
                                                  className={`px-3 py-4 rounded-2xl border-2 text-[9px] font-black uppercase transition-all shadow-sm ${refundPaymentMethod === m.id ? 'border-red-600 bg-red-50 text-red-700' : 'border-white text-slate-400 bg-white'}`}
                                              >
                                                  {m.name}
                                              </button>
                                          ))}
                                      </div>
                                 </div>
                             )}
                        </div>
                    )}
                </div>
            </div>

            {/* Final Footer Row */}
            <div className="p-4 sm:p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-3 md:justify-end shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-[10]">
               <button 
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  disabled={isActionLoading}
                  className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-5 bg-slate-100 text-slate-500 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                >
                  CERRAR
                </button>
                <button 
                  onClick={handleConfirmAdjustment}
                  disabled={isActionLoading || (adjustmentCart.length === 0)}
                  style={{ backgroundColor: primaryColor }}
                  className="w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-5 text-white rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all hover:brightness-110 shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95"
                >
                  {isActionLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {isActionLoading ? 'GUARDANDO...' : 'CONFIRMAR CAMBIOS'}
                </button>
            </div>
          </div>

          {/* Custom Confirmation Modal for Anulacion */}
          {itemToAnular && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setItemToAnular(null)} />
                  <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 sm:p-8 relative shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
                      <div className="flex flex-col items-center text-center space-y-4">
                          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                              <Trash2 size={32} />
                          </div>
                          <div>
                              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">¿Anular Prenda?</h3>
                              <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">
                                  Está a punto de anular <span className="font-bold text-slate-900">"{itemToAnular.name}"</span> de esta orden. Esta acción reducirá el total a pagar.
                              </p>
                          </div>
                          <div className="flex flex-col w-full gap-2 pt-2">
                              <button 
                                  onClick={confirmAnularItem}
                                  className="w-full py-4 bg-red-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-95"
                              >
                                  Confirmar Anulación
                              </button>
                              <button 
                                  onClick={() => setItemToAnular(null)}
                                  className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                              >
                                  Cancelar
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* Custom Confirmation Modal for Final Save */}
          {showConfirmAdjustment && selectedInvoice && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowConfirmAdjustment(false)} />
                  <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 sm:p-10 relative shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
                      <div className="flex flex-col items-center text-center space-y-6">
                          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shadow-inner">
                              <Save size={40} />
                          </div>
                          <div className="space-y-2">
                              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">¿Confirmar Ajustes?</h3>
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                  Se actualizarán los ítems y totales de la orden <span className="text-slate-900">{selectedInvoice.ordenNumber}</span>.
                              </p>
                          </div>

                          <div className="w-full bg-slate-50 rounded-3xl p-5 space-y-3 border border-slate-100">
                              <div className="flex justify-between items-center px-1">
                                  <span className="text-[9px] font-black text-slate-400 uppercase">Total Anterior</span>
                                  <span className="text-xs font-bold text-slate-400 line-through">{company.currencySymbol}{selectedInvoice.totals.total.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center px-1">
                                  <span className="text-[9px] font-black text-slate-400 uppercase">Nuevo Total</span>
                                  <span className="text-lg font-black text-slate-900">{company.currencySymbol}{currentAdjustmentTotal.toFixed(2)}</span>
                              </div>
                              <div className={`mt-2 py-2 px-3 rounded-xl text-[9px] font-black uppercase text-center ${adjustmentDifference < 0 ? 'bg-emerald-50 text-emerald-600' : adjustmentDifference > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                  {adjustmentDifference < 0 ? `Variación: -${company.currencySymbol}${Math.abs(adjustmentDifference).toFixed(2)}` : adjustmentDifference > 0 ? `Variación: +${company.currencySymbol}${adjustmentDifference.toFixed(2)}` : 'Sin variaciones'}
                              </div>
                          </div>

                          <div className="flex flex-col w-full gap-3">
                              <button 
                                  onClick={executeAdjustment}
                                  style={{ backgroundColor: primaryColor }}
                                  className="w-full py-5 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                              >
                                  <Check size={18} />
                                  Confirmar y Guardar
                              </button>
                              <button 
                                  onClick={() => setShowConfirmAdjustment(false)}
                                  className="w-full py-5 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                              >
                                  Revisar más
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          )}
        </div>
      )}

      {/* CartItemDetailModal for Viewing/Editing and Adding */}
      {(selectedItemToDetail || isAddingNewItemViaModal) && (
          <CartItemDetailModal 
            isOpen={true}
            onClose={() => { setSelectedItemToDetail(null); setIsAddingNewItemViaModal(false); }}
            itemName={selectedItemToDetail?.name}
            initialDetails={selectedItemToDetail?.details || ''}
            initialImages={selectedItemToDetail?.images || []}
            initialAudio={selectedItemToDetail?.audioNote}
            initialDate={selectedItemToDetail?.itemDeliveryDate}
            onSave={handleUpdateItemDetails}
            globalColors={globalColors}
            paymentMethods={paymentMethods}
            availableProducts={products}
            isAdjustment={true}
          />
      )}

      {/* Success Toast Notification */}
      <AnimatePresence>
          {showSuccessToast && (
              <motion.div 
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-500/20"
              >
                  <div className="bg-white/20 p-1.5 rounded-full">
                      <Check size={18} className="text-white" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap">¡CAMBIOS GUARDADOS EXITOSAMENTE!</span>
              </motion.div>
          )}
      </AnimatePresence>
      </div>
    </div>
  );
};

// Internal Close Icon for help
const X = ({ size, className, onClick }: any) => (
  <svg onClick={onClick} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
);

export default Modificaciones;

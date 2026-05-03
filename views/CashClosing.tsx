
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, Expense, Employee, CashClosing as CashClosingType, Company, UserRole } from '../types';
import { dbGetCashClosings, dbCreateCashClosing, dbUpdateCashClosing } from '../services/dbService';
import { formatDateSafe, formatTimeSafe, formatDateTimeSafe } from '../utils/calculations';
import { 
  Calculator, Printer, Banknote, History, Save, Clock, CheckCircle2, 
  ChevronRight, List, Trash2, Eye, AlertTriangle, Plus, X, ArrowRight, 
  RefreshCw, TrendingUp, CreditCard, TrendingDown, ShieldCheck,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CashClosingProps {
  invoices: Invoice[];
  expenses: Expense[];
  currentUser: Employee | null;
  company: Company;
  canManage?: boolean;
  activeCashSession?: any;
  onSessionClosed?: () => void;
}

const CashClosing: React.FC<CashClosingProps> = ({ 
  invoices, 
  expenses, 
  currentUser, 
  company, 
  canManage = true,
  activeCashSession,
  onSessionClosed
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [openingBalance, setOpeningBalance] = useState(() => 
    activeCashSession ? activeCashSession.openingBalance.toFixed(2) : '0.00'
  );
  const [actualCash, setActualCash] = useState('');
  const [liquidation, setLiquidation] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [activeView, setActiveView] = useState<'CURRENT' | 'HISTORY' | 'PROJECTIONS'>('CURRENT');
  const [closingHistory, setClosingHistory] = useState<CashClosingType[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedMethodPayments, setSelectedMethodPayments] = useState<{ method: string; payments: any[] } | null>(null);
  const [selectedHistoryClosing, setSelectedHistoryClosing] = useState<CashClosingType | null>(null);

  const isHighRole = currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.SAAS_MASTER || currentUser?.role === UserRole.ADMIN;

  const currency = company.currencySymbol || 'S/';
  const currentUserName = (currentUser?.name || localStorage.getItem('sislav_current_user_name') || 'SISTEMA').trim().toUpperCase();

  useEffect(() => {
      loadHistory();
  }, [activeView]);

  const loadHistory = async () => {
      if (activeView !== 'HISTORY') return;
      setIsLoadingHistory(true);
      setErrorMessage(null);
      try {
        const data = await dbGetCashClosings();
        setClosingHistory(data || []);
        if (!data || data.length === 0) {
           console.log("No se encontraron cierres para esta sucursal");
        }
      } catch (err: any) {
        console.error("Error loading history:", err);
        setErrorMessage("No se pudo cargar el historial: " + (err.message || 'Error desconocido'));
      } finally {
        setIsLoadingHistory(false);
      }
  };

  const lastClosingDate = useMemo(() => {
      // Prioridad 1: Fecha de apertura de la sesión activa personalizada para este usuario
      if (activeCashSession?.fechaApertura) {
          return new Date(activeCashSession.fechaApertura);
      }

      // Si no hay sesión activa, buscamos el último cierre de este usuario
      const userLastClosing = closingHistory
        .filter(c => c.cajero === currentUserName)
        .sort((a, b) => new Date(b.fechaCierre).getTime() - new Date(a.fechaCierre).getTime())[0];

      if (userLastClosing) return new Date(userLastClosing.fechaCierre);

      if (closingHistory.length === 0) return new Date();
      const sorted = [...closingHistory].sort((a, b) => new Date(b.fechaCierre).getTime() - new Date(a.fechaCierre).getTime());
      return new Date(sorted[0].fechaCierre);
  }, [closingHistory, activeCashSession, currentUserName]);

  const userProjections = useMemo(() => {
    if (!isHighRole) return [];
    
    const projections: Record<string, { 
        userName: string; 
        totalCash: number; 
        expenses: number; 
        otherMethods: Record<string, number>;
    }> = {};

    invoices.forEach(inv => {
        (inv.payments || []).forEach(p => {
            const pDate = new Date(p.date || inv.date);
            if (pDate >= lastClosingDate) {
                const userName = (p as any).registrado_por?.trim().toUpperCase() || 'SISTEMA';
                if (!projections[userName]) {
                    projections[userName] = { userName, totalCash: 0, expenses: 0, otherMethods: {} };
                }
                const method = (p.metodo_pago_name || 'EFECTIVO').toUpperCase();
                if (method.includes('EFECTIVO')) {
                    projections[userName].totalCash += p.monto || 0;
                } else {
                    projections[userName].otherMethods[method] = (projections[userName].otherMethods[method] || 0) + (p.monto || 0);
                }
            }
        });
    });

    expenses.filter(exp => new Date(exp.date) >= lastClosingDate).forEach(exp => {
        const userName = (exp.usuarioRegistro || '').trim().toUpperCase() || 'SISTEMA';
        const method = (exp.paymentMethod || 'EFECTIVO').toUpperCase();
        if (!projections[userName]) {
            projections[userName] = { userName, totalCash: 0, expenses: 0, otherMethods: {} };
        }
        if (method.includes('EFECTIVO')) {
            projections[userName].expenses += exp.amount || 0;
        }
    });

    return Object.values(projections).sort((a, b) => b.totalCash - a.totalCash);
  }, [invoices, expenses, lastClosingDate, isHighRole]);

  useEffect(() => {
    if (!isHighRole && activeView !== 'CURRENT') {
      setActiveView('CURRENT');
    }
  }, [isHighRole, activeView]);

  const pendingInvoices = useMemo(() => {
    // Para el cierre actual, queremos facturas que tengan PAGOS en el turno
    // Pero para otros fines descriptivos, filtramos facturas creadas desde la apertura
    return invoices.filter(inv => {
        const dateMatch = new Date(inv.date) >= lastClosingDate && inv.type !== '07';
        return dateMatch;
    });
  }, [invoices, lastClosingDate]);

  const pendingExpenses = useMemo(() => {
      const activeUserId = activeCashSession?.usuario_id;
      return expenses.filter(exp => {
          if (activeCashSession?.id && exp.cash_session_id) {
              return exp.cash_session_id === activeCashSession.id;
          }
          const dateMatch = new Date(exp.date) >= lastClosingDate;
          const userMatch = activeUserId 
            ? (exp as any).usuarioId === activeUserId 
            : (exp.usuarioRegistro || '').trim().toUpperCase() === currentUserName;
          return dateMatch && userMatch;
      });
  }, [expenses, lastClosingDate, currentUserName, activeCashSession]);

  const getPaymentIcon = (method: string) => {
    const m = method.toUpperCase();
    if (m.includes('EFECTIVO')) return <Banknote size={18} className="text-emerald-500" />;
    if (m.includes('TARJETA') || m.includes('VISA') || m.includes('MASTERCARD')) return <CreditCard size={18} className="text-blue-500" />;
    if (m.includes('YAPE') || m.includes('PLIN')) return <RefreshCw size={18} className="text-purple-500" />;
    return <Calculator size={18} className="text-gray-500" />;
  };

  const summary = useMemo(() => {
      const methods: Record<string, number> = {};
      const methodDetails: Record<string, any[]> = {};
      let totalCashSales = 0;
      const categoryMap: Record<string, { name: string; quantity: number; amount: number }> = {};
      const activeUserId = activeCashSession?.usuario_id;

      // Iteramos directamente sobre las facturas pero filtramos PAGOS
      invoices.forEach(inv => {
          const userPaymentsAtTurn = (inv.payments || []).filter(p => {
              if (activeCashSession?.id && (p as any).cash_session_id) {
                  return (p as any).cash_session_id === activeCashSession.id;
              }
              const pDate = new Date(p.date || inv.date);
              const dateMatch = pDate >= lastClosingDate;
              let userMatch = false;
              if (activeUserId && (p as any).usuario_id) {
                  userMatch = (p as any).usuario_id === activeUserId;
              } else {
                  userMatch = (p as any).registrado_por?.trim().toUpperCase() === currentUserName;
              }
              return dateMatch && userMatch;
          });

          userPaymentsAtTurn.forEach(p => {
              const method = (p.metodo_pago_name || 'EFECTIVO').toUpperCase();
              const amount = p.monto || 0;
              
              if (method.includes('EFECTIVO')) {
                  totalCashSales += amount;
                  if (!methodDetails['EFECTIVO']) methodDetails['EFECTIVO'] = [];
                  methodDetails['EFECTIVO'].push({
                      ticket: inv.ticketNumber || `${inv.serie}-${inv.correlativo}`,
                      client: inv.client?.name || 'CLIENTE VARIOS',
                      date: p.date || inv.date,
                      amount: amount
                  });
              } else {
                  methods[method] = (methods[method] || 0) + amount;
                  if (!methodDetails[method]) methodDetails[method] = [];
                  methodDetails[method].push({
                      ticket: inv.ticketNumber || `${inv.serie}-${inv.correlativo}`,
                      client: inv.client?.name || 'CLIENTE VARIOS',
                      date: p.date || inv.date,
                      amount: amount
                  });
              }
          });

          // Solo sumar categorías si el usuario tuvo actividad (pagos) en esta factura durante el turno
          if (userPaymentsAtTurn.length > 0) {
              inv.items.forEach(item => {
                  const catName = (item.category || (item as any).categoria_nombre || 'GENERAL').toUpperCase();
                  if (!categoryMap[catName]) {
                      categoryMap[catName] = { name: catName, quantity: 0, amount: 0 };
                  }
                  categoryMap[catName].quantity += Number(item.quantity) || 0;
                  categoryMap[catName].amount += (Number(item.price) * Number(item.quantity)) || 0;
              });
          }
      });

      const topCategories = Object.values(categoryMap).sort((a, b) => b.amount - a.amount);
      
      // SOLO descontar de caja si es EFECTIVO
      const totalCashExpenses = pendingExpenses
          .filter(exp => (exp.paymentMethod || 'EFECTIVO').toUpperCase().includes('EFECTIVO'))
          .reduce((sum, exp) => sum + exp.amount, 0);

      const totalExpenses = pendingExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const open = parseFloat(openingBalance) || 0;
      const expectedCash = open + totalCashSales - totalCashExpenses;
      
      return { 
          methods, 
          methodDetails,
          totalCashSales, 
          totalExpenses, 
          totalCashExpenses,
          opening: open, 
          expectedCash,
          topCategories
      };
  }, [pendingInvoices, pendingExpenses, openingBalance]);

  const handleCloseTurn = async () => {
      const cashCount = parseFloat(actualCash);
      if (isNaN(cashCount) || cashCount < 0) { 
          setErrorMessage("Por favor ingrese un monto válido de efectivo en caja (no negativo)."); 
          return; 
      }
      setErrorMessage(null);
      setIsClosing(true);
      const diff = cashCount - summary.expectedCash;
      
      const allPayments: any[] = [];
      Object.entries(summary.methodDetails).forEach(([methodName, pList]) => {
          pList.forEach(p => {
              allPayments.push({ ...p, methodName });
          });
      });

      const report: CashClosingType = { 
          id: activeCashSession?.id || Date.now().toString(), 
          sucursal_id: company.id,
          cajero: currentUser?.name || UserRole.ADMIN, 
          caja: activeCashSession?.caja || 'CAJA PRINCIPAL', 
          turno: activeCashSession?.turno || `${new Date().getHours() < 14 ? 'MAÑANA' : 'TARDE'} TURNO`, 
          fechaApertura: activeCashSession?.fechaApertura || (lastClosingDate.getTime() === 0 ? new Date().toISOString() : lastClosingDate.toISOString()), 
          fechaCierre: new Date().toISOString(), 
          openingBalance: summary.opening, 
          cashSales: summary.totalCashSales, 
          otherSales: summary.methods, 
          expenses: summary.totalExpenses, 
          cashExpenses: summary.totalCashExpenses,
          expectedCash: summary.expectedCash, 
          actualCash: cashCount, 
          difference: diff, 
          liquidation: parseFloat(liquidation) || 0,
          transactions: allPayments, 
          topCategories: summary.topCategories
      };
      
      try {
          if (activeCashSession?.id) {
              await dbUpdateCashClosing(activeCashSession.id, report);
              if (onSessionClosed) onSessionClosed();
          } else {
              await dbCreateCashClosing(report);
          }
          handlePrint(report);
          await loadHistory();
          setActualCash('');
          setActiveView('HISTORY');
      } catch (e: any) {
          console.error(e);
          setErrorMessage(e?.message || "Error al cerrar caja. Por favor intente nuevamente.");
      } finally {
          setIsClosing(false);
      }
  };

  const handlePrint = (report: CashClosingType) => {
      const logoUrl = company.logoUrl || '';
      
      const content = `
          <html>
          <head>
              <title>CIERRE DE CAJA</title>
              <style>
                  body { font-family: 'Courier New', monospace; font-size: 11px; margin: 0; padding: 5mm; width: 72mm; color: #000; line-height: 1.2; }
                  .text-center { text-align: center; }
                  .text-right { text-align: right; }
                  .bold { font-weight: bold; }
                  .divider { border-top: 1px dashed #000; margin: 5px 0; }
                  .header { margin-bottom: 5px; }
                  .section-title { font-weight: bold; text-decoration: underline; margin-top: 10px; margin-bottom: 5px; text-align: center; font-size: 12px; }
                  .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                  table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                  th { border-bottom: 1px solid #000; text-align: left; font-size: 10px; }
                  td { padding-top: 2px; font-size: 10px; }
                  .logo { max-width: 40mm; max-height: 20mm; margin-bottom: 5px; }
              </style>
          </head>
          <body>
              <div class="text-center header">
                  ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : ''}
                  <div class="bold" style="font-size: 14px;">${company.razonSocial.toUpperCase()}</div>
                  <div style="font-size: 10px;">${company.address.toUpperCase()}</div>
                  <div class="divider"></div>
                  <div class="bold" style="font-size: 13px;">CIERRE DE CAJA</div>
                  <div class="bold" style="font-size: 11px;">${report.turno}</div>
              </div>

              <div class="divider"></div>
              
              <div class="row"><span>CAJERO:</span> <span class="bold">${report.cajero.toUpperCase()}</span></div>
              <div class="row"><span>FECHA:</span> <span>${new Date(report.fechaCierre).toLocaleString()}</span></div>
              
              <div class="section-title">1. RESUMEN DE EFECTIVO</div>
              <div class="row"><span>INICIO DE CAJA:</span> <span>${currency} ${report.openingBalance.toFixed(2)}</span></div>
              <div class="row"><span>COBRANZAS EFECTIVO:</span> <span>+ ${currency} ${report.cashSales.toFixed(2)}</span></div>
              <div class="row"><span>EGRESOS EFECTIVO:</span> <span>- ${currency} ${(report.cashExpenses ?? report.expenses).toFixed(2)}</span></div>
              <div class="divider"></div>
              <div class="row bold"><span>TOTAL EFECTIVO:</span> <span>${currency} ${report.expectedCash.toFixed(2)}</span></div>
              <div class="row bold"><span>EFECTIVO REAL:</span> <span class="bold">${currency} ${report.actualCash.toFixed(2)}</span></div>
              <div class="row"><span>LIQUIDACIÓN:</span> <span>- ${currency} ${(report.liquidation || 0).toFixed(2)}</span></div>
              <div class="divider"></div>
              <div class="row bold"><span>SALDO SIGUIENTE:</span> <span>${currency} ${(report.actualCash - (report.liquidation || 0)).toFixed(2)}</span></div>
              <div class="row"><span>DIFERENCIA:</span> <span class="${report.difference < 0 ? 'bold' : ''}">${currency} ${report.difference.toFixed(2)}</span></div>

              <div class="section-title">2. COBRANZAS POR TIPO</div>
              <div class="row"><span>EFECTIVO:</span> <span>${currency} ${report.cashSales.toFixed(2)}</span></div>
              ${Object.entries(report.otherSales).map(([method, amount]) => `
                  <div class="row"><span>${method.toUpperCase()}:</span> <span>${currency} ${amount.toFixed(2)}</span></div>
              `).join('')}
              <div class="divider"></div>
              <div class="row bold"><span>TOTAL RECAUDADO:</span> <span>${currency} ${(report.cashSales + Object.values(report.otherSales).reduce((a, b) => a + b, 0)).toFixed(2)}</span></div>

              ${report.topCategories && report.topCategories.length > 0 ? `
                  <div class="divider"></div>
              ` : ''}

              <div class="divider"></div>
              <div class="text-center" style="margin-top: 15px;">
                  <div class="divider"></div>
                  <div style="margin-top: 30px;">_____________________</div>
                  <div class="bold">FIRMA CAJERO</div>
                  <div style="font-size: 9px; margin-top: 5px;">${new Date().toLocaleString()}</div>
              </div>

              <script>
                  window.onload = function() { 
                      window.print(); 
                      setTimeout(() => window.close(), 500); 
                  };
              </script>
          </body>
          </html>
      `;
      const printWindow = window.open('', '_blank');
      if (printWindow) { 
          printWindow.document.write(content); 
          printWindow.document.close(); 
      }
  };

  return (
    <div className="p-2 lg:p-6 h-full overflow-y-auto bg-[#f8fafc] relative">
      <div className="max-w-4xl mx-auto space-y-6 relative">
        {/* Subtle Floating Clock */}
        <div className="absolute -top-1 right-0 flex flex-col items-end opacity-40 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1.5 bg-slate-200/50 backdrop-blur-sm text-slate-500 px-3 py-1.5 rounded-xl border border-slate-300/30">
                <Clock size={12} className="text-slate-400" />
                <span className="text-[11px] font-bold font-mono">
                    {currentTime.toLocaleTimeString('es-PE', { hour12: false })}
                </span>
            </div>
            <p className="text-[6px] font-bold text-slate-300 uppercase tracking-[0.3em] mt-1 mr-1">Hora Sistema</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 overflow-x-auto no-scrollbar">
           <button 
              onClick={() => setActiveView('CURRENT')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeView === 'CURRENT' ? 'bg-[#0054A6] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
              style={{ backgroundColor: activeView === 'CURRENT' ? (company.primaryColor || '#0054A6') : undefined }}
           >
             <Calculator size={18} />
             <span>CIERRE ACTUAL</span>
           </button>
           {isHighRole && (
            <button 
                onClick={() => setActiveView('PROJECTIONS')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeView === 'PROJECTIONS' ? 'bg-[#0054A6] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                style={{ backgroundColor: activeView === 'PROJECTIONS' ? (company.primaryColor || '#0054A6') : undefined }}
            >
                <Users size={18} />
                <span>PROYECCIÓN POR USUARIO</span>
            </button>
           )}
           {isHighRole && (
            <button 
                onClick={() => setActiveView('HISTORY')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${activeView === 'HISTORY' ? 'bg-[#0054A6] text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                style={{ backgroundColor: activeView === 'HISTORY' ? (company.primaryColor || '#0054A6') : undefined }}
            >
                <History size={18} />
                <span>HISTORIAL</span>
            </button>
           )}
        </div>

        <AnimatePresence mode="wait">
          {activeView === 'CURRENT' ? (
            <motion.div 
              key="current"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Main Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-5 rotate-12">
                    <TrendingUp size={120} />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Efectivo Esperado</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-4xl font-black font-manrope tracking-tight" style={{ color: company.primaryColor || '#0054A6' }}>
                            {currency} {summary.expectedCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </h2>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock size={12} className="text-indigo-500" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Iniciado el</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-600">
                                {activeCashSession 
                                    ? formatDateTimeSafe(activeCashSession.fecha_apertura || activeCashSession.fechaApertura)
                                    : formatDateTimeSafe(lastClosingDate.toISOString())
                                }
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users size={12} className="text-indigo-500" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Responsable</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-600 truncate max-w-[120px] text-right uppercase">
                                {activeCashSession 
                                    ? (activeCashSession.registrado_por || activeCashSession.cajero || 'SISTEMA')
                                    : currentUserName
                                }
                            </span>
                        </div>
                        {activeCashSession && (
                            <div className="mt-1 flex justify-start">
                                <span className="bg-green-100 text-green-700 text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                    Caja Abierta
                                </span>
                            </div>
                        )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-gray-400 bg-gray-50/50 p-2 rounded-lg">
                    <InfoIcon size={14} />
                    <span className="leading-tight">Incluye saldo inicial + ventas efectivo - egresos efectivo</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Recaudado Hoy</p>
                  <h2 className="text-4xl font-black font-manrope tracking-tight text-slate-800 mb-2">
                    {currency} {(summary.totalCashSales + Object.values(summary.methods).reduce((a, b) => a + b, 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </h2>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span>Todas las formas de pago registradas</span>
                  </div>
                </div>
              </div>

              {/* Income Breakdown & Expenses */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Cobranzas Segmentadas */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <List size={20} className="text-[#0054A6]" style={{ color: company.primaryColor || '#0054A6' }} />
                      Cobranzas por Tipo
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {/* Efectivo row */}
                    <div 
                      onClick={() => summary.totalCashSales > 0 && setSelectedMethodPayments({ method: 'EFECTIVO', payments: summary.methodDetails['EFECTIVO'] || [] })}
                      className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-sm transition-all hover:scale-[1.01] cursor-pointer group"
                    >
                       <div className="flex items-center gap-3">
                          <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600 shadow-sm group-hover:bg-emerald-200 transition-colors">
                             <Banknote size={24} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-700 uppercase tracking-tight">EFECTIVO</span>
                            <span className="text-[8px] font-black text-emerald-600/60 uppercase tracking-widest">Click para ver detalle</span>
                          </div>
                       </div>
                       <span className="font-black text-2xl text-emerald-600">{currency} {summary.totalCashSales.toFixed(2)}</span>
                    </div>

                    {/* Other methods */}
                    {Object.entries(summary.methods).map(([method, amount]) => (
                      <div 
                        key={method} 
                        onClick={() => setSelectedMethodPayments({ method, payments: summary.methodDetails[method] || [] })}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-slate-100/50 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2.5 rounded-xl text-slate-600 shadow-sm border border-slate-100 group-hover:border-slate-300 transition-colors">
                             {getPaymentIcon(method)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-sm text-slate-600 uppercase tracking-tight">{method}</span>
                            <span className="text-[8px] font-black text-slate-400/60 uppercase tracking-widest">Click para ver detalle</span>
                          </div>
                        </div>
                        <span className="font-black text-lg text-slate-800">{currency} {amount.toFixed(2)}</span>
                      </div>
                    ))}
                    {Object.keys(summary.methods).length === 0 && summary.totalCashSales === 0 && (
                      <div className="text-center py-8">
                         <p className="text-gray-400 text-xs italic font-medium">Sin cobranzas registradas</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Egresos */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <TrendingDown size={20} className="text-rose-500" />
                      Egresos Registrados
                    </h3>
                    <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">-{currency} {summary.totalCashExpenses.toFixed(2)}</span>
                  </div>

                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {pendingExpenses.map((exp, idx) => {
                      const isCash = (exp.paymentMethod || 'EFECTIVO').toUpperCase().includes('EFECTIVO');
                      return (
                        <div key={idx} className="flex justify-between items-center bg-gray-50/50 p-3 rounded-xl border border-gray-100 transition-colors hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                             <div className={`text-[10px] p-1 rounded font-bold uppercase tracking-tight ${isCash ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                {exp.category.substring(0, 3)}
                             </div>
                             <div>
                                <p className="font-bold text-xs text-gray-700">{exp.description}</p>
                                <div className="flex items-center gap-1.5">
                                    <p className="text-[9px] text-gray-400 font-bold uppercase">Categoría: {exp.category} • {exp.paymentMethod || 'EFECTIVO'}</p>
                                    {!isCash && (
                                        <span className="text-[8px] bg-amber-100 text-amber-600 px-1 rounded font-bold uppercase">Informativo</span>
                                    )}
                                </div>
                             </div>
                          </div>
                          <span className={`font-bold text-sm ${isCash ? 'text-rose-600' : 'text-slate-400'}`}>
                            {isCash ? '-' : ''}{currency} {exp.amount.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                    {pendingExpenses.length === 0 && (
                      <div className="text-center py-6">
                        <p className="text-gray-400 text-xs italic font-medium">Sin egresos en este turno</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Section */}
              <div className="bg-white p-6 lg:p-8 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 text-white shadow-xl animate-pulse" style={{ backgroundColor: company.primaryColor || '#0054A6' }}>
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-2xl font-black font-manrope text-slate-800 mb-2">Finalizar Jornada</h3>
                <p className="text-gray-500 text-sm max-w-sm text-center mb-8">
                  Verifique que el efectivo real en caja coincida con el reporte antes de confirmar el cierre definitivo.
                </p>

                <div className="w-full max-md:px-2">
                   <AnimatePresence>
                      {errorMessage && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0, y: -10 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -10 }}
                          className="mb-4 overflow-hidden"
                        >
                          <div 
                            className="p-4 rounded-xl border flex items-start gap-3 shadow-sm bg-white"
                            style={{ borderColor: (company.primaryColor || '#0054A6') + '40' }}
                          >
                            <div 
                              className="p-2 rounded-lg"
                              style={{ backgroundColor: (company.primaryColor || '#0054A6') + '15' }}
                            >
                              <AlertTriangle size={20} style={{ color: company.primaryColor || '#0054A6' }} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-gray-800 leading-tight">ATENCIÓN</p>
                              <p className="text-xs font-semibold text-gray-600 mt-1">{errorMessage}</p>
                            </div>
                            <button 
                              onClick={() => setErrorMessage(null)}
                              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <X size={16} className="text-gray-400" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                   </AnimatePresence>
                </div>

                <div className="w-full max-w-md space-y-5">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Efectivo Real en Caja</label>
                     <div className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-400">{currency}</div>
                        <input 
                           type="number"
                           value={actualCash}
                           onChange={e => setActualCash(e.target.value)}
                           className="w-full pl-14 pr-6 py-6 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 outline-none font-black text-4xl transition-all shadow-inner text-slate-800"
                           placeholder="0.00"
                        />
                     </div>
                   </div>

                   {(company as any).cash_management_type === 'ACCUMULATIVE' && (
                     <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Monto a Liquidar (Entrega al dueño)</label>
                       <div className="relative">
                          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-400">{currency}</div>
                          <input 
                             type="number"
                             value={liquidation}
                             onChange={e => setLiquidation(e.target.value)}
                             className="w-full pl-14 pr-6 py-6 bg-emerald-50 border-2 border-emerald-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-emerald-100 outline-none font-black text-4xl transition-all shadow-inner text-emerald-800"
                             placeholder="0.00"
                          />
                       </div>
                       <p className="text-[10px] font-bold text-gray-400 px-2 italic">
                         El saldo restante ({currency} {Math.max(0, (parseFloat(actualCash) || 0) - (parseFloat(liquidation) || 0)).toFixed(2)}) se mantendrá como inicio para la próxima caja.
                       </p>
                     </div>
                   )}

                   <div className="flex gap-4">
                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Saldo Inicial</label>
                        <div className="w-full px-4 py-3 bg-gray-100 rounded-xl font-bold text-sm text-gray-500">
                           {currency} {parseFloat(openingBalance).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Total Movimiento</label>
                        <div className="w-full px-4 py-3 bg-gray-100 rounded-xl font-bold text-sm text-gray-500">{currency} {(summary.totalCashSales - summary.totalExpenses).toFixed(2)}</div>
                      </div>
                   </div>

                   {canManage && (
                     <button 
                       onClick={handleCloseTurn}
                       disabled={isClosing || actualCash === ''}
                       className="w-full py-5 rounded-2xl font-black text-lg text-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:grayscale disabled:opacity-50"
                       style={{ backgroundColor: company.primaryColor || '#0054A6', boxShadow: `0 20px 40px -10px ${company.primaryColor}40` }}
                     >
                       {isClosing ? <RefreshCw className="animate-spin" size={24} /> : (
                         <>
                           <span>CONFIRMAR CIERRE Y IMPRIMIR</span>
                           <Printer size={22} />
                         </>
                       )}
                     </button>
                   )}
                </div>
              </div>
            </motion.div>
          ) : activeView === 'PROJECTIONS' && isHighRole ? (
            <motion.div
                key="projections"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="space-y-6"
            >
                <div className="flex items-center justify-between px-2">
                    <h3 className="font-black text-slate-800 text-xl">Proyección de Cierre por Usuario</h3>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">{new Date(lastClosingDate).toLocaleDateString()} - HOY</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userProjections.map(proj => {
                        const expected = proj.totalCash - proj.expenses;
                        return (
                            <div key={proj.userName} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4 hover:border-blue-200 transition-all">
                                <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                                        {proj.userName.substring(0, 2)}
                                    </div>
                                    <div>
                                        <p className="font-black text-sm text-slate-800 uppercase">{proj.userName}</p>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Movimientos del Turno</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50">
                                        <span className="text-[10px] font-bold text-emerald-800 uppercase">Efectivo en Mano</span>
                                        <span className="font-black text-emerald-600 text-lg">{currency} {expected.toFixed(2)}</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                                            <p className="text-[8px] font-bold text-gray-400 uppercase mb-0.5">Ventas Efec.</p>
                                            <p className="font-bold text-xs text-slate-700">{currency} {proj.totalCash.toFixed(2)}</p>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                                            <p className="text-[8px] font-bold text-gray-400 uppercase mb-0.5">Gasto Efec.</p>
                                            <p className="font-bold text-xs text-rose-600">-{currency} {proj.expenses.toFixed(2)}</p>
                                        </div>
                                    </div>

                                    {Object.entries(proj.otherMethods).length > 0 && (
                                        <div className="pt-2 border-t border-gray-50 flex flex-wrap gap-1.5">
                                            {Object.entries(proj.otherMethods).map(([m, a]) => (
                                                <div key={m} className="bg-slate-50 text-slate-600 border border-slate-100 px-2 py-1 rounded-lg text-[9px] font-bold">
                                                    {m}: {currency}{a.toFixed(2)}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {invoices.length === 0 && expenses.length === 0 && (
                        <div className="col-span-full py-12 text-center bg-white rounded-2xl border-2 border-dashed border-gray-100">
                            <p className="text-gray-400 font-bold italic">No hay movimientos registrados para proyectar.</p>
                        </div>
                    )}
                </div>
            </motion.div>
          ) : activeView === 'HISTORY' && isHighRole ? (
            <motion.div 
               key="history"
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.02 }}
               className="space-y-6"
            >
                <div className="flex items-center justify-between px-2">
                 <div className="flex items-center gap-3">
                   <h3 className="font-black text-slate-800 text-xl">Cierres Anteriores</h3>
                   <button 
                     onClick={loadHistory}
                     className="p-2 text-slate-400 hover:text-slate-900 transition-colors bg-white rounded-lg border border-slate-100 shadow-sm disabled:opacity-50"
                     title="Refrescar Historial"
                     disabled={isLoadingHistory}
                   >
                     <RefreshCw size={14} className={isLoadingHistory ? "animate-spin" : ""} />
                   </button>
                 </div>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-full flex items-center gap-2">
                    <History size={12} /> Orden: Más reciente primero
                 </span>
               </div>
               
               <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative">
                  {isLoadingHistory && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                       <RefreshCw className="animate-spin text-blue-600" size={32} />
                    </div>
                  )}

                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-separate border-spacing-0 min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] border-b border-slate-100">Fecha y Hora</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] border-b border-slate-100">Turno / Cajero</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] border-b border-slate-100 text-right">Efectivo Real</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] border-b border-slate-100 text-right">Liquidado</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] border-b border-slate-100 text-right">Diferencia</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] border-b border-slate-100 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...closingHistory]
                          .sort((a, b) => new Date(b.fechaCierre).getTime() - new Date(a.fechaCierre).getTime())
                          .map((report) => (
                            <tr key={report.id} className="hover:bg-slate-50/80 transition-colors group">
                              <td className="px-6 py-5">
                                <div className="flex flex-col gap-1">
                                  <span className="font-black text-slate-700 uppercase tracking-tight text-xs">
                                    {new Date(report.fechaCierre).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Clock size={10} className="text-[#0054A6]" style={{ color: company.primaryColor }} />
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                      {new Date(report.fechaCierre).toLocaleTimeString('es-PE', { hour12: false })}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col">
                                   <span className="text-xs font-black text-slate-600 uppercase tracking-tight">{report.cajero}</span>
                                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                      {report.turno.includes('MAÑANA') && !report.turno.includes('TURNO') ? `${report.turno} TURNO` : report.turno}
                                   </span>
                                </div>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <span className="text-sm font-black text-slate-900 tabular-nums">
                                  {currency} {report.actualCash.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <span className={`text-xs font-bold tabular-nums ${(report.liquidation || 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                  {currency} {(report.liquidation || 0).toFixed(2)}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <div className="inline-flex flex-col items-end">
                                  <span className={`text-sm font-black tabular-nums ${report.difference >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {report.difference >= 0 ? '+' : ''}{currency} {report.difference.toFixed(2)}
                                  </span>
                                  <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest opacity-60">
                                    {report.difference >= 0 ? 'Sobrante' : 'Faltante'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex justify-center gap-2">
                                  <button 
                                      onClick={() => setSelectedHistoryClosing(report)}
                                      className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-90"
                                      title="Ver Detalle"
                                  >
                                    <Eye size={18} />
                                  </button>
                                  <button 
                                      onClick={() => handlePrint(report)}
                                      className="p-3 bg-slate-100 rounded-xl text-slate-500 hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-90"
                                      title="Reimprimir Cierre"
                                  >
                                    <Printer size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {closingHistory.length === 0 && (
                    <div className="bg-white p-20 text-center flex flex-col items-center gap-4">
                       <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-200 border-2 border-dashed border-slate-100">
                          <History size={40} />
                       </div>
                       <div>
                          <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Historial Vacío</p>
                          <p className="text-[10px] text-slate-300 font-bold mt-1 uppercase tracking-tighter">No se han realizado cierres de caja todavía.</p>
                       </div>
                    </div>
                  )}
               </div>
            </motion.div>
          ) : (
            <div className="bg-white p-12 rounded-2xl text-center border shadow-sm">
                <ShieldCheck size={48} className="mx-auto text-gray-200 mb-4" />
                <p className="text-gray-500 font-bold">Esta sección solo está disponible para Administradores.</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal Detalle de Cobros (Formas de Pago Específicas) */}
      <AnimatePresence>
        {selectedMethodPayments && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMethodPayments(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            ></motion.div>
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/20"
            >
              {/* Header Modal */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0" style={{ backgroundColor: (company.primaryColor || '#0054A6') + '08' }}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-3xl flex items-center justify-center shadow-inner" style={{ backgroundColor: (company.primaryColor || '#0054A6') + '15', color: (company.primaryColor || '#0054A6') }}>
                    {getPaymentIcon(selectedMethodPayments.method)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Detalles de Cobro</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">MÉTODO: {selectedMethodPayments.method}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedMethodPayments(null)}
                  className="p-4 hover:bg-white rounded-2xl transition-all active:scale-90 border border-transparent hover:border-slate-100 hover:shadow-xl text-slate-400 hover:text-slate-900"
                >
                  <X size={28} />
                </button>
              </div>

              {/* Body Modal - Lista de Pagos */}
              <div className="p-8 overflow-y-auto flex-1 space-y-4">
                {selectedMethodPayments.payments.length > 0 ? (
                  <div className="space-y-4">
                    {selectedMethodPayments.payments.map((p, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-slate-50 border border-slate-100 p-5 rounded-[1.5rem] flex items-center justify-between hover:border-slate-300 transition-all group"
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-3">
                            <span className="font-black text-slate-900 uppercase tracking-tighter text-sm bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                              {p.ticket}
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Clock size={12} className="text-blue-500" />
                              {new Date(p.date || Date.now()).toLocaleTimeString('es-PE', { hour12: false })}
                            </span>
                          </div>
                          <p className="font-black text-slate-600 text-sm uppercase tracking-tight truncate max-w-[250px]">{p.client}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{new Date(p.date || Date.now()).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pagado</p>
                          <span className="text-xl font-black text-slate-900 block group-hover:scale-110 transition-transform">{currency} {p.amount.toFixed(2)}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                    <AlertTriangle size={64} className="mb-4 text-slate-300" />
                    <p className="font-black text-slate-400 uppercase tracking-widest">No hay pagos registrados para este método</p>
                  </div>
                )}
              </div>

              {/* Footer Modal */}
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total en {selectedMethodPayments.method}</span>
                  <span className="text-2xl font-black text-slate-950">
                    {currency} {selectedMethodPayments.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                  </span>
                </div>
                <button 
                  onClick={() => setSelectedMethodPayments(null)}
                  className="px-10 h-14 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] shadow-xl active:scale-95 transition-all hover:bg-black group flex items-center justify-center gap-4"
                >
                  Cerrar Detalle <CheckCircle2 size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Detalle Historial (Resumen de tickets y clientes del cierre) */}
      <AnimatePresence>
        {selectedHistoryClosing && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedHistoryClosing(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            ></motion.div>
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/20"
            >
              {/* Header Modal */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0" style={{ backgroundColor: (company.primaryColor || '#0054A6') + '08' }}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-3xl flex items-center justify-center shadow-inner text-white shadow-lg" style={{ backgroundColor: company.primaryColor || '#0054A6' }}>
                    <ShieldCheck size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Resumen del Turno</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">CAJERO: {selectedHistoryClosing.cajero}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedHistoryClosing(null)}
                  className="p-4 hover:bg-white rounded-2xl transition-all active:scale-90 border border-transparent hover:border-slate-100 hover:shadow-xl text-slate-400 hover:text-slate-900"
                >
                  <X size={28} />
                </button>
              </div>

              {/* Body Modal */}
              <div className="p-8 overflow-y-auto flex-1 space-y-8">
                {/* Stats Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Caja Real</p>
                      <p className="text-xl font-black text-emerald-700">{currency} {selectedHistoryClosing.actualCash.toFixed(2)}</p>
                   </div>
                   <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Efecto Ventas</p>
                      <p className="text-xl font-black text-slate-700">{currency} {selectedHistoryClosing.cashSales.toFixed(2)}</p>
                   </div>
                   <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                      <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Egresos</p>
                      <p className="text-xl font-black text-rose-700">-{currency} {selectedHistoryClosing.expenses.toFixed(2)}</p>
                   </div>
                   <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Diferencia</p>
                      <p className={`text-xl font-black ${selectedHistoryClosing.difference >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
                        {selectedHistoryClosing.difference >= 0 ? '+' : ''}{currency} {selectedHistoryClosing.difference.toFixed(2)}
                      </p>
                   </div>
                </div>

                {/* List of Payments */}
                <div className="space-y-4">
                   <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <List size={16} className="text-[#0054A6]" style={{ color: company.primaryColor }} />
                      Ventas Detalladas del Turno
                   </h4>
                   
                   {selectedHistoryClosing.transactions && selectedHistoryClosing.transactions.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                         {selectedHistoryClosing.transactions.map((t: any, idx: number) => (
                            <div key={idx} className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between hover:bg-slate-50 transition-colors shadow-sm">
                               <div className="flex items-center gap-4">
                                  <div className="p-2 bg-slate-100 rounded-xl text-slate-500">
                                     {getPaymentIcon(t.methodName || 'EFECTIVO')}
                                  </div>
                                  <div>
                                     <div className="flex items-center gap-2">
                                        <span className="font-black text-xs text-slate-900">{t.ticket}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.methodName || 'EFECTIVO'}</span>
                                     </div>
                                     <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight truncate max-w-[200px]">{t.client}</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <span className="font-black text-slate-900">{currency} {t.amount.toFixed(2)}</span>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase">{formatTimeSafe(t.date)}</p>
                               </div>
                            </div>
                         ))}
                      </div>
                   ) : (
                      <div className="text-center py-10 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                         <p className="text-slate-400 text-xs italic font-medium">No hay transacciones detalladas guardadas en este cierre.</p>
                         <p className="text-[9px] text-slate-300 font-bold uppercase mt-1">Los cierres antiguos podrían no mostrar este detalle.</p>
                      </div>
                   )}
                </div>
              </div>

              {/* Footer Modal */}
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
                <button 
                  onClick={() => setSelectedHistoryClosing(null)}
                  className="px-10 h-14 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] shadow-xl active:scale-95 transition-all hover:bg-black group flex items-center justify-center gap-4"
                >
                  Cerrar Historial <CheckCircle2 size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InfoIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

export default CashClosing;

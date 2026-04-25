
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, Expense, Employee, CashClosing as CashClosingType, Company, UserRole } from '../types';
import { dbGetCashClosings, dbCreateCashClosing, dbUpdateCashClosing } from '../services/dbService';
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
  const [openingBalance, setOpeningBalance] = useState(() => 
    activeCashSession ? activeCashSession.openingBalance.toFixed(2) : '0.00'
  );
  const [actualCash, setActualCash] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [activeView, setActiveView] = useState<'CURRENT' | 'HISTORY' | 'PROJECTIONS'>('CURRENT');
  const [closingHistory, setClosingHistory] = useState<CashClosingType[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isHighRole = currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.SAAS_MASTER;

  const currency = company.currencySymbol || 'S/';
  const currentUserName = (currentUser?.name || localStorage.getItem('sislav_current_user_name') || 'SISTEMA').trim().toUpperCase();

  useEffect(() => {
      loadHistory();
  }, []);

  const loadHistory = async () => {
      const data = await dbGetCashClosings();
      setClosingHistory(data);
  };

  const lastClosingDate = useMemo(() => {
      // Prioridad 1: Fecha de apertura de la sesión activa personalizada para este usuario
      if (activeCashSession?.fechaApertura) {
          return new Date(activeCashSession.fechaApertura);
      }

      if (closingHistory.length === 0) return new Date(0);
      // Ensure we sort by date to get the most recent one
      const sorted = [...closingHistory].sort((a, b) => new Date(b.fechaCierre).getTime() - new Date(a.fechaCierre).getTime());
      return new Date(sorted[0].fechaCierre);
  }, [closingHistory]);

  const userProjections = useMemo(() => {
    if (!isHighRole) return [];
    
    const projections: Record<string, { 
        userName: string; 
        totalCash: number; 
        expenses: number; 
        otherMethods: Record<string, number>;
    }> = {};

    invoices.filter(inv => new Date(inv.date) >= lastClosingDate).forEach(inv => {
        (inv.payments || []).forEach(p => {
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
      return invoices.filter(inv => {
          const dateMatch = new Date(inv.date) >= lastClosingDate && inv.type !== '07';
          // Si no hay sesión activa o es admin, tal vez vemos todo? 
          // El usuario dice: "cada trabajador ... se calcula dentro de su usuario".
          // Así que filtramos estrictamente.
          return dateMatch;
      });
  }, [invoices, lastClosingDate]);

  const pendingExpenses = useMemo(() => {
      const activeUserId = activeCashSession?.usuario_id;
      return expenses.filter(exp => {
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
      let totalCashSales = 0;
      
      const categoryMap: Record<string, { name: string; quantity: number; amount: number }> = {};

      const activeUserId = activeCashSession?.usuario_id;

      pendingInvoices.forEach(inv => {
          // Process Payments for accurate segmented collection
          // FILTRAR PAGOS POR USUARIO (Priorizando ID para ventas compartidas)
          const userPayments = (inv.payments || []).filter(p => {
              if (activeUserId && (p as any).usuario_id) {
                  return (p as any).usuario_id === activeUserId;
              }
              return (p as any).registrado_por?.trim().toUpperCase() === currentUserName;
          });

          if (userPayments.length > 0) {
              userPayments.forEach(p => {
                  const method = (p.metodo_pago_name || 'EFECTIVO').toUpperCase();
                  const amount = p.monto || 0;
                  if (method.includes('EFECTIVO')) totalCashSales += amount;
                  else methods[method] = (methods[method] || 0) + amount;
              });
          } else if (inv.payments && inv.payments.length > 0) {
              // Tiene pagos pero ninguno es del usuario actual -> skip
          } else {
              // Fallback if no detailed payments (only if user created the invoice)
              const createdBy = (inv as any).registrado_por || (inv as any).user || '';
              if (createdBy.trim().toUpperCase() === currentUserName) {
                  const paid = inv.prePaymentAmount || 0;
                  const method = (inv.paymentMethod || 'EFECTIVO').toUpperCase();
                  if (method.includes('EFECTIVO')) totalCashSales += paid;
                  else methods[method] = (methods[method] || 0) + paid;
              }
          }

          // Process Categories (Solo si el usuario registró algo en esta factura)
          const involved = (inv.payments || []).some(p => {
              if (activeUserId && (p as any).usuario_id) {
                  return (p as any).usuario_id === activeUserId;
              }
              return (p as any).registrado_por?.trim().toUpperCase() === currentUserName;
          }) || (activeUserId && (inv as any).usuario_id === activeUserId) ||
          ((inv as any).registrado_por || '').trim().toUpperCase() === currentUserName;
          
          if (involved) {
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

      const totalExpenses = pendingExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const open = parseFloat(openingBalance) || 0;
      const expectedCash = open + totalCashSales - totalExpenses;
      
      return { 
          methods, 
          totalCashSales, 
          totalExpenses, 
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
      
      const report: CashClosingType = { 
          id: activeCashSession?.id || Date.now().toString(), 
          sucursal_id: company.id,
          cajero: currentUser?.name || UserRole.ADMIN, 
          caja: activeCashSession?.caja || 'CAJA PRINCIPAL', 
          turno: activeCashSession?.turno || `TURNO ${new Date().getHours() < 14 ? 'MAÑANA' : 'TARDE'}`, 
          fechaApertura: activeCashSession?.fechaApertura || (lastClosingDate.getTime() === 0 ? new Date().toISOString() : lastClosingDate.toISOString()), 
          fechaCierre: new Date().toISOString(), 
          openingBalance: summary.opening, 
          cashSales: summary.totalCashSales, 
          otherSales: summary.methods, 
          expenses: summary.totalExpenses, 
          expectedCash: summary.expectedCash, 
          actualCash: cashCount, 
          difference: diff, 
          transactions: [], 
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
              <div class="row"><span>EGRESOS:</span> <span>- ${currency} ${report.expenses.toFixed(2)}</span></div>
              <div class="divider"></div>
              <div class="row bold"><span>TOTAL EFECTIVO:</span> <span>${currency} ${report.expectedCash.toFixed(2)}</span></div>
              <div class="row bold"><span>EFECTIVO REAL:</span> <span>${currency} ${report.actualCash.toFixed(2)}</span></div>
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
    <div className="p-2 lg:p-6 h-full overflow-y-auto bg-[#f8fafc]">
      <div className="max-w-4xl mx-auto space-y-6">
        
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
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Efectivo Esperado</p>
                  <h2 className="text-4xl font-black font-manrope tracking-tight mb-2" style={{ color: company.primaryColor || '#0054A6' }}>
                    {currency} {summary.expectedCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </h2>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <InfoIcon size={14} />
                    <span>Incluye saldo inicial + ventas efectivo - egresos</span>
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
                    <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-sm transition-all hover:scale-[1.01]">
                       <div className="flex items-center gap-3">
                          <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600 shadow-sm">
                             <Banknote size={24} />
                          </div>
                          <span className="font-black text-slate-700 uppercase tracking-tight">EFECTIVO</span>
                       </div>
                       <span className="font-black text-2xl text-emerald-600">{currency} {summary.totalCashSales.toFixed(2)}</span>
                    </div>

                    {/* Other methods */}
                    {Object.entries(summary.methods).map(([method, amount]) => (
                      <div key={method} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-slate-100/50">
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2.5 rounded-xl text-slate-600 shadow-sm border border-slate-100">
                             {getPaymentIcon(method)}
                          </div>
                          <span className="font-black text-sm text-slate-600 uppercase tracking-tight">{method}</span>
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
                    <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">-{currency} {summary.totalExpenses.toFixed(2)}</span>
                  </div>

                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {pendingExpenses.map((exp, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-50/50 p-3 rounded-xl border border-gray-100 transition-colors hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                           <div className="text-[10px] bg-rose-100 text-rose-600 p-1 rounded font-bold uppercase tracking-tight">{exp.category.substring(0, 3)}</div>
                           <div>
                              <p className="font-bold text-xs text-gray-700">{exp.description}</p>
                              <p className="text-[9px] text-gray-400 font-bold uppercase">Categoría: {exp.category} • {exp.paymentMethod || 'EFECTIVO'}</p>
                           </div>
                        </div>
                        <span className="font-bold text-rose-600 text-sm">-{currency} {exp.amount.toFixed(2)}</span>
                      </div>
                    ))}
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

                   <div className="flex gap-4">
                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Saldo Inicial</label>
                        <input 
                           type="number"
                           value={openingBalance}
                           onChange={e => setOpeningBalance(e.target.value)}
                           className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none font-bold text-sm text-gray-600 focus:bg-white"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Total Movimiento</label>
                        <div className="w-full px-4 py-3 bg-gray-100 rounded-xl font-bold text-sm text-gray-500">{currency} {(summary.totalCashSales - summary.totalExpenses).toFixed(2)}</div>
                      </div>
                   </div>

                   {canManage && (
                     <button 
                       onClick={handleCloseTurn}
                       disabled={isClosing || pendingInvoices.length === 0}
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
               className="space-y-4"
            >
               <h3 className="font-black text-slate-800 text-xl px-2">Cierres Anteriores</h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {closingHistory.map((report) => (
                    <div key={report.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between group transition-all hover:shadow-md">
                       <div className="flex justify-between items-start mb-4">
                          <div>
                             <p className="font-black text-sm text-slate-700">{new Date(report.fechaCierre).toLocaleDateString()} - {report.turno}</p>
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Atendido por: {report.cajero}</p>
                          </div>
                          <button 
                             onClick={() => handlePrint(report)}
                             className="p-3 bg-gray-50 rounded-xl text-[#0054A6] hover:bg-[#0054A6] hover:text-white transition-all shadow-sm"
                             style={{ '--hover-bg': company.primaryColor || '#0054A6' } as any}
                          >
                            <Printer size={18} />
                          </button>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4 py-3 border-t border-gray-50 border-b mb-4">
                          <div>
                             <p className="text-[9px] font-bold text-gray-400 uppercase">Efectivo Real</p>
                             <p className="font-black text-xl text-slate-800">{currency} {report.actualCash.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-[9px] font-bold text-gray-400 uppercase">Diferencia</p>
                             <p className={`font-black text-xl ${report.difference >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                               {report.difference >= 0 ? '+' : ''}{report.difference.toFixed(2)}
                             </p>
                          </div>
                       </div>

                       <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            className="text-[10px] font-black text-[#0054A6] flex items-center gap-1 uppercase"
                            style={{ color: company.primaryColor || '#0054A6' }}
                          >
                             Ver Detalle Completo <ArrowRight size={10} />
                          </button>
                       </div>
                    </div>
                  ))}
                  {closingHistory.length === 0 && (
                    <div className="col-span-full bg-white p-12 rounded-2xl text-center border-2 border-dashed border-gray-100">
                       <History size={48} className="mx-auto text-gray-200 mb-4" />
                       <p className="text-gray-400 font-bold italic">No se ha realizado ningún cierre histórico todavía.</p>
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

import React, { useState, useMemo, useEffect } from 'react';
import { 
  MessageCircle, Search, Filter, CheckCircle2, AlertCircle, 
  Clock, Phone, DollarSign, ArrowRight, Loader2, Play, Pause,
  RotateCw, CheckCircle, Info, Hash, User, Percent, Send, 
  LayoutDashboard, X
} from 'lucide-react';
import { Invoice, Company, OrderStatus, WaTemplate, CampaignStatus } from '../types';
import { dbGetUndeliveredOrdersForReminders, dbUpdateLastReminderSent, dbGetWaTemplates } from '../services/dbService';
import { EvolutionService } from '../services/evolutionService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../services/supabaseClient';

interface WaRemindersProps {
  company: Company;
  isSendingGlobal?: boolean;
  setIsSendingGlobal?: (val: boolean) => void;
  progressGlobal?: number;
  setProgressGlobal?: (val: number) => void;
  metricsGlobal?: { sent: number; failed: number; total: number };
  setMetricsGlobal?: (val: { sent: number; failed: number; total: number }) => void;
}

const WaReminders: React.FC<WaRemindersProps> = ({ 
  company, 
  isSendingGlobal = false, 
  setIsSendingGlobal = () => {}, 
  progressGlobal = 0, 
  setProgressGlobal = () => {}, 
  metricsGlobal = { sent: 0, failed: 0, total: 0 }, 
  setMetricsGlobal = () => {} 
}) => {
  const queryClient = useQueryClient();
  const primaryColor = company?.primaryColor || '#4f46e5';
  const [searchTerm, setSearchTerm] = useState('');
  const [completeModalData, setCompleteModalData] = useState<{ sent: number; failed: number } | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [currentSendingId, setCurrentSendingId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [flyingMessages, setFlyingMessages] = useState<{ id: number, x: number, y: number }[]>([]);

  const addFlyingMessage = (e: React.MouseEvent | { clientX: number, clientY: number }) => {
    const id = Date.now();
    setFlyingMessages(prev => [...prev, { id, x: e.clientX, y: e.clientY }]);
    setTimeout(() => {
      setFlyingMessages(prev => prev.filter(m => m.id !== id));
    }, 1000);
  };

  // WA Campaign Config (Delays and Pauses)
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([]);
  const [status, setStatus] = useState<CampaignStatus>(CampaignStatus.IDLE);

  useEffect(() => {
    // Realtime subscription for asynchronous updates
    const channel = supabase
      .channel('wa-reminders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, (payload) => {
        console.log('Ventas change detected:', payload);
        queryClient.invalidateQueries({ queryKey: ['undeliveredOrders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items_venta' }, (payload) => {
        console.log('Items change detected:', payload);
        queryClient.invalidateQueries({ queryKey: ['undeliveredOrders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos_venta' }, (payload) => {
        console.log('Pagos change detected:', payload);
        queryClient.invalidateQueries({ queryKey: ['undeliveredOrders'] });
      })
      .subscribe((status) => {
        console.log('Supabase realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['undeliveredOrders'],
    queryFn: dbGetUndeliveredOrdersForReminders,
    refetchInterval: 10000, // Every 10 seconds for a good balance
    staleTime: 0,
    gcTime: 0, // Ensure no long-term caching
  });

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const temps = await dbGetWaTemplates();
        setWaTemplates(temps.filter(t => (t.category === 'RECOJO' || t.category === 'RECORDATORIO') && t.is_active));
      } catch (e) {
        console.error("Error fetching templates:", e);
      }
    };
    fetchTemplates();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => 
      o.ordenNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.client.phone?.includes(searchTerm)
    );
  }, [orders, searchTerm]);

  // Paginated Orders Logic
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalToCollect = orders.reduce((sum, o) => sum + (o.totals.total - (o.prePaymentAmount || 0)), 0);
    return { totalOrders, totalToCollect };
  }, [orders]);

  const calculateProcessPercentage = (order: Invoice) => {
    if (!order.items || order.items.length === 0) return 0;
    const completedItems = order.items.filter(it => 
      ['LISTO', 'ENTREGADO', 'ENTREGA_PARCIAL'].includes(it.status || '')
    ).length;
    return Math.round((completedItems / order.items.length) * 100);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedOrders(filteredOrders.map(o => o.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrders(prev => 
      prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
    );
  };

  const canSendReminder = (order: Invoice) => {
    if (!order.ultimo_whatsapp_recuerdo_at) return true;
    const lastSent = new Date(order.ultimo_whatsapp_recuerdo_at);
    const now = new Date();
    const diffHours = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
    return diffHours >= 24;
  };

  const processReminders = async () => {
    if (selectedOrders.length === 0 || !company.whatsapp_instance || !company.whatsapp_token) {
        alert("Seleccione órdenes y asegúrese de que WhatsApp esté configurado.");
        return;
    }

    if (waTemplates.length === 0) {
        alert("No hay plantillas de RECOJO o RECORDATORIO activas. Cárgalas desde el módulo de Campaña de Marketing.");
        return;
    }

    setIsSendingGlobal(true);
    setStatus(CampaignStatus.RUNNING);
    setMetricsGlobal({ sent: 0, failed: 0, total: selectedOrders.length });
    setProgressGlobal(0);

    const service = new EvolutionService({
      baseUrl: company.whatsapp_instance,
      apiKey: company.whatsapp_token,
      instanceName: company.whatsapp_instance_name || 'instance'
    });

    let sentCount = 0;
    let failedCount = 0;

        for (let i = 0; i < selectedOrders.length; i++) {
            const orderId = selectedOrders[i];
            const order = orders.find(o => o.id === orderId);
            
            if (!order || !order.client.phone) {
                failedCount++;
                const newMetrics = { sent: sentCount, failed: failedCount, total: selectedOrders.length };
                setMetricsGlobal(newMetrics);
                continue;
            }

            // Check 24h limit
            if (!canSendReminder(order)) {
                console.log(`Skipping order ${order.ordenNumber} - 24h limit`);
                continue;
            }

            setCurrentSendingId(orderId);

            try {
                // Randomize template
                const template = waTemplates[Math.floor(Math.random() * waTemplates.length)];
                if (!template) throw new Error("No template found");
                
                let message = template.content
                    .replace('{cliente}', order.client.name)
                    .replace('{orden}', order.ordenNumber || '')
                    .replace('{deuda}', (order.totals.total - (order.prePaymentAmount || 0)).toFixed(2))
                    .replace('{sucursal}', company.razonSocial);

                // Send via Evolution API
                const phone = order.client.phone.replace(/\D/g, '');
                const formattedPhone = phone.startsWith('51') ? phone : `51${phone}`;

                if (template.image_url) {
                    await service.sendMedia(formattedPhone, template.image_url, message);
                } else {
                    await service.sendText(formattedPhone, message);
                }

                await dbUpdateLastReminderSent(orderId);
                sentCount++;
                setMetricsGlobal({ sent: sentCount, failed: failedCount, total: selectedOrders.length });
            } catch (error) {
                console.error(`Error sending reminder to ${order.client.phone}:`, error);
                failedCount++;
                setMetricsGlobal({ sent: sentCount, failed: failedCount, total: selectedOrders.length });
            }

            const currentProgress = Math.round(((i + 1) / selectedOrders.length) * 100);
            setProgressGlobal(currentProgress);

            // HUMANIZED DELAY (15-45 seconds)
            if (i < selectedOrders.length - 1) {
                const delay = Math.floor(Math.random() * (45000 - 15000 + 1)) + 15000;
                
                // SPECIAL PAUSES
                let extraPause = 0;
                const msgNum = i + 1;
                if (msgNum % 40 === 0) {
                    extraPause = (Math.floor(Math.random() * (20 - 10 + 1)) + 10) * 60000;
                } else if (msgNum % 15 === 0) {
                    extraPause = (Math.floor(Math.random() * (8 - 3 + 1)) + 3) * 60000;
                }

                await new Promise(resolve => setTimeout(resolve, delay + extraPause));
            }
        }

        setIsSendingGlobal(false);
        setProgressGlobal(0);
        setStatus(CampaignStatus.COMPLETED);
    setCurrentSendingId(null);
    setSelectedOrders([]);
    queryClient.invalidateQueries({ queryKey: ['undeliveredOrders'] });
    setCompleteModalData({ sent: sentCount, failed: failedCount });
  };

  useEffect(() => {
    if (isSendingGlobal && currentSendingId) {
      // Simulate flying messages during mass send occasionally
      if (Math.random() > 0.5) {
         addFlyingMessage({ clientX: window.innerWidth / 2, clientY: 200 });
      }
    }
  }, [isSendingGlobal, currentSendingId]);

  const sendSingleReminder = async (order: Invoice) => {
    if (!company.whatsapp_instance || !company.whatsapp_token) {
        alert("WhatsApp no configurado.");
        return;
    }

    if (waTemplates.length === 0) {
        alert("No hay plantillas de RECOJO o RECORDATORIO activas. Cárgalas desde el módulo de Campaña de Marketing.");
        return;
    }

    if (!canSendReminder(order)) {
        alert("Ya se envió un recordatorio a este cliente en las últimas 24 horas.");
        return;
    }

    try {
        const service = new EvolutionService({
          baseUrl: company.whatsapp_instance,
          apiKey: company.whatsapp_token,
          instanceName: company.whatsapp_instance_name || 'instance'
        });

        const template = waTemplates[Math.floor(Math.random() * waTemplates.length)];
        let message = template.content
            .replace('{cliente}', order.client.name)
            .replace('{orden}', order.ordenNumber || '')
            .replace('{deuda}', (order.totals.total - (order.prePaymentAmount || 0)).toFixed(2))
            .replace('{sucursal}', company.razonSocial);

        const phone = order.client.phone?.replace(/\D/g, '') || '';
        const formattedPhone = phone.startsWith('51') ? phone : `51${phone}`;

        if (template.image_url) {
            await service.sendMedia(formattedPhone, template.image_url, message);
        } else {
            await service.sendText(formattedPhone, message);
        }

        await dbUpdateLastReminderSent(order.id);
        queryClient.invalidateQueries({ queryKey: ['undeliveredOrders'] });
        alert("Recordatorio enviado con éxito.");
    } catch (error) {
        alert("Error al enviar el recordatorio.");
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4 p-4 sm:p-6 overflow-hidden relative">
      <AnimatePresence>
        {flyingMessages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 1, x: msg.x, y: msg.y, scale: 1 }}
            animate={{ 
              opacity: 0, 
              x: msg.x + (Math.random() - 0.5) * 400, 
              y: msg.y - 600, 
              rotate: 360,
              scale: 2
            }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="fixed z-[9999] pointer-events-none"
          >
            <MessageCircle className="text-emerald-500 w-8 h-8 fill-emerald-500/20" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-bg2 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-border flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-text3 uppercase tracking-widest">Órdenes por Entregar</p>
            <p className="text-2xl font-black dark:text-white">{stats.totalOrders}</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-bg2 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-border flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-text3 uppercase tracking-widest">Total por Cobrar</p>
            <p className="text-2xl font-black dark:text-white">{company.moneda_simbolo} {stats.totalToCollect.toFixed(2)}</p>
          </div>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-bg2 rounded-2xl shadow-sm border border-slate-100 dark:border-border flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-border flex flex-col sm:flex-row gap-4 items-center justify-between shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text"
                placeholder="Buscar por orden, cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-bg3 border border-slate-100 dark:border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <button 
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-2 bg-slate-50 dark:bg-bg3 border border-slate-100 dark:border-border rounded-xl text-slate-600 dark:text-text hover:bg-slate-100 dark:hover:bg-surface transition-all disabled:opacity-50"
            >
              <RotateCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar">
            {selectedOrders.length > 0 && (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={processReminders}
                    disabled={isSendingGlobal}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all whitespace-nowrap disabled:opacity-50"
                  >
                    {isSendingGlobal ? <Loader2 className="animate-spin" size={16} /> : <img src="https://iili.io/BWIGQGs.png" className="w-4 h-4 object-contain brightness-0 invert" alt="Send" />}
                    {isSendingGlobal ? "Enviando..." : `Enviar a ${selectedOrders.length} seleccionados`}
                  </motion.button>
            )}
          </div>
        </div>

        {/* Progress Bar for Mass Sending (Legacy UI moved to header, but keep local for consistency if needed or remove) */}
        <AnimatePresence>
          {isSendingGlobal && (
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="px-4 py-3 bg-bg3 border-b border-border overflow-hidden"
            >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin text-accent" size={18} />
                <span className="text-xs font-black uppercase tracking-widest text-text">Procesando Campaña</span>
              </div>
              <div className="flex gap-6">
                <span className="text-xs font-bold text-emerald-500">{metricsGlobal.sent} ENVIADOS</span>
                <span className="text-xs font-bold text-rose-500">{metricsGlobal.failed} FALLIDOS</span>
                <span className="text-xs font-bold text-accent">{progressGlobal}%</span>
              </div>
            </div>
            <div className="h-3 bg-bg rounded-full overflow-hidden border border-white/5 shadow-inner">
              <motion.div 
                className="h-full bg-gradient-to-r from-accent to-emerald-500 shadow-[0_0_15px_rgba(26,110,245,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${progressGlobal}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-auto">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-bg3 border-b border-slate-100 dark:border-border">
                  <th className="p-4 w-10">
                    <input 
                      type="checkbox"
                      checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                    />
                  </th>
                  <th className="p-4 text-[11px] font-black text-slate-500 dark:text-text3 uppercase tracking-widest">Nexo Orden</th>
                  <th className="p-4 text-[11px] font-black text-slate-500 dark:text-text3 uppercase tracking-widest">Recepción</th>
                  <th className="p-4 text-[11px] font-black text-slate-500 dark:text-text3 uppercase tracking-widest">Cliente</th>
                  <th className="p-4 text-[11px] font-black text-slate-500 dark:text-text3 uppercase tracking-widest text-right">Saldo Deudor</th>
                  <th className="p-4 text-[11px] font-black text-slate-500 dark:text-text3 uppercase tracking-widest">Estado Lavado</th>
                  <th className="p-4 text-[10px] font-black text-slate-500 dark:text-text3 uppercase tracking-widest text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-border">
                {(isLoading && orders.length === 0) ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center">
                      <Loader2 className="animate-spin mx-auto text-brand-primary mb-4" size={32} />
                      <p className="text-sm text-slate-500">Cargando órdenes...</p>
                    </td>
                  </tr>
                ) : paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-500">
                      No se encontraron órdenes pendientes.
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map(order => {
                    const debt = order.totals.total - (order.prePaymentAmount || 0);
                    const processPct = calculateProcessPercentage(order);
                    const isSentRecently = !canSendReminder(order);

                    return (
                      <tr 
                        key={order.id} 
                        className={`hover:bg-slate-50 dark:hover:bg-bg3 transition-colors ${currentSendingId === order.id ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
                      >
                        <td className="p-4">
                          <input 
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => toggleSelectOrder(order.id)}
                            className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                          />
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-black dark:text-white tracking-widest">{order.ordenNumber || '#---'}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold dark:text-white uppercase leading-none">{new Date(order.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })}</span>
                            <span className="text-[10px] text-slate-400 dark:text-text3 mt-1 font-medium">{new Date(order.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-black dark:text-white uppercase truncate max-w-[180px]">{order.client.name}</span>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-brand-primary mt-1">
                              <Phone size={10} />
                              {order.client.phone || 'S/T'}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`text-sm font-black px-3 py-1 rounded-full ${debt > 0.01 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {company.moneda_simbolo} {debt.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-blue-500">{processPct}%</span>
                            </div>
                            <div className="w-24 h-2 bg-slate-100 dark:bg-bg3 rounded-full overflow-hidden shadow-inner">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500" 
                                style={{ width: `${processPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="relative inline-block group">
                            <button 
                              onClick={(e) => {
                                addFlyingMessage(e);
                                sendSingleReminder(order);
                              }}
                              disabled={isSentRecently || isSendingGlobal}
                              className={`p-2 rounded-lg transition-all ${
                                isSentRecently 
                                  ? 'bg-slate-100 dark:bg-bg3 text-slate-400 opacity-50 cursor-not-allowed'
                                  : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white shadow-sm'
                              }`}
                              title={isSentRecently ? "Recordatorio enviado hace menos de 24h" : "Enviar Recordatorio"}
                            >
                              <img src="https://iili.io/BWIGQGs.png" className={`w-4 h-4 object-contain ${!isSentRecently ? 'group-hover:brightness-0 group-hover:invert' : ''}`} alt="Send" />
                            </button>
                            {(order.reminderCount || 0) > 0 && (
                              <div className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-indigo-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white shadow-sm z-10 pointer-events-none">
                                {order.reminderCount}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-border">
            {(isLoading && orders.length === 0) ? (
              <div className="p-12 text-center">
                <Loader2 className="animate-spin mx-auto text-brand-primary" size={32} />
              </div>
            ) : paginatedOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No se encontraron órdenes pendientes.
              </div>
            ) : (
              paginatedOrders.map(order => {
                const debt = order.totals.total - (order.prePaymentAmount || 0);
                const processPct = calculateProcessPercentage(order);
                const isSentRecently = !canSendReminder(order);

                return (
                  <div key={order.id} className={`p-4 space-y-3 ${currentSendingId === order.id ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                        />
                        <div>
                          <p className="text-xs font-black dark:text-white tracking-widest leading-none mb-1">{order.ordenNumber}</p>
                          <p className="text-[10px] font-bold text-slate-500 dark:text-text3 uppercase leading-none">{order.client.name}</p>
                        </div>
                      </div>
                        <div className="relative">
                          <button 
                            onClick={() => sendSingleReminder(order)}
                            disabled={isSentRecently || isSendingGlobal}
                            className={`p-2 rounded-lg transition-all ${
                              isSentRecently 
                                ? 'bg-slate-100 dark:bg-bg3 text-slate-400 opacity-50'
                                : 'bg-emerald-500/10 text-emerald-500 active:scale-95 shadow-sm'
                            }`}
                          >
                            <img src="https://iili.io/BWIGQGs.png" className="w-4 h-4 object-contain" alt="Send" />
                          </button>
                          {(order.reminderCount || 0) > 0 && (
                            <div className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 bg-indigo-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-white shadow-sm z-10">
                              {order.reminderCount}
                            </div>
                          )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Recepción</p>
                        <p className="text-[10px] font-bold dark:text-white uppercase leading-tight">
                          {new Date(order.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })}
                          <br />
                          {new Date(order.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Deuda</p>
                        <p className={`text-xs font-black ${debt > 0.01 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {company.moneda_simbolo} {debt.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Teléfono</p>
                        {order.client.phone ? (
                          <a href={`tel:${order.client.phone}`} className="text-xs font-bold text-blue-500 flex items-center gap-1 active:opacity-50">
                            <Phone size={10} />
                            {order.client.phone}
                          </a>
                        ) : (
                          <p className="text-xs font-medium dark:text-text2">S/T</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-1">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[8px] font-black text-slate-400 uppercase">Proceso de Lavado</span>
                          <span className="text-[8px] font-black text-blue-500">{processPct}%</span>
                        </div>
                        <div className="w-full h-1 bg-slate-100 dark:bg-bg3 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${processPct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-50 dark:bg-bg3 border-t border-slate-100 dark:border-border flex items-center justify-between shrink-0">
          <p className="text-[10px] font-bold text-slate-500 dark:text-text3 uppercase tracking-widest">
            Mostrando {paginatedOrders.length} de {filteredOrders.length} órdenes
          </p>
          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev: number) => prev - 1)}
              className="p-2 rounded-xl bg-white dark:bg-bg2 border border-slate-100 dark:border-border text-slate-400 disabled:opacity-30"
            >
              <ArrowRight className="rotate-180" size={16} />
            </button>
            <span className="text-xs font-black dark:text-white tabular-nums px-2">
              PÁGINA {currentPage} DE {totalPages || 1}
            </span>
            <button 
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((prev: number) => prev + 1)}
              className="p-2 rounded-xl bg-white dark:bg-bg2 border border-slate-100 dark:border-border text-slate-400 disabled:opacity-30"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Finalización de Campaña / Recordatorios */}
      <AnimatePresence>
        {completeModalData && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header styled with the branch color */}
              <div 
                className="p-6 text-white flex justify-between items-center transition-colors"
                style={{ backgroundColor: primaryColor }}
              >
                <h3 className="font-bold text-base uppercase tracking-wider">Campaña de Recordatorios</h3>
                <button 
                  onClick={() => setCompleteModalData(null)}
                  className="text-white/80 hover:text-white transition-opacity"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-10 flex flex-col items-center text-center gap-6">
                {/* Icon Container */}
                <div 
                  className="p-5 rounded-full"
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                >
                  <CheckCircle2 size={48} className="animate-pulse" />
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <h4 className="font-black text-xl text-slate-900 uppercase tracking-tight">¡Envío Finalizado!</h4>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Los mensajes de recordatorio han terminado de procesarse.</p>
                </div>

                {/* Metrics Box */}
                <div className="w-full bg-slate-50 rounded-3xl p-5 border border-slate-100 flex justify-around items-center">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Enviados</span>
                    <span className="text-2xl font-black text-emerald-500 tabular-nums">{completeModalData.sent}</span>
                  </div>

                  <div className="h-8 w-px bg-slate-200" />

                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fallidos</span>
                    <span className="text-2xl font-black text-rose-500 tabular-nums">{completeModalData.failed}</span>
                  </div>
                </div>

                {/* Confirmation Button */}
                <button 
                  onClick={() => setCompleteModalData(null)}
                  className="w-full text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 hover:opacity-90 leading-none"
                  style={{ 
                    backgroundColor: primaryColor,
                    boxShadow: `0 10px 20px -5px ${primaryColor}40`
                  }}
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WaReminders;

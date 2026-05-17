import React, { useState, useMemo, useEffect } from 'react';
import { 
  MessageCircle, Search, Filter, CheckCircle2, AlertCircle, 
  Clock, Phone, DollarSign, ArrowRight, Loader2, Play, Pause,
  RotateCw, CheckCircle, Info, Hash, User, Percent, Send, 
  LayoutDashboard
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [currentSendingId, setCurrentSendingId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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
        alert("No hay plantillas de RECOJO o RECORDATORIO activas. Cárgalas desde el módulo de Campaña WA.");
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
    alert(`Campaña finalizada. Enviados: ${sentCount}, Fallidos: ${failedCount}`);
  };

  const sendSingleReminder = async (order: Invoice) => {
    if (!company.whatsapp_instance || !company.whatsapp_token) {
        alert("WhatsApp no configurado.");
        return;
    }

    if (waTemplates.length === 0) {
        alert("No hay plantillas de RECOJO o RECORDATORIO activas. Cárgalas desde el módulo de Campaña WA.");
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
    <div className="h-full flex flex-col space-y-4 p-4 sm:p-6 overflow-hidden">
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
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin text-accent" size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Enviando Recordatorios</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[10px] font-bold text-emerald-500">{metricsGlobal.sent} ENVIADOS</span>
                  <span className="text-[10px] font-bold text-rose-500">{metricsGlobal.failed} FALLIDOS</span>
                  <span className="text-[10px] font-bold text-text3">{progressGlobal}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressGlobal}%` }}
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
                  <th className="p-4 text-[10px] font-black text-slate-500 dark:text-text3 uppercase tracking-widest">Num. Interno</th>
                  <th className="p-4 text-[10px] font-black text-slate-500 dark:text-text3 uppercase tracking-widest">Fecha Rec.</th>
                  <th className="p-4 text-[10px] font-black text-slate-500 dark:text-text3 uppercase tracking-widest">Cliente</th>
                  <th className="p-4 text-[10px] font-black text-slate-500 dark:text-text3 uppercase tracking-widest">Teléfono</th>
                  <th className="p-4 text-[10px] font-black text-slate-500 dark:text-text3 uppercase tracking-widest">Deuda</th>
                  <th className="p-4 text-[10px] font-black text-slate-500 dark:text-text3 uppercase tracking-widest">Proceso de Lavado</th>
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
                    const debt = (order.totals.total - (order.descuento || 0)) - (order.prePaymentAmount || 0);
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
                          <span className="text-xs font-black dark:text-white tracking-widest">{order.ordenNumber || '#---'}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold dark:text-white uppercase">{new Date(order.date).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                            <span className="text-[10px] text-slate-400 dark:text-text3">{new Date(order.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold dark:text-white uppercase truncate max-w-[150px]">{order.client.name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-xs font-medium dark:text-text2">
                            <Phone size={12} className="text-slate-400" />
                            {order.client.phone || 'S/T'}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs font-black ${debt > 0.01 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {company.moneda_simbolo} {debt.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-bg3 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 transition-all duration-500" 
                                style={{ width: `${processPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-blue-500">{processPct}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="relative inline-block group">
                            <button 
                              onClick={() => sendSingleReminder(order)}
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
                const debt = (order.totals.total - (order.descuento || 0)) - (order.prePaymentAmount || 0);
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
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 rounded-xl bg-white dark:bg-bg2 border border-slate-100 dark:border-border text-slate-400 disabled:opacity-30"
            >
              <ArrowRight className="rotate-180" size={16} />
            </button>
            <span className="text-xs font-black dark:text-white tabular-nums px-2">
              PÁGINA {currentPage} DE {totalPages || 1}
            </span>
            <button 
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 rounded-xl bg-white dark:bg-bg2 border border-slate-100 dark:border-border text-slate-400 disabled:opacity-30"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaReminders;

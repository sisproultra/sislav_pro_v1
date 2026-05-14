import React, { useEffect, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  dbGetTrackingInfo, 
  dbGetSucursalBanners, 
  dbCreatePickupRequest, 
  dbGetWaCampaignConfig,
  dbIncrementTrackingGenerated,
  dbIncrementTrackingViewed,
  dbGetCatalogProductsByBranch,
  supabase
} from '../services/dbService';
import { 
  PickupRequest, Invoice, Company, OrderStatus, PromoBanner, InvoiceType, UserRole, Product
} from '../types';
import { calculateTotals, roundToOneDecimal } from '../utils/calculations';
import { EvolutionService } from '../services/evolutionService';
import { 
  ArrowLeft, Clock, Truck, Waves, Wind, CheckCircle2, 
  MapPin, Package, Bell, RefreshCcw, Smartphone, Shirt, MessageCircle, Star, Zap, User, Phone, Calendar, Loader2, Locate, X, Check, Map as MapIcon, FileText, Download, ChevronRight, List, Printer, Sparkles, Send, ExternalLink, Store, ShoppingBag, Ticket, Search, Filter, Plus
} from 'lucide-react';
import LeafletMap from '../components/LeafletMap';
import InvoiceReceipt from '../components/InvoiceReceipt';

interface TrackingProps {
  id: string;
}

const TIME_OPTIONS = [
    "07:00 AM - 08:00 AM", "08:00 AM - 09:00 AM", "09:00 AM - 10:00 AM",
    "10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM", "12:00 PM - 01:00 PM",
    "01:00 PM - 02:00 PM", "03:00 PM - 04:00 PM", "04:00 PM - 05:00 PM",
    "05:00 PM - 06:00 PM", "06:00 PM - 07:00 PM", "07:00 PM - 08:00 PM",
    "08:00 PM - 09:00 PM", "10:00 PM - 11:00 PM"
];

const Tracking: React.FC<TrackingProps> = ({ id }) => {
  const [data, setData] = useState<{ pickup?: any, invoice?: any, company?: any, latestPoints?: number } | null>(null);
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelfScheduleOpen, setIsSelfScheduleOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isWorker, setIsWorker] = useState(false);
  const [canSendLink, setCanSendLink] = useState(false);
  const [waConfig, setWaConfig] = useState<any>(null);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [catalogSelectedCategory, setCatalogSelectedCategory] = useState('TODOS');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  const [ssAddress, setSsAddress] = useState('');
  const [ssPhone, setSsPhone] = useState('');
  const [ssMapsUrl, setSsMapsUrl] = useState('');
  const [ssDate, setSsDate] = useState(new Date().toISOString().split('T')[0]);
  const [ssTime, setSsTime] = useState(TIME_OPTIONS[2]);
  const [ssCoords, setSsCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const primaryColor = document.documentElement.style.getPropertyValue('--brand-primary').trim() || '#0054A6';

  const loadData = async () => {
    const res = await dbGetTrackingInfo(id);
    setData(res as any);
    
    // Auto-open receipt if requested via URL (?v=receipt)
    const params = new URLSearchParams(window.location.search);
    if (params.get('v') === 'receipt' && res.invoice) {
        setShowReceipt(true);
    }
    
    if (res && !localStorage.getItem('sislav_auth_session')) {
        const type = res.invoice ? 'invoice' : 'pickup';
        const entityId = res.invoice ? res.invoice.id : res.pickup.id;
        dbIncrementTrackingViewed(entityId, type).catch(console.error);
    }

    const bannersData = await dbGetSucursalBanners();
    setBanners(bannersData.filter(b => b.isActive));
    
    const config = await dbGetWaCampaignConfig();
    setWaConfig(config);

    if (res?.company?.id || res?.company?.sucursal_id) {
        const branchId = res.company.id || res.company.sucursal_id;
        const prods = await dbGetCatalogProductsByBranch(branchId);
        setCatalogProducts(prods);
    }

    setIsLoading(false);
    
    const session = localStorage.getItem('sislav_auth_session');
    if (session) {
        try {
            const parsed = JSON.parse(session);
            if (parsed?.user) {
                setIsWorker(true);
                const role = parsed.user.role;
                const allowedRoles = [UserRole.SAAS_MASTER, UserRole.OWNER, UserRole.ADMIN, UserRole.OPERARIO];
                if (allowedRoles.includes(role)) {
                    setCanSendLink(true);
                }
            }
        } catch (e) {}
    }
  };

  useEffect(() => {
    loadData();

    // Polling fallback (redundant but safe)
    const interval = setInterval(loadData, 60000); 

    // REAL-TIME UPDATES
    const channelName = `tracking-realtime-${id}`;
    const channel = supabase.channel(channelName)
        // Listen to changes on THIS specific Order/Venta
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'ventas', 
            filter: `id=eq.${id}` 
        }, (payload) => {
            console.log("⚡ [Tracking] Realtime update on Venta:", payload);
            loadData();
        })
        // Listen to changes if it's a pickup that just got linked to a venta
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'ventas', 
            filter: `pickup_id=eq.${id}` 
        }, (payload) => {
            console.log("⚡ [Tracking] Realtime update on Venta (linked to pickup):", payload);
            loadData();
        })
        // Listen to changes on the Pickup Request itself
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'recojos_delivery', 
            filter: `id=eq.${id}` 
        }, (payload) => {
            console.log("⚡ [Tracking] Realtime update on Pickup:", payload);
            loadData();
        })
        .subscribe();

    return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
    };
  }, [id]);

  // Second effect to subscribe to items_venta once we have a venta id
  useEffect(() => {
    if (!data?.invoice?.id) return;

    const invoiceId = data.invoice.id;
    const itemsChannel = supabase.channel(`tracking-items-${invoiceId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'items_venta',
            filter: `venta_id=eq.${invoiceId}`
        }, (payload) => {
            console.log("⚡ [Tracking] Realtime update on Item:", payload);
            loadData();
        })
        .subscribe();
    
    return () => {
        supabase.removeChannel(itemsChannel);
    };
  }, [data?.invoice?.id]);

  useEffect(() => {
    if (isSelfScheduleOpen && data) {
        const clientInfo = data.invoice?.clientes || data.pickup?.clientes;
        if (clientInfo) {
            setSsPhone(clientInfo.telefono || '');
            setSsAddress(clientInfo.direccion || '');
            setSsMapsUrl(clientInfo.google_maps_url || '');
            if (clientInfo.latitud && clientInfo.longitud) {
                setSsCoords({ lat: Number(clientInfo.latitud), lng: Number(clientInfo.longitud) });
            }
        }
    }
  }, [isSelfScheduleOpen, data]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBannerIndex(prev => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const handlePromoClick = (bannerName: string) => {
    const businessPhone = company?.contactPhone || "51900000000";
    const text = `Hola! acabo de ver esta promo "${bannerName}", me interesa mucho , quiero conocer las condiciones`;
    window.open(`https://wa.me/${businessPhone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const itemProgress = useMemo(() => {
    if (!data?.invoice?.items_venta) return { total: 0, strictlyAtLaundry: 0, strictlyAtReady: 0, strictlyAtDelivered: 0, reachedLaundry: 0, reachedReady: 0, reachedDelivered: 0 };
    const allItems = data.invoice.items_venta;
    const activeItems = allItems.filter((it: any) => !(it.estado_id === 9 || it.estado === 'ANULADO' || it.estado === 'CANCELADO'));
    
    const total = activeItems.length;
    const inLaundry = activeItems.filter((it: any) => ['EN_LAVADO', 'EN_SECADO', 'RECIBIDO', 'PENDIENTE'].includes(it.estado || '')).length;
    const inReady = activeItems.filter((it: any) => it.estado === 'LISTO').length;
    const inDelivered = activeItems.filter((it: any) => it.estado === 'ENTREGADO').length;

    return {
      total,
      strictlyAtLaundry: inLaundry,
      strictlyAtReady: inReady,
      strictlyAtDelivered: inDelivered,
      reachedLaundry: inLaundry + inReady + inDelivered,
      reachedReady: inReady + inDelivered,
      reachedDelivered: inDelivered
    };
  }, [data]);

  const steps = useMemo(() => {
    if (!data) return [];
    const { pickup, invoice } = data;
    const isStoreOrder = invoice ? (invoice.origen === 'TIENDA') : false;
    const total = itemProgress.total;

    if (isStoreOrder) {
        return [
            { id: 'LAVANDERIA', label: `LAVANDERÍA (${itemProgress.reachedLaundry}/${total})`, icon: Waves, isActive: itemProgress.strictlyAtLaundry > 0, isCompleted: itemProgress.reachedLaundry === total && itemProgress.strictlyAtLaundry === 0, time: invoice?.lavanderia_at || invoice?.fecha_recepcion },
            { id: 'LISTO', label: `LISTO (${itemProgress.reachedReady}/${total})`, icon: CheckCircle2, isActive: itemProgress.strictlyAtReady > 0, isCompleted: itemProgress.reachedReady === total && itemProgress.strictlyAtReady === 0, time: invoice?.listo_at },
            { id: 'ENTREGADO', label: `ENTREGADO (${itemProgress.reachedDelivered}/${total})`, icon: Package, isActive: itemProgress.strictlyAtDelivered > 0, isCompleted: itemProgress.reachedDelivered === total, time: invoice?.entregado_at },
        ];
    } else {
        const pickupCompleted = ['COMPLETED'].includes(pickup?.estado_recojo || '') || !!invoice;
        const pickupInRoute = ['IN_ROUTE'].includes(pickup?.estado_recojo || '') && !invoice;
        const isInRouteForDelivery = invoice?.estado === 'EN_RUTA';

        return [
            { id: 'RESERVA', label: `RESERVA`, icon: Clock, isActive: pickup?.estado_recojo === 'PENDIENTE', isCompleted: pickupCompleted || pickupInRoute, time: pickup ? `${pickup.fecha_programada} ${pickup.rango_horario}` : null, isRawTime: true },
            { id: 'CAMINO_RECOJO', label: `CAMINO RECOJO`, icon: Truck, isActive: pickupInRoute, isCompleted: pickupCompleted, time: pickup?.en_camino_recojo_at },
            { id: 'RECOGIDO', label: `RECOGIDO`, icon: Shirt, isActive: pickupCompleted && !invoice?.lavanderia_at, isCompleted: !!invoice?.lavanderia_at, time: invoice?.fecha_recepcion || pickup?.recogido_at },
            { id: 'LAVANDERIA', label: `LAVANDERÍA (${itemProgress.reachedLaundry}/${total})`, icon: Waves, isActive: itemProgress.strictlyAtLaundry > 0, isCompleted: itemProgress.reachedLaundry === total && itemProgress.strictlyAtLaundry === 0, time: invoice?.lavanderia_at },
            { id: 'LISTO', label: `LISTO (${itemProgress.reachedReady}/${total})`, icon: CheckCircle2, isActive: itemProgress.strictlyAtReady > 0 && !isInRouteForDelivery, isCompleted: itemProgress.reachedReady === total && itemProgress.strictlyAtReady === 0, time: invoice?.listo_at },
            { id: 'CAMINO_ENTREGA', label: `CAMINO ENTREGA`, icon: Truck, isActive: isInRouteForDelivery, isCompleted: invoice?.estado === 'ENTREGADO', time: invoice?.en_camino_entrega_at },
            { id: 'ENTREGADO', label: `ENTREGADO (${itemProgress.reachedDelivered}/${total})`, icon: Package, isActive: itemProgress.strictlyAtDelivered > 0, isCompleted: itemProgress.reachedDelivered === total, time: invoice?.entregado_at },
        ];
    }
  }, [data, itemProgress]);

  const normalizedInvoice = useMemo(() => {
    if (!data?.invoice) return null;
    const v = data.invoice;
    const c = v.clientes;
    const docType = (v.tipo_documento_codigo || '80') as InvoiceType;
    const serie = v.serie || 'NV01';
    const correlativo = v.correlativo || 0;
    const totals = { total: Number(v.total) || 0, igv: Number(v.total_igv) || 0, gravada: Number(v.total_gravada) || 0, exonerada: Number(v.total_exonerada) || 0, inafecta: Number(v.total_inafecta) || 0 };

    return { 
        ...v, id: v.id, sucursal_id: v.sucursal_id, empresa_holding_id: v.empresa_holding_id, ordenNumber: v.codigo_orden || '---', serie, correlativo, type: docType, 
        client: c ? { id: c.id, name: (c.nombres || '').toUpperCase(), docType: c.tipo_documento || 'DNI', docNumber: c.dni || '00000000', phone: c.telefono || '', address: c.direccion || '-', points: c.puntos || 0 } : { id: 'temp', name: 'CLIENTE VARIOS', docNumber: '00000000', docType: '-', address: '-', points: 0, sucursal_id: v.sucursal_id }, 
        items: (v.items_venta || []).map((it: any) => ({ ...it, id: it.id, name: it.descripcion, price: Number(it.precio_unitario), quantity: Number(it.cantidad), subtotal: Number(it.subtotal) || roundToOneDecimal(Number(it.precio_unitario) * Number(it.cantidad)), status: it.estado, estado_id: it.estado_id })), 
        payments: (v.pagos_venta || []).map((p: any) => ({ metodo_pago_id: p.metodo_pago_id, monto: Number(p.monto), date: p.fecha_pago })),
        totals, date: v.fecha_recepcion || v.fecha_registro || v.created_at || new Date().toISOString(), orderStatus: (v.estado as OrderStatus) || 'PENDIENTE', sunatStatus: v.sunat_status || (docType === '80' ? 'INTERNAL' : 'PENDING'), qrCodeData: `${data.company?.ruc}|${docType}|${serie}|${correlativo}|${totals.igv.toFixed(2)}|${totals.total.toFixed(2)}|${(v.fecha_recepcion || v.created_at || '').split('T')[0]}|${c?.tipo_documento === 'DNI' ? '1' : c?.tipo_documento === 'RUC' ? '6' : '0'}|${c?.dni || '00000000'}|`
    } as Invoice;
  }, [data]);

  const handleSelfSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssPhone || !ssAddress) return;
    const clientData = data?.invoice?.clientes || data?.pickup?.clientes;
    const clientName = clientData?.nombres || 'Cliente';
    const clientId = clientData?.id;
    setIsSaving(true);
    try {
        await dbCreatePickupRequest({ cliente_id: clientId, clientName: String(clientName || '').toUpperCase(), phone: ssPhone, address: ssAddress.toUpperCase(), scheduledDate: ssDate, timeRange: ssTime, priority: 'NORMAL', status: 'PENDING', latitude: ssCoords?.lat, longitude: ssCoords?.lng, googleMapsUrl: ssMapsUrl, isSelfScheduled: true, isReadByAdmin: false, notes: "CLIENTE AUTO-AGENDADO DESDE TRACKING", sucursal_id: data?.company?.id || data?.company?.sucursal_id || 'default', empresa_holding_id: data?.company?.empresa_holding_id || data?.company?.empresa_id });
        setSaveSuccess(true);
        setTimeout(() => { setIsSelfScheduleOpen(false); setSaveSuccess(false); }, 5000);
    } catch (e) { showToast("Error al agendar.", 'error'); } finally { setIsSaving(false); }
  };

  const handleSendTrackingLink = async () => {
    const clientPhone = data?.invoice?.clientes?.telefono || data?.pickup?.clientes?.telefono;
    if (!clientPhone) { showToast("El cliente no tiene teléfono registrado.", 'error'); return; }
    const slug = data?.company?.slug || JSON.parse(localStorage.getItem('sislav_active_sucursal') || '{}')?.slug || '';
    const trackingUrl = `${window.location.origin}${window.location.pathname}?t=${id}${slug ? `&s=${slug}` : ''}`;
    const text = `Estimado(a) Cliente 👋, aquí puedes seguir el estado de tu pedido en tiempo real: ${trackingUrl}`;
    setIsSendingLink(true);
    if (data) {
        const type = data.invoice ? 'invoice' : 'pickup';
        const entityId = data.invoice ? data.invoice.id : data.pickup.id;
        dbIncrementTrackingGenerated(entityId, type).catch(console.error);
    }
    const sessionStr = localStorage.getItem('sislav_auth_session');
    const activeSucursalStr = localStorage.getItem('sislav_active_sucursal');
    const globalConfigStr = localStorage.getItem('sislav_global_config');
    let sessionSucursal: any = null;
    let globalConfig: any = null;
    try {
        if (activeSucursalStr) sessionSucursal = JSON.parse(activeSucursalStr);
        if (globalConfigStr) globalConfig = JSON.parse(globalConfigStr);
    } catch (e) {}
    try {
        const baseUrl = sessionSucursal?.whatsapp_instance || data?.company?.whatsapp_instance || globalConfig?.url_bot;
        const apiKey = sessionSucursal?.whatsapp_token || data?.company?.whatsapp_token || globalConfig?.apikey_bot;
        const instanceName = sessionSucursal?.whatsapp_instance_name || data?.company?.whatsapp_instance_name || globalConfig?.instancia_bot;
        if (baseUrl && apiKey && instanceName) {
            const evolution = new EvolutionService({ baseUrl, apiKey, instanceName });
            const isConnected = await evolution.checkInstance();
            if (isConnected) {
                await evolution.sendText(clientPhone, text);
                showToast("Mensaje enviado con éxito", 'success');
                setIsSendingLink(false);
                return;
            }
        }
        window.open(`https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
    } catch (error) { window.open(`https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank'); } finally { setIsSendingLink(false); }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" style={{ borderTopColor: primaryColor }}></div></div>;
  if (!data) return (
    <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white/10 p-10 rounded-[3rem] border border-white/10 backdrop-blur-xl shadow-2xl animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-8 mx-auto border border-white/10"><Smartphone size={40} className="text-white/30" /></div>
            <h2 className="text-white text-2xl font-bold uppercase tracking-tighter mb-4">Orden No Encontrada</h2>
            <p className="text-white/50 text-xs max-w-[240px] font-bold uppercase tracking-[0.15em] leading-relaxed mx-auto">El link de seguimiento no es válido o la orden ya no se encuentra disponible en nuestro sistema.</p>
            <div className="mt-10 pt-8 border-t border-white/5 flex flex-col gap-4 text-center">
                <button onClick={() => window.location.reload()} className="bg-white text-slate-950 px-6 py-3.5 rounded-2xl font-bold uppercase text-[9px] tracking-widest active:scale-95 transition-all shadow-xl">Reintentar</button>
            </div>
        </div>
    </div>
  );

  const { pickup, invoice, company } = data;
  const clientData = invoice?.clientes || pickup?.clientes;
  const clientNameShow = clientData?.nombres || 'Cliente';
  const points = clientData?.puntos || 0;

  return (
    <div className="h-screen bg-[#f8fafc] font-sans flex flex-col items-center overflow-hidden relative">
      <header className="shrink-0 w-full text-white p-4 md:p-8 rounded-b-[2rem] md:rounded-b-[3.5rem] shadow-xl z-[120]" style={{ backgroundColor: primaryColor }}>
        <div className="flex justify-between items-start max-w-5xl mx-auto">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 md:p-4 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner shrink-0"><Smartphone size={24} className="md:w-10 md:h-10" /></div>
                    <div><h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase leading-none">Seguimiento</h1><p className="text-white/70 text-[10px] font-bold mt-1 uppercase tracking-widest leading-none truncate max-w-[150px] md:max-w-none">ESTIMADO(A) CLIENTE</p></div>
                </div>
                <div className="flex gap-2">
                    {invoice && invoice.estado !== 'ENTREGADO' && (
                        <button onClick={() => setShowReceipt(true)} className="w-10 h-10 bg-white hover:bg-slate-100 rounded-xl transition-all shadow-lg flex items-center justify-center border border-slate-200" title="Ver Ticket"><Ticket size={24} className="text-slate-900" strokeWidth={2.5} /></button>
                    )}
                    {canSendLink && (
                        <button onClick={handleSendTrackingLink} disabled={isSendingLink} className={`w-10 h-10 ${isSendingLink ? 'bg-emerald-400' : 'bg-emerald-500 hover:bg-emerald-600'} text-white rounded-xl transition-all shadow-lg flex items-center justify-center border border-emerald-400`} title="Enviar Link de Seguimiento">{isSendingLink ? <Loader2 size={20} className="animate-spin" /> : <img src="https://iili.io/BWIGQGs.png" className="w-6 h-6 object-contain" alt="WhatsApp" referrerPolicy="no-referrer" />}</button>
                    )}
                </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 md:px-5 md:py-3 rounded-[1.5rem] md:rounded-[2rem] border border-white/20 flex flex-col items-center shadow-xl">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1 leading-none">Mis Puntos</span>
                <div className="flex items-center gap-1.5 md:gap-2"><Star size={18} className="text-yellow-400 fill-yellow-400 md:w-5 md:h-5" /><span className="text-xl md:text-2xl font-black tracking-tight tabular-nums">{points}</span></div>
            </div>
        </div>
      </header>

      <div className="flex-1 w-full overflow-y-auto custom-scrollbar flex flex-col items-center pb-32">
        <div className="w-[96%] lg:w-[96%] max-w-5xl bg-white -mt-4 md:-mt-12 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl p-4 md:p-12 border border-slate-50 flex flex-col gap-6 md:gap-10 relative z-10">
          <div className="flex justify-between items-center px-1">
              <div className="flex flex-col gap-0.5"><h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ESTADO DEL PEDIDO</h3>{invoice && <p className="text-[10px] font-bold text-slate-900 uppercase">Orden: #{invoice.codigo_orden}</p>}</div>
              <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-emerald-100 animate-pulse shadow-sm"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div><span className="text-[10px] font-bold uppercase tracking-widest">EN VIVO</span></div>
          </div>

          <div className="relative px-2">
              <div className="absolute left-[17px] top-6 bottom-6 w-1 lg:left-10 lg:right-10 lg:top-[22px] lg:bottom-auto lg:h-1 bg-slate-100 rounded-full z-0">
                  <div className="absolute top-0 left-0 rounded-full transition-all duration-[2000ms] ease-out" style={{ height: window.innerWidth < 1024 ? `${(steps.findIndex(s=>s.isActive||s.isCompleted) / (steps.length - 1)) * 100}%` : '4px', width: window.innerWidth >= 1024 ? `${(steps.findIndex(s=>s.isActive||s.isCompleted) / (steps.length - 1)) * 100}%` : '4px', backgroundColor: primaryColor }}></div>
              </div>
              <div className="flex flex-col lg:flex-row lg:justify-between space-y-3 md:space-y-6 lg:space-y-0 relative z-10">
                  {steps.map((step: any, idx) => {
                      const isDeliveredStep = step.id === 'ENTREGADO';
                      const activeColor = isDeliveredStep ? '#10b981' : primaryColor;
                      const iconColor = step.isActive ? activeColor : (step.isCompleted ? '#94a3b8' : '#e2e8f0');
                      return (
                          <div key={step.id} className="flex lg:flex-col gap-4 lg:gap-3 items-center group flex-1">
                              <div className={`w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 z-10 transition-all duration-700 border-[3px] md:border-[5px] ${step.isActive ? 'bg-white shadow-[0_0_20px_rgba(0,0,0,0.1)] scale-110' : 'bg-white border-slate-100'}`} style={step.isActive ? { borderColor: activeColor } : {}}>
                                  <step.icon size={16} className={`lg:w-[22px] lg:h-[22px] ${step.isActive ? '' : 'opacity-40'}`} style={{ color: iconColor }} />
                              </div>
                              <div className="flex flex-col lg:items-center min-w-0 flex-1 lg:text-center">
                                  <h4 className={`text-[10px] font-bold uppercase tracking-widest transition-all duration-500 ${step.isActive ? 'text-slate-900' : 'text-slate-300'}`} style={step.isActive ? { color: activeColor } : {}}>{step.label}</h4>
                                  {(step.isActive || step.isCompleted) && step.time && (
                                    <div className="flex flex-col lg:items-center gap-0.5 mt-1">
                                      {step.isActive && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full text-white uppercase tracking-tight animate-pulse mb-1" style={{ backgroundColor: activeColor }}>AHORA</span>}
                                      {step.isRawTime ? <span className="text-[8px] font-bold text-slate-500 uppercase leading-tight">{step.time}</span> : (
                                         <><span className="text-[8px] font-bold text-slate-500 tabular-nums leading-none">{new Date(step.time).toLocaleDateString('es-PE')}</span><span className="text-[8px] font-bold text-slate-400 tabular-nums uppercase leading-none">{new Date(step.time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}</span></>
                                      )}
                                    </div>
                                  )}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>

          {invoice?.items_venta && (
              <div className="animate-in fade-in duration-700">
                  <div className="flex items-center gap-2 mb-3"><List size={14} className="text-slate-400" /><h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DETALLE DEL SERVICIO</h3></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">{[...invoice.items_venta].sort((a: any, b: any) => {
                      const isACanceled = a.estado_id === 9 || a.estado === 'ANULADO' || a.estado === 'CANCELADO';
                      const isBCanceled = b.estado_id === 9 || b.estado === 'ANULADO' || b.estado === 'CANCELADO';
                      return (isACanceled ? 1 : 0) - (isBCanceled ? 1 : 0);
                  }).map((item: any, idx: number) => {
                      const isCanceled = item.estado_id === 9 || item.estado === 'ANULADO' || item.estado === 'CANCELADO';
                      return (
                      <div key={idx} className={`${isCanceled ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200 hover:bg-white'} border rounded-xl p-3 flex items-center justify-between group hover:shadow-md transition-all`}>
                          <div className="flex items-center gap-2.5"><div className={`${isCanceled ? 'bg-red-100 text-red-500' : 'bg-white text-slate-400 group-hover:text-indigo-500'} w-8 h-8 rounded-lg flex items-center justify-center border border-slate-100 shadow-sm transition-colors`}><Shirt size={16} /></div><div className="min-w-0"><p className={`font-bold text-[10px] uppercase truncate leading-tight ${isCanceled ? 'text-red-700 strike-through' : 'text-slate-800'}`}>{item.cantidad} x {item.descripcion}</p></div></div>
                          <div className="flex items-center gap-1.5">
                              {isCanceled ? <div className="flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded-lg text-[7px] font-bold uppercase border border-red-700 shadow-sm"><X size={8} /> CANCELADO</div> :
                               ['EN_LAVADO', 'EN_SECADO', 'RECIBIDO', 'PENDIENTE'].includes(item.estado || '') ? <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg text-[7px] font-bold uppercase border border-blue-200 animate-pulse"><Waves size={8} /> LAVANDERÍA</div> :
                               item.estado === 'LISTO' ? <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-[7px] font-bold uppercase border border-emerald-200"><CheckCircle2 size={8} /> LISTO</div> :
                               item.estado === 'ENTREGADO' ? <div className="flex items-center gap-1 bg-green-600 text-white px-2 py-0.5 rounded-lg text-[7px] font-bold uppercase border border-green-700 shadow-sm"><Package size={8} /> ENTREGADO</div> :
                               <div className="flex items-center gap-1 bg-slate-200 text-slate-500 px-2 py-0.5 rounded-lg text-[7px] font-bold uppercase border border-slate-300"><Clock size={8} /> RESERVA</div>}
                          </div>
                      </div>
                  );})}</div>
              </div>
          )}
        </div>

        {banners.length > 0 && (
          <div className="w-[96%] max-w-5xl mt-8 px-1 animate-in slide-in-from-bottom-4 duration-1000 mb-10">
             <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-2xl border border-slate-100 overflow-hidden relative">
                <div className="flex justify-between items-center mb-6">
                    <motion.div animate={{ boxShadow: [`0 0 10px rgba(245, 158, 11, 0.2)`, `0 0 20px rgba(245, 158, 11, 0.6)`, `0 0 10px rgba(245, 158, 11, 0.2)`], opacity: [1, 0.7, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="flex items-center gap-3 bg-amber-500 px-4 py-2 rounded-2xl border-2 border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                        <div className="p-1.5 bg-white text-amber-500 rounded-lg shadow-inner"><Sparkles size={16} /></div>
                        <h3 className="text-[10px] font-bold text-white uppercase tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">OFERTAS EXCLUSIVAS PARA TI</h3>
                    </motion.div>
                    {banners.length > 1 && (<div className="flex gap-1.5">{banners.map((_, i) => (<div key={i} className={`h-1.5 rounded-full transition-all duration-700 ${i === currentBannerIndex ? 'w-8' : 'w-2.5 bg-slate-200'}`} style={{ backgroundColor: i === currentBannerIndex ? primaryColor : undefined }}></div>))}</div>)}
                </div>
                <div className="relative aspect-[16/11] md:aspect-[21/9] rounded-[2.5rem] overflow-hidden bg-slate-100 shadow-inner group border-4 transition-all duration-500" style={{ borderColor: primaryColor + '40', boxShadow: `0 0 25px ${primaryColor}40, inset 0 0 20px ${primaryColor}20` }}>
                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div key={banners[currentBannerIndex].id} initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '-100%', opacity: 0 }} transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }} className="absolute inset-0">
                            <img src={banners[currentBannerIndex].url} className="w-full h-full object-cover select-none" alt={banners[currentBannerIndex].name} referrerPolicy="no-referrer" />
                            <div className="absolute top-4 right-4 z-20"><button onClick={() => handlePromoClick(banners[currentBannerIndex].name)} style={{ backgroundColor: primaryColor }} className="text-white h-9 px-5 rounded-full font-black text-[9px] uppercase tracking-widest shadow-xl flex items-center gap-2 transition-all active:scale-95 group/btn whitespace-nowrap hover:shadow-2xl hover:translate-y-[-1px] border-2 border-white/50">LO QUIERO <ChevronRight size={12} className="group-hover/btn:translate-x-1 transition-transform" /></button></div>
                            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-5 md:p-8 pointer-events-none text-white "><div className="space-y-1.5"><div className="inline-flex items-center gap-1.5 bg-amber-500 text-black px-2 py-0.5 rounded-lg font-black text-[8px] uppercase tracking-widest shadow-lg">🔥 LIMITADO</div><div className="bg-black/20 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10 w-fit max-w-[80%]"><h4 className="font-bold text-sm md:text-xl uppercase tracking-tight leading-none truncate drop-shadow-lg">{banners[currentBannerIndex].name}</h4></div></div></div>
                        </motion.div>
                    </AnimatePresence>
                </div>
             </div>
          </div>
        )}
      </div>

      {showReceipt && normalizedInvoice && (
          <InvoiceReceipt invoice={normalizedInvoice} company={company} onClose={() => setShowReceipt(false)} hideInternalOrder={true} downloadOnly={true} isTrackingView={true} />
      )}

      {/* BOTÓN FLOTANTE TIENDA */}
      <button onClick={() => setIsStoreModalOpen(true)} style={{ backgroundColor: primaryColor }} className="fixed bottom-28 right-6 w-16 h-16 rounded-full shadow-[0_15px_35px_-5px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-white z-[160] transition-all hover:scale-110 active:scale-90 animate-bounce cursor-pointer group border-4 border-white" title="Tienda Virtual"><Store size={22} strokeWidth={3} className="group-hover:rotate-12 transition-transform" /><span className="text-[7px] font-black uppercase tracking-tighter mt-1">TIENDA</span></button>

      <div className="fixed bottom-0 left-0 right-0 p-4 md:p-8 w-full max-w-5xl mx-auto flex gap-3 z-[150] bg-white/80 backdrop-blur-md border-t border-slate-100 rounded-t-[2.5rem] md:bg-transparent md:border-none md:shadow-none">
          <button onClick={() => { const businessPhone = company?.contactPhone || "51900000000"; const orderRef = invoice?.codigo_orden || pickup?.id || ''; const text = `Hola 👋, quisiera consultar sobre mi pedido #${orderRef}. ¿En qué estado se encuentra?`; window.open(`https://wa.me/${businessPhone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank'); }} className="flex-1 bg-[#25D366] text-white py-4 md:py-5 rounded-[1.5rem] md:rounded-[2rem] font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-[#128C7E] shrink-0"><MessageCircle size={18} /> CONSULTAR POR WHATSAPP</button>
      </div>

       {isStoreModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 flex flex-col animate-in fade-in duration-300">
           <header className="shrink-0 bg-white border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center px-6 md:px-12 py-6 md:h-32 justify-between gap-6 z-30">
              <div className="flex flex-col"><h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight uppercase leading-tight">Servicios Disponibles</h1><p className="text-xs font-medium text-slate-500 tracking-tight">Catálogo digital de nuestra lavandería premium {company?.nombre_sucursal}</p></div>
              <div className="flex items-center gap-3 w-full md:w-auto"><div className="relative flex-1 md:w-80 group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={18} /><input type="text" value={catalogSearchTerm} onChange={(e) => setCatalogSearchTerm(e.target.value)} placeholder="Buscar prenda o servicio..." className="w-full bg-slate-100 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 ring-slate-200 transition-all"/></div><button onClick={() => {}} className="bg-white border border-slate-200 p-3 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"><Filter size={18} strokeWidth={2.5} /></button><button onClick={() => setIsStoreModalOpen(false)} className="bg-slate-800 hover:bg-slate-900 p-3 rounded-2xl text-white transition-all active:scale-95 shadow-xl"><X size={20} strokeWidth={3} /></button></div>
           </header>
           <main className="flex-1 overflow-y-auto p-6 md:p-12 pb-32 custom-scrollbar bg-slate-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 max-w-[1600px] mx-auto">
                {banners.length > 0 && (
                  <div className="relative rounded-[2.5rem] overflow-hidden aspect-[16/11] shadow-xl group border-2 border-white">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div key={banners[currentBannerIndex].id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="absolute inset-0 cursor-pointer" onClick={() => handlePromoClick(banners[currentBannerIndex].name)}>
                          <img src={banners[currentBannerIndex].url} className="w-full h-full object-cover" alt="Promoción" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                          <div className="absolute top-5 left-5"><div className="bg-amber-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg flex items-center gap-1.5"><Sparkles size={10} /> OFERTA ESPECIAL</div></div>
                          <div className="absolute bottom-6 left-6 right-6 text-white text-left "><h4 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight">{banners[currentBannerIndex].name}</h4><p className="text-[10px] font-bold text-amber-200 uppercase tracking-widest mt-1">VIGENTE ESTE MES</p></div>
                        </motion.div>
                      </AnimatePresence>
                      <div className="absolute bottom-5 right-5 flex gap-1.5 z-10">{banners.map((_, i) => (<div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentBannerIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`}></div>))}</div>
                  </div>
                )}
                {catalogProducts.filter(p => { const matchesName = p.name.toLowerCase().includes(catalogSearchTerm.toLowerCase()); const matchesCat = catalogSelectedCategory === 'TODOS' || p.category === catalogSelectedCategory; return matchesName && matchesCat; }).map(product => (
                    <div key={product.id} className="bg-white rounded-[2.5rem] p-4 flex flex-col shadow-sm border border-slate-100/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative">
                       <div className="relative aspect-[16/10] rounded-[2rem] overflow-hidden bg-slate-100 shrink-0 mb-6">
                           {product.imageUrl ? (<img src={product.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={product.name} referrerPolicy="no-referrer" />) : (<div className="w-full h-full flex items-center justify-center text-slate-200"><Shirt size={56} strokeWidth={1} /></div>)}
                           <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent"></div>
                           <div className="absolute top-4 left-4"><div className="bg-amber-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg group-hover:scale-110 transition-transform"><Star size={10} fill="currentColor" /> POPULAR</div></div>
                           <div className="absolute bottom-4 left-5 right-5 text-left "><h3 className="text-white text-xl font-bold uppercase tracking-tight leading-none drop-shadow-md">{product.name}</h3></div>
                       </div>
                       <div className="px-2 flex flex-col flex-1 text-left ">
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-tight leading-relaxed mb-6 line-clamp-2">{product.description || 'Cuidado delicado para tus prendas con tecnología de última generación.'}</p>
                          <div className="flex items-end justify-between mb-8">
                             <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">PRECIO</span><div className="flex items-baseline gap-1"><span className="text-2xl font-black text-slate-800 tabular-nums">{company?.moneda_simbolo || 'S/'}{product.price.toFixed(0)}</span><span className="text-xs font-black text-slate-400 uppercase tracking-tighter">.{product.price.toString().split('.')[1] || '00'} {product.um_saas || '/pza'}</span></div></div>
                             <div className="bg-sky-50 text-sky-400 p-3 rounded-2xl group-hover:bg-sky-500 group-hover:text-white transition-all shadow-sm">{product.category.toLowerCase().includes('lavado') ? <Waves size={20} /> : <Sparkles size={20} />}</div>
                          </div>
                          <button onClick={() => { const businessPhone = company?.contactPhone || "51900000000"; const text = `Hola 👋, estoy interesado en el servicio de "${product.name}" que vi en su Tienda Virtual. Me gustaría solicitar más información.`; window.open(`https://wa.me/${businessPhone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank'); }} className="w-full bg-slate-900 text-white py-4 rounded-[1.5rem] font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-slate-800 active:scale-95 shadow-lg"><Plus size={16} strokeWidth={3} /> AÑADIR AL PEDIDO</button>
                       </div>
                    </div>
                  ))}
                 {catalogProducts.length === 0 && (
                  <div className="col-span-full py-24 text-center space-y-4"><ShoppingBag size={56} className="mx-auto text-slate-200" /><p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Catálogo en preparación...</p></div>
                 )}
              </div>
           </main>
        </div>
      )}

      {isSelfScheduleOpen && (
          <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-white/20">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-white/5"><div className="flex items-center gap-4"><div className="bg-indigo-600 p-2 rounded-xl"><Truck className="text-white" size={24} /></div><div><h3 className="text-xl font-bold uppercase tracking-tight">Agendar Delivery</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Coordinar recojo</p></div></div><button onClick={() => setIsSelfScheduleOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button></div>
                <div className="p-6 flex-1 overflow-y-auto">
                    {saveSuccess ? (
                        <div className="py-10 flex flex-col items-center text-center gap-6 animate-in zoom-in-95 duration-500">
                            <div className="bg-emerald-100 text-emerald-600 p-8 rounded-full ring-[10px] ring-emerald-50"><CheckCircle2 size={64} strokeWidth={3} className="animate-bounce" /></div>
                            <div className="space-y-2"><h4 className="text-xl font-bold text-slate-900 uppercase tracking-tight">¡Registrado!</h4><p className="text-slate-500 font-medium text-[10px] uppercase tracking-widest leading-relaxed px-4">Se enviará un mensaje a la lavandería y en breve se pondrán en contacto con usted.</p></div>
                        </div>
                    ) : (
                        <form onSubmit={handleSelfSchedule} className="space-y-5">
                            <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre Cliente</label><input readOnly value={String(clientNameShow || '').toUpperCase()} className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-100 rounded-2xl font-bold text-slate-500 outline-none text-xs"/></div>
                            <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Teléfono Móvil</label><input required type="tel" value={ssPhone} onChange={e => setSsPhone(e.target.value.replace(/\D/g, ''))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all text-xs" placeholder="999888777"/></div>
                            <div className="space-y-1"><div className="flex justify-between items-center mb-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Dirección</label><button type="button" onClick={() => { if ("geolocation" in navigator) navigator.geolocation.getCurrentPosition(pos => { setSsCoords({lat: pos.coords.latitude, lng: pos.coords.longitude}); setSsMapsUrl(`https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`); }); }} className="flex items-center gap-1 text-[8px] font-bold text-indigo-600 uppercase hover:underline">USAR GPS</button></div><textarea required value={ssAddress} onChange={e => setSsAddress(e.target.value.toUpperCase())} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all text-xs shadow-inner min-h-[70px] resize-none uppercase" placeholder="CALLE, NÚMERO, DISTRITO..."/></div>
                            <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Fecha</label><input type="date" value={ssDate} min={new Date().toISOString().split('T')[0]} onChange={e => setSsDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:bg-white text-xs"/></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Horario</label><select value={ssTime} onChange={e => setSsTime(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:bg-white text-[9px] appearance-none uppercase">{TIME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div></div>
                            <button type="submit" disabled={isSaving} className="w-full text-white font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase text-[10px] tracking-widest" style={{ backgroundColor: primaryColor }}>{isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} strokeWidth={3} />}{isSaving ? 'Agendando...' : 'Confirmar Recojo'}</button>
                        </form>
                    )}
                </div>
              </div>
          </div>
      )}

      {toast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-white/20 text-white font-bold uppercase text-[10px] tracking-widest" style={{ backgroundColor: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : primaryColor }}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : toast.type === 'error' ? <X size={18} /> : <Bell size={18} />}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default Tracking;

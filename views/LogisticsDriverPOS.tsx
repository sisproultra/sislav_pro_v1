
import React, { useState, useEffect, useRef } from 'react';
import { 
    Truck, Package, MapPin, User, Calendar, Clock, CheckCircle2, 
    XCircle, Loader2, ArrowRight, AlertTriangle, RefreshCw, 
    LogOut, Smartphone, Box, Navigation, QrCode, Camera, X,
    Headphones, Repeat, Phone, Hash, CheckCircle, Image as ImageIcon,
    CheckCheck, ShieldCheck, ExternalLink, Gauge, Locate, List, Shirt, PackageCheck
} from 'lucide-react';
import { GuiaRemision, OrderStatus, PickupRequest, Invoice, Company } from '../types';
import { 
    dbGetGuiasRemision, dbUpdateGuiaEstado, dbGetGuiaDetails, 
    dbUpdateGuiaItemStatus, getActiveUserId, dbGetPickupRequests, 
    dbGetInvoices, dbUpdatePickupRequestStatus, dbUpdateInvoiceStatus
} from '../services/dbService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LogisticsDriverPOSProps {
    onLogout: () => void;
    onConvertToOrder?: (pickup: PickupRequest) => void; 
}

import { applyDynamicManifest } from '../utils/pwaUtils';

const LogisticsDriverPOS: React.FC<LogisticsDriverPOSProps> = ({ onLogout, onConvertToOrder }) => {
    const [mainMode, setMainMode] = useState<'LOGISTICS_HUB' | 'CALL_CENTER'>('LOGISTICS_HUB');
    const [guias, setGuias] = useState<GuiaRemision[]>([]);
    const [pickups, setPickups] = useState<PickupRequest[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'PENDIENTES' | 'HISTORIAL' | 'RECOJOS' | 'ENTREGAS'>('PENDIENTES');
    
    const [selectedGuia, setSelectedGuia] = useState<GuiaRemision | null>(null);
    const [guiaItems, setGuiaItems] = useState<any[]>([]);
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [missingItems, setMissingItems] = useState<Record<string, boolean>>({});
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    
    // Evidence Modal State
    const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
    const [selectedDelivery, setSelectedDelivery] = useState<Invoice | null>(null);
    const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]); 
    const [evidenceReason, setEvidenceReason] = useState('ENTREGA EXITOSA');
    const [isSuccess, setIsSuccess] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

    const [showScanner, setShowScanner] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallPrompt, setShowInstallPrompt] = useState(false);
    const [holdingBranding, setHoldingBranding] = useState<any>(null);
    const notifiedGuias = useRef<Set<string>>(new Set());

    // Notification Sound
    const playNotification = () => {
        try {
            // Sonido de burbujas personalizado
            const audio = new Audio('https://yvgshdypqanlcgxdyvls.supabase.co/storage/v1/object/public/laundry-assets/burbujas.mp3');
            audio.volume = 0.6;
            audio.play();
        } catch (e) {
            console.warn("Could not play notification sound", e);
        }
    };

    useEffect(() => {
        loadAllData();

        // Aplicar branding del holding para el PWA de Delivery
        import('../services/dbService').then(async db => {
            const authSessionStr = localStorage.getItem('sislav_auth_session');
            if (authSessionStr) {
                const session = JSON.parse(authSessionStr);
                const holdingId = session.user?.holding_id;
                if (holdingId) {
                    const branding = await db.dbGetHoldingBranding(holdingId);
                    if (branding) {
                        setHoldingBranding(branding);
                        applyDynamicManifest({
                            name: branding.nombre_comercial || branding.nombre_sucursal || 'SISLAV DELIVERY',
                            shortName: (branding.nombre_comercial || branding.nombre_sucursal || 'SISLAV').substring(0, 12),
                            iconUrl: branding.url_favicon_logistica || branding.url_favicon || branding.url_logo,
                            themeColor: branding.color_primario || '#4f8ef7',
                            backgroundColor: branding.color_secundario || '#0d0f14',
                            startUrl: window.location.href
                        });
                        document.title = `${branding.nombre_comercial || branding.nombre_sucursal} - LOGÍSTICA`;
                    }
                }
            }
        });

        // Real-time subscription for new/updated guias
        const channel = (async () => {
            const { supabase } = await import('../services/dbService');
            return supabase
                .channel('guias_remision_changes')
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'guias_remision' 
                }, () => {
                    console.log("🔄 Real-time update: Reloading guias...");
                    loadMyGuias();
                })
                .subscribe();
        })();

        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            channel.then(c => c.unsubscribe());
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        setDeferredPrompt(null);
        setShowInstallPrompt(false);
    };

    const loadAllData = async () => {
        setIsLoading(true);
        try {
            const userId = getActiveUserId();
            const [gData, pData, { invoices: iData }] = await Promise.all([
                dbGetGuiasRemision({ chofer_id: userId! }),
                dbGetPickupRequests(),
                dbGetInvoices()
            ]);

            // Logistics Hub - Guias
            const filteredGuias = gData.filter(g => g.estado === 'PENDIENTE' || g.estado === 'EN_TRANSITO' || g.estado === 'POR_VALIDAR');
            setGuias(filteredGuias);

            // Call Center - Pickups
            setPickups(pData.filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED'));

            // Call Center - Invoices (Deliveries)
            const filteredInvoices = iData.filter(i => {
                const totalItemsCount = i.items.length;
                const readyOrDeliveredItems = i.items.filter(it => it.status === 'LISTO' || it.status === 'ENTREGADO').length;
                const isAllItemsReady = totalItemsCount > 0 && readyOrDeliveredItems === totalItemsCount;
                const isReady = i.orderStatus === 'LISTO' || isAllItemsReady;
                const isInRoute = i.orderStatus === 'EN_RUTA';
                return (i.origin === 'DELIVERY' && (isReady || isInRoute)) || (i.origin === 'TIENDA' && isInRoute);
            });
            setInvoices(filteredInvoices);

            // Notification Logic for Guias
            const pendingIds = filteredGuias.filter(g => g.estado === 'PENDIENTE').map(g => g.id);
            let hasNew = false;
            if (notifiedGuias.current.size === 0) {
                pendingIds.forEach(id => notifiedGuias.current.add(id));
            } else {
                pendingIds.forEach(id => {
                    if (!notifiedGuias.current.has(id)) {
                        notifiedGuias.current.add(id);
                        hasNew = true;
                    }
                });
            }
            if (hasNew) playNotification();

        } catch (error) {
            console.error("Error loading driver data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadMyGuias = loadAllData;

    // Call Center Handlers
    const handleStartRoutePickup = async (pickup: PickupRequest) => {
        setIsLoading(true);
        try {
            await dbUpdatePickupRequestStatus(pickup.id, 'IN_ROUTE');
            await loadAllData();
        } catch (e) { alert("Error al iniciar ruta."); } finally { setIsLoading(false); }
    };

    const handleStartRouteDelivery = async (invoice: Invoice) => {
        setIsLoading(true);
        try {
            await dbUpdateInvoiceStatus(invoice.id, 'EN_RUTA');
            await loadAllData();
        } catch (e) { alert("Error al iniciar ruta de entrega."); } finally { setIsLoading(false); }
    };

    const handleFinishPickup = (pickup: PickupRequest) => {
        if (onConvertToOrder) {
            onConvertToOrder(pickup);
        } else {
            alert("Opción no disponible en este modo.");
        }
    };

    const openEvidenceModal = (invoice: Invoice) => {
        setSelectedDelivery(invoice);
        setEvidencePhotos([]);
        setIsSuccess(true);
        setEvidenceReason('ENTREGA EXITOSA');
        setIsEvidenceModalOpen(true);
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            setCameraStream(stream);
            setCameraActive(true);
        } catch (e: any) { alert("Error accediendo a cámara."); setCameraActive(false); }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0);
            const photoData = canvas.toDataURL('image/jpeg', 0.6);
            if (evidencePhotos.length < 3) setEvidencePhotos(prev => [...prev, photoData]);
            else alert("Máximo 3 fotos permitidas.");
        }
    };

    const stopCamera = () => {
        if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); setCameraStream(null); }
        setCameraActive(false);
    };

    const submitEvidence = async () => {
        if (!selectedDelivery) return;
        if (evidencePhotos.length < 3) { alert("Debe tomar exactamente 3 fotos como evidencia."); return; }
        const status: OrderStatus = isSuccess ? 'ENTREGADO' : 'LISTO';
        setIsUpdating(true);
        try {
            await dbUpdateInvoiceStatus(selectedDelivery.id, status, evidencePhotos);
            setIsEvidenceModalOpen(false);
            stopCamera();
            await loadAllData();
        } catch (e) {
            alert("Error al guardar evidencia.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleViewDetails = async (guia: GuiaRemision) => {
        setSelectedGuia(guia);
        setIsLoadingDetails(true);
        setCheckedItems({});
        setMissingItems({});
        try {
            const items = await dbGetGuiaDetails(guia.id);
            setGuiaItems(items);
            // Si ya está en tránsito, marcar todos como checked por defecto para visualización
            if (guia.estado === 'EN_TRANSITO') {
            // Pre-marcar items que ya están cargados o no son faltantes
            const initialChecked: Record<string, boolean> = {};
            items.forEach((it: any) => {
                const itemId = it.item_venta_id || it.item_id;
                if (it.estado_item !== 'FALTANTE' && itemId) initialChecked[itemId] = true;
            });
            setCheckedItems(initialChecked);
            }
        } catch (error) {
            console.error("Error loading guia details:", error);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const toggleItemCheck = (itemId: string) => {
        if (selectedGuia?.estado !== 'PENDIENTE') return;
        setCheckedItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
        if (missingItems[itemId]) {
            setMissingItems(prev => ({ ...prev, [itemId]: false }));
        }
    };

    const toggleItemMissing = (itemId: string) => {
        if (selectedGuia?.estado !== 'PENDIENTE') return;
        setMissingItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
        if (checkedItems[itemId]) {
            setCheckedItems(prev => ({ ...prev, [itemId]: false }));
        }
    };

    const allItemsProcessed = guiaItems.length > 0 && guiaItems.every(it => {
        const itemId = it.item_venta_id || it.item_id;
        return checkedItems[itemId] || missingItems[itemId];
    });

    const handleUpdateStatus = async (nuevoEstadoGuia: 'EN_TRANSITO' | 'POR_VALIDAR' | 'ENTREGADO') => {
        if (!selectedGuia) return;
        
        let confirmMsg = "";
        if (nuevoEstadoGuia === 'EN_TRANSITO') confirmMsg = "¿Confirmas que has recogido las prendas marcadas?";
        if (nuevoEstadoGuia === 'POR_VALIDAR') confirmMsg = "¿Confirmas que has llegado al destino y entregarás la carga?";
        if (nuevoEstadoGuia === 'ENTREGADO') confirmMsg = "¿Confirmas que has entregado las prendas en el destino?";
            
        if (!window.confirm(confirmMsg)) return;

        setIsUpdating(true);
        try {
            const itemsToProcess = Object.keys(checkedItems).filter(id => checkedItems[id]);
            const itemsMissing = Object.keys(missingItems).filter(id => missingItems[id]);

            // 1. Faltantes
            for (const itemId of itemsMissing) {
                await dbUpdateGuiaItemStatus(selectedGuia.id, itemId, 'FALTANTE');
            }

            // 2. Cargados
            for (const itemId of itemsToProcess) {
                await dbUpdateGuiaItemStatus(selectedGuia.id, itemId, 'CARGADO');
            }

            // 3. Status logic
            let nuevoEstadoItem: OrderStatus;
            if (nuevoEstadoGuia === 'EN_TRANSITO') {
                nuevoEstadoItem = selectedGuia.tipo_guia === 'RECOJO' ? 'EN_TRANSITO_CENTRAL' : 'EN_TRANSITO_ACOPIO';
            } else if (nuevoEstadoGuia === 'POR_VALIDAR') {
                // Sigue en tránsito pero ya en la puerta del destino
                nuevoEstadoItem = selectedGuia.tipo_guia === 'RECOJO' ? 'EN_TRANSITO_CENTRAL' : 'EN_TRANSITO_ACOPIO';
            } else {
                nuevoEstadoItem = selectedGuia.tipo_guia === 'RECOJO' ? 'RECIBIDO_CENTRAL' : 'RECIBIDO_ACOPIO';
            }

            await dbUpdateGuiaEstado(selectedGuia.id, nuevoEstadoGuia, nuevoEstadoItem, itemsToProcess);
            
            setSelectedGuia(null);
            loadAllData();
        } catch (error) {
            console.error("Error updating logistics status:", error);
            alert("Error al actualizar el estado.");
        } finally {
            setIsUpdating(false);
        }
    };

    const groupedItems = guiaItems.reduce((acc: any, item: any) => {
        const orderId = item.items_venta?.ventas?.id || 'no-order';
        if (!acc[orderId]) acc[orderId] = { 
            orderNumber: item.items_venta?.ventas?.codigo_orden || '---',
            client: item.items_venta?.ventas?.clientes?.nombre_completo || item.items_venta?.ventas?.clientes?.nombres,
            items: [] 
        };
        acc[orderId].items.push(item);
        return acc;
    }, {});

    if (selectedGuia) {
        return (
            <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-4 bg-slate-900 text-white shrink-0 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedGuia(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowRight className="rotate-180" size={20} />
                        </button>
                        <div>
                            <h3 className="font-extrabold text-lg leading-none">{selectedGuia.codigo_guia}</h3>
                            <p className="text-[8px] font-bold text-white/50 uppercase tracking-[0.2em] mt-1">{selectedGuia.tipo_guia}</p>
                        </div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        selectedGuia.estado === 'PENDIENTE' ? 'bg-amber-500 text-white' : 
                        selectedGuia.estado === 'POR_VALIDAR' ? 'bg-orange-500 text-white animate-pulse' :
                        'bg-blue-500 text-white'
                    }`}>
                        {selectedGuia.estado === 'POR_VALIDAR' ? 'POR VALIDAR' : selectedGuia.estado}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                    {/* ROUTE INFO */}
                    <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <MapPin size={16} />
                            </div>
                            <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Origen</p>
                                <p className="font-black text-slate-800 text-xs">{selectedGuia.sucursal_origen?.nombre_sucursal}</p>
                                <p className="text-[10px] text-slate-500 line-clamp-1">{selectedGuia.sucursal_origen?.direccion}</p>
                            </div>
                        </div>
                        <div className="ml-4 border-l border-dashed border-slate-200 h-4" />
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                <Navigation size={16} />
                            </div>
                            <div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Destino</p>
                                <p className="font-black text-slate-800 text-xs">{selectedGuia.sucursal_destino?.nombre_sucursal}</p>
                                <p className="text-[10px] text-slate-500 line-clamp-1">{selectedGuia.sucursal_destino?.direccion}</p>
                            </div>
                        </div>
                    </div>

                    {/* ITEMS LIST */}
                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Package size={12} /> Contenido
                        </h4>
                        <div className="space-y-2">
                            {isLoadingDetails ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-accent" size={24} /></div>
                            ) : (
                                Object.entries(groupedItems).map(([orderId, group]: [string, any]) => (
                                    <div key={orderId} className="space-y-2">
                                        <div className="flex items-center gap-2 px-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
                                                O#{group.orderNumber} • {group.client}
                                            </span>
                                        </div>
                                        {group.items.map((item: any, idx: number) => {
                                            const itemId = item.item_venta_id || item.item_id;
                                            return (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => toggleItemCheck(itemId)}
                                                    className={`bg-white p-3 rounded-xl border transition-all shadow-sm flex items-center gap-3 cursor-pointer ${
                                                        checkedItems[itemId] ? 'border-emerald-200 bg-emerald-50/10' : 
                                                        missingItems[itemId] ? 'border-rose-200 bg-rose-50/10' : 'border-slate-100'
                                                    }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                        checkedItems[itemId] ? 'bg-emerald-100 text-emerald-600' : 
                                                        missingItems[itemId] ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-400'
                                                    }`}>
                                                        {checkedItems[itemId] ? <CheckCircle2 size={16} /> : 
                                                         missingItems[itemId] ? <XCircle size={16} /> : <Box size={16} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-black text-slate-800 leading-none truncate">{item.items_venta?.descripcion}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                            {item.items_venta?.cantidad} {item.items_venta?.codigo_unidad}
                                                        </p>
                                                    </div>
                                                    {selectedGuia.estado === 'PENDIENTE' && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); toggleItemMissing(itemId); }}
                                                            className={`p-1.5 rounded-lg transition-colors ${missingItems[itemId] ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-600'}`}
                                                        >
                                                            <AlertTriangle size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                    {selectedGuia.estado === 'PENDIENTE' ? (
                        <button
                            onClick={() => handleUpdateStatus('EN_TRANSITO')}
                            disabled={isUpdating || !allItemsProcessed}
                            className="w-full py-4 bg-accent text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-accent/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                        >
                            {isUpdating ? <Loader2 className="animate-spin" size={18} /> : <><Truck size={18} /> INICIAR TRASLADO</>}
                        </button>
                    ) : selectedGuia.estado === 'EN_TRANSITO' ? (
                        <button
                            onClick={() => handleUpdateStatus('POR_VALIDAR')}
                            disabled={isUpdating}
                            className="w-full py-4 bg-orange-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-orange-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
                        >
                            {isUpdating ? <Loader2 className="animate-spin" size={18} /> : <><MapPin size={18} /> LLEGUÉ AL DESTINO</>}
                        </button>
                    ) : selectedGuia.estado === 'POR_VALIDAR' ? (
                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex flex-col items-center gap-2 text-center">
                            <Clock className="text-orange-500 animate-pulse" size={24} />
                            <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Esperando Validación</p>
                            <p className="text-[9px] font-bold text-orange-600 uppercase opacity-70">El receptor debe confirmar la llegada de las prendas</p>
                        </div>
                    ) : (
                        <button
                            onClick={() => handleUpdateStatus('ENTREGADO')}
                            disabled={isUpdating}
                            className="w-full py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
                        >
                            {isUpdating ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> CONFIRMAR ENTREGA</>}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
            {/* Header Main Toggle */}
            <div className="bg-slate-900 p-1 flex gap-1 shrink-0">
                <button 
                    onClick={() => { setMainMode('LOGISTICS_HUB'); setActiveTab('PENDIENTES'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${mainMode === 'LOGISTICS_HUB' ? 'bg-white text-slate-900 shadow-md' : 'text-white/40 hover:text-white'}`}
                >
                    <Repeat size={14} /> LOGÍSTICA HUB
                </button>
                <button 
                    onClick={() => { setMainMode('CALL_CENTER'); setActiveTab('RECOJOS'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${mainMode === 'CALL_CENTER' ? 'bg-white text-slate-900 shadow-md' : 'text-white/40 hover:text-white'}`}
                >
                    <Headphones size={14} /> CALL CENTER
                </button>
            </div>

            {/* MOBILE HEADER */}
            <header className="p-3 bg-white border-b border-slate-200 shrink-0 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-lg shadow-accent/20" style={{ backgroundColor: mainMode === 'LOGISTICS_HUB' ? '#22c55e' : '#4f8ef7' }}>
                        {mainMode === 'LOGISTICS_HUB' ? <Repeat size={16} /> : <Headphones size={16} />}
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-slate-800 leading-none uppercase tracking-tighter">SISLAV {mainMode === 'LOGISTICS_HUB' ? 'Logística' : 'Delivery'}</h1>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Control de Chofer</p>
                    </div>
                </div>
                <div className="flex gap-1.5">
                    <button onClick={loadAllData} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-all"><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /></button>
                    <button 
                        onClick={onLogout}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            {/* SUB-TABS */}
            <div className="flex bg-white border-b border-slate-100 p-2 gap-2 shrink-0">
                {mainMode === 'LOGISTICS_HUB' ? (
                    <>
                        <button 
                            onClick={() => setActiveTab('PENDIENTES')} 
                            className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'PENDIENTES' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
                        >
                            ASIGNADOS {guias.filter(g => g.estado === 'PENDIENTE').length > 0 && <span className="ml-1 bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[7px]">{guias.filter(g => g.estado === 'PENDIENTE').length}</span>}
                        </button>
                        <button 
                            onClick={() => setActiveTab('HISTORIAL')} 
                            className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'HISTORIAL' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
                        >
                            EN CUSTODIA {guias.filter(g => g.estado !== 'PENDIENTE').length > 0 && <span className="ml-1 bg-emerald-500 text-white px-1.5 py-0.5 rounded-full text-[7px]">{guias.filter(g => g.estado !== 'PENDIENTE').length}</span>}
                        </button>
                    </>
                ) : (
                    <>
                        <button 
                            onClick={() => setActiveTab('RECOJOS')} 
                            className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'RECOJOS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
                        >
                            RECOJOS {pickups.length > 0 && <span className="bg-indigo-500 text-white px-2 py-0.5 rounded-full">{pickups.length}</span>}
                        </button>
                        <button 
                            onClick={() => setActiveTab('ENTREGAS')} 
                            className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'ENTREGAS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
                        >
                            ENTREGAS {invoices.length > 0 && <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full">{invoices.length}</span>}
                        </button>
                    </>
                )}
            </div>

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="animate-spin text-accent" size={40} />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargando tareas...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* LOGISTICS HUB ITEMS */}
                        {mainMode === 'LOGISTICS_HUB' && (
                            <div className="space-y-4">
                                {activeTab === 'PENDIENTES' ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-1">
                                            <List size={14} className="text-amber-500" />
                                            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Guías por Recoger</h3>
                                        </div>
                                        <div className="space-y-2">
                                            {guias.filter(g => g.estado === 'PENDIENTE').length === 0 ? (
                                                <div className="bg-slate-100/50 border border-dashed border-slate-200 rounded-2xl p-6 text-center">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Sin guías pendientes de recojo</p>
                                                </div>
                                            ) : (
                                                guias.filter(g => g.estado === 'PENDIENTE').map((guia) => (
                                                    <button
                                                        key={guia.id}
                                                        onClick={() => handleViewDetails(guia)}
                                                        className="w-full bg-white p-3 rounded-2xl border border-slate-100 shadow-sm text-left flex items-center justify-between active:scale-[0.98] transition-all"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                                                                <Truck size={16} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-extrabold text-slate-800 text-xs">{guia.codigo_guia}</h4>
                                                                    <span className="text-[7px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                                                        {guia.sucursal_origen?.nombre_sucursal}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1 mt-0.5 opacity-60">
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase truncate max-w-[80px]">{guia.sucursal_origen?.distrito || 'Origen'}</span>
                                                                    <ArrowRight size={8} className="text-slate-300" />
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase truncate max-w-[80px]">{guia.sucursal_destino?.nombre_sucursal}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <ArrowRight size={14} className="text-slate-300" />
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-1">
                                            <ShieldCheck size={14} className="text-emerald-500" />
                                            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Carga bajo mi Custodia</h3>
                                        </div>
                                        <div className="space-y-2">
                                            {guias.filter(g => g.estado !== 'PENDIENTE').length === 0 ? (
                                                <div className="bg-slate-100/50 border border-dashed border-slate-200 rounded-2xl p-6 text-center">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">No tienes carga bajo custodia actualmente</p>
                                                </div>
                                            ) : (
                                                guias.filter(g => g.estado !== 'PENDIENTE').map((guia) => (
                                                    <button
                                                        key={guia.id}
                                                        onClick={() => handleViewDetails(guia)}
                                                        className={`w-full p-4 rounded-3xl border text-left flex items-center justify-between active:scale-[0.98] transition-all ${
                                                            guia.estado === 'POR_VALIDAR' 
                                                                ? 'bg-orange-50 border-orange-200 ring-2 ring-orange-100' 
                                                                : 'bg-emerald-50/50 border-emerald-100'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                                                guia.estado === 'POR_VALIDAR' ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'
                                                            }`}>
                                                                {guia.estado === 'POR_VALIDAR' ? <Clock size={16} className="animate-pulse" /> : <PackageCheck size={16} />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-extrabold text-slate-900 text-xs">{guia.codigo_guia}</h4>
                                                                    <span className="text-[7px] font-black bg-white/50 text-slate-700 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                                                        {guia.sucursal_origen?.nombre_sucursal}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate">
                                                                    Entrega: {guia.sucursal_destino?.nombre_sucursal}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[7px] font-black px-2 py-1 rounded-full uppercase ${
                                                                guia.estado === 'POR_VALIDAR' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-emerald-100 text-emerald-600'
                                                            }`}>
                                                                {guia.estado === 'POR_VALIDAR' ? 'POR VALIDAR' : 'EN RUTA'}
                                                            </span>
                                                            <ArrowRight size={14} className="text-slate-300" />
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CALL CENTER - RECOJOS */}
                        {mainMode === 'CALL_CENTER' && activeTab === 'RECOJOS' && pickups.map(p => (
                            <div key={p.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-black text-slate-800 uppercase leading-none text-xs">{p.clientName}</h3>
                                        <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase mt-1.5"><Clock size={10}/> {p.timeRange}</div>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase mt-1.5 line-clamp-1"><MapPin size={10} className="inline mr-1" /> {p.address}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <a href={`tel:${p.phone}`} className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg"><Phone size={14}/></a>
                                    </div>
                                </div>
                                {p.status === 'IN_ROUTE' ? (
                                    <button onClick={() => handleFinishPickup(p)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"><Shirt size={16} /> RECOGER PRENDAS</button>
                                ) : (
                                    <button onClick={() => handleStartRoutePickup(p)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl"><Navigation size={16} /> INICIAR RUTA</button>
                                )}
                            </div>
                        ))}

                        {/* CALL CENTER - ENTREGAS */}
                        {mainMode === 'CALL_CENTER' && activeTab === 'ENTREGAS' && invoices.map(inv => (
                            <div key={inv.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-black text-slate-800 uppercase leading-none text-xs">{inv.client.name}</h3>
                                        <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase mt-1.5"><Hash size={10}/> O#{inv.ordenNumber}</div>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase mt-1.5 line-clamp-1"><MapPin size={10} className="inline mr-1" /> {inv.client.address}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <a href={`tel:${inv.client.phone}`} className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg"><Phone size={14}/></a>
                                    </div>
                                </div>
                                {inv.orderStatus === 'EN_RUTA' ? (
                                    <button onClick={() => openEvidenceModal(inv)} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"><PackageCheck size={16} /> FINALIZAR ENTREGA</button>
                                ) : (
                                    <button onClick={() => handleStartRouteDelivery(inv)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"><Navigation size={16} /> INICIAR RUTA</button>
                                )}
                            </div>
                        ))}

                        {/* EMPTY STATES */}
                        {((mainMode === 'LOGISTICS_HUB' && activeTab === 'PENDIENTES' && guias.length === 0) ||
                          (mainMode === 'CALL_CENTER' && activeTab === 'RECOJOS' && pickups.length === 0) ||
                          (mainMode === 'CALL_CENTER' && activeTab === 'ENTREGAS' && invoices.length === 0)) && (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center p-10">
                                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                                    <Box size={32} className="text-slate-200" />
                                </div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">Todo al día</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">No tienes tareas pendientes en esta sección.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>


            {/* EVIDENCE MODAL */}
            {isEvidenceModalOpen && selectedDelivery && (
                <div className="fixed inset-0 bg-slate-950/95 z-[500] flex flex-col animate-in fade-in">
                    <div className="h-20 bg-slate-900 text-white flex justify-between items-center px-6 shrink-0 border-b border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                                <Truck size={20} className="text-accent" />
                            </div>
                            <div>
                                <h3 className="font-black text-sm uppercase tracking-widest">Evidencia de Entrega</h3>
                                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Orden #{selectedDelivery.ordenNumber}</p>
                            </div>
                        </div>
                        <button onClick={() => { stopCamera(); setIsEvidenceModalOpen(false); }} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center">
                        <div className="w-full max-w-xl space-y-8">
                            <div className="flex gap-2">
                                <button onClick={() => setIsSuccess(true)} className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all border-2 ${isSuccess ? 'bg-emerald-600 border-emerald-500 text-white shadow-xl shadow-emerald-600/20' : 'bg-white text-slate-400 border-slate-100'}`}><CheckCircle size={20} className="mx-auto mb-2" /> EXITOSA</button>
                                <button onClick={() => setIsSuccess(false)} className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all border-2 ${!isSuccess ? 'bg-rose-600 border-rose-500 text-white shadow-xl shadow-rose-600/20' : 'bg-white text-slate-400 border-slate-100'}`}><XCircle size={20} className="mx-auto mb-2" /> FALLIDA</button>
                            </div>
                            <div className="relative aspect-square bg-slate-900 rounded-[3rem] overflow-hidden border-8 border-slate-900 shadow-2xl flex items-center justify-center group ring-1 ring-white/10">
                                {cameraActive ? (
                                    <>
                                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 border-2 border-white/20 rounded-[2.5rem] pointer-events-none" />
                                        <button onClick={capturePhoto} disabled={evidencePhotos.length >= 3} className="absolute bottom-10 bg-white text-slate-900 p-8 rounded-full shadow-2xl active:scale-90 transition-transform"><Camera size={40}/></button>
                                    </>
                                ) : (
                                    <button onClick={startCamera} className="flex flex-col items-center gap-4 text-white/30 hover:text-white transition-colors bg-white/5 w-full h-full"><Camera size={64} strokeWidth={1}/><span className="text-xs font-black uppercase tracking-[0.3em]">Habilitar Cámara</span></button>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {[0,1,2].map(idx => (
                                    <div key={idx} className="aspect-square bg-slate-900 rounded-3xl border-2 border-white/5 overflow-hidden relative shadow-inner">
                                        {evidencePhotos[idx] ? (<><img src={evidencePhotos[idx]} className="w-full h-full object-cover" /><button onClick={() => setEvidencePhotos(prev => prev.filter((_, i) => i !== idx))} className="absolute top-2 right-2 bg-rose-600 text-white p-1 rounded-full"><X size={10}/></button></>) : (<ImageIcon size={24} className="absolute inset-0 m-auto text-white/5" />)}
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Observación</label>
                                <textarea value={evidenceReason} onChange={e => setEvidenceReason(e.target.value.toUpperCase())} className="w-full bg-slate-900 border border-white/10 rounded-2xl p-6 text-white text-sm font-bold uppercase resize-none h-28 focus:border-accent outline-none" />
                            </div>
                            <button onClick={submitEvidence} disabled={evidencePhotos.length < 3 || isUpdating} className="w-full py-5 bg-white text-slate-900 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3">
                                {isUpdating ? <Loader2 className="animate-spin" /> : 'CONSOLIDAR ENTREGA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PWA INSTALL PROMPT */}
            {showInstallPrompt && (
                <div className="fixed bottom-24 left-4 right-4 bg-accent text-white p-6 rounded-[2.5rem] shadow-2xl z-[300] animate-in slide-in-from-bottom-10 duration-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                            <Smartphone size={24} />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-black text-sm uppercase tracking-widest">Instalar Aplicación</h4>
                            <p className="text-[10px] font-bold opacity-80 leading-tight mt-1">
                                Instala SISLAV LOGÍSTICA en tu pantalla de inicio para un acceso más rápido y mejor experiencia.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={handleInstallClick}
                                className="px-4 py-2 bg-white text-accent rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                            >
                                INSTALAR
                            </button>
                            <button 
                                onClick={() => setShowInstallPrompt(false)}
                                className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100"
                            >
                                LUEGO
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default LogisticsDriverPOS;

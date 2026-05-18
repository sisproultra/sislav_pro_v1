import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PickupRequest, Company, Invoice, OrderStatus, GuiaRemision } from '../types';
import { dbGetPickupRequests, dbUpdatePickupRequestStatus, dbGetInvoices, dbUpdateInvoiceStatus } from '../services/dbService';
import { 
    Truck, MapPin, Navigation, Phone, Calendar, CheckCircle, CheckCircle2, 
    XCircle, Camera, X, RefreshCw, MessageCircle, Trash2, AlertTriangle, 
    Loader2, CheckCheck, Check, List, Siren, Target, Shirt, PackageCheck, 
    Info, Gauge, ExternalLink, Image as ImageIcon, Locate, Map as MapIcon, 
    Printer, Smartphone, Clock, Bell, Hash, Headphones, Repeat, Box
} from 'lucide-react';
import { sendInvoiceViaWhatsApp, generateWhatsAppLink } from '../services/whatsappService';
import LeafletMap from '../components/LeafletMap';
import OrderPrintModal from '../components/OrderPrintModal';
import { dbGetGuiasRemision, dbUpdateGuiaEstado, dbGetGuiaDetails, dbUpdateGuiaItemStatus, getActiveUserId } from '../services/dbService';

interface DeliveryProps {
  onConvertToOrder: (pickup: PickupRequest) => void; 
  company: Company;
}

interface RouteInfo {
    path: [number, number][];
    distance: number;
    duration: number;
}

interface GuiaRemisionExtended extends GuiaRemision {
    clientName?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
}

const Delivery: React.FC<DeliveryProps> = ({ onConvertToOrder, company }) => {
  const [mainMode, setMainMode] = useState<'CALL_CENTER' | 'LOGISTICS_HUB'>('CALL_CENTER');
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [guias, setGuias] = useState<GuiaRemisionExtended[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setSelectedTab] = useState<'RECOJOS' | 'ENTREGAS' | 'COMPLETED'>('RECOJOS');
  
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteInfo | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // States para Logística
  const [selectedGuiaItems, setSelectedGuiaItems] = useState<any[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [missingItems, setMissingItems] = useState<Record<string, boolean>>({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // States para WhatsApp e Impresión
  const [sendingWaId, setSendingWaId] = useState<string | null>(null);
  const [sentSuccessIds, setSentSuccessIds] = useState<Set<string>>(new Set());
  const [selectedOrderToPrint, setSelectedOrderToPrint] = useState<Invoice | null>(null);

  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Invoice | null>(null);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]); 
  const [evidenceReason, setEvidenceReason] = useState('ENTREGA EXITOSA');
  const [isSuccess, setIsSuccess] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const primaryColor = document.documentElement.style.getPropertyValue('--brand-primary').trim() || '#0054A6';

  useEffect(() => {
    loadData();
    startLocationTracking();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (cameraActive && cameraStream && videoRef.current) {
        videoRef.current.srcObject = cameraStream;
    }
  }, [cameraActive, cameraStream]);

  useEffect(() => {
    const controller = new AbortController();
    if (selectedItemId && userLocation) {
        calculateBestRoute(controller.signal);
    }
    return () => controller.abort();
  }, [selectedItemId, userLocation]);

  const startLocationTracking = () => {
      if ("geolocation" in navigator) {
          const options = { enableHighAccuracy: true, timeout: 30000, maximumAge: 30000 };
          const handleSuccess = (pos: GeolocationPosition) => {
              setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          };
          const handleError = (err: GeolocationPositionError) => {
              console.warn(`GPS Warning (${err.code}): ${err.message}`);
          };
          navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
          navigator.geolocation.watchPosition(handleSuccess, handleError, options);
      }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
        const userId = getActiveUserId();
        const [pData, { invoices: iData }, gData] = await Promise.all([
            dbGetPickupRequests(), 
            dbGetInvoices(),
            dbGetGuiasRemision({ chofer_id: userId! })
        ]);

        setPickups(pData);
        setInvoices(iData);

        // Mapear guías para que funcionen con el mapa
        const mappedGuias = gData.map(g => {
            const isDelivered = g.estado === 'ENTREGADO';
            const targetLat = g.estado === 'PENDIENTE' ? g.sucursal_origen?.latitud : g.sucursal_destino?.latitud;
            const targetLng = g.estado === 'PENDIENTE' ? g.sucursal_origen?.longitud : g.sucursal_destino?.longitud;
            
            return {
                ...g,
                clientName: `${g.codigo_guia} - ${g.tipo_guia}`,
                address: g.estado === 'PENDIENTE' ? g.sucursal_origen?.nombre_sucursal : g.sucursal_destino?.nombre_sucursal,
                latitude: targetLat,
                longitude: targetLng
            };
        });
        setGuias(mappedGuias);
    } catch (e) {
        console.error("Error loading delivery data", e);
    } finally {
        setIsLoading(false);
    }
  };

  const calculateBestRoute = async (signal?: AbortSignal) => {
    if (!selectedItemId || !userLocation) return;
    const target = pickups.find(p => p.id === selectedItemId) || invoices.find(inv => inv.id === selectedItemId) || guias.find(g => g.id === selectedItemId);
    if (!target) return;
    
    let lat: number | undefined;
    let lng: number | undefined;

    if ('latitude' in target) {
        lat = (target as any).latitude;
        lng = (target as any).longitude;
    } else {
        const inv = target as Invoice;
        lat = inv.client?.latitude;
        lng = inv.client?.longitude;
    }

    if (!lat || !lng) { setActiveRoute(null); return; }
    
    setIsCalculatingRoute(true);
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${lng},${lat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal });
        const data = await res.json();
        
        if (!signal?.aborted && data.code === 'Ok' && data.routes.length > 0) {
            const route = data.routes[0];
            const coordinates: [number, number][] = route.geometry.coordinates.map((coord: any) => [coord[1], coord[0]]);
            setActiveRoute({ path: coordinates, distance: route.distance, duration: route.duration });
        }
    } catch (e: any) { 
        if (e.name !== 'AbortError') {
            console.error("Error calculando ruta:", e); 
        }
    } finally {
        setIsCalculatingRoute(false);
    }
  };

  const handleCall = (phone: string) => window.open(`tel:${phone}`);

  const handleItemSelect = async (id: string) => {
      setSelectedItemId(prev => prev === id ? null : id);
      if (selectedItemId === id) {
          setActiveRoute(null);
          setSelectedGuiaItems([]);
      } else {
          // Si es una guía, cargar sus items
          const foundGuia = guias.find(g => g.id === id);
          if (foundGuia) {
              loadGuiaDetails(foundGuia);
          }
      }
      if (window.innerWidth < 768 && id !== selectedItemId) setMobileView('map');
  };

  const loadGuiaDetails = async (guia: GuiaRemision) => {
      setIsLoadingDetails(true);
      setCheckedItems({});
      setMissingItems({});
      try {
          const items = await dbGetGuiaDetails(guia.id);
          setSelectedGuiaItems(items);
          if (guia.estado === 'EN_TRANSITO') {
              const initialChecked: Record<string, boolean> = {};
              items.forEach((it: any) => {
                  const itemId = it.item_venta_id || it.item_id;
                  if (it.estado_item !== 'FALTANTE' && itemId) initialChecked[itemId] = true;
              });
              setCheckedItems(initialChecked);
          }
      } catch (e) {
          console.error("Error loading guia details", e);
      } finally {
          setIsLoadingDetails(false);
      }
  };

  const handleUpdateGuiaStatus = async (guia: GuiaRemision, nuevoEstadoGuia: 'EN_TRANSITO' | 'ENTREGADO') => {
      const confirmMsg = nuevoEstadoGuia === 'EN_TRANSITO' 
          ? "¿Confirmas que has recogido las prendas marcadas y están bajo tu custodia?"
          : "¿Confirmas que has entregado las prendas en el destino?";
          
      if (!window.confirm(confirmMsg)) return;

      setIsLoading(true);
      try {
          const itemsToProcess = Object.keys(checkedItems).filter(id => checkedItems[id]);
          const itemsMissing = Object.keys(missingItems).filter(id => missingItems[id]);

          for (const itemId of itemsMissing) {
              await dbUpdateGuiaItemStatus(guia.id, itemId, 'FALTANTE');
          }

          for (const itemId of itemsToProcess) {
              await dbUpdateGuiaItemStatus(guia.id, itemId, 'CARGADO');
          }

          let nuevoEstadoItem: OrderStatus;
          if (nuevoEstadoGuia === 'EN_TRANSITO') {
              nuevoEstadoItem = guia.tipo_guia === 'RECOJO' ? 'EN_TRANSITO_CENTRAL' : 'EN_TRANSITO_ACOPIO';
          } else {
              nuevoEstadoItem = guia.tipo_guia === 'RECOJO' ? 'RECIBIDO_CENTRAL' : 'RECIBIDO_ACOPIO';
          }

          await dbUpdateGuiaEstado(guia.id, nuevoEstadoGuia, nuevoEstadoItem, itemsToProcess);
          
          setSelectedItemId(null);
          await loadData();
      } catch (error) {
          console.error("Error updating logistics status:", error);
          alert("Error al actualizar el estado.");
      } finally {
          setIsLoading(false);
      }
  };

  const toggleItemCheck = (itemId: string) => {
      setCheckedItems(prev => ({
          ...prev,
          [itemId]: !prev[itemId]
      }));
      if (!checkedItems[itemId]) {
          setMissingItems(prev => ({ ...prev, [itemId]: false }));
      }
  };

  const toggleItemMissing = (itemId: string) => {
      setMissingItems(prev => ({
          ...prev,
          [itemId]: !prev[itemId]
      }));
      if (!missingItems[itemId]) {
          setCheckedItems(prev => ({ ...prev, [itemId]: false }));
      }
  };

  const handleStartRoutePickup = async (pickup: PickupRequest) => {
      setIsLoading(true);
      try {
          await dbUpdatePickupRequestStatus(pickup.id, 'IN_ROUTE');
          setSelectedItemId(pickup.id);
          if (window.innerWidth < 768) setMobileView('map');
          await loadData();
      } catch (e) { alert("Error al iniciar ruta."); } finally { setIsLoading(false); }
  };

  const handleStartRouteDelivery = async (invoice: Invoice) => {
      setIsLoading(true);
      try {
          if (invoice.orderStatus === 'LISTO') {
              await dbUpdateInvoiceStatus(invoice.id, 'EN_RUTA');
              setSelectedItemId(invoice.id);
              if (window.innerWidth < 768) setMobileView('map');
              await loadData();
          }
      } catch (e) { alert("Error al iniciar ruta de entrega."); } finally { setIsLoading(false); }
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
      await dbUpdateInvoiceStatus(selectedDelivery.id, status, evidencePhotos);
      setIsEvidenceModalOpen(false);
      stopCamera();
      loadData();
  };

  const selectedItemData = [...pickups, ...invoices.map(i => ({...i, clientName: i.client.name, address: i.client.address, latitude: i.client.latitude, longitude: i.client.longitude})), ...guias].find(i => i.id === selectedItemId);

  const filteredInvoicesForDelivery = invoices.filter(i => {
    const totalItemsCount = i.items.length;
    const readyOrDeliveredItems = i.items.filter(it => it.status === 'LISTO' || it.status === 'ENTREGADO').length;
    const isAllItemsReady = totalItemsCount > 0 && readyOrDeliveredItems === totalItemsCount;
    const isReady = i.orderStatus === 'LISTO' || isAllItemsReady;
    const isInRoute = i.orderStatus === 'EN_RUTA';
    return (i.origin === 'DELIVERY' && (isReady || isInRoute)) || (i.origin === 'TIENDA' && isInRoute);
  });

  const mapMarkers = useMemo(() => {
    if (mainMode === 'LOGISTICS_HUB') {
        const filteredGuias = activeTab === 'COMPLETED' 
            ? guias.filter(g => g.estado === 'ENTREGADO') 
            : guias.filter(g => g.estado === 'PENDIENTE' || g.estado === 'EN_TRANSITO');
        
        return filteredGuias.map(g => ({
            ...g,
            status: g.estado === 'ENTREGADO' ? 'COMPLETED' : g.estado
        })) as unknown as PickupRequest[];
    }

    if (activeTab === 'RECOJOS') {
        return pickups.filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED');
    }
    if (activeTab === 'ENTREGAS') {
        return filteredInvoicesForDelivery.map(inv => ({
            ...inv,
            clientName: inv.client.name,
            address: inv.client.address,
            latitude: inv.client.latitude,
            longitude: inv.client.longitude,
            status: inv.orderStatus 
        })) as unknown as PickupRequest[];
    }
    if (activeTab === 'COMPLETED') {
        const compPickups = pickups.filter(p => p.status === 'COMPLETED');
        const compDeliveries = invoices.filter(i => i.orderStatus === 'ENTREGADO').map(inv => ({
            ...inv,
            clientName: inv.client.name,
            address: inv.client.address,
            latitude: inv.client.latitude,
            longitude: inv.client.longitude,
            status: 'COMPLETED'
        })) as unknown as PickupRequest[];
        return [...compPickups, ...compDeliveries];
    }
    return [];
  }, [activeTab, pickups, filteredInvoicesForDelivery, invoices, mainMode, guias]);

  const pendingPickupsCount = pickups.filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED').length;
  const pendingDeliveriesCount = filteredInvoicesForDelivery.length;
  const pendingLogisticsCount = guias.filter(g => g.estado === 'PENDIENTE' || g.estado === 'EN_TRANSITO').length;

  return (
    <div className="h-full bg-slate-100 flex flex-col md:flex-row overflow-hidden relative">
        <aside className={`${mobileView === 'list' ? 'flex' : 'hidden'} md:flex w-full md:w-[420px] bg-white border-r border-slate-200 flex-col z-20 shadow-xl shrink-0 h-full`}>
            {/* Header Main Toggle */}
            <div className="bg-slate-900 p-2 flex gap-1 shrink-0">
                <button 
                    onClick={() => { setMainMode('CALL_CENTER'); setSelectedItemId(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${mainMode === 'CALL_CENTER' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    <Headphones size={16} /> CALL CENTER
                </button>
                <button 
                    onClick={() => { setMainMode('LOGISTICS_HUB'); setSelectedItemId(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${mainMode === 'LOGISTICS_HUB' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    <Repeat size={16} /> LOGISTICA HUB
                </button>
            </div>

            <div className="p-4 md:p-6 border-b border-white/10 text-white shrink-0" style={{ backgroundColor: mainMode === 'LOGISTICS_HUB' ? '#0F172A' : primaryColor }}>
                <div className="flex justify-between items-center mb-1">
                    <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight flex items-center gap-3">
                        <Truck size={28} /> {mainMode === 'LOGISTICS_HUB' ? 'LOGÍSTICA' : 'DELIVERY'}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={startLocationTracking} className="p-2 md:p-2.5 bg-white/20 rounded-xl hover:bg-white/30 transition-all"><Locate size={18} className={userLocation ? 'text-green-300' : 'animate-pulse text-white'} /></button>
                        <button onClick={loadData} className="p-2 md:p-2.5 bg-white/20 rounded-xl hover:bg-white/30 transition-all"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /></button>
                    </div>
                </div>
                <p className="text-[9px] md:text-[10px] font-bold text-white/70 uppercase tracking-[0.25em]">Motorizado en campo</p>
            </div>

            <div className="flex bg-slate-50 border-b border-slate-200 p-2 gap-2 shrink-0">
                <button 
                    onClick={() => setSelectedTab('RECOJOS')} 
                    className={`flex-1 py-2.5 md:py-3 rounded-xl text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'RECOJOS' ? 'bg-white shadow-md border' : 'text-slate-400'}`} 
                    style={activeTab === 'RECOJOS' ? { color: mainMode === 'LOGISTICS_HUB' ? '#0F172A' : primaryColor } : {}}
                >
                    {mainMode === 'LOGISTICS_HUB' ? 'PENDIENTES' : 'RECOJOS'}
                    {mainMode === 'CALL_CENTER' && pendingPickupsCount > 0 && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${activeTab === 'RECOJOS' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-50'}`}>
                            {pendingPickupsCount}
                        </span>
                    )}
                    {mainMode === 'LOGISTICS_HUB' && pendingLogisticsCount > 0 && activeTab === 'RECOJOS' && (
                         <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-amber-500 text-white animate-pulse">
                            {pendingLogisticsCount}
                        </span>
                    )}
                </button>
                {mainMode === 'CALL_CENTER' && (
                    <button 
                        onClick={() => setSelectedTab('ENTREGAS')} 
                        className={`flex-1 py-2.5 md:py-3 rounded-xl text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'ENTREGAS' ? 'bg-white shadow-md border' : 'text-slate-400'}`} 
                        style={activeTab === 'ENTREGAS' ? { color: primaryColor } : {}}
                    >
                        ENTREGAS
                        {pendingDeliveriesCount > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${activeTab === 'ENTREGAS' ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-200 text-slate-50'}`}>
                                {pendingDeliveriesCount}
                            </span>
                        )}
                    </button>
                )}
                <button onClick={() => setSelectedTab('COMPLETED')} className={`flex-1 py-2.5 md:py-3 rounded-xl text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-all ${activeTab === 'COMPLETED' ? 'bg-white shadow-md border' : 'text-slate-400'}`}>HISTORIAL</button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 custom-scrollbar bg-slate-50/30">
                {mainMode === 'CALL_CENTER' && activeTab === 'RECOJOS' && pickups.filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED').map(p => (
                    <div key={p.id} onClick={() => handleItemSelect(p.id)} className={`bg-white rounded-[1.5rem] md:rounded-[1.8rem] shadow-sm border-2 p-4 md:p-5 group hover:border-indigo-100 transition-all cursor-pointer ${selectedItemId === p.id ? 'ring-2 border-indigo-500' : 'border-slate-100'}`} style={selectedItemId === p.id ? { borderColor: primaryColor } : {}}>
                        <div className="flex justify-between items-start mb-3 md:mb-4">
                            <div className="min-w-0 flex-1 pr-2">
                                <h3 className="font-bold text-sm md:text-base text-slate-800 uppercase truncate leading-tight">{p.clientName}</h3>
                                <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-1"><Clock size={10}/> {p.timeRange}</div>
                                <p className="text-[9px] font-medium text-slate-500 uppercase mt-1 truncate">{p.address}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleCall(p.phone); }} className="p-2 md:p-2.5 bg-slate-900 text-white rounded-xl shadow-md"><Phone size={16}/></button>
                        </div>
                        {p.status === 'IN_ROUTE' ? (
                            <button onClick={(e) => { e.stopPropagation(); onConvertToOrder(p); }} className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-bold text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><Shirt size={16} /> RECOGER PRENDAS</button>
                        ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleStartRoutePickup(p); }} className="w-full bg-slate-900 text-white py-3 rounded-2xl font-bold text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"><Navigation size={16} /> INICIAR RUTA</button>
                        )}
                    </div>
                ))}

                {mainMode === 'CALL_CENTER' && activeTab === 'ENTREGAS' && filteredInvoicesForDelivery.map(inv => (
                    <div key={inv.id} onClick={() => handleItemSelect(inv.id)} className={`bg-white rounded-[1.5rem] md:rounded-[1.8rem] shadow-sm border-2 p-4 md:p-5 group hover:border-indigo-100 transition-all cursor-pointer ${selectedItemId === inv.id ? 'ring-2 border-indigo-500' : 'border-slate-100'}`} style={selectedItemId === inv.id ? { borderColor: primaryColor } : {}}>
                        <div className="flex justify-between items-start mb-3 md:mb-4">
                            <div className="min-w-0 flex-1 pr-2">
                                <h3 className="font-bold text-sm md:text-base text-slate-800 uppercase truncate leading-tight">{inv.client.name}</h3>
                                <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-1"><Hash size={10}/> Orden #{inv.ordenNumber}</div>
                                <p className="text-[9px] font-medium text-slate-500 uppercase mt-1 truncate">{inv.client.address}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); handleCall(inv.client.phone || ''); }} className="p-2 md:p-2.5 bg-slate-900 text-white rounded-xl shadow-md"><Phone size={16}/></button>
                            </div>
                        </div>
                        {inv.orderStatus === 'EN_RUTA' ? (
                            <button onClick={(e) => { e.stopPropagation(); openEvidenceModal(inv); }} className="w-full bg-emerald-600 text-white py-3 rounded-2xl font-bold text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><PackageCheck size={16} /> FINALIZAR ENTREGA</button>
                        ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleStartRouteDelivery(inv); }} className="w-full bg-slate-900 text-white py-3 rounded-2xl font-bold text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"><Navigation size={16} /> INICIAR RUTA</button>
                        )}
                    </div>
                ))}

                {mainMode === 'LOGISTICS_HUB' && activeTab === 'RECOJOS' && guias.filter(g => g.estado !== 'ENTREGADO' && g.estado !== 'CANCELADO').map(g => (
                    <div key={g.id} onClick={() => handleItemSelect(g.id)} className={`bg-white rounded-[1.5rem] md:rounded-[1.8rem] shadow-sm border-2 p-4 md:p-5 group hover:border-amber-100 transition-all cursor-pointer ${selectedItemId === g.id ? 'ring-4 border-amber-500 shadow-xl' : 'border-slate-100'}`}>
                        <div className="flex justify-between items-start mb-3 md:mb-4">
                            <div className="min-w-0 flex-1 pr-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-black text-sm md:text-base text-slate-800 uppercase truncate leading-tight">{g.codigo_guia}</h3>
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${g.tipo_guia === 'RECOJO' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>{g.tipo_guia}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase"><MapPin size={10} className="text-emerald-500" /> {g.sucursal_origen?.nombre_sucursal}</div>
                                        <div className="ml-[5px] border-l border-dashed border-slate-300 h-2 my-0.5" />
                                        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase"><Navigation size={10} className="text-accent" /> {g.sucursal_destino?.nombre_sucursal}</div>
                                    </div>
                                </div>
                            </div>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all ${g.estado === 'PENDIENTE' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white animate-pulse'}`}>
                                <Truck size={20} />
                            </div>
                        </div>

                        {selectedItemId === g.id && (
                            <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Box size={12}/> Contenido de Carga</h4>
                                    {isLoadingDetails ? (
                                        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-slate-300" /></div>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedGuiaItems.map((it, idx) => (
                                                <div 
                                                    key={idx} 
                                                    onClick={(e) => { e.stopPropagation(); toggleItemCheck(it.item_venta_id || it.item_id); }}
                                                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${checkedItems[it.item_venta_id || it.item_id] ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                       <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${checkedItems[it.item_venta_id || it.item_id] ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                            {checkedItems[it.item_venta_id || it.item_id] ? <Check size={14} strokeWidth={4} /> : <Box size={14} />}
                                                       </div>
                                                       <span className="text-[10px] font-bold text-slate-700 uppercase">{it.items_venta?.descripcion || 'Prenda'}</span>
                                                    </div>
                                                    {g.estado === 'PENDIENTE' && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); toggleItemMissing(it.item_venta_id || it.item_id); }}
                                                            className={`p-1.5 rounded-lg transition-colors ${missingItems[it.item_venta_id || it.item_id] ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-400'}`}
                                                        >
                                                            <AlertTriangle size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {g.estado === 'PENDIENTE' ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleUpdateGuiaStatus(g, 'EN_TRANSITO'); }}
                                        disabled={!selectedGuiaItems.length || !selectedGuiaItems.every(it => checkedItems[it.item_venta_id || it.item_id] || missingItems[it.item_venta_id || it.item_id])}
                                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 disabled:opacity-30 transition-all"
                                    >
                                        <Truck size={16} /> INICIAR TRASLADO
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleUpdateGuiaStatus(g, 'ENTREGADO'); }}
                                        className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                                    >
                                        <CheckCircle2 size={16} /> FINALIZAR ENTREGA
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {activeTab === 'COMPLETED' && (
                    <div className="space-y-4">
                         {mainMode === 'CALL_CENTER' ? (
                            [...pickups.filter(p => p.status === 'COMPLETED'), ...invoices.filter(i => i.orderStatus === 'ENTREGADO')].map((item: any) => (
                                <div key={item.id} className="bg-white rounded-3xl p-5 border border-slate-100 flex items-center justify-between opacity-60 grayscale hover:grayscale-0 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                                            <CheckCheck size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 uppercase text-sm">{item.clientName || item.client?.name}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.date ? new Date(item.date).toLocaleDateString() : '---'}</p>
                                        </div>
                                    </div>
                                    <div className="text-emerald-500 font-black text-[10px] uppercase tracking-widest">Entregado</div>
                                </div>
                            ))
                         ) : (
                             guias.filter(g => g.estado === 'ENTREGADO').map(g => (
                                <div key={g.id} className="bg-white rounded-3xl p-5 border border-slate-100 flex items-center justify-between opacity-60 grayscale hover:grayscale-0 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                                            <CheckCheck size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 uppercase text-sm">{g.codigo_guia}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{g.fecha_registro ? new Date(g.fecha_registro).toLocaleDateString() : '---'}</p>
                                        </div>
                                    </div>
                                    <div className="text-emerald-600 font-black text-[10px] uppercase tracking-widest">Finalizado</div>
                                </div>
                             ))
                         )}
                    </div>
                )}

                {((mainMode === 'CALL_CENTER' && activeTab === 'RECOJOS' && pickups.length === 0) || 
                  (mainMode === 'CALL_CENTER' && activeTab === 'ENTREGAS' && filteredInvoicesForDelivery.length === 0) ||
                  (mainMode === 'LOGISTICS_HUB' && activeTab === 'RECOJOS' && guias.filter(g => g.estado !== 'ENTREGADO').length === 0)) ? (
                    <div className="py-20 text-center flex flex-col items-center justify-center opacity-20"><Truck size={64} strokeWidth={1}/><p className="font-bold uppercase tracking-widest text-xs mt-4">Sin tareas pendientes</p></div>
                ) : null}
            </div>
        </aside>

        <div className={`flex-1 relative ${mobileView === 'map' ? 'flex' : 'hidden'} md:flex flex-col`}>
            <LeafletMap 
                items={mapMarkers} 
                selectedItem={selectedItemData as any} 
                previewLocation={null} 
                routeStart={userLocation} 
                detailedPath={activeRoute?.path} 
                onTakeOrder={(item) => {
                    const foundGuia = guias.find(g => g.id === item.id);
                    if (foundGuia) {
                         handleItemSelect(foundGuia.id);
                         return;
                    }
                    const foundPickup = pickups.find(p => p.id === item.id);
                    if (foundPickup) {
                        if (foundPickup.status === 'PENDING') handleStartRoutePickup(foundPickup);
                        else onConvertToOrder(foundPickup);
                    } else {
                        const foundInvoice = filteredInvoicesForDelivery.find(inv => inv.id === item.id);
                        if (foundInvoice) {
                            if (foundInvoice.orderStatus === 'LISTO') handleStartRouteDelivery(foundInvoice);
                            else openEvidenceModal(foundInvoice);
                        }
                    }
                }}
            />
            
            {activeRoute && (
                <div className="absolute bottom-6 left-6 bg-slate-900 text-white p-4 rounded-[2rem] shadow-2xl z-20 flex items-center gap-4 border border-white/10 animate-in slide-in-from-left-4 backdrop-blur-md max-w-[320px]">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2.5 rounded-xl">
                            <Gauge size={22} className="text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-[7px] font-bold uppercase text-indigo-300 tracking-[0.2em] mb-0.5">Ruta Optimizada</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-bold tabular-nums">{(activeRoute.distance / 1000).toFixed(1)} <span className="text-[9px] font-bold text-slate-400">KM</span></span>
                                <span className="text-xl font-bold tabular-nums">{Math.round(activeRoute.duration / 60)} <span className="text-[9px] font-bold text-slate-400">MIN</span></span>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLocation?.lat},${userLocation?.lng}&destination=${selectedItemData?.latitude},${selectedItemData?.longitude}&travelmode=driving`, '_blank')} 
                        style={{ backgroundColor: primaryColor }}
                        className="p-3 text-white rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center shrink-0 border border-white/20"
                        title="Navegar GPS"
                    >
                        <ExternalLink size={20} strokeWidth={3} />
                    </button>
                </div>
            )}

            <div className="md:hidden fixed bottom-6 right-6 z-30">
                <button 
                    onClick={() => setMobileView('list')} 
                    style={{ backgroundColor: primaryColor }}
                    className="p-4 text-white rounded-full shadow-2xl border-4 border-white active:scale-95 transition-all hover:scale-110"
                >
                    <List size={28} strokeWidth={3} />
                </button>
            </div>
        </div>

        {isEvidenceModalOpen && selectedDelivery && (
            <div className="fixed inset-0 bg-slate-950/95 z-[500] flex flex-col animate-in fade-in">
                <div className="h-16 bg-slate-900 text-white flex justify-between items-center px-6 shrink-0">
                    <div className="flex items-center gap-4"><Truck size={20} className="text-indigo-400" /><h3 className="font-bold text-sm uppercase tracking-widest">Evidencia de Entrega</h3></div>
                    <button onClick={() => { stopCamera(); setIsEvidenceModalOpen(false); }} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-10 flex flex-col items-center">
                    <div className="w-full max-w-xl space-y-8">
                        <div className="flex gap-2">
                            <button onClick={() => setIsSuccess(true)} className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all border-2 ${isSuccess ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}><CheckCircle size={20} className="mx-auto mb-1" /> EXITOSA</button>
                            <button onClick={() => setIsSuccess(false)} className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all border-2 ${!isSuccess ? 'bg-rose-600 border-rose-500 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}><XCircle size={20} className="mx-auto mb-1" /> FALLIDA</button>
                        </div>
                        <div className="relative aspect-square bg-black rounded-[3rem] overflow-hidden border-8 border-slate-900 shadow-2xl flex items-center justify-center group">
                            {cameraActive ? (
                                <>
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                    <button onClick={capturePhoto} disabled={evidencePhotos.length >= 3} className="absolute bottom-10 bg-white text-slate-900 p-8 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.4)] active:scale-90 transition-transform"><Camera size={40}/></button>
                                </>
                            ) : (
                                <button onClick={startCamera} className="flex flex-col items-center gap-4 text-white/30 hover:text-white transition-colors"><Camera size={64}/><span className="text-xs font-bold uppercase tracking-[0.3em]">Habilitar Cámara</span></button>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            {[0,1,2].map(idx => (
                                <div key={idx} className="aspect-square bg-slate-800 rounded-3xl border-2 border-white/10 overflow-hidden relative shadow-inner">
                                    {evidencePhotos[idx] ? (<><img src={evidencePhotos[idx]} className="w-full h-full object-cover" /><button onClick={() => setEvidencePhotos(prev => prev.filter((_, i) => i !== idx))} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full"><X size={10}/></button></>) : (<ImageIcon size={24} className="absolute inset-0 m-auto text-white/10" />)}
                                </div>
                            ))}
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Observación del transportista</label>
                            <textarea value={evidenceReason} onChange={e => setEvidenceReason(e.target.value.toUpperCase())} className="w-full bg-slate-900 border border-white/10 rounded-2xl p-6 text-white text-sm font-bold uppercase resize-none h-28 focus:border-indigo-500 outline-none" />
                        </div>
                        <button onClick={submitEvidence} disabled={evidencePhotos.length < 3} className="w-full py-5 bg-white text-slate-900 rounded-[2rem] font-bold text-xs uppercase tracking-widest shadow-2xl active:scale-95 disabled:opacity-30 transition-all">CONSOLIDAR REGISTRO DE ENTREGA</button>
                    </div>
                </div>
            </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
        {selectedOrderToPrint && <OrderPrintModal isOpen={true} onClose={() => setSelectedOrderToPrint(null)} invoice={selectedOrderToPrint} company={company} />}
    </div>
  );
};

export default Delivery;
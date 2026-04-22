
import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { PickupRequest } from '../types';
import {
    Smartphone,
    Globe,
    Map as MapIcon,
    ExternalLink,
    Clock,
    Truck,
    CheckCircle2,
    AlertTriangle,
    Target,
    ClipboardCheck
} from 'lucide-react';

interface LeafletMapProps {
    items: PickupRequest[];
    selectedItem: PickupRequest | null;
    previewLocation: { lat: number; lng: number } | null;
    onPreviewUpdate?: (lat: number, lng: number) => void;
    routeStart?: { lat: number; lng: number } | null;
    detailedPath?: [number, number][];
    onTakeOrder?: (item: PickupRequest) => void;
}

const createOrderIcon = (item: PickupRequest | { status: string }, rotation: number, isSelected: boolean, primaryColor: string) => {
    let color = "#facc15"; // Amarillo - Pendiente (Default)
    
    const status = (item as any).status;
    const priority = (item as any).priority;

    if (status === 'COMPLETED' || status === 'ENTREGADO') {
        color = "#22c55e"; // Verde - Completado
    } else if (status === 'IN_ROUTE' || status === 'EN_RUTA') {
        color = "#3b82f6"; // Azul Brillante - En ruta actual
    } else if (priority === 'ALTA' && status === 'PENDING') {
        color = "#ef4444"; // Rojo - Urgente
    } else if (status === 'FAILED') {
        color = "#64748b"; // Gris - Fallido
    } else if (status === 'PREVIEW' || (status === 'PENDING' && !priority)) {
        color = primaryColor; // Brand Color for regular pickups or preview
    }

    const size = isSelected ? 52 : 42;
    const isActuallyInRoute = status === 'IN_ROUTE' || status === 'EN_RUTA';

    return L.divIcon({
        className: 'bg-transparent border-none',
        html: `<div style="transform: rotate(${-rotation}deg); transition: all 0.3s;" class="${isSelected || isActuallyInRoute ? 'animate-bounce' : ''}">
      <svg viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" style="width: ${size}px; height: ${size}px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" fill="white" />
      </svg>
      ${isSelected || isActuallyInRoute ? `<div class="absolute -inset-2 bg-indigo-500/20 rounded-full animate-ping"></div>` : ''}
    </div>`,
        iconSize: [size, size], 
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size]
    });
};

const MapManager: React.FC<{ center: [number, number], selectedItem: PickupRequest | null, routeStart: { lat: number, lng: number } | null | undefined }> = ({ center, selectedItem, routeStart }) => {
    const map = useMap();
    
    useEffect(() => {
        if (!map) return;
        
        const timeout = setTimeout(() => {
            if (!map) return;
            map.invalidateSize();

            if (selectedItem && selectedItem.latitude && selectedItem.longitude) {
                // Si tenemos ubicación del delivery, encuadramos ambos puntos
                if (routeStart && routeStart.lat && routeStart.lng) {
                    const bounds = L.latLngBounds(
                        [routeStart.lat, routeStart.lng],
                        [selectedItem.latitude, selectedItem.longitude]
                    );
                    map.fitBounds(bounds, {
                        padding: [70, 70],
                        maxZoom: 16,
                        animate: true,
                        duration: 1.2
                    });
                } else {
                    // Si no hay punto de partida, solo volamos al destino
                    map.flyTo([selectedItem.latitude, selectedItem.longitude], 16, {
                        animate: true,
                        duration: 1.2
                    });
                }
            } else {
                map.panTo(center);
            }
        }, 400);
        return () => clearTimeout(timeout);
    }, [map, center, selectedItem, routeStart]);

    return null;
};

const LeafletMap: React.FC<LeafletMapProps> = ({ items, selectedItem, previewLocation, onPreviewUpdate, routeStart, detailedPath, onTakeOrder }) => {
    const [bearing, setBearing] = useState(0);
    const [style, setStyle] = useState<'streets' | 'sat'>('streets');
    
    // Get Brand Color
    const primaryColor = document.documentElement.style.getPropertyValue('--primary-color') || '#4f46e5';

    const center: [number, number] = useMemo(() => {
        if (selectedItem && selectedItem.latitude && selectedItem.longitude) return [selectedItem.latitude, selectedItem.longitude];
        if (previewLocation) return [previewLocation.lat, previewLocation.lng];
        if (routeStart) return [routeStart.lat, routeStart.lng];
        
        const firstWithLoc = items.find(i => i.latitude && i.longitude);
        if (firstWithLoc && firstWithLoc.latitude && firstWithLoc.longitude) return [firstWithLoc.latitude, firstWithLoc.longitude];
        return [-12.0464, -77.0428]; // Lima Default
    }, [selectedItem, previewLocation, routeStart, items]);

    const markers = useMemo(() => {
        return items.filter(i => i.latitude && i.longitude);
    }, [items]);

    // Icono de Chofer con nueva imagen personalizada y anclaje corregido
    const carIcon = useMemo(() => L.divIcon({
        className: 'bg-transparent border-none',
        html: `<div class="relative" style="transition: all 0.5s ease-in-out;">
          <div class="absolute -inset-4 bg-indigo-500/20 rounded-full animate-ping"></div>
          <div class="animate-bounce">
            <img src="https://iili.io/fwtUlIV.png" style="width: 64px; height: 64px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4)); object-fit: contain;" />
          </div>
        </div>`,
        iconSize: [64, 64],
        iconAnchor: [32, 64]
    }), []);

    return (
        <div className="relative h-full w-full bg-slate-100">
            {/* Selector de Capas */}
            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                <button onClick={() => setStyle(s => s === 'streets' ? 'sat' : 'streets')} title="Cambiar Vista" className="p-3 bg-white shadow-xl rounded-2xl text-slate-500 hover:bg-slate-50 transition-all border border-slate-100 active:scale-95">
                    {style === 'streets' ? <Globe className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
                </button>
            </div>

            <div className="absolute inset-0">
                <MapContainer
                    center={center}
                    zoom={14}
                    maxZoom={25}
                    zoomControl={true}
                    attributionControl={false}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                >
                    <TileLayer
                        url={style === 'streets' ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"}
                        maxZoom={25}
                        maxNativeZoom={19}
                    />
                    <MapManager center={center} selectedItem={selectedItem} routeStart={routeStart} />

                    {/* Dibujar Ruta */}
                    {detailedPath && detailedPath.length > 0 && (
                        <Polyline 
                            positions={detailedPath} 
                            pathOptions={{ 
                                color: primaryColor, 
                                weight: 6, 
                                opacity: 0.8,
                                lineJoin: 'round',
                                lineCap: 'round'
                            }} 
                        />
                    )}

                    {/* Marcador de partida (Chofer) */}
                    {routeStart && (
                        <Marker position={[routeStart.lat, routeStart.lng]} icon={carIcon} />
                    )}

                    {markers.map((item) => (
                        <Marker
                            key={item.id}
                            position={[item.latitude!, item.longitude!]}
                            icon={createOrderIcon(item, bearing, selectedItem?.id === item.id, primaryColor)}
                        >
                            <Popup>
                                <div className="p-1 min-w-[200px] space-y-2">
                                    <p className="font-bold text-slate-900 uppercase text-xs m-0 truncate">{item.clientName}</p>
                                    <p className="text-[10px] text-slate-500 m-0 leading-tight">{item.address}</p>
                                    <div className="flex flex-col gap-1.5 mt-2">
                                        <button
                                            onClick={() => window.open(item.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`, '_blank')}
                                            className="w-full text-white text-[10px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 uppercase tracking-widest bg-slate-900"
                                        >
                                            <ExternalLink size={12}/> Abrir Navegador
                                        </button>
                                        
                                        {onTakeOrder && (item.status === 'PENDING' || item.status === 'IN_ROUTE') && (
                                            <button
                                                onClick={() => { onTakeOrder(item); }}
                                                className="w-full text-white text-[10px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 uppercase tracking-widest bg-emerald-600 shadow-md active:scale-95 transition-all"
                                            >
                                                <ClipboardCheck size={12}/> Tomar Pedido
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {previewLocation && (
                        <Marker
                            draggable={!!onPreviewUpdate}
                            position={[previewLocation.lat, previewLocation.lng]}
                            eventHandlers={{
                                dragend: (e) => onPreviewUpdate && onPreviewUpdate(e.target.getLatLng().lat, e.target.getLatLng().lng)
                            }}
                            icon={createOrderIcon({ status: 'PREVIEW' }, bearing, false, primaryColor)}
                        >
                            <Tooltip permanent direction="top" className="!text-white !font-bold !text-[9px] !px-2 !rounded-md">UBICANDO PIN...</Tooltip>
                        </Marker>
                    )}
                </MapContainer>
            </div>
        </div>
    );
};

export default LeafletMap;

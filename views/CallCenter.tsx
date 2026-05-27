import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PickupRequest, Client, Invoice } from '../types';
import { dbCreatePickupRequest, dbGetPickupRequests, dbGetClients, dbCreateClient, dbUpdatePickupRequest, dbDeletePickupRequest, dbGetLogisticsDrivers } from '../services/dbService';
import {
    Headset, Plus, MapPin, Calendar, Clock, AlertCircle, Search,
    Phone, User, StickyNote, CheckCircle2, XCircle, Siren, Navigation, ExternalLink, Hash, X, Save, Edit, RefreshCcw, Image as ImageIcon, Eye, PlusCircle, ChevronDown, Map as MapIcon, Loader2 as LoaderCircle, Truck, Store, Zap, Trash2, Check
} from 'lucide-react';
import ClientModal from '../components/ClientModal';
import LeafletMap from '../components/LeafletMap';
import ConfirmationModal from '../components/ConfirmationModal';
import { EvolutionService } from '../services/evolutionService';
import Tracking from './Tracking'; 

interface CallCenterProps {
    apiToken: string;
    onRefreshData?: () => void;
    clients?: Client[];
    company: any; 
    invoices: Invoice[];
}

const LATAM_COUNTRIES = [
    { code: 'PE', name: 'Perú', phone: '+51' },
    { code: 'AR', name: 'Argentina', phone: '+54' },
    { code: 'BO', name: 'Bolivia', phone: '+591' },
    { code: 'BR', name: 'Brasil', phone: '+55' },
    { code: 'CL', name: 'Chile', phone: '+56' },
    { code: 'CO', name: 'Colombia', phone: '+57' },
    { code: 'CR', name: 'Costa Rica', phone: '+506' },
    { code: 'MX', name: 'México', phone: '+52' },
].sort((a, b) => a.name.localeCompare(b.name));

const TIME_OPTIONS = [
    "07:00 AM - 08:00 AM", "08:00 AM - 09:00 AM", "09:00 AM - 10:00 AM",
    "10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM", "12:00 PM - 01:00 PM",
    "01:00 PM - 02:00 PM", "03:00 PM - 04:00 PM", "04:00 PM - 05:00 PM",
    "05:00 PM - 06:00 PM", "06:00 PM - 07:00 PM", "07:00 PM - 08:00 PM",
    "08:00 PM - 09:00 PM", "10:00 PM - 11:00 PM"
];

const CallCenter: React.FC<CallCenterProps> = ({ apiToken, onRefreshData, clients = [], company, invoices }) => {
    const [requests, setRequests] = useState<PickupRequest[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'TODAY'>('PENDING');

    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    const [clientName, setClientName] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(LATAM_COUNTRIES.find(c => c.code === 'PE')!);
    const [address, setAddress] = useState('');
    const [mapsUrl, setMapsUrl] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [timeRange, setTimeRange] = useState(TIME_OPTIONS[2]);
    const [priority, setPriority] = useState<'NORMAL' | 'ALTA'>('NORMAL');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const [drivers, setDrivers] = useState<any[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<string>('');

    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [pickupToDelete, setPickupToDelete] = useState<PickupRequest | null>(null);
    
    const [reprogrammingRequest, setReprogrammingRequest] = useState<PickupRequest | null>(null);
    const [trackingRequestId, setTrackingRequestId] = useState<string | null>(null); 

    const [newDate, setNewDate] = useState('');
    const [newTimeRange, setNewTimeRange] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newAddress, setNewAddress] = useState('');
    const [newMapsUrl, setNewMapsUrl] = useState('');
    const [reproMotive, setReproMotive] = useState('');
    const [newDriverId, setNewDriverId] = useState('');

    const [showSuggestions, setShowSuggestions] = useState(false);
    
    const primaryColor = document.documentElement.style.getPropertyValue('--brand-primary').trim() || '#0054A6';

    const [showMiniMap, setShowMiniMap] = useState(false);
    const [extractedCoords, setExtractedCoords] = useState<{lat: number, lng: number} | null>(null);

    const [selectedPickupForMap, setSelectedPickupForMap] = useState<PickupRequest | null>(null);
    const [showMapModal, setShowMapModal] = useState(false);

    const isDataDirty = useMemo(() => {
        if (!selectedClient) return false;
        const currentPhone = `${selectedCountry.phone}${phone.replace(/\D/g, '')}`;
        return (
            (selectedClient.address || '').trim().toUpperCase() !== address.trim().toUpperCase() ||
            (selectedClient.phone || '') !== currentPhone ||
            (selectedClient.googleMapsUrl || '') !== mapsUrl ||
            selectedClient.latitude !== extractedCoords?.lat ||
            selectedClient.longitude !== extractedCoords?.lng
        );
    }, [selectedClient, address, phone, selectedCountry, mapsUrl, extractedCoords]);

    // FIX: Buscador mejorado con useMemo y normalización robusta
    const clientSuggestions = useMemo(() => {
        const term = clientName.trim().toLowerCase();
        if (!term || !showSuggestions) return [];
        return clients.filter(c => 
            (c.name || '').toLowerCase().includes(term) ||
            (c.phone || '').includes(term) ||
            (c.docNumber || '').includes(term)
        ).slice(0, 8);
    }, [clients, clientName, showSuggestions]);

    useEffect(() => {
        loadRequests();
        loadDrivers();
        const interval = setInterval(loadRequests, 15000); 
        return () => clearInterval(interval);
    }, []);

    const loadDrivers = async () => {
        try {
            const data = await dbGetLogisticsDrivers();
            setDrivers(data || []);
        } catch (err) {
            console.error('Error loading drivers in CallCenter:', err);
        }
    };

    useEffect(() => {
        if (mapsUrl) {
            const atMatch = mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (atMatch) setExtractedCoords({ lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) });
            else {
                const qMatch = mapsUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (qMatch) setExtractedCoords({ lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) });
            }
        } else setExtractedCoords(null);
    }, [mapsUrl]);

    const loadRequests = async () => {
        const reqData = await dbGetPickupRequests();
        setRequests(reqData);
    };

    const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setClientName(val);
        setShowSuggestions(true);
        // Solo resetear si lo que se escribe es significativamente distinto al nombre seleccionado
        if (selectedClient && val.trim().toUpperCase() !== selectedClient.name.toUpperCase()) {
            setSelectedClient(null);
        }
    };

    const selectClientSuggestion = (client: Client) => {
        setSelectedClient(client);
        setClientName(client.name.toUpperCase());
        setAddress(client.address.toUpperCase());
        setMapsUrl(client.googleMapsUrl || '');
        if (client.latitude && client.longitude) {
            setExtractedCoords({ lat: Number(client.latitude), lng: Number(client.longitude) });
        } else {
            setExtractedCoords(null);
        }
        
        const rawPhone = client.phone || '';
        const countryMatch = LATAM_COUNTRIES.find(c => rawPhone.startsWith(c.phone));
        if (countryMatch) {
            setSelectedCountry(countryMatch);
            setPhone(rawPhone.replace(countryMatch.phone, ''));
        } else setPhone(rawPhone);
        
        setShowSuggestions(false);
    };

    const handleNewClientSaved = async (client: Client) => {
        setIsSaving(true);
        try {
            const saved = await dbCreateClient(client);
            if (onRefreshData) onRefreshData();
            selectClientSuggestion(saved);
            setIsClientModalOpen(false);
        } catch (e) { alert("Error al registrar cliente"); }
        finally { setIsSaving(false); }
    };

    const clearSelection = () => {
        setSelectedClient(null);
        setClientName('');
        setPhone('');
        setSelectedCountry(LATAM_COUNTRIES.find(c => c.code === 'PE')!);
        setAddress('');
        setMapsUrl('');
        setNotes('');
        setExtractedCoords(null);
        setSelectedDriverId('');
    };

    const handleSubmitPickup = async () => {
        if (!selectedClient) {
            alert("Seleccione un cliente primero.");
            return;
        }

        if (!selectedDriverId) {
            alert("Debe seleccionar obligatoriamente un chofer asignado para este cliente.");
            return;
        }

        setIsSaving(true);
        try {
            const fullPhone = `${selectedCountry.phone}${phone.replace(/\D/g, '')}`;

            if (isDataDirty) {
                await dbCreateClient({
                    ...selectedClient,
                    phone: fullPhone,
                    address: address.toUpperCase(),
                    googleMapsUrl: mapsUrl,
                    latitude: extractedCoords?.lat,
                    longitude: extractedCoords?.lng
                });
                if (onRefreshData) onRefreshData();
            }

            const pickup = await dbCreatePickupRequest({
                cliente_id: selectedClient.id, 
                clientName: selectedClient.name,
                address: address.toUpperCase(),
                phone: fullPhone,
                scheduledDate: date,
                timeRange,
                priority,
                notes: `[CHOFER_ID:${selectedDriverId}] ${notes.toUpperCase()}`,
                chofer_id: selectedDriverId,
                status: 'PENDING',
                latitude: extractedCoords?.lat,
                longitude: extractedCoords?.lng,
                sucursal_id: company?.id || company?.sucursal_id || 'default'
            });

            const trackingUrl = `${window.location.origin}/?tracking=${pickup.id}`;
            // PLANTILLA ACTUALIZADA SOLICITADA - GENÉRICA
            const msgTemplate = "Hola Estimado(a) Cliente somos de la lavanderia, este mensaje es para confirmar que acabamos de agendar el servicio de delivery.\nFecha: -fecha-\nHora: -hora-\nDirección: -direccion-\n\nPuede ver el estado de su servicio aqui:\n\n-link-";
            
            const finalMsg = msgTemplate
                .replace(/-fecha-/g, date)
                .replace(/-hora-/g, timeRange)
                .replace(/-direccion-/g, address.toUpperCase())
                .replace(/-link-/g, trackingUrl);

            if (company.whatsapp_instance && company.whatsapp_token && company.whatsapp_instance_name) {
                const service = new EvolutionService({
                    baseUrl: company.whatsapp_instance,
                    apiKey: company.whatsapp_token,
                    instanceName: company.whatsapp_instance_name
                });
                try {
                    await service.sendText(fullPhone, finalMsg);
                } catch (waErr) {
                    window.open(`https://wa.me/${fullPhone.replace(/\D/g, '')}?text=${encodeURIComponent(finalMsg)}`, '_blank');
                }
            } else {
                window.open(`https://wa.me/${fullPhone.replace(/\D/g, '')}?text=${encodeURIComponent(finalMsg)}`, '_blank');
            }

            clearSelection();
            await loadRequests();
        } catch (error: any) {
            alert("Error al procesar: " + (error.message || "Verifique su conexión"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleReprogramClick = (req: PickupRequest) => {
        setReprogrammingRequest(req);
        setNewDate(req.scheduledDate);
        setNewTimeRange(req.timeRange);
        setNewPhone(req.phone);
        setNewAddress(req.address);
        setNewMapsUrl(req.googleMapsUrl || '');
        setNewDriverId(req.chofer_id || '');
        setReproMotive('');
    };

    const handleConfirmReprogram = async () => {
        if (!reprogrammingRequest || !newDate || !reproMotive || !newPhone || !newAddress) {
            alert("Debe completar los campos obligatorios.");
            return;
        }
        if (!newDriverId) {
            alert("Debe seleccionar obligatoriamente un chofer asignado para la reprogramación.");
            return;
        }
        setIsSaving(true);
        try {
            const originalNotes = reprogrammingRequest.notes || '';
            const updatedNotes = originalNotes
                ? `${originalNotes} | REPROG (${new Date().toLocaleDateString()}): ${reproMotive.toUpperCase()}`
                : `REPROG (${new Date().toLocaleDateString()}): ${reproMotive.toUpperCase()}`;

            let newLat = reprogrammingRequest.latitude;
            let newLng = reprogrammingRequest.longitude;
            
            if (newMapsUrl) {
                const atMatch = newMapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                if (atMatch) { newLat = parseFloat(atMatch[1]); newLng = parseFloat(atMatch[2]); }
            }

            await dbUpdatePickupRequest(reprogrammingRequest.id, {
                scheduledDate: newDate,
                timeRange: newTimeRange,
                phone: newPhone,
                address: newAddress.toUpperCase(),
                notes: updatedNotes,
                status: 'PENDING',
                latitude: newLat,
                longitude: newLng,
                chofer_id: newDriverId
            });
            setReprogrammingRequest(null);
            await loadRequests();
        } catch (e) { alert("Error al reprogramar"); }
        finally { setIsSaving(false); }
    };

    const handleDeletePickup = async () => {
        if (!pickupToDelete) return;
        setIsSaving(true);
        try {
            await dbDeletePickupRequest(pickupToDelete.id);
            setPickupToDelete(null);
            await loadRequests();
        } catch (e) {
            alert("Error al eliminar el recojo");
        } finally {
            setIsSaving(false);
        }
    };

    const getTrackingLabel = (item: any, associatedInvoice?: Invoice) => {
        if (item.type === 'PICKUP') {
            if (associatedInvoice) {
                if (associatedInvoice.orderStatus === 'ENTREGADO') return 'ENTREGADO';
                if (associatedInvoice.orderStatus === 'EN_RUTA') return 'CAMINO ENTREGA';
                if (associatedInvoice.orderStatus === 'LISTO') return 'LISTO';
                return 'LAVANDERÍA';
            }
            if (item.internalStatus === 'COMPLETED') return 'RECOGIDO';
            if (item.internalStatus === 'FAILED') return 'FALLIDO';
            if (item.internalStatus === 'IN_ROUTE') return 'CAMINO RECOJO';
            return 'RESERVA';
        }
        return 'LAVANDERÍA';
    };

    const requestsWithCoords = useMemo(() => {
        return requests.map(req => {
            let lat = req.latitude;
            let lng = req.longitude;
            if (!lat || !lng) {
                const url = req.googleMapsUrl;
                if (url) {
                    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                    if (atMatch) {
                        lat = parseFloat(atMatch[1]);
                        lng = parseFloat(atMatch[2]);
                    } else {
                        const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                        if (qMatch) {
                            lat = parseFloat(qMatch[1]);
                            lng = parseFloat(qMatch[2]);
                        }
                    }
                }
            }
            return {
                ...req,
                latitude: lat,
                longitude: lng
            };
        });
    }, [requests]);

    const combinedHistory = useMemo(() => {
        if (filter !== 'ALL') return [];
        const pickups = requestsWithCoords.filter(r => r.status === 'COMPLETED' || r.status === 'FAILED' || r.status === 'IN_ROUTE').map(r => {
            const associatedInvoice = invoices.find(inv => inv.pickupId === r.id);
            const itemBase = {
                id: r.id,
                trackingId: r.id,
                clientName: r.clientName,
                address: r.address,
                phone: r.phone,
                date: r.completedAt || r.createdAt,
                type: 'PICKUP',
                internalStatus: r.status
            };
            return { ...itemBase, status: getTrackingLabel(itemBase, associatedInvoice) };
        });
        // FIX: Changed 'STORE' to 'TIENDA' in comparison to match type InvoiceType origin
        const storeDeliveries = invoices.filter(inv => inv.origin === 'TIENDA' && (inv.orderStatus === 'EN_RUTA' || inv.orderStatus === 'ENTREGADO')).map(inv => {
            const itemBase = {
                id: inv.id,
                trackingId: inv.pickupId || inv.id,
                clientName: inv.client.name,
                address: inv.client.address,
                phone: inv.client.phone || '',
                date: inv.date,
                type: 'STORE_DELIVERY',
                internalStatus: inv.orderStatus
            };
            return { ...itemBase, status: getTrackingLabel(itemBase) };
        });
        return [...pickups, ...storeDeliveries].sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
    }, [requestsWithCoords, invoices, filter]);

    const filteredRequests = requestsWithCoords.filter(r => {
        if (filter === 'PENDING') return r.status === 'PENDING' || r.status === 'FAILED' || r.status === 'IN_ROUTE';
        if (filter === 'TODAY') {
            const todayStr = new Date().toISOString().split('T')[0];
            return r.scheduledDate === todayStr && (r.status === 'PENDING' || r.status === 'FAILED' || r.status === 'IN_ROUTE');
        }
        return false;
    }).sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

    return (
        <div className="flex h-full bg-gray-100">
            <div className="w-[400px] bg-white border-r border-gray-200 flex flex-col z-20 shadow-lg relative">
                <div className="p-6 border-b border-gray-100 text-white shrink-0" style={{ backgroundColor: primaryColor }}>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Headset size={24} /> Call Center
                    </h2>
                    <p className="text-indigo-100 text-sm mt-1 opacity-80">Gestión de recojos a domicilio</p>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                        <div className="relative">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Buscar / Nombre Cliente</label>
                                {selectedClient && (
                                    <button type="button" onClick={clearSelection} className="text-[10px] font-bold text-red-500 hover:underline">LIMPIAR</button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5" size={18} style={{ color: primaryColor }} />
                                    <input
                                        required
                                        value={clientName}
                                        onChange={handleClientNameChange}
                                        onFocus={() => setShowSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                                        className={`w-full pl-10 pr-3 py-2.5 border rounded-xl focus:ring-2 outline-none text-sm transition-all shadow-sm text-slate-900 ${selectedClient ? 'border-blue-300 bg-blue-50/20 font-bold uppercase' : 'border-gray-200'}`}
                                        placeholder="Nombre, Celular..."
                                        autoComplete="off"
                                    />
                                </div>
                                <button type="button" onClick={() => setIsClientModalOpen(true)} className="bg-white border-2 px-3 rounded-xl hover:bg-indigo-50 transition-all shadow-sm group shrink-0" style={{ color: primaryColor, borderColor: `${primaryColor}20` }} title="Agregar Cliente Nuevo">
                                    <Plus size={20} className="group-active:scale-90" />
                                </button>
                            </div>

                            {clientSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-1">
                                    {clientSuggestions.map(client => (
                                        <div key={client.id} onClick={() => selectClientSuggestion(client)} className="px-4 py-2.5 text-xs hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors flex flex-col gap-0.5">
                                            <div className="font-bold text-gray-900 flex items-center gap-2"><User size={12} className="text-indigo-400" />{client.name}</div>
                                            <div className="text-gray-500 flex justify-between items-center ml-5">
                                                <span className="flex items-center gap-1"><Phone size={10} /> {client.phone || '-'}</span>
                                                <span className="bg-gray-100 px-1.5 rounded text-[9px] font-mono border border-gray-200">{client.docType}: {client.docNumber}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Teléfono de Contacto</label>
                                <div className="flex gap-2">
                                    <div className="relative w-32 shrink-0">
                                        <select
                                            value={selectedCountry.code}
                                            onChange={e => setSelectedCountry(LATAM_COUNTRIES.find(c => c.code === e.target.value)!)}
                                            className="w-full pl-8 pr-2 py-2.5 border border-gray-200 rounded-xl text-xs font-bold appearance-none bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-slate-900"
                                        >
                                            {LATAM_COUNTRIES.map(c => (
                                                <option key={c.code} value={c.code}>{c.name} ({c.phone})</option>
                                            ))}
                                        </select>
                                        <img src={`https://flagcdn.com/w20/${selectedCountry.code.toLowerCase()}.png`} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-3 object-cover rounded-sm border border-gray-100" alt="flag" />
                                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                    <div className="relative flex-1">
                                        <Phone className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                        <input
                                            required
                                            value={phone}
                                            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                                            className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 outline-none text-sm font-bold shadow-sm text-slate-900"
                                            placeholder="Número local..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Prioridad</label>
                                <select value={priority} onChange={e => setPriority(e.target.value as any)} className={`w-full px-3 py-2 border rounded-lg outline-none text-sm font-bold shadow-sm text-slate-900 ${priority === 'ALTA' ? 'text-red-600 bg-red-50 border-red-200' : 'text-gray-700'}`}>
                                    <option value="NORMAL">NORMAL</option>
                                    <option value="ALTA">URGENTE</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Fecha Programada</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 outline-none text-sm bg-white shadow-sm text-slate-900" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1.5 font-sans">
                                <Truck size={16} className="text-gray-400" />
                                Chofer Asignado (Obligatorio)
                            </label>
                            <div className="relative">
                                <select 
                                    required
                                    value={selectedDriverId} 
                                    onChange={e => setSelectedDriverId(e.target.value)} 
                                    className="w-full pl-3 pr-10 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:border-indigo-500 outline-none text-sm font-bold bg-blue-50/20 shadow-sm text-slate-900 appearance-none cursor-pointer"
                                >
                                    <option value="">-- SELECCIONE UN CHOFER --</option>
                                    {drivers.map(drv => (
                                        <option key={drv.id} value={drv.id}>
                                            🚚 {drv.nombre_completo || drv.username}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <ChevronDown size={14} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Dirección de Recojo</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input required value={address} onChange={e => setAddress(e.target.value.toUpperCase())} className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 outline-none uppercase text-sm font-bold shadow-sm text-slate-900" placeholder="Av. Principal 123..." />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Rango Horario</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <select value={timeRange} onChange={e => setTimeRange(e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 outline-none text-sm font-bold bg-white shadow-sm text-slate-900">
                                    {TIME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Google Maps (Opcional)</label>
                            <div className="flex gap-2">
                                <input value={mapsUrl} onChange={e => setMapsUrl(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 outline-none text-xs text-blue-600 underline placeholder:no-underline placeholder:text-gray-400 shadow-sm text-slate-900" placeholder="https://maps.app.goo.gl/..." />
                                {mapsUrl.startsWith('http') && (
                                    <>
                                        <button type="button" onClick={() => setShowMiniMap(!showMiniMap)} className="px-3 rounded-lg transition-all flex items-center justify-center shadow-md" style={{ backgroundColor: showMiniMap ? primaryColor : 'white', color: showMiniMap ? 'white' : primaryColor, border: `2px solid ${primaryColor}20` }}><MapIcon size={16} /></button>
                                        <button type="button" onClick={() => window.open(mapsUrl, '_blank')} className="px-3 text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center shadow-md" style={{ backgroundColor: primaryColor }}><ExternalLink size={16} /></button>
                                    </>
                                )}
                            </div>
                            {showMiniMap && extractedCoords && (
                                <div className="mt-3 rounded-2xl border-2 overflow-hidden h-[180px] shadow-inner animate-in slide-in-from-top-2" style={{ borderColor: `${primaryColor}10` }}>
                                    <LeafletMap items={[]} selectedItem={null} previewLocation={extractedCoords} />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Notas / Observaciones</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value.toUpperCase())} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 outline-none text-sm h-24 resize-none bg-yellow-50/20 border-yellow-100 placeholder:text-yellow-700/50 shadow-sm text-slate-900" placeholder="Ej: Recoger 5 edredones..." />
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-100 bg-white shrink-0 z-10">
                        <button 
                            onClick={handleSubmitPickup}
                            disabled={isSaving || !selectedClient || !address || !phone}
                            className={`w-full text-white font-bold py-4 rounded-[1.8rem] shadow-xl transition-all flex justify-center items-center gap-3 active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em] text-xs ${selectedClient ? 'shadow-indigo-200' : 'bg-gray-300'}`}
                            style={selectedClient ? { backgroundColor: primaryColor } : {}}
                        >
                            {isSaving ? <LoaderCircle className="animate-spin" size={20} /> : (
                                <>
                                    {isDataDirty ? <RefreshCcw size={20} strokeWidth={3} /> : <CheckCircle2 size={20} strokeWidth={3} />}
                                    GRABAR RECOJO
                                </>
                            )}
                        </button>
                        {isDataDirty && selectedClient && (
                            <p className="text-[9px] text-indigo-500 font-bold uppercase text-center mt-3 tracking-widest animate-pulse">
                                * Se actualizarán los datos del cliente antes de grabar
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="bg-white p-4 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex gap-2">
                        <button onClick={() => setFilter('PENDING')} className="px-4 py-2 rounded-lg text-sm font-bold transition-colors" style={filter === 'PENDING' ? { backgroundColor: `${primaryColor}15`, color: primaryColor } : { color: '#6b7280' }}>Vigentes</button>
                        <button onClick={() => setFilter('TODAY')} className="px-4 py-2 rounded-lg text-sm font-bold transition-colors" style={filter === 'TODAY' ? { backgroundColor: `${primaryColor}15`, color: primaryColor } : { color: '#6b7280' }}>Para Hoy</button>
                        <button onClick={() => setFilter('ALL')} className="px-4 py-2 rounded-lg text-sm font-bold transition-colors" style={filter === 'ALL' ? { backgroundColor: `${primaryColor}15`, color: primaryColor } : { color: '#6b7280' }}>Historial</button>
                    </div>
                    <div className="text-xs text-gray-400 font-medium">
                        {filter === 'ALL' ? combinedHistory.length : filteredRequests.length} registros encontrados
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50 custom-scrollbar">
                    {filter !== 'ALL' ? (
                        <>
                            {/* VISTA DE TARJETAS EN MÓVIL */}
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {filteredRequests.map(req => (
                                    <div 
                                        key={req.id} 
                                        className={`rounded-[2rem] shadow-sm border-2 p-5 relative group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${req.isSelfScheduled ? 'border-indigo-400 ring-4 ring-indigo-50' : req.priority === 'ALTA' && req.status === 'PENDING' ? 'border-red-400 ring-4 ring-red-50' : 'border-white'}`}
                                        style={{ backgroundColor: req.isSelfScheduled ? `${primaryColor}08` : req.priority === 'ALTA' ? '#fef2f2' : '#ffffff' }}
                                    >
                                        {req.isSelfScheduled && (
                                            <div className="absolute -top-3 left-4 bg-indigo-600 text-white px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-lg border-2 border-white">
                                                <Zap size={10} fill="currentColor"/> AUTOAGENDADO
                                            </div>
                                        )}
                                        <div className="flex justify-between items-start mb-4 gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-slate-900 text-lg uppercase truncate leading-tight" title={req.clientName}>{req.clientName}</h3>
                                                <div className="flex items-center gap-1.5 text-xs text-indigo-500 mt-1 font-bold"><Phone size={12} strokeWidth={3} /> {req.phone}</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {req.status === 'COMPLETED' && <div className="text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-emerald-100"><CheckCircle2 size={12} /> RECOGIDO</div>}
                                                {req.status === 'FAILED' && <div className="text-rose-500 bg-rose-50 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-rose-100"><XCircle size={12} /> FALLIDO</div>}
                                                {req.status === 'PENDING' && req.priority === 'ALTA' && <div className="text-rose-600 animate-pulse flex items-center gap-1 text-[10px] font-bold bg-rose-50 px-2 py-1 rounded-lg border border-rose-100"><Siren size={14} /> URGENTE</div>}
                                                {req.status === 'IN_ROUTE' && <div className="text-blue-600 animate-pulse flex items-center gap-1 text-[10px] font-bold bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 uppercase tracking-tight"><Navigation size={12} /> EN RUTA</div>}
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 bg-blue-50/60 text-blue-700 px-3 py-2 rounded-xl font-bold text-[9px] uppercase border border-blue-100">
                                                <Truck size={12} className="text-blue-500 shrink-0" />
                                                <span className="truncate">CHOFER: {(drivers.find(d => d.id === req.chofer_id)?.nombre_completo || drivers.find(d => d.id === req.chofer_id)?.username || 'No Asignado').toUpperCase()}</span>
                                            </div>
                                            <div className="flex items-start gap-3 bg-white/50 p-3 rounded-2xl text-slate-700 border border-slate-100/50 backdrop-blur-sm">
                                                <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
                                                <span className="text-[11px] font-bold uppercase leading-relaxed text-slate-600">{req.address}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="flex-1 flex items-center gap-2 bg-indigo-50/50 text-indigo-700 px-3 py-2 rounded-xl font-bold text-[10px] border border-indigo-100/50"><Calendar size={14} /> {new Date(req.scheduledDate + 'T12:00').toLocaleDateString('es-PE', { day:'numeric', month:'short' }).toUpperCase()}</div>
                                                <div className="flex-1 flex items-center gap-2 bg-slate-50 text-slate-600 px-3 py-2 rounded-xl font-bold text-[9px] uppercase border border-slate-100"><Clock size={14} /> {req.timeRange}</div>
                                            </div>
                                            {req.notes && (
                                                <div className="text-[10px] text-amber-700 bg-amber-50 p-3 rounded-2xl border border-amber-100 flex items-start gap-2 font-bold uppercase leading-tight italic">
                                                    <StickyNote size={14} className="shrink-0 text-amber-400" /> {req.notes}
                                                </div>
                                            )}
                                            <div className="pt-2 flex gap-2">
                                                <button 
                                                    onClick={() => { setSelectedPickupForMap(req); setShowMapModal(true); }}
                                                    className={`p-3 rounded-2xl border transition-all flex items-center justify-center shadow-sm ${req.latitude && req.longitude ? 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100' : 'bg-slate-100 border-slate-200 text-slate-400'}`}
                                                    title="Ver en Mapa"
                                                    disabled={!req.latitude && !req.longitude}
                                                >
                                                    <MapIcon size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => setTrackingRequestId(req.id)} 
                                                    className="p-3 bg-white hover:bg-indigo-50 text-indigo-600 rounded-2xl border border-slate-100 transition-all flex items-center justify-center shadow-sm group-hover:border-indigo-200"
                                                    title="Seguimiento / Tracking"
                                                >
                                                    <Navigation size={18} strokeWidth={2.5} />
                                                </button>
                                                <button 
                                                    onClick={() => handleReprogramClick(req)} 
                                                    className="flex-1 py-3 bg-slate-900 text-white rounded-2xl transition-all font-bold text-[10px] uppercase flex items-center justify-center gap-2 active:scale-95 shadow-md"
                                                >
                                                    <RefreshCcw size={14} strokeWidth={3} /> REPROG.
                                                </button>
                                                <button 
                                                    onClick={() => setPickupToDelete(req)} 
                                                    className="p-3 bg-red-50 text-red-500 rounded-2xl border border-red-100 transition-all hover:bg-red-500 hover:text-white flex items-center justify-center active:scale-95"
                                                    title="Cancelar / Eliminar"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* VISTA DE TABLA EN ESCRITORIO */}
                            <div className="hidden md:block overflow-hidden bg-white rounded-3xl border border-slate-200/80 shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100/85">
                                            <th className="py-4 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Prioridad</th>
                                            <th className="py-4 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Cliente</th>
                                            <th className="py-4 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Teléfono</th>
                                            <th className="py-4 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Dirección</th>
                                            <th className="py-4 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Fecha / Hora</th>
                                            <th className="py-4 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Chofer</th>
                                            <th className="py-4 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 text-center">Estado</th>
                                            <th className="py-4 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredRequests.map(req => {
                                            const driverName = drivers.find(d => d.id === req.chofer_id)?.nombre_completo || drivers.find(d => d.id === req.chofer_id)?.username || 'No Asignado';
                                            const hasCoords = !!req.latitude && !!req.longitude;
                                            return (
                                                <tr key={req.id} className={`hover:bg-slate-50/70 transition-colors ${req.priority === 'ALTA' && req.status === 'PENDING' ? 'bg-red-50/20' : ''}`}>
                                                    <td className="py-4 px-5">
                                                        {req.priority === 'ALTA' && req.status === 'PENDING' ? (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-red-600 bg-red-100/70 py-1 px-2.5 rounded-full border border-red-200 uppercase tracking-wider animate-pulse"><Siren size={11} /> URGENTE</span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-slate-500 bg-slate-100 py-1 px-2.5 rounded-full border border-slate-200 uppercase tracking-wider">NORMAL</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <div className="font-bold text-slate-900 text-xs uppercase tracking-tight">{req.clientName}</div>
                                                        {req.isSelfScheduled && <div className="text-[9px] font-extrabold text-indigo-600 mt-0.5 flex items-center gap-1 uppercase">★ Autoagendado</div>}
                                                    </td>
                                                    <td className="py-4 px-5 text-xs text-slate-500 font-bold">{req.phone}</td>
                                                    <td className="py-4 px-5 max-w-[240px]">
                                                        <div className="text-xs font-semibold text-slate-600 truncate uppercase" title={req.address}>{req.address}</div>
                                                        {req.notes && <div className="text-[9px] text-amber-600 mt-1 font-bold italic line-clamp-1">{req.notes}</div>}
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <div className="text-xs font-bold text-slate-700">{new Date(req.scheduledDate + 'T12:00').toLocaleDateString('es-PE', { day:'numeric', month:'short' }).toUpperCase()}</div>
                                                        <div className="text-[9px] font-extrabold text-slate-400 mt-0.5 uppercase">{req.timeRange}</div>
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <span className="inline-flex px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase border bg-blue-50 border-blue-100 text-blue-700 truncate max-w-[150px]">{driverName}</span>
                                                    </td>
                                                    <td className="py-4 px-5 text-center">
                                                        {req.status === 'COMPLETED' && <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg text-[10px] font-extrabold"><CheckCircle2 size={11} /> RECOGIDO</span>}
                                                        {req.status === 'FAILED' && <span className="inline-flex items-center gap-1 text-rose-500 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg text-[10px] font-extrabold"><XCircle size={11} /> FALLIDO</span>}
                                                        {req.status === 'PENDING' && <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-extrabold">PENDIENTE</span>}
                                                        {req.status === 'IN_ROUTE' && <span className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg text-[10px] font-extrabold animate-pulse"><Navigation size={11} /> EN RUTA</span>}
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button 
                                                                onClick={() => { setSelectedPickupForMap(req); setShowMapModal(true); }}
                                                                className={`p-2 rounded-xl transition-all border ${hasCoords ? 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:scale-105' : 'bg-slate-100 border-slate-200 text-slate-400 opacity-40 cursor-not-allowed'}`}
                                                                title={hasCoords ? "Ver en Mapa Interno" : "Sin coordenadas asignadas"}
                                                            >
                                                                <MapIcon size={14} strokeWidth={2.5} />
                                                            </button>
                                                            <button 
                                                                onClick={() => setTrackingRequestId(req.id)} 
                                                                className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-all hover:scale-105"
                                                                title="Seguimiento / Tracking"
                                                            >
                                                                <Navigation size={14} strokeWidth={2.5} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleReprogramClick(req)} 
                                                                className="p-2 bg-slate-900 hover:opacity-90 text-white rounded-xl transition-all hover:scale-105"
                                                                title="Reprogramar"
                                                            >
                                                                <RefreshCcw size={14} strokeWidth={2.5} />
                                                            </button>
                                                            <button 
                                                                onClick={() => setPickupToDelete(req)} 
                                                                className="p-2 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-xl border border-red-100 transition-all hover:scale-105"
                                                                title="Cancelar / Eliminar"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {combinedHistory.map(item => (
                                <div key={item.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 relative group hover:shadow-lg transition-all animate-in fade-in">
                                    <div className="flex justify-between items-start mb-4 gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 text-sm uppercase truncate">{(item.clientName || '').toUpperCase()}</h3>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mt-1 uppercase">
                                                {item.type === 'PICKUP' ? <Store size={14} className="text-blue-500" /> : <Truck size={14} className="text-indigo-500" />}
                                                {item.type === 'PICKUP' ? 'RECOJO' : 'ENVÍO'}
                                            </div>
                                        </div>
                                        <div className={`px-2.5 py-1 rounded-full text-[9px] font-bold border uppercase ${item.status === 'ENTREGADO' || item.status === 'RECOGIDO' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{item.status}</div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-2 text-slate-500">
                                            <MapPin size={14} className="shrink-0 text-slate-300 mt-0.5" />
                                            <span className="text-[10px] font-bold uppercase leading-tight line-clamp-2">{item.address}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 px-1 border-t border-slate-50 pt-3">
                                            <div className="flex items-center gap-1.5"><Phone size={12}/> {item.phone}</div>
                                            <div className="flex items-center gap-1.5"><Calendar size={12}/> {new Date(item.date || '').toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <ClientModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} onSave={handleNewClientSaved} apiToken={apiToken} clientsList={clients} />

            <ConfirmationModal 
                isOpen={!!pickupToDelete}
                onClose={() => setPickupToDelete(null)}
                onConfirm={handleDeletePickup}
                title="Cancelar Recojo"
                isDangerous={true}
                confirmText="SÍ, CANCELAR RECOJO"
                message={
                    <div className="space-y-3">
                        <p className="font-bold text-slate-900">¿Estás seguro de que deseas eliminar esta programación de recojo?</p>
                        <p className="text-xs text-slate-500 uppercase leading-relaxed font-medium">Esta acción marcará el servicio como cancelado y desaparecerá del mapa de rutas del motorizado.</p>
                        {pickupToDelete && (
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Solicitud de:</p>
                                <p className="text-sm font-bold text-slate-900 uppercase">{(pickupToDelete.clientName || '').toUpperCase()}</p>
                            </div>
                        )}
                    </div>
                }
            />

            {trackingRequestId && (
                <div className="fixed inset-0 z-[120] bg-white animate-in fade-in duration-300">
                    <div className="absolute top-6 right-6 z-[130]"><button onClick={() => setTrackingRequestId(null)} className="bg-black/20 hover:bg-black/40 text-white p-3 rounded-full transition-all border border-white/20 shadow-xl"><X size={24} strokeWidth={3} /></button></div>
                    <div className="h-full overflow-y-auto"><Tracking id={trackingRequestId} /></div>
                </div>
            )}

            {reprogrammingRequest && (
                <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
                        <div className="p-5 text-white flex justify-between items-center bg-slate-800">
                            <div><h3 className="font-bold flex items-center gap-2"><RefreshCcw size={18} /> Reprogramar Recojo</h3></div>
                            <button onClick={() => setReprogrammingRequest(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nueva Fecha</label><input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg outline-none text-sm font-bold text-slate-900" /></div>
                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Rango Horario</label><select value={newTimeRange} onChange={e => setNewTimeRange(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-sm font-bold text-slate-900">{TIME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                    <Truck size={12} className="text-gray-400" />
                                    Chofer Asignado (Obligatorio)
                                </label>
                                <div className="relative">
                                    <select 
                                        required
                                        value={newDriverId} 
                                        onChange={e => setNewDriverId(e.target.value)} 
                                        className="w-full pl-3 pr-10 py-2 border rounded-lg focus:ring-2 focus:border-indigo-500 outline-none text-sm font-bold bg-white text-slate-900 appearance-none cursor-pointer"
                                    >
                                        <option value="">-- SELECCIONE UN CHOFER --</option>
                                        {drivers.map(drv => (
                                            <option key={drv.id} value={drv.id}>
                                                🚚 {drv.nombre_completo || drv.username}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                            </div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Motivo / Notas</label><textarea required value={reproMotive} onChange={e => setReproMotive(e.target.value.toUpperCase())} placeholder="Motivo de la reprogramación..." className="w-full p-3 border rounded-lg outline-none text-sm h-24 resize-none uppercase font-bold text-slate-900" /></div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setReprogrammingRequest(null)} className="px-4 py-2 font-bold text-gray-500 uppercase text-xs">Cancelar</button>
                            <button onClick={handleConfirmReprogram} disabled={isSaving || !newDate || !reproMotive} className="text-white px-8 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 uppercase text-xs tracking-widest" style={{ backgroundColor: primaryColor }}>
                                {isSaving ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />} Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showMapModal && (
                <div className="fixed inset-0 z-[1000] flex flex-col bg-slate-950/95 animate-in fade-in duration-200">
                    {/* Header */}
                    <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white shrink-0">
                        <div>
                            <h3 className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 text-indigo-400">
                                <MapIcon size={16} className="animate-pulse" /> MAPA DE UBICACIÓN - CALL CENTER
                            </h3>
                            {selectedPickupForMap && (
                                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wide mt-1">
                                    RECOJO DE: <span className="text-amber-400 font-extrabold">{selectedPickupForMap.clientName}</span> | {selectedPickupForMap.address}
                                </p>
                            )}
                        </div>
                        <button 
                            onClick={() => { setShowMapModal(false); setSelectedPickupForMap(null); }}
                            className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all shadow-md active:scale-95"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    
                    {/* Body */}
                    <div className="flex-1 relative">
                        <LeafletMap 
                            items={requestsWithCoords} 
                            selectedItem={selectedPickupForMap} 
                            previewLocation={null} 
                        />
                    </div>
                    
                    {/* Footer */}
                    <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-wider shrink-0">
                        <span className="truncate max-w-2xl">DIRECCIÓN: {selectedPickupForMap?.address || "Hacer click en un marcador para ver detalles"}</span>
                        <span>Total de Visitas Agendadas: {requestsWithCoords.filter(req => req.latitude && req.longitude).length}</span>
                    </div>
                </div>
            )}

            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }`}</style>
        </div>
    );
};

export default CallCenter;
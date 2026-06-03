

import React, { useState, useEffect, useRef } from 'react';
import { Client } from '../types';
import { X, Search, Loader2, Save, User, MapPin, Phone, Calendar, ChevronDown, Check, AlertTriangle, Camera, Navigation, Hash, Crown } from 'lucide-react';
import { searchClient } from '../services/clientService';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Client) => void;
  apiToken: string;
  initialData?: Client | null;
  initialDocType?: 'DNI' | 'RUC' | '-'; 
  clientsList?: Client[]; 
  onSearchDatabase?: (query: string) => Promise<Client[]>;
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

const ALERT_COLORS = [
    { id: 'red', bg: 'bg-red-300' },
    { id: 'orange', bg: 'bg-orange-300' },
    { id: 'green', bg: 'bg-green-300' },
    { id: 'blue', bg: 'bg-blue-400' }
] as const;

const ClientModal: React.FC<ClientModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  apiToken, 
  initialData, 
  initialDocType = 'DNI',
  clientsList = [],
  onSearchDatabase
}) => {
  const [docType, setDocType] = useState<'DNI' | 'RUC' | '-'>('DNI');
  const [docNumber, setDocNumber] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [ruc, setRuc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  
  const [selectedCountry, setSelectedCountry] = useState(LATAM_COUNTRIES.find(c => c.code === 'PE')!);
  const [birthMonth, setBirthMonth] = useState(''); 
  const [birthDay, setBirthDay] = useState(''); 
  const [gender, setGender] = useState<'Masculino' | 'Femenino' | 'Otro'>('Otro');
  
  const [alertMessage, setAlertMessage] = useState('');
  const [alertColor, setAlertColor] = useState<'red' | 'orange' | 'green' | 'blue'>('blue');
  const [sunatStatus, setSunatStatus] = useState('');
  const [sunatCondition, setSunatCondition] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [duplicateClient, setDuplicateClient] = useState<Client | null>(null);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [suscrito, setSuscrito] = useState(false);

  // Robustly get primary color from CSS or fallback
  const primaryColor = typeof window !== 'undefined' ? 
    (getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim() || 
     getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || 
     '#0054A6') : '#0054A6';

  const [suggestions, setSuggestions] = useState<Client[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const isLocked = !!initialData && 
                 (initialData.docType === 'DNI' || initialData.docType === 'RUC') && 
                 initialData.docNumber !== '00000000';

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDocType(initialData.docType as any || 'DNI');
        setDocNumber(initialData.docNumber || '');
        setName(initialData.name || '');
        setAddress(initialData.address || '');
        setGoogleMapsUrl(initialData.googleMapsUrl || '');
        setLatitude(initialData.latitude);
        setLongitude(initialData.longitude);
        setEmail(initialData.email || '');
        setRuc(initialData.ruc || '');
        setRazonSocial(initialData.razon_social || '');
        const rawPhone = initialData.phone || '';
        const countryMatch = LATAM_COUNTRIES.find(c => rawPhone.startsWith(c.phone));
        if (countryMatch) {
            setSelectedCountry(countryMatch);
            setPhone(rawPhone.replace(countryMatch.phone, ''));
        } else {
            setPhone(rawPhone);
        }
        // FIX: Cast string to gender type
        setGender(initialData.gender as any || 'Otro');
        setAlertMessage(initialData.alertMessage || '');
        setAlertColor(initialData.alertColor as any || 'blue');
        setSuscrito(initialData.suscrito || false);
        if (initialData.birthday) {
            const parts = initialData.birthday.split('-');
            if (parts.length === 3) {
                setBirthMonth(parts[1]);
                setBirthDay(parts[2]);
            }
        }
      } else {
        resetForm();
      }
    }
  }, [initialData, isOpen]);

  useEffect(() => {
    if (googleMapsUrl) {
      const atMatch = googleMapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        setLatitude(parseFloat(atMatch[1]));
        setLongitude(parseFloat(atMatch[2]));
      } else {
        const qMatch = googleMapsUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (qMatch) {
          setLatitude(parseFloat(qMatch[1]));
          setLongitude(parseFloat(qMatch[2]));
        }
      }
    }
  }, [googleMapsUrl]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
            setShowSuggestions(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resetForm = () => {
    setDocType('DNI');
    setDocNumber('');
    setName('');
    setAddress('');
    setGoogleMapsUrl('');
    setLatitude(undefined);
    setLongitude(undefined);
    setPhone('');
    setEmail('');
    setRuc('');
    setRazonSocial('');
    setBirthMonth('');
    setBirthDay('');
    setGender('Otro');
    setAlertMessage('');
    setAlertColor('blue');
    setSunatStatus('');
    setSunatCondition('');
    setSelectedCountry(LATAM_COUNTRIES.find(c => c.code === 'PE')!);
    setSuggestions([]);
    setShowSuggestions(false);
    setDuplicateClient(null);
    setShowDuplicateAlert(false);
    setSuscrito(false);
  };

  const handleDocNumberChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    setDocNumber(cleanValue);

    // Robust exact duplicate detection - Improved for DNI(8) and RUC(11)
    const minLength = docType === 'DNI' ? 8 : (docType === 'RUC' ? 11 : 8);
    
    if (cleanValue.length >= minLength && ((docType as string) === 'DNI' || (docType as string) === 'RUC')) {
        const exactDuplicate = clientsList.find(c => {
            const cType = String(c.docType || '');
            const cNum = String(c.docNumber || '').replace(/\D/g, '');
            const isSameDoc = cType === String(docType) && cNum === cleanValue;
            const isNotSelf = initialData ? String(c.id) !== String(initialData.id) : true;
            return isSameDoc && isNotSelf;
        });
        
        if (exactDuplicate) {
            setDuplicateClient(exactDuplicate);
            setShowDuplicateAlert(true);
            setSuggestions([]);
            setShowSuggestions(false);
        } else {
            setDuplicateClient(null);
            setShowDuplicateAlert(false);
        }
    } else {
        setDuplicateClient(null);
        setShowDuplicateAlert(false);
    }

    if (cleanValue.length >= 5 && !isLocked && !duplicateClient) {
        const filtered = clientsList.filter(c => {
            const storedDoc = (c.docNumber || '').replace(/\D/g, '');
            return storedDoc.includes(cleanValue);
        });
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
    } else {
        setSuggestions([]);
        setShowSuggestions(false);
    }
  };

  // Debounced DB Search for duplicates
  useEffect(() => {
    if (!onSearchDatabase || docNumber.length < 5 || isLocked) return;

    const handler = setTimeout(async () => {
        try {
            const results = await onSearchDatabase(docNumber);
            if (results && results.length > 0) {
                setSuggestions(prev => {
                    const combined = [...prev];
                    results.forEach((res: Client) => {
                        if (!combined.some(c => c.id === res.id)) {
                            combined.push(res);
                        }
                    });
                    return combined.slice(0, 10);
                });
                setShowSuggestions(true);
            }
        } catch (e) {
            console.error("Error searching duplicate in DB:", e);
        }
    }, 500);

    return () => clearTimeout(handler);
  }, [docNumber, onSearchDatabase, isLocked]);

  const selectSuggestion = (client: Client) => {
    setDocType(client.docType as any);
    setDocNumber(client.docNumber);
    setName(client.name);
    setAddress(client.address);
    setGoogleMapsUrl(client.googleMapsUrl || '');
    setLatitude(client.latitude);
    setLongitude(client.longitude);
    setAlertMessage(client.alertMessage || '');
    setAlertColor(client.alertColor as any || 'blue');
    setSunatStatus(client.sunatStatus || '');
    setSuscrito(client.suscrito || false);
    setSunatCondition(client.sunatCondition || '');
    setEmail(client.email || '');
    setRuc(client.ruc || '');
    setRazonSocial(client.razon_social || '');
    
    const rawPhone = client.phone || '';
    const countryMatch = LATAM_COUNTRIES.find(c => rawPhone.startsWith(c.phone));
    if (countryMatch) {
        setSelectedCountry(countryMatch);
        setPhone(rawPhone.replace(countryMatch.phone, ''));
    } else {
        setPhone(rawPhone);
    }

    if (client.birthday) {
        const parts = client.birthday.split('-');
        if (parts.length === 3) {
            setBirthMonth(parts[1]);
            setBirthDay(parts[2]);
        }
    }

    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSearch = async () => {
    if (!docNumber || isSearching || (docType as string) === '-' || isLocked || duplicateClient) return;

    if (!apiToken) {
        alert("Token de API no configurado. Vaya a Ajustes > APIs para configurarlo.");
        return;
    }
    
    const local = clientsList.find(c => {
        const stored = (c.docNumber || '').replace(/\D/g, '');
        const current = docNumber.replace(/\D/g, '');
        return stored === current;
    });
    if (local) {
        selectSuggestion(local);
        return;
    }

    setIsSearching(true);
    try {
      const result = await searchClient(docType as 'DNI' | 'RUC', docNumber, apiToken);
      if (result) {
        setName(result.name || '');
        setAddress(result.address || '');
        setSunatStatus(result.sunatStatus || '');
        setSunatCondition(result.sunatCondition || '');
        if (docType === 'RUC') {
          setRuc(docNumber);
          setRazonSocial(result.name || '');
        }
      }
    } catch (e) {
      console.error("Error API", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // FINAL ESCAPE HATCH: Block submission if a duplicate is already detected in state
    if (duplicateClient) {
        setShowDuplicateAlert(true);
        return;
    }
    
    // LÓGICA DE VALIDACIÓN MEJORADA
    const isDocumentChanged = initialData 
        ? (String(initialData.docNumber) !== String(docNumber) || String(initialData.docType) !== String(docType)) 
        : true;

    if (((docType as string) === 'DNI' || (docType as string) === 'RUC') && isDocumentChanged) {
        const cleanCurrent = docNumber.replace(/\D/g, '');
        const existing = clientsList.find(c => {
            const cType = String(c.docType || '');
            const cNum = String(c.docNumber || '').replace(/\D/g, '');
            const isSameDoc = cType === String(docType) && cNum === cleanCurrent;
            const isNotSelf = initialData ? String(c.id) !== String(initialData.id) : true;
            return isSameDoc && isNotSelf;
        });

        if (existing) {
            setDuplicateClient(existing);
            setShowDuplicateAlert(true);
            return;
        }
    }

    const fullPhone = phone ? `${selectedCountry.phone}${phone}` : '';
    
    onSave({
      docType,
      docNumber,
      name: name.toUpperCase(),
      address: address.toUpperCase(),
      googleMapsUrl,
      latitude,
      longitude,
      phone: fullPhone,
      email,
      ruc,
      razon_social: razonSocial,
      gender,
      birthday: (birthMonth && birthDay) ? `2000-${birthMonth}-${birthDay}` : undefined,
      alertMessage,
      alertColor,
      sunatStatus,
      sunatCondition,
      id: initialData?.id || '',
      points: initialData?.points || 0,
      sucursal_id: initialData?.sucursal_id || '',
      suscrito
    });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[150] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-md overflow-hidden">
      <div className="bg-white rounded-t-[2.5rem] md:rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300 flex flex-col h-[92dvh] md:h-auto md:max-h-[95vh]">
        
        <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 bg-white shrink-0">
            <h2 className="text-slate-900 font-extrabold text-xs md:text-sm uppercase tracking-[0.2em] flex items-center gap-2">
                {initialData ? 'EDITAR CLIENTE' : 'NUEVO CLIENTE'}
            </h2>
            <button onClick={onClose} className="bg-slate-50 text-slate-300 hover:text-red-500 transition-all p-2 hover:bg-red-50 rounded-full border border-slate-100">
                <X size={20} />
            </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-slate-50/30">
            <div className="p-4 md:p-6 space-y-4 pb-24 md:pb-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    
                    {/* SECTION: IDENTIFICACIÓN Y DATOS */}
                    <div className="lg:col-span-12">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="bg-slate-50/50 px-4 py-1.5 border-b border-slate-100 flex items-center gap-2">
                                <User size={13} className="text-indigo-500" />
                                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Información Principal</h3>
                            </div>
                            
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    {/* TIPO DOC */}
                                    <div className="md:col-span-4 space-y-1">
                                        <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-1">Documento</label>
                                        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                                            {(['-', 'DNI', 'RUC'] as const).map((type) => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    disabled={isLocked && type !== docType} 
                                                    onClick={() => {
                                                        setDocType(type);
                                                        if (docNumber) handleDocNumberChange(docNumber);
                                                    }}
                                                    style={docType === type ? { backgroundColor: primaryColor } : {}}
                                                    className={`flex-1 py-1 rounded-lg text-[9px] font-bold uppercase transition-all ${
                                                        docType === type 
                                                        ? 'text-white shadow-sm' 
                                                        : 'text-slate-400 hover:text-slate-600'
                                                    } disabled:opacity-50`}
                                                >
                                                    {type === '-' ? 'Sin Doc' : type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* NUM DOC */}
                                    <div className="md:col-span-8 space-y-1">
                                        <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-1">Número de documento</label>
                                        <div className="flex gap-2">
                                            <input
                                                required={(docType as string) !== '-'}
                                                disabled={isLocked}
                                                value={docNumber}
                                                onChange={(e) => handleDocNumberChange(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && (docType as string) !== '-') {
                                                        e.preventDefault();
                                                        handleSearch();
                                                    }
                                                }}
                                                className={`flex-1 bg-slate-50 border-2 ${duplicateClient ? 'border-red-400' : 'border-slate-200'} rounded-xl px-4 py-1.5 text-base font-black text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder:text-slate-200 shadow-inner`}
                                                placeholder={docType === 'DNI' ? '8 dígitos' : (docType === 'RUC' ? '11 dígitos' : 'Opcional')}
                                            />
                                            {(docType as string) !== '-' && (
                                                <button 
                                                    type="button" 
                                                    onClick={handleSearch}
                                                    disabled={isSearching || !docNumber || isLocked || !!duplicateClient}
                                                    className="bg-slate-900 text-white px-3 py-1.5 rounded-xl hover:bg-black transition-all shadow-md active:scale-95 disabled:opacity-20"
                                                >
                                                    {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                                </button>
                                            )}
                                        </div>
                                        {duplicateClient && (
                                            <div className="mt-1 text-[8px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 font-bold flex items-center gap-1 animate-in slide-in-from-top-1">
                                                <AlertTriangle size={10} /> YA REGISTRADO: {duplicateClient.name}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* NOMBRE */}
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-1">Nombre Completo / Razón Social</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            required
                                            disabled={isLocked}
                                            value={name}
                                            onChange={(e) => setName(e.target.value.toUpperCase())}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all uppercase placeholder:text-slate-300 shadow-sm disabled:cursor-not-allowed"
                                            placeholder="Nombre del cliente"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* PAIS Y TEL */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-1">País</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
                                                    <img src={`https://flagcdn.com/w20/${selectedCountry.code.toLowerCase()}.png`} className="w-4 h-auto rounded-sm" alt="flag" />
                                                </div>
                                                <select 
                                                    value={selectedCountry.code}
                                                    onChange={(e) => setSelectedCountry(LATAM_COUNTRIES.find(c => c.code === e.target.value)!)}
                                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-9 pr-8 py-2 text-[10px] font-bold text-slate-900 outline-none focus:bg-white appearance-none shadow-sm cursor-pointer"
                                                >
                                                    {LATAM_COUNTRIES.map(c => (
                                                        <option key={c.code} value={c.code}>{c.name} ({c.phone})</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={10} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-1">Teléfono</label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                                <input
                                                    value={phone}
                                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-all placeholder:text-slate-300 shadow-sm"
                                                    placeholder="999888777"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* CUMPLE Y GENERO */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-1">Cumpleaños</label>
                                            <div className="grid grid-cols-2 gap-1">
                                                <select value={birthMonth} onChange={e => setBirthMonth(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-2 py-2 text-[10px] font-bold text-slate-900 outline-none appearance-none shadow-sm cursor-pointer">
                                                    <option value="">Mes</option>
                                                    {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m, i) => (
                                                        <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                                                    ))}
                                                </select>
                                                <select value={birthDay} onChange={e => setBirthDay(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-2 py-2 text-[10px] font-bold text-slate-900 outline-none appearance-none shadow-sm cursor-pointer">
                                                    <option value="">Día</option>
                                                    {Array.from({ length: 31 }, (_, i) => (<option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}</option>))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-1">Género</label>
                                            <select value={gender} onChange={e => setGender(e.target.value as any)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-900 focus:bg-white appearance-none shadow-sm cursor-pointer uppercase">
                                                <option value="Masculino">MASCULINO</option>
                                                <option value="Femenino">FEMENINO</option>
                                                <option value="Otro">OTRO</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* SWITCH DE MEMBRESÍA */}
                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                                <Crown size={15} fill="currentColor" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Socio de Membresía</p>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase">Activar o desactivar cuenta de suscripción</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSuscrito(!suscrito)}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                                                suscrito ? 'bg-amber-500' : 'bg-slate-200'
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                    suscrito ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION: UBICACIÓN Y ALERTAS */}
                    <div className="lg:col-span-7">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full">
                            <div className="bg-slate-50/50 px-4 py-1.5 border-b border-slate-100 flex items-center gap-2">
                                <MapPin size={13} className="text-emerald-500" />
                                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ubicación</h3>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-1">Dirección Exacta</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                        <input
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value.toUpperCase())}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[10px] font-bold text-slate-900 focus:bg-white focus:border-emerald-500 transition-all shadow-sm"
                                            placeholder="JR. DIRECCIÓN #123..."
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-1">Google Maps URL</label>
                                    <div className="relative">
                                        <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                        <input
                                            value={googleMapsUrl}
                                            onChange={(e) => setGoogleMapsUrl(e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[10px] font-bold text-blue-600 truncate focus:bg-white transition-all shadow-sm"
                                            placeholder="https://maps.app.goo.gl/..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-5">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full flex flex-col">
                            <div className="bg-slate-50/50 px-4 py-1.5 border-b border-slate-100 flex items-center gap-2">
                                <AlertTriangle size={13} className="text-amber-500" />
                                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nota Especial</h3>
                            </div>
                            <div className="p-4 flex-1 flex flex-col space-y-3">
                                <div className="flex-1 min-h-[60px]">
                                    <textarea 
                                        value={alertMessage}
                                        onChange={(e) => setAlertMessage(e.target.value)}
                                        className="w-full h-full min-h-[60px] border-2 border-slate-100 rounded-xl p-3 text-[10px] font-medium text-slate-600 outline-none focus:border-amber-400 bg-slate-50 shadow-inner resize-none transition-all"
                                        placeholder="Restricciones, deudas, etc..."
                                    />
                                </div>
                                <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight ml-2">Color:</span>
                                    <div className="flex gap-2">
                                        {ALERT_COLORS.map(color => (
                                            <button
                                                key={color.id}
                                                type="button"
                                                onClick={() => setAlertColor(color.id as any)}
                                                className={`w-6 h-6 rounded-full ${color.bg} transition-all flex items-center justify-center relative ${alertColor === color.id ? 'ring-2 ring-indigo-500/50 scale-110' : 'hover:scale-105 opacity-60'}`}
                                            >
                                                {alertColor === color.id && <Check size={10} className="text-white drop-shadow-sm" strokeWidth={4} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="shrink-0 p-4 md:p-6 bg-white border-t border-slate-100 flex justify-end z-10 sticky bottom-0">
                <button
                    type="submit"
                    disabled={!!duplicateClient}
                    style={{ backgroundColor: primaryColor }}
                    className="w-full md:w-auto hover:opacity-90 text-white font-black py-3 px-12 rounded-xl shadow-lg shadow-indigo-900/10 transition-all flex items-center justify-center gap-3 active:scale-95 uppercase text-[10px] tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={16} /> Guardar Cambios
                </button>
            </div>
        </form>

        {/* MODAL PEQUEÑO DE ALERTA DE DUPLICADO */}
        {showDuplicateAlert && duplicateClient && (
            <div className="fixed inset-0 bg-slate-950/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-2xl border border-slate-100 animate-in zoom-in-95">
                    <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle size={40} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">¡Cliente ya existe!</h3>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
                        El documento <span className="text-slate-900 font-bold">{duplicateClient.docType} {duplicateClient.docNumber}</span> ya está registrado a nombre de:<br/>
                        <span className="text-indigo-600 font-black mt-2 block text-lg">{duplicateClient.name}</span>
                    </p>
                    <button 
                        onClick={() => {
                            setShowDuplicateAlert(false);
                            selectSuggestion(duplicateClient);
                        }}
                        style={{ backgroundColor: primaryColor }}
                        className="w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                    >
                        VER CLIENTE EXISTENTE
                    </button>
                    <button 
                        onClick={() => setShowDuplicateAlert(false)}
                        className="w-full py-4 mt-2 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
                    >
                        CERRAR AVISO
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ClientModal;

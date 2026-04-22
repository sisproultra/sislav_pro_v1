

import React, { useState, useEffect, useRef } from 'react';
import { Client } from '../types';
import { X, Search, Loader2, Save, User, MapPin, Phone, Calendar, ChevronDown, Check, AlertTriangle, Camera, Navigation, Hash } from 'lucide-react';
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

  const primaryColor = document.documentElement.style.getPropertyValue('--primary-color') || '#4f46e5';

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
  }, [initialData, isOpen, initialDocType]);

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
    setDocType(initialDocType as any);
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
  };

  const handleDocNumberChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    setDocNumber(cleanValue);

    if (cleanValue.length >= 5 && !isLocked) {
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
    if (!docNumber || isSearching || (docType as string) === '-' || isLocked) return;
    
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
    
    // LÓGICA DE VALIDACIÓN MEJORADA
    const isDocumentChanged = initialData 
        ? (String(initialData.docNumber) !== String(docNumber) || String(initialData.docType) !== String(docType)) 
        : true;

    // FIX: Using casting to avoid comparison error between enum and string
    if (((docType as string) === 'DNI' || (docType as string) === 'RUC') && isDocumentChanged) {
        // Solo buscamos duplicados si el documento ha sido cambiado o es un registro nuevo
        const existing = clientsList.find(c => 
            String(c.docType) === String(docType) && 
            String(c.docNumber) === String(docNumber) && 
            (initialData ? String(c.id) !== String(initialData.id) : true)
        );

        if (existing) {
            alert(`⚠️ BLOQUEO DE SEGURIDAD:\n\nEl documento ${docType} "${docNumber}" ya se encuentra registrado a nombre de:\n\n👉 ${existing.name}\n\nNo se permite registrar el mismo documento varias veces.`);
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
      sucursal_id: initialData?.sucursal_id || ''
    });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-2 md:p-4 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
        
        <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 bg-white">
            <h2 className="text-slate-900 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                {initialData ? 'EDITAR CLIENTE' : 'NUEVO CLIENTE'}
            </h2>
            <button onClick={onClose} className="text-gray-300 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded-full">
                <X size={20} />
            </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Identificación y Datos</h3>
                    
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo de documento</label>
                        <div className="flex gap-1">
                            {(['-', 'DNI', 'RUC'] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    disabled={isLocked && type !== docType} 
                                    onClick={() => setDocType(type)}
                                    style={docType === type ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                                        docType === type 
                                        ? 'text-white shadow-md' 
                                        : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-200'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {type === '-' ? 'Sin Doc' : type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {(docType as string) !== '-' && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200 relative z-50" ref={suggestionRef}>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Número de documento</label>
                            <div className="flex gap-2">
                                <input
                                    required={(docType as string) !== '-'}
                                    disabled={isLocked}
                                    value={docNumber}
                                    onChange={(e) => handleDocNumberChange(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSearch();
                                        }
                                    }}
                                    className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-4 text-xl font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder:text-slate-300 shadow-inner disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                                    placeholder={docType === 'DNI' ? '8 dígitos' : (docType === 'RUC' ? '11 dígitos' : 'Opcional')}
                                />
                                {(docType as string) !== '-' && (
                                    <button 
                                        type="button" 
                                        onClick={handleSearch}
                                        disabled={isSearching || !docNumber || isLocked}
                                        className="bg-slate-900 text-white px-3 py-2 rounded-xl hover:bg-black transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                                    </button>
                                )}
                            </div>

                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[160] overflow-hidden animate-in fade-in slide-in-from-top-2">
                                    <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                                        <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md">
                                            <Search size={12} strokeWidth={3}/>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Resultados en base de datos</span>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                        {suggestions.map((client) => (
                                            <button
                                                key={client.id}
                                                type="button"
                                                onClick={() => selectSuggestion(client)}
                                                className="w-full p-4 hover:bg-indigo-50 flex items-center justify-between border-b border-gray-50 last:border-0 transition-colors text-left group"
                                            >
                                                <div className="flex-1 min-w-0 mr-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="bg-slate-900 text-white px-2.5 py-1 rounded-lg text-xs font-mono tracking-tight font-bold">#{client.docNumber}</span>
                                                        <span className="font-bold text-slate-800 text-[15px] truncate uppercase tracking-tight">{client.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-slate-500">
                                                        <MapPin size={10} />
                                                        <span className="text-[10px] font-bold truncate uppercase tracking-wide">{client.address || 'Sin dirección registrada'}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-indigo-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Check size={12} strokeWidth={3}/>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-1">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre / Nombre Comercial</label>
                            {sunatStatus && (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-right-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter ${
                                        sunatStatus.toUpperCase() === 'ACTIVO' ? 'bg-green-100 text-green-600 border border-green-200' : 'bg-red-100 text-red-600 border border-red-200'
                                    }`}>
                                        {sunatStatus}
                                    </span>
                                    {sunatCondition && (
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter ${
                                            sunatCondition.toUpperCase() === 'HABIDO' ? 'bg-blue-100 text-blue-600 border border-blue-200' : 'bg-amber-100 text-amber-600 border border-amber-200'
                                        }`}>
                                            {sunatCondition}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input
                                required
                                disabled={isLocked}
                                value={name}
                                onChange={(e) => setName(e.target.value.toUpperCase())}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all uppercase placeholder:text-slate-300 shadow-inner disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                                placeholder="Nombre completo del cliente"
                            />
                        </div>
                    </div>

                    {(docType as string) === 'RUC' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                             <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">RUC Fiscal</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                    <input
                                        value={ruc}
                                        onChange={(e) => setRuc(e.target.value.replace(/\D/g, ''))}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-[11px] font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder:text-slate-300 shadow-inner"
                                        placeholder="11 dígitos"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Razón Social</label>
                                <div className="relative">
                                    <input
                                        value={razonSocial}
                                        onChange={(e) => setRazonSocial(e.target.value.toUpperCase())}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-[11px] font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all uppercase placeholder:text-slate-300 shadow-inner"
                                        placeholder="Nombre legal completo"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">País</label>
                            <div className="relative">
                                <select 
                                    value={selectedCountry.code}
                                    onChange={(e) => setSelectedCountry(LATAM_COUNTRIES.find(c => c.code === e.target.value)!)}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-10 pr-2 py-2.5 text-[11px] font-bold text-slate-900 outline-none focus:bg-white appearance-none shadow-inner"
                                >
                                    {LATAM_COUNTRIES.map(c => (
                                        <option key={c.code} value={c.code}>{c.name} ({c.phone})</option>
                                    ))}
                                </select>
                                <img 
                                    src={`https://flagcdn.com/w20/${selectedCountry.code.toLowerCase()}.png`} 
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-auto rounded-sm" 
                                    alt="flag" 
                                />
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 text-slate-300" size={16} />
                                <input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder:text-slate-300 shadow-inner"
                                    placeholder="999888777"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cumpleaños 🪅</label>
                            <div className="grid grid-cols-2 gap-1.5">
                                <select 
                                    value={birthMonth} 
                                    onChange={e => setBirthMonth(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-2 py-2.5 text-[11px] font-bold text-slate-900 outline-none appearance-none shadow-inner"
                                >
                                    <option value="">Mes</option>
                                    {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m, i) => (
                                        <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                                    ))}
                                </select>
                                <select 
                                    value={birthDay} 
                                    onChange={e => setBirthDay(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-2 py-2.5 text-[11px] font-bold text-slate-900 outline-none appearance-none shadow-inner"
                                >
                                    <option value="">Día</option>
                                    {Array.from({ length: 31 }, (_, i) => (
                                        <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Género</label>
                            <select 
                                value={gender} 
                                onChange={e => setGender(e.target.value as any)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-900 outline-none appearance-none shadow-inner"
                            >
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dirección (Opcional)</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input
                                value={address}
                                onChange={(e) => setAddress(e.target.value.toUpperCase())}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-[11px] font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all uppercase placeholder:text-slate-300 shadow-inner"
                                placeholder="Ej: JR. LIMA 123..."
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ubicación Google Maps (URL)</label>
                        <div className="relative">
                            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input
                                value={googleMapsUrl}
                                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl pl-10 pr-4 py-2.5 text-[11px] font-bold text-blue-600 underline outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder:text-slate-300 shadow-inner"
                                placeholder="https://maps.app.goo.gl/..."
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2 flex items-center gap-2">
                        <AlertTriangle className="text-amber-500" size={14} /> Gestión de Alertas
                    </h3>
                    
                    <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 space-y-5 h-full flex flex-col justify-between shadow-inner">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mensaje de alerta</label>
                            <textarea 
                                value={alertMessage}
                                onChange={(e) => setAlertMessage(e.target.value)}
                                className="w-full border-2 border-white rounded-2xl p-4 text-xs font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-50 min-h-[160px] resize-none bg-white placeholder:text-slate-200 shadow-sm transition-all"
                                placeholder="Escriba aquí si el cliente tiene alguna restricción, deuda pendiente o nota especial..."
                            />
                        </div>

                        <div className="space-y-3 pb-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 text-center block">Color del Indicador</label>
                            <div className="flex gap-4 items-center justify-center">
                                {ALERT_COLORS.map(color => (
                                    <button
                                        key={color.id}
                                        type="button"
                                        onClick={() => setAlertColor(color.id as any)}
                                        className={`w-10 h-10 rounded-full ${color.bg} transition-all flex items-center justify-center relative ${alertColor === color.id ? 'ring-4 ring-indigo-100 ring-offset-2 scale-110 shadow-lg' : 'hover:scale-105 opacity-50'}`}
                                    >
                                        {alertColor === color.id && (
                                            <div className="bg-indigo-600 text-white rounded-full p-0.5 shadow-sm border-2 border-white">
                                                <Check size={10} strokeWidth={4} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <div className="mt-8 flex justify-end">
                <button
                    type="submit"
                    style={{ backgroundColor: primaryColor }}
                    className="hover:opacity-90 text-white font-bold py-4 px-12 rounded-2xl shadow-xl shadow-indigo-600/30 transition-all flex items-center gap-3 active:scale-95 uppercase text-xs tracking-widest"
                >
                    <Save size={20} /> Guardar Cliente
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ClientModal;

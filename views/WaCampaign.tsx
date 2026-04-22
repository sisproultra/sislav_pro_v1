import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Users, Send, Settings, BarChart3, Play, Pause, RotateCcw, Upload, Image as ImageIcon,
    CheckCircle2, XCircle, Clock, LayoutDashboard, PlusCircle, Check, Download, AlertCircle,
    RefreshCcw, Code, CheckCheck, Zap, Paperclip, Trash2, ExternalLink, X, Bell, Calendar,
    ChevronDown, Filter, UserCheck, Timer, MessageSquare, Link, Smartphone, Info, AlertTriangle,
    Loader2, Save, Trash
} from 'lucide-react';
import {
    Contact, CampaignTemplate, CampaignStatus, CampaignMetrics, Client, Company, Invoice
} from '../types';
import { EvolutionService } from '../services/evolutionService';
import { dbGetInvoices, dbSaveWaCampaignTemplates, dbSaveWaCampaignImage, dbUploadImage } from '../services/dbService';
import * as XLSX from 'xlsx';

interface WaCampaignProps {
    clients: Client[];
    company: Company;
    // Props elevadas desde App.tsx para persistencia
    globalContacts: Contact[];
    setGlobalContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
    globalStatus: CampaignStatus;
    setGlobalStatus: React.Dispatch<React.SetStateAction<CampaignStatus>>;
    globalTemplates: CampaignTemplate[];
    setGlobalTemplates: React.Dispatch<React.SetStateAction<CampaignTemplate[]>>;
    globalDelay: number;
    setGlobalDelay: React.Dispatch<React.SetStateAction<number>>;
    globalImage: string;
    setGlobalImage: React.Dispatch<React.SetStateAction<string>>;
    globalReminderMsg: string;
    setGlobalReminderMsg: React.Dispatch<React.SetStateAction<string>>;
    globalReminderTemplates: CampaignTemplate[];
    setGlobalReminderTemplates: React.Dispatch<React.SetStateAction<CampaignTemplate[]>>;
    globalActiveTab: 'campaign' | 'reminder';
    setGlobalActiveTab: React.Dispatch<React.SetStateAction<'campaign' | 'reminder'>>;
}

const WaCampaign: React.FC<WaCampaignProps> = ({ 
    clients, company, 
    globalContacts, setGlobalContacts,
    globalStatus, setGlobalStatus,
    globalTemplates, setGlobalTemplates,
    globalDelay, setGlobalDelay,
    globalImage, setGlobalImage,
    globalReminderMsg, setGlobalReminderMsg,
    globalReminderTemplates, setGlobalReminderTemplates,
    globalActiveTab, setGlobalActiveTab
}) => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
    const [isImgModalOpen, setIsImgModalOpen] = useState(false);
    const [selectedReminderFilter, setSelectedReminderFilter] = useState('OLD_7');
    const [previewTemplateIdx, setPreviewTemplateIdx] = useState(0);
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [showSummary, setShowSummary] = useState(false);
    const [isDbLoading, setIsDbLoading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const evolutionConfig = {
        baseUrl: company?.whatsapp_instance || '',
        apiKey: company?.whatsapp_token || '',
        instanceName: company?.whatsapp_instance_name || ''
    };

    // --- MOTOR DE ENVÍO (WORKER) ---
    useEffect(() => {
        if (globalStatus !== CampaignStatus.RUNNING) return;

        // Buscamos el siguiente contacto pendiente
        const nextContact = globalContacts.find(c => c.status === 'pending');

        if (!nextContact) {
            setGlobalStatus(CampaignStatus.COMPLETED);
            return;
        }

        // Iniciamos el proceso con el delay configurado
        const timer = setTimeout(async () => {
            // 1. Marcamos contacto como procesando
            setGlobalContacts(prev => prev.map(c => 
                c.id === nextContact.id ? { ...c, status: 'processing' } : c
            ));

            try {
                const service = new EvolutionService(evolutionConfig);
                
                // 2. Preparar el mensaje (Rotación aleatoria)
                let text = '';
                if (globalActiveTab === 'reminder') {
                    if (globalReminderTemplates && globalReminderTemplates.length > 0) {
                        const template = globalReminderTemplates[Math.floor(Math.random() * globalReminderTemplates.length)]?.text || '';
                        text = template.replace(/-nombre-/g, nextContact.name);
                    } else {
                        text = globalReminderMsg.replace(/-nombre-/g, nextContact.name);
                    }
                } else {
                    if (globalTemplates && globalTemplates.length > 0) {
                        const template = globalTemplates[Math.floor(Math.random() * globalTemplates.length)]?.text || '';
                        text = template.replace(/-nombre-/g, nextContact.name);
                    } else {
                        text = "Hola -nombre-".replace(/-nombre-/g, nextContact.name);
                    }
                }

                if (!text) throw new Error("Mensaje vacío");

                // 3. Ejecutar el envío
                if (globalActiveTab === 'campaign' && globalImage) {
                    await service.sendMedia(nextContact.phone, globalImage, text);
                } else {
                    await service.sendText(nextContact.phone, text);
                }

                // 4. Actualizar a éxito
                setGlobalContacts(prev => prev.map(c => 
                    c.id === nextContact.id ? { ...c, status: 'sent', sentAt: new Date() } : c
                ));

            } catch (err: any) {
                console.error("Error enviando mensaje a:", nextContact.phone, err);
                // 5. Actualizar a fallido
                setGlobalContacts(prev => prev.map(c => 
                    c.id === nextContact.id ? { ...c, status: 'failed', error: err.message || 'Error API' } : c
                ));
            }
        }, globalDelay * 1000);

        return () => clearTimeout(timer);
    }, [globalStatus, globalContacts, globalDelay, globalActiveTab, globalTemplates, globalReminderMsg, globalImage]);

    const cleanNameForPath = (name: string) => {
        return name.trim().toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
    };

    const normalizePhone = (p: string) => {
        let clean = p.replace(/\D/g, '');
        if (clean.length === 9 && (clean.startsWith('9') || clean.startsWith('8'))) {
            clean = '51' + clean;
        }
        return clean;
    };

    const metrics: CampaignMetrics = {
        total: globalContacts.length,
        sent: globalContacts.filter(c => c.status === 'sent').length,
        failed: globalContacts.filter(c => c.status === 'failed').length,
        pending: globalContacts.filter(c => c.status === 'pending').length,
    };

    const checkConnection = async () => {
        if (!evolutionConfig.baseUrl || !evolutionConfig.instanceName) {
            setIsConnected(false);
            return;
        }
        const service = new EvolutionService(evolutionConfig);
        const connected = await service.checkInstance();
        setIsConnected(connected);
        return connected;
    };

    useEffect(() => {
        if (company) {
            checkConnection();
            loadInvoices();
            const interval = setInterval(checkConnection, 15000);
            return () => clearInterval(interval);
        }
    }, [company?.id]);

    const loadInvoices = async () => {
        const { invoices: data } = await dbGetInvoices();
        setInvoices(data);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];
                const formatted: Contact[] = data.map((item, idx) => ({
                    id: `c-${Date.now()}-${idx}`,
                    name: String(item.Nombre || item.name || 'Cliente'),
                    phone: normalizePhone(String(item.Telefono || item.phone || '')),
                    status: 'pending' as const
                })).filter(c => c.phone.length > 5);
                setGlobalContacts(formatted);
                setGlobalStatus(CampaignStatus.IDLE);
            } catch (err) { alert("Error al leer Excel"); }
        };
        reader.readAsBinaryString(file);
    };

    const handleLocalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsDbLoading(true);
            try {
                const holdingName = cleanNameForPath(company.holding_name || 'demo');
                // FIX: Cast company to any as slug exists on Sucursal but type is Company
                const branchSlug = cleanNameForPath((company as any).slug || 'demo_lima');
                const storagePath = `global/empresas/${holdingName}/${branchSlug}/imagen_campania/wa_camp_${Date.now()}.jpg`;
                const publicUrl = await dbUploadImage('laundry-assets', file, storagePath);
                setGlobalImage(publicUrl);
                await dbSaveWaCampaignImage(publicUrl);
            } catch (err) {
                alert("Error al subir imagen al storage.");
            } finally {
                setIsDbLoading(false);
            }
        }
    };

    const loadFromDatabase = () => {
        const formatted: Contact[] = clients
            .filter(c => c.phone && c.phone.length > 5)
            .map((client, idx) => ({
                id: `db-${client.id || idx}`,
                name: client.name,
                phone: normalizePhone(client.phone!),
                status: 'pending' as const
            }));
        setGlobalContacts(formatted);
        setGlobalStatus(CampaignStatus.IDLE);
    };

    const DEFAULT_REMINDERS = [
        "Hola -nombre-, le recordamos que tiene prendas listas en la lavandería. ¡Le esperamos!",
        "Estimado(a) -nombre-, su pedido ya está disponible para recojo. Gracias por su preferencia.",
        "Buen día -nombre-, pase a recoger sus prendas de la lavandería cuando guste. ¡Saludos!",
        "Hola -nombre-, solo queríamos recordarle que sus prendas ya están limpias y listas.",
        "¡Buenas noticias -nombre-! Ya puede pasar por su ropa a la lavandería. ¡Buen día!",
        "Recordatorio de -nombre-: sus prendas están listas para ser recogidas. ¡Gracias!",
        "Estimado(a) -nombre-, no olvide pasar por la lavandería por su pedido pendiente. Estamos atendiendo.",
        "Hola -nombre-, tenemos su ropa lista y empacada. ¡Le esperamos pronto!",
        "Buen día -nombre-, sus prendas ya pasaron por control de calidad y están listas. ¡Saludos!",
        "Hola -nombre-, le enviamos este recordatorio porque su pedido ya está listo en local."
    ];

    const loadFilteredReminders = () => {
        // Si no hay plantillas de recordatorio, cargamos las de por defecto
        if (globalReminderTemplates.length === 0) {
            setGlobalReminderTemplates(DEFAULT_REMINDERS.map(text => ({ text })));
        }
        const now = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);

        let filtered: Invoice[] = [];
        if (selectedReminderFilter === 'OLD_7') {
            filtered = invoices.filter(inv => {
                const invDate = new Date(inv.date);
                return inv.orderStatus === 'LISTO' && invDate < weekAgo;
            });
        } else if (selectedReminderFilter === 'READY_TODAY') {
            const todayStr = now.toISOString().split('T')[0];
            filtered = invoices.filter(inv => inv.orderStatus === 'LISTO' && inv.date.startsWith(todayStr));
        }

        const formatted: Contact[] = filtered.map(inv => ({
            id: inv.id,
            name: inv.client.name,
            phone: inv.client.phone ? normalizePhone(inv.client.phone) : '',
            status: 'pending' as const
        })).filter(c => c.phone.length > 5);

        setGlobalContacts(formatted);
        setGlobalStatus(CampaignStatus.IDLE);
    };

    const startCampaign = () => {
        if (globalContacts.length === 0) {
            alert("Primero debe cargar una lista de contactos.");
            return;
        }
        if (!isConnected) {
            alert("La instancia de WhatsApp no está conectada.");
            return;
        }
        setGlobalStatus(CampaignStatus.RUNNING);
    };

    const handleSaveTemplates = async () => {
        setIsDbLoading(true);
        try {
            const isReminder = globalActiveTab === 'reminder';
            const templatesToSave = isReminder ? globalReminderTemplates : globalTemplates;
            await dbSaveWaCampaignTemplates(templatesToSave, globalDelay, isReminder);
            setIsMsgModalOpen(false);
        } catch (e) {
            alert("Error al guardar plantillas");
        } finally {
            setIsDbLoading(false);
        }
    };

    const handleRemoveImage = async () => {
        setIsDbLoading(true);
        try {
            await dbSaveWaCampaignImage('');
            setGlobalImage('');
        } catch (e) {
            alert("Error al quitar imagen");
        } finally {
            setIsDbLoading(false);
        }
    };

    const removeContact = (id: string) => {
        if (globalStatus === CampaignStatus.RUNNING) {
            if (!confirm("La campaña está en curso. ¿Desea eliminar este contacto de la lista de envío?")) return;
        }
        setGlobalContacts(prev => prev.filter(c => c.id !== id));
    };

    const showApiAlert = isConnected === false || !evolutionConfig.baseUrl || !evolutionConfig.apiKey || !evolutionConfig.instanceName;

    return (
        <div className="h-full bg-[#f0f2f5] flex text-slate-800 font-sans overflow-hidden">
            <aside className="w-52 bg-[#075E54] text-white flex flex-col shrink-0 z-10 shadow-lg">
                <div className="p-6 flex items-center gap-2 border-b border-[#128C7E]/30">
                    <Zap className="w-6 h-6 text-[#25D366] fill-current" />
                    <h1 className="text-lg font-bold tracking-tight">HelloWasap</h1>
                </div>
                <nav className="flex-1 p-3 space-y-1 mt-4">
                    <button onClick={() => setGlobalActiveTab('campaign')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${globalActiveTab === 'campaign' ? 'bg-[#128C7E] shadow-md' : 'hover:bg-white/5'}`}><Send size={16}/> Campañas</button>
                    <button onClick={() => setGlobalActiveTab('reminder')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${globalActiveTab === 'reminder' ? 'bg-[#128C7E] shadow-md' : 'hover:bg-white/5'}`}><Bell size={16}/> Recordatorio</button>
                </nav>
                <div className="p-4 border-t border-[#128C7E]/20">
                    <div className={`p-3 rounded-xl text-[9px] font-bold uppercase ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                            {isConnected ? 'Sincronizado' : 'Offline'}
                        </div>
                    </div>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto relative custom-scrollbar flex flex-col">
                {showApiAlert && (
                    <div className="bg-red-600 text-white px-8 py-3 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-300 shadow-lg z-[40]">
                        <AlertTriangle size={20} className="animate-pulse" />
                        <span className="font-bold text-xs uppercase tracking-widest text-center">
                            API de conexión de whatsapp Offline o desactualizada...
                        </span>
                    </div>
                )}

                <header className="bg-white border-b border-slate-200 px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-6 sticky top-0 z-30 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-900 p-2.5 rounded-2xl text-white shadow-lg">
                            {globalStatus === CampaignStatus.RUNNING ? <Loader2 className="animate-spin text-emerald-400" size={24} /> : <Send size={24} />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold uppercase tracking-tight">{globalActiveTab === 'reminder' ? 'Motor de Recordatorios' : 'Envío Masivo'}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{metrics.total} Contactos • {metrics.sent} Enviados</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-50 p-2 pr-4 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-4 px-4 border-r border-slate-200">
                            <div className="flex flex-col">
                                <label className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1"><Timer size={10}/> Delay (10s min)</label>
                                <div className="flex items-center gap-3">
                                    <input type="range" min="10" max="60" value={globalDelay} onChange={e => setGlobalDelay(Number(e.target.value))} className="w-32 h-1.5 bg-slate-200 rounded-lg accent-[#25D366] cursor-pointer" />
                                    <span className="text-sm font-bold text-[#075E54] w-6">{globalDelay}s</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIsMsgModalOpen(true)}
                                className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                                title="Configurar Rotación"
                            >
                                <MessageSquare size={20} />
                            </button>

                            {globalActiveTab === 'campaign' && (
                                <button 
                                    onClick={() => setIsImgModalOpen(true)}
                                    className={`p-2.5 rounded-xl border transition-all shadow-sm relative group ${globalImage ? 'bg-green-50 border-green-200 text-green-600' : 'bg-red-50 border-red-200 text-red-600'}`}
                                    title="Multimedia"
                                >
                                    <ImageIcon size={20} />
                                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border border-white ${globalImage ? 'bg-green-500' : 'bg-red-500'}`}>
                                        {globalImage ? <Check size={8} className="text-white" strokeWidth={4} /> : <X size={8} className="text-white" strokeWidth={4} />}
                                    </div>
                                </button>
                            )}

                            {globalStatus === CampaignStatus.IDLE && (
                                <button 
                                    onClick={startCampaign} 
                                    disabled={metrics.total === 0 || showApiAlert}
                                    className="bg-[#25D366] hover:bg-[#128C7E] disabled:bg-slate-200 disabled:text-slate-400 text-white px-8 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md flex items-center gap-2 active:scale-95"
                                >
                                    <Play size={14} fill="currentColor" /> INICIAR ENVÍO
                                </button>
                            )}
                            {globalStatus === CampaignStatus.RUNNING && (
                                <button onClick={() => setGlobalStatus(CampaignStatus.PAUSED)} className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 shadow-md"><Pause size={14} fill="currentColor" /> Pausar</button>
                            )}
                            {globalStatus === CampaignStatus.PAUSED && (
                                <button onClick={() => setGlobalStatus(CampaignStatus.RUNNING)} className="bg-[#25D366] text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 shadow-md"><Play size={14} fill="currentColor" /> Continuar</button>
                            )}
                            {globalStatus === CampaignStatus.COMPLETED && (
                                <button onClick={() => { setGlobalStatus(CampaignStatus.IDLE); setShowSummary(true); }} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 shadow-md"><CheckCircle2 size={14} /> Finalizado</button>
                            )}
                        </div>
                    </div>
                </header>

                <div className="p-8 flex-1">
                    <div className="animate-in slide-in-from-right-8 duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            <div className="lg:col-span-8 space-y-6">
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">1. Cargar Contactos</label>
                                    {globalActiveTab === 'reminder' ? (
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <select value={selectedReminderFilter} onChange={e => setSelectedReminderFilter(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#25D366]/30 appearance-none">
                                                    <option value="OLD_7">PRENDAS ANTIGUAS (+7 DIAS)</option>
                                                    <option value="READY_TODAY">PRENDAS LISTAS HOY</option>
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                                            </div>
                                            <button onClick={loadFilteredReminders} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase flex items-center gap-2 hover:bg-black transition-all shadow-md"><UserCheck size={16} /> ESCANEAR</button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-4">
                                            <button onClick={loadFromDatabase} className="flex-1 bg-indigo-50 text-indigo-600 font-bold text-[10px] py-3 rounded-xl border border-indigo-100 flex items-center justify-center gap-2"><Users size={14}/> Importar de Cartera</button>
                                            <label className="flex-1 border-2 border-dashed border-slate-200 rounded-xl py-3 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all">
                                                <div className="flex items-center gap-2"><Upload size={14} className="text-slate-300"/><span className="text-[10px] font-bold text-slate-400 uppercase">Excel</span></div>
                                                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                                            </label>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                        <h3 className="font-bold text-xs uppercase text-slate-500 flex items-center gap-2"><Users size={14}/> Lista de Envío</h3>
                                        <span className="text-[10px] font-bold bg-white border px-2 py-1 rounded-full text-slate-400">{globalContacts.length} FILTRADOS</span>
                                    </div>
                                    <div className="max-h-[500px] overflow-y-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-white sticky top-0 z-10">
                                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                                    <th className="px-6 py-3">Cliente</th>
                                                    <th className="px-6 py-3">Celular</th>
                                                    <th className="px-6 py-3 text-center">Estado</th>
                                                    <th className="px-6 py-3 text-center"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {globalContacts.length === 0 ? (
                                                    <tr><td colSpan={4} className="px-6 py-20 text-center"><Users size={48} className="mx-auto text-slate-200 mb-4" /><p className="text-sm font-bold text-slate-300 uppercase tracking-widest">Lista vacía</p></td></tr>
                                                ) : (
                                                    globalContacts.map((c, i) => (
                                                        <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                                                            <td className="px-6 py-4"><div className="font-bold text-slate-800 uppercase text-xs truncate max-w-[150px]">{c.name}</div></td>
                                                            <td className="px-6 py-4"><div className="font-mono text-[11px] text-indigo-600 font-bold">+{c.phone}</div></td>
                                                            <td className="px-6 py-4 text-center">
                                                                {c.status === 'pending' && <span className="bg-slate-100 text-slate-400 px-2 py-1 rounded-full text-[9px] font-bold uppercase">Pendiente</span>}
                                                                {c.status === 'processing' && <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-[9px] font-bold uppercase animate-pulse">Enviando...</span>}
                                                                {c.status === 'sent' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-[9px] font-bold uppercase flex items-center justify-center gap-1"><Check size={10} strokeWidth={4}/> OK</span>}
                                                                {c.status === 'failed' && <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-[9px] font-bold uppercase flex items-center justify-center gap-1" title={c.error}><X size={10} strokeWidth={4}/> Err</span>}
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                {c.status === 'pending' && (
                                                                    <button onClick={() => removeContact(c.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-4 space-y-6">
                                <div className="flex justify-center flex-col items-center gap-4">
                                    <h3 className="font-bold text-[10px] uppercase text-slate-400 tracking-widest">Vista Previa Real</h3>
                                    <div className="w-[260px] aspect-[9/18.5] bg-black rounded-[2.5rem] shadow-2xl border-[6px] border-slate-900 flex flex-col relative overflow-hidden shrink-0">
                                        <div className="bg-[#075E54] px-5 py-4 pt-6 text-white flex items-center gap-3 shrink-0">
                                            <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center font-bold text-[#075E54] text-xs">L</div>
                                            <div className="min-w-0 flex-1"><p className="text-[10px] font-bold leading-tight truncate">Lavandería</p><p className="text-[8px] opacity-60 font-bold uppercase">En línea</p></div>
                                        </div>
                                        <div className="flex-1 p-3 overflow-y-auto bg-[#e5ddd5] bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-[length:150px_150px]">
                                            {globalImage && globalActiveTab === 'campaign' && (
                                                <div className="max-w-[90%] bg-white p-1 rounded-xl shadow-sm ml-auto mb-2 overflow-hidden">
                                                    <img src={globalImage} className="w-full h-auto rounded-lg" alt="Campaña" />
                                                </div>
                                            )}
                                            <div className="max-w-[90%] bg-white p-1 rounded-xl shadow-sm ml-auto relative">
                                                <div className="p-1">
                                                    <p className="text-[11px] text-slate-800 px-1 py-1 leading-snug break-words">
                                                        {globalActiveTab === 'reminder' 
                                                            ? (globalReminderTemplates && globalReminderTemplates.length > 0 
                                                                ? (globalReminderTemplates[previewTemplateIdx % globalReminderTemplates.length]?.text || '').replace(/-nombre-/g, "Juan")
                                                                : globalReminderMsg.replace(/-nombre-/g, "Juan"))
                                                            : (globalTemplates[previewTemplateIdx]?.text || '').replace(/-nombre-/g, "Juan")}
                                                    </p>
                                                    <div className="flex justify-end items-center gap-0.5 mt-0.5 pr-1"><span className="text-[8px] text-slate-400 font-bold">12:45</span><CheckCheck size={10} className="text-[#34B7F1]" /></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-[#f0f2f5] p-2 flex items-center gap-2 shrink-0 border-t border-slate-200">
                                            <div className="flex-1 bg-white h-6 rounded-full border border-slate-200" />
                                            <div className="w-6 h-6 rounded-full bg-[#075E54] flex items-center justify-center text-white"><Send size={12} /></div>
                                        </div>
                                    </div>
                                    
                                    {((globalActiveTab === 'campaign' && globalTemplates.length > 1) || (globalActiveTab === 'reminder' && globalReminderTemplates.length > 1)) && (
                                        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
                                            <button onClick={() => setPreviewTemplateIdx(prev => {
                                                const templates = globalActiveTab === 'reminder' ? globalReminderTemplates : globalTemplates;
                                                return prev > 0 ? prev - 1 : templates.length - 1;
                                            })} className="p-1 text-green-600 hover:bg-green-50 rounded-full transition-all"><ChevronDown className="rotate-90" size={20} /></button>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Variante {previewTemplateIdx + 1} de {globalActiveTab === 'reminder' ? globalReminderTemplates.length : globalTemplates.length}</span>
                                            <button onClick={() => setPreviewTemplateIdx(prev => {
                                                const templates = globalActiveTab === 'reminder' ? globalReminderTemplates : globalTemplates;
                                                return prev < templates.length - 1 ? prev + 1 : 0;
                                            })} className="p-1 text-green-600 hover:bg-green-50 rounded-full transition-all"><ChevronDown className="-rotate-90" size={20} /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {showSummary && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
                        <div className="bg-slate-900 p-8 text-white text-center">
                            <CheckCircle2 size={64} className="mx-auto text-emerald-500 mb-4" />
                            <h3 className="text-2xl font-bold uppercase">Campaña Finalizada</h3>
                        </div>
                        <div className="p-8 space-y-4">
                            <div className="flex justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Contactos</span>
                                <span className="font-bold text-slate-900">{metrics.total}</span>
                            </div>
                            <div className="flex justify-between p-4 bg-green-50 rounded-xl border border-green-100">
                                <span className="text-[10px] font-bold text-green-600 uppercase">Enviados</span>
                                <span className="font-bold text-green-700">{metrics.sent}</span>
                            </div>
                            <button onClick={() => { setShowSummary(false); setGlobalStatus(CampaignStatus.IDLE); }} className="w-full mt-4 bg-slate-900 text-white py-4 rounded-xl font-bold uppercase text-xs">Cerrar Reporte</button>
                        </div>
                    </div>
                </div>
            )}

            {isMsgModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
                        <div className={`p-6 ${globalActiveTab === 'reminder' ? 'bg-amber-600' : 'bg-indigo-600'} text-white flex justify-between items-center shrink-0 shadow-lg`}>
                            <div className="flex items-center gap-3"><MessageSquare size={24}/><h3 className="font-bold text-xl uppercase tracking-tight">{globalActiveTab === 'reminder' ? 'Catálogo de Cobranza' : 'Rotación de Mensajes'}</h3></div>
                            <button onClick={() => setIsMsgModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-colors"><X size={24}/></button>
                        </div>
                        <div className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
                            <div className="space-y-4">
                                {(globalActiveTab === 'reminder' ? globalReminderTemplates : globalTemplates).map((t, i) => (
                                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group">
                                        <textarea 
                                            value={t.text} 
                                            onChange={e => { 
                                                const templates = globalActiveTab === 'reminder' ? globalReminderTemplates : globalTemplates;
                                                const setter = globalActiveTab === 'reminder' ? setGlobalReminderTemplates : setGlobalTemplates;
                                                const n = [...templates]; 
                                                n[i].text = e.target.value; 
                                                setter(n); 
                                            }} 
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-amber-50 transition-all min-h-[80px] resize-none" 
                                            placeholder="Use -nombre- para personalizar"
                                        />
                                        <button 
                                            onClick={() => { 
                                                const templates = globalActiveTab === 'reminder' ? globalReminderTemplates : globalTemplates;
                                                const setter = globalActiveTab === 'reminder' ? setGlobalReminderTemplates : setGlobalTemplates;
                                                const n = [...templates]; 
                                                n.splice(i, 1); 
                                                setter(n); 
                                            }} 
                                            className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={() => {
                                    const templates = globalActiveTab === 'reminder' ? globalReminderTemplates : globalTemplates;
                                    const setter = globalActiveTab === 'reminder' ? setGlobalReminderTemplates : setGlobalTemplates;
                                    setter([...templates, { text: '' }]);
                                }} 
                                className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-400 hover:text-amber-600 hover:border-amber-400 transition-all font-bold text-[10px] uppercase flex items-center justify-center gap-2"
                            >
                                <PlusCircle size={18}/> AÑADIR VARIANTE
                            </button>
                        </div>
                        <div className="p-6 bg-white border-t border-slate-100 flex justify-end">
                            <button onClick={handleSaveTemplates} disabled={isDbLoading} className="bg-slate-900 text-white px-12 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2">
                                {isDbLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Guardar {globalActiveTab === 'reminder' ? 'Catálogo' : 'Configuración'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isImgModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3"><ImageIcon size={24}/><h3 className="font-bold text-xl uppercase tracking-tight">Imagen Multimedia</h3></div>
                            <button onClick={() => setIsImgModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-colors"><X size={24}/></button>
                        </div>
                        <div className="p-10 flex flex-col items-center gap-8 bg-slate-50">
                            <div className="relative group">
                                <div className="w-64 aspect-video bg-white rounded-3xl border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center cursor-pointer group-hover:scale-105 transition-all duration-500">
                                    {isDbLoading ? <Loader2 className="animate-spin text-indigo-600" size={48} /> : globalImage ? <img src={globalImage} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-3 text-slate-300"><ImageIcon size={48} strokeWidth={1}/><span className="text-[10px] font-bold uppercase">Sin Imagen</span></div>}
                                </div>
                                {globalImage && (
                                    <button onClick={handleRemoveImage} className="absolute -top-3 -right-3 bg-red-600 text-white p-2 rounded-full shadow-xl hover:scale-110 transition-transform"><X size={16} strokeWidth={3}/></button>
                                )}
                            </div>
                            <div className="flex flex-col w-full gap-3">
                                <button onClick={() => fileInputRef.current?.click()} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"><Upload size={18}/> {globalImage ? 'Cambiar Imagen' : 'Subir Imagen'}</button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLocalImageUpload} />
                            </div>
                        </div>
                        <div className="p-6 bg-white border-t border-slate-100 text-center"><button onClick={() => setIsImgModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-[10px] uppercase tracking-widest">Cerrar</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WaCampaign;
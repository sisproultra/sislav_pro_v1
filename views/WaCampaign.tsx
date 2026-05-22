import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Users, Send, Settings, BarChart3, Play, Pause, RotateCcw, Upload, Image as ImageIcon,
    CheckCircle2, XCircle, Clock, LayoutDashboard, PlusCircle, Check, Download, AlertCircle,
    RefreshCcw, Code, CheckCheck, Zap, Paperclip, Trash2, ExternalLink, X, Bell, Calendar,
    ChevronDown, Filter, UserCheck, Timer, MessageSquare, Link, Smartphone, Info, AlertTriangle,
    Loader2, Save, Trash, ShieldAlert, FileSpreadsheet
} from 'lucide-react';
import {
    Contact, CampaignTemplate, CampaignStatus, CampaignMetrics, Client, Company, Invoice,
    WaTemplate, WaTemplateCategory
} from '../types';
import { EvolutionService } from '../services/evolutionService';
import {
    dbGetInvoices, dbSaveWaCampaignTemplates, dbSaveWaCampaignImage, dbUploadImage,
    dbGetWaTemplates, dbSaveWaTemplate, dbDeleteWaTemplate, dbToggleWaTemplate
} from '../services/dbService';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';

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
    globalActiveTab: 'campaign' | 'reminder' | 'templates';
    setGlobalActiveTab: React.Dispatch<React.SetStateAction<'campaign' | 'reminder' | 'templates'>>;
    isSendingGlobal?: boolean;
    setIsSendingGlobal?: (val: boolean) => void;
    progressGlobal?: number;
    setProgressGlobal?: (val: number) => void;
    metricsGlobal?: { sent: number; failed: number; total: number };
    setMetricsGlobal?: (val: { sent: number; failed: number; total: number }) => void;
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
    globalActiveTab, setGlobalActiveTab,
    isSendingGlobal, setIsSendingGlobal,
    progressGlobal, setProgressGlobal,
    metricsGlobal, setMetricsGlobal
}) => {
    const [selectedCategory, setSelectedCategory] = useState<WaTemplateCategory>('PROMOCION');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
    const [isImgModalOpen, setIsImgModalOpen] = useState(false);
    const [selectedReminderFilter, setSelectedReminderFilter] = useState('OLD_7');
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [showSummary, setShowSummary] = useState(false);
    const [isDbLoading, setIsDbLoading] = useState(false);
    const [waTemplatesList, setWaTemplatesList] = useState<WaTemplate[]>([]);
    const [editingTemplate, setEditingTemplate] = useState<Partial<WaTemplate> | null>(null);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [isDraggingExcel, setIsDraggingExcel] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [sendPausedInfo, setSendPausedInfo] = useState<string | null>(null);
    const [nextSendTime, setNextSendTime] = useState<Date | null>(null);
    const [, setTick] = useState(0);

    const isFirstImmediateRef = useRef(false);

    const primaryColor = company?.primaryColor || '#4f46e5';
    const [isUploadingLocal, setIsUploadingLocal] = useState(false);
    const [localUploadProgress, setLocalUploadProgress] = useState(0);
    const [uploadSucceeded, setUploadSucceeded] = useState(false);

    useEffect(() => {
        if (globalStatus !== CampaignStatus.RUNNING) return;
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [globalStatus]);

    const templateImageRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const evolutionConfig = {
        baseUrl: company?.whatsapp_instance || '',
        apiKey: company?.whatsapp_token || '',
        instanceName: company?.whatsapp_instance_name || ''
    };

    // --- MOTOR DE ENVÍO (WORKER) ---
    useEffect(() => {
        if (globalStatus !== CampaignStatus.RUNNING) {
            setSendPausedInfo(null);
            setNextSendTime(null);
            return;
        }

        const nextContact = globalContacts.find(c => c.status === 'pending');

        if (!nextContact) {
            setGlobalStatus(CampaignStatus.IDLE);
            setSendPausedInfo(null);
            setNextSendTime(null);
            setIsSendingGlobal?.(false);
            return;
        }

        const sentCount = globalContacts.filter(c => c.status === 'sent').length;
        let delayMs = Math.floor(Math.random() * (45 - 15 + 1) + 15) * 1000;
        let pausedReason = null;

        if (isFirstImmediateRef.current) {
            delayMs = 0;
            isFirstImmediateRef.current = false;
        } else if (sentCount > 0) {
            if (sentCount % 40 === 0) {
                const pauseMin = Math.floor(Math.random() * (20 - 10 + 1) + 10);
                delayMs = pauseMin * 60 * 1000;
                pausedReason = `Pausa Humana (Cada 40 msg): ${pauseMin} min`;
            } else if (sentCount % 15 === 0) {
                const pauseMin = Math.floor(Math.random() * (8 - 3 + 1) + 3);
                delayMs = pauseMin * 60 * 1000;
                pausedReason = `Pausa Humana (Cada 15 msg): ${pauseMin} min`;
            }
        }

        setSendPausedInfo(pausedReason);
        setNextSendTime(new Date(Date.now() + delayMs));

        const timer = setTimeout(async () => {
            setGlobalContacts(prev => prev.map(c => c.id === nextContact.id ? { ...c, status: 'processing' } : c));

            try {
                const service = new EvolutionService(evolutionConfig);
                let text = '';
                let templateImage = '';

                // Lógica de selección de mensaje
                const categoryToUse = globalActiveTab === 'reminder' ? 'RECOJO' : selectedCategory;
                const dbTemplates = waTemplatesList.filter(t => t.category === categoryToUse && t.is_active);
                
                const replacePlaceholders = (rawText: string, contactName: string) => {
                    const branchName = company?.nombre_comercial || company?.razonSocial || 'Nuestra Lavandería';
                    return rawText
                        .replace(/-nombre-/g, contactName)
                        .replace(/{nombre}/g, contactName)
                        .replace(/{cliente}/g, contactName)
                        .replace(/{nombre_lavanderia}/g, branchName)
                        .replace(/-empresa-/g, branchName)
                        .replace(/{empresa}/g, branchName)
                        .replace(/{sucursal}/g, branchName);
                };

                if (dbTemplates.length > 0) {
                    const randomTpl = dbTemplates[Math.floor(Math.random() * dbTemplates.length)];
                    text = replacePlaceholders(randomTpl.content, nextContact.name);
                    templateImage = randomTpl.image_url || '';
                } else {
                    // Fallbacks
                    const fallbackTemplates = globalActiveTab === 'reminder' ? globalReminderTemplates : globalTemplates;
                    if (fallbackTemplates.length > 0) {
                        text = replacePlaceholders(fallbackTemplates[Math.floor(Math.random() * fallbackTemplates.length)].text, nextContact.name);
                    } else {
                        text = replacePlaceholders(`Hola {nombre}, un saludo de nuestra parte de {nombre_lavanderia}.`, nextContact.name);
                    }
                }

                if (!text) throw new Error("Mensaje vacío");

                const finalImage = templateImage || (globalActiveTab === 'campaign' ? globalImage : '');

                if (finalImage) {
                    await service.sendMedia(nextContact.phone, finalImage, text);
                } else {
                    await service.sendText(nextContact.phone, text);
                }

                setGlobalContacts(prev => prev.map(c => 
                    c.id === nextContact.id ? { ...c, status: 'sent', sentAt: new Date() } : c
                ));
            } catch (err: any) {
                console.error("Error enviando:", err);
                setGlobalContacts(prev => prev.map(c => 
                    c.id === nextContact.id ? { ...c, status: 'failed', error: err.message || 'Error API' } : c
                ));
            }
        }, delayMs);

        return () => clearTimeout(timer);
    }, [globalStatus, globalContacts, globalActiveTab, selectedCategory, waTemplatesList, globalTemplates, globalReminderTemplates, globalImage]);

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

    useEffect(() => {
        if (!setIsSendingGlobal || !setProgressGlobal || !setMetricsGlobal) return;

        if (globalStatus === CampaignStatus.RUNNING) {
            setIsSendingGlobal(true);
            const progressPercent = metrics.total > 0 ? Math.round(((metrics.sent + metrics.failed) / metrics.total) * 100) : 0;
            setProgressGlobal(progressPercent);
            setMetricsGlobal({
                sent: metrics.sent,
                failed: metrics.failed,
                total: metrics.total
            });
        } else if (globalStatus === CampaignStatus.COMPLETED) {
            setGlobalStatus(CampaignStatus.IDLE);
            setIsSendingGlobal(false);
            setProgressGlobal(0);
        } else {
            setIsSendingGlobal(false);
            setProgressGlobal(0);
        }
    }, [globalStatus, metrics.sent, metrics.failed, metrics.total, setIsSendingGlobal, setProgressGlobal, setMetricsGlobal, setGlobalStatus]);

    useEffect(() => {
        if (company) {
            const check = async () => {
                const service = new EvolutionService(evolutionConfig);
                setIsConnected(await service.checkInstance());
            }
            check();
            loadInvoices();
            loadWaTemplates();
            const interval = setInterval(check, 30000);
            return () => clearInterval(interval);
        }
    }, [company?.id]);

    const loadWaTemplates = async () => {
        const templates = await dbGetWaTemplates();
        setWaTemplatesList(templates);
    };

    const loadInvoices = async () => {
        const { invoices: data } = await dbGetInvoices();
        setInvoices(data);
    };

    const downloadExcelTemplate = () => {
        const exampleData = [
            { Nombre: 'Juan Pérez', Telefono: '51999888777' },
            { Nombre: 'María Gomez', Telefono: '51987654321' },
            { Nombre: 'Carlos Silva', Telefono: '51912345678' }
        ];
        const worksheet = XLSX.utils.json_to_sheet(exampleData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Campaña');
        XLSX.writeFile(workbook, 'plantilla_campana_wa.xlsx');
    };

    const processExcelFile = (file: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];
                
                // We'll support both Spanish and English columns
                const formatted: Contact[] = data.map((item: any, idx) => {
                    const name = String(item.Nombre || item.nombre || item.Name || item.name || 'Cliente');
                    const rawPhone = String(item.Telefono || item.telefono || item.Phone || item.phone || '');
                    return {
                        id: `xls-${Date.now()}-${idx}`,
                        name,
                        phone: normalizePhone(rawPhone),
                        status: 'pending' as const
                    };
                }).filter(c => c.phone.length > 5);

                if (formatted.length === 0) {
                    alert("No se encontraron contactos válidos en el archivo Excel. Asegúrate de incluir las columnas 'Nombre' y 'Telefono'.");
                    return;
                }

                setGlobalContacts(formatted);
                setIsExcelModalOpen(false);
                alert(`¡Se han cargado ${formatted.length} contactos de manera exitosa!`);
            } catch (err) {
                console.error(err);
                alert("Ocurrió un error al procesar el archivo Excel. Asegúrate de que tenga un formato compatible.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processExcelFile(file);
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
    };

    const handleLocalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && company) {
            setIsUploadingLocal(true);
            setLocalUploadProgress(10);
            setUploadSucceeded(false);

            const interval = setInterval(() => {
                setLocalUploadProgress(prev => {
                    if (prev >= 90) return prev;
                    return prev + Math.floor(Math.random() * 8) + 4;
                });
            }, 150);

            try {
                const path = `holding/wa_campaign/${Date.now()}_${file.name}`;
                const publicUrl = await dbUploadImage('laundry-assets', file, path);
                
                clearInterval(interval);
                setLocalUploadProgress(100);
                setGlobalImage(publicUrl);
                await dbSaveWaCampaignImage(publicUrl);
                setUploadSucceeded(true);
            } catch (err) {
                clearInterval(interval);
                alert("Error al cargar la imagen. Inténtelo nuevamente.");
                setIsUploadingLocal(false);
                setUploadSucceeded(false);
                setLocalUploadProgress(0);
            } finally {
                clearInterval(interval);
            }
        }
    };

    const handleUploadTemplateImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !company) return;
        setIsUploadingImage(true);
        try {
            const url = await dbUploadImage('fotos_app', file, `templ_${Date.now()}`);
            setEditingTemplate(prev => prev ? { ...prev, image_url: url } : null);
        } catch (err) { alert("Error"); } finally { setIsUploadingImage(false); }
    };

    const handleSaveWaTemplate = async () => {
        if (!editingTemplate?.content || !editingTemplate?.category) return;
        setIsDbLoading(true);
        try {
            await dbSaveWaTemplate(editingTemplate);
            await loadWaTemplates();
            setIsTemplateModalOpen(false);
            setEditingTemplate(null);
        } catch (e) { alert("Error"); } finally { setIsDbLoading(false); }
    };

    const handleLoadDefaultTemplates = async () => {
        setIsDbLoading(true);
        try {
            const defaults = [
                "Hola 👋 Somos {nombre_lavanderia}. Aprovecha nuestra promoción exclusiva por tiempo limitado ✨",
                "¡Tenemos promociones especiales para ti! 😊 Solo disponibles por pocos días en {nombre_lavanderia}.",
                "Hola 😊 En {nombre_lavanderia} queremos ofrecerte descuentos exclusivos por tiempo limitado.",
                "🚨 Promoción activa en {nombre_lavanderia} 🚨 Aprovecha nuestros precios especiales antes que termine.",
                "Hola 👋 Tenemos una promoción exclusiva que podría interesarte 😊 Disponible solo esta semana.",
                "✨ Aprovecha nuestras ofertas especiales en lavandería por tiempo limitado. ¡Te esperamos!",
                "Hola 😊 Queríamos contarte que tenemos promociones exclusivas disponibles solo por pocos días.",
                "En {nombre_lavanderia} activamos descuentos especiales 🙌 Aprovecha antes que finalicen.",
                "¡Hola! 👋 Tenemos promociones limitadas para nuestros clientes 😊",
                "🧺 Aprovecha nuestras promociones exclusivas en lavandería. Solo por tiempo limitado ✨",
                "Hola 😊 En {nombre_lavanderia} tenemos precios especiales disponibles desde hoy.",
                "¡No dejes pasar nuestras promociones especiales! 👌 Disponibles únicamente por tiempo limitado.",
                "Hola 👋 Queremos invitarte a aprovechar nuestras ofertas exclusivas en lavandería 😊",
                "✨ Descuentos especiales activos en {nombre_lavanderia}. Aprovecha esta oportunidad.",
                "Hola 😊 Tenemos promociones pensadas para ti. Disponibles solo por pocos días 🙌",
                "🚨 Oferta especial en lavandería 🚨 Aprovecha nuestros descuentos antes que terminen.",
                "Hola 👋 Ya están activas nuestras promociones exclusivas en {nombre_lavanderia}.",
                "😊 Aprovecha nuestras ofertas limitadas y disfruta de precios especiales en lavandería.",
                "Hola ✨ Tenemos promociones exclusivas disponibles desde hoy en {nombre_lavanderia}.",
                "¡Promoción por tiempo limitado! 👌 Aprovecha nuestros descuentos especiales antes que finalicen."
            ];

            for (const content of defaults) {
                const alreadyExists = waTemplatesList.some(t => t.content === content && t.category === 'PROMOCION');
                if (!alreadyExists) {
                    await dbSaveWaTemplate({
                        category: 'PROMOCION',
                        content,
                        is_active: true
                    });
                }
            }
            await loadWaTemplates();
            alert("¡Mensajes de promoción cargados con éxito!");
        } catch (err) {
            console.error(err);
            alert("Error al cargar los mensajes predeterminados.");
        } finally {
            setIsDbLoading(false);
        }
    };

    const loadFilteredReminders = () => {
        const now = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        let filtered: Invoice[] = [];
        if (selectedReminderFilter === 'OLD_7') {
            filtered = invoices.filter(inv => inv.orderStatus === 'LISTO' && new Date(inv.date) < weekAgo);
        } else {
            const todayStr = now.toISOString().split('T')[0];
            filtered = invoices.filter(inv => inv.orderStatus === 'LISTO' && inv.date.startsWith(todayStr));
        }
        setGlobalContacts(filtered.map(inv => ({
            id: inv.id,
            name: inv.client.name,
            phone: normalizePhone(inv.client.phone || ''),
            status: 'pending' as const
        })).filter(c => c.phone.length > 5));
    };

    return (
        <div className="h-full bg-[#f0f2f5] flex text-slate-800 font-sans overflow-hidden">
            <main className="flex-1 overflow-y-auto relative custom-scrollbar flex flex-col">
                <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-900 p-2.5 rounded-2xl text-white">
                            {globalStatus === CampaignStatus.RUNNING ? <Loader2 className="animate-spin text-emerald-400" size={24} /> : <Send size={24} />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold uppercase tracking-tight">{globalActiveTab === 'reminder' ? 'Recordatorios' : 'Campaña de Marketing'}</h2>
                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${
                                    isConnected ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                                }`}>
                                    {isConnected ? 'Sincronizado' : 'Offline'}
                                </span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{metrics.total} Contactos en lista</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {globalActiveTab === 'campaign' && (
                            <button 
                                onClick={() => setIsImgModalOpen(true)} 
                                className={`p-2.5 rounded-xl border transition-all shadow-sm ${globalImage ? 'bg-green-50 border-green-200 text-green-600' : 'bg-slate-50 border-slate-200'}`}
                            >
                                <ImageIcon size={20}/>
                            </button>
                        )}
                        {globalStatus === CampaignStatus.IDLE ? (
                            <button 
                                onClick={() => {
                                    isFirstImmediateRef.current = true;
                                    setGlobalStatus(CampaignStatus.RUNNING);
                                }} 
                                disabled={metrics.total === 0} 
                                className="bg-[#25D366] text-white px-8 py-2.5 rounded-xl font-bold text-xs uppercase hover:bg-[#128C7E] transition-all shadow-md active:scale-95 disabled:opacity-50"
                            >
                                Iniciar Envío
                            </button>
                        ) : (
                            <button onClick={() => setGlobalStatus(CampaignStatus.IDLE)} className="bg-orange-500 text-white px-8 py-2.5 rounded-xl font-bold text-xs uppercase shadow-md animate-pulse">Detener</button>
                        )}
                    </div>
                </header>

                <div className="p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
                        {/* COLUMNA IZQUIERDA: CONTROLES Y LISTA */}
                        <div className="md:col-span-7 lg:col-span-8 space-y-6">
                            {/* METRICAS */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total</div>
                                    <div className="text-2xl font-black">{metrics.total}</div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm bg-emerald-50/20">
                                    <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Enviados</div>
                                    <div className="text-2xl font-black text-emerald-600">{metrics.sent}</div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm bg-red-50/20">
                                    <div className="text-[10px] font-bold text-red-600 uppercase mb-1">Fallidos</div>
                                    <div className="text-2xl font-black text-red-600">{metrics.failed}</div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pendientes</div>
                                    <div className="text-2xl font-black text-slate-400">{metrics.pending}</div>
                                </div>
                            </div>

                            {/* CONFIGURACIÓN */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">1. Cargar Contactos</label>
                                        {globalActiveTab === 'reminder' ? (
                                            <div className="flex gap-2">
                                                <select value={selectedReminderFilter} onChange={e => setSelectedReminderFilter(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none">
                                                    <option value="OLD_7">CLIENTES ANTIGUOS (+7 DIAS)</option>
                                                    <option value="READY_TODAY">PEDIDOS LISTOS HOY</option>
                                                </select>
                                                <button onClick={loadFilteredReminders} className="bg-slate-900 text-white px-6 rounded-xl font-bold text-[10px] uppercase">Escanear</button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-4">
                                                <button onClick={loadFromDatabase} className="flex-1 bg-indigo-50 text-indigo-600 py-3 rounded-xl border border-indigo-100 font-bold text-[10px] uppercase flex items-center justify-center gap-2">
                                                    <Users size={14}/> Cartera CRM
                                                </button>
                                                <button 
                                                    id="btn-subir-excel-modal-trigger" 
                                                    onClick={() => setIsExcelModalOpen(true)} 
                                                    className="flex-1 border-2 border-dashed border-slate-200 rounded-xl py-3 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 font-bold transition-all text-slate-500 hover:text-slate-800"
                                                >
                                                    <Upload size={14} className="text-slate-400 mb-0.5"/>
                                                    <span className="text-[9px] uppercase">Subir Excel</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">2. Categoría de Mensaje</label>
                                        <select 
                                            value={selectedCategory} 
                                            onChange={e => setSelectedCategory(e.target.value as WaTemplateCategory)} 
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#25D366]/20"
                                        >
                                            <option value="PROMOCION">🎁 PROMOCIÓN</option>
                                            <option value="RECOJO">🔔 RECOJO DE ROPA</option>
                                            <option value="CUMPLEANOS">🎂 CUMPLEAÑOS</option>
                                            <option value="RECORDATORIO">📢 RECORDATORIOS</option>
                                            <option value="BIENVENIDA">👋 BIENVENIDA</option>
                                            <option value="PAGO">💰 COBRANZA</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* LISTA DE EVÍO */}
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                <div className="px-6 py-4 bg-slate-50 border-b flex justify-between items-center"><h3 className="font-bold text-[10px] uppercase text-slate-500">Lista de Envío</h3><span className="text-[10px] font-bold text-slate-400">{globalContacts.length} Contactos</span></div>
                                <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                                    <table className="w-full text-left">
                                        <thead className="bg-white sticky top-0 z-10 text-[9px] font-bold text-slate-400 uppercase border-b"><tr><th className="px-6 py-3">Cliente</th><th className="px-6 py-3">Celular</th><th className="px-6 py-3 text-center">Estado</th><th className="px-6 py-3"></th></tr></thead>
                                        <tbody className="divide-y divide-slate-50 text-[11px]">
                                            {globalContacts.length === 0 ? (
                                                <tr><td colSpan={4} className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest">Lista Vacía</td></tr>
                                            ) : (
                                                globalContacts.map(c => (
                                                    <tr key={c.id} className="hover:bg-slate-50 group">
                                                        <td className="px-6 py-4 font-bold uppercase">{c.name}</td>
                                                        <td className="px-6 py-4 font-mono text-indigo-600">+{c.phone}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            {c.status === 'pending' && <span className="text-slate-400">Pendiente</span>}
                                                            {c.status === 'processing' && <span className="text-blue-600 animate-pulse">Enviando...</span>}
                                                            {c.status === 'sent' && <span className="text-emerald-600 font-bold flex items-center justify-center gap-1"><CheckCircle2 size={12}/> OK</span>}
                                                            {c.status === 'failed' && <span className="text-red-500 font-bold flex items-center justify-center gap-1"><AlertCircle size={12}/> Falló</span>}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {c.status === 'pending' && <button onClick={() => setGlobalContacts(prev => prev.filter(p => p.id !== c.id))} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* COLUMNA DERECHA: VISTA PREVIA FLOTANTE/STICKY */}
                        <div className="md:col-span-5 lg:col-span-4 md:sticky md:top-[5.5rem] self-start space-y-6">
                            <div className="bg-white p-8 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col items-center gap-6">
                                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Vista Previa</h3>
                                <div className="w-[240px] aspect-[9/19] bg-black rounded-[2.5rem] border-[6px] border-slate-900 shadow-2xl relative flex flex-col overflow-hidden">
                                    <div className="bg-[#075E54] p-4 pt-6 text-white text-[10px] font-bold">HelloWasap Online</div>
                                    <div className="flex-1 bg-[#e5ddd5] p-3 space-y-2 overflow-y-auto custom-scrollbar">
                                        {globalImage && <div className="ml-auto w-[80%] bg-white p-1 rounded-lg shadow-sm overflow-hidden"><img src={globalImage} className="w-full object-cover rounded" /></div>}
                                        <div className="ml-auto w-[85%] bg-white p-2 rounded-lg shadow-sm text-slate-800 text-[10px] leading-snug italic break-words">
                                            {(() => {
                                                const categoryToUse = globalActiveTab === 'reminder' ? 'RECOJO' : selectedCategory;
                                                const activeTemplates = waTemplatesList.filter(t => t.category === categoryToUse && t.is_active);
                                                
                                                let templateText = '';
                                                if (activeTemplates.length > 0) {
                                                    templateText = activeTemplates[0].content;
                                                } else {
                                                    const fallbackTemplates = globalActiveTab === 'reminder' ? globalReminderTemplates : globalTemplates;
                                                    if (fallbackTemplates.length > 0) {
                                                        templateText = fallbackTemplates[0].text;
                                                    } else {
                                                        templateText = globalActiveTab === 'reminder' 
                                                            ? 'Hola {nombre}, tus prendas ya están preparadas para entrega en {nombre_lavanderia}.'
                                                            : 'Hola {nombre}, aprovecha nuestras promociones especiales en {nombre_lavanderia}.';
                                                    }
                                                }

                                                const branchName = company?.nombre_comercial || company?.razonSocial || 'Nuestra Lavandería';
                                                return templateText
                                                    .replace(/-nombre-/g, 'María')
                                                    .replace(/{nombre}/g, 'María')
                                                    .replace(/{cliente}/g, 'María')
                                                    .replace(/{nombre_lavanderia}/g, branchName)
                                                    .replace(/-empresa-/g, branchName)
                                                    .replace(/{empresa}/g, branchName)
                                                    .replace(/{sucursal}/g, branchName);
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase text-center leading-relaxed">
                                    Las variantes anti-bloqueo rotan automáticamente para proteger tu línea.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            {isMsgModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col mb-20 animate-in zoom-in-95">
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center"><h3 className="font-bold text-lg uppercase tracking-tight">Gestión de Mensajes Anti-Bloqueo</h3><button onClick={() => setIsMsgModalOpen(false)}><X/></button></div>
                        <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50 space-y-6">
                            <div className="flex gap-4">
                                <button onClick={() => { setEditingTemplate({ category: 'PROMOCION', is_active: true, content: '' }); setIsTemplateModalOpen(true); }} className="flex-1 py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-400 hover:text-indigo-600 font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all">
                                    <PlusCircle size={20}/> Nuevo Mensaje
                                </button>
                                <button 
                                    onClick={handleLoadDefaultTemplates} 
                                    disabled={isDbLoading}
                                    className="flex-1 py-4 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all hover:bg-indigo-100 disabled:opacity-50"
                                >
                                    <Zap size={20}/> Cargar Predeterminados
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {waTemplatesList.map(t => (
                                    <div key={t.id} className={`bg-white p-4 rounded-2xl border transition-all ${t.is_active ? 'border-indigo-100' : 'opacity-50'}`}>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-[8px] font-black uppercase bg-indigo-50 text-indigo-600 px-2 rounded-full">{t.category}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setEditingTemplate(t); setIsTemplateModalOpen(true); }} className="text-slate-400 hover:text-indigo-600"><Code size={14}/></button>
                                                <button onClick={() => dbDeleteWaTemplate(t.id).then(loadWaTemplates)} className="text-slate-400 hover:text-red-500"><Trash size={14}/></button>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-600 leading-relaxed italic truncate">"{t.content}"</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isImgModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
                        {/* Header styled with the branch color, replacing the black slate-900 */}
                        <div 
                            className="p-6 text-white flex justify-between items-center transition-colors"
                            style={{ backgroundColor: primaryColor }}
                        >
                            <h3 className="font-bold text-base uppercase tracking-wider">Banner promocional</h3>
                            <button 
                                onClick={() => {
                                    setIsImgModalOpen(false);
                                    setIsUploadingLocal(false);
                                    setUploadSucceeded(false);
                                    setLocalUploadProgress(0);
                                }}
                                className="text-white/80 hover:text-white transition-opacity"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-10 flex flex-col items-center gap-6">
                            {/* Upload Area */}
                            <div className="w-64 aspect-video bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden flex flex-col items-center justify-center relative">
                                {isUploadingLocal ? (
                                    <div className="flex flex-col items-center gap-3 p-4 text-center w-full h-full justify-center bg-slate-50/50">
                                        {uploadSucceeded ? (
                                            <div className="p-3 bg-emerald-50 rounded-full text-emerald-500 animate-bounce">
                                                <CheckCheck size={28} />
                                            </div>
                                        ) : (
                                            <Loader2 className="animate-spin text-indigo-500" size={28} style={{ color: primaryColor }} />
                                        )}
                                        <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">
                                            {uploadSucceeded ? "¡Cargado con éxito!" : "Subiendo Imagen..."}
                                        </span>
                                    </div>
                                ) : globalImage ? (
                                    <>
                                        <img src={globalImage} className="w-full h-full object-cover" />
                                        <button 
                                            onClick={() => setGlobalImage('')} 
                                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors shadow"
                                        >
                                            <X size={12}/>
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                        <ImageIcon size={36} className="text-slate-300" />
                                        <span className="text-[9px] uppercase font-black tracking-widest text-slate-400">Sin Imagen</span>
                                    </div>
                                )}
                            </div>

                            {/* Local loading progress bar */}
                            {isUploadingLocal && (
                                <div className="w-full space-y-2">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        <span>Progreso</span>
                                        <span className="tabular-nums" style={{ color: primaryColor }}>{localUploadProgress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full rounded-full transition-all duration-300 ease-out"
                                            style={{ 
                                                width: `${localUploadProgress}%`,
                                                backgroundColor: primaryColor
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Buttons */}
                            {uploadSucceeded ? (
                                <button 
                                    onClick={() => {
                                        setIsImgModalOpen(false);
                                        setIsUploadingLocal(false);
                                        setUploadSucceeded(false);
                                        setLocalUploadProgress(0);
                                    }}
                                    className="w-full text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 hover:opacity-90 leading-none"
                                    style={{ 
                                        backgroundColor: primaryColor,
                                        boxShadow: `0 10px 20px -5px ${primaryColor}40`
                                    }}
                                >
                                    <CheckCircle2 size={16} /> ¡Aceptar y Cerrar!
                                </button>
                            ) : (
                                <button 
                                    disabled={isUploadingLocal}
                                    onClick={() => fileInputRef.current?.click()} 
                                    className={`w-full text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                        isUploadingLocal ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
                                    }`}
                                    style={{ 
                                        backgroundColor: primaryColor,
                                        boxShadow: isUploadingLocal ? undefined : `0 10px 20px -5px ${primaryColor}40`
                                    }}
                                >
                                    {isUploadingLocal ? (
                                        <>Cargando...</>
                                    ) : (
                                        <>Subir Banner Promocional</>
                                    )}
                                </button>
                            )}

                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleLocalImageUpload} 
                            />
                        </div>
                    </div>
                </div>
            )}

            {isTemplateModalOpen && editingTemplate && (
                <div className="fixed inset-0 bg-black/90 z-[120] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 overflow-hidden">
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center"><h3 className="font-bold text-lg uppercase tracking-tight">Configurar Mensaje</h3><button onClick={() => setIsTemplateModalOpen(false)}><X/></button></div>
                        <div className="p-8 space-y-6">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Categoría</label>
                                <select value={editingTemplate.category} onChange={e => setEditingTemplate({...editingTemplate, category: e.target.value as WaTemplateCategory})} className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs">
                                    <option value="PROMOCION">PROMOCIÓN</option><option value="RECOJO">RECOJO</option><option value="CUMPLEANOS">CUMPLEAÑOS</option>
                                </select>
                            </div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Cuerpo del Mensaje</label>
                                <textarea value={editingTemplate.content} onChange={e => setEditingTemplate({...editingTemplate, content: e.target.value})} className="w-full p-4 border rounded-2xl h-40 text-sm font-medium resize-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Usa -nombre- para personalizar..."/>
                            </div>
                            <button onClick={handleSaveWaTemplate} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold uppercase text-xs shadow-xl">Guardar Mensaje</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL SUBIR EXCEL */}
            {isExcelModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <FileSpreadsheet className="text-[#25D366]" size={20} />
                                <h3 className="font-bold text-lg uppercase tracking-tight">Subir Archivo Excel</h3>
                            </div>
                            <button onClick={() => setIsExcelModalOpen(false)} className="text-white/60 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            {/* Plantilla de Ejemplo */}
                            <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-3xl space-y-3">
                                <div className="flex items-start gap-3">
                                    <Info className="text-slate-400 shrink-0 mt-0.5" size={16} />
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-700 leading-snug">Plantilla de ejemplo recomendada</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed mt-1">
                                            Para que el proceso funcione de manera exitosa, asegúrate de que tu archivo cuente con las siguientes columnas principales:
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4 pl-7 text-[10px] font-mono text-slate-600 font-bold">
                                    <span className="bg-slate-200/60 px-2 py-1 rounded border border-slate-300">Nombre</span>
                                    <span className="bg-slate-200/60 px-2 py-1 rounded border border-slate-300">Telefono</span>
                                </div>
                                <div className="pl-7 pt-1">
                                    <button 
                                        onClick={downloadExcelTemplate}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition-all hover:bg-slate-800 active:scale-95"
                                    >
                                        <Download size={12} /> Descargar Plantilla Excel
                                    </button>
                                </div>
                            </div>

                            {/* Zona de Arrastre y Selección */}
                            <div 
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDraggingExcel(true);
                                }}
                                onDragLeave={() => setIsDraggingExcel(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDraggingExcel(false);
                                    const file = e.dataTransfer.files?.[0];
                                    if (file) {
                                        processExcelFile(file);
                                    }
                                }}
                                className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer ${
                                    isDraggingExcel 
                                        ? 'border-indigo-600 bg-indigo-50/40 text-indigo-600 ring-2 ring-indigo-500/10' 
                                        : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-50/50 text-slate-400'
                                }`}
                                onClick={() => {
                                    const fileInput = document.getElementById('excel-file-uploader-scoped');
                                    fileInput?.click();
                                }}
                            >
                                <Upload size={32} className={`mb-3 transition-colors ${isDraggingExcel ? 'text-indigo-600' : 'text-slate-300'}`} />
                                <span className="font-bold text-sm text-slate-700">
                                    {isDraggingExcel ? '¡Suelta el archivo aquí!' : 'Arrastra tu archivo Excel aquí'}
                                </span>
                                <span className="text-xs text-slate-400 mt-1">
                                    o haz clic para explorar en tu equipo
                                </span>
                                <input 
                                    id="excel-file-uploader-scoped" 
                                    type="file" 
                                    className="hidden" 
                                    accept=".xlsx, .xls, .csv" 
                                    onChange={handleFileUpload} 
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button 
                                    onClick={() => setIsExcelModalOpen(false)}
                                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WaCampaign;

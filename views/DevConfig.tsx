import React, { useState, useEffect, useRef } from 'react';
import { 
    Terminal, Download, Upload, Users, Package, ShoppingBag, 
    CheckCircle2, AlertCircle, Loader2, ArrowRight,
    Database, ShieldAlert, Layers, Globe, Save, Hash, 
    LayoutTemplate, Server, Search, MessageCircle, FileCode,
    FileText, LayoutGrid, Link, Lock, Unlock, Info, Eye, X, Type, Maximize2, Check, Globe2, Zap, WashingMachine, Trash2, ImagePlus, ImageIcon, Plus, Smartphone,
    AlertTriangle,
    ArrowRightLeft,
    Pause,
    Play,
    RotateCcw,
    ChevronRight,
    FileCheck,
    FileSpreadsheet,
    Layout,
    Terminal as TerminalIcon,
    Cpu,
    Zap as ZapIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
    dbCreateClient, dbSaveProduct, dbCreateInvoice, dbGetProducts, dbGetClients,
    dbSaveCategory,
    dbSetCorrelative,
    dbGetCorrelativos,
    dbGetInvoices
} from '../services/dbService';
import { Client, Product, Invoice, InvoiceType, IgvType, UnitCode, OrderStatus, Category, Company, TenantConfig, SYSTEM_PERMISSIONS, PermissionDefinition, SaasGlobalConfig } from '../types';
import { calculateTotals } from '../utils/calculations';
import { getSaasGlobalConfig, updateSaasGlobalConfig } from '../services/saasService';
import SuccessModal from '../components/SuccessModal';

interface DevConfigProps {
    onRefreshData: () => void;
    company: Company;
    onSaveCompany: (c: Company) => Promise<void>;
    currentTenant?: TenantConfig | null;
    onUpdateTenantModules?: (modules: Record<string, boolean>) => void;
}

const DevConfig: React.FC<DevConfigProps> = ({ onRefreshData, company, onSaveCompany, currentTenant, onUpdateTenantModules }) => {
    const [activeTab, setActiveTab] = useState<'IMPORT' | 'SERIES' | 'MODULES' | 'APIS'>('SERIES');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(false);

    const [log, setLog] = useState<string[]>([]);
    const [stats, setStats] = useState({ success: 0, failed: 0 });
    const [localCompany, setLocalCompany] = useState<Company>(company);
    const primaryColor = (localCompany as any).primaryColor || '#4f46e5';
    const [localModules, setLocalModules] = useState<Record<string, boolean>>({});
    
    const [manualNumbers, setManualNumbers] = useState<Record<string, number>>({});
    const [unlockedFields, setUnlockedFields] = useState<Record<string, boolean>>({});
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const [globalConfig, setGlobalConfig] = useState<SaasGlobalConfig | null>(null);

    useEffect(() => {
        setLocalCompany(company);
        if (activeTab === 'SERIES') {
            loadDispensadorData();
        }
    }, [company, activeTab]); 

    useEffect(() => {
        if (activeTab === 'MODULES' && currentTenant?.modules) {
            setLocalModules(currentTenant.modules);
            loadGlobalConfig();
        }
        if (activeTab === 'APIS') {
            loadGlobalConfig();
        }
    }, [activeTab, currentTenant]);

    const loadGlobalConfig = async () => {
        const cfg = await getSaasGlobalConfig();
        setGlobalConfig(cfg);
    };

    const loadDispensadorData = async () => {
        try {
            const data = await dbGetCorrelativos();
            const map: Record<string, number> = {};
            data.forEach(item => {
                const key = `${item.tipo_documento}_${item.serie || ''}`;
                map[key] = item.ultimo_numero;
            });
            setManualNumbers(map);
            addLog("Correlativos del dispensador cargados correctamente.");
        } catch (e) {
            console.error("Error cargando dispensador", e);
        }
    };

    const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));

    const handleSaveConfig = async () => {
        setIsProcessing(true);
        try {
            await onSaveCompany(localCompany);
            addLog("Credenciales guardadas con éxito.");
            setShowSuccessModal(true);
            setUnlockedFields({}); 
            onRefreshData();
        } catch (e) {
            addLog("Error al guardar credenciales.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateManualNumber = (tipo: string, serie: string, val: string) => {
        const numVal = parseInt(val);
        setManualNumbers(prev => ({
            ...prev,
            [`${tipo}_${serie}`]: isNaN(numVal) ? 0 : numVal
        }));
    };

    const toggleFieldLock = (key: string) => {
        setUnlockedFields(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleSaveSeries = async () => {
        setIsProcessing(true);
        try {
            // 1. Guardar cambios en las series configuradas en la sucursal (Branding/Config)
            await onSaveCompany(localCompany);
            
            const syncDoc = async (tipo: string, serie: string) => {
                const key = `${tipo}_${serie}`;
                const val = manualNumbers[key] ?? 0;
                await dbSetCorrelative(tipo, serie, val);
            };

            // 2. Sincronizar todos los contadores físicos basados en el estado manual
            await syncDoc(InvoiceType.FACTURA, localCompany.serieFactura);
            await syncDoc(InvoiceType.BOLETA, localCompany.serieBoleta);
            await syncDoc(InvoiceType.NOTA_VENTA, localCompany.serieNotaVenta);
            await syncDoc(InvoiceType.NOTA_CREDITO, localCompany.serieNcFactura || 'FC01');
            await syncDoc(InvoiceType.NOTA_CREDITO, localCompany.serieNcBoleta || 'BC01');
            
            // Sincronizar el contador atómico de orden interna (Clave: ORDEN_INTERNA_)
            await syncDoc('ORDEN_INTERNA', ''); 

            onRefreshData();
            await loadDispensadorData();
            
            setShowSuccessModal(true);
            setUnlockedFields({}); 
            addLog("Sincronización atómica completada.");
        } catch (e) {
            console.error(e);
            alert("Error al sincronizar correlativos.");
        } finally {
            setIsProcessing(false);
        }
    };

    const getOrderPreview = () => {
        const atomicVal = manualNumbers['ORDEN_INTERNA_'] ?? localCompany.orderCurrentNumber ?? 1;
        const totalZeros = localCompany.orderZerosCount || 5;
        const numStr = String(atomicVal).padStart(totalZeros, '0');
        
        if (!localCompany.useOrderSuffix) return numStr;
        
        const suffix = localCompany.orderCurrentSuffix || 'A';
        return (localCompany.orderSuffixPosition === 'BEFORE') 
            ? `${suffix}-${numStr}` 
            : `${numStr}-${suffix}`;
    };

    const downloadTemplate = (type: 'CLIENTS' | 'PRODUCTS' | 'SALES' | 'CATEGORIES') => {
        let headers: string[] = [];
        let exampleData: any[][] = [];
        let name = "";

        if (type === 'CLIENTS') {
            headers = ['docType', 'docNumber', 'name', 'address', 'phone', 'email', 'birthday', 'gender', 'points'];
            exampleData = [['DNI', '44556677', 'JUAN PEREZ', 'AV LIMA 123', '999888777', 'juan@email.com', '1995-01-01', 'Masculino', '0']];
            name = "SISLAV_PLANTILLA_CLIENTES.xlsx";
        } else if (type === 'PRODUCTS') {
            headers = ['name', 'category', 'price', 'stock', 'description', 'igvType', 'unitCode', 'trackStock', 'processingTime'];
            exampleData = [['LAVADO POR KILO', 'LAVANDERIA', '6.50', '0', 'Servicio básico', '10', 'KGM', 'false', '24 horas']];
            name = "SISLAV_PLANTILLA_SERVICIOS.xlsx";
        } else if (type === 'CATEGORIES') {
            headers = ['name', 'description', 'isActive', 'imageUrl'];
            exampleData = [['LAVANDERIA', 'Lavado general', 'true', '']];
            name = "SISLAV_PLANTILLA_CATEGORIAS.xlsx";
        }

        const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "SISLAV_DATA");
        XLSX.writeFile(wb, name);
    };

    const getVal = (row: any, keys: string[]) => {
        for (const k of keys) {
            const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
            if (foundKey) {
                const val = row[foundKey];
                return val === undefined || val === null ? undefined : String(val).trim();
            }
        }
        return undefined;
    };

    const togglePause = () => {
        isPausedRef.current = !isPausedRef.current;
        setIsPaused(isPausedRef.current);
        addLog(isPausedRef.current ? "Proceso pausado." : "Proceso reanudado.");
    };

    const handleUpload = async (type: 'CLIENTS' | 'PRODUCTS' | 'SALES' | 'CATEGORIES', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setIsPaused(false);
        isPausedRef.current = false;
        setLog([]);
        setStats({ success: 0, failed: 0 });
        addLog(`Iniciando importación de ${type}...`);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];

                let sCount = 0;
                let fCount = 0;

                for (const row of data) {
                    while (isPausedRef.current) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }

                    try {
                        if (type === 'CLIENTS') {
                            const name = String(getVal(row, ['name', 'nombre']) || '');
                            if (!name || name === '-') continue;

                            let docNum = String(getVal(row, ['docNumber', 'num_doc']) || '');
                            let docType = String(getVal(row, ['docType', 'tipo_doc']) || '-');

                            if (!docNum || docNum === '-' || docNum === '0') {
                                docNum = `MIGR-${Date.now()}-${sCount}`;
                                docType = '-';
                            }

                            await dbCreateClient({
                                id: 'temp-' + Date.now() + '-' + sCount,
                                sucursal_id: company.sucursal_id,
                                docType: docType === 'SIN DOC' ? '-' : docType,
                                docNumber: docNum,
                                name: name.toUpperCase(),
                                address: String(getVal(row, ['address', 'direccion']) || '-').toUpperCase(),
                                phone: String(getVal(row, ['phone', 'telefono']) || ''),
                                email: String(getVal(row, ['email', 'correo']) || ''),
                                birthday: String(getVal(row, ['birthday', 'cumpleanos']) || ''),
                                gender: (getVal(row, ['gender', 'genero']) || 'Otro') as any,
                                points: parseInt(getVal(row, ['points', 'puntos']) || '0')
                            });
                        } else if (type === 'PRODUCTS') {
                            const name = String(getVal(row, ['name', 'nombre']) || '');
                            if (!name || name === '-') continue;

                            await dbSaveProduct({
                                name: name.toUpperCase(),
                                category: String(getVal(row, ['category', 'categoria']) || 'GENERAL').toUpperCase(),
                                price: parseFloat(getVal(row, ['price', 'precio']) || '0'),
                                cost: 0,
                                stock: parseInt(getVal(row, ['stock']) || '0'),
                                trackStock: String(getVal(row, ['trackStock'])).toLowerCase() === 'true',
                                igvType: String(getVal(row, ['igvType']) || '10') as any,
                                unitCode: String(getVal(row, ['unitCode']) || 'ZZ') as any,
                                processingTime: String(getVal(row, ['processingTime']) || ''),
                                sucursal_id: company.sucursal_id,
                                estado: 'a',
                                activo: true
                            });
                        } else if (type === 'CATEGORIES') {
                            const name = String(getVal(row, ['name', 'nombre']) || '');
                            if (!name || name === '-') continue;

                            await dbSaveCategory({
                                sucursal_id: company.sucursal_id,
                                name: name.toUpperCase(),
                                isActive: String(getVal(row, ['isActive'])).toLowerCase() !== 'false',
                                imageUrl: String(getVal(row, ['imageUrl']) || '')
                            });
                        }
                        sCount++;
                        setStats(prev => ({ ...prev, success: sCount }));
                    } catch (err: any) {
                        fCount++;
                        setStats(prev => ({ ...prev, failed: fCount }));
                        addLog(`Falla: ${row.name || 's/n'} -> ${err.message || 'Error DB'}`);
                    }
                }
                addLog(`Fin. Éxitos: ${sCount}, Errores: ${fCount}`);
                onRefreshData();
            } catch (err) {
                addLog("Error al procesar Excel.");
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="p-4 lg:p-8 h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-hidden space-y-6">
                
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-4 shrink-0 transition-all duration-500" style={{ borderBottomColor: primaryColor }}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl text-white shadow-xl transition-transform duration-300" style={{ backgroundColor: primaryColor }}>
                            <TerminalIcon size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">Panel de Programador</h2>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 opacity-50 mt-1">
                                <Server size={12} /> SISLAV CORE V1.52 • <Database size={12} /> ID: {company.sucursal_id}
                            </p>
                        </div>
                    </div>

                    <div className="flex bg-slate-100 dark:bg-black/40 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 backdrop-blur-sm">
                        {[
                            { id: 'IMPORT', label: 'Migración', icon: ArrowRightLeft },
                            { id: 'SERIES', label: 'Series', icon: Hash },
                            { id: 'MODULES', label: 'Módulos', icon: LayoutGrid },
                            { id: 'APIS', label: 'API Keys', icon: Link }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                style={activeTab === tab.id ? { backgroundColor: primaryColor } : {}}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === tab.id ? 'text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-white dark:hover:bg-slate-800'}`}
                            >
                                <tab.icon size={14} />
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-1 gap-6 pb-6">
                    <div className="lg:col-span-1 flex flex-col gap-6 overflow-hidden">
                        {activeTab === 'IMPORT' && (
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col flex-1 overflow-hidden animate-in fade-in">
                                <div className="p-6 border-b border-slate-50 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-black/20">
                                    <h3 className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <Database size={16} style={{ color: primaryColor }} /> Importación Masiva
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold text-emerald-500 uppercase">{stats.success} OK</p>
                                            <p className="text-[9px] font-bold text-rose-500 uppercase">{stats.failed} ERR</p>
                                        </div>
                                        {isProcessing && <Loader2 className="animate-spin" size={14} style={{ color: primaryColor }} />}
                                    </div>
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { type: 'CLIENTS', label: 'Clientes', icon: Users, color: 'indigo' },
                                            { type: 'PRODUCTS', label: 'Servicios', icon: Package, color: 'blue' },
                                            { type: 'CATEGORIES', label: 'Categorías', icon: Layers, color: 'sky' }
                                        ].map((item) => (
                                            <div key={item.type} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-white/5 group hover:border-slate-300 transition-all">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className={`p-3 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-white/5 group-hover:scale-105 transition-transform`} style={{ color: primaryColor }}>
                                                        <item.icon size={20} />
                                                    </div>
                                                    <button onClick={() => downloadTemplate(item.type as any)} className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Download size={10} /> Plantilla</button>
                                                </div>
                                                <div className="space-y-3">
                                                    <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase leading-none">{item.label}</h4>
                                                    <input type="file" accept=".xlsx, .xls" onChange={(e) => handleUpload(item.type as any, e)} className="block w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-bold file:uppercase file:bg-slate-100 file:text-slate-700 cursor-pointer disabled:opacity-50" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'SERIES' && (
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col flex-1 overflow-hidden animate-in zoom-in-95">
                                <div className="p-6 border-b border-slate-50 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-black/20">
                                    <div className="space-y-1">
                                        <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <Zap size={18} style={{ color: primaryColor }} fill={primaryColor} fillOpacity={0.2} /> Configuración de Correlativos
                                        </h3>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest pl-7">Control maestro de documentos y ordenamiento interno</p>
                                    </div>
                                    <button 
                                        onClick={handleSaveSeries} 
                                        disabled={isProcessing}
                                        style={{ backgroundColor: primaryColor }}
                                        className="text-white px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} 
                                        {isProcessing ? 'Guardando...' : 'Sincronizar Cambios'}
                                    </button>
                                </div>

                                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        
                                        {/* Column 1: Series Fiscales (SUNAT) */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 px-2">
                                                <Database size={14} className="text-indigo-600" />
                                                <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Series Fiscales</h4>
                                            </div>

                                            <div className="space-y-3">
                                                {[
                                                    { id: 'serieBoleta', label: 'Boleta de Venta', val: localCompany.serieBoleta, code: InvoiceType.BOLETA, hint: 'B001', icon: <FileText size={12} className="text-blue-500" /> },
                                                    { id: 'serieFactura', label: 'Factura Electrónica', val: localCompany.serieFactura, code: InvoiceType.FACTURA, hint: 'F001', icon: <FileCheck size={12} className="text-emerald-500" /> },
                                                    { id: 'serieNotaVenta', label: 'Notas de Venta', val: localCompany.serieNotaVenta, code: InvoiceType.NOTA_VENTA, hint: 'NV01', icon: <FileSpreadsheet size={12} className="text-amber-500" /> }
                                                ].map(s => (
                                                    <div key={s.id} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-white/5 hover:border-indigo-200 transition-all group">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                {s.icon}
                                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{s.label}</span>
                                                            </div>
                                                            <div className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded-md border border-slate-100 dark:border-white/10 text-[8px] font-black text-slate-400">
                                                                {s.hint}
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-5 gap-2">
                                                            <input 
                                                                value={s.val || ''} 
                                                                onChange={e => setLocalCompany({...localCompany, [s.id]: e.target.value.toUpperCase().slice(0, 4)})}
                                                                className="col-span-2 p-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 border-[1.5px] rounded-xl font-black text-center text-sm uppercase outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all" 
                                                                style={{ color: primaryColor, borderColor: primaryColor }}
                                                                placeholder="SERIE"
                                                            />
                                                            <input 
                                                                type="number"
                                                                value={manualNumbers[`${s.code}_${s.val}`] ?? ''} 
                                                                onChange={e => handleUpdateManualNumber(s.code, s.val, e.target.value)} 
                                                                className="col-span-3 p-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 border-[1.5px] rounded-xl font-black text-center text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all" 
                                                                style={{ color: primaryColor, borderColor: primaryColor }}
                                                                placeholder="N° CORRELATIVO" 
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Column 2: Visor de Estilo e Impresión */}
                                        <div className="space-y-4 flex flex-col">
                                            <div className="flex items-center gap-2 px-2">
                                                <Terminal size={14} className="text-indigo-600" />
                                                <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Vista Previa</h4>
                                            </div>

                                            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 flex flex-col flex-1 items-center justify-center relative overflow-hidden shadow-lg border border-slate-100 dark:border-white/5 group">
                                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-300 dark:text-slate-600 mb-6">Sample Format</span>
                                                <div className="relative p-6 bg-slate-50 dark:bg-black/40 rounded-[2.5rem] border border-slate-100 dark:border-white/5 w-full text-center shadow-inner group-hover:scale-[1.02] transition-all">
                                                    <p className="text-4xl font-black tracking-tighter text-slate-800 dark:text-white mb-1 drop-shadow-sm" style={{ fontFamily: 'monospace' }}>
                                                        {getOrderPreview()}
                                                    </p>
                                                    <div className="h-1 w-16 mx-auto rounded-full mt-4" style={{ backgroundColor: primaryColor }} />
                                                </div>
                                                <div className="mt-6 w-full pt-4 border-t border-slate-50 dark:border-white/5">
                                                    <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/10">
                                                        <div className="flex items-center gap-3">
                                                            <Type size={16} style={{ color: primaryColor }} />
                                                            <p className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-wider">Serie Alfanumérica</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => setLocalCompany({...localCompany, useOrderSuffix: !localCompany.useOrderSuffix})}
                                                            className={`relative w-10 h-5 rounded-full transition-all duration-500 shadow-inner ${localCompany.useOrderSuffix ? '' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                            style={localCompany.useOrderSuffix ? { backgroundColor: primaryColor } : {}}
                                                        >
                                                            <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-lg transform transition-transform duration-500 ${localCompany.useOrderSuffix ? 'translate-x-5.5' : 'translate-x-1'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column 3: Configuración Avanzada */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 px-2">
                                                <Layout size={14} className="text-indigo-600" />
                                                <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Parámetros</h4>
                                            </div>

                                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-5 border border-slate-100 dark:border-white/5 space-y-5">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-center">Padding Ceros</label>
                                                        <input 
                                                            type="number" 
                                                            min={3}
                                                            max={10}
                                                            value={localCompany.orderZerosCount || 5} 
                                                            onChange={e => {
                                                                const val = parseInt(e.target.value);
                                                                setLocalCompany({...localCompany, orderZerosCount: val, order_zeros_count: val});
                                                            }} 
                                                            className="w-full bg-white dark:bg-slate-800 border-[1.5px] border-slate-100 dark:border-white/10 rounded-xl p-2 font-black text-center text-xl outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-sm"
                                                            style={{ color: primaryColor, borderColor: primaryColor }}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block text-center">Letra Activa</label>
                                                        <input 
                                                            value={localCompany.orderCurrentSuffix || 'A'} 
                                                            onChange={e => {
                                                                const val = e.target.value.toUpperCase().slice(0, 1);
                                                                setLocalCompany({...localCompany, orderCurrentSuffix: val, prefijo_sufijo: val, order_current_suffix: val});
                                                            }} 
                                                            className="w-full bg-white dark:bg-slate-800 border-[1.5px] border-slate-100 dark:border-white/10 rounded-xl p-2 font-black text-center text-xl uppercase outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-sm" 
                                                            maxLength={1}
                                                            style={{ color: primaryColor, borderColor: primaryColor }}
                                                        />
                                                    </div>
                                                </div>

                                                {localCompany.useOrderSuffix && (
                                                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/5">
                                                        <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-100 dark:border-white/10">
                                                            <button 
                                                                onClick={() => setLocalCompany({...localCompany, orderSuffixPosition: 'BEFORE'})}
                                                                className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${localCompany.orderSuffixPosition === 'BEFORE' ? 'text-white' : 'text-slate-400 hover:bg-slate-50'}`}
                                                                style={localCompany.orderSuffixPosition === 'BEFORE' ? { backgroundColor: primaryColor } : {}}
                                                            >
                                                                Delante
                                                            </button>
                                                            <button 
                                                                onClick={() => setLocalCompany({...localCompany, orderSuffixPosition: 'AFTER'})}
                                                                className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase transition-all ${localCompany.orderSuffixPosition === 'AFTER' ? 'text-white' : 'text-slate-400 hover:bg-slate-50'}`}
                                                                style={localCompany.orderSuffixPosition === 'AFTER' ? { backgroundColor: primaryColor } : {}}
                                                            >
                                                                Detrás
                                                            </button>
                                                        </div>

                                                        <div className="p-4 bg-amber-50 dark:bg-amber-500/5 rounded-2xl border border-amber-100 dark:border-amber-500/10 relative overflow-hidden">
                                                            <div className="flex items-center justify-between">
                                                                <div className="space-y-0.5">
                                                                    <p className="text-[9px] font-black text-amber-800 dark:text-amber-400 uppercase">REINICIO AUTO</p>
                                                                    <p className="text-[8px] text-amber-600 font-bold uppercase opacity-60">Límite: {localCompany.limite_reconteo || 10000}</p>
                                                                </div>
                                                                <button 
                                                                    onClick={() => setLocalCompany({...localCompany, use_order_reset: !localCompany.use_order_reset})}
                                                                    className={`w-9 h-5 rounded-full transition-all relative ${localCompany.use_order_reset ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                                >
                                                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${localCompany.use_order_reset ? 'left-4.5' : 'left-0.5'}`} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <button 
                                                    onClick={() => {
                                                        if(confirm('¿ESTÁS ABSOLUTAMENTE SEGURO?')) {
                                                            setLocalCompany({...localCompany, orderCurrentNumber: 0});
                                                            setLog(prev => [`[${new Date().toLocaleTimeString()}] SISTEMA: Reset manual ejecutado.`, ...prev]);
                                                        }
                                                    }}
                                                    className="w-full py-2 bg-red-50 hover:bg-red-500 text-red-600 hover:text-white border border-red-100 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                                                >
                                                    RESETEAR CONTADORES
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab === 'MODULES' && (
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col flex-1 overflow-hidden animate-in duration-500">
                                <div className="p-6 border-b border-slate-50 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-black/20">
                                    <h3 className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <LayoutGrid size={16} style={{ color: primaryColor }} /> Permisos por Sucursal
                                    </h3>
                                    {onUpdateTenantModules && (
                                        <button onClick={() => onUpdateTenantModules(localModules)} className="text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2" style={{ backgroundColor: primaryColor }}><Save size={14} /> Guardar</button>
                                    )}
                                </div>
                                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {SYSTEM_PERMISSIONS.filter(p => p.id.startsWith('view:')).map(perm => (
                                            <div key={perm.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 group hover:border-slate-200 transition-all">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <p className="font-black text-[9px] text-slate-800 dark:text-slate-200 uppercase truncate">{perm.label}</p>
                                                    <p className="text-[7px] font-bold text-slate-400 uppercase truncate">{perm.description}</p>
                                                </div>
                                                <button 
                                                    onClick={() => setLocalModules(prev => ({ ...prev, [perm.id]: !prev[perm.id] }))} 
                                                    className={`relative w-9 h-5 rounded-full transition-all duration-300 flex items-center ${localModules[perm.id] !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                                    style={localModules[perm.id] !== false ? { backgroundColor: primaryColor } : {}}
                                                >
                                                    <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${localModules[perm.id] !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                         {activeTab === 'APIS' && (
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col flex-1 animate-in zoom-in-95">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Link style={{ color: primaryColor }} size={20} /> Conexiones API
                                </h3>
                                <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2"><Globe2 size={12} className="text-blue-500" /> SUNAT</h4>
                                            <div className="space-y-2">
                                                <div><label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">URL Endpoint</label><div className="flex gap-1"><input disabled={!unlockedFields['api_sunat_url']} value={localCompany.sunat_url || ''} onChange={e => setLocalCompany({...localCompany, sunat_url: e.target.value})} className="flex-1 p-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 border rounded-lg text-[9px] font-mono outline-none" style={{ borderColor: primaryColor }} /><button onClick={() => toggleFieldLock('api_sunat_url')} style={unlockedFields['api_sunat_url'] ? { backgroundColor: primaryColor } : {}} className={`p-2 rounded-lg transition-all ${unlockedFields['api_sunat_url'] ? 'text-white' : 'bg-slate-200 text-slate-500'}`}>{unlockedFields['api_sunat_url'] ? <Unlock size={12}/> : <Lock size={12}/>}</button></div></div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">SOL User</label><input disabled={!unlockedFields['solUser']} value={localCompany.solUser || ''} onChange={e => setLocalCompany({...localCompany, solUser: e.target.value})} className="w-full p-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 border rounded-lg text-[9px] font-black outline-none" style={{ borderColor: primaryColor }} /></div>
                                                    <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">SOL Pass</label><input type="password" disabled={!unlockedFields['solPass']} value={localCompany.solPass || ''} onChange={e => setLocalCompany({...localCompany, solPass: e.target.value})} className="w-full p-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 border rounded-lg text-[9px] font-black outline-none" style={{ borderColor: primaryColor }} /></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2"><Smartphone size={12} className="text-emerald-500" /> WhatsApp</h4>
                                            <div className="space-y-2">
                                                <div><label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Base URL</label><input disabled={!unlockedFields['api_wa_url']} value={localCompany.whatsapp_instance || ''} onChange={e => setLocalCompany({...localCompany, whatsapp_instance: e.target.value})} className="w-full p-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 border rounded-lg text-[9px] font-mono outline-none" style={{ borderColor: primaryColor }} /></div>
                                                <div><label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Instancia</label><input disabled={!unlockedFields['api_wa_name']} value={localCompany.whatsapp_instance_name || ''} onChange={e => setLocalCompany({...localCompany, whatsapp_instance_name: e.target.value})} className="w-full p-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 border rounded-lg text-[9px] font-black outline-none" style={{ borderColor: primaryColor }} /></div>
                                                <div><label className="block text-[8px] font-black text-slate-400 uppercase mb-1">API Key</label><input disabled={!unlockedFields['api_wa_token']} value={localCompany.whatsapp_token || ''} onChange={e => setLocalCompany({...localCompany, whatsapp_token: e.target.value})} className="w-full p-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 border rounded-lg text-[9px] font-mono outline-none" style={{ borderColor: primaryColor }} type="password" /></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <button 
                                            onClick={handleSaveConfig} 
                                            className="w-full py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                                            style={{ backgroundColor: primaryColor }}
                                        >
                                            <Save size={14} /> GUARDAR CREDENCIALES
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }`}</style>
            <SuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} message="Sincronización de correlativos y configuración procesada con éxito." title="SISTEMA ACTUALIZADO" />
        </div>
    );
};

export default DevConfig;
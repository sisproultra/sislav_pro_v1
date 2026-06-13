
import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { 
    AuthSession, UserRole, Sucursal, Product, Client, Invoice, Category, 
    CartItem, InvoiceType, OrderStatus, SaasGlobalConfig, Machine, Expense, 
    Supply, Purchase, PaymentMethodConfig, PausedSale, Employee, 
    CampaignStatus, Contact, CampaignTemplate, PickupRequest, SunatResponse,
    SaasCompany, SaasBranch, UmSaas, SYSTEM_MODULES
} from './types';
import {
    dbGetSucursalBySlug, dbGlobalLogin, setDbBranchContext, getActiveBranchId, getActiveHoldingId, withTimeout, invalidateCache,
    dbGetProducts, dbGetClients, dbGetInvoices, dbGetOrderStats, dbGetExpenses, dbGetSupplies,
    dbGetPaymentMethods, dbSaveCategory, dbUpdateCategory,
    dbSavePaymentMethod, dbUpdatePaymentMethod,
    dbSaveProduct, dbUpdateProduct, dbDeleteProduct, dbUpdateSucursalConfig,
    dbGetPurchases, dbSavePurchase, dbSaveSupply, dbSaveExpense,
    dbUpdateSucursalBranding, dbGetSucursalById, dbGetPausedSales, dbSavePausedSale, dbDeletePausedSale,
    dbSaveMachine, dbUpdateMachine, dbSyncMachines,
    dbUpdateItemStatus,
    dbGetEmployees,
    dbSaveEmployee,
    dbUpdateEmployee,
    dbDeleteEmployee,
    dbHardDeleteEmployee,
    dbReactivateEmployee,
    dbGetCorrelativos,
    dbAddPayment,
    dbUpdateInvoiceDiscount,
    dbAddPointsToClient,
    dbGetWaCampaignConfig,
    dbUpdatePickupRequestStatus,
    dbUpdateSunatResponse,
    dbCreateCashClosing,
    dbGetCategories,
    dbGetTicketConfig,
    dbGetMachines,
    dbGetActiveItems,
    normalizeSucursal,
    dbUpdateInvoice,
    dbCreateInvoice,
    dbCreateClient,
    dbUpdateInvoiceStatus,
    dbConvertInvoice,
    dbDeleteClient,
    dbDeleteExpense,
    dbDeleteSupply,
    dbGetActiveCashClosing,
    dbOpenCashClosing,
    dbGetBirthdaysToday,
    dbSyncOwnerProfile,
    dbGetHoldingBranding,
    dbCheckAndRegisterBotCheckIn
} from './services/dbService';
import { getSaasGlobalConfig } from './services/saasService';
import { sendBillToSunat, sendSummaryToSunat } from './services/sunatService';
import { calculateTotals, formatOrderNumber, roundToOneDecimal, getPeruDateTime } from './utils/calculations';
import { EvolutionService } from './services/evolutionService';
import { printInvoiceDirectly } from './utils/printService';
import SaaSLogin from './views/SaaSLogin';
import { applyDynamicManifest } from './utils/pwaUtils';
import { VersionGuard } from './components/VersionGuard';
import OwnerLogin from './views/OwnerLogin';
import InvoiceReceipt from './components/InvoiceReceipt';
import Layout from './components/Layout';
import TenantSelector from './components/TenantSelector';
import MasterLogin from './views/MasterLogin';
import LogisticsLogin from './views/LogisticsLogin';

// Lazy loaded views for instant loading and code splitting
const OwnerDashboard = lazy(() => import('./views/OwnerDashboard'));
const PointOfSale = lazy(() => import('./views/PointOfSale'));
const MyOrders = lazy(() => import('./views/MyOrders'));
const Dashboard = lazy(() => import('./views/Dashboard'));
const Agenda = lazy(() => import('./views/Agenda'));
const Tracking = lazy(() => import('./views/Tracking'));
const Inventory = lazy(() => import('./views/Inventory'));
const Clients = lazy(() => import('./views/Clients'));
const Employees = lazy(() => import('./views/Employees'));
const Accounting = lazy(() => import('./views/Accounting'));
const Expenses = lazy(() => import('./views/Expenses'));
const Machines = lazy(() => import('./views/Machines'));
const CallCenter = lazy(() => import('./views/CallCenter'));
const Delivery = lazy(() => import('./views/Delivery'));
const Supplies = lazy(() => import('./views/Supplies'));
const Purchases = lazy(() => import('./views/Purchases'));
const Loyalty = lazy(() => import('./views/Loyalty'));
const BonusPoints = lazy(() => import('./views/BonusPoints'));
const Promotions = lazy(() => import('./views/Promotions'));
const Categories = lazy(() => import('./views/Categories'));
const PaymentMethods = lazy(() => import('./views/PaymentMethods'));
const Reports = lazy(() => import('./views/Reports'));
const Settings = lazy(() => import('./views/Settings'));
const SalesHistory = lazy(() => import('./views/SalesHistory'));
const MyReports = lazy(() => import('./views/MyReports'));
const YapeMonitor = lazy(() => import('./views/YapeMonitor'));
const DevConfig = lazy(() => import('./views/DevConfig'));
const WaReminders = lazy(() => import('./views/WaReminders'));
const SuperAdmin = lazy(() => import('./views/SuperAdmin').then(m => ({ default: m.SuperAdmin })));
const Operations = lazy(() => import('./views/Operations'));
const WaCampaign = lazy(() => import('./views/WaCampaign'));
const PackageInventory = lazy(() => import('./views/PackageInventory'));
const LogisticsHub = lazy(() => import('./views/LogisticsHub'));
const LogisticsDriverPOS = lazy(() => import('./views/LogisticsDriverPOS'));
const CashClosingView = lazy(() => import('./views/CashClosing'));
const ProductCounting = lazy(() => import('./views/ProductCounting'));
const Modificaciones = lazy(() => import('./views/Modificaciones'));
const Memberships = lazy(() => import('./views/Memberships'));

import { ModuleLoadingSkeleton } from './components/ModuleLoadingSkeleton';

import { Loader2, X, ShieldAlert, CheckCircle2, AlertTriangle, Clock, Play, Sparkles, Lock, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from './services/supabaseClient';
import { DebugOverlay } from './components/DebugOverlay';
import InventoryModal from './components/InventoryModal';
import ClientModal from './components/ClientModal';
import PurchaseModal from './components/PurchaseModal';
import SupplyModal from './components/SupplyModal';
import FastOrderTaker from './components/FastOrderTaker';

import CashOpeningModal from './components/CashOpeningModal';

const RefreshCw = ({ size, className }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
    </svg>
);

const PromoVideoView: React.FC<{ promoVideo: any, modId: string, activeSucursal: any }> = ({ promoVideo, modId, activeSucursal }) => {
    const [iframeLoaded, setIframeLoaded] = useState(false);
    
    // Reset iframe loading state when media source URL changes to avoid flashing old context
    useEffect(() => {
        setIframeLoaded(false);
    }, [promoVideo?.youtubeUrl]);

    const activeColor = activeSucursal?.color_primario || '#0054A6';
    const labelName = SYSTEM_MODULES.find(m => m.id === modId)?.label || 'Video Informativo';

    let ytId = '';
    const url = promoVideo?.youtubeUrl;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url ? url.match(regExp) : null;
    if (match && match[2].length === 11) {
        ytId = match[2];
    }

    const embedUrl = ytId 
        ? `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1&enablejsapi=1&rel=0&controls=1`
        : '';

    return (
        <div className="flex flex-col items-center justify-center min-h-[82vh] bg-gradient-to-tr from-slate-50 via-indigo-50/15 to-slate-100 p-4 md:p-8 font-sans relative overflow-hidden w-full">
            {/* Visual ambient glows matching branch identity */}
            <div 
                className="absolute top-1/4 left-1/4 w-[280px] h-[280px] rounded-full blur-[90px] pointer-events-none opacity-20" 
                style={{ backgroundColor: activeColor }}
            />
            <div 
                className="absolute bottom-1/4 right-1/4 w-[200px] h-[200px] rounded-full blur-[70px] pointer-events-none opacity-10" 
                style={{ backgroundColor: activeColor }}
            />
            
            <div className="relative z-10 w-full max-w-3xl bg-white border border-slate-200/70 p-6 md:p-8 rounded-[2rem] shadow-lg text-center space-y-5 animate-in fade-in zoom-in-95 duration-500">
                <div className="space-y-2">
                    <div 
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] font-extrabold uppercase tracking-[0.2em] shadow-sm bg-white"
                        style={{ borderColor: `${activeColor}40`, color: activeColor }}
                    >
                        <Sparkles size={11} className="animate-pulse" /> CONTENIDO EXCLUSIVO
                    </div>
                    <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-800 leading-tight">
                        Módulo {labelName}
                    </h1>
                    <p className="text-slate-500 text-xs md:text-sm font-semibold uppercase tracking-wide max-w-lg mx-auto leading-relaxed">
                        {promoVideo ? (promoVideo.title || "Descubre cómo funciona esta potente herramienta diseñada para impulsar el crecimiento de tu sucursal.") : "Cargando video de ayuda..."}
                    </p>
                </div>

                <div 
                    className="aspect-video w-full rounded-[1.5rem] overflow-hidden border border-slate-200 shadow-md relative bg-slate-900 group"
                    style={{ outline: `2px solid ${activeColor}10` }}
                >
                    {embedUrl ? (
                        <>
                            {!iframeLoaded && (
                                <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-300 gap-3 z-20">
                                    <Loader2 className="w-8 h-8 text-white animate-spin" style={{ color: activeColor }} />
                                    <span className="text-xs font-bold uppercase tracking-widest font-mono text-slate-400">Iniciando guía de aprendizaje...</span>
                                </div>
                            )}

                            <iframe 
                                src={embedUrl}
                                title={promoVideo ? promoVideo.title : 'Guía de video'}
                                className="w-full h-full border-none relative z-10"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                onLoad={() => setIframeLoaded(true)}
                            />
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full p-6 text-slate-400 gap-3">
                            <Play size={40} className="text-slate-500 animate-pulse" />
                            <span className="text-xs font-bold uppercase tracking-widest font-mono">Enlace de video no disponible</span>
                        </div>
                    )}
                </div>

                {embedUrl && (
                    <div className="flex flex-col items-center justify-center gap-2 pt-1">
                        <span className="text-[10px] md:text-xs font-semibold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 tracking-wide animate-pulse">
                            🔈 El video se reproduce automáticamente. Activa el sonido en la barra de YouTube.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function App() {
    const queryClient = useQueryClient();
    
    // NAVIGATION & VIEW STATE (Top-most declarations to avoid TDZ errors)
    const [currentView, setCurrentView] = useState<string>(() => {
        try {
            const saved = localStorage.getItem('sislav_current_view');
            return saved || 'view:dashboard';
        } catch (e) {
            return 'view:dashboard';
        }
    });
    const [clientsSearch, setClientsSearch] = useState('');
    const [clientsPage, setClientsPage] = useState(1);
    const [clientsTotal, setClientsTotal] = useState(0);
    const [invoicesSearch, setInvoicesSearch] = useState('');
    const [invoicesPage, setInvoicesPage] = useState(1);
    const [invoicesTotal, setInvoicesTotal] = useState(0);
    const [initialPickupForPos, setInitialPickupForPos] = useState<PickupRequest | null>(null);

    const [trackingId, setTrackingId] = useState<string | null>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('t');
    });
    
    const [authSession, setAuthSession] = useState<AuthSession | null>(() => {
        const saved = localStorage.getItem('sislav_auth_session');
        if (saved) try { return JSON.parse(saved); } catch (e) {}
        return null;
    });
    const [activeSucursal, setActiveSucursal] = useState<any | null>(() => {
        const preloaded = (window as any).__SUCURSAL_BRANDING__;
        if (preloaded) return normalizeSucursal(preloaded);
        const saved = localStorage.getItem('sislav_active_sucursal');
        if (saved) try { return JSON.parse(saved); } catch (e) {}
        return null;
    });
    const [globalConfig, setGlobalConfig] = useState<SaasGlobalConfig | null>(null);
    const [isResolving, setIsResolving] = useState(true);
    
    // CASH SESSION LOCK
    const { data: activeCashSession, refetch: refetchCashSession, isLoading: isLoadingCashSession, isFetching: isFetchingCashSession, status: cashSessionStatus } = useQuery({
        queryKey: ['activeCashSession', activeSucursal?.id],
        queryFn: () => dbGetActiveCashClosing(),
        enabled: !isResolving && !!authSession?.user?.id && !!activeSucursal
    });

    const [isCashOpeningModalOpen, setIsCashOpeningModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    // Estados para la Force Reset de contraseñas temporales
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState('');

    const checkCajaOpen = useCallback((action: () => void) => {
        // Si aún está resolviendo sesión global o cargando sesión de caja, las acciones se encolan
        if (isResolving || isLoadingCashSession || isFetchingCashSession || cashSessionStatus === 'pending') {
            console.log("⏳ Encolando acción mientras carga la sesión de caja...");
            setPendingAction(() => action);
            return;
        }

        if (activeCashSession) {
            console.log("✅ Sesión de caja detectada:", activeCashSession.id);
            action();
        } else {
            console.log("⚠️ No hay sesión de caja activa, abriendo modal...");
            setPendingAction(() => action);
            setIsCashOpeningModalOpen(true);
        }
    }, [activeCashSession, isLoadingCashSession, isFetchingCashSession, cashSessionStatus, isResolving]);

    const navigateToPos = (initialPickup?: any) => {
        checkCajaOpen(() => {
            if (initialPickup) setInitialPickupForPos(initialPickup);
            setClientsSearch('');
            setClientsPage(1);
            setInvoicesSearch('');
            setInvoicesPage(1);
            setCurrentView('view:pos');
        });
    };

    const initialNavRef = useRef(false);
    useEffect(() => {
        if (authSession && !initialNavRef.current && currentView === 'view:dashboard') {
            const role = authSession.user.role;
            // No redireccionar automáticamente a dueños o admins si tienen acceso al dashboard
            if (role === UserRole.OWNER || role === UserRole.ADMIN) {
                initialNavRef.current = true;
                return;
            }

            const timer = setTimeout(() => {
                if (authSession) {
                    initialNavRef.current = true;
                    navigateToPos();
                }
            }, 5000); // 5 segundos de cortesía solicitado por el usuario
            return () => clearTimeout(timer);
        }
    }, [authSession, currentView]);

    // EFECTO DE REINTENTO: Si hubo una acción pendiente esperando a que la caja cargue
    useEffect(() => {
        if (!isLoadingCashSession && !isFetchingCashSession && cashSessionStatus === 'success' && pendingAction) {
            if (activeCashSession) {
                console.log("🔄 Ejecutando acción encolada tras carga de sesión...");
                pendingAction();
                setPendingAction(null);
            } else if (!isCashOpeningModalOpen) {
                console.log("⚠️ No se encontró sesión tras la carga, abriendo modal...");
                setIsCashOpeningModalOpen(true);
            }
        }
    }, [activeCashSession, isLoadingCashSession, isFetchingCashSession, cashSessionStatus, pendingAction, isCashOpeningModalOpen]);

    const handleConfirmCashOpening = async (amount: number, turno: string) => {
        await dbOpenCashClosing(amount, turno);
        await refetchCashSession();
        if (pendingAction) {
            pendingAction();
            setPendingAction(null);
        }
    };

    const refreshData = useCallback(async (manual: boolean = false) => {
        // Forzar limpieza de cache interno de dbService
        invalidateCache('invoices');
        invalidateCache('orderStats');
        invalidateCache('payment_methods');

        // Solo invalidar queries dinámicas, no las estáticas
        queryClient.invalidateQueries({ queryKey: ['clients'] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['orderStats'] });
        queryClient.invalidateQueries({ queryKey: ['machines'] });
        queryClient.invalidateQueries({ queryKey: ['activeItems'] });
        queryClient.invalidateQueries({ queryKey: ['activeCashSession'] });
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['employees'] });
        queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
        
        // Solo refrescar sucursal si es refresh manual explícito del usuario
        if (manual && activeSucursal?.id) {
            try {
                const refreshedSucursalData = await dbGetSucursalById(activeSucursal.id);
                if (refreshedSucursalData) {
                    setActiveSucursal(refreshedSucursalData);
                    localStorage.setItem(
                        'sislav_active_sucursal', 
                        JSON.stringify(refreshedSucursalData)
                    );
                }
            } catch (e) {
                console.error("Error refreshing sucursal:", e);
            }
        }
    }, [queryClient, activeSucursal]);

    useEffect(() => {
        const initApp = async () => {
            try {
                const savedSession = localStorage.getItem('sislav_auth_session');
                const savedSucursal = localStorage.getItem('sislav_active_sucursal');
                const savedConfig = localStorage.getItem('sislav_global_config');

                if (savedSession) {
                    try {
                        const parsed = JSON.parse(savedSession);
                        setAuthSession(parsed);
                        
                        // Verificar integridad de la sesión con Supabase
                        const { data: { session }, error: verifyError } = await supabase.auth.getSession();
                        if (verifyError || !session) {
                            console.warn("⚠️ Sesión de Supabase inválida o expirada, limpiando...");
                            localStorage.removeItem('sislav_auth_session');
                            setAuthSession(null);
                        }
                    } catch (e) {
                        localStorage.removeItem('sislav_auth_session');
                    }
                }
                if (savedSucursal) {
                    const sucursal = JSON.parse(savedSucursal);
                    setActiveSucursal(sucursal);
                    const session = JSON.parse(localStorage.getItem('sislav_auth_session') || '{}');
                    setDbBranchContext(sucursal.id, sucursal.empresa_id, session?.user?.id);
                    
                    // REFRESH SILENCIOSO en segundo plano del perfil de sucursal
                    dbGetSucursalById(sucursal.id).then(data => {
                        if (data) {
                            setActiveSucursal(data);
                            localStorage.setItem('sislav_active_sucursal', JSON.stringify(data));
                        }
                    }).catch(() => {});
                }
                if (savedConfig) setGlobalConfig(JSON.parse(savedConfig));

                const params = new URLSearchParams(window.location.search);
                const hasSlug = !!params.get('s');
                const hasTracking = !!params.get('t');

                if (hasSlug) {
                    const slug = params.get('s')!;
                    const sucursalData = await dbGetSucursalBySlug(slug);
                    if (sucursalData) {
                        setActiveSucursal(sucursalData);
                        const session = JSON.parse(localStorage.getItem('sislav_auth_session') || '{}');
                        setDbBranchContext(sucursalData.id, sucursalData.empresa_id, session?.user?.id);
                    }
                }

                if (hasTracking) {
                    setTrackingId(params.get('t'));
                }

                if (!savedSession && !hasSlug && !hasTracking) {
                    setIsResolving(false);
                    return;
                }
            } catch (e) {
                console.error("Error initializing app:", e);
            } finally {
                setIsResolving(false);
            }
        };
        initApp();
    }, []);

    const isFetchingProfileRef = useRef(false);
    const [resolveError, setResolveError] = useState<string | null>(null);
    
    const [isMasterMode, setIsMasterMode] = useState(false);
    const [showMasterLogin, setShowMasterLogin] = useState(false);

    useEffect(() => {
        const savedSession = localStorage.getItem('sislav_auth_session');
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                setIsMasterMode(session.user.role === UserRole.SAAS_MASTER && !session.user.isMasterBypass);
            } catch (e) {}
        }
        
        const params = new URLSearchParams(window.location.search);
        const hasSession = !!savedSession;
        const isTracking = !!params.get('t');
        const isPublicBranch = !!params.get('s');
        
        // Solo mostramos el Master Login si NO hay parámetros públicos (tracking o sucursal)
        setShowMasterLogin(!hasSession && !params.get('s') && !params.get('o') && !params.get('mode') && !isTracking && !isPublicBranch && window.location.pathname !== '/owner-login');
    }, [authSession]);

    const isOwnerPath = window.location.pathname === '/owner-login' || !!new URLSearchParams(window.location.search).get('o');

    useEffect(() => {
        localStorage.setItem('sislav_current_view', currentView);
        if (currentView === 'view:cash_closing') {
            setInvoicesSearch('');
            setInvoicesPage(1);
            // También egresos si tuviéramos búsqueda de egresos global
        }
    }, [currentView]);

    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('sislav_dark_mode');
        return saved ? JSON.parse(saved) : false;
    });

    useEffect(() => {
        localStorage.setItem('sislav_dark_mode', JSON.stringify(darkMode));
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    useEffect(() => {
        if (activeSucursal) {
            localStorage.setItem('sislav_active_sucursal', JSON.stringify(activeSucursal));
        }
    }, [activeSucursal]);

    const toggleDarkMode = () => setDarkMode(!darkMode);

    // EFECTO DINÁMICO: Actualizar Favicon, Título y Manifest según Sucursal activa
    useEffect(() => {
        if (activeSucursal) {
            const iconUrl = activeSucursal.url_favicon || activeSucursal.url_logo || activeSucursal.logoUrl;
            
            if (iconUrl) {
                applyDynamicManifest({
                    name: activeSucursal.nombre_comercial || activeSucursal.nombre_sucursal || activeSucursal.razonSocial || "SISLAV SUCURSAL",
                    shortName: (activeSucursal.nombre_comercial || activeSucursal.nombre_sucursal || "SISLAV").substring(0, 12),
                    iconUrl,
                    themeColor: activeSucursal.color_primario || "#1A6EF5",
                    backgroundColor: activeSucursal.color_secundario || "#0d0f14",
                    startUrl: window.location.href
                });
            }

            if (activeSucursal.nombre_comercial || activeSucursal.nombre_sucursal || activeSucursal.razonSocial) {
                document.title = `${activeSucursal.nombre_comercial || activeSucursal.nombre_sucursal || activeSucursal.razonSocial} - CONTROL TOTAL`;
            }
        }
    }, [activeSucursal?.id]);

    const [products, setProducts] = useState<Product[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [globalOrderStats, setGlobalOrderStats] = useState({ toCollect: 0, toDeliver: 0 });
    const [categories, setCategories] = useState<Category[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [supplies, setSupplies] = useState<Supply[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
    const [pausedSales, setPausedSales] = useState<PausedSale[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    const [isFastOrderOpen, setIsFastOrderOpen] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    // Modal de estado temporal (1 segundo)
    const [statusModal, setStatusModal] = useState<{ 
        isOpen: boolean; 
        message: string; 
        type: 'success' | 'error' | 'pending'; 
    }>({ 
        isOpen: false, 
        message: '', 
        type: 'success' 
    });

    const statusModalTimer = useRef<any>(null);

    const showStatusModal = (message: string, type: 'success' | 'error' | 'pending' = 'success', duration: number = 2500) => {
        if (statusModalTimer.current) clearTimeout(statusModalTimer.current);
        setStatusModal({ isOpen: true, message, type });
        if (duration > 0) {
            statusModalTimer.current = setTimeout(() => {
                setStatusModal(prev => ({ ...prev, isOpen: false }));
            }, duration);
        }
    };

    // GESTIÓN DEL BOTÓN ATRÁS (MOBILE/TABLET) - UBICACIÓN SEGURA
    useEffect(() => {
        const handlePopState = () => {
            if (!authSession) return; // No actuar si no hay sesión

            if (currentView !== 'view:dashboard') {
                setCurrentView('view:dashboard');
                window.history.pushState({ view: 'view:dashboard' }, '');
            } else {
                setShowExitConfirm(true);
                window.history.pushState({ view: 'view:dashboard' }, '');
            }
        };

        if (!window.history.state) {
            window.history.pushState({ view: currentView }, '');
        }

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [currentView, authSession]);

    const [activePickupForFastOrder, setActivePickupForFastOrder] = useState<PickupRequest | null>(null);

    const [showCobranzaModal, setShowCobranzaModal] = useState(false);
    const [isCobranzaBlocking, setIsCobranzaBlocking] = useState(false);
    const [hasClosedCobranza, setHasClosedCobranza] = useState(false);

    const [waContacts, setWaContacts] = useState<Contact[]>([]);
    const [waStatus, setWaStatus] = useState<CampaignStatus>(CampaignStatus.IDLE);
    const [waTemplates, setWaTemplates] = useState<CampaignTemplate[]>([]);
    const [waDelay, setWaDelay] = useState(10);
    const [waGlobalImage, setWaGlobalImage] = useState('');
    const [waReminderMessage, setWaReminderMessage] = useState("Estimado usuario somos de la lavandería, su prenda esta lista no se olvide de recogerla.");
    const [waReminderTemplates, setWaReminderTemplates] = useState<CampaignTemplate[]>([]);
    const [waReminderMessageState, setWaReminderMessageState] = useState(waReminderMessage);
    const [waActiveTab, setWaActiveTab] = useState<'campaign' | 'reminder' | 'templates'>('campaign');

    const [waRemindersProgress, setWaRemindersProgress] = useState(0);
    const [waRemindersMetrics, setWaRemindersMetrics] = useState({ sent: 0, failed: 0, total: 0 });
    const [isWaRemindersSending, setIsWaRemindersSending] = useState(false);

    const [editingClient, setEditingClient] = useState<Client | null>(null);

    const waTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isWaProcessingRef = useRef<boolean>(false);

    const fetchClients = useCallback(async (page: number, search: string = '') => {
        setClientsPage(page);
        setClientsSearch(search);
    }, []);

    const fetchInvoices = useCallback(async (page: number, search: string = '') => {
        setInvoicesPage(page);
        setInvoicesSearch(search);
    }, []);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
            console.log(`🔐 Auth State Change: ${event}`, !!session?.user);
            
            if (session?.user) {
                // OPTIMIZATION: Avoid redundant profile fetch if we already have it or are fetching it
                const currentSession = JSON.parse(localStorage.getItem('sislav_auth_session') || 'null');
                if (currentSession?.user.id === session.user.id && !isFetchingProfileRef.current) {
                    console.log("⏩ Perfil ya cargado en sesión actual, saltando fetch redundante");
                    return;
                }

                if (isFetchingProfileRef.current) return;
                isFetchingProfileRef.current = true;

                console.log("👤 Obteniendo perfil de usuario...");
                try {
                    const savedSession = JSON.parse(localStorage.getItem('sislav_auth_session') || 'null');
                    const masterPassword = savedSession?.user?.masterPassword;

                    // Añadimos timeout y fallback para admin en App.tsx también
                    const isDev = import.meta.env.DEV === true;
                    const isAdmin = session.user.email?.includes('admin') || savedSession?.user?.username === 'admin';
                    
                    const { data: profile, error } = await withTimeout<any>(
                        supabase
                            .from('usuarios_login')
                            .select('*, sucursales(*, empresas_holding(nombre_empresa))')
                            .eq('id', session.user.id)
                            .maybeSingle(),
                        isDev && isAdmin ? 5000 : 30000
                    ).catch(() => ({ data: null, error: { message: "Timeout en App.tsx" } }));

                    if (error) console.error("❌ Error obteniendo perfil:", error);

                    // VALIDACIÓN COMPLEMENTARIA DE SEGURIDAD PARA SESIONES ACTIVAS
                    if (profile && profile.rol !== UserRole.SAAS_MASTER) {
                        const params = new URLSearchParams(window.location.search);
                        const urlSlug = params.get('s');
                        
                        // Si el usuario es operativo y está en una URL de sucursal distinta a la suya...
                        if (urlSlug && profile.sucursales?.slug && profile.sucursales.slug !== urlSlug) {
                            console.error("⛔ Intento de acceso a sucursal no autorizada detectado.");
                            // Limpiamos sesión pero NO redirigimos, para que el login pueda mostrar el error
                            await supabase.auth.signOut();
                            setAuthSession(null);
                            localStorage.removeItem('sislav_auth_session');
                            return;
                        }
                    }

                    if (!profile && isDev && isAdmin) {
                        console.warn("⚡ App.tsx Fast Path: Usando perfil de emergencia para admin");
                        const emergencySession: AuthSession = {
                            user: {
                                id: session.user.id,
                                username: 'admin',
                                name: UserRole.ADMIN + ' (APP FALLBACK)',
                                role: UserRole.SAAS_MASTER,
                                isMasterBypass: true,
                                masterPassword: masterPassword
                            }
                        };
                        
                        // Solo actualizamos si la sesión es diferente
                        if (JSON.stringify(authSession?.user) !== JSON.stringify(emergencySession.user)) {
                            setAuthSession(emergencySession);
                            localStorage.setItem('sislav_auth_session', JSON.stringify(emergencySession));
                            setIsMasterMode(true);
                            setShowMasterLogin(false);
                        }
                        return;
                    }

                    if (profile) {
                        if (!profile.activo && profile.rol !== UserRole.SAAS_MASTER) {
                            console.error("⛔ Usuario desactivado detectado.");
                            await supabase.auth.signOut();
                            setAuthSession(null);
                            localStorage.removeItem('sislav_auth_session');
                            return;
                        }

                        console.log("✅ Perfil obtenido:", profile.username);
                        const newSession: AuthSession = {
                            user: {
                                id: profile.id,
                                username: profile.username,
                                name: profile.nombre_completo,
                                role: profile.rol as UserRole,
                                holding_id: profile.empresa_id || profile.empresa_holding_id,
                                holding_name: profile.sucursales?.empresas_holding?.nombre_empresa || profile.nombre_empresa,
                                sucursal_id: profile.sucursal_id,
                                masterPassword: masterPassword, // Preservar el password maestro si existía
                                permissions: profile.permisos_map || profile.permisos_json || {}
                            }
                        };
                        
                        if (JSON.stringify(authSession?.user) !== JSON.stringify(newSession.user)) {
                            setAuthSession(newSession);
                            localStorage.setItem('sislav_auth_session', JSON.stringify(newSession));
                            
                            if (newSession.user.role === UserRole.SAAS_MASTER && !newSession.user.isMasterBypass) {
                                setIsMasterMode(true);
                                setShowMasterLogin(false);
                            }
                        }

                        if (profile.sucursales) {
                            const sucursal = normalizeSucursal(profile.sucursales);
                            setActiveSucursal(sucursal);
                            setDbBranchContext(sucursal.id, sucursal.empresa_id, profile.id);
                            localStorage.setItem('sislav_active_sucursal', JSON.stringify(sucursal));
                        }
                    }
                } finally {
                    isFetchingProfileRef.current = false;
                }
            } else if (event === 'SIGNED_OUT') {
                console.log("👋 Usuario deslogueado");
                // Solo limpiamos si es un cierre de sesión explícito y no es bypass
                const savedSession = localStorage.getItem('sislav_auth_session');
                if (savedSession) {
                    try {
                        const parsed = JSON.parse(savedSession);
                        if (!parsed.user.isMasterBypass) {
                            setAuthSession(null);
                            localStorage.removeItem('sislav_auth_session');
                        }
                    } catch (e) {}
                }
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const resolvePortal = async () => {
            console.log("🚀 Iniciando resolvePortal...");
            const timeoutId = setTimeout(() => {
                if (isResolving) {
                    console.warn("⚠️ resolvePortal tardando demasiado, forzando resolución...");
                    setIsResolving(false);
                }
            }, 5000); // 5s de margen

            try {
                // OPTIMIZATION: Load cached global config immediately, but do NOT fetch from API until authenticated
                const cachedConfig = localStorage.getItem('sislav_global_config');
                if (cachedConfig) {
                    setGlobalConfig(JSON.parse(cachedConfig));
                }

                // PERSISTENCE: Session and Sucursal are now handled in useState initializers
                // but we still check for slug in URL which is a high priority override
                const params = new URLSearchParams(window.location.search);
                const slug = params.get('s');
                const ownerSlug = params.get('o');
                const tId = params.get('t');
                const holdingBrandId = params.get('h');

                if (holdingBrandId && params.get('mode') === 'logistics') {
                    console.log(`🔍 Resolviendo branding de holding por ID: ${holdingBrandId}`);
                    const brand = await dbGetHoldingBranding(holdingBrandId).catch(() => null);
                    if (brand) {
                        console.log("✅ Branding de holding resuelto:", brand.nombre_sucursal);
                        setActiveSucursal(brand);
                    }
                }

                if (ownerSlug && window.location.pathname !== '/owner-login') {
                    // Eliminamos el replaceState que causaba 404 en refrescos si no estaba configurado en el servidor
                    // window.history.replaceState({}, '', '/owner-login' + window.location.search);
                }

                if (tId) {
                    setTrackingId(tId);
                }

                if (slug) {
                    const cleanSlug = slug.trim();
                    const preloaded = (window as any).__SUCURSAL_BRANDING__;
                    
                    if (preloaded && preloaded.slug === cleanSlug) {
                        console.log("⚡ [resolvePortal] Usando branding pre-cargado:", preloaded.nombre_sucursal);
                        const branch = normalizeSucursal(preloaded);
                        setActiveSucursal(branch);
                        setDbBranchContext(branch.id, branch.empresa_id, authSession?.user?.id);
                    } else {
                        const currentSucursal = JSON.parse(localStorage.getItem('sislav_active_sucursal') || 'null');
                        if (currentSucursal?.slug !== cleanSlug) {
                            console.log(`🔍 Resolviendo sucursal por slug: ${cleanSlug}`);
                            const branch = await dbGetSucursalBySlug(cleanSlug).catch((err) => {
                                console.error("❌ Error crítico en dbGetSucursalBySlug:", err);
                                return null;
                            });
                            
                            if (branch) {
                                console.log("✅ Sucursal resuelta:", branch.nombre_sucursal);
                                setActiveSucursal(branch);
                                setDbBranchContext(branch.id, branch.empresa_id, authSession?.user?.id);
                                localStorage.setItem('sislav_active_sucursal', JSON.stringify(branch));
                            } else {
                                console.warn(`⚠️ No se pudo resolver la sucursal '${cleanSlug}'. Verifique RLS.`);
                                setResolveError(`La sucursal '${cleanSlug}' no está disponible o no existe.`);
                            }
                        } else if (currentSucursal) {
                            console.log("✅ Usando sucursal activa de sesión previa:", currentSucursal.nombre_sucursal);
                            setActiveSucursal(currentSucursal);
                            setDbBranchContext(currentSucursal.id, currentSucursal.empresa_id, authSession?.user?.id);
                        }
                    }
                }
            } catch (e) {
                console.error("❌ Error crítico en resolución inicial:", e);
                if (!localStorage.getItem('sislav_global_config')) {
                    setResolveError("Error al conectar con la red Sislav.");
                }
            } finally {
                clearTimeout(timeoutId);
                console.log("🏁 Finalizando resolvePortal");
                setIsResolving(false);
            }
        };
        resolvePortal();
    }, []);

    // Fetch and load remote global configuration only when the user is fully authenticated to avoid 401 Unauthorized errors on login screen
    useEffect(() => {
        if (!authSession) return;

        const fetchGlobalConfig = async () => {
            try {
                const cachedConfig = localStorage.getItem('sislav_global_config');
                const hasCachedConfig = !!cachedConfig;

                const gConfigPromise = getSaasGlobalConfig();

                if (!hasCachedConfig) {
                    console.log("📦 Obteniendo configuración global (BLOQUEANTE post-autenticación)...");
                    const gConfig = await withTimeout<any>(gConfigPromise, 8000).catch(() => null);
                    if (gConfig) {
                        setGlobalConfig(gConfig);
                        localStorage.setItem('sislav_global_config', JSON.stringify(gConfig));
                    }
                } else {
                    console.log("📦 Actualizando configuración global en segundo plano...");
                    gConfigPromise.then(gConfig => {
                        if (gConfig) {
                            setGlobalConfig(gConfig);
                            localStorage.setItem('sislav_global_config', JSON.stringify(gConfig));
                        }
                    }).catch(() => {});
                }
            } catch (err) {
                console.error("Error al cargar configuración global:", err);
            }
        };

        fetchGlobalConfig();
    }, [authSession]);

    const executeBotCheckIn = useCallback(async () => {
        if (!activeSucursal || !globalConfig) return;
        
        const todayStr = new Date().toISOString().split('T')[0];
        const storageKey = `sislav_bot_notified_${activeSucursal.id}_${todayStr}`;
        
        // 1. Verificar en localStorage primero para rapidez
        if (localStorage.getItem(storageKey)) return;

        try {
            // 2. Verificar en la Base de Datos de manera persistente
            const alreadyNotified = await dbCheckAndRegisterBotCheckIn(activeSucursal.id, todayStr);
            if (alreadyNotified) {
                localStorage.setItem(storageKey, 'true');
                return;
            }

            const { url_bot, instancia_bot, apikey_bot, whatsapp_saas, whatsapp_cod_pais } = globalConfig;

            if (url_bot && instancia_bot && apikey_bot && whatsapp_saas) {
                const botService = new EvolutionService({
                    baseUrl: url_bot,
                    apiKey: apikey_bot,
                    instanceName: instancia_bot
                });
                
                const prefix = whatsapp_cod_pais || '+51';
                const targetNumber = prefix + whatsapp_saas.toString();
                const branchName = activeSucursal.nombre_sucursal || activeSucursal.razonSocial || 'DEMO PRUEBA';
                
                await botService.sendText(targetNumber, `Lavanderia ${branchName} 🟢`);
                localStorage.setItem(storageKey, 'true');
            }
        } catch (err) {
            // Silent fallback para que no interrumpa la venta si falla el bot
            console.warn("⚠️ Bot Monitoring Check-in fallback/fail:", err);
        }
    }, [activeSucursal, globalConfig]);

    useEffect(() => {
        if (activeSucursal) {
            const root = document.documentElement;
            root.style.setProperty('--brand-primary', activeSucursal.primaryColor || '#0054A6');
            root.style.setProperty('--brand-secondary', activeSucursal.secondaryColor || '#10B981');
            root.style.setProperty('--primary-color', activeSucursal.primaryColor || '#0054A6');
            document.title = activeSucursal.razonSocial || 'SISLAV';

            if (activeSucursal.cobranza) {
                if (activeSucursal.cobranza_activada_at) {
                    const activatedAt = new Date(activeSucursal.cobranza_activada_at).getTime();
                    const now = new Date().getTime();
                    const diffHours = (now - activatedAt) / (1000 * 60 * 60);
                    if (diffHours >= 24) {
                        setIsCobranzaBlocking(true);
                        setShowCobranzaModal(true);
                    } else if (!hasClosedCobranza) {
                        setShowCobranzaModal(true);
                        setIsCobranzaBlocking(false);
                    }
                } else if (!hasClosedCobranza) {
                    setShowCobranzaModal(true);
                    setIsCobranzaBlocking(false);
                }
            } else {
                setShowCobranzaModal(false);
                setIsCobranzaBlocking(false);
            }
        }
    }, [activeSucursal, hasClosedCobranza]);

    useEffect(() => {
        if (!activeSucursal?.id || !authSession) return;
        const fetchWaConfig = async () => {
            const waConfig = await dbGetWaCampaignConfig();
            if (waConfig) {
                if (waConfig.plantillas_json) setWaTemplates(waConfig.plantillas_json);
                if (waConfig.plantillas_recordatorio_json) setWaReminderTemplates(waConfig.plantillas_recordatorio_json);
                if (waConfig.delay_segundos) setWaDelay(Math.max(10, waConfig.delay_segundos));
                if (waConfig.url_imagen_campania) setWaGlobalImage(waConfig.url_imagen_campania);
            }
        };
        fetchWaConfig();
    }, [activeSucursal?.id, authSession]);

    // REAL-TIME SUBSCRIPTIONS
    useEffect(() => {
        const branchId = activeSucursal?.id;
        if (!branchId || !authSession) return;

        console.log(`📡 Iniciando suscripción Realtime para sede: ${branchId}`);

        const channel = supabase
            .channel(`db-changes-${branchId}`)
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'ventas', 
                    filter: `sucursal_id=eq.${branchId}` 
                }, 
                (payload) => {
                    console.log('💰 Cambio detectado en VENTAS:', payload.eventType);
                    if (payload.eventType === 'INSERT') {
                        queryClient.invalidateQueries({ queryKey: ['invoices'] });
                        queryClient.invalidateQueries({ queryKey: ['orderStats'] });
                    } else {
                        // Para actualizaciones, invalidamos las queries para que useQuery las refresque
                        queryClient.invalidateQueries({ queryKey: ['invoices'] });
                    }
                }
            )
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'items_venta'
                }, 
                (payload) => {
                    console.log('👕 Cambio detectado en ITEMS_VENTA:', payload.eventType);
                    queryClient.invalidateQueries({ queryKey: ['invoices', branchId] });
                    queryClient.invalidateQueries({ queryKey: ['activeItems', branchId] });
                    // También refrescamos máquinas porque su estado visual depende de los items
                    queryClient.invalidateQueries({ queryKey: ['machines', branchId] });
                }
            )
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'maquinas', 
                    filter: `sucursal_id=eq.${branchId}` 
                }, 
                (payload) => {
                    console.log('🤖 Cambio detectado en MAQUINAS:', payload.eventType);
                    queryClient.invalidateQueries({ queryKey: ['machines', branchId] });
                }
            )
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'productos', 
                    filter: `sucursal_id=eq.${branchId}` 
                }, 
                () => {
                    queryClient.invalidateQueries({ queryKey: ['products'] });
                }
            )
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'clientes', 
                    filter: `sucursal_id=eq.${branchId}` 
                }, 
                () => {
                    queryClient.invalidateQueries({ queryKey: ['clients'] });
                    queryClient.invalidateQueries({ queryKey: ['birthdayClients'] });
                }
            )
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'egresos', 
                    filter: `sucursal_id=eq.${branchId}` 
                }, 
                () => {
                    console.log('💸 Cambio detectado en EGRESOS');
                    queryClient.invalidateQueries({ queryKey: ['expenses', branchId] });
                }
            )
            .on('postgres_changes', 
                { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'sucursales', 
                    filter: `id=eq.${branchId}` 
                }, 
                (payload) => {
                    console.log('🏢 Cambio detectado en CONFIGURACIÓN DE SEDE:', payload.eventType);
                    const newData = payload.new;
                    if (newData && activeSucursal && newData.id === activeSucursal.id) {
                        const updatedSucursal = normalizeSucursal(newData);
                        setActiveSucursal(updatedSucursal);
                        localStorage.setItem('sislav_active_sucursal', JSON.stringify(updatedSucursal));
                        // No es necesario refrescar todo, setActiveSucursal disparará el re-render de Layout
                        // pero refrescamos queries que puedan depender de la sucursal
                        queryClient.invalidateQueries({ queryKey: ['ticketConfig', branchId] });
                    }
                }
            )
            .subscribe((status) => {
                console.log(`🔌 Estado de suscripción Realtime: ${status}`);
            });

        return () => {
            console.log('🔌 Cerrando canal Realtime');
            supabase.removeChannel(channel);
        };
    }, [activeSucursal?.id, queryClient, refreshData]);

    // SYNC: Favicon, Title, and Brand Colors based on activeSucursal
    useEffect(() => {
        if (activeSucursal) {
            // Update Title
            const companyName = activeSucursal.nombre_comercial || activeSucursal.nombre_sucursal || 'SISLAV';
            document.title = `${companyName} - CONTROL TOTAL`;

            // Sync Favicon and Apple Touch Icon
            const faviconUrl = activeSucursal.url_favicon || activeSucursal.url_logo;
            if (faviconUrl) {
                // Update basic favicons
                ['link[rel*="icon"]', 'link[rel="apple-touch-icon"]'].forEach(selector => {
                    const link: HTMLLinkElement | null = document.querySelector(selector);
                    if (link) {
                        link.href = faviconUrl;
                    } else if (selector.includes('icon')) {
                        const newLink = document.createElement('link');
                        newLink.rel = 'icon';
                        newLink.href = faviconUrl;
                        document.head.appendChild(newLink);
                    }
                });

                // Update OG Image for social previews
                ['meta[property="og:image"]', 'meta[property="og:image:secure_url"]', 'meta[name="twitter:image"]'].forEach(selector => {
                    let meta: HTMLMetaElement | null = document.querySelector(selector);
                    if (meta) {
                        meta.content = faviconUrl;
                    } else if (selector.includes('og:image')) {
                        const newMeta = document.createElement('meta');
                        newMeta.setAttribute('property', selector.includes('secure_url') ? 'og:image:secure_url' : 'og:image');
                        newMeta.content = faviconUrl;
                        document.head.appendChild(newMeta);
                    }
                });
            }
            
            // Sync Brand Colors to CSS variables
            if (activeSucursal.color_primario) {
                document.documentElement.style.setProperty('--brand-primary', activeSucursal.color_primario);
                document.documentElement.style.setProperty('--primary-color', activeSucursal.color_primario);
            }
            if (activeSucursal.color_secundario) {
                document.documentElement.style.setProperty('--brand-secondary', activeSucursal.color_secundario);
            }

            // Sync Manifest with slug for proper PWA installation
            if (activeSucursal.slug) {
                const manifestLink: HTMLLinkElement | null = document.querySelector('link[rel="manifest"]');
                if (manifestLink) {
                    const currentSearch = window.location.search || `?s=${activeSucursal.slug}`;
                    manifestLink.href = `/manifest.json${currentSearch}`;
                }
            }
        }
    }, [activeSucursal]);

    // REACT QUERY HOOKS
    const { data: productsData, isLoading: isLoadingProducts } = useQuery({
        queryKey: ['products', activeSucursal?.id],
        queryFn: dbGetProducts,
        enabled: !!activeSucursal?.id && !!authSession,
        staleTime: 5 * 60 * 1000
    });

    const productMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string | null, updates: any }) => {
            if (id) {
                return await dbUpdateProduct(id, updates);
            } else {
                return await dbSaveProduct(updates);
            }
        },
        onMutate: async ({ id, updates }) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['products', activeSucursal?.id] });

            // Snapshot the previous value
            const previousProducts = queryClient.getQueryData<Product[]>(['products', activeSucursal?.id]);

            // Optimistically update to the new value
            if (id) {
                queryClient.setQueryData(['products', activeSucursal?.id], (old: Product[] | undefined) => {
                    return old?.map(p => p.id === id ? { ...p, ...updates } : p);
                });
            }

            return { previousProducts };
        },
        onError: (err, variables, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousProducts) {
                queryClient.setQueryData(['products', activeSucursal?.id], context.previousProducts);
            }
        },
        onSettled: () => {
            // Always refetch after error or success to keep server sync
            queryClient.invalidateQueries({ queryKey: ['products', activeSucursal?.id] });
        },
    });

    const deleteProductMutation = useMutation({
        mutationFn: dbDeleteProduct,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['products', activeSucursal?.id] });
            const previousProducts = queryClient.getQueryData<Product[]>(['products', activeSucursal?.id]);

            queryClient.setQueryData(['products', activeSucursal?.id], (old: Product[] | undefined) => {
                return old?.filter(p => p.id !== id);
            });

            return { previousProducts };
        },
        onError: (err, variables, context) => {
            if (context?.previousProducts) {
                queryClient.setQueryData(['products', activeSucursal?.id], context.previousProducts);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['products', activeSucursal?.id] });
        },
    });

    const { data: clientsRes, isLoading: isLoadingClients } = useQuery({
        queryKey: ['clients', activeSucursal?.id, clientsPage, clientsSearch],
        queryFn: () => dbGetClients(clientsPage, 100, clientsSearch),
        enabled: !!activeSucursal?.id && !!authSession,
        staleTime: 60 * 1000
    });

    const { data: invoicesRes, isLoading: isLoadingInvoices } = useQuery({
        queryKey: ['invoices', activeSucursal?.id, invoicesPage, invoicesSearch],
        queryFn: () => dbGetInvoices(invoicesPage, 50, invoicesSearch),
        enabled: !!activeSucursal?.id && !!authSession,
        staleTime: 30 * 1000, // 30 segundos de vigencia de caché para evitar re-fetching excesivo al navegar
    });

    const { data: orderStatsRes } = useQuery({
        queryKey: ['orderStats', activeSucursal?.id],
        queryFn: dbGetOrderStats,
        enabled: !!activeSucursal?.id && !!authSession,
        refetchInterval: 30000,
        staleTime: 15 * 1000,
    });

    useEffect(() => {
        if (orderStatsRes) {
            setGlobalOrderStats({
                toCollect: orderStatsRes.toCollect || 0,
                toDeliver: orderStatsRes.toDeliver || 0
            });
        }
    }, [orderStatsRes]);

    const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
        queryKey: ['categories', activeSucursal?.id],
        queryFn: dbGetCategories,
        enabled: !!activeSucursal?.id && !!authSession,
        staleTime: 5 * 60 * 1000
    });

    const { data: machinesData, isLoading: isLoadingMachines } = useQuery({
        queryKey: ['machines', activeSucursal?.id],
        queryFn: dbGetMachines,
        enabled: !!activeSucursal?.id && !!authSession,
        refetchInterval: 15000, // Refetch every 15s as fallback
        staleTime: 30 * 1000, // Sincronizado por Realtime, seguro mantener en caché
    });

    const { data: activeItems = [] } = useQuery({
        queryKey: ['activeItems', activeSucursal?.id],
        queryFn: dbGetActiveItems,
        enabled: !!activeSucursal?.id && !!authSession,
        refetchInterval: 15000, // Refetch every 15s as fallback
        staleTime: 30 * 1000, // Sincronizado por Realtime, seguro mantener en caché
    });

    const { data: expensesData, isLoading: isLoadingExpenses } = useQuery({
        queryKey: ['expenses', activeSucursal?.id],
        queryFn: () => dbGetExpenses(),
        enabled: !!activeSucursal?.id && !!authSession,
        staleTime: 60 * 1000
    });

    const { data: suppliesData, isLoading: isLoadingSupplies } = useQuery({
        queryKey: ['supplies', activeSucursal?.id],
        queryFn: dbGetSupplies,
        enabled: !!activeSucursal?.id && !!authSession,
        staleTime: 2 * 60 * 1000
    });

    const { data: purchasesData, isLoading: isLoadingPurchases } = useQuery({
        queryKey: ['purchases', activeSucursal?.id],
        queryFn: dbGetPurchases,
        enabled: !!activeSucursal?.id && !!authSession,
        staleTime: 2 * 60 * 1000
    });

    const { data: ticketConfig } = useQuery({
        queryKey: ['ticketConfig', activeSucursal?.id],
        queryFn: () => activeSucursal?.id ? dbGetTicketConfig(activeSucursal.id) : null,
        enabled: !!activeSucursal?.id && !!authSession,
        staleTime: 10 * 60 * 1000
    });

    const { data: paymentMethodsData, isLoading: isLoadingPaymentMethods } = useQuery({
        queryKey: ['paymentMethods', activeSucursal?.id],
        queryFn: dbGetPaymentMethods,
        enabled: !!activeSucursal?.id && !!authSession,
        staleTime: 5 * 60 * 1000
    });

    const { data: pausedSalesData, isLoading: isLoadingPausedSales } = useQuery({
        queryKey: ['pausedSales', activeSucursal?.id],
        queryFn: dbGetPausedSales,
        enabled: !!activeSucursal?.id && !!authSession,
        staleTime: 30 * 1000
    });

    const { data: employeesData, isLoading: isLoadingEmployees } = useQuery({
        queryKey: ['employees', activeSucursal?.id],
        queryFn: dbGetEmployees,
        enabled: !!activeSucursal?.id && !!authSession,
        staleTime: 2 * 60 * 1000
    });

    // Sync state with React Query data
    useEffect(() => { if (productsData) setProducts(productsData); }, [productsData]);
    useEffect(() => { if (clientsRes) { setClients(clientsRes.clients); setClientsTotal(clientsRes.total); } }, [clientsRes]);
    useEffect(() => { if (invoicesRes) { setInvoices(invoicesRes.invoices); setInvoicesTotal(invoicesRes.total); } }, [invoicesRes]);
    useEffect(() => { if (categoriesData) setCategories(categoriesData); }, [categoriesData]);
    useEffect(() => { if (machinesData) setMachines(machinesData); }, [machinesData]);
    useEffect(() => { if (expensesData) setExpenses(Array.isArray(expensesData) ? expensesData : (expensesData as any).expenses || []); }, [expensesData]);
    useEffect(() => { if (suppliesData) setSupplies(suppliesData); }, [suppliesData]);
    useEffect(() => { if (purchasesData) setPurchases(purchasesData); }, [purchasesData]);
    useEffect(() => { if (paymentMethodsData) setPaymentMethods(paymentMethodsData); }, [paymentMethodsData]);
    useEffect(() => { if (pausedSalesData) setPausedSales(pausedSalesData); }, [pausedSalesData]);
    useEffect(() => { if (employeesData) setEmployees(employeesData); }, [employeesData]);

    const isLoadingData = isLoadingProducts || isLoadingClients || isLoadingInvoices || isLoadingCategories || isLoadingMachines || isLoadingExpenses || isLoadingSupplies || isLoadingPurchases || isLoadingPaymentMethods || isLoadingPausedSales || isLoadingEmployees;

    const handleSelectTenant = (tenant: any, isMasterBypass: boolean = false) => {
        if (!tenant) return;
        setResolveError(null);
        const realId = tenant.id;
        const holdingId = tenant.empresa_id;
        setDbBranchContext(realId, holdingId);
        const normalized = normalizeSucursal(tenant);
        setActiveSucursal(normalized);
        localStorage.setItem('sislav_active_sucursal', JSON.stringify(normalized));

        if (isMasterBypass && authSession) {
            const bypassSession: AuthSession = {
                user: {
                    ...authSession.user,
                    sucursal_id: realId,
                    holding_id: holdingId,
                    sucursal_data: normalized,
                    isMasterBypass: true
                }
            };
            setAuthSession(bypassSession);
            localStorage.setItem('sislav_auth_session', JSON.stringify(bypassSession));
            setIsMasterMode(false);
            setShowMasterLogin(false);
        }
    };

    const handleSelectOwner = (company: SaasCompany) => {
        if (!company) return;
        setResolveError(null);
        
        // Limpiamos sucursal previa para que cargue el dashboard de dueño
        setActiveSucursal(null as any);
        localStorage.removeItem('sislav_active_sucursal');
        
        if (authSession) {
            const bypassSession: AuthSession = {
                user: {
                    ...authSession.user,
                    id: `owner_${company.id}`,
                    username: `owner_${company.id}`,
                    name: `PROPIETARIO: ${company.name}`,
                    role: UserRole.OWNER,
                    holding_id: company.id,
                    holding_name: company.name,
                    isMasterBypass: true
                }
            };
            setAuthSession(bypassSession);
            localStorage.setItem('sislav_auth_session', JSON.stringify(bypassSession));
            setIsMasterMode(false);
            setShowMasterLogin(false);
            setCurrentView('view:owner_dashboard');
        }
    };

    const handleLogin = async (u: string, p: string) => {
        try {
            if (!activeSucursal?.id) {
                throw new Error("Sucursal no detectada. Por favor, use el link correcto de su lavandería.");
            }
            const session = await dbGlobalLogin(u, p, activeSucursal.id);
            
            // 🔍 DEBUG TEMPORAL SOLICITADO
            const { data: userData } = await supabase.auth.getUser();
            console.log("APP DEBUG - USER:", userData);
            const { data: sessionData } = await supabase.auth.getSession();
            console.log("APP DEBUG - SESSION:", sessionData);

            if (session) {
                setAuthSession(session);
                localStorage.setItem('sislav_auth_session', JSON.stringify(session));
                if (session.user.role === UserRole.SAAS_MASTER) {
                    setIsMasterMode(true);
                    setShowMasterLogin(false);
                } else if (session.user.sucursal_data) {
                    // OPTIMIZATION: Use pre-fetched sucursal data from login
                    const sucursal = session.user.sucursal_data;
                    setActiveSucursal(sucursal);
                    setDbBranchContext(sucursal.id, sucursal.empresa_id);
                    localStorage.setItem('sislav_active_sucursal', JSON.stringify(sucursal));
                } else if (session.user.sucursal_id) {
                    const sucursal = await dbGetSucursalById(session.user.sucursal_id);
                    if (sucursal) {
                        setActiveSucursal(sucursal);
                        setDbBranchContext(sucursal.id, sucursal.empresa_id);
                        localStorage.setItem('sislav_active_sucursal', JSON.stringify(sucursal));
                    }
                }
            } else { 
                // Si dbGlobalLogin no lanzó error pero regresó null, es error de credenciales
                throw new Error("Credenciales inválidas."); 
            }
        } catch (e: any) { 
            // Si el error viene de dbGlobalLogin (como "ERROR: No pertenece a esta sucursal"), se propaga aquí
            throw e; 
        }
    };

    const checkAndSendRejectedAlert = async (invoice: Invoice, sunatRes: SunatResponse) => {
        if (!sunatRes.success && globalConfig?.whatsapp_saas) {
            try {
                // Usar el bot de actividad global configurado en saas_configuracion_global
                const evolutionConfig = {
                    baseUrl: globalConfig.url_bot || '',
                    apiKey: globalConfig.apikey_bot || '',
                    instanceName: globalConfig.instancia_bot || ''
                };
                
                if (!evolutionConfig.baseUrl || !evolutionConfig.apiKey || !evolutionConfig.instanceName) {
                    console.warn("Configuración de bot global incompleta para enviar alerta.");
                    return;
                }

                const service = new EvolutionService(evolutionConfig);
                const commercialName = activeSucursal?.razonSocial || activeSucursal?.name || 'LAVANDERIA';
                const docNumber = `${invoice.serie}-${String(invoice.correlativo).padStart(8, '0')}`;
                
                const message = `ALERTA🚨🚨\n*${commercialName.toUpperCase()}*\n*DOC*:${docNumber}\n*RECHAZADO*`;
                
                const fullPhone = `${globalConfig.whatsapp_cod_pais || '51'}${globalConfig.whatsapp_saas}`;
                await service.sendText(fullPhone, message);
            } catch (error) {
                console.error("Error al enviar alerta de rechazo a WhatsApp:", error);
            }
        }
    };

    const handleConvertInvoice = async (
        invoice: Invoice, 
        targetType: InvoiceType, 
        finalClient: Client
    ) => {
        if (!activeSucursal) return;
        
        try {
            showStatusModal(`Convirtiendo y enviando a SUNAT...`, 'pending', 0);
            const serie = targetType === InvoiceType.FACTURA 
                ? activeSucursal.serieFactura 
                : activeSucursal.serieBoleta;
            
            // 1. Convertir en DB y obtener el correlativo nuevo asignado
            const updatedVenta = await dbConvertInvoice(
                invoice.id, 
                targetType, 
                serie, 
                finalClient
            );

            // 2. Construir la invoice completa con el correlativo NUEVO de la BD
            //    (NO usar el correlativo viejo de la nota de venta)
            const now = getPeruDateTime().iso;
            const fullInvoice: Invoice = { 
                ...invoice, 
                type: targetType, 
                serie: updatedVenta.serie || serie,
                correlativo: updatedVenta.correlativo, // ← correlativo NUEVO asignado por BD
                client: finalClient, 
                date: invoice.date,
                fecha_emision: updatedVenta.fecha_emision || now
            };

            // 3. Enviar a SUNAT con los datos correctos
            const sunatRes = await sendBillToSunat(fullInvoice, activeSucursal);
            
            // 4. Actualizar respuesta de SUNAT en DB
            await dbUpdateSunatResponse(invoice.id, sunatRes);

            // 5. Alerta si fue rechazado
            if (!sunatRes.success && !sunatRes.isPending) {
                checkAndSendRejectedAlert(fullInvoice, sunatRes);
            }
            
            // 6. Refrescar datos
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            
             // 7. Mostrar resultado al usuario
            if (sunatRes.success) {
                showStatusModal(`✅ ${targetType === InvoiceType.FACTURA ? 'FACTURA' : 'BOLETA'} ${serie}-${String(updatedVenta.correlativo).padStart(8,'0')} emitida y enviada a SUNAT correctamente.`, 'success', 2500);
            } else if (sunatRes.isPending) {
                showStatusModal(`⏳ Documento convertido. No se pudo conectar con SUNAT ahora. Quedó en estado PENDIENTE.`, 'pending', 2000);
            } else {
                showStatusModal(`⚠️ Documento convertido pero SUNAT lo rechazó: ${sunatRes.description}`, 'error', 3000);
            }

        } catch (error: any) {
            console.error("Error al convertir factura:", error);
            alert("Error al convertir el documento: " + error.message);
        }
    };

    const handleLogout = async () => {
        console.log("Iniciando cierre de sesión...");
        const wasBypass = authSession?.user?.isMasterBypass;
        const wasDelivery = authSession?.user?.role === UserRole.DELIVERY;
        
        // 1. Limpiamos estado local inmediatamente para que la UI responda
        setAuthSession(null);
        localStorage.removeItem('sislav_auth_session');
        localStorage.removeItem('sislav_active_sucursal');
        localStorage.removeItem('sislav_active_branch_uuid');
        localStorage.removeItem('sislav_active_holding_uuid');
        localStorage.removeItem('sislav_active_user_uuid');
        localStorage.removeItem('sislav_current_user_name');
        localStorage.removeItem('sislav_current_user_role');

        try {
            if (!wasBypass) {
                console.log("Cerrando sesión en Supabase...");
                // CRITICAL: Await signOut to ensure the session is cleared before reload
                await supabase.auth.signOut();
                console.log("Sesión cerrada en Supabase correctamente");
            }
        } catch (e) {
            console.error("Error en proceso de logout Supabase:", e);
        }

        if (wasBypass) {
            console.log("Bypass detectado, volviendo a modo maestro...");
            setIsMasterMode(true);
        } else {
            console.log("Cierre de sesión completo, volviendo a login...");
            setIsMasterMode(false);
            
            const params = new URLSearchParams(window.location.search);
            const hasSlug = !!params.get('s');
            const isLogistics = !!params.get('mode') || wasDelivery;
            
            if (wasDelivery && !params.get('mode')) {
                window.history.replaceState({}, '', window.location.pathname + '?mode=logistics');
            }

            // Si estamos en ruta de dueño (por path o por parámetro 'o'), no mostramos el login maestro
            setShowMasterLogin(!hasSlug && !isOwnerPath && !isLogistics);
        }
        
        // Pequeño delay para asegurar que el almacenamiento se sincronice
        setTimeout(() => {
            console.log("Cierre de sesión completado.");
            // Ya no forzamos recarga, los estados de React deberían ser suficientes
        }, 100);
    };

    const handleUpdateItemStatusOptimistic = async (orderId: string, itemIds: string[], status: OrderStatus, machineId?: string, duration?: number, totalKg?: number) => {
        const branchId = activeSucursal?.id;
        
        // 1. Optimistic update for Invoices
        setInvoices(prevInvs => prevInvs.map(inv => {
            if (inv.id === orderId) {
                const newItems = inv.items.map(it => itemIds.includes(it.id) ? { ...it, status } : it);
                
                // Verificar si todos los items activos están entregados
                const activeItems = newItems.filter(it => !((it as any).estado_id === 9 || (it.status as any) === 'ANULADO' || it.status === 'CANCELADO'));
                const isAllDelivered = activeItems.length > 0 && activeItems.every(it => it.status === 'ENTREGADO');
                
                const updates: any = { items: newItems };
                if (isAllDelivered) {
                    updates.orderStatus = 'ENTREGADO';
                    updates.entregado_at = new Date().toISOString();
                }
                
                return { ...inv, ...updates };
            }
            return inv;
        }));

        // 2. Optimistic update for ActiveItems
        if (branchId) {
            queryClient.setQueryData(['activeItems', branchId], (old: any[] | undefined) => {
                const current = old || [];
                let next = [...current];
                
                itemIds.forEach(id => {
                    const index = next.findIndex(it => it.id === id);
                    if (status === 'EN_LAVADO' || status === 'EN_SECADO') {
                        if (index > -1) {
                            next[index] = { ...next[index], estado: status };
                        } else {
                            next.push({ id, venta_id: orderId, estado: status });
                        }
                    } else {
                        if (index > -1) {
                            next.splice(index, 1);
                        }
                    }
                });
                return next;
            });

            // 3. Optimistic update for Machines if assigned
            if (machineId && (status === 'EN_LAVADO' || status === 'EN_SECADO')) {
                queryClient.setQueryData(['machines', branchId], (old: Machine[] | undefined) => {
                    if (!old) return old;
                    return old.map(m => {
                        if (m.id === machineId) {
                            return { 
                                ...m, 
                                estado_operativo: 'OCUPADO', 
                                currentOrderId: orderId,
                                startTime: new Date().toISOString(),
                                estimatedDuration: duration || 30
                            };
                        }
                        return m;
                    });
                });
            }
        }

        try { 
            await dbUpdateItemStatus(orderId, itemIds, status, machineId, duration, totalKg); 
            
            // Si el estado enviado es ENTREGADO y todos los items de la orden están en ENTREGADO, actualizamos también el estado general del comprobante
            if (status === 'ENTREGADO') {
                const targetInv = invoices.find(inv => inv.id === orderId);
                if (targetInv) {
                    const tempItems = targetInv.items.map(it => itemIds.includes(it.id) ? { ...it, status } : it);
                    const activeItems = tempItems.filter(it => !((it as any).estado_id === 9 || (it.status as any) === 'ANULADO' || it.status === 'CANCELADO'));
                    const isAllDelivered = activeItems.length > 0 && activeItems.every(it => it.status === 'ENTREGADO');
                    if (isAllDelivered) {
                        try {
                            await dbUpdateInvoiceStatus(orderId, 'ENTREGADO');
                        } catch (err) {
                            console.warn("⚠️ No se pudo actualizar el estado de cabecera de la venta a ENTREGADO en la Base de Datos:", err);
                        }
                    }
                }
            }

            // After successful DB update, we can invalidate to ensure sync
            if (branchId) {
                queryClient.invalidateQueries({ queryKey: ['activeItems', branchId] });
                queryClient.invalidateQueries({ queryKey: ['machines', branchId] });
            }
        } catch (e) { 
            refreshData(true); 
        }
    };

    const handleUnifiedOrderActionOptimistic = async (orderId: string, payments: { amount: number, methodName: string }[], itemIds: string[], discount?: number) => {
        // 1. Actualización optimista inmediata en la UI
        setInvoices(prevInvs => prevInvs.map(inv => {
            if (inv.id === orderId) {
                const newItems = inv.items.map(it => itemIds.includes(it.id) ? { ...it, status: 'ENTREGADO' as OrderStatus } : it);
                const addedPayment = payments.reduce((sum, p) => sum + p.amount, 0);
                const newPrePayment = (inv.prePaymentAmount || 0) + addedPayment;
                
                // Verificar si todos los items activos están entregados
                const activeItems = newItems.filter(it => !((it as any).estado_id === 9 || (it.status as any) === 'ANULADO' || it.status === 'CANCELADO'));
                const isAllDelivered = activeItems.length > 0 && activeItems.every(it => it.status === 'ENTREGADO');
                
                const updates: any = { 
                    items: newItems, 
                    prePaymentAmount: newPrePayment,
                    descuento: discount !== undefined ? discount : inv.descuento
                };
                if (isAllDelivered) {
                    updates.orderStatus = 'ENTREGADO';
                    updates.entregado_at = new Date().toISOString();
                }
                
                return { 
                    ...inv, 
                    ...updates
                };
            }
            return inv;
        }));

        // 2. Persistencia asíncrona en segundo plano
        try {
            const tasks = [];
            if (discount !== undefined) tasks.push(dbUpdateInvoiceDiscount(orderId, discount));
            for (const p of payments) { tasks.push(dbAddPayment(orderId, p.amount, p.methodName, authSession?.user?.id, activeCashSession?.id)); }
            if (itemIds.length > 0) tasks.push(dbUpdateItemStatus(orderId, itemIds, 'ENTREGADO'));
            
            // Verificar si el estado final debería ser ENTREGADO en DB
            const targetInv = invoices.find(inv => inv.id === orderId);
            if (targetInv) {
                const tempItems = targetInv.items.map(it => itemIds.includes(it.id) ? { ...it, status: 'ENTREGADO' as OrderStatus } : it);
                const activeItems = tempItems.filter(it => !((it as any).estado_id === 9 || (it.status as any) === 'ANULADO' || it.status === 'CANCELADO'));
                const isAllDelivered = activeItems.length > 0 && activeItems.every(it => it.status === 'ENTREGADO');
                if (isAllDelivered) {
                    tasks.push(dbUpdateInvoiceStatus(orderId, 'ENTREGADO'));
                }
            }
            
            await Promise.all(tasks);
            // Sincronización final silenciosa
            refreshData(false);
        } catch (e) {
            console.error("Error en persistencia unificada:", e);
            // Revertir en caso de error crítico
            refreshData(true);
        }
    };

    const [selectedInvoiceForReceipt, setSelectedInvoiceForReceipt] = useState<Invoice | null>(null);
    const [isInvModalOpen, setIsInvModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);

    const handleCheckout = async (t: InvoiceType, client: Client, paymentMethodStr: string, deliveryDate?: string, notes?: string, prePayment?: number, discount?: number, customerPhotos: string[] = [], paymentsList: { methodName: string, amount: number }[] = [], cartOverride?: CartItem[], pickupOverride?: string, issueDate?: string): Promise<void> => {
        const finalCart = cartOverride || cart;
        const totals = calculateTotals(finalCart, activeSucursal.porcentajeIgv);
        const now = new Date().toISOString();
        const serie = t === InvoiceType.FACTURA ? activeSucursal.serieFactura : t === InvoiceType.BOLETA ? activeSucursal.serieBoleta : activeSucursal.serieNotaVenta;
        
        // Formatos de fecha y SUNAT
        const finalFechaEmision = issueDate 
            ? (issueDate.includes('T') ? issueDate : `${issueDate}T${getPeruDateTime().time}`) 
            : getPeruDateTime().iso;

        const localInvoiceTemplate: any = {
            sucursal_id: activeSucursal.id, 
            cliente_id: client.id, 
            totals: totals, 
            type: t, 
            date: now, 
            fecha_emision: finalFechaEmision,
            serie: serie, 
            orderStatus: 'RECIBIDO', 
            paymentMethod: paymentMethodStr, 
            prePaymentAmount: prePayment, 
            deliveryDate: deliveryDate, 
            notes: notes, 
            discount: discount || 0,
            origin: (pickupOverride || initialPickupForPos?.id) ? 'DELIVERY' : 'TIENDA',
            pickup_id: pickupOverride || initialPickupForPos?.id
        };

        try {
            const savedVenta = await dbCreateInvoice(localInvoiceTemplate, finalCart, activeSucursal, customerPhotos, paymentsList);
            
            // Solo limpiamos el carrito si la venta se guardó con éxito en la DB
            setCart([]);
            
            const finalInvoiceForReceipt: Invoice = {
                ...localInvoiceTemplate,
                id: savedVenta.id,
                client: client,
                items: [...finalCart],
                correlativo: savedVenta.correlativo,
                ordenNumber: savedVenta.codigo_orden,
                sunatStatus: t === InvoiceType.NOTA_VENTA ? 'INTERNAL' : 'PENDING',
                qrCodeData: `${activeSucursal.ruc}|${t}|${serie}|${savedVenta.correlativo}|${totals.igv.toFixed(2)}|${totals.total.toFixed(2)}|${finalFechaEmision}|${client.docType === 'RUC' ? '6' : '1'}|${client.docNumber}|`
            };
            
            // Trigger bot check-in on first sale of the day
            executeBotCheckIn();

            refreshData(false);
            setInitialPickupForPos(null);

            // Si es un documento electrónico (Boleta o Factura), intentar enviar a SUNAT inmediatamente en segundo plano
            if (t === InvoiceType.BOLETA || t === InvoiceType.FACTURA) {
                sendBillToSunat(finalInvoiceForReceipt, activeSucursal)
                    .then(async (sunatRes) => {
                        await dbUpdateSunatResponse(savedVenta.id, sunatRes);
                        checkAndSendRejectedAlert(finalInvoiceForReceipt, sunatRes);
                        // Refrescamos silenciosamente para que el historial refleje el éxito
                        refreshData(false);
                    })
                    .catch(e => console.error("Error envío SUNAT automático:", e));
            }

            // Trigger print directamente vía Iframe (más robusto para impresión en segundo plano)
            setTimeout(() => {
                printInvoiceDirectly(finalInvoiceForReceipt, activeSucursal, ticketConfig);
            }, 150);
        } catch (err) { console.error(err); throw err; }
    };

    const handleRetrySunat = async (invoice: Invoice) => {
        try {
            showStatusModal(`Re-intentando envío de ${invoice.serie}-${invoice.correlativo}...`, 'pending', 0);
            console.log("🔄 Re-intentando envío a SUNAT:", invoice.serie + "-" + invoice.correlativo);
            const sunatRes = await sendBillToSunat(invoice, activeSucursal);
            await dbUpdateSunatResponse(invoice.id, sunatRes);
            
            // OPTIMISTIC UPDATE: Actualizar localmente el estado del comprobante para evitar problemas de asincronía
            setInvoices(prevInvs => prevInvs.map(inv => 
                inv.id === invoice.id 
                    ? { 
                        ...inv, 
                        sunatStatus: (sunatRes.success ? 'ACCEPTED' : (sunatRes.isPending ? 'PENDING' : 'REJECTED')) as any,
                        sunatResponse: {
                            success: sunatRes.success,
                            description: sunatRes.description,
                            hash: sunatRes.hash,
                            pdfUrl: sunatRes.pdfUrl,
                            xmlUrl: sunatRes.xmlUrl,
                            cdrUrl: sunatRes.cdrUrl
                        }
                      } 
                    : inv
            ));

            if (sunatRes.success) {
                showStatusModal("✅ Comprobante aceptado por SUNAT con éxito.", 'success', 2000);
            } else {
                showStatusModal("❌ SUNAT respondió: " + sunatRes.description, 'error', 4000);
            }
            refreshData(false);
        } catch (e) {
            console.error(e);
            showStatusModal("Error al intentar conectar con el API de SUNAT", 'error', 4000);
        }
    };

    const handleVoidInvoice = async (invoice: Invoice, reason: string) => {
        try {
            showStatusModal(`Procesando Nota de Crédito para ${invoice.serie}-${invoice.correlativo}...`, 'pending', 0); // Duración 0 = permanecer abierto
            
            const isFactura = invoice.type === InvoiceType.FACTURA;
            const targetSerie = isFactura ? activeSucursal.serieNcFactura : activeSucursal.serieNcBoleta;
            
            const ncInvoice: any = {
                sucursal_id: activeSucursal.id,
                cliente_id: invoice.client.id,
                totals: invoice.totals,
                type: InvoiceType.NOTA_CREDITO,
                date: new Date().toISOString(),
                serie: targetSerie,
                orderStatus: 'RECIBIDO',
                notes: `ANULACION POR: ${reason.toUpperCase()}`,
                relatedDocument: {
                    serie: invoice.serie,
                    correlativo: invoice.correlativo,
                    type: invoice.type,
                    date: invoice.date
                }
            };

            const savedNc = await dbCreateInvoice(ncInvoice, invoice.items, activeSucursal);
            
            const finalNc: Invoice = {
                ...ncInvoice,
                id: savedNc.id,
                client: invoice.client,
                items: invoice.items,
                correlativo: savedNc.correlativo,
                sunatStatus: 'PENDING'
            };

            const sunatRes = await sendBillToSunat(finalNc, activeSucursal);
            
            // 1. Guardar respuesta SUNAT siempre (éxito o rechazo)
            await dbUpdateSunatResponse(savedNc.id, sunatRes);
            
            // 2. Vincular con documento original para bloquearlo
            // Lo hacemos antes de mostrar el éxito para asegurar consistencia
            try {
                await dbUpdateInvoice(invoice.id, {
                    status: 'anulado',
                    orderStatus: 'CANCELADO',
                    relatedNcId: savedNc.id,
                    notes: `${invoice.notes || ''} [NC ${targetSerie}-${savedNc.correlativo}: ${reason.toUpperCase()}]`.trim()
                });
            } catch (linkError) {
                console.error("Error vinculando NC con original, pero NC ya fue creada:", linkError);
            }
            
            if (sunatRes.success) {
                // Refrescar para asegurar que el estado persistente se cargue
                queryClient.invalidateQueries({ queryKey: ['invoices'] });
                
                showStatusModal(`✅ Nota de Crédito ${targetSerie}-${savedNc.correlativo} generada y aceptada.`, 'success', 3000);
            } else {
                showStatusModal(`⚠️ La Nota de Crédito fue rechazada por SUNAT: ${sunatRes.description}`, 'error', 5000);
            }
            
            // Refrescar datos para que desaparezca el botón de anular y se vea la marca de NC
            await refreshData(false);
        } catch (e: any) {
            console.error(e);
            showStatusModal(`Error al procesar: ${e.message || 'Falla en comunicación legal'}. Revise el historial.`, 'error', 5000);
            refreshData(true); // Forzar refresh profundo si falló algo crítico
        }
    };

    const handleSendDailySummary = async (pendingBoletas: Invoice[]) => {
        try {
            showStatusModal(`Enviando Resumen Diario (${pendingBoletas.length} boletas)...`, 'pending', 0);
            const res = await sendSummaryToSunat(pendingBoletas, activeSucursal);
            
            if (res.success) {
                // Actualizar todas las boletas a ACCEPTED con la descripción del resumen
                const sunatRes: SunatResponse = {
                    success: true,
                    description: res.description + (res.ticket ? ` - TICKET: ${res.ticket}` : ""),
                    hash: "RESUMEN-" + new Date().getTime(),
                    pdfUrl: res.pdfUrl,
                    xmlUrl: res.xmlUrl,
                    cdrUrl: res.cdrUrl
                };

                const updateTasks = pendingBoletas.map(inv => dbUpdateSunatResponse(inv.id, sunatRes));
                await Promise.all(updateTasks);
                
                showStatusModal(`✅ Resumen enviado con éxito. ${pendingBoletas.length} boletas procesadas.`, 'success', 2000);
                refreshData(false);
            } else {
                showStatusModal("❌ Error en Resumen Diario: " + res.description, 'error', 4000);
            }
        } catch (e) {
            console.error(e);
            showStatusModal("Error crítico al enviar resumen diario.", 'error', 4000);
        }
    };

    /**
     * Controlador optimista para la creación y edición de empleados.
     * Actualiza la UI inmediatamente y maneja reversiones en caso de error de persistencia.
     */
    const handleSaveEmployeeOptimistic = async (empData: Omit<Employee, 'id'>, id?: string) => {
        if (id) {
            // MODO EDICIÓN
            const originalEmployees = [...employees];
            setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...empData } : e));
            
            dbUpdateEmployee(id, empData)
                .then(() => refreshData(false))
                .catch(error => {
                    setEmployees(originalEmployees);
                    console.error("Error al actualizar empleado:", error);
                    alert("Error al actualizar: " + (error instanceof Error ? error.message : String(error)));
                });
            return Promise.resolve();
        }

        // MODO CREACIÓN
        const tempId = `temp-${Date.now()}`;
        const optimisticEmployee: Employee = { 
            ...empData, 
            id: tempId,
            isActive: true,
            permissions: empData.permissions || {}
        };
        
        // 1. Actualización optimista inmediata en la UI
        setEmployees(prev => [...prev, optimisticEmployee]);

        // 2. Persistencia asíncrona en segundo plano
        dbSaveEmployee(empData, undefined, authSession?.user?.holding_name)
            .then(() => {
                // Éxito: Sincronizamos con datos reales para obtener IDs de base de datos
                refreshData(false);
            })
            .catch(error => {
                // Fallo: Revertimos la UI y notificamos
                setEmployees(prev => prev.filter(e => e.id !== tempId));
                console.error("Rollback ejecutado - Fallo en persistencia de empleado:", error);
                const msg = error instanceof Error ? error.message : "No se pudo registrar al empleado en el servidor.";
                alert(`Error de persistencia: ${msg}. El cambio local ha sido revertido.`);
            });

        // Retornamos éxito inmediato para no bloquear el flujo de la vista
        return Promise.resolve();
    };

    const renderView = () => {
        const role = authSession?.user?.role;
        // Grupo CRUD: Todos los roles autenticados pueden realizar operaciones CRUD básicas (RLS protege la pertenencia)
        const canManageApp = !!role; 
        const isSaas = role === UserRole.SAAS_MASTER;

        const modId = currentView;
        const sucursalModCfg = activeSucursal?.modulos_config?.[modId];
        const onlyPromo = typeof sucursalModCfg === 'object' ? !!sucursalModCfg.onlyPromoVideo : false;

        if (onlyPromo) {
            const promoVideo = globalConfig?.defaultHelpVideos?.find(v => v.modulo_id === modId) || 
                               globalConfig?.defaultHelpVideos?.find(v => v.title === 'TODAS LAS FUNCIONES') ||
                               globalConfig?.defaultHelpVideos?.[0];

            return (
                <PromoVideoView promoVideo={promoVideo} modId={modId} activeSucursal={activeSucursal} />
            );
        }

        switch (currentView) {
            case 'view:dashboard': return <Dashboard invoices={invoices} expenses={expenses} products={products} clients={clients} categories={categories} paymentMethods={paymentMethods} company={activeSucursal} employees={employees} machines={machines} onNavigateToPos={() => navigateToPos()} onRefresh={() => refreshData(true)} />;
            case 'view:agenda': return <Agenda invoices={invoices} company={activeSucursal} />;
            case 'view:pos': return (
                <PointOfSale 
                    company={activeSucursal} 
                    products={products} 
                    clients={clients} 
                    onSearchClients={async (s) => {
                        const res = await dbGetClients(1, 15, s);
                        return res.clients;
                    }}
                    categories={categories} 
                    cart={cart} 
                    addToCart={(p, forceNew = false) => setCart(prev => { 
                        const existingIdx = !forceNew ? prev.findIndex(x => x.id === p.id) : -1; 
                        if (existingIdx !== -1) { 
                            const existingItem = prev[existingIdx]; 
                            const rawQty = existingItem.quantity + 1;
                            const subtotal = roundToOneDecimal(rawQty * existingItem.price);
                            const updatedItem = { ...existingItem, quantity: rawQty, subtotal }; 
                            return [updatedItem, ...prev.filter((_, i) => i !== existingIdx)]; 
                        } 
                        const newItem: CartItem = { 
                            ...p, 
                            id: forceNew ? `${p.id}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` : p.id,
                            producto_id: p.id,
                            quantity: 1, 
                            subtotal: roundToOneDecimal(p.price), 
                            originalPrice: p.price 
                        };
                        return [newItem, ...prev]; 
                    })} 
                    removeFromCart={(id) => setCart(prev => prev.filter(i => i.id !== id))} 
                    updateQuantity={(id, q) => setCart(prev => prev.map(i => i.id === id ? (() => {
                        const isWeightUnit = [UmSaas.KILO, UmSaas.METROS, UmSaas.LITRO].includes(i.um_saas as UmSaas);
                        const disc = i.descuento_unitario || 0;
                        const subtotal = roundToOneDecimal(q * Math.max(0, i.price - disc));
                        const finalQty = isWeightUnit ? q : Math.round(q);
                        return { ...i, quantity: finalQty, subtotal };
                    })() : i))} 
                    updatePrice={(id, p, d = 0) => setCart(prev => prev.map(i => i.id === id ? (() => {
                        const subtotal = roundToOneDecimal(i.quantity * Math.max(0, p - d));
                        return { ...i, price: p, descuento_unitario: d, subtotal };
                    })() : i))} 
                    updateDetails={(id, det, imgs, aud, date, newQty) => setCart(prev => prev.map(i => i.id === id ? (() => {
                        const q = newQty !== undefined ? newQty : i.quantity;
                        const disc = i.descuento_unitario || 0;
                        const subtotal = roundToOneDecimal(q * Math.max(0, i.price - disc));
                        const isWeightUnit = [UmSaas.KILO, UmSaas.METROS, UmSaas.LITRO].includes(i.um_saas as UmSaas);
                        const finalQty = isWeightUnit ? q : Math.round(q);
                        return { 
                            ...i, 
                            details: det, 
                            images: imgs, 
                            audioNote: aud, 
                            itemDeliveryDate: date,
                            quantity: finalQty,
                            subtotal: subtotal
                        };
                    })() : i))} 
                    onCheckout={(...args) => {
                        return new Promise((resolve) => {
                            checkCajaOpen(() => {
                                handleCheckout(...args).then(resolve);
                            });
                        });
                    }} 
                    onAddClient={async (c) => {
                        const saved = await dbCreateClient(c);
                        queryClient.invalidateQueries({ queryKey: ['clients'] });
                        return saved;
                    }} 
                    onOpenInventoryModal={() => { setIsInvModalOpen(true); }} 
                    paymentMethods={paymentMethods} 
                    initialPickupRequest={initialPickupForPos} 
                    onClearPickupRequest={() => setInitialPickupForPos(null)} 
                    isEditing={false} 
                    onUpdateOrder={async () => { }} 
                    onCancelEdit={() => { }} 
                    apiToken={globalConfig?.apiToken || ''} 
                    pausedSales={pausedSales} 
                    onPauseSale={async (s) => { 
                        const saved = await dbSavePausedSale(s); 
                        setCart([]); 
                        refreshData(false); 
                        return saved;
                    }} 
                    onResumeSale={async (s) => { setCart(s.cart); await dbDeletePausedSale(s.id); refreshData(false); }} 
                    onDeletePausedSale={async (id) => { await dbDeletePausedSale(id); refreshData(false); }} 
                    bannerCobro={globalConfig?.bannerCobro} 
                    canManage={canManageApp} 
                    ticketConfig={ticketConfig}
                />
            );
            case 'view:orders': return <MyOrders 
                invoices={invoices} 
                total={invoicesTotal} 
                currentPage={invoicesPage} 
                onPageChange={fetchInvoices} 
                onSearch={fetchInvoices} 
                company={activeSucursal!} 
                onUpdateStatus={dbUpdateInvoiceStatus} 
                onAddClient={dbCreateClient} 
                paymentMethods={paymentMethods} 
                clients={clients} 
                onUpdateItemStatus={handleUpdateItemStatusOptimistic} 
                onUnifiedAction={handleUnifiedOrderActionOptimistic} 
                canManage={canManageApp} 
                globalColors={globalConfig?.defaultColors || []} 
                ticketConfig={ticketConfig} 
                globalStats={globalOrderStats}
                currentUser={authSession?.user as any}
                onOpenWaCampaign={(contacts) => {
                    if (contacts) setWaContacts(contacts);
                    setWaActiveTab('reminder');
                    setCurrentView('view:wa_campaign');
                }}
                onConvertInvoice={handleConvertInvoice}
                onAddPayment={async (ventaId, amount, method) => { 
                checkCajaOpen(async () => {
                   // Pago optimista individual
                   setInvoices(prev => prev.map(inv => inv.id === ventaId ? { ...inv, prePaymentAmount: (inv.prePaymentAmount || 0) + amount } : inv));
                   try { await dbAddPayment(ventaId, amount, method, authSession?.user?.id, activeCashSession?.id); refreshData(false); } catch(e) { refreshData(true); }
                });
            }} />;
            case 'view:operations': return <Operations invoices={invoices} machines={machines} activeItems={activeItems} onUpdateItemStatus={handleUpdateItemStatusOptimistic} sucursal={activeSucursal} canManage={canManageApp} />;
            case 'view:cash_closing': return <CashClosingView invoices={invoices} expenses={expenses} currentUser={authSession?.user as any} company={activeSucursal} canManage={canManageApp} activeCashSession={activeCashSession} onSessionClosed={() => refetchCashSession()} />;
            case 'view:inventory': return <Inventory products={products} categories={categories} company={activeSucursal} onOpenModal={() => { setEditingProduct(null); setIsInvModalOpen(true); }} onEdit={(p) => { setEditingProduct(p); setIsInvModalOpen(true); }} onDelete={(id) => deleteProductMutation.mutate(id)} canCreate={canManageApp} canEdit={canManageApp} canDelete={canManageApp} />;
            case 'view:clients': return <Clients clients={clients} total={clientsTotal} currentPage={clientsPage} onPageChange={fetchClients} onSearch={fetchClients} company={activeSucursal!} onOpenModal={() => { setEditingClient(null); setIsClientModalOpen(true); }} onEdit={(c) => { setEditingClient(c); setIsClientModalOpen(true); }} onDelete={async (id) => { await dbDeleteClient(id); refreshData(true); }} canCreate={canManageApp} canEdit={canManageApp} canDelete={canManageApp} />;
            case 'view:employees': return <Employees 
                employees={employees} 
                onSave={handleSaveEmployeeOptimistic} 
                onDelete={async (id) => { await dbDeleteEmployee(id); refreshData(true); }} 
                onHardDelete={async (id) => { await dbHardDeleteEmployee(id); refreshData(true); }}
                onReactivate={async (id) => { await dbReactivateEmployee(id); refreshData(true); }}
                currentUserRole={authSession?.user?.role}
                company={activeSucursal}
                canManage={canManageApp}
            />;
            case 'view:expenses': return <Expenses expenses={expenses} company={activeSucursal} paymentMethods={paymentMethods} onSave={async (exp) => { 
                checkCajaOpen(async () => {
                    const newExpense = await dbSaveExpense({ ...exp, cash_session_id: activeCashSession?.id }); 
                    setExpenses(prev => [newExpense, ...prev]);
                    refreshData(false); 
                });
            }} onDelete={async (id) => { 
                await dbDeleteExpense(id); 
                setExpenses(prev => prev.filter(e => e.id !== id));
                refreshData(false); 
            }} canManage={canManageApp} />;
            case 'view:machines': return <Machines machines={machines} invoices={invoices} activeItems={activeItems} globalMachineImages={globalConfig?.defaultMachineImages} onAddMachine={async (m) => { await dbSaveMachine(m); refreshData(true); }} onUpdateMachineStatus={async (id, u) => { await dbUpdateMachine(id, u); refreshData(true); }} onSyncMachines={async () => { await dbSyncMachines(); refreshData(true); }} canManage={canManageApp} />;
            case 'view:callcenter': return <CallCenter apiToken={globalConfig?.apiToken || ''} onRefreshData={() => refreshData(true)} clients={clients} company={activeSucursal} invoices={invoices} />;
            case 'view:delivery': return <Delivery onConvertToOrder={(p) => { if (window.innerWidth >= 768) { navigateToPos(p); } else { setActivePickupForFastOrder(p); setIsFastOrderOpen(true); } }} company={activeSucursal} />;
            case 'view:logistics_hub': return <LogisticsHub currentUser={authSession?.user} />;
            case 'view:driver_pos': return <LogisticsDriverPOS onLogout={handleLogout} onConvertToOrder={(pickup) => { setActivePickupForFastOrder(pickup); setIsFastOrderOpen(true); }} />;
            case 'view:supplies': return <Supplies supplies={supplies} company={activeSucursal} onOpenModal={() => setIsSupplyModalOpen(true)} onDelete={async (id) => { await dbDeleteSupply(id); refreshData(true); }} canManage={canManageApp} />;
            case 'view:purchases': return <Purchases purchases={purchases} company={activeSucursal} onOpenModal={() => setIsPurchaseModalOpen(true)} canManage={canManageApp} />;
            case 'view:package_inventory': return <PackageInventory invoices={invoices} onUpdateStatus={dbUpdateInvoiceStatus} company={activeSucursal} />;
            case 'view:product_counting': return <ProductCounting authSession={authSession!} products={products} />;
            case 'view:loyalty': return <Loyalty company={activeSucursal} canManage={canManageApp} />;
            case 'view:memberships': return <Memberships company={activeSucursal} canManage={canManageApp} onSaveCompany={async (c) => { await dbUpdateSucursalConfig(c.id, c); setActiveSucursal({ ...c }); localStorage.setItem('sislav_active_sucursal', JSON.stringify(c)); refreshData(true); }} />;
            case 'view:bonus_points': return <BonusPoints company={activeSucursal} products={products} onSaveCompany={async (c) => { await dbUpdateSucursalConfig(c.id, c); setActiveSucursal({ ...c }); localStorage.setItem('sislav_active_sucursal', JSON.stringify(c)); refreshData(true); }} onUpdateProduct={(id, p) => { productMutation.mutate({ id, updates: p }); return Promise.resolve(); }} canManage={canManageApp} />;
            case 'view:promotions': {
                return <Promotions 
                    products={products} 
                    categories={categories} 
                    supplies={supplies} 
                    company={activeSucursal} 
                    onSavePromotion={(p) => { productMutation.mutate({ id: null, updates: p }); return Promise.resolve(); }} 
                    onUpdatePromotion={(id, p) => { productMutation.mutate({ id, updates: p }); return Promise.resolve(); }} 
                    onDeletePromotion={(id) => { deleteProductMutation.mutate(id); return Promise.resolve(); }} 
                    onSaveCompany={async (c) => { await dbUpdateSucursalConfig(c.id, c); setActiveSucursal({ ...c }); localStorage.setItem('sislav_active_sucursal', JSON.stringify(c)); refreshData(true); }} 
                    canCreateService={canManageApp}
                    canManageBanners={canManageApp}
                />;
            }
            case 'view:categories': return <Categories 
                categories={categories} 
                globalCatalog={globalConfig?.defaultCategoryImages} 
                primaryColor={activeSucursal?.primaryColor} 
                onSave={async (c) => { 
                    const saved = await dbSaveCategory(c); 
                    const newCat: Category = { 
                        id: saved.id, 
                        sucursal_id: saved.sucursal_id,
                        name: saved.nombre, 
                        isActive: saved.activo, 
                        imagen_id: saved.imagen_id,
                        imageUrl: categories.find(x => x.imagen_id === saved.imagen_id)?.imageUrl || undefined
                    };
                    setCategories(prev => [newCat, ...prev]);
                    refreshData(false); 
                }} 
                onUpdate={async (id, c) => { 
                    // Optimistic Update
                    setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...c } as Category : cat));
                    await dbUpdateCategory(id, c); 
                    refreshData(false); 
                }} 
                canManage={canManageApp} 
            />;
            case 'view:payment_methods': return <PaymentMethods methods={paymentMethods} globalPaymentCatalog={globalConfig?.defaultPaymentImages} onSave={async (pm) => { await dbSavePaymentMethod(pm); refreshData(true); }} onUpdate={async (id, pm) => { await dbUpdatePaymentMethod(id, pm); refreshData(true); }} canManage={canManageApp} />;
            case 'view:wa_campaign': return <WaCampaign 
                clients={clients} 
                company={activeSucursal} 
                globalContacts={waContacts} 
                setGlobalContacts={setWaContacts} 
                globalStatus={waStatus} 
                setGlobalStatus={setWaStatus} 
                globalTemplates={waTemplates} 
                setGlobalTemplates={setWaTemplates} 
                globalDelay={waDelay} 
                setGlobalDelay={setWaDelay} 
                globalImage={waGlobalImage} 
                setGlobalImage={setWaGlobalImage} 
                globalReminderMsg={waReminderMessageState} 
                setGlobalReminderMsg={setWaReminderMessageState} 
                globalReminderTemplates={waReminderTemplates} 
                setGlobalReminderTemplates={setWaReminderTemplates} 
                globalActiveTab={waActiveTab} 
                setGlobalActiveTab={setWaActiveTab}
                isSendingGlobal={isWaRemindersSending}
                setIsSendingGlobal={setIsWaRemindersSending}
                progressGlobal={waRemindersProgress}
                setProgressGlobal={setWaRemindersProgress}
                metricsGlobal={waRemindersMetrics}
                setMetricsGlobal={setWaRemindersMetrics}
            />;
            case 'view:wa_reminders': return <WaReminders 
                company={activeSucursal} 
                isSendingGlobal={isWaRemindersSending}
                setIsSendingGlobal={setIsWaRemindersSending}
                progressGlobal={waRemindersProgress}
                setProgressGlobal={setWaRemindersProgress}
                metricsGlobal={waRemindersMetrics}
                setMetricsGlobal={setWaRemindersMetrics}
            />;
            case 'view:reports': return <Reports expenses={expenses} invoices={invoices} clients={clients} company={activeSucursal} paymentMethods={paymentMethods} />;
            case 'view:my_reports': return <MyReports invoices={invoices} paymentMethods={paymentMethods} company={activeSucursal} />;
            case 'view:accounting': return <Accounting invoices={invoices} paymentMethods={paymentMethods} company={activeSucursal} />;
            case 'view:modificaciones': return <Modificaciones invoices={invoices} products={products} company={activeSucursal} paymentMethods={paymentMethods} onRefresh={() => refreshData(true)} canManage={canManageApp} checkCajaOpen={checkCajaOpen} />;
            case 'view:history': return <SalesHistory 
                invoices={invoices} 
                company={activeSucursal} 
                clients={clients} 
                onViewReceipt={(inv) => setSelectedInvoiceForReceipt(inv)} 
                onAddClient={dbCreateClient} 
                onConvertInvoice={handleConvertInvoice} 
                onVoidInvoice={handleVoidInvoice} 
                onRetrySunat={handleRetrySunat} 
                onSendSummary={handleSendDailySummary}
                ticketConfig={activeSucursal?.ticket_config}
            />;
            case 'view:owner_dashboard': return <OwnerDashboard session={authSession} isDarkMode={darkMode} toggleTheme={toggleDarkMode} onLogout={handleLogout} onSelectBranch={(b) => { 
                console.log("OWNER selecting branch:", b);
                const normalized = normalizeSucursal(b);
                const holdingId = normalized.empresa_holding_id 
                               || normalized.empresa_id 
                               || b.empresa_id;  // fallback directo al objeto original
                setActiveSucursal(normalized); 
                setDbBranchContext(normalized.id, holdingId); 
                setCurrentView('view:dashboard'); 
            }} />;
            case 'view:yape': return <YapeMonitor company={activeSucursal} />;
            case 'view:settings': return <Settings company={activeSucursal} setCompany={setActiveSucursal} user={authSession?.user} />;
            case 'DEV_CONFIG': 
                return authSession?.user?.role === UserRole.SAAS_MASTER ? (
                    <DevConfig 
                        onRefreshData={() => refreshData(true)} 
                        company={activeSucursal} 
                        onSaveCompany={async (c) => { 
                            await dbUpdateSucursalBranding(c.id || c.sucursal_id, c); 
                            const normalized = normalizeSucursal(c);
                            setActiveSucursal(normalized);
                            localStorage.setItem('sislav_active_sucursal', JSON.stringify(normalized));
                            setTimeout(() => refreshData(true), 500);
                        }} 
                    />
                ) : null;
            default: return <div className="p-10 text-center text-slate-400 font-bold uppercase text-xs">Módulo en construcción</div>;
        }
    };

    if (isResolving) {
        return <div className="h-screen bg-slate-900 flex flex-col items-center justify-center text-white"><Loader2 className="animate-spin mb-6 text-indigo-50" size={64} /><p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Sincronizando con la red SISLAV...</p></div>;
    }

    if (resolveError) {
        return <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6"><ShieldAlert className="text-rose-500 mb-4" size={64} /><h1 className="text-2xl font-bold uppercase">Acceso No Autorizado</h1><p className="text-slate-400 text-sm mt-2 text-center">{resolveError}</p><button onClick={() => window.location.href='/'} className="mt-8 bg-indigo-600 px-8 py-3 rounded-xl font-bold uppercase text-xs">Volver al Inicio</button></div>;
    }

    if (showMasterLogin && !isMasterMode) return <MasterLogin onLoginSuccess={(session) => {
        setAuthSession(session);
        localStorage.setItem('sislav_auth_session', JSON.stringify(session));
        setIsMasterMode(true);
        setShowMasterLogin(false);
    }} onCancel={() => setShowMasterLogin(false)} />;
    if (isMasterMode) {
        return (
            <Suspense fallback={<ModuleLoadingSkeleton />}>
                <SuperAdmin onLogout={handleLogout} onSelectTenant={handleSelectTenant} onSelectOwner={handleSelectOwner} />
            </Suspense>
        );
    }
    
    if (isOwnerPath && !authSession) {
        return <OwnerLogin 
            isDarkMode={darkMode} 
            toggleTheme={toggleDarkMode}
            onLogin={(session) => {
                setAuthSession(session);
                localStorage.setItem('sislav_auth_session', JSON.stringify(session));
                setCurrentView('view:owner_dashboard');
            }} 
        />;
    }

    if (authSession?.user?.role === UserRole.OWNER && currentView === 'view:owner_dashboard') {
        return (
            <Suspense fallback={<ModuleLoadingSkeleton />}>
                <OwnerDashboard 
                    session={authSession} 
                    isDarkMode={darkMode}
                    toggleTheme={toggleDarkMode}
                    onLogout={handleLogout} 
                    onSelectBranch={(b) => {
                        const normalized = normalizeSucursal(b);
                        const holdingId = normalized.empresa_holding_id 
                                       || normalized.empresa_id 
                                       || b.empresa_id;  // fallback directo al objeto original
                        
                        // Sincronización proactiva para dueños (Fix RLS)
                        if (authSession?.user) {
                            dbSyncOwnerProfile(
                                authSession.user.id, 
                                authSession.user.username, 
                                holdingId, 
                                authSession.user.holding_name || normalized.holding_name || ''
                            );
                        }

                        setActiveSucursal(normalized);
                        setDbBranchContext(normalized.id, holdingId);
                        setCurrentView('view:dashboard');
                    }} 
                />
            </Suspense>
        );
    }

    if (trackingId) return <Tracking id={trackingId} />;

    // INTERCEPTAR Y FORZAR ACTUALIZACIÓN DE CONTRASEÑA SI ES TEMPORAL
    if (authSession?.user?.isTempPasswordActive) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
                {/* Capas decorativas de luces ambientales */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                    <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-600 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-rose-600 rounded-full blur-[120px] animate-pulse delay-1000"></div>
                </div>

                <div className="max-w-md w-full relative z-10">
                    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-300">
                        <div className="h-2 w-full bg-gradient-to-r from-red-500 via-yellow-500 to-red-500 animate-pulse"></div>
                        
                        <div className="p-10 text-center">
                            <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                                <Lock size={28} className="text-red-400 animate-bounce" />
                            </div>

                            <h1 className="text-2xl font-black text-white uppercase tracking-tight text-center mb-2">
                                Actualizar Contraseña
                            </h1>
                            <p className="text-slate-400 text-xs text-center leading-relaxed mb-6">
                                Hola, <span className="font-extrabold text-indigo-400">{authSession.user.name.toUpperCase()}</span>. Has ingresado usando la contraseña momentánea enviada por WhatsApp. Por seguridad, debes cambiarla de inmediato por una nueva antes de entrar al sistema.
                            </p>

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (newPassword.length < 5) {
                                    setResetError('La contraseña debe tener al menos 5 caracteres.');
                                    return;
                                }
                                if (newPassword !== confirmPassword) {
                                    setResetError('La nueva contraseña y su confirmación no coinciden.');
                                    return;
                                }

                                setResetLoading(true);
                                setResetError('');

                                try {
                                    // 1. Ejecutar el cambio de clave en Supabase Auth
                                    const { error } = await supabase.auth.updateUser({
                                        password: newPassword,
                                        data: {
                                            temp_password_active: false,
                                            temp_password_expires_at: null
                                        }
                                    });

                                    if (error) throw error;

                                    // Guardar el hash local de concordancia en la tabla de usuarios_login por si fuera necesario
                                    try {
                                        await supabase
                                            .from('usuarios_login')
                                            .update({ password_hash: newPassword })
                                            .eq('id', authSession.user.id);
                                    } catch (dbErr) {
                                        console.warn("DB password_hash update bypassed:", dbErr);
                                    }

                                    // 2. Actualizar el estado para habilitar el dashboard
                                    const updatedSession = {
                                        ...authSession,
                                        user: {
                                            ...authSession.user,
                                            isTempPasswordActive: false
                                        }
                                    };
                                    setAuthSession(updatedSession);
                                    localStorage.setItem('sislav_auth_session', JSON.stringify(updatedSession));
                                    
                                } catch (err: any) {
                                    console.error("Error setting password:", err);
                                    setResetError(err.message || 'Ocurrió un error al establecer la nueva contraseña.');
                                } finally {
                                    setResetLoading(false);
                                }
                            }} className="space-y-5 text-left">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                                        Nueva Contraseña
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                        <input
                                            type="password"
                                            required
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            className="w-full bg-black/40 border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold text-sm text-center"
                                            placeholder="Ingresa tu nueva clave"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                                        Confirmación Nueva Contraseña
                                    </label>
                                    <div className="relative">
                                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            className="w-full bg-black/40 border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold text-sm text-center"
                                            placeholder="Ingresa tu nueva clave nuevamente"
                                        />
                                    </div>
                                </div>

                                {resetError && (
                                    <div className="text-red-400 text-[10px] font-bold uppercase text-center bg-red-500/10 p-4 rounded-xl border border-red-500/20 leading-relaxed font-sans">
                                        <AlertTriangle className="inline mr-1" size={12} /> {resetError}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={resetLoading}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
                                >
                                    {resetLoading ? (
                                        <Loader2 className="animate-spin" size={14} />
                                    ) : (
                                        'Establecer Contraseña y Entrar'
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all mt-2"
                                >
                                    Cerrar Sesión / Cancelar
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (authSession?.user?.role === UserRole.DELIVERY) {
        return <LogisticsDriverPOS 
            onLogout={handleLogout} 
            onConvertToOrder={(pickup) => {
                setActivePickupForFastOrder(pickup);
                setIsFastOrderOpen(true);
            }}
        />;
    }

    const params = new URLSearchParams(window.location.search);
    const isLogisticsMode = params.get('mode') === 'logistics';

    if (!authSession) {
        if (isLogisticsMode) {
            return <LogisticsLogin 
                sucursal={activeSucursal}
                onLogin={(session) => {
                    setAuthSession(session);
                    localStorage.setItem('sislav_auth_session', JSON.stringify(session));
                }} 
                isDarkMode={darkMode} 
                toggleTheme={toggleDarkMode} 
            />;
        }
        if (params.get('s')) {
            return <SaaSLogin sucursal={activeSucursal} onLogin={handleLogin} onGoToMasterLogin={() => setShowMasterLogin(true)} hideMasterAdmin={true} />;
        }
        if (isOwnerPath) {
            return <OwnerLogin onLogin={(session) => {
                setAuthSession(session);
                localStorage.setItem('sislav_auth_session', JSON.stringify(session));
            }} isDarkMode={darkMode} toggleTheme={toggleDarkMode} />;
        }
        // Si no hay sesión y no hay slug ni tracking, forzamos el Master Login
        if (!params.get('s') && !params.get('t') && !params.get('o')) {
            return <MasterLogin onLoginSuccess={(session) => {
                setAuthSession(session);
                localStorage.setItem('sislav_auth_session', JSON.stringify(session));
                setIsMasterMode(true);
                setShowMasterLogin(false);
            }} onCancel={() => setShowMasterLogin(false)} />;
        }
        
        // Si hay un slug pero el login falló o no cargó, mostramos login de la sucursal
        if (params.get('s') && !params.get('t')) {
            return <SaaSLogin sucursal={activeSucursal} onLogin={handleLogin} onGoToMasterLogin={() => setShowMasterLogin(true)} hideMasterAdmin={true} />;
        }
        
        // Si hay un tracking pero no se encontró la data, evitamos el login y mostramos una pantalla neutral o Tracking manejará su propio error
        if (params.get('t')) {
            return <Tracking id={params.get('t')!} />;
        }
    }
    if (!activeSucursal) {
        if (authSession?.user?.role === UserRole.SAAS_MASTER) {
            return (
                <Suspense fallback={<ModuleLoadingSkeleton />}>
                    <SuperAdmin onLogout={handleLogout} onSelectTenant={handleSelectTenant} onSelectOwner={handleSelectOwner} />
                </Suspense>
            );
        }
        if (authSession?.user?.role === UserRole.OWNER) {
            return (
                <Suspense fallback={<ModuleLoadingSkeleton />}>
                    <OwnerDashboard 
                        session={authSession} 
                        isDarkMode={darkMode}
                        toggleTheme={toggleDarkMode}
                        onLogout={handleLogout} 
                        onSelectBranch={(b) => {
                            console.log("OWNER selecting branch (initial):", b);
                            const normalized = normalizeSucursal(b);
                            const holdingId = normalized.empresa_holding_id 
                                           || normalized.empresa_id 
                                           || b.empresa_id;  // fallback directo al objeto original
                            
                            // Sincronización proactiva para dueños (Fix RLS)
                            if (authSession?.user) {
                                dbSyncOwnerProfile(
                                    authSession.user.id, 
                                    authSession.user.username, 
                                    holdingId, 
                                    authSession.user.holding_name || normalized.holding_name || ''
                                );
                            }

                            setActiveSucursal(normalized);
                            setDbBranchContext(normalized.id, holdingId);
                            setCurrentView('view:dashboard');
                        }} 
                    />
                </Suspense>
            );
        }
        return <MasterLogin onLoginSuccess={(session) => {
            setAuthSession(session);
            localStorage.setItem('sislav_auth_session', JSON.stringify(session));
            setIsMasterMode(true);
            setShowMasterLogin(false);
        }} onCancel={() => setShowMasterLogin(false)} />;
    }

    const handleViewChange = (view: string) => {
        if (view === 'view:pos') {
            navigateToPos();
            return;
        }

        if (view !== 'view:clients') {
            setClientsSearch('');
            setClientsPage(1);
        }
        if (view !== 'view:orders') {
            setInvoicesSearch('');
            setInvoicesPage(1);
        }
        setCurrentView(view);
        // Empujar al historial del navegador para soportar el botón atrás
        window.history.pushState({ view }, '');
    };

    return (
        <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans selection:bg-indigo-100 selection:text-indigo-900`}>
            <VersionGuard />
            <Layout 
            currentView={currentView} 
            setView={handleViewChange} 
            company={activeSucursal} 
            onLogout={handleLogout} 
            onRefresh={() => refreshData(true)}
            onBackToMaster={authSession?.user?.isMasterBypass ? () => setIsMasterMode(true) : undefined} 
            onBackToOwner={authSession?.user?.role === UserRole.OWNER ? () => {
                setActiveSucursal(null as any);
                setCurrentView('view:owner_dashboard');
            } : undefined}
            helpVideos={globalConfig?.defaultHelpVideos || []}
            globalModules={globalConfig?.globalModules}
            isOwner={authSession?.user?.role === UserRole.OWNER}
            isSaaSMaster={authSession?.user?.role === UserRole.SAAS_MASTER}
            sucursalModules={activeSucursal?.modulos_config}
            isDarkMode={darkMode}
            toggleTheme={toggleDarkMode}
            currentUser={authSession?.user}
            isCashOpen={!!activeCashSession}
            waRemindersProgress={waRemindersProgress}
            isWaRemindersSending={isWaRemindersSending}
            waRemindersMetrics={waRemindersMetrics}
        >
            {isLoadingData && <div className="absolute top-2 right-6 z-[100] flex items-center gap-2 bg-indigo-600 text-white px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest shadow-lg animate-pulse"><RefreshCw size={10} className="animate-spin" /> Sincronizando</div>}
            
            <div className="h-full overflow-hidden">
                <Suspense fallback={<ModuleLoadingSkeleton />}>
                    <motion.div
                        key={currentView}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="h-full w-full"
                    >
                        {renderView()}
                    </motion.div>
                </Suspense>
            </div>

            {showCobranzaModal && globalConfig?.bannerCobro && (
                <div className="fixed inset-0 bg-slate-950/90 z-[3000] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 border border-white/20">
                        <img src={globalConfig.bannerCobro} className="w-full h-full object-cover" alt="Cobranza" />
                        <div className="p-8 bg-slate-50 flex flex-col items-center gap-6">
                            <p className="text-slate-700 font-bold text-sm text-center uppercase leading-relaxed max-w-md">
                                Hola, el servicio esta bloqueado por tener un saldo pendiente. Favor de regularizar el pago al PLIN 931200353 OSNAR JHON OBREGON V. muchas gracias
                            </p>
                            {!isCobranzaBlocking && (
                                <button onClick={() => { setShowCobranzaModal(false); setHasClosedCobranza(true); }} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl">CERRAR AVISO</button>
                            )}
                            {isCobranzaBlocking && (
                                <div className="px-12 py-4 bg-red-600 text-white rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] shadow-xl animate-pulse">
                                    SISTEMA RESTRINGIDO POR PAGO PENDIENTE
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <InventoryModal 
                isOpen={isInvModalOpen} 
                onClose={() => setIsInvModalOpen(false)} 
                onSave={async (d) => { 
                    productMutation.mutate({ id: editingProduct?.id || null, updates: d });
                    setIsInvModalOpen(false);
                    setEditingProduct(null);
                }} 
                categories={categories} 
                company={activeSucursal} 
                supplies={supplies} 
                initialData={editingProduct}
            />
            <ClientModal 
                isOpen={isClientModalOpen} 
                onClose={() => { setIsClientModalOpen(false); setEditingClient(null); }} 
                onSave={async (c) => { 
                    await dbCreateClient(c); 
                    refreshData(true); 
                    setIsClientModalOpen(false); 
                    setEditingClient(null); 
                }} 
                apiToken={globalConfig?.apiToken || ''} 
                clientsList={clients} 
                initialData={editingClient} 
                onSearchDatabase={async (s) => {
                    const res = await dbGetClients(1, 15, s);
                    return res.clients;
                }}
            />
            <PurchaseModal isOpen={isPurchaseModalOpen} onClose={() => setIsPurchaseModalOpen(false)} onSave={async (p) => { await dbSavePurchase(p); refreshData(true); }} supplies={supplies} company={activeSucursal} />
            <SupplyModal isOpen={isSupplyModalOpen} onClose={() => setIsSupplyModalOpen(false)} onSave={async (s) => { await dbSaveSupply(s); refreshData(true); }} company={activeSucursal} />

            <CashOpeningModal 
                isOpen={isCashOpeningModalOpen} 
                onClose={() => { setIsCashOpeningModalOpen(false); setPendingAction(null); }}
                onConfirm={handleConfirmCashOpening}
                company={activeSucursal}
            />
            {isFastOrderOpen && activePickupForFastOrder && (
                <FastOrderTaker 
                    isOpen={isFastOrderOpen}
                    onClose={() => { setIsFastOrderOpen(false); setActivePickupForFastOrder(null); }}
                    products={products}
                    pickupRequest={activePickupForFastOrder}
                    company={activeSucursal}
                    paymentMethods={paymentMethods}
                    onConfirm={async (mobileCart, docType, paymentMethodStr) => {
                        let clie = clients.find(cl => cl.id === activePickupForFastOrder.cliente_id);
                        if (!clie) {
                            clie = await dbCreateClient({ 
                                name: activePickupForFastOrder.clientName, 
                                docNumber: '00000000', 
                                docType: '-', 
                                phone: activePickupForFastOrder.phone, 
                                address: activePickupForFastOrder.address, 
                                points: 0, 
                                sucursal_id: activeSucursal.id 
                            });
                        }
                        await handleCheckout(docType, clie, paymentMethodStr, undefined, undefined, 0, 0, [], [{ methodName: paymentMethodStr, amount: calculateTotals(mobileCart).total }], mobileCart, activePickupForFastOrder.id);
                    }}
                />
            )}

            {selectedInvoiceForReceipt && (
                <InvoiceReceipt 
                    invoice={selectedInvoiceForReceipt} 
                    company={activeSucursal} 
                    onClose={() => setSelectedInvoiceForReceipt(null)} 
                />
            )}
            <DebugOverlay />

            <AnimatePresence>
                {statusModal.isOpen && (
                    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-8 flex flex-col items-center max-w-sm w-full text-center pointer-events-auto"
                        >
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                                statusModal.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 
                                statusModal.type === 'error' ? 'bg-rose-50 text-rose-500' : 
                                'bg-amber-50 text-amber-500'
                            }`}>
                                {statusModal.type === 'success' ? <CheckCircle2 size={40} /> : 
                                 statusModal.type === 'error' ? <AlertTriangle size={40} /> : 
                                 <Loader2 size={40} className="animate-spin" />}
                            </div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">
                                {statusModal.type === 'success' ? 'Éxito' : 
                                 statusModal.type === 'error' ? 'Atención' : 
                                 'Procesando...'}
                            </h3>
                            <p className="text-slate-600 font-medium text-xs leading-relaxed">
                                {statusModal.message}
                            </p>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL DE CONFIRMACIÓN DE SALIDA */}
            {showExitConfirm && (
                <div className="fixed inset-0 bg-slate-950/80 z-[5000] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/20">
                        <div className="p-8 flex flex-col items-center text-center">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: `${activeSucursal?.color_primario || '#0054A6'}15` }}>
                                <ShieldAlert size={40} style={{ color: activeSucursal?.color_primario || '#0054A6' }} />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">¿Salir del Sistema?</h3>
                            <p className="text-slate-500 font-medium text-xs md:text-sm leading-relaxed mb-8">
                                Estás a punto de salir de la aplicación. Asegúrate de haber guardado todos tus cambios antes de continuar.
                            </p>
                            <div className="flex flex-col w-full gap-3">
                                <button 
                                    onClick={() => {
                                        setShowExitConfirm(false);
                                        // Intentamos cerrar o simplemente redirigir si el navegador lo permite
                                        window.location.href = "about:blank";
                                    }} 
                                    style={{ backgroundColor: activeSucursal?.color_primario || '#0054A6' }}
                                    className="w-full py-4 text-white rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg border-b-4 border-black/20"
                                >
                                    SÍ, SALIR AHORA
                                </button>
                                <button 
                                    onClick={() => setShowExitConfirm(false)} 
                                    className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all"
                                >
                                    CANCELAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
        </div>
    );
}

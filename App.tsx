
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    AuthSession, UserRole, Sucursal, Product, Client, Invoice, Category, 
    CartItem, InvoiceType, OrderStatus, SaasGlobalConfig, Machine, Expense, 
    Supply, Purchase, PaymentMethodConfig, PausedSale, Employee, 
    CampaignStatus, Contact, CampaignTemplate, PickupRequest, SunatResponse
} from './types';
import {
    dbGetSucursalBySlug, dbGlobalLogin, setDbBranchContext, getActiveBranchId, getActiveHoldingId, withTimeout,
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
    dbCreateInvoice,
    dbCreateClient,
    dbUpdateInvoiceStatus,
    dbConvertInvoice,
    dbDeleteClient,
    dbDeleteExpense,
    dbDeleteSupply,
    dbGetActiveCashClosing,
    dbOpenCashClosing,
    dbGetBirthdaysToday
} from './services/dbService';
import { getSaasGlobalConfig } from './services/saasService';
import { sendBillToSunat, sendSummaryToSunat } from './services/sunatService';
import { calculateTotals, formatOrderNumber, roundToOneDecimal } from './utils/calculations';
import { EvolutionService } from './services/evolutionService';
import { printInvoiceDirectly } from './utils/printService';
import SaaSLogin from './views/SaaSLogin';
import OwnerLogin from './views/OwnerLogin';
import OwnerDashboard from './views/OwnerDashboard';
import InvoiceReceipt from './components/InvoiceReceipt';
import Layout from './components/Layout';
import PointOfSale from './views/PointOfSale';
import MyOrders from './views/MyOrders';
import TenantSelector from './components/TenantSelector';
import MasterLogin from './views/MasterLogin';
import Dashboard from './views/Dashboard';
import Agenda from './views/Agenda';
import Tracking from './views/Tracking';
import Inventory from './views/Inventory';
import Clients from './views/Clients';
import Employees from './views/Employees';
import Accounting from './views/Accounting';
import Expenses from './views/Expenses';
import Machines from './views/Machines';
import CallCenter from './views/CallCenter';
import Delivery from './views/Delivery';
import Supplies from './views/Supplies';
import Purchases from './views/Purchases';
import Loyalty from './views/Loyalty';
import BonusPoints from './views/BonusPoints';
import Promotions from './views/Promotions';
import Categories from './views/Categories';
import PaymentMethods from './views/PaymentMethods';
import Reports from './views/Reports';
import Settings from './views/Settings';
import SalesHistory from './views/SalesHistory';
import YapeMonitor from './views/YapeMonitor';
import DevConfig from './views/DevConfig';
import { SuperAdmin } from './views/SuperAdmin';
import { Loader2, X, ShieldAlert } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './services/supabaseClient';
import { DebugOverlay } from './components/DebugOverlay';
import InventoryModal from './components/InventoryModal';
import ClientModal from './components/ClientModal';
import Operations from './views/Operations';
import WaCampaign from './views/WaCampaign';
import PackageInventory from './views/PackageInventory';
import LogisticsHub from './views/LogisticsHub';
import LogisticsDriverPOS from './views/LogisticsDriverPOS';
import LogisticsLogin from './views/LogisticsLogin';
import PurchaseModal from './components/PurchaseModal';
import SupplyModal from './components/SupplyModal';
import FastOrderTaker from './components/FastOrderTaker';
import CashClosingView from './views/CashClosing';
import ProductCounting from './views/ProductCounting';
import Modificaciones from './views/Modificaciones';

import CashOpeningModal from './components/CashOpeningModal';

const RefreshCw = ({ size, className }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
    </svg>
);

export default function App() {
    const queryClient = useQueryClient();
    
    const [trackingId, setTrackingId] = useState<string | null>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('t');
    });
    
    const [authSession, setAuthSession] = useState<AuthSession | null>(null);
    const [activeSucursal, setActiveSucursal] = useState<any | null>(null);
    const [globalConfig, setGlobalConfig] = useState<SaasGlobalConfig | null>(null);
    const [isResolving, setIsResolving] = useState(true);
    
    // CASH SESSION LOCK
    const { data: activeCashSession, refetch: refetchCashSession } = useQuery({
        queryKey: ['activeCashSession', authSession?.user?.id],
        queryFn: () => dbGetActiveCashClosing(),
        enabled: !!authSession?.user?.id && !!activeSucursal
    });

    const [isCashOpeningModalOpen, setIsCashOpeningModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    const checkCajaOpen = useCallback((action: () => void) => {
        // ADMIN EXCEPTION: Allow if current user is admin OR master
        const role = authSession?.user?.role;
        const isAdmin = role === UserRole.ADMIN || role === UserRole.SAAS_MASTER || role === UserRole.OWNER;
        
        if (isAdmin || activeCashSession) {
            action();
        } else {
            setPendingAction(() => action);
            setIsCashOpeningModalOpen(true);
        }
    }, [activeCashSession, authSession]);

    const handleConfirmCashOpening = async (amount: number, turno: string) => {
        await dbOpenCashClosing(amount, turno);
        await refetchCashSession();
        if (pendingAction) {
            pendingAction();
            setPendingAction(null);
        }
    };

    const refreshData = useCallback(async (manual: boolean = false) => {
        // Invalidate all queries
        queryClient.invalidateQueries();
        
        // REFRESH de Configuración de Sucursal (CRÍTICO para rotación de letras y cambios de SuperAdmin)
        if (activeSucursal?.id) {
            try {
                const refreshedSucursalData = await dbGetSucursalById(activeSucursal.id);
                if (refreshedSucursalData) {
                    setActiveSucursal(refreshedSucursalData);
                    localStorage.setItem('sislav_active_sucursal', JSON.stringify(refreshedSucursalData));
                }
            } catch (e) {
                console.error("Error refreshing sucursal data:", e);
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

    const [currentView, setCurrentView] = useState('view:pos');

    useEffect(() => {
        if (currentView === 'view:cash_closing') {
            setInvoicesSearch('');
            setInvoicesPage(1);
            // También egresos si tuviéramos búsqueda de egresos global
        }
    }, [currentView]);

    useEffect(() => {
        if (authSession) {
            if (authSession.user.role === UserRole.OWNER) setCurrentView('view:owner_dashboard');
            else if (authSession.user.role === UserRole.DELIVERY) setCurrentView('view:pos');
        }
    }, [authSession]);
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
            document.title = `${activeSucursal.razonSocial || 'SISLAV'} - CONTROL TOTAL`;
            
            // Priorizamos url_favicon para la identidad visual como App
            const iconUrl = activeSucursal.url_favicon || activeSucursal.url_logo || activeSucursal.logoUrl;
            
            if (iconUrl) {
                const head = document.getElementsByTagName('head')[0];
                
                // Favicon dinámico
                let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    head.appendChild(link);
                }
                link.href = iconUrl;

                // Apple Touch Icon (Crítico para "Instalar como App")
                let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
                if (!appleLink) {
                    appleLink = document.createElement('link');
                    appleLink.rel = 'apple-touch-icon';
                    head.appendChild(appleLink);
                }
                appleLink.href = iconUrl;

                // DYNAMIC MANIFEST (Branding nivel ultra-personalizado como APP)
                const manifest = {
                    "name": activeSucursal.razonSocial || "SISLAV - CONTROL TOTAL",
                    "short_name": activeSucursal.nombre_sucursal || "SISLAV",
                    "description": "Sistema de Control Total para Lavanderías",
                    "start_url": window.location.origin + window.location.pathname,
                    "display": "standalone",
                    "background_color": "#0d0f14",
                    "theme_color": activeSucursal.color_primario || "#4f8ef7",
                    "icons": [
                        {
                            "src": iconUrl,
                            "sizes": "192x192",
                            "type": "image/png",
                            "purpose": "any maskable"
                        },
                        {
                            "src": iconUrl,
                            "sizes": "512x512",
                            "type": "image/png",
                            "purpose": "any maskable"
                        }
                    ]
                };

                const stringManifest = JSON.stringify(manifest);
                const blob = new Blob([stringManifest], {type: 'application/json'});
                const manifestURL = URL.createObjectURL(blob);
                
                let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
                if (!manifestLink) {
                    manifestLink = document.createElement('link');
                    manifestLink.rel = 'manifest';
                    head.appendChild(manifestLink);
                }
                manifestLink.href = manifestURL;
            }
        }
    }, [activeSucursal]);

    const [products, setProducts] = useState<Product[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [clientsTotal, setClientsTotal] = useState(0);
    const [clientsPage, setClientsPage] = useState(1);
    const [clientsSearch, setClientsSearch] = useState('');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [invoicesTotal, setInvoicesTotal] = useState(0);
    const [invoicesPage, setInvoicesPage] = useState(1);
    const [invoicesSearch, setInvoicesSearch] = useState('');
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
    const [activePickupForFastOrder, setActivePickupForFastOrder] = useState<PickupRequest | null>(null);
    const [initialPickupForPos, setInitialPickupForPos] = useState<PickupRequest | null>(null);

    const [showCobranzaModal, setShowCobranzaModal] = useState(false);
    const [hasClosedCobranza, setHasClosedCobranza] = useState(false);

    const [waContacts, setWaContacts] = useState<Contact[]>([]);
    const [waStatus, setWaStatus] = useState<CampaignStatus>(CampaignStatus.IDLE);
    const [waTemplates, setWaTemplates] = useState<CampaignTemplate[]>([]);
    const [waDelay, setWaDelay] = useState(10);
    const [waGlobalImage, setWaGlobalImage] = useState('');
    const [waReminderMessage, setWaReminderMessage] = useState("Estimado usuario somos de la lavandería, su prenda esta lista no se olvide de recogerla.");
    const [waReminderTemplates, setWaReminderTemplates] = useState<CampaignTemplate[]>([]);
    const [waReminderMessageState, setWaReminderMessageState] = useState(waReminderMessage);
    const [waActiveTab, setWaActiveTab] = useState<'campaign' | 'reminder'>('campaign');

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
                        console.log("✅ Perfil obtenido:", profile.username);
                        const newSession: AuthSession = {
                            user: {
                                id: profile.id,
                                username: profile.username,
                                name: profile.nombre_completo,
                                role: profile.rol as UserRole,
                                holding_id: profile.empresa_id,
                                holding_name: profile.sucursales?.empresas_holding?.nombre_empresa,
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
                // OPTIMIZATION: Fetch global config but don't block if we have cache
                const cachedConfig = localStorage.getItem('sislav_global_config');
                const hasCachedConfig = !!cachedConfig;
                
                if (hasCachedConfig) {
                    setGlobalConfig(JSON.parse(cachedConfig));
                }

                const gConfigPromise = getSaasGlobalConfig();

                if (!hasCachedConfig) {
                    console.log("📦 Obteniendo configuración global (BLOQUEANTE)...");
                    const gConfig = await withTimeout<any>(gConfigPromise, 6000).catch(() => null);
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

                // PERSISTENCE: Session and Sucursal are now handled in useState initializers
                // but we still check for slug in URL which is a high priority override
                const params = new URLSearchParams(window.location.search);
                const slug = params.get('s');
                const ownerSlug = params.get('o');
                const tId = params.get('t');

                if (ownerSlug && window.location.pathname !== '/owner-login') {
                    // Eliminamos el replaceState que causaba 404 en refrescos si no estaba configurado en el servidor
                    // window.history.replaceState({}, '', '/owner-login' + window.location.search);
                }

                if (tId) {
                    setTrackingId(tId);
                }

                if (slug) {
                    const cleanSlug = slug.trim();
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

    const executeBotCheckIn = useCallback(async () => {
        if (!activeSucursal || !globalConfig) return;
        
        const todayStr = new Date().toISOString().split('T')[0];
        const storageKey = `sislav_bot_notified_${activeSucursal.id}_${todayStr}`;
        
        if (localStorage.getItem(storageKey)) return;

        const { url_bot, instancia_bot, apikey_bot, whatsapp_saas, whatsapp_cod_pais } = globalConfig;

        if (url_bot && instancia_bot && apikey_bot && whatsapp_saas) {
            try {
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
            } catch (err) {
                // Silent fail for monitoring check-in to avoid scary console errors
                // console.error("Bot Monitoring Check-in failed:", err);
            }
        }
    }, [activeSucursal, globalConfig]);

    useEffect(() => {
        if (activeSucursal) {
            const root = document.documentElement;
            root.style.setProperty('--brand-primary', activeSucursal.primaryColor || '#0054A6');
            root.style.setProperty('--brand-secondary', activeSucursal.secondaryColor || '#10B981');
            root.style.setProperty('--primary-color', activeSucursal.primaryColor || '#0054A6');
            document.title = activeSucursal.razonSocial || 'SISLAV';

            if (activeSucursal.cobranza && !hasClosedCobranza) {
                setShowCobranzaModal(true);
            }
        }
    }, [activeSucursal, hasClosedCobranza]);

    useEffect(() => {
        if (!activeSucursal?.id) return;
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
    }, [activeSucursal?.id]);

    // REAL-TIME SUBSCRIPTIONS
    useEffect(() => {
        const branchId = activeSucursal?.id;
        if (!branchId) return;

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
                    // Invalida y refetch inmediato de facturas y productos
                    queryClient.invalidateQueries({ queryKey: ['invoices'] });
                    queryClient.invalidateQueries({ queryKey: ['products'] });
                    
                    // Si es una inserción nueva, podemos sonar una alerta o refrescar globalmente
                    if (payload.eventType === 'INSERT') {
                        refreshData(true);
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
                    manifestLink.href = `/manifest.json?s=${activeSucursal.slug}`;
                }
            }
        }
    }, [activeSucursal]);

    // REACT QUERY HOOKS
    const { data: productsData, isLoading: isLoadingProducts } = useQuery({
        queryKey: ['products', activeSucursal?.id],
        queryFn: dbGetProducts,
        enabled: !!activeSucursal?.id,
    });

    const { data: clientsRes, isLoading: isLoadingClients } = useQuery({
        queryKey: ['clients', activeSucursal?.id, clientsPage, clientsSearch],
        queryFn: () => dbGetClients(clientsPage, 100, clientsSearch),
        enabled: !!activeSucursal?.id,
    });

    const { data: invoicesRes, isLoading: isLoadingInvoices } = useQuery({
        queryKey: ['invoices', activeSucursal?.id, invoicesPage, invoicesSearch],
        queryFn: () => dbGetInvoices(invoicesPage, 50, invoicesSearch),
        enabled: !!activeSucursal?.id,
    });

    const { data: orderStatsRes } = useQuery({
        queryKey: ['orderStats', activeSucursal?.id],
        queryFn: dbGetOrderStats,
        enabled: !!activeSucursal?.id,
        refetchInterval: 30000,
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
        enabled: !!activeSucursal?.id,
    });

    const { data: machinesData, isLoading: isLoadingMachines } = useQuery({
        queryKey: ['machines', activeSucursal?.id],
        queryFn: dbGetMachines,
        enabled: !!activeSucursal?.id,
        refetchInterval: 15000, // Refetch every 15s as fallback
    });

    const { data: activeItems = [] } = useQuery({
        queryKey: ['activeItems', activeSucursal?.id],
        queryFn: dbGetActiveItems,
        enabled: !!activeSucursal?.id,
        refetchInterval: 15000, // Refetch every 15s as fallback
    });

    const { data: expensesData, isLoading: isLoadingExpenses } = useQuery({
        queryKey: ['expenses', activeSucursal?.id],
        queryFn: () => dbGetExpenses(),
        enabled: !!activeSucursal?.id,
    });

    const { data: suppliesData, isLoading: isLoadingSupplies } = useQuery({
        queryKey: ['supplies', activeSucursal?.id],
        queryFn: dbGetSupplies,
        enabled: !!activeSucursal?.id,
    });

    const { data: purchasesData, isLoading: isLoadingPurchases } = useQuery({
        queryKey: ['purchases', activeSucursal?.id],
        queryFn: dbGetPurchases,
        enabled: !!activeSucursal?.id,
    });

    const { data: ticketConfig } = useQuery({
        queryKey: ['ticketConfig', activeSucursal?.id],
        queryFn: () => activeSucursal?.id ? dbGetTicketConfig(activeSucursal.id) : null,
        enabled: !!activeSucursal?.id,
    });

    const { data: paymentMethodsData, isLoading: isLoadingPaymentMethods } = useQuery({
        queryKey: ['paymentMethods', activeSucursal?.id],
        queryFn: dbGetPaymentMethods,
        enabled: !!activeSucursal?.id,
    });

    const { data: pausedSalesData, isLoading: isLoadingPausedSales } = useQuery({
        queryKey: ['pausedSales', activeSucursal?.id],
        queryFn: dbGetPausedSales,
        enabled: !!activeSucursal?.id,
    });

    const { data: employeesData, isLoading: isLoadingEmployees } = useQuery({
        queryKey: ['employees', activeSucursal?.id],
        queryFn: dbGetEmployees,
        enabled: !!activeSucursal?.id,
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

    const handleConvertInvoice = async (invoice: Invoice, targetType: InvoiceType, finalClient: Client) => {
        if (!activeSucursal) return;
        
        try {
            const serie = targetType === InvoiceType.FACTURA ? activeSucursal.serieFactura : activeSucursal.serieBoleta;
            
            // 1. Convertir en DB
            await dbConvertInvoice(invoice.id, targetType, serie, finalClient);
            
            // 2. Intentar envío a SUNAT
            const now = new Date().toISOString();
            const fullInvoice: Invoice = { 
                ...invoice, 
                type: targetType, 
                serie, 
                client: finalClient, 
                date: invoice.date, // Keep original sale date
                fecha_emision: now  // Set new emission date
            };
            const sunatRes = await sendBillToSunat(fullInvoice, activeSucursal);
            
            // 3. Actualizar respuesta de SUNAT en DB
            await dbUpdateSunatResponse(invoice.id, sunatRes);

            // 4. Alerta de rechazo
            checkAndSendRejectedAlert(fullInvoice, sunatRes);
            
            // 5. Refrescar datos
            await refreshData();
            
            alert(`Documento convertido exitosamente a ${targetType === InvoiceType.FACTURA ? 'FACTURA' : 'BOLETA'}`);
        } catch (error: any) {
            console.error("Error al convertir factura:", error);
            alert("Error al convertir el documento: " + error.message);
        }
    };

    const handleLogout = async () => {
        console.log("Iniciando cierre de sesión...");
        const wasBypass = authSession?.user?.isMasterBypass;
        
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
            const isLogistics = !!params.get('mode');
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
                return { ...inv, items: inv.items.map(it => itemIds.includes(it.id) ? { ...it, status } : it) };
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
                return { 
                    ...inv, 
                    items: newItems, 
                    prePaymentAmount: newPrePayment,
                    descuento: discount !== undefined ? discount : inv.descuento
                };
            }
            return inv;
        }));

        // 2. Persistencia asíncrona en segundo plano
        try {
            const tasks = [];
            if (discount !== undefined) tasks.push(dbUpdateInvoiceDiscount(orderId, discount));
            for (const p of payments) { tasks.push(dbAddPayment(orderId, p.amount, p.methodName, authSession?.user?.id)); }
            if (itemIds.length > 0) tasks.push(dbUpdateItemStatus(orderId, itemIds, 'ENTREGADO'));
            
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

    const handleCheckout = async (t: InvoiceType, client: Client, paymentMethodStr: string, deliveryDate?: string, notes?: string, prePayment?: number, discount?: number, customerPhotos: string[] = [], paymentsList: { methodName: string, amount: number }[] = [], cartOverride?: CartItem[], pickupOverride?: string): Promise<void> => {
        const finalCart = cartOverride || cart;
        const totals = calculateTotals(finalCart, activeSucursal.porcentajeIgv);
        const now = new Date().toISOString();
        const serie = t === InvoiceType.FACTURA ? activeSucursal.serieFactura : t === InvoiceType.BOLETA ? activeSucursal.serieBoleta : activeSucursal.serieNotaVenta;
        
        const localInvoiceTemplate: any = {
            sucursal_id: activeSucursal.id, 
            cliente_id: client.id, 
            totals: totals, 
            type: t, 
            date: now, 
            serie: serie, 
            orderStatus: 'RECIBIDO', 
            paymentMethod: paymentMethodStr, 
            prePaymentAmount: prePayment, 
            deliveryDate: deliveryDate, 
            notes: notes, 
            origin: (pickupOverride || initialPickupForPos?.id) ? 'DELIVERY' : 'TIENDA',
            pickup_id: pickupOverride || initialPickupForPos?.id
        };

        if (!cartOverride) setCart([]);

        try {
            const savedVenta = await dbCreateInvoice(localInvoiceTemplate, finalCart, activeSucursal, customerPhotos, paymentsList);
            const finalInvoiceForReceipt: Invoice = {
                ...localInvoiceTemplate,
                id: savedVenta.id,
                client: client,
                items: [...finalCart],
                correlativo: savedVenta.correlativo,
                ordenNumber: savedVenta.codigo_orden,
                sunatStatus: t === InvoiceType.NOTA_VENTA ? 'INTERNAL' : 'PENDING',
                qrCodeData: `${activeSucursal.ruc}|${t}|${serie}|${savedVenta.correlativo}|${totals.igv.toFixed(2)}|${totals.total.toFixed(2)}|${now.split('T')[0]}|${client.docType === 'RUC' ? '6' : '1'}|${client.docNumber}|`
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
            console.log("🔄 Re-intentando envío a SUNAT:", invoice.serie + "-" + invoice.correlativo);
            const sunatRes = await sendBillToSunat(invoice, activeSucursal);
            await dbUpdateSunatResponse(invoice.id, sunatRes);
            
            if (sunatRes.success) {
                alert("✅ Comprobante aceptado por SUNAT con éxito.");
            } else {
                alert("❌ SUNAT respondió: " + sunatRes.description);
            }
            refreshData(false);
        } catch (e) {
            console.error(e);
            alert("Error al intentar conectar con el API de SUNAT");
        }
    };

    const handleVoidInvoice = async (invoice: Invoice, reason: string) => {
        try {
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
                    type: invoice.type
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
            await dbUpdateSunatResponse(savedNc.id, sunatRes);
            
            if (sunatRes.success) {
                alert(`✅ Nota de Crédito ${targetSerie}-${savedNc.correlativo} generada y aceptada.`);
            } else {
                alert(`⚠️ La Nota de Crédito fue rechazada por SUNAT: ${sunatRes.description}`);
            }
            refreshData(false);
        } catch (e) {
            console.error(e);
            alert("Error al generar la Nota de Crédito legal.");
        }
    };

    const handleSendDailySummary = async (pendingBoletas: Invoice[]) => {
        try {
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
                
                alert(`✅ Resumen enviado con éxito. ${pendingBoletas.length} boletas procesadas.`);
                refreshData(false);
            } else {
                alert("❌ Error en Resumen Diario: " + res.description);
            }
        } catch (e) {
            console.error(e);
            alert("Error crítico al enviar resumen diario.");
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

        switch (currentView) {
            case 'view:dashboard': return <Dashboard invoices={invoices} expenses={expenses} products={products} clients={clients} categories={categories} paymentMethods={paymentMethods} company={activeSucursal} employees={employees} machines={machines} onNavigateToPos={() => setCurrentView('view:pos')} onRefresh={() => refreshData(true)} />;
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
                    addToCart={(p) => setCart(prev => { 
                        const existingIdx = prev.findIndex(x => x.id === p.id); 
                        if (existingIdx !== -1) { 
                            const existingItem = prev[existingIdx]; 
                            const updatedItem = { ...existingItem, quantity: existingItem.quantity + 1, subtotal: roundToOneDecimal((existingItem.quantity + 1) * existingItem.price) }; 
                            return [updatedItem, ...prev.filter((_, i) => i !== existingIdx)]; 
                        } 
                        return [{ ...p, quantity: 1, subtotal: roundToOneDecimal(p.price), originalPrice: p.price }, ...prev]; 
                    })} 
                    removeFromCart={(id) => setCart(prev => prev.filter(i => i.id !== id))} 
                    updateQuantity={(id, q) => setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: q, subtotal: roundToOneDecimal(q * i.price) } : i))} 
                    updatePrice={(id, p) => setCart(prev => prev.map(i => i.id === id ? { ...i, price: p, subtotal: roundToOneDecimal(i.quantity * p) } : i))} 
                    updateDetails={(id, det, imgs, aud, date) => setCart(prev => prev.map(i => i.id === id ? { ...i, details: det, images: imgs, audioNote: aud, itemDeliveryDate: date } : i))} 
                    onCheckout={(...args) => {
                        return new Promise((resolve) => {
                            checkCajaOpen(() => {
                                handleCheckout(...args).then(resolve);
                            });
                        });
                    }} 
                    onAddClient={dbCreateClient} 
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
                onAddPayment={async (ventaId, amount, method) => { 
                checkCajaOpen(async () => {
                   // Pago optimista individual
                   setInvoices(prev => prev.map(inv => inv.id === ventaId ? { ...inv, prePaymentAmount: (inv.prePaymentAmount || 0) + amount } : inv));
                   try { await dbAddPayment(ventaId, amount, method); refreshData(false); } catch(e) { refreshData(true); }
                });
            }} />;
            case 'view:operations': return <Operations invoices={invoices} machines={machines} activeItems={activeItems} onUpdateItemStatus={handleUpdateItemStatusOptimistic} sucursal={activeSucursal} canManage={canManageApp} />;
            case 'view:cash_closing': return <CashClosingView invoices={invoices} expenses={expenses} currentUser={authSession?.user as any} company={activeSucursal} canManage={canManageApp} activeCashSession={activeCashSession} onSessionClosed={() => refetchCashSession()} />;
            case 'view:inventory': return <Inventory products={products} categories={categories} company={activeSucursal} onOpenModal={() => { setEditingProduct(null); setIsInvModalOpen(true); }} onEdit={(p) => { setEditingProduct(p); setIsInvModalOpen(true); }} onDelete={async (id) => { await dbDeleteProduct(id); refreshData(true); }} canCreate={canManageApp} canEdit={canManageApp} canDelete={canManageApp} />;
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
                    await dbSaveExpense(exp); 
                    refreshData(false); 
                });
            }} onDelete={async (id) => { await dbDeleteExpense(id); refreshData(false); }} canManage={canManageApp} />;
            case 'view:machines': return <Machines machines={machines} invoices={invoices} activeItems={activeItems} globalMachineImages={globalConfig?.defaultMachineImages} onAddMachine={async (m) => { await dbSaveMachine(m); refreshData(true); }} onUpdateMachineStatus={async (id, u) => { await dbUpdateMachine(id, u); refreshData(true); }} onSyncMachines={async () => { await dbSyncMachines(); refreshData(true); }} canManage={canManageApp} />;
            case 'view:callcenter': return <CallCenter apiToken={globalConfig?.apiToken || ''} onRefreshData={() => refreshData(true)} clients={clients} company={activeSucursal} invoices={invoices} />;
            case 'view:delivery': return <Delivery onConvertToOrder={(p) => { if (window.innerWidth >= 768) { setInitialPickupForPos(p); setCurrentView('view:pos'); } else { setActivePickupForFastOrder(p); setIsFastOrderOpen(true); } }} company={activeSucursal} />;
            case 'view:logistics_hub': return <LogisticsHub />;
            case 'view:supplies': return <Supplies supplies={supplies} company={activeSucursal} onOpenModal={() => setIsSupplyModalOpen(true)} onDelete={async (id) => { await dbDeleteSupply(id); refreshData(true); }} canManage={canManageApp} />;
            case 'view:purchases': return <Purchases purchases={purchases} company={activeSucursal} onOpenModal={() => setIsPurchaseModalOpen(true)} canManage={canManageApp} />;
            case 'view:package_inventory': return <PackageInventory invoices={invoices} onUpdateStatus={dbUpdateInvoiceStatus} company={activeSucursal} />;
            case 'view:product_counting': return <ProductCounting authSession={authSession!} products={products} />;
            case 'view:loyalty': return <Loyalty company={activeSucursal} canManage={canManageApp} />;
            case 'view:bonus_points': return <BonusPoints company={activeSucursal} products={products} onSaveCompany={async (c) => { await dbUpdateSucursalConfig(c.id, c); setActiveSucursal({ ...c }); localStorage.setItem('sislav_active_sucursal', JSON.stringify(c)); refreshData(true); }} onUpdateProduct={async (id, p) => { await dbUpdateProduct(id, p); refreshData(true); }} canManage={canManageApp} />;
            case 'view:promotions': {
                return <Promotions 
                    products={products} 
                    categories={categories} 
                    supplies={supplies} 
                    company={activeSucursal} 
                    onSavePromotion={async (p) => { await dbSaveProduct(p); refreshData(true); }} 
                    onUpdatePromotion={async (id, p) => { await dbUpdateProduct(id, p); refreshData(true); }} 
                    onDeletePromotion={async (id) => { await dbDeleteProduct(id); refreshData(true); }} 
                    onSaveCompany={async (c) => { await dbUpdateSucursalConfig(c.id, c); setActiveSucursal({ ...c }); localStorage.setItem('sislav_active_sucursal', JSON.stringify(c)); refreshData(true); }} 
                    canCreateService={canManageApp}
                    canManageBanners={canManageApp}
                />;
            }
            case 'view:categories': return <Categories categories={categories} globalCatalog={globalConfig?.defaultCategoryImages} primaryColor={activeSucursal?.primaryColor} onSave={async (c) => { await dbSaveCategory(c); refreshData(true); }} onUpdate={async (id, c) => { await dbUpdateCategory(id, c); refreshData(true); }} canManage={canManageApp} />;
            case 'view:payment_methods': return <PaymentMethods methods={paymentMethods} globalPaymentCatalog={globalConfig?.defaultPaymentImages} onSave={async (pm) => { await dbSavePaymentMethod(pm); refreshData(true); }} onUpdate={async (id, pm) => { await dbUpdatePaymentMethod(id, pm); refreshData(true); }} canManage={canManageApp} />;
            case 'view:wa_campaign': return <WaCampaign clients={clients} company={activeSucursal} globalContacts={waContacts} setGlobalContacts={setWaContacts} globalStatus={waStatus} setGlobalStatus={setWaStatus} globalTemplates={waTemplates} setGlobalTemplates={setWaTemplates} globalDelay={waDelay} setGlobalDelay={setWaDelay} globalImage={waGlobalImage} setGlobalImage={setWaGlobalImage} globalReminderMsg={waReminderMessageState} setGlobalReminderMsg={setWaReminderMessageState} globalReminderTemplates={waReminderTemplates} setGlobalReminderTemplates={setWaReminderTemplates} globalActiveTab={waActiveTab} setGlobalActiveTab={setWaActiveTab} />;
            case 'view:reports': return <Reports expenses={expenses} invoices={invoices} clients={clients} company={activeSucursal} />;
            case 'view:accounting': return <Accounting invoices={invoices} paymentMethods={paymentMethods} company={activeSucursal} />;
            case 'view:modificaciones': return <Modificaciones invoices={invoices} products={products} company={activeSucursal} paymentMethods={paymentMethods} onRefresh={() => refreshData(true)} canManage={canManageApp} checkCajaOpen={checkCajaOpen} />;
            case 'view:history': return <SalesHistory invoices={invoices} company={activeSucursal} clients={clients} onViewReceipt={(inv) => setSelectedInvoiceForReceipt(inv)} onAddClient={dbCreateClient} onConvertInvoice={handleConvertInvoice} onVoidInvoice={handleVoidInvoice} onRetrySunat={handleRetrySunat} onSendSummary={handleSendDailySummary} />;
            case 'view:owner_dashboard': return <OwnerDashboard session={authSession} isDarkMode={darkMode} toggleTheme={toggleDarkMode} onLogout={handleLogout} onSelectBranch={(b) => { 
                const normalized = normalizeSucursal(b);
                setActiveSucursal(normalized); 
                setDbBranchContext(normalized.id, normalized.empresa_id); 
                setCurrentView('view:dashboard'); 
            }} />;
            case 'view:yape': return <YapeMonitor company={activeSucursal} />;
            case 'view:settings': return <Settings company={activeSucursal} setCompany={setActiveSucursal} />;
            case 'DEV_CONFIG': 
                return (
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
                );
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
    if (isMasterMode) return <SuperAdmin onLogout={handleLogout} onSelectTenant={handleSelectTenant} />;
    
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
        return <OwnerDashboard 
            session={authSession} 
            isDarkMode={darkMode}
            toggleTheme={toggleDarkMode}
            onLogout={handleLogout} 
            onSelectBranch={(b) => {
                const normalized = normalizeSucursal(b);
                setActiveSucursal(normalized);
                setDbBranchContext(normalized.id, normalized.empresa_id);
                setCurrentView('view:dashboard');
            }} 
        />;
    }

    if (trackingId) return <Tracking id={trackingId} />;

    if (authSession?.user?.role === UserRole.DELIVERY) {
        return <LogisticsDriverPOS onLogout={handleLogout} />;
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
            return <SuperAdmin onLogout={handleLogout} onSelectTenant={handleSelectTenant} />;
        }
        if (authSession?.user?.role === UserRole.OWNER) {
            return <OwnerDashboard 
                session={authSession} 
                isDarkMode={darkMode}
                toggleTheme={toggleDarkMode}
                onLogout={handleLogout} 
                onSelectBranch={(b) => {
                    const normalized = normalizeSucursal(b);
                    setActiveSucursal(normalized);
                    setDbBranchContext(normalized.id, normalized.empresa_id);
                    setCurrentView('view:dashboard');
                }} 
            />;
        }
        return <MasterLogin onLoginSuccess={(session) => {
            setAuthSession(session);
            localStorage.setItem('sislav_auth_session', JSON.stringify(session));
            setIsMasterMode(true);
            setShowMasterLogin(false);
        }} onCancel={() => setShowMasterLogin(false)} />;
    }

    const handleViewChange = (view: string) => {
        if (view !== 'view:clients') {
            setClientsSearch('');
            setClientsPage(1);
        }
        if (view !== 'view:orders') {
            setInvoicesSearch('');
            setInvoicesPage(1);
        }
        setCurrentView(view);
    };

    return (
        <Layout 
            currentView={currentView} 
            setView={handleViewChange} 
            company={activeSucursal} 
            onLogout={handleLogout} 
            onRefresh={() => refreshData(true)}
            onBackToMaster={authSession?.user?.isMasterBypass ? () => setIsMasterMode(true) : undefined} 
            helpVideos={globalConfig?.defaultHelpVideos || []}
            globalModules={globalConfig?.globalModules}
            isOwner={authSession?.user?.role === UserRole.OWNER}
            isSaaSMaster={authSession?.user?.role === UserRole.SAAS_MASTER}
            sucursalModules={activeSucursal?.modulos_config}
            isDarkMode={darkMode}
            toggleTheme={toggleDarkMode}
            currentUser={authSession?.user}
        >
            {isLoadingData && <div className="absolute top-2 right-6 z-[100] flex items-center gap-2 bg-indigo-600 text-white px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest shadow-lg animate-pulse"><RefreshCw size={10} className="animate-spin" /> Sincronizando</div>}
            
            <div className="h-full overflow-hidden">
                {renderView()}
            </div>

            {showCobranzaModal && globalConfig?.bannerCobro && (
                <div className="fixed inset-0 bg-slate-950/90 z-[3000] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 border border-white/20">
                        <img src={globalConfig.bannerCobro} className="w-full h-full object-cover" alt="Cobranza" />
                        <div className="p-8 bg-slate-50 flex flex-col items-center gap-6">
                            <p className="text-slate-600 font-bold text-sm text-center uppercase leading-relaxed max-w-md">
                                Estimado administrador, se ha detectado un saldo pendiente en su facturación. Regularice su situación para evitar la suspensión.
                            </p>
                            <button onClick={() => { setShowCobranzaModal(false); setHasClosedCobranza(true); }} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-xl">CERRAR AVISO</button>
                        </div>
                    </div>
                </div>
            )}

            <InventoryModal 
                isOpen={isInvModalOpen} 
                onClose={() => setIsInvModalOpen(false)} 
                onSave={async (d) => { 
                    if (editingProduct) {
                        await dbUpdateProduct(editingProduct.id, d);
                    } else {
                        await dbSaveProduct(d);
                    }
                    refreshData(true); 
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
        </Layout>
    );
}

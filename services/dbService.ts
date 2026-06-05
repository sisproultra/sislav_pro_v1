
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';
export { supabase };
import {
    AuthSession, UserRole, Product, Client, Invoice,
    OrderStatus, Category, Machine,
    PaymentMethodConfig, Expense, PickupRequest,
    Company, Supply, InvoiceType, UnitCode, IgvType, CartItem,
    CashClosing, MachineImage, StockMovement, StoreItem, Coupon, Purchase, PausedSale,
    ORDER_STATUS_MAP, Employee, GlobalColor, PromoBanner, ItemDetalle, SunatResponse, CampaignTemplate,
    InventoryCount, GuiaRemision, WaTemplate, WaTemplateCategory
} from '../types';
import { formatOrderNumber, getNextLetter, roundToOneDecimal } from '../utils/calculations';
import { fixEncoding } from '../utils/stringUtils';
import { getSaasGlobalConfig } from './saasService';

export const withTimeout = <T>(promise: any, timeoutMs: number = 15000): Promise<T> => {
    return Promise.race([
        promise as Promise<T>,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), timeoutMs)
        )
    ]);
};

let activeBranchId: string | null = null;
let activeHoldingId: string | null = null;
let activeUserId: string | null = null;

// --- SISTEMA DE CACHE ---
const queryCache = new Map<string, { data: any, timestamp: number }>();

/**
 * Obtiene la fecha y hora actual formateada para Perú (UTC-5)
 * Retorna un string ISO con el offset -05:00 para persistencia exacta
 */
export const getPeruTimestamp = () => {
    // Calculamos el offset de Perú (-5 horas)
    const now = new Date();
    const peruTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    return peruTime.toISOString().replace('Z', '-05:00');
};

const getCached = (key: string, ttlMs: number = 30000) => {
    // Desactivamos el caché manual en favor del cache unificado de React Query
    return null;
};

export const setCache = (key: string, data: any) => {
    // No-op: React Query gestiona la memoria y el caché de forma unificada
};

export const invalidateCache = (prefix: string) => {
    for (const key of Array.from(queryCache.keys())) {
        if (key.startsWith(prefix)) {
            queryCache.delete(key);
        }
    }
};

export const setDbBranchContext = (branchId: string, holdingId?: string, userId?: string) => {
    // console.log(`Setting DB Context - Branch: ${branchId}, Holding: ${holdingId}, User: ${userId}`);
    if (branchId) {
        activeBranchId = branchId;
        localStorage.setItem('sislav_active_branch_uuid', branchId);
    }
    if (holdingId) {
        activeHoldingId = holdingId;
        localStorage.setItem('sislav_active_holding_uuid', holdingId);
    }
    if (userId) {
        activeUserId = userId;
        localStorage.setItem('sislav_active_user_uuid', userId);
    }
};

export const getActiveBranchId = () => {
    const stored = localStorage.getItem('sislav_active_branch_uuid');
    if (stored) return stored;
    if (activeBranchId) return activeBranchId;
    
    // FALLBACK: Intentar recuperar de la sesión del usuario
    const sessionStr = localStorage.getItem('sislav_auth_session');
    if (sessionStr) {
        try {
            const parsed = JSON.parse(sessionStr);
            if (parsed?.user?.sucursal_id) {
                activeBranchId = parsed.user.sucursal_id;
                localStorage.setItem('sislav_active_branch_uuid', parsed.user.sucursal_id);
                return parsed.user.sucursal_id;
            }
        } catch (e) {}
    }

    // Fallback de respaldo desde el objeto de sucursal persistido
    const storedSucursal = localStorage.getItem('sislav_active_sucursal');
    if (storedSucursal) {
        try {
            const parsed = JSON.parse(storedSucursal);
            if (parsed?.id) {
                console.log("Recuperando BranchId desde fallback sucursal:", parsed.id);
                return parsed.id;
            }
        } catch (e) {}
    }
    return null;
};

export const getActiveHoldingId = () => {
    const stored = localStorage.getItem('sislav_active_holding_uuid');
    if (stored) return stored;
    if (activeHoldingId) return activeHoldingId;

    // FALLBACK: Intentar recuperar de la sesión del usuario
    const sessionStr = localStorage.getItem('sislav_auth_session');
    if (sessionStr) {
        try {
            const parsed = JSON.parse(sessionStr);
            const hid = parsed?.user?.holding_id || parsed?.user?.empresa_holding_id;
            if (hid) {
                activeHoldingId = hid;
                localStorage.setItem('sislav_active_holding_uuid', hid);
                return hid;
            }
        } catch (e) {}
    }

    // Fallback de respaldo desde el objeto de sucursal persistido
    const storedSucursal = localStorage.getItem('sislav_active_sucursal');
    if (storedSucursal) {
        try {
            const parsed = JSON.parse(storedSucursal);
            const hid = parsed?.empresa_id || parsed?.empresa_holding_id;
            if (hid) {
                console.log("Recuperando HoldingId desde fallback sucursal:", hid);
                return hid;
            }
        } catch (e) {}
    }
    return null;
};

export const getActiveUserId = () => {
    const stored = localStorage.getItem('sislav_active_user_uuid');
    if (stored) return stored;
    
    // FALLBACK: Intentar recuperar del objeto de sesión persistido
    const sessionStr = localStorage.getItem('sislav_auth_session');
    if (sessionStr) {
        try {
            const parsed = JSON.parse(sessionStr);
            if (parsed?.user?.id) {
                // Sincronizar para futuros accesos rápidos
                activeUserId = parsed.user.id;
                localStorage.setItem('sislav_active_user_uuid', parsed.user.id);
                return parsed.user.id;
            }
        } catch (e) {}
    }
    
    return activeUserId;
};

export const getActiveUserName = () => {
    return localStorage.getItem('sislav_current_user_name') || 'SISTEMA';
};

/**
 * Autenticación para usuarios operativos (Sucursal) usando Supabase Auth con correos virtuales
 */
export const dbGlobalLogin = async (username: string, pass: string, expectedSucursalId: string): Promise<AuthSession | null> => {
    const virtualEmail = `${username.trim().toLowerCase()}@sislav.com`;

    try {
        let authData: any = null;
        let profileData: any = null;

        // 1. Autenticación oficial en Supabase Auth
        const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
            email: virtualEmail,
            password: pass.trim(),
        });

        if (authError || !signInData.user) {
            console.error("Auth error:", authError?.message);
            return null;
        }

        // VERIFICAR CONTRASEÑA TEMPORAL Y SU EXPIRACIÓN (10 MINUTOS)
        const isTempActive = signInData.user.user_metadata?.temp_password_active === true;
        const tempExpiresAt = signInData.user.user_metadata?.temp_password_expires_at;
        
        if (isTempActive && tempExpiresAt) {
            if (Date.now() > tempExpiresAt) {
                await supabase.auth.signOut();
                throw new Error("EXPIRED_TEMP_PASSWORD: La contraseña temporal de 10 minutos ha expirado. Por favor, solicite una nueva de recuperación.");
            }
        }

        authData = signInData;

        // 2. Obtener perfil extendido de la tabla usuarios_login VALIDANDO LA SUCURSAL
        const { data: profile, error } = await withTimeout<any>(supabase
            .from('usuarios_login')
            .select('*, sucursales(*, empresas_holding(nombre_empresa))')
            .eq('id', authData.user.id)
            .maybeSingle()); // Primero obtenemos el perfil real para saber quién es

        if (error || !profile) {
            console.error("Usuario no encontrado en usuarios_login:", error?.message);
            await supabase.auth.signOut();
            return null;
        }

        // VALIDACIÓN DE PERTENENCIA A SUCURSAL O HOLDING
        if (profile.sucursal_id !== expectedSucursalId && profile.empresa_holding_id !== expectedSucursalId && profile.rol !== UserRole.SAAS_MASTER) {
            console.warn(`⛔ Acceso Denegado: El usuario ${profile.username} no pertenece a la sucursal/holding ${expectedSucursalId}`);
            await supabase.auth.signOut();
            throw new Error("ERROR: No pertenece a esta sucursal");
        }

        if (!profile.activo) {
            await supabase.auth.signOut();
            throw new Error("Usuario desactivado.");
        }

        profileData = profile;

        const data = profileData;
        const session: AuthSession = {
            user: {
                id: data.id,
                username: data.username,
                name: data.nombre_completo,
                role: data.rol as UserRole,
                holding_id: data.empresa_id,
                holding_name: data.sucursales?.empresas_holding?.nombre_empresa,
                sucursal_id: data.sucursal_id,
                isTempPasswordActive: isTempActive,
                sucursal_data: data.sucursales ? normalizeSucursal(data.sucursales) : null,
                permissions: data.permisos_map || data.permisos_json || {}
            }
        };
        
        setDbBranchContext(
            data.sucursal_id || expectedSucursalId, 
            data.empresa_id || data.empresa_holding_id, 
            data.id
        );

        localStorage.setItem('sislav_current_user_name', data.nombre_completo);
        localStorage.setItem('sislav_current_user_role', data.rol);

        return session;
    } catch (e) {
        console.error("Login exception:", e);
        throw e;
    }
};

/**
 * Autenticación para administradores maestros (SaaS)
 */
export const dbMasterAuth = async (user: string, pass: string): Promise<AuthSession | null> => {
    const virtualEmail = `${user.trim().toLowerCase()}@sislav.com`;
    const cleanPass = pass.trim();

    try {
        console.time(`⏱️ MasterAuth:${user.trim()}`);
        console.log(`🔐 Iniciando Master Auth para: ${user.trim()} (Timeout: 90s)`);
        
        let authData: any = null;
        let profileData: any = null;

        // 1. Autenticación oficial y única en Supabase Auth
        // Usamos un timeout extremadamente generoso de 90s para el entorno de preview
        console.log("⏳ Intentando Supabase Auth (signInWithPassword)...");
        const { data: signInData, error: authError } = await withTimeout<any>(
            supabase.auth.signInWithPassword({
                email: virtualEmail,
                password: cleanPass,
            }),
            90000
        ).catch(err => ({ data: null, error: { message: "Timeout crítico de red (90s) en autenticación" } }));

        if (authError) {
            console.error("❌ Error de Autenticación Oficial:", authError.message);
            console.timeEnd(`⏱️ MasterAuth:${user.trim()}`);
            throw authError;
        } else {
            if (!signInData?.user) {
                console.timeEnd(`⏱️ MasterAuth:${user.trim()}`);
                return null;
            }
            authData = signInData;
            console.log("✅ Auth oficial exitoso. Recuperando perfil con 'Fast Path' para admin...");

            // 2. Obtener perfil extendido validando el RLS
            // Para 'admin' en DEV, usamos un timeout muy corto (5s) para el perfil real, 
            // si falla, usamos el fallback inmediatamente para no hacer esperar al usuario.
            const isDev = import.meta.env.DEV === true;
            const isAdmin = user.trim().toLowerCase() === 'admin';
            const profileTimeout = (isDev && isAdmin) ? 5000 : 90000;

            const { data: profile, error: profileError } = await withTimeout<any>(
                supabase
                    .from('usuarios_login')
                    .select('*')
                    .eq('id', authData.user.id)
                    .eq('rol', UserRole.SAAS_MASTER)
                    .eq('activo', true)
                    .maybeSingle(),
                profileTimeout
            ).catch(() => ({ data: null, error: { message: "Timeout recuperando perfil" } }));

            if (profileError || !profile) {
                console.error("❌ Error al recuperar perfil o usuario no autorizado:", profileError?.message);
                await supabase.auth.signOut();
                console.timeEnd(`⏱️ MasterAuth:${user.trim()}`);
                return null;
            } else {
                profileData = profile;
            }
        }

        const data = profileData;
        console.timeEnd(`⏱️ MasterAuth:${user.trim()}`);
        const session: AuthSession = {
            user: {
                id: data.id,
                username: data.username,
                name: data.nombre_completo,
                role: data.rol as UserRole,
                holding_id: data.empresa_id || data.holding_id,
                sucursal_id: data.sucursal_id,
                isMasterBypass: data.isMasterBypass || false,
                masterPassword: cleanPass,
                permissions: data.permisos_map || data.permisos_json || {}
            }
        };
        
        // Establecer contexto y persistencia estándar
        setDbBranchContext('', '', session.user.id);
        localStorage.setItem('sislav_current_user_name', session.user.name);
        localStorage.setItem('sislav_current_user_role', session.user.role);
        localStorage.setItem('sislav_auth_session', JSON.stringify(session));
        localStorage.setItem('sislav_master_token_fallback', cleanPass);

        console.log("✅ Autenticación maestra completada exitosamente.");
        return session;
    } catch (e: any) {
        console.error("Master Login Exception:", e.message || e);
        throw e; // Propagamos el error para que la UI lo maneje
    }
};

/**
 * Autenticación para dueños de holding (Bypass DEV incluido)
 */
/**
 * Sincroniza proactivamente el perfil del dueño en usuarios_login para asegurar que RLS funcione.
 */
export const dbSyncOwnerProfile = async (userId: string, email: string, holdingId: string, holdingName: string) => {
    try {
        const { data: existing } = await supabase.from('usuarios_login').select('id').eq('id', userId).maybeSingle();
        if (!existing) {
            console.log("🔄 Sincronización proactiva de perfil de dueño...");
            await supabase.rpc('create_user_profile', {
                p_id: userId,
                p_auth_user_id: userId,
                p_sucursal_id: null,
                p_empresa_id: holdingId,
                p_nombre_completo: holdingName,
                p_username: email,
                p_rol: UserRole.OWNER,
                p_telefono: null,
                p_url_foto: null,
                p_permisos_json: { all: true, owner: true },
                p_password_hash: '',
                p_nombre_empresa: holdingName
            });
        }
    } catch (e) {
        console.warn("Error en sincronización proactiva:", e);
    }
};

export const dbOwnerAuth = async (email: string, pass: string): Promise<AuthSession | null> => {
    try {
        let authData: any = null;
        let companyData: any = null;

        console.log(`🔐 Intentando Supabase Auth para: ${email.trim()}`);
        const { data, error: authError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: pass.trim(),
        });

        if (authError) {
            console.error("❌ Error en Supabase Auth:", authError.message);
            if (authError.message.includes("Email not confirmed")) {
                throw new Error("El correo no ha sido confirmado. Por favor, desactive 'Confirm Email' en el Dashboard de Supabase (Authentication -> Providers -> Email).");
            }
            throw authError;
        }
        if (!data.user) throw new Error("No se pudo recuperar el usuario de la sesión.");
        authData = data;

        console.log("👤 Auth exitoso, buscando empresa vinculada...");
        const { data: company, error: companyError } = await supabase
            .from('empresas_holding')
            .select('*')
            .eq('correo_login', email.trim())
            .maybeSingle();

        if (companyError) {
            console.error("❌ Error buscando empresa:", companyError.message);
        }

        if (!company) {
            console.warn("⚠️ No se encontró empresa vinculada a este correo en empresas_holding.");
            await supabase.auth.signOut();
            throw new Error("Se autenticó correctamente, pero este correo no está vinculado a ninguna empresa en la base de datos.");
        }
        
        console.log("✅ Empresa encontrada:", company.nombre_empresa);
        companyData = company;

        // --- SINCRONIZACIÓN DE PERFIL PARA RLS ---
        // Muchos sistemas usan usuarios_login como fuente de verdad para RLS.
        // Si el dueño no está ahí, el RLS le devolverá 0 filas en todas las consultas.
        try {
            const { data: existingProfile } = await supabase
                .from('usuarios_login')
                .select('id')
                .eq('id', authData.user.id)
                .maybeSingle();

            if (!existingProfile) {
                console.log("🔄 Sincronizando perfil de dueño en usuarios_login para habilitar RLS...");
                await supabase.rpc('create_user_profile', {
                    p_id: authData.user.id,
                    p_auth_user_id: authData.user.id,
                    p_sucursal_id: null,
                    p_empresa_id: companyData.id,
                    p_nombre_completo: companyData.nombre_empresa,
                    p_username: email,
                    p_rol: UserRole.OWNER,
                    p_telefono: companyData.telefono || null,
                    p_url_foto: null,
                    p_permisos_json: { all: true, owner: true },
                    p_password_hash: '',
                    p_nombre_empresa: companyData.nombre_empresa
                });
                console.log("✅ Perfil de dueño sincronizado.");
            }
        } catch (syncErr) {
            console.warn("⚠️ Advertencia en sincronización de perfil (Dueño):", syncErr);
        }

        const session: AuthSession = {
            user: {
                id: authData.user.id,
                username: email,
                name: companyData.nombre_empresa,
                role: UserRole.OWNER,
                holding_id: companyData.id,
                holding_name: companyData.nombre_empresa,
                sucursal_id: undefined
            }
        };

        localStorage.setItem('sislav_auth_session', JSON.stringify(session));
        
        // Establecer contexto global para el dueño
        setDbBranchContext('', companyData.id, authData.user.id);

        return session;
    } catch (e) {
        console.error("Owner Login Exception:", e);
        throw e;
    }
};

const ensureHoldingId = async (branchId: string): Promise<string> => {
    let hid = getActiveHoldingId();
    // console.log(`Ensuring HoldingId for Branch: ${branchId}, Current: ${hid}`);
    if (!hid && branchId) {
        const { data } = await supabase.from('sucursales').select('empresa_id').eq('id', branchId).maybeSingle();
        if (data?.empresa_id) {
            hid = data.empresa_id;
            console.log(`Found missing HoldingId in DB: ${hid}`);
            setDbBranchContext(branchId, hid);
        }
    }
    if (!hid) {
        console.error("Contexto de Holding no detectado para branch:", branchId);
        throw new Error("Contexto de Holding no detectado. Re-inicie sesión.");
    }
    return hid;
};

export const normalizeRelation = (data: any) => {
    if (Array.isArray(data)) return data[0] || null;
    return data || null;
};

export const dbGetHoldingBranding = async (holdingId: string) => {
    const { data, error } = await supabase
        .from('empresas_holding')
        .select('*')
        .eq('id', holdingId)
        .maybeSingle();

    if (error || !data) return null;

    // Convert to branding format compatible with LogisticsLogin
    return {
        id: data.id,
        nombre_sucursal: data.nombre_comercial || data.nombre_empresa,
        nombre_comercial: data.nombre_comercial,
        url_logo: data.url_logo,
        url_favicon: data.url_favicon,
        url_favicon_logistica: data.url_favicon_logistica,
        color_primario: data.color_primario,
        color_secundario: data.color_secundario
    };
};

export const normalizeSucursal = (s: any): any => {
    if (!s) return null;
    const name = s.nombre_sucursal ?? s.name ?? 'SISLAV SUCURSAL';
    const primary = s.color_primario ?? s.primaryColor ?? '#0054A6';
    const secondary = s.color_secundario ?? s.secondaryColor ?? '#10B981';
    const holdingName = s.empresas_holding?.nombre_empresa || s.holding_name;

    return {
        id: s.id,
        sucursal_id: s.id,
        empresa_id: s.empresa_id || s.empresa_holding_id,
        empresa_holding_id: s.empresa_id || s.empresa_holding_id,
        slug: s.slug,
        razonSocial: name,
        nombre_sucursal: name,
        primaryColor: primary,
        secondaryColor: secondary,
        color_primario: primary,
        color_secundario: secondary,
        logoUrl: s.url_logo ?? s.logoUrl,
        url_logo: s.url_logo ?? s.logoUrl,
        url_favicon: s.url_favicon ?? s.faviconUrl,
        direccion: s.direccion ?? s.address ?? '-',
        address: s.direccion ?? s.address ?? '-',
        ruc: s.ruc ?? '00000000000',
        nombre_comercial: s.nombre_comercial || '',
        urbanizacion: s.urbanizacion || '',
        distrito: s.distrito || '',
        provincia: s.provincia || '',
        departamento: s.departamento || '',
        ubigeo: s.ubigeo || '',
        contactPhone: s.telefono || s.telefono_contacto || '',
        sunatEnvironment: String(s.modo_sunat) === '1' ? 'PRODUCTION' : (String(s.modo_sunat) === '0' ? 'BETA' : 'INTERNAL'),
        serieBoleta: s.serie_boleta ?? 'B001',
        serieFactura: s.serie_factura ?? 'F001',
        serieNotaVenta: s.serie_nv ?? 'NV01',
        serieNcFactura: s.serie_nc_factura ?? 'FC01',
        serieNcBoleta: s.serie_nc_boleta ?? 'BC01',
        orderZerosCount: s.order_zeros_count ?? s.orderZerosCount ?? 7,
        useOrderSuffix: s.use_order_suffix ?? s.useOrderSuffix ?? false,
        orderCurrentSuffix: s.prefijo_sufijo ?? s.order_current_suffix ?? s.orderCurrentSuffix ?? 'A',
        prefijo_sufijo: s.prefijo_sufijo ?? s.order_current_suffix ?? s.orderCurrentSuffix ?? 'A',
        orderSuffixPosition: s.order_suffix_position ?? s.orderSuffixPosition ?? 'AFTER',
        use_order_reset: s.use_order_reset ?? s.useOrderReset ?? false,
        limite_reconteo: s.limite_reconteo ?? s.limitReconteo ?? 10000,
        sunat_url: s.sunat_url,
        solUser: s.sol_user ?? s.solUser ?? 'MODDATOS',
        solPass: s.sol_pass ?? s.solPass ?? 'moddatos',
        firmaPass: s.firma_pass ?? s.firmaPass ?? '',
        whatsapp_instance: s.whatsapp_instance,
        whatsapp_token: s.whatsapp_token,
        whatsapp_instance_name: s.whatsapp_instance_name,
        yape_tenant_id: s.yape_tenant_id,
        pointsEquivalency: s.puntos_equivalencia ?? 10,
        yapeTenantId: s.yape_tenant_id,
        activo: s.activo ?? s.isActive,
        holding_name: holdingName,
        cobranza: s.cobranza ?? false,
        cobranza_activada_at: s.cobranza_activada_at,
        porcentajeIgv: s.porcentaje_igv ?? 18.00,
        moneda_simbolo: s.moneda_simbolo ?? 'S/',
        currencySymbol: s.moneda_simbolo ?? 'S/',
        modulos_config: s.modulos_config ?? {},
        doc_enforce_enabled: s.doc_enforce_enabled ?? false,
        doc_enforce_threshold: s.doc_enforce_threshold ?? 700,
        cash_management_type: s.cash_management_type || 'DAILY'
    };
};

export const dbGetSucursalBySlug = async (slug: string): Promise<any> => {
    try {
        console.log(`🔍 [dbGetSucursalBySlug] Buscando sucursal: ${slug}`);
        const { data, error } = await withTimeout<any>(
            supabase
                .from('sucursales')
                .select('*, empresas_holding(nombre_empresa)')
                .eq('slug', slug)
                .maybeSingle(),
            10000
        );
        
        if (error) {
            console.error(`❌ Error resolviendo sucursal '${slug}':`, error.message);
            // Intento de fallback sin join por si es un tema de RLS en la tabla relacionada
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('sucursales')
                .select('*')
                .eq('slug', slug)
                .maybeSingle();
            
            if (fallbackError) {
                console.error(`❌ Fallback también falló para '${slug}':`, fallbackError.message);
                return null;
            }
            if (!fallbackData) {
                console.warn(`⚠️ No se encontró la sucursal '${slug}' en el fallback.`);
                return null;
            }
            console.log(`✅ Sucursal '${slug}' encontrada vía fallback.`);
            return normalizeSucursal(fallbackData);
        }

        if (!data) {
            console.warn(`⚠️ No se encontró la sucursal '${slug}' (Data es null).`);
            // Intento final vía RPC si existe o consulta ultra-simple
            const { data: finalData } = await supabase.from('sucursales').select('id, slug, nombre_sucursal').eq('slug', slug).maybeSingle();
            if (finalData) {
                console.log(`✅ Sucursal '${slug}' encontrada vía consulta ultra-simple.`);
                return dbGetSucursalById(finalData.id);
            }
            return null;
        }

        console.log(`✅ Sucursal '${slug}' encontrada exitosamente.`);
        return normalizeSucursal(data);
    } catch (e: any) {
        console.error(`❌ Excepción resolviendo sucursal '${slug}':`, e.message);
        return null;
    }
};

export const dbGetSucursalById = async (id: string): Promise<any> => {
    const { data, error } = await supabase
        .from('sucursales')
        .select('*, empresas_holding(nombre_empresa)')
        .eq('id', id)
        .maybeSingle();
    if (error || !data) return null;
    return normalizeSucursal(data);
};

/**
 * Registra un error del sistema en la base de datos para auditoría y diagnóstico.
 */
export const dbLogSystemError = async (message: string, details?: any) => {
    try {
        const branchId = getActiveBranchId();
        const userId = getActiveUserId();
        
        const { error } = await supabase
            .from('logs_sistema')
            .insert({
                sucursal_id: branchId,
                usuario_id: userId,
                mensaje: message,
                detalles: details,
                fecha: new Date().toISOString()
            });
            
        if (error) console.warn("⚠️ No se pudo persistir el log en DB:", error.message);
    } catch (e) {
        // Fallback silencioso para no interrumpir el flujo del usuario
    }
};
export const dbUploadImage = async (bucket: string, file: File | string | Blob, path: string): Promise<string> => {
    let body: any = file;
    if (typeof file === 'string' && file.startsWith('data:')) {
        const res = await fetch(file);
        body = await res.blob();
    }
    
    const { error } = await supabase.storage.from(bucket).upload(path, body, { upsert: true });
    if (error) {
        console.error(`Error uploading to bucket ${bucket}:`, error.message);
        throw error;
    }
    
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
};

// --- GESTIÓN DE TICKET CONFIG ---

export const dbGetTicketConfig = async (branchId: string) => {
    if (!branchId) return null;
    const cacheKey = `ticket_config_${branchId}`;
    const cached = getCached(cacheKey, 60000); // 60s TTL
    if (cached) return cached;

    try {
        const { data, error } = await supabase
            .from('sucursal_ticket_config')
            .select('*')
            .eq('sucursal_id', branchId)
            .maybeSingle();
        if (error) {
            // Manejamos el error de permisos de forma silenciosa para no interrumpir el flujo
            if (error.code !== '42501') { // 42501 is permission denied
                console.error("Error fetching ticket config:", error.message);
            }
            return null;
        }
        setCache(cacheKey, data);
        return data;
    } catch (e) {
        return null;
    }
};

export const dbSaveTicketConfig = async (branchId: string, holdingId: string, config: any) => {
    const { error } = await supabase
        .from('sucursal_ticket_config')
        .upsert({
            sucursal_id: branchId,
            empresa_holding_id: holdingId,
            politicas: config.politicas,
            url_imagen_promocional: config.url_imagen_promocional,
            horario_atencion: config.horario_atencion,
            url_logo_ticket: config.url_logo_ticket,
            logo_ticket_size: config.logo_ticket_size,
            politicas_font_size: config.politicas_font_size || 7,
            mostrar_codigo_barras: config.mostrar_codigo_barras ?? true,
            fecha_actualizacion: new Date().toISOString()
        }, { onConflict: 'sucursal_id' });
    if (error) {
        console.error("Error saving ticket config:", error.message);
        throw error;
    }
};

// --- GESTIÓN DE BANNERS ---

export const dbGetSucursalBanners = async (): Promise<PromoBanner[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    const { data, error } = await supabase
        .from('sucursal_banners')
        .select('*')
        .eq('sucursal_id', branchId)
        .eq('activo', true)
        .order('id', { ascending: false });
    if (error) return [];
    return (data || []).map(b => ({ id: b.id, url: b.url_imagen, name: b.titulo, isActive: b.activo }));
};

export const dbSaveSucursalBanner = async (banner: { name: string, url: string }) => {
    const branchId = getActiveBranchId();
    if (!branchId) throw new Error("No hay sucursal activa");
    const user = localStorage.getItem('sislav_current_user_name') || 'SISTEMA';
    const { data, error = null } = await supabase.from('sucursal_banners').insert({
        sucursal_id: branchId, titulo: banner.name.toUpperCase(), url_imagen: banner.url, activo: true, registrado_por: user
    }).select().single();
    if (error) throw error;
    return data;
};

export const dbUpdateSucursalBanner = async (id: string, updates: Partial<PromoBanner>) => {
    const payload: any = {};
    if (updates.name) payload.titulo = updates.name.toUpperCase();
    if (updates.isActive !== undefined) payload.activo = updates.isActive;
    if (updates.url) payload.url_imagen = updates.url;
    const { error = null } = await supabase.from('sucursal_banners').update(payload).eq('id', id);
    if (error) throw error;
    invalidateCache('categories'); // Adjust if banner affects modules
};

export const dbSaveCategory = async (cat: Omit<Category, 'id'>) => {
    const branchId = getActiveBranchId();
    if (!branchId) throw new Error("No hay contexto de sucursal");
    const holdingId = await ensureHoldingId(branchId);
    
    const { data, error } = await supabase.from('categorias').insert({
        sucursal_id: branchId,
        empresa_holding_id: holdingId,
        nombre: cat.name.toUpperCase(),
        activo: cat.isActive,
        imagen_id: cat.imagen_id
    }).select().single();
    if (error) throw error;
    invalidateCache('categories');
    return data;
};

export const dbGetPopularityData = async () => {
    const branchId = getActiveBranchId();
    if (!branchId) return { topCategories: [], topProducts: [] };
    
    const cacheKey = `popularity_${branchId}`;
    const cached = getCached(cacheKey, 60000); // 60s TTL
    if (cached) return cached;
    
    try {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        // Usamos '*' para ser resilientes a cambios de esquema y evitamos el error de columna inexistente
        const { data, error } = await supabase
            .from('items_venta')
            .select('*, ventas!inner(sucursal_id, fecha_recepcion)')
            .eq('ventas.sucursal_id', branchId)
            .gte('ventas.fecha_recepcion', threeMonthsAgo.toISOString())
            .limit(1000);
            
        if (error || !data) {
            if (error && error.code !== 'PGRST204') console.error('Error fetching popularity data:', error);
            return { topCategories: [], topProducts: [] };
        }
        
        // Log para depuración interna del esquema (Solo en desarrollo)
        // if (data.length > 0 && import.meta.env.DEV) {
        //     console.log("📊 Esquema items_venta detectado:", Object.keys(data[0]));
        // }
        
        const catCounts: { [key: string]: number } = {};
        const prodCounts: { [key: string]: number } = {};
        
        // Since we don't have products join here, we might not have categories.
        // But we can aggregate products by description for now.
        data.forEach((item: any) => {
            const prodName = item.descripcion || 'Sin nombre';
            prodCounts[prodName] = (prodCounts[prodName] || 0) + 1;
            
            // If we want categories, we would need another join or a localized mapping.
            // For now, we'll just use 'General' if no join available.
            const catName = 'General'; 
            catCounts[catName] = (catCounts[catName] || 0) + 1;
        });
        
        const topCategories = Object.entries(catCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(entry => entry[0]);
            
        const topProducts = Object.entries(prodCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(entry => entry[0]);
            
        const result = { topCategories, topProducts };
        setCache(cacheKey, result);
        return result;
    } catch (e) {
        console.error("Error fetching popularity data:", e);
        return { topCategories: [], topProducts: [] };
    }
};

export const dbDeleteSucursalBanner = async (id: string) => {
    // Implementación de borrado lógico por petición del usuario
    const { error = null } = await supabase.from('sucursal_banners').update({ activo: false }).eq('id', id);
    if (error) throw error;
};

// --- PRODUCTOS ---

export const dbGetProducts = async (): Promise<Product[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) {
        console.warn("dbGetProducts: No branchId detected");
        return [];
    }
    
    const cacheKey = `products_${branchId}`;
    const cached = getCached(cacheKey, 60000); // 60s TTL
    if (cached) return cached;
    try {
        const holdingId = await ensureHoldingId(branchId);
        console.log(`dbGetProducts Fetching for Branch: ${branchId}, Holding: ${holdingId}`);
        
        const { data, error } = await supabase
            .from('productos')
            .select('*, categorias(nombre), productos_recetas(*, insumos(nombre, unidad_medida, stock_actual))')
            .eq('sucursal_id', branchId)
            .eq('empresa_holding_id', holdingId)
            .eq('activo', true)
            .eq('estado', 'a')
            .order('nombre', { ascending: true })
            .limit(1000);

        if (error) {
            console.error("dbGetProducts Supabase Error:", error);
            return [];
        }
        
        console.log(`dbGetProducts Found ${data?.length || 0} products`);
        const products = (data || []).map(p => {
            const catInfo = normalizeRelation(p.categorias);
            return { 
                id: p.id, 
                sucursal_id: p.sucursal_id, 
                empresa_holding_id: p.empresa_holding_id, 
                name: fixEncoding(p.nombre || 'SIN NOMBRE').toUpperCase(), 
                price: Number(p.precio) || 0, 
                category: fixEncoding(catInfo?.nombre || 'GENERAL'), 
                description: fixEncoding(p.description || ''), 
                activo: p.activo ?? true, 
                unitCode: p.codigo_unidad || UnitCode.ZZ, 
                um_saas: p.um_saas,
                igvType: p.tipo_igv_codigo || IgvType.GRAVADO, 
                stock: Number(p.stock_actual) || 0, 
                cost: Number(p.costo) || 0, 
                estado: p.estado || 'a', 
                categoria_id: p.categoria_id, 
                pointsPrice: p.precio_puntos, 
                showInCatalog: p.mostrar_en_catalogo ?? false,
                imageUrl: p.url_imagen,
                imagen_id: p.imagen_id,
                recipe: (p.productos_recetas || []).map((r: any) => ({ supplyId: r.insumo_id, name: r.insumos?.nombre, quantity: Number(r.cantidad_usada), unit: r.insumos?.unidad_medida, cost: 0 })) 
            };
        });
        setCache(cacheKey, products);
        return products;
    } catch (e) { return []; }
};

export const dbGetCatalogProductsByBranch = async (branchId: string): Promise<Product[]> => {
    try {
        const { data, error } = await supabase
            .from('productos')
            .select('*, categorias(nombre)')
            .eq('sucursal_id', branchId)
            .eq('activo', true)
            .eq('estado', 'a')
            .eq('mostrar_en_catalogo', true)
            .order('nombre', { ascending: true })
            .limit(1000);
        if (error) return [];
        return (data || []).map(p => {
            const catInfo = normalizeRelation(p.categorias);
            return { 
                id: p.id, 
                sucursal_id: p.sucursal_id, 
                empresa_holding_id: p.empresa_holding_id, 
                name: fixEncoding(p.nombre || 'SIN NOMBRE').toUpperCase(), 
                price: Number(p.precio) || 0, 
                category: fixEncoding(catInfo?.nombre || 'GENERAL'), 
                description: fixEncoding(p.description || ''), 
                activo: p.activo ?? true, 
                unitCode: p.codigo_unidad || UnitCode.ZZ, 
                um_saas: p.um_saas,
                igvType: p.tipo_igv_codigo || IgvType.GRAVADO, 
                stock: Number(p.stock_actual) || 0, 
                cost: Number(p.costo) || 0, 
                estado: p.estado || 'a', 
                categoria_id: p.categoria_id, 
                pointsPrice: p.precio_puntos,
                showInCatalog: p.mostrar_en_catalogo ?? false,
                imageUrl: p.url_imagen,
                imagen_id: p.imagen_id,
                recipe: [] 
            };
        });
    } catch (e) { return []; }
};

export const dbSaveProduct = async (product: Omit<Product, 'id'>) => {
    const branchId = getActiveBranchId();
    if (!branchId) throw new Error("No hay contexto de sucursal");
    const holdingId = await ensureHoldingId(branchId);
    const user = localStorage.getItem('sislav_current_user_name') || 'SISTEMA';
    const { data: p, error } = await supabase.from('productos').insert({ 
        sucursal_id: branchId, 
        empresa_holding_id: holdingId, 
        nombre: product.name.toUpperCase().trim(), 
        descripcion: product.description, 
        categoria_id: product.categoria_id || null, 
        precio: product.price, 
        activo: true, 
        estado: 'a', 
        codigo_unidad: product.unitCode || 'ZZ', 
        um_saas: product.um_saas || 'UNIDAD',
        tipo_igv_codigo: product.igvType || '10', 
        stock_actual: product.stock || 0, 
        costo: product.cost || 0, 
        precio_puntos: product.pointsPrice || null, 
        mostrar_en_catalogo: product.showInCatalog ?? false,
        url_imagen: product.imageUrl,
        imagen_id: product.imagen_id,
        registrado_por: user 
    }).select().single();
    if (error) throw error;
    if (product.recipe && product.recipe.length > 0) {
        const recipes = product.recipe.map(r => ({ producto_id: p.id, insumo_id: r.supplyId, cantidad_usada: r.quantity, registrado_por: user }));
        await supabase.from('productos_recetas').insert(recipes);
    }
    invalidateCache('products');
    return p;
};

export const dbUpdateProduct = async (id: string, updates: Partial<Product>) => {
    const payload: any = {};
    if (updates.name) payload.nombre = updates.name.toUpperCase();
    if (updates.price !== undefined) payload.precio = updates.price;
    if (updates.cost !== undefined) payload.costo = updates.cost;
    if (updates.stock !== undefined) payload.stock_actual = updates.stock;
    if (updates.categoria_id !== undefined) payload.categoria_id = updates.categoria_id;
    if (updates.description !== undefined) payload.descripcion = updates.description;
    if (updates.unitCode) payload.codigo_unidad = updates.unitCode;
    if (updates.um_saas) payload.um_saas = updates.um_saas;
    if (updates.igvType) payload.tipo_igv_codigo = updates.igvType;
    if (updates.pointsPrice !== undefined) payload.precio_puntos = updates.pointsPrice;
    if (updates.showInCatalog !== undefined) payload.mostrar_en_catalogo = updates.showInCatalog;
    if (updates.imageUrl !== undefined) payload.url_imagen = updates.imageUrl;
    if (updates.imagen_id !== undefined) payload.imagen_id = updates.imagen_id;
    const { error } = await supabase.from('productos').update(payload).eq('id', id);
    if (error) throw error;
    invalidateCache('products');
};

export const dbDeleteProduct = async (id: string) => {
    const { error } = await supabase.from('productos').update({ estado: 'i', activo: false }).eq('id', id);
    if (error) throw error;
};

// --- CATEGORÍAS ---

export const dbGetCategories = async (): Promise<Category[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    
    const cacheKey = `categories_${branchId}`;
    const cached = getCached(cacheKey, 60000); // 60s TTL
    if (cached) return cached;
    
    const { data: cats, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('sucursal_id', branchId)
        .eq('activo', true);
        
    if (error || !cats) return [];
    
    // Fetch images separately to avoid join errors if FK is missing
    const { data: imgs } = await supabase.from('global_cat_categorias').select('id, url');
    const imgMap = new Map((imgs || []).map(i => [i.id, i.url]));
    
    const categories = cats.map(c => ({ 
        id: c.id, 
        sucursal_id: c.sucursal_id, 
        name: fixEncoding(c.nombre), 
        isActive: c.activo, 
        imagen_id: c.imagen_id,
        imageUrl: c.imagen_id ? imgMap.get(c.imagen_id) : null
    }));
    setCache(cacheKey, categories);
    return categories;
};

export const dbUpdateCategory = async (id: string, updates: Partial<Category>) => {
    const payload: any = {};
    if (updates.name) payload.nombre = updates.name.toUpperCase();
    if (updates.isActive !== undefined) payload.activo = updates.isActive;
    if (updates.imagen_id !== undefined) payload.imagen_id = updates.imagen_id;
    const { error = null } = await supabase.from('categorias').update(payload).eq('id', id);
    if (error) throw error;
    invalidateCache('categories');
};

// --- CLIENTES ---

export const dbCreateClient = async (client: any): Promise<Client> => {
    const branchId = getActiveBranchId();
    if (!branchId) throw new Error("No hay contexto de sucursal");
    const holdingId = await ensureHoldingId(branchId);
    const user = localStorage.getItem('sislav_current_user_name') || 'SISTEMA';
    
    const payload: any = { 
        sucursal_id: branchId, 
        empresa_holding_id: holdingId, 
        nombres: client.name.toUpperCase(), 
        dni: client.docNumber || '00000000', 
        ruc: client.ruc,
        razon_social: client.razon_social,
        tipo_documento: client.docType || (client.docNumber.length === 11 ? 'RUC' : 'DNI'), 
        telefono: client.phone, 
        email: client.email, 
        direccion: client.address?.toUpperCase() || '-', 
        google_maps_url: client.google_maps_url, 
        latitud: client.latitud !== undefined ? client.latitud : client.latitude, 
        longitud: client.longitud !== undefined ? client.longitud : client.longitude, 
        mensaje_alerta: client.alertMessage, 
        color_alerta: client.alertColor, 
        cumpleanos: client.birthday || null, 
        genero: client.gender, 
        registrado_por: user, 
        activo: true,
        suscrito: client.suscrito !== undefined ? client.suscrito : false
    };
    
    if (client.id && !client.id.startsWith('temp-')) payload.id = client.id;
    
    console.log("💾 [dbCreateClient] Intentando Upsert de cliente:", payload.dni);
    const { data, error } = await supabase.from('clientes').upsert(payload).select().single();
    
    if (error) {
        console.error("❌ [dbCreateClient] Error de Supabase:", error);
        if (error.message?.includes('violates row-level security policy')) {
            throw new Error("ERROR DE PERMISOS: No tiene permiso para crear o actualizar clientes. Verifique las políticas de Supabase.");
        }
        throw error;
    }
    
    console.log("✅ [dbCreateClient] Cliente guardado:", data.id);
    
    // Convertir de formato DB a formato Client (el esperado por la UI)
    const mappedClient: Client = {
        id: data.id,
        sucursal_id: data.sucursal_id,
        empresa_holding_id: data.empresa_holding_id,
        docType: data.tipo_documento || (data.dni?.length === 11 ? 'RUC' : 'DNI'),
        docNumber: data.dni || '00000000',
        name: data.nombres.toUpperCase(),
        ruc: data.ruc,
        razon_social: data.razon_social,
        phone: data.telefono || '',
        email: data.email || '',
        address: data.direccion || '-',
        points: data.puntos || 0,
        alertMessage: data.mensaje_alerta,
        alertColor: data.color_alerta,
        latitude: data.latitud,
        longitude: data.longitud,
        birthday: data.cumpleanos,
        gender: data.genero,
        googleMapsUrl: data.google_maps_url,
        suscrito: data.suscrito ?? false
    };

    return mappedClient;
};

export const dbDeleteClient = async (id: string) => {
    const { error } = await supabase.from('clientes').update({ activo: false }).eq('id', id);
    if (error) throw error;
};

export const dbUpdateClientSubscriptionStatus = async (clientId: string, isSubscribed: boolean) => {
    try {
        const { error } = await supabase.from('clientes').update({ suscrito: isSubscribed }).eq('id', clientId);
        if (error) {
            console.warn("⚠️ No se pudo actualizar el estado de suscripción en clientes:", error.message);
        } else {
            console.log(`✅ Estado de suscripción para cliente ${clientId} actualizado a:`, isSubscribed);
        }
        // Limpiamos cache de clientes
        const branchId = getActiveBranchId();
        if (branchId) {
            // Buscamos y limpiamos las claves que empiecen con clients_
            // Dado que no podemos listar todas, el ttl normal o la recarga remota lo cubrirá.
            // Para asegurar actualización, invalidamos mediante el mecanismo de mutación o refresco
        }
    } catch (e: any) {
        console.warn("⚠️ Error al actualizar el estado de suscripción del cliente:", e.message);
    }
};

export const dbGetClients = async (page: number = 1, pageSize: number = 100, searchTerm: string = ''): Promise<{ clients: Client[], total: number }> => {
    const branchId = getActiveBranchId();
    if (!branchId) return { clients: [], total: 0 };
    
    const cacheKey = `clients_${branchId}_p${page}_s${pageSize}_q${searchTerm}`;
    const cached = getCached(cacheKey, 30000); // 30s TTL
    if (cached) return cached;

    try {
        const holdingId = await ensureHoldingId(branchId);
        
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('clientes')
            .select('id, sucursal_id, empresa_holding_id, nombres, apellidos, telefono, email, dni, activo, fecha_registro, tipo_documento, cumpleanos, genero, direccion, google_maps_url, puntos, mensaje_alerta, color_alerta, latitud, longitud, registrado_por, ruc, razon_social, suscrito', { count: 'exact' })
            .eq('sucursal_id', branchId)
            .eq('empresa_holding_id', holdingId)
            .eq('activo', true);

        if (searchTerm) {
            const words = searchTerm.trim().split(/\s+/).filter(w => w.length > 0);
            words.forEach(word => {
                query = query.or(`nombres.ilike.%${word}%,apellidos.ilike.%${word}%,dni.ilike.%${word}%,telefono.ilike.%${word}%,razon_social.ilike.%${word}%`);
            });
        }

        const { data, count, error } = await query
            .order('nombres', { ascending: true })
            .range(from, to);

        if (error) {
            console.error("Error fetching clients:", error);
            return { clients: [], total: 0 };
        }
        
        const mappedClients = (data || []).map(c => ({ 
            id: c.id, 
            sucursal_id: c.sucursal_id, 
            empresa_holding_id: c.empresa_holding_id, 
            docType: c.tipo_documento || (c.dni?.length === 11 ? 'RUC' : 'DNI'), 
            docNumber: c.dni || '00000000', 
            name: fixEncoding(`${c.nombres || ''} ${c.apellidos || ''}`).trim().toUpperCase() || 'CLIENTE VARIOS', 
            ruc: c.ruc,
            razon_social: c.razon_social,
            phone: c.telefono || '', 
            email: c.email || '', 
            address: fixEncoding(c.direccion || '-'), 
            points: c.puntos || 0, 
            alertMessage: c.mensaje_alerta, 
            alertColor: c.color_alerta, 
            latitude: c.latitud, 
            longitude: c.longitud, 
            birthday: c.cumpleanos, 
            gender: c.genero, 
            googleMapsUrl: c.google_maps_url,
            suscrito: c.suscrito ?? false
        }));
        
        const result = { clients: mappedClients, total: count || 0 };
        setCache(cacheKey, result);
        return result;
    } catch (e) { return { clients: [], total: 0 }; }
};

export const dbGetBirthdaysToday = async (branchId?: string): Promise<Client[]> => {
    const activeBranchId = branchId || getActiveBranchId();
    if (!activeBranchId) return [];
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('sucursal_id', activeBranchId)
            // .eq('activo', true) // COMENTADO POR ERROR 400 EN ALGUNAS DBS
            .not('cumpleanos', 'is', null);
            // .neq('cumpleanos', '-'); // COMENTADO POR ERROR 400 SI COLUMNA ES DATE

        if (error) return [];
        
        const now = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(now.getDate() + 1);
        
        const todayM = now.getMonth() + 1;
        const todayD = now.getDate();
        const tomorrowM = tomorrow.getMonth() + 1;
        const tomorrowD = tomorrow.getDate();

        const isBirthday = (bday: string, m: number, d: number) => {
            const mStr = String(m).padStart(2, '0');
            const dStr = String(d).padStart(2, '0');
            const clean = bday.replace(/\//g, '-');
            return clean.includes(`${mStr}-${dStr}`) || clean.includes(`${dStr}-${mStr}`);
        };

        const mappedClients = (data || []).map(c => ({ 
            id: c.id, 
            sucursal_id: c.sucursal_id, 
            empresa_holding_id: c.empresa_holding_id, 
            docType: c.tipo_documento || (c.dni?.length === 11 ? 'RUC' : 'DNI'), 
            docNumber: c.dni || '00000000', 
            name: fixEncoding(`${c.nombres || ''} ${c.apellidos || ''}`).trim().toUpperCase() || 'CLIENTE VARIOS', 
            phone: c.telefono || '', 
            email: c.email || '', 
            address: fixEncoding(c.direccion || '-'), 
            points: c.puntos || 0, 
            birthday: c.cumpleanos, 
            gender: c.genero
        }));

        // Filtrar solo los que cumplen hoy o mañana
        return mappedClients.filter(c => {
            if (!c.birthday) return false;
            return isBirthday(c.birthday, todayM, todayD) || isBirthday(c.birthday, tomorrowM, tomorrowD);
        });
    } catch (e) { return []; }
};

const mapStatusFromDb = (dbStatus: string): string => {
    switch (dbStatus) {
        case 'PENDIENTE': return 'PENDING';
        case 'EN_CAMINO': return 'IN_ROUTE';
        case 'RECOGIDO': return 'COMPLETED';
        case 'FALLIDO': return 'FAILED';
        case 'CANCELADO': return 'CANCELADO';
        default: return dbStatus || 'PENDING';
    }
};

const mapStatusToDb = (status: string): string => {
    switch (status) {
        case 'PENDING': return 'PENDIENTE';
        case 'IN_ROUTE': return 'EN_CAMINO';
        case 'COMPLETED': return 'RECOGIDO';
        case 'FAILED': return 'FALLIDO';
        case 'CANCELLED': return 'CANCELADO';
        default: return status || 'PENDIENTE';
    }
};

// --- RECOJOS ---

export const dbGetPickupRequests = async (): Promise<PickupRequest[]> => {
    let branchId = getActiveBranchId();
    let holdingId = getActiveHoldingId();
    
    if (!branchId && !holdingId) return [];
    
    const cacheKey = `pickup_requests_${branchId || 'all'}_h_${holdingId || 'all'}`;
    const cached = getCached(cacheKey, 30000); // 30s TTL to optimize egress
    if (cached) return cached;

    try {
        if (!holdingId && branchId) {
            holdingId = await ensureHoldingId(branchId);
        }
        if (!holdingId) return [];

        let query = supabase.from('recojos_delivery').select('*, clientes(nombres, latitud, longitud, google_maps_url), chofer:usuarios_login!chofer_id(id, nombre_completo, username)').eq('empresa_holding_id', holdingId);
        
        // Si no es un chofer (DELIVERY) y tenemos branchId, filtramos estrictamente por sucursal_id
        const sessionStr = localStorage.getItem('sislav_auth_session');
        let isDriver = false;
        if (sessionStr) {
            try {
                const parsed = JSON.parse(sessionStr);
                isDriver = parsed?.user?.role === 'DELIVERY';
            } catch (e) {}
        }
        if (!isDriver) {
            isDriver = localStorage.getItem('sislav_current_user_role') === 'DELIVERY';
        }
        
        if (!isDriver && branchId && branchId !== 'default') {
            query = query.eq('sucursal_id', branchId);
        }

        const { data, error } = await query.order('fecha_programada', { ascending: true });
        if (error) return [];
        const result = (data || []).map(r => {
            let parsedChoferId = r.chofer_id || r.chofer_nombre || '';
            let parsedNotes = r.notas || '';
            let parsedPriority = 'NORMAL';

            let tempNotes = parsedNotes;
            let found = true;
            while (found) {
                found = false;
                const matchChofer = tempNotes.match(/^\[CHOFER_ID:([^\]]+)\]\s*(.*)/s);
                if (matchChofer) {
                    parsedChoferId = matchChofer[1];
                    tempNotes = matchChofer[2];
                    found = true;
                }
                const matchPriority = tempNotes.match(/^\[PRIORITY:([^\]]+)\]\s*(.*)/s);
                if (matchPriority) {
                    parsedPriority = matchPriority[1];
                    tempNotes = matchPriority[2];
                    found = true;
                }
                const matchPrioridad = tempNotes.match(/^\[PRIORIDAD:([^\]]+)\]\s*(.*)/s);
                if (matchPrioridad) {
                    parsedPriority = matchPrioridad[1];
                    tempNotes = matchPrioridad[2];
                    found = true;
                }
            }
            parsedNotes = tempNotes;

            return {
                id: r.id,
                sucursal_id: r.sucursal_id,
                empresa_holding_id: r.empresa_holding_id,
                cliente_id: r.cliente_id,
                clientName: r.clientes?.nombres || 'Cliente',
                address: r.direccion,
                phone: r.telefono,
                scheduledDate: r.fecha_programada,
                timeRange: r.rango_horario,
                status: mapStatusFromDb(r.estado_recojo),
                notes: parsedNotes,
                chofer_id: parsedChoferId,
                chofer_name: r.chofer?.nombre_completo || r.chofer?.username || r.chofer_nombre || '',
                createdAt: r.fecha_registro,
                registrado_por: r.registrado_por,
                googleMapsUrl: r.clientes?.google_maps_url,
                latitude: (() => {
                    if (r.clientes?.latitud) return Number(r.clientes.latitud);
                    const mapsUrl = r.clientes?.google_maps_url;
                    if (mapsUrl) {
                        const atMatch = mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                        if (atMatch) return parseFloat(atMatch[1]);
                        const qMatch = mapsUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                        if (qMatch) return parseFloat(qMatch[1]);
                    }
                    return undefined;
                })(),
                longitude: (() => {
                    if (r.clientes?.longitud) return Number(r.clientes.longitud);
                    const mapsUrl = r.clientes?.google_maps_url;
                    if (mapsUrl) {
                        const atMatch = mapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                        if (atMatch) return parseFloat(atMatch[2]);
                        const qMatch = mapsUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
                        if (qMatch) return parseFloat(qMatch[2]);
                    }
                    return undefined;
                })(),
                isSelfScheduled: r.is_self_scheduled ?? false,
                isReadByAdmin: r.is_read_by_admin ?? false,
                priority: parsedPriority as 'NORMAL' | 'ALTA'
            };
        });
        setCache(cacheKey, result);
        return result;
    } catch (e) { return []; }
};

export const dbCreatePickupRequest = async (pickup: any) => {
    let branchId = getActiveBranchId();
    if (!branchId) branchId = pickup.sucursal_id; // Soporte para agendado desde tracking de cliente
    
    if (!branchId || branchId === 'default') throw new Error("No hay contexto de sucursal");
    
    // Si el holding_id ya viene en el objeto (desde el cliente), lo usamos para evitar consultas a tablas protegidas
    let holdingId = pickup.empresa_holding_id || getActiveHoldingId();
    if (!holdingId) {
        holdingId = await ensureHoldingId(branchId!);
    }
    
    const user = localStorage.getItem('sislav_current_user_name') || 'CLIENTE_FINAL';
    
    let choferId = pickup.chofer_id;
    let finalNotes = pickup.notes || '';
    if (finalNotes && finalNotes.startsWith('[CHOFER_ID:')) {
        const match = finalNotes.match(/^\[CHOFER_ID:([^\]]+)\]\s*(.*)/s);
        if (match) {
            choferId = match[1];
            finalNotes = match[2];
        }
    }
    
    // Si la prioridad es ALTA, la añadimos como tag en las notas de la base de datos
    if (pickup.priority === 'ALTA' && !finalNotes.includes('[PRIORITY:ALTA]')) {
        finalNotes = `[PRIORITY:ALTA] ${finalNotes}`;
    }
    // Si hay un chofer_id y no está ya pre-codificado, lo re-codificamos
    if (choferId && !finalNotes.includes('[CHOFER_ID:')) {
        finalNotes = `[CHOFER_ID:${choferId}] ${finalNotes}`;
    }

    const payload: any = { 
        sucursal_id: branchId, 
        empresa_holding_id: holdingId, 
        cliente_id: pickup.cliente_id, 
        direccion: pickup.address, 
        telefono: pickup.phone, 
        fecha_programada: pickup.scheduledDate, 
        rango_horario: pickup.timeRange, 
        estado_recojo: mapStatusToDb(pickup.status), 
        notas: finalNotes, 
        chofer_id: choferId || null,
        registrado_por: user 
    };
    
    if (pickup.isSelfScheduled !== undefined) payload.is_self_scheduled = pickup.isSelfScheduled;
    if (pickup.isReadByAdmin !== undefined) payload.is_read_by_admin = pickup.isReadByAdmin;
    const { data, error } = await supabase.from('recojos_delivery').insert(payload).select().single();
    if (error) throw error;
    invalidateCache('pickup_requests_');
    return data;
};

export const dbUpdatePickupRequest = async (id: string, updates: any) => {
    const payload: any = {};
    if (updates.address) payload.direccion = updates.address;
    if (updates.phone) payload.telefono = updates.phone;
    if (updates.scheduledDate) payload.fecha_programada = updates.scheduledDate;
    if (updates.timeRange) payload.rango_horario = updates.timeRange;
    
    let choferId = updates.chofer_id;
    let finalNotes = updates.notes;
    let priority = updates.priority;

    if (finalNotes !== undefined) {
        let cleanText = finalNotes;
        let found = true;
        while (found) {
            found = false;
            if (typeof cleanText === 'string') {
                const matchCh = cleanText.match(/^\[CHOFER_ID:([^\]]+)\]\s*(.*)/s);
                if (matchCh) {
                    choferId = matchCh[1];
                    cleanText = matchCh[2];
                    found = true;
                }
                const matchPr = cleanText.match(/^\[PRIORITY:([^\]]+)\]\s*(.*)/s);
                if (matchPr) {
                    priority = matchPr[1];
                    cleanText = matchPr[2];
                    found = true;
                }
                const matchPrd = cleanText.match(/^\[PRIORIDAD:([^\]]+)\]\s*(.*)/s);
                if (matchPrd) {
                    priority = matchPrd[1];
                    cleanText = matchPrd[2];
                    found = true;
                }
            }
        }

        let mergedNotes = cleanText;
        if (priority === 'ALTA') {
            mergedNotes = `[PRIORITY:ALTA] ${mergedNotes}`;
        }
        if (choferId) {
            mergedNotes = `[CHOFER_ID:${choferId}] ${mergedNotes}`;
        }
        payload.notas = mergedNotes;
    } else if (priority !== undefined || choferId !== undefined) {
        // Si no se actualizaron las notas pero sí el chofer o la prioridad, tendríamos que reconfigurarla de alguna manera, 
        // pero CallCenter siempre envía notes en sus actualizaciones. Por si acaso, si hay choferId lo guardamos en chofer_id:
    }
    
    if (choferId) {
        payload.chofer_id = choferId;
    }
    if (updates.status) payload.estado_recojo = mapStatusToDb(updates.status);
    const { error = null } = await supabase.from('recojos_delivery').update(payload).eq('id', id);
    if (error) throw error;
    invalidateCache('pickup_requests_');
};

export const dbUpdatePickupRequestStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('recojos_delivery').update({ estado_recojo: mapStatusToDb(status) }).eq('id', id);
    if (error) throw error;
    invalidateCache('pickup_requests_');
};

export const dbUpdateSunatResponse = async (ventaId: string, response: SunatResponse) => {
    const payload: any = {
        sunat_status: response.success ? 'ACCEPTED' : (response.isPending ? 'PENDING' : 'REJECTED'),
        sunat_description: response.description,
        sunat_hash: response.hash,
        sunat_pdf_url: response.pdfUrl,
        sunat_xml_url: response.xmlUrl,
        sunat_cdr_url: response.cdrUrl
    };
    const { error = null } = await supabase.from('ventas').update(payload).eq('id', ventaId);
    if (error) throw error;
    invalidateCache('invoices');
};

export const dbDeletePickupRequest = async (id: string) => {
    const { error } = await supabase.from('recojos_delivery').update({ estado_recojo: 'CANCELADO' }).eq('id', id);
    if (error) throw error;
    invalidateCache('pickup_requests_');
};

export const dbMarkPickupAsRead = async (id: string) => {
    try { 
        await supabase.from('recojos_delivery').update({ is_read_by_admin: true }).eq('id', id); 
        invalidateCache('pickup_requests_');
    } catch (e) {}
};

// --- VENTAS ---

export const dbCreateInvoice = async (invoice: any, items: CartItem[], company: Company, customerPhotos: string[] = [], paymentsList: { methodName: string, amount: number }[] = []) => {
    const branchId = getActiveBranchId();
    if (!branchId) throw new Error("No hay contexto de sucursal");
    const holdingId = company.empresa_holding_id || getActiveHoldingId() || "";
    const user = localStorage.getItem('sislav_current_user_name') || 'SISTEMA';
    
    // 0. Resolver ID de usuario
    let userId = getActiveUserId();
    if (!userId) {
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData.session?.user?.id || null;
    }

    // 1. Resolver IDs de métodos de pago
    let resolvedPayments: any[] = [];
    if (paymentsList && paymentsList.length > 0) {
        const { data: metodos } = await supabase.from('metodos_pago').select('id, nombre').eq('sucursal_id', branchId);
        resolvedPayments = paymentsList.map(p => {
            const metId = metodos?.find(m => m.nombre.trim().toUpperCase() === p.methodName.trim().toUpperCase())?.id;
            return { ...p, metodo_pago_id: metId, usuario_id: userId };
        }).filter(p => !!p.metodo_pago_id);
    }

    // 2. Preparar items con detalles parseados y DESGLOSE por prenda si es necesario
    const itemsPayload: any[] = [];
    
    items.forEach(it => {
        let detailsArray: ItemDetalle[] = [];
        try {
            const parsed = JSON.parse(it.details || '[]');
            if (Array.isArray(parsed) && parsed.length > 0) {
                detailsArray = parsed;
            }
        } catch (e) {}

        // Si tenemos detalles por unidad (ej: 4 sacos con colores distintos), desglosamos en N filas
        if (detailsArray.length > 0) {
            detailsArray.forEach((audit, idx) => {
                const discUnit = it.descuento_unitario || 0;
                const origPrice = it.price;
                const finalUnitPrice = Math.max(0, origPrice - discUnit);
                
                itemsPayload.push({
                    ...it,
                    quantity: 1, // Una sola unidad por fila desglosada
                    precio_original: origPrice,
                    precio_unitario: finalUnitPrice,
                    descuento_item: discUnit,
                    subtotal: finalUnitPrice,
                    color: audit.color || it.color,
                    defectos: audit.defectos || it.defectos,
                    details: audit.observaciones || "",
                    itemDeliveryDate: audit.fecha_entrega_especifica || it.itemDeliveryDate,
                    images: audit.unit_images || it.images || [],
                    audioNote: audit.unit_audio || it.audioNote,
                    peso: it.peso_estimado || 0.400,
                    splitOrder: idx + 1 // Marcador opcional para identificar que es parte de un grupo
                });
            });
        } else {
            // Comportamiento normal: Una sola fila para la cantidad total
            const discUnit = it.descuento_unitario || 0;
            const origPrice = it.price;
            const finalUnitPrice = Math.max(0, origPrice - discUnit);
            const qty = it.quantity || 1;
            const totDisc = discUnit * qty;
            const finalSubtotal = roundToOneDecimal(finalUnitPrice * qty);

            itemsPayload.push({
                ...it,
                precio_original: origPrice,
                precio_unitario: finalUnitPrice,
                descuento_item: totDisc,
                subtotal: finalSubtotal,
                peso: (it.peso_estimado || 0.400) * qty
            });
        }
    });

    // 3. Llamada Atómica al RPC
    const { data: result, error: rpcError } = await supabase.rpc('procesar_venta_atomica', {
        p_sucursal_id: branchId,
        p_holding_id: holdingId,
        p_cliente_id: invoice.cliente_id,
        p_tipo_doc: invoice.type,
        p_serie: invoice.serie,
        p_totals: invoice.totals,
        p_items: itemsPayload,
        p_payments: resolvedPayments,
        p_photos: customerPhotos,
        p_origin: invoice.origin || 'TIENDA',
        p_pickup_id: invoice.pickup_id || null,
        p_user: user,
        p_usuario_id: userId,
        p_use_order_reset: company.use_order_reset || false,
        p_limite_reconteo: company.limite_reconteo || null,
        p_use_order_suffix: company.useOrderSuffix || false,
        p_delivery_date: invoice.deliveryDate || null
    });

    if (rpcError) {
        console.error("Error en procesar_venta_atomica:", rpcError);
        throw rpcError;
    }

    // 4. Formatear y Persistir el código de orden final en la base de datos
    // El RPC genera el correlativo_interno, pero dbService aplica la lógica de formato del negocio
    
    // Obtenemos el ID de sesión activa para vincular la venta directamente
    const { data: activeSession } = await supabase
        .from('cierres_caja')
        .select('id')
        .eq('sucursal_id', branchId)
        .eq('estado', 'ABIERTO')
        .order('fecha_apertura', { ascending: false })
        .limit(1)
        .maybeSingle();

    let currentConfig = { ...company };

    // LÓGICA DE ROTACIÓN DE PREFIJO/SUFIJO (A -> B -> C...)
    if (result.correlativo_interno === 1 && company.use_order_reset && company.useOrderSuffix) {
        const currentLetter = company.prefijo_sufijo || company.orderCurrentSuffix || 'A';
        const nextLetter = getNextLetter(currentLetter);
        try {
            await supabase.from('sucursales').update({ 
                prefijo_sufijo: nextLetter,
                order_current_suffix: nextLetter 
            }).eq('id', branchId);
            currentConfig.orderCurrentSuffix = nextLetter;
            currentConfig.prefijo_sufijo = nextLetter;
        } catch (errSuffix) {
            console.error("Error actualizando rotación:", errSuffix);
        }
    }

    const formattedOrderCode = formatOrderNumber(result.correlativo_interno, currentConfig);
    
    // Actualizamos la columna codigo_orden, fecha_recepcion y cash_session_id
    try {
        await supabase.from('ventas').update({ 
            codigo_orden: formattedOrderCode,
            cash_session_id: activeSession?.id || null,
            fecha_recepcion: getPeruTimestamp(),
            documento_referencia_id: invoice.relatedDocument || null,
            notes: invoice.notes || null, // Persistir las notas (razón de la NC si aplica)
            fecha_emision: invoice.fecha_emision || null,
            descuento: invoice.discount || 0
        }).eq('id', result.id);

        if (activeSession?.id) {
            await supabase.from('pagos_venta').update({ 
                cash_session_id: activeSession.id 
            }).eq('venta_id', result.id).is('cash_session_id', null);
        }
    } catch (updateError) {
        console.error("Error persistiendo datos de cierre de caja en venta:", updateError);
    }

    // 5. Sumar puntos al cliente si hubo pagos y el cliente es válido
    if (invoice.cliente_id && !invoice.cliente_id.startsWith('temp-') && resolvedPayments && resolvedPayments.length > 0) {
        const totalPaid = resolvedPayments.reduce((sum, p) => sum + p.amount, 0);
        if (totalPaid > 0) {
            try {
                await dbAddPointsToClient(invoice.cliente_id, totalPaid);
            } catch (e) {
                console.error("Error al sumar puntos (dbCreateInvoice):", e);
            }
        }
    }

    invalidateCache('invoices');
    return {
        id: result.id,
        correlativo: result.correlativo,
        correlativo_interno: result.correlativo_interno,
        codigo_orden: formattedOrderCode
    };
};

/**
 * Anula lógicamente una venta. Solo si no tiene pagos.
 */
export const dbAnularVenta = async (ventaId: string) => {
    // 1. Verificar si tiene pagos
    const { data: pagos, error: pError } = await supabase
        .from('pagos_venta')
        .select('id')
        .eq('venta_id', ventaId);
    
    if (pError) throw pError;
    if (pagos && pagos.length > 0) {
        throw new Error("No se puede anular una orden que ya tiene pagos registrados. Debe eliminar los pagos primero.");
    }

    // 2. Anular lógicamente
    const { error } = await supabase
        .from('ventas')
        .update({ 
            estado: 'CANCELADO'
        })
        .eq('id', ventaId);
    
    if (error) throw error;
    invalidateCache('invoices');
};

/**
 * Actualiza el monto de descuento de una venta existente
 */
export const dbUpdateInvoiceDiscount = async (ventaId: string, discount: number) => {
    const { error } = await supabase.from('ventas').update({ 
        descuento: discount 
    }).eq('id', ventaId);
    if (error) throw error;
};

/**
 * Actualiza los ítems y totales de una orden existente
 */
export const dbUpdateOrderItems = async (orderId: string, items: any[], totals: any) => {
    const branchId = getActiveBranchId();
    const holdingId = await ensureHoldingId(branchId!);

    // 1. Obtener ítems actuales para identificar cuáles deben cancelarse
    const { data: dbItems, error: fetchError } = await supabase
        .from('items_venta')
        .select('id, descripcion')
        .eq('venta_id', orderId);

    if (fetchError) {
        throw fetchError;
    }

    const existingIds = (dbItems || []).map(it => it.id);
    
    // IDs entrantes que ya existen en la base de datos (para actualizar)
    const incomingExistingIds = items.map(it => it.id).filter(id => id && existingIds.includes(id));
    
    // IDs que ya no están en la lista nueva -> Cancelar (Borrado Lógico)
    const idsToCancel = existingIds.filter(id => !incomingExistingIds.includes(id));

    if (idsToCancel.length > 0) {
        const { error: cancelError } = await supabase
            .from('items_venta')
            .update({ 
                estado: 'CANCELADO',
                estado_id: 9 
            })
            .in('id', idsToCancel);
        
        if (cancelError) {
            throw cancelError;
        }
    }

    const updates = items.filter(it => it.id && existingIds.includes(it.id));
    const inserts = items.filter(it => !it.id || !existingIds.includes(it.id));
    const userAudit = localStorage.getItem('sislav_current_user_name') || 'SISTEMA_AJUSTE';

    // Procesar Actualizaciones
    for (const it of updates) {
        const currentStatus = it.status || it.estado || 'RECIBIDO';
        const validStatus = (currentStatus === 'PENDIENTE') ? 'RECIBIDO' : currentStatus;

        const updatePayload = {
            producto_id: it.producto_id || it.id,
            descripcion: it.descripcion || it.name,
            cantidad: Number(it.cantidad || it.quantity),
            precio_unitario: Number(it.precio_unitario || it.price),
            subtotal: Number(it.subtotal || (it.cantidad * it.precio_unitario)),
            tipo_igv_codigo: it.tipo_igv_codigo || '10',
            codigo_unidad: it.codigo_unidad || 'ZZ',
            valor_unitario: Number(it.valor_unitario),
            igv_item: Number(it.igv_item),
            descuento_item: Number(it.descuento_item || 0),
            estado: validStatus,
            estado_id: it.estado_id || (ORDER_STATUS_MAP[validStatus as OrderStatus] || 2),
            color: it.color || '',
            defectos: it.defectos || '',
            observaciones: it.details || it.observaciones || '',
            url_audio: it.url_audio || it.audioNote,
            peso: (it.peso_estimado || 0.400) * Number(it.cantidad || it.quantity),
            fecha_entrega_item: it.fecha_entrega_item || it.itemDeliveryDate
        };

        const { error: upError } = await supabase.from('items_venta').update(updatePayload).eq('id', it.id);
        
        if (upError) {
            throw upError;
        }
    }

    // Procesar Inserciones
    if (inserts.length > 0) {
        const itemsToInsert = inserts.map(it => {
            let obs = it.details || it.observaciones || '';
            if (obs.trim().startsWith('[') && obs.trim().endsWith(']')) {
                obs = ''; 
            }

            const currentStatus = it.status || it.estado || 'RECIBIDO';
            const validStatus = (currentStatus === 'PENDIENTE') ? 'RECIBIDO' : currentStatus;

            return {
                venta_id: orderId,
                sucursal_id: branchId,
                empresa_holding_id: holdingId,
                producto_id: it.producto_id || it.id,
                categoria_id: it.categoria_id, 
                descripcion: it.descripcion || it.name,
                cantidad: Number(it.cantidad || it.quantity),
                precio_unitario: Number(it.precio_unitario || it.price),
                precio_original: Number(it.precio_original || it.precio_unitario || it.price),
                subtotal: Number(it.subtotal || (it.cantidad * it.precio_unitario)),
                tipo_igv_codigo: it.tipo_igv_codigo || '10',
                codigo_unidad: it.codigo_unidad || 'ZZ',
                valor_unitario: Number(it.valor_unitario),
                igv_item: Number(it.igv_item),
                descuento_item: Number(it.descuento_item || 0),
                estado: validStatus, 
                estado_id: it.estado_id || (ORDER_STATUS_MAP[validStatus as OrderStatus] || 2), 
                color: it.color || '',
                defectos: it.defectos || '',
                observaciones: obs,
                url_audio: it.url_audio || it.audioNote,
                peso: (it.peso_estimado || 0.400) * Number(it.cantidad || it.quantity),
                fecha_entrega_item: it.fecha_entrega_item || it.itemDeliveryDate,
                es_ajuste: true, 
                registrado_por: userAudit
            };
        });
        const { error: insError } = await supabase.from('items_venta').insert(itemsToInsert);
        if (insError) {
            throw insError;
        }
    }

    // 3. Actualizar totales en la venta
    const { error: vError } = await supabase.from('ventas').update({
        total: totals.total,
        total_igv: totals.igv,
        total_gravada: totals.gravada,
        total_exonerada: totals.exonerada,
        total_inafecta: totals.inafecta
    }).eq('id', orderId);

    if (vError) {
        throw vError;
    }
    invalidateCache('invoices');
};

/**
 * Ajusta el saldo a favor de un cliente
 */
export const dbAdjustClientBalance = async (clientId: string, delta: number) => {
    const { data: client, error: fetchErr } = await supabase
        .from('clientes')
        .select('saldo_a_favor')
        .eq('id', clientId)
        .maybeSingle();
    
    if (fetchErr) throw fetchErr;
    
    const currentSaldo = Number(client?.saldo_a_favor || 0);
    const newSaldo = currentSaldo + delta;

    const { error } = await supabase
        .from('clientes')
        .update({ saldo_a_favor: newSaldo })
        .eq('id', clientId);
    
    if (error) throw error;
};

export const dbGetPaymentsReport = async (startDate: string, endDate: string): Promise<any[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    
    try {
        const { data, error } = await supabase
            .from('pagos_venta')
            .select(`
                id,
                monto,
                fecha_pago,
                registrado_por,
                metodo_pago_id,
                metodos_pago(nombre),
                ventas!inner(
                    id,
                    codigo_orden,
                    correlativo,
                    fecha_recepcion,
                    total,
                    sucursal_id,
                    clientes(id, nombres, apellidos, razon_social)
                )
            `)
            .eq('ventas.sucursal_id', branchId)
            .gte('fecha_pago', `${startDate}T00:00:00-05:00`)
            .lte('fecha_pago', `${endDate}T23:59:59-05:00`)
            .order('fecha_pago', { ascending: false });

        if (error) throw error;

        return (data || []).map(p => {
            const v = p.ventas as any;
            const c = v.clientes;
            const clientName = c ? (c.razon_social || `${c.nombres || ''} ${c.apellidos || ''}`.trim()) : 'CLIENTE VARIOS';
            
            return {
                id: p.id,
                amount: Number(p.monto),
                date: p.fecha_pago,
                methodId: p.metodo_pago_id,
                methodName: (p.metodos_pago as any)?.nombre || (Array.isArray(p.metodos_pago) ? (p.metodos_pago as any)[0]?.nombre : 'OTROS'),
                userName: p.registrado_por || 'SISTEMA',
                ticket: v.codigo_orden || v.correlativo?.toString() || '---',
                clientName: fixEncoding(clientName).toUpperCase(),
                invoice: v // Para mantener compatibilidad si se necesita ver el detalle
            };
        });
    } catch (error) {
        console.error("Error fetching payments report:", error);
        return [];
    }
};

export const dbGetInvoicesForReport = async (filter: 'TO_COLLECT' | 'TO_DELIVER' | 'ALL'): Promise<Invoice[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    try {
        const holdingId = await ensureHoldingId(branchId);
        let query = supabase
            .from('ventas')
            .select('*, clientes(*), items_venta(*)')
            .eq('sucursal_id', branchId)
            .eq('empresa_holding_id', holdingId)
            .neq('estado', 'CANCELADO')
            .neq('tipo_documento_codigo', '07') // Excluir notas de crédito
            .order('fecha_recepcion', { ascending: false })
            .limit(1000);

        const { data: ventas, error: vError } = await query;
        if (vError) throw vError;

        const ventaIds = (ventas || []).map(v => v.id);
        const { data: todosLosPagos } = await supabase
            .from('pagos_venta')
            .select('id, venta_id, monto, metodo_pago_id, usuario_id, registrado_por, fecha_pago, metodos_pago(nombre)')
            .in('venta_id', ventaIds);

        const mapped = (ventas || []).map(v => {
            const pagosVenta = (todosLosPagos || []).filter(p => p.venta_id === v.id);
            const totalPagado = pagosVenta.reduce((sum, p) => sum + Number(p.monto), 0);
            const total = Number(v.total) || 0;
            const disc = Number(v.descuento) || 0;
            const debt = total - disc - totalPagado;

            const c = normalizeRelation(v.clientes);

            // Mapping simple fields for report
            return {
                ...v,
                date: v.fecha_recepcion || v.fecha || new Date().toISOString(),
                client: c ? {
                    ...c,
                    name: fixEncoding(c.nombres || 'CLIENTE VARIOS').toUpperCase(),
                    phone: c.telefono || ''
                } : null,
                prePaymentAmount: totalPagado,
                debt: debt,
                payments: pagosVenta,
                totals: {
                    total: total,
                    igv: Number(v.total_igv) || 0,
                    subtotal: Number(v.total_gravada) || 0
                }
            } as any;
        });

        if (filter === 'TO_COLLECT') {
            return mapped.filter(inv => inv.debt > 0.01);
        }
        if (filter === 'TO_DELIVER') {
            return mapped.filter(inv => inv.orderStatus !== 'ENTREGADO');
        }
        return mapped;
    } catch (error) {
        console.error("Error fetching report data:", error);
        return [];
    }
};

export const dbGetInvoices = async (page: number = 1, pageSize: number = 50, searchTerm: string = ''): Promise<{ invoices: Invoice[], total: number }> => {
    const branchId = getActiveBranchId();
    if (!branchId) return { invoices: [], total: 0 };

    const cacheKey = `invoices_${branchId}_p${page}_s${pageSize}_q${searchTerm}`;
    const cached = getCached(cacheKey, 30000); // 30s TTL for invoices to optimize egress
    if (cached) return cached;
    try {
        const holdingId = await ensureHoldingId(branchId);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('ventas')
            .select('*, clientes(id, sucursal_id, empresa_holding_id, tipo_documento, dni, nombres, apellidos, telefono, direccion, razon_social, ruc, email, puntos, google_maps_url, latitud, longitud), items_venta(*)', { count: 'exact' })
            .eq('sucursal_id', branchId)
            .eq('empresa_holding_id', holdingId);

        if (searchTerm) {
            let intelligentSearch = searchTerm.trim().toUpperCase();
            
            // Check if it's a date pattern (YYYY-MM-DD) or range (YYYY-MM-DD:YYYY-MM-DD)
            const datePattern = /^\d{4}-\d{2}-\d{2}$/;
            const rangePattern = /^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/;

            if (rangePattern.test(intelligentSearch)) {
                const [, start, end] = intelligentSearch.match(rangePattern)!;
                query = query.gte('fecha_recepcion', `${start}T00:00:00-05:00`)
                             .lte('fecha_recepcion', `${end}T23:59:59-05:00`);
            } else if (datePattern.test(intelligentSearch)) {
                query = query.gte('fecha_recepcion', `${intelligentSearch}T00:00:00-05:00`)
                             .lte('fecha_recepcion', `${intelligentSearch}T23:59:59-05:00`);
            } else {
                const ticketPattern = /^([A-Z]+)[-]?([0-9]+)$/i;
                const match = intelligentSearch.match(ticketPattern);
                let searchPattern = `%${intelligentSearch}%`;
                
                if (match) {
                    // Si es algo como H3, buscamos H%3 para que coincida con H-00003
                    searchPattern = `%${match[1]}%${match[2]}%`;
                }

                // 1. Buscar IDs de clientes que coincidan
                const { data: matchedClients } = await supabase
                    .from('clientes')
                    .select('id')
                    .or(`nombres.ilike.%${searchTerm}%,apellidos.ilike.%${searchTerm}%,telefono.ilike.%${searchTerm}%`)
                    .eq('sucursal_id', branchId);
                const clientIds = matchedClients?.map(c => c.id) || [];

                // 2. Construir filtros para columnas de TEXTO (ilike funciona nativamente)
                // codigo_orden y serie son texto.
                let filters = [
                    `codigo_orden.ilike.${searchPattern}`,
                    `serie.ilike.%${searchTerm}%`
                ];

                // 3. Agregar búsqueda por clientes si hay coincidencias
                if (clientIds.length > 0) {
                    const idsString = clientIds.map(id => `"${id}"`).join(',');
                    filters.push(`cliente_id.in.(${idsString})`);
                }

                // 4. Si el término de búsqueda es PURAMENTE numérico, podemos buscar en correlativos numéricos
                // Pero como ilike requiere texto, y PostgREST no permite cast dentro del OR string de forma sencilla,
                // nos apoyamos en codigo_orden que ya suele contener el número formateado.
                const numericSearch = searchTerm.replace(/[^0-9]/g, '');
                if (numericSearch && /^\d+$/.test(searchTerm.trim())) {
                    filters.push(`correlativo.eq.${numericSearch}`);
                    filters.push(`correlativo_interno.eq.${numericSearch}`);
                }

                query = query.or(filters.join(','));
            }
        }

        const { data: ventas, count, error: vError } = await query
            .order('fecha_recepcion', { ascending: false })
            .range(from, to);

        if (vError) {
            console.error("Error fetching invoices data:", vError);
            return { invoices: [], total: 0 };
        }

        const ventaIds = (ventas || []).map(v => v.id);
        const { data: todosLosPagos } = await supabase
            .from('pagos_venta')
            .select('id, venta_id, monto, metodo_pago_id, usuario_id, registrado_por, fecha_pago, metodos_pago(nombre)')
            .in('venta_id', ventaIds);
        
        const mappedInvoices = (ventas || []).map(v => {
            const c = normalizeRelation(v.clientes);
            const docType = (v.tipo_documento_codigo || InvoiceType.NOTA_VENTA) as InvoiceType;
            const pagosVenta = (todosLosPagos || []).filter(p => p.venta_id === v.id);
            const totalPagado = pagosVenta.reduce((sum, p) => sum + Number(p.monto), 0);
            
            const originStr = (v.origen === 'DELIVERY' ? 'DELIVERY' : 'TIENDA');

            return { 
                ...v, 
                id: v.id, 
                sucursal_id: v.sucursal_id, 
                empresa_holding_id: v.empresa_holding_id, 
                ordenNumber: v.codigo_orden || '---', 
                ticketNumber: v.codigo_orden || '---',
                orderCorrelativoRaw: v.correlativo_interno, 
                serie: v.serie || 'NV01', 
                correlativo: v.correlativo || 0, 
                type: docType, 
                notes: v.notes || '',
                status: v.status || '',
                relatedNcId: v.related_nc_id || null,
                client: c ? { 
                    id: c.id, 
                    sucursal_id: c.sucursal_id, 
                    empresa_holding_id: c.empresa_holding_id, 
                    docType: c.tipo_documento || (c.dni?.length === 11 ? 'RUC' : 'DNI'), 
                    docNumber: c.dni || '00000000', 
                    name: fixEncoding(`${c.nombres || ''} ${c.apellidos || ''}`).trim().toUpperCase() || 'CLIENTE VARIOS', 
                    phone: c.telefono || '', 
                    address: fixEncoding(c.direccion || '-'), 
                    points: c.puntos || 0, 
                    googleMapsUrl: c.google_maps_url, 
                    latitude: Number(c.latitud), 
                    longitude: Number(c.longitud) 
                } : { id: 'temp', name: 'CLIENTE VARIOS', docNumber: '00000000', docType: '-', address: '-', points: 0, sucursal_id: v.sucursal_id }, 
                items: (v.items_venta || []).map((it: any) => ({ 
                    ...it, 
                    id: it.id, 
                    producto_id: it.producto_id,
                    name: fixEncoding(it.descripcion), 
                    category: it.categoria_nombre || (it as any).category || 'GENERAL',
                    price: Number(it.precio_unitario), 
                    quantity: Number(it.cantidad), 
                    subtotal: Number(it.subtotal), 
                    status: it.estado,
                    estado_id: it.estado_id,
                    isAnulado: it.estado_id === 9 || it.estado === 'CANCELADO',
                    details: it.observaciones,
                    item_id_raw: it.id,
                    es_ajuste: it.es_ajuste || false,
                    itemDeliveryDate: it.fecha_entrega_item,
                    audioNote: it.url_audio
                })), 
                payments: pagosVenta.map(p => ({ 
                    id: p.id, 
                    metodo_pago_id: p.metodo_pago_id, 
                    metodo_pago_name: (p.metodos_pago as any)?.nombre || 'EFECTIVO',
                    monto: Number(p.monto), 
                    date: p.fecha_pago,
                    usuario_id: p.usuario_id,
                    registrado_por: p.registrado_por 
                })), 
                totals: { 
                    total: Number(v.total) || 0, 
                    igv: Number(v.total_igv) || 0, 
                    gravada: Number(v.total_gravada) || 0, 
                    exonerada: Number(v.total_exonerada) || 0, 
                    inafecta: Number(v.total_inafecta) || 0 
                }, 
                date: v.fecha_recepcion || v.fecha || new Date().toISOString(), 
                fecha_emision: v.fecha_emision,
                deliveryDate: v.fecha_entrega,
                itemDeliveryDate: v.fecha_entrega, // Fallback for general delivery date if needed
                orderStatus: (v.estado as OrderStatus) || 'PENDIENTE', 
                sunatStatus: v.sunat_status || (docType === InvoiceType.NOTA_VENTA ? 'INTERNAL' : 'PENDING'), 
                prePaymentAmount: totalPagado, 
                descuento: Number(v.descuento) || 0,
                origin: originStr as any, 
                pickupId: v.pickup_id,
                operario_id: v.operario_id,
                entregado_at: v.entregado_at,
                relatedDocument: v.documento_referencia_id,
                sunatResponse: {
                    success: v.sunat_status === 'ACCEPTED',
                    description: v.sunat_description,
                    hash: v.sunat_hash,
                    pdfUrl: v.sunat_pdf_url,
                    xmlUrl: v.sunat_xml_url,
                    cdrUrl: v.sunat_cdr_url
                },
                qrCodeData: v.qr_code_data || null
            };
        });

        const result = { invoices: mappedInvoices, total: count || 0 };
        setCache(cacheKey, result);
        return result;
    } catch (e) { return { invoices: [], total: 0 }; }
};

/**
 * Obtiene estadísticas agregadas para el dashboard de la sucursal
 * Esto es mucho más escalable que cargar todas las ventas en el cliente
 */
export const dbGetBranchDashboardStats = async (days: number = 30): Promise<any> => {
    const branchId = getActiveBranchId();
    if (!branchId) return null;
    
    try {
        const { data, error } = await supabase.rpc('get_branch_dashboard_stats', {
            p_sucursal_id: branchId,
            p_days: days
        });
        
        if (error) throw error;
        return data;
    } catch (e) {
        console.error("Error fetching branch dashboard stats:", e);
        return null;
    }
};

export const dbGetOrderStats = async (): Promise<{ toCollect: number, toDeliver: number }> => {
    const branchId = getActiveBranchId();
    if (!branchId) return { toCollect: 0, toDeliver: 0 };
    
    const cacheKey = `order_stats_${branchId}`;
    const cached = getCached(cacheKey, 15000); // 15s TTL
    if (cached) return cached;
    
    try {
        // Obtenemos todas las ventas no entregadas o con saldo
        // NOTA: Para escalabilidad extrema esto debería ser un RPC o una vista agregada
        // pero para volúmenes normales esto funciona bien.
        const { data: sales, error } = await supabase
            .from('ventas')
            .select('id, total, descuento, estado, pagos_venta(monto)')
            .eq('sucursal_id', branchId)
            .neq('estado', 'CANCELADO')
            .or('estado.neq.ENTREGADO,total.gt.0'); // Aproximación rápida

        if (error) throw error;

        let toCollect = 0;
        let toDeliver = 0;

        sales?.forEach((v: any) => {
            const total = Number(v.total || 0);
            const disc = Number(v.descuento || 0);
            const paid = (v.pagos_venta || []).reduce((sum: number, p: any) => sum + Number(p.monto), 0);
            const balance = total - disc - paid;

            if (balance > 0.01) toCollect += balance;
            if (v.estado !== 'ENTREGADO') toDeliver += 1;
        });

        const result = { toCollect, toDeliver };
        setCache(cacheKey, result);
        return result;
    } catch (e) {
        console.error("Error fetching order stats:", e);
        return { toCollect: 0, toDeliver: 0 };
    }
};

export const dbGetDashboardReportData = async (startDate: string, endDate: string) => {
    const branchId = getActiveBranchId();
    if (!branchId) return { invoices: [], payments: [], expenses: [] };

    const cacheKey = `dashboard_report_${branchId}_${startDate}_${endDate}`;
    const cached = getCached(cacheKey, 30000); // 30s TTL
    if (cached) return cached;

    try {
        const holdingId = await ensureHoldingId(branchId);
        
        // 1. Obtener Ventas en el rango (usando fecha_recepcion o fecha)
        const { data: ventas, error: vError } = await supabase
            .from('ventas')
            .select('*, clientes(id, nombres, apellidos), items_venta(*)')
            .eq('sucursal_id', branchId)
            .neq('estado', 'CANCELADO')
            .gte('fecha_recepcion', `${startDate}T00:00:00.000Z`)
            .lte('fecha_recepcion', `${endDate}T23:59:59.999Z`);

        if (vError) throw vError;

        // 2. Obtener Pagos de Ventas en el rango (Recaudos) - TABLA pagos_venta
        const { data: pagos, error: pError } = await supabase
            .from('pagos_venta')
            .select('*, ventas(codigo_orden, cliente_id, clientes(nombres, apellidos)), metodos_pago(nombre)')
            .eq('sucursal_id', branchId)
            .gte('fecha_pago', `${startDate}T00:00:00.000Z`)
            .lte('fecha_pago', `${endDate}T23:59:59.999Z`);

        if (pError) throw pError;

        // 3. Obtener Egresos en el rango
        const { data: gastos, error: gError } = await supabase
            .from('egresos')
            .select('*')
            .eq('sucursal_id', branchId)
            .gte('fecha_gasto', `${startDate}T00:00:00.000Z`)
            .lte('fecha_gasto', `${endDate}T23:59:59.999Z`);

        if (gError) throw gError;

        // Mapear ventas al formato Invoice
        const mappedInvoices = (ventas || []).map(v => {
            const c = normalizeRelation(v.clientes);
            return {
                ...v,
                date: v.fecha_recepcion || v.fecha,
                client: c ? {
                    ...c,
                    name: fixEncoding(c.nombres || 'CLIENTE'),
                } : null,
                totals: { total: Number(v.total) },
                items: (v.items_venta || []).map((it: any) => ({ ...it, category: it.categoria_nombre })),
                payments: [] 
            } as any;
        });

        const result = {
            invoices: mappedInvoices,
            payments: (pagos || []).map(p => ({
                ...p,
                monto: Number(p.monto),
                metodo_pago_name: p.metodos_pago?.nombre || 'EFECTIVO',
                venta_codigo: p.metodos_pago?.nombre ? p.ventas?.codigo_orden : p.ventas?.codigo_orden,
                cliente_nombre: p.ventas?.clientes ? `${p.ventas.clientes.nombres} ${p.ventas.clientes.apellidos}` : 'CLIENTE'
            })),
            expenses: (gastos || []).map(g => ({
                ...g,
                amount: Number(g.monto),
                category: g.categoria,
                description: g.descripcion,
                date: g.fecha_gasto
            }))
        };
        
        setCache(cacheKey, result);
        return result;
    } catch (e) {
        console.error("Error in dbGetDashboardReportData:", e);
        return { invoices: [], payments: [], expenses: [] };
    }
};

export const dbGetInvoiceFull = async (id: string): Promise<Invoice | null> => {
    const { data: v, error } = await supabase.from('ventas').select('*, clientes(*), items_venta(*)').eq('id', id).maybeSingle();
    if (error || !v) return null;
    const { data: pagos } = await supabase.from('pagos_venta').select('monto, metodo_pago_id, usuario_id, registrado_por, fecha_pago').eq('venta_id', id);
    const totalPagado = (pagos || []).reduce((sum, p) => sum + Number(p.monto), 0);
    const c = normalizeRelation(v.clientes);
    const docType = (v.tipo_documento_codigo || InvoiceType.NOTA_VENTA) as InvoiceType;
    return { 
        ...v, 
        id: v.id, 
        sucursal_id: v.sucursal_id, 
        empresa_holding_id: v.empresa_holding_id, 
        ordenNumber: v.codigo_orden || '---', 
        ticketNumber: v.codigo_orden || '---',
        orderCorrelativoRaw: v.correlativo_interno, 
        serie: v.serie || 'NV01', 
        correlativo: v.correlativo || 0, 
        type: docType, 
        client: c ? { 
            id: c.id, 
            sucursal_id: c.sucursal_id, 
            empresa_holding_id: c.empresa_holding_id, 
            docType: c.tipo_documento || (c.dni?.length === 11 ? 'RUC' : 'DNI'), 
            docNumber: c.dni || '00000000', 
            name: fixEncoding(`${c.nombres || ''} ${c.apellidos || ''}`).trim().toUpperCase() || 'CLIENTE VARIOS', 
            ruc: c.ruc,
            razon_social: c.razon_social,
            phone: c.telefono || '', 
            address: fixEncoding(c.direccion || '-'), 
            points: c.puntos || 0, 
            googleMaps_url: c.google_maps_url, 
            latitude: Number(c.latitud), 
            longitude: Number(c.longitud) 
        } : { id: 'temp', name: 'CLIENTE VARIOS', docNumber: '00000000', docType: '-', address: '-', points: 0, sucursal_id: v.sucursal_id }, 
        items: (v.items_venta || []).map((it: any) => ({ 
            ...it, 
            id: it.id, 
            producto_id: it.producto_id,
            name: fixEncoding(it.descripcion), 
            price: Number(it.precio_unitario), 
            quantity: Number(it.cantidad), 
            subtotal: Number(it.subtotal), 
            status: it.estado,
            estado_id: it.estado_id,
            isAnulado: it.estado_id === 9 || it.estado === 'CANCELADO',
            audioNote: it.url_audio
        })), 
        payments: (pagos || []).map(p => ({ 
            metodo_pago_id: p.metodo_pago_id, 
            monto: Number(p.monto), 
            date: p.fecha_pago,
            usuario_id: p.usuario_id,
            registrado_por: p.registrado_por
        })),
        totals: { 
            total: Number(v.total) || 0, 
            igv: Number(v.total_igv) || 0, 
            gravada: Number(v.total_gravada) || 0, 
            exonerada: Number(v.total_exonerada) || 0, 
            inafecta: Number(v.total_inafecta) || 0 
        }, 
        date: v.fecha_recepcion || new Date().toISOString(), 
        fecha_emision: v.fecha_emision,
        orderStatus: (v.estado as OrderStatus) || 'PENDIENTE', 
        sunatStatus: v.sunat_status || (docType === InvoiceType.NOTA_VENTA ? 'INTERNAL' : 'PENDING'), 
        prePaymentAmount: totalPagado, 
        descuento: Number(v.descuento) || 0,
        origin: (v.origen === 'DELIVERY' ? 'DELIVERY' : 'TIENDA') as any, 
        pickupId: v.pickup_id,
        operario_id: v.operario_id,
        entregado_at: v.entregado_at,
        relatedDocument: v.documento_referencia_id,
        relatedNcId: v.related_nc_id,
        notes: v.notes,
        sunatResponse: {
            success: v.sunat_status === 'ACCEPTED',
            description: v.sunat_description,
            hash: v.sunat_hash,
            pdfUrl: v.sunat_pdf_url,
            xmlUrl: v.sunat_xml_url,
            cdrUrl: v.sunat_cdr_url
        },
        qrCodeData: v.qr_code_data || null
    };
};

export const dbUpdateInvoiceStatus = async (id: string, status: OrderStatus, photos?: string[]) => {
    const payload: any = { estado: status, estado_id: ORDER_STATUS_MAP[status] };
    if (status === 'ENTREGADO') {
        payload.entregado_at = new Date().toISOString();
    }
    if (photos) { payload.url_foto_evidencia_1 = photos[0] || null; payload.url_foto_evidencia_2 = photos[1] || null; payload.url_foto_evidencia_3 = photos[2] || null; }
    const { error } = await supabase.from('ventas').update(payload).eq('id', id);
    if (error) throw error;
    invalidateCache('invoices');
};

export const dbUpdateInvoice = async (id: string, updates: Partial<Invoice>) => {
    const payload: any = {};
    
    if (updates.orderStatus !== undefined) {
        payload.estado = updates.orderStatus;
        payload.estado_id = ORDER_STATUS_MAP[updates.orderStatus as OrderStatus];
    }
    if (updates.notes !== undefined) {
        payload.notes = updates.notes;
    }
    // Usamos documento_referencia_id para vincular con la NC
    if (updates.relatedNcId !== undefined) {
        payload.documento_referencia_id = updates.relatedNcId;
    }
    // Si se intenta anular, usamos sunat_status o estado dependiendo de la lógica de negocio
    // Como 'status' no existe, lo omitimos o lo mapeamos a sunat_status si es pertinente
    if ((updates as any).status === 'anulado') {
        payload.sunat_status = 'VOIDED';
    }
    
    const { error } = await supabase.from('ventas').update(payload).eq('id', id);
    if (error) throw error;
    invalidateCache('invoices');
};

export const dbAddPayment = async (ventaId: string, amount: number, methodName: string, pUserId?: string | null, pCashSessionId?: string | null) => {
    const branchId = getActiveBranchId();
    if (!branchId) throw new Error("No hay contexto de sucursal");
    const holdingId = await ensureHoldingId(branchId);
    const user = localStorage.getItem('sislav_current_user_name') || 'SISTEMA';
    
    // 1. Obtener método de pago
    const cleanMethodName = methodName.trim().toUpperCase();
    const { data: metodoExistente } = await supabase.from('metodos_pago')
        .select('id')
        .eq('sucursal_id', branchId)
        .ilike('nombre', cleanMethodName)
        .maybeSingle();

    let metodoId: string;

    if (!metodoExistente) {
        // AUTO-CREACIÓN PARA MÉTODOS ESTÁNDAR SI NO EXISTEN (Resiliencia)
        const commonMethods: Record<string, string> = {
            'YAPE': '003',
            'PLIN': '003',
            'EFECTIVO': '009',
            'TARJETA': '006',
            'TRANSFERENCIA': '003',
            'DEPÓSITO': '001'
        };

        if (commonMethods[cleanMethodName]) {
            console.log(`✨ Creando método de pago estándar faltante: ${cleanMethodName}`);
            const { data: nuevoMetodo, error: createError } = await supabase.from('metodos_pago').insert({
                sucursal_id: branchId,
                empresa_holding_id: holdingId,
                nombre: cleanMethodName,
                activo: true,
                codigo_sunat: commonMethods[cleanMethodName],
                fecha_registro: new Date().toISOString()
            }).select('id').single();

            if (createError || !nuevoMetodo) {
                console.error("Error auto-creando método de pago:", createError);
                throw new Error("Método de pago no encontrado y no se pudo crear: " + methodName);
            }
            metodoId = nuevoMetodo.id;
        } else {
            throw new Error("Método de pago no encontrado: " + methodName);
        }
    } else {
        metodoId = metodoExistente.id;
    }
    
    // 2. Insertar pago
    let userId = pUserId || getActiveUserId();
    if (!userId) {
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData.session?.user?.id || null;
    }

    let finalCashSessionId = pCashSessionId;
    if (!finalCashSessionId) {
        const activeSession = await dbGetActiveCashClosing();
        if (activeSession) {
            finalCashSessionId = activeSession.id;
        }
    }

    const { error: payError } = await supabase.from('pagos_venta').insert({ 
        venta_id: ventaId, 
        metodo_pago_id: metodoId, 
        monto: amount, 
        registrado_por: user,
        usuario_id: userId,
        sucursal_id: branchId,
        empresa_holding_id: holdingId,
        fecha_pago: getPeruTimestamp(),
        cash_session_id: finalCashSessionId || null
    });
    if (payError) throw payError;

    // 3. Sumar puntos al cliente
    try {
        const { data: venta } = await supabase.from('ventas').select('cliente_id').eq('id', ventaId).single();
        if (venta && venta.cliente_id && !venta.cliente_id.startsWith('temp-')) {
            await dbAddPointsToClient(venta.cliente_id, amount);
        }
    } catch (e) {
        console.error("Error al sumar puntos (dbAddPayment):", e);
    }
};

export const dbAddPointsToClient = async (clientId: string, paymentAmount: number) => {
    if (!clientId || clientId.startsWith('temp-')) return;
    
    const branchId = getActiveBranchId();
    if (!branchId) return;

    try {
        const { data: sucursal } = await supabase.from('sucursales').select('puntos_equivalencia').eq('id', branchId).single();
        const equivalency = sucursal?.puntos_equivalencia || 10;
        const pointsToAdd = Math.floor(paymentAmount / equivalency);
        
        if (pointsToAdd > 0) {
            const { data: client } = await supabase.from('clientes').select('puntos').eq('id', clientId).single();
            const currentPoints = client?.puntos || 0;
            await supabase.from('clientes').update({ puntos: currentPoints + pointsToAdd }).eq('id', clientId);
        }
    } catch (e) {
        console.error("Error in dbAddPointsToClient:", e);
    }
};

export const dbGetPausedSales = async (): Promise<PausedSale[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    const { data } = await supabase.from('ventas_pausadas').select('*').eq('sucursal_id', branchId).order('fecha_registro', { ascending: false });
    return (data || []).map(ps => ({ 
        id: ps.id, 
        date: ps.fecha_registro, 
        client: ps.datos_json.client, 
        cart: ps.datos_json.cart, 
        docType: ps.datos_json.docType, 
        sucursal_id: ps.sucursal_id,
        es_cotizacion: ps.es_cotizacion ?? ps.datos_json.es_cotizacion ?? false,
        cliente_nombre: ps.cliente_nombre || ps.datos_json.client?.name || 'PUBLICO GENERAL',
        numero_cotizacion: ps.numero_cotizacion || ps.datos_json.numero_cotizacion
    }));
};

export const dbSavePausedSale = async (sale: any) => {
    const branchId = getActiveBranchId();
    const holdingId = await ensureHoldingId(branchId!);
    const isQuote = sale.es_cotizacion || false;
    const clientName = sale.client?.name || 'PUBLICO GENERAL';
    
    let nextNumber = null;
    if (isQuote) {
        // Obtenemos el último número de cotización
        const { data: lastQuote } = await supabase
            .from('ventas_pausadas')
            .select('numero_cotizacion')
            .eq('sucursal_id', branchId)
            .eq('es_cotizacion', true)
            .order('numero_cotizacion', { ascending: false })
            .limit(1);
            
        nextNumber = (lastQuote?.[0]?.numero_cotizacion || 0) + 1;
    }
    
    const { data, error } = await supabase.from('ventas_pausadas').insert({ 
        sucursal_id: branchId, 
        empresa_holding_id: holdingId, 
        registrado_por: 'SISTEMA', 
        es_cotizacion: isQuote,
        cliente_nombre: clientName,
        numero_cotizacion: nextNumber,
        datos_json: { 
            client: sale.client, 
            cart: sale.cart, 
            docType: sale.docType,
            es_cotizacion: isQuote,
            numero_cotizacion: nextNumber
        } 
    }).select();

    if (error || !data?.[0]) return null;

    const row = data[0];
    return {
        id: row.id,
        date: row.fecha_registro,
        client: row.datos_json.client,
        cart: row.datos_json.cart,
        docType: row.datos_json.docType,
        sucursal_id: row.sucursal_id,
        es_cotizacion: row.es_cotizacion,
        cliente_nombre: row.cliente_nombre,
        numero_cotizacion: row.numero_cotizacion
    };
};

export const dbGetPaymentsInRange = async (startDate: string, endDate: string): Promise<any[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    
    const { data, error } = await supabase
        .from('pagos_venta')
        .select('*, ventas(*, clientes(*))')
        .eq('sucursal_id', branchId)
        .gte('fecha_pago', `${startDate}T00:00:00`)
        .lte('fecha_pago', `${endDate}T23:59:59`);
        
    if (error) {
        console.error("Error fetching payments in range:", error.message);
        return [];
    }
    
    return (data || []).map(p => {
        const v = p.ventas;
        const c = normalizeRelation(v?.clientes);
        return {
            id: p.id,
            venta_id: p.venta_id,
            metodo_pago_id: p.metodo_pago_id,
            monto: Number(p.monto),
            date: p.fecha_pago,
            invoice: v ? {
                id: v.id,
                ordenNumber: v.codigo_orden,
                serie: v.serie,
                correlativo: v.correlativo,
                type: v.tipo_documento_codigo,
                date: v.fecha_recepcion,
                client: c ? { name: c.nombres, docNumber: c.dni } : { name: 'CLIENTE VARIOS', docNumber: '00000000' }
            } : null
        };
    });
};

export const dbDeletePausedSale = async (id: string) => { await supabase.from('ventas_pausadas').delete().eq('id', id); };

export const dbGetMachines = async (): Promise<Machine[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    
    const cacheKey = `machines_${branchId}`;
    const cached = getCached(cacheKey, 10000); // 10s TTL
    if (cached) return cached;
    
    const { data, error } = await supabase.from('maquinas').select('*').eq('sucursal_id', branchId).eq('activo', true);
    if (error) return [];
    const result = (data || []).map(m => ({
        id: m.id,
        sucursal_id: m.sucursal_id,
        empresa_holding_id: m.empresa_holding_id,
        name: m.nombre,
        type: m.tipo,
        capacityKg: m.capacidad_kg,
        estado_operativo: m.estado_operativo,
        imageUrl: m.url_imagen,
        totalCycles: m.total_ciclos,
        totalKg: m.total_kg,
        totalMinutes: m.total_minutos,
        currentOrderId: m.orden_actual_id,
        startTime: m.fecha_inicio_proceso,
        estimatedDuration: m.duracion_estimada_minutos,
        maintenanceIntervalHours: m.intervalo_mantenimiento_horas,
        maintenanceIntervalKg: m.intervalo_mantenimiento_kg,
        maintenanceIntervalCycles: m.intervalo_mantenimiento_ciclos,
        activo: m.activo,
        estado: m.estado
    }));
    
    setCache(cacheKey, result);
    return result;
};

export const dbSaveMachine = async (m: any) => {
    const branchId = m.sucursal_id || getActiveBranchId();
    if (!branchId) throw new Error("No hay contexto de sucursal");
    const holdingId = await ensureHoldingId(branchId);
    
    const { data, error } = await supabase.from('maquinas').insert({
        sucursal_id: branchId,
        empresa_holding_id: holdingId,
        nombre: m.name,
        tipo: m.type,
        capacidad_kg: m.capacityKg || m.capacidad_kg,
        estado_operativo: m.estado_operativo,
        url_imagen: m.imageUrl,
        intervalo_mantenimiento_horas: m.maintenanceIntervalHours,
        intervalo_mantenimiento_kg: m.maintenanceIntervalKg,
        intervalo_mantenimiento_ciclos: m.maintenanceIntervalCycles,
        activo: true,
        estado: 'OPERATIVO'
    }).select().single();
    if (error) throw error;
    invalidateCache(`machines_${branchId}`);
    return data;
};

export const dbUpdateMachine = async (id: string, updates: Partial<Machine>) => {
    const payload: any = {};
    if (updates.name) payload.nombre = updates.name;
    if (updates.estado_operativo) payload.estado_operativo = updates.estado_operativo;
    if (updates.currentOrderId !== undefined) payload.orden_actual_id = updates.currentOrderId;
    if (updates.startTime !== undefined) payload.fecha_inicio_proceso = updates.startTime;
    if (updates.estimatedDuration !== undefined) payload.duracion_estimada_minutos = updates.estimatedDuration;
    if (updates.activo !== undefined) payload.activo = updates.activo;
    if (updates.totalCycles !== undefined) payload.total_ciclos = updates.totalCycles;
    if (updates.totalKg !== undefined) payload.total_kg = updates.totalKg;
    if (updates.totalMinutes !== undefined) payload.total_minutos = updates.totalMinutes;
    if (updates.imageUrl !== undefined) payload.url_imagen = updates.imageUrl;
    if (updates.maintenanceIntervalHours !== undefined) payload.intervalo_mantenimiento_horas = updates.maintenanceIntervalHours;
    if (updates.maintenanceIntervalKg !== undefined) payload.intervalo_mantenimiento_kg = updates.maintenanceIntervalKg;
    if (updates.maintenanceIntervalCycles !== undefined) payload.intervalo_mantenimiento_ciclos = updates.maintenanceIntervalCycles;
    
    const { error } = await supabase.from('maquinas').update(payload).eq('id', id);
    if (error) throw error;

    const branchId = getActiveBranchId();
    if (branchId) {
        invalidateCache(`machines_${branchId}`);
    }

    // Verificar y enviar alerta de mantenimiento de manera asíncrona sin bloquear la UI
    checkAndSendMachineMaintenanceAlert(id).catch(err => {
        console.error("⚠️ Falló verificar/enviar alerta de mantenimiento para la máquina:", err);
    });
};

export const checkAndSendMachineMaintenanceAlert = async (machineId: string) => {
    try {
        // 1. Obtener detalles del equipo
        const { data: machine, error: mErr } = await supabase
            .from('maquinas')
            .select('*')
            .eq('id', machineId)
            .single();

        if (mErr || !machine) {
            console.warn("⚠️ No se pudo obtener la máquina para verificar alertas:", mErr);
            return;
        }

        const empresaHoldingId = machine.empresa_holding_id;
        if (!empresaHoldingId) {
            console.warn("⚠️ El equipo no cuenta con empresa_holding_id asociado.");
            return;
        }

        // 2. Obtener el teléfono de contacto de empresas_holding
        const { data: holding, error: hErr } = await supabase
            .from('empresas_holding')
            .select('*')
            .eq('id', empresaHoldingId)
            .single();

        if (hErr || !holding) {
            console.warn("⚠️ No se pudo obtener la empresa holding para alertas:", hErr);
            return;
        }

        const phone = holding.telefono_contacto || holding.telefono;
        if (!phone) {
            console.warn("⚠️ La empresa holding no tiene configurado ningún teléfono de contacto.");
            return;
        }

        // 3. Cargar la configuración global de WhatsApp (Evolution API)
        const globalConfig = await getSaasGlobalConfig();
        const baseUrl = globalConfig.url_bot;
        const apiKey = globalConfig.apikey_bot;
        const instance = globalConfig.instancia_bot;

        if (!baseUrl || !apiKey || !instance) {
            console.warn("⚠️ Configuración global de bot de WhatsApp incompleta en saas_configuracion_global.");
            return;
        }

        // 4. Evaluar límites y porcentajes de mantenimiento
        const hoursUsed = (machine.total_minutos || 0) / 60;
        const maxHours = machine.intervalo_mantenimiento_horas || 0;
        const totalKg = machine.total_kg || 0;
        const maxKg = machine.intervalo_mantenimiento_kg || 0;
        const totalCycles = machine.total_ciclos || 0;
        const maxCycles = machine.intervalo_mantenimiento_ciclos || 0;

        let alertType: 'hours' | 'kg' | 'cycles' | null = null;
        let percentageUsed = 0;
        let currentVal = 0;
        let limitVal = 0;
        let concept = '';

        if (maxKg > 0) {
            const kgPercent = (totalKg / maxKg) * 100;
            if (kgPercent >= 90) {
                alertType = 'kg';
                percentageUsed = kgPercent;
                currentVal = totalKg;
                limitVal = maxKg;
                concept = 'KILOS';
            }
        }

        if (!alertType && maxHours > 0) {
            const hPercent = (hoursUsed / maxHours) * 100;
            if (hPercent >= 90) {
                alertType = 'hours';
                percentageUsed = hPercent;
                currentVal = hoursUsed;
                limitVal = maxHours;
                concept = 'HORAS DE TRABAJO';
            }
        }

        if (!alertType && maxCycles > 0) {
            const cPercent = (totalCycles / maxCycles) * 100;
            if (cPercent >= 90) {
                alertType = 'cycles';
                percentageUsed = cPercent;
                currentVal = totalCycles;
                limitVal = maxCycles;
                concept = 'CICLOS';
            }
        }

        if (!alertType) {
            // El uso actual está por debajo del 90% del límite de mantenimiento
            return;
        }

        // 5. Evitar reenvío de alertas duplicadas (usando localStorage con llave ID + tipo + límite para que si cambia de valor se pueda evaluar de nuevo)
        const stateKey = `machine_alert_sent_${machineId}_${alertType}_${limitVal}`;
        const alreadySent = localStorage.getItem(stateKey);
        if (alreadySent === 'true') {
            console.log(`ℹ️ Alerta para equipo ${machine.nombre} ya fue enviada a ${phone} para el umbral actual.`);
            return;
        }

        // 6. Construir y dar formato al mensaje
        const isExceeded = percentageUsed >= 100;
        const prefix = isExceeded ? '⚠️ MANTENIMIENTO VENCIDO ⚠️' : '🚨 ALERTA DE MANTENIMIENTO PRÓXIMO 🚨';
        const message = `${prefix}\n\n*Empresa:* ${holding.nombre_empresa?.toUpperCase() || ''}\n*Equipo:* ${machine.nombre?.toUpperCase()} (${machine.tipo})\n*Concepto:* ${concept}\n*Uso Actual:* ${currentVal.toFixed(1)} / ${limitVal.toFixed(1)} (${percentageUsed.toFixed(1)}%)\n\nEl equipo ha ${isExceeded ? 'superado' : 'alcanzado el 90% de'} su límite configurado de ${concept.toLowerCase()}. Por favor, programe un servicio técnico y mantenimiento preventivo a la brevedad para garantizar su óptimo funcionamiento.`;

        // Preparar el número para Evolution API
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 9) {
            const countryCode = (globalConfig.whatsapp_cod_pais || '51').replace(/\D/g, '') || '51';
            cleanPhone = `${countryCode}${cleanPhone}`;
        } else if (!phone.startsWith('+') && !cleanPhone.startsWith('51') && cleanPhone.length === 9) {
            cleanPhone = `51${cleanPhone}`;
        }

        console.log(`🚀 [Alerta Mantenimiento] Enviando mensaje a ${cleanPhone} de la máquina ${machine.nombre}`);

        const response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                baseUrl,
                apiKey,
                instance,
                phoneNumber: cleanPhone,
                text: message
            })
        });

        if (response.ok) {
            const resData = await response.json();
            if (resData.success) {
                localStorage.setItem(stateKey, 'true');
                console.log(`✅ [Alerta Mantenimiento Enviada] Registro guardado para máquina ${machine.nombre}`);
            }
        } else {
            console.warn("⚠️ Servidor falló al despachar mensaje de WhatsApp de alerta:", response.statusText);
        }

    } catch (e) {
        console.error("❌ Falló el ejecutor de alertas de máquina:", e);
    }
};

export const dbGetMachineImages = async (): Promise<MachineImage[]> => {
    const { data } = await supabase.from('global_cat_maquinas').select('*').eq('activo', true);
    return (data || []).map(m => ({ id: m.id, name: m.nombre, url: m.url, type: (m as any).tipo as any }));
};

export const dbAddMachineImage = async (img: any) => {
    const { error } = await supabase.from('global_cat_maquinas').insert({ nombre: img.name.toUpperCase(), tipo: img.type, url: img.url, activo: true });
    if (error) throw error;
};

export const dbUpdateMachineImage = async (id: string, updates: any) => {
    const payload: any = {};
    if (updates.name) payload.nombre = updates.name.toUpperCase();
    if (updates.type) payload.tipo = updates.type;
    if (updates.url) payload.url = updates.url;
    await supabase.from('global_cat_maquinas').update(payload).eq('id', id);
};

export const dbDeleteMachineImage = async (id: string) => {
    await supabase.from('global_cat_maquinas').update({ activo: false }).eq('id', id);
};

// --- EGRESOS ---

export const dbGetExpenses = async (page: number = 1, pageSize: number = 50): Promise<{ expenses: Expense[], total: number }> => {
    const branchId = getActiveBranchId();
    if (!branchId) return { expenses: [], total: 0 };
    
    try {
        let query = supabase
            .from('egresos')
            .select('id', { count: 'exact', head: true }) 
            .eq('sucursal_id', branchId);
            // .eq('activo', true); // COMENTADO POR ERROR 400

        const { count, error: countError } = await query;

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error = null } = await supabase
            .from('egresos')
            .select('*')
            .eq('sucursal_id', branchId)
            .order('fecha_gasto', { ascending: false })
            .range(from, to);

        if (error) return { expenses: [], total: 0 };
        
        const mappedExpenses = (data || []).map(e => ({
            id: e.id,
            sucursal_id: e.sucursal_id,
            description: e.descripcion,
            amount: Number(e.monto),
            date: e.fecha_gasto,
            category: e.categoria,
            paymentMethod: e.metodo_pago,
            evidencePhoto: e.url_evidencia,
            usuarioRegistro: e.registrado_por,
            usuarioId: e.usuario_id,
            cash_session_id: e.cash_session_id
        }));

        return { expenses: mappedExpenses, total: count || 0 };
    } catch (e) {
        return { expenses: [], total: 0 };
    }
};

export const dbSaveExpense = async (exp: Omit<Expense, 'id'>) => {
    const branchId = getActiveBranchId();
    const holdingId = await ensureHoldingId(exp.sucursal_id);
    
    let userId = getActiveUserId();
    if (!userId) {
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData.session?.user?.id || null;
    }

    let finalCashSessionId = exp.cash_session_id;
    if (!finalCashSessionId) {
        const activeSession = await dbGetActiveCashClosing();
        if (activeSession) {
            finalCashSessionId = activeSession.id;
        }
    }

    const { data, error } = await supabase.from('egresos').insert({
        sucursal_id: exp.sucursal_id,
        empresa_holding_id: holdingId,
        descripcion: exp.description.toUpperCase(),
        monto: exp.amount,
        categoria: exp.category,
        metodo_pago: exp.paymentMethod,
        url_evidencia: exp.evidencePhoto,
        registrado_por: exp.usuarioRegistro,
        usuario_id: userId,
        fecha_gasto: exp.date,
        cash_session_id: finalCashSessionId || null
    }).select().single();

    if (error) throw error;

    return {
        id: data.id,
        sucursal_id: data.sucursal_id,
        description: data.descripcion,
        amount: Number(data.monto),
        date: data.fecha_gasto,
        category: data.categoria,
        paymentMethod: data.metodo_pago,
        evidencePhoto: data.url_evidencia,
        usuarioRegistro: data.registrado_por,
        usuarioId: data.usuario_id,
        cash_session_id: data.cash_session_id
    } as Expense;
};

// --- INSUMOS ---

export const dbDeleteExpense = async (id: string) => {
    const { error } = await supabase.from('egresos').update({ activo: false }).eq('id', id);
    if (error) throw error;
};

export const dbGetSupplies = async (): Promise<Supply[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    const { data, error = null } = await supabase.from('insumos').select('*').eq('sucursal_id', branchId).eq('activo', true);
    if (error) return [];
    return (data || []).map(s => ({
        id: s.id,
        sucursal_id: s.sucursal_id,
        name: fixEncoding(s.nombre),
        unit: s.unidad_medida,
        minStock: s.stock_minimo,
        currentStock: s.stock_actual,
        lastCost: Number(s.ultimo_costo),
        averageCost: Number(s.costo_promedio),
        color: s.color_insumo
    }));
};

export const dbSaveSupply = async (supply: Omit<Supply, 'id'>) => {
    const { error } = await supabase.from('insumos').insert({
        sucursal_id: supply.sucursal_id,
        nombre: supply.name.toUpperCase(),
        unidad_medida: supply.unit,
        stock_actual: supply.currentStock,
        stock_minimo: supply.minStock,
        color_insumo: supply.color,
        activo: true
    });
    if (error) throw error;
};

// --- MÉTODOS DE PAGO ---

export const dbGetPaymentMethods = async (): Promise<PaymentMethodConfig[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    
    const cacheKey = `payment_methods_${branchId}`;
    const cached = getCached(cacheKey, 60000); // 60s TTL
    if (cached) return cached;
    
    const { data: pms, error = null } = await supabase
        .from('metodos_pago')
        .select('*')
        .eq('sucursal_id', branchId);
        
    if (error || !pms) return [];
    
    // Fetch images separately
    const { data: imgs } = await supabase.from('global_cat_metodos_pago').select('id, url');
    const imgMap = new Map((imgs || []).map(i => [i.id, i.url]));
    
    const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/laundry-assets/global/c-metodo-pago/`;
    
    const results = pms.map(pm => {
        let resolvedIcon = pm.icono || imgMap.get(pm.imagen_id) || 'CreditCard';
        if (resolvedIcon && !resolvedIcon.startsWith('http') && !resolvedIcon.startsWith('data:') && resolvedIcon.includes('.')) {
            resolvedIcon = `${STORAGE_BASE}${resolvedIcon}`;
        }
        return { 
            id: pm.id, 
            name: pm.nombre, 
            isActive: pm.activo, 
            isSuspended: pm.suspendido || false,
            icon: resolvedIcon, 
            fontColor: pm.color, 
            imagen_id: pm.imagen_id,
            sunatCode: pm.codigo_sunat || '01'
        };
    });
    setCache(cacheKey, results);
    return results;
};

export const dbSavePaymentMethod = async (pm: Omit<PaymentMethodConfig, 'id'>) => {
    const branchId = getActiveBranchId();
    const holdingId = getActiveHoldingId();
    const { error = null } = await supabase.from('metodos_pago').insert({ 
        sucursal_id: branchId, 
        empresa_holding_id: holdingId, 
        nombre: pm.name.toUpperCase(), 
        activo: pm.isActive, 
        suspendido: pm.isSuspended || false,
        icono: pm.icon, 
        codigo_sunat: pm.sunatCode, 
        imagen_id: pm.imagen_id 
    });
    if (error) throw error;
    invalidateCache('payment_methods');
};

export const dbUpdatePaymentMethod = async (id: string, pm: Partial<PaymentMethodConfig>) => {
    const payload: any = {};
    if (pm.name) payload.nombre = pm.name.toUpperCase();
    if (pm.isActive !== undefined) payload.activo = pm.isActive;
    if (pm.isSuspended !== undefined) payload.suspendido = pm.isSuspended;
    if (pm.icon !== undefined) payload.icono = pm.icon;
    if (pm.sunatCode) payload.codigo_sunat = pm.sunatCode;
    if (pm.imagen_id !== undefined) payload.imagen_id = pm.imagen_id;
    const { error = null } = await supabase.from('metodos_pago').update(payload).eq('id', id);
    if (error) throw error;
    invalidateCache('payment_methods');
};

// --- CONFIGURACIÓN SUCURSAL ---

export const dbUpdateSucursalConfig = async (id: string, updates: any) => {
    const payload: any = {};
    if (updates.pointsEquivalency !== undefined) payload.puntos_equivalencia = updates.pointsEquivalency;
    if (updates.order_zeros_count !== undefined) payload.order_zeros_count = updates.order_zeros_count;
    if (updates.orderZerosCount !== undefined) payload.order_zeros_count = updates.orderZerosCount;
    
    if (updates.use_order_suffix !== undefined) payload.use_order_suffix = updates.use_order_suffix;
    if (updates.useOrderSuffix !== undefined) payload.use_order_suffix = updates.useOrderSuffix;
    
    if (updates.order_current_suffix !== undefined) {
        payload.order_current_suffix = updates.order_current_suffix;
        payload.prefijo_sufijo = updates.order_current_suffix;
    }
    if (updates.orderCurrentSuffix !== undefined) {
        payload.order_current_suffix = updates.orderCurrentSuffix;
        payload.prefijo_sufijo = updates.orderCurrentSuffix;
    }
    if (updates.prefijo_sufijo !== undefined) payload.prefijo_sufijo = updates.prefijo_sufijo;

    if (updates.order_suffix_position !== undefined) payload.order_suffix_position = updates.order_suffix_position;
    if (updates.orderSuffixPosition !== undefined) payload.order_suffix_position = updates.orderSuffixPosition;
    
    if (updates.use_order_reset !== undefined) payload.use_order_reset = updates.use_order_reset;
    if (updates.limite_reconteo !== undefined) payload.limite_reconteo = updates.limite_reconteo;
    if (updates.doc_enforce_enabled !== undefined) payload.doc_enforce_enabled = updates.doc_enforce_enabled;
    if (updates.doc_enforce_threshold !== undefined) payload.doc_enforce_threshold = updates.doc_enforce_threshold;
    if (updates.cash_management_type !== undefined) payload.cash_management_type = updates.cash_management_type;
    if (updates.cashManagementType !== undefined) payload.cash_management_type = updates.cashManagementType;
    if (updates.modulos_config !== undefined) payload.modulos_config = updates.modulos_config;

    const { error } = await supabase.from('sucursales').update(payload).eq('id', id);
    if (error) throw error;
};

export const dbUpdateSucursalBranding = async (id: string, updates: any) => {
    if (!id) throw new Error("ID de sucursal no proporcionado para actualización");
    
    const payload: any = {};
    
    // Colors
    if (updates.color_primario !== undefined) payload.color_primario = updates.color_primario;
    if (updates.primaryColor !== undefined) payload.color_primario = updates.primaryColor;
    if (updates.color_secundario !== undefined) payload.color_secundario = updates.color_secundario;
    if (updates.secondaryColor !== undefined) payload.color_secundario = updates.secondaryColor;
    
    // Logos
    if (updates.url_logo !== undefined) payload.url_logo = updates.url_logo;
    if (updates.logoUrl !== undefined) payload.url_logo = updates.logoUrl;
    if (updates.url_favicon !== undefined) payload.url_favicon = updates.url_favicon;
    if (updates.faviconUrl !== undefined) payload.url_favicon = updates.faviconUrl;

    // Company Data
    if (updates.ruc !== undefined) payload.ruc = updates.ruc;
    if (updates.direccion !== undefined) payload.direccion = updates.direccion;
    if (updates.address !== undefined) payload.direccion = updates.address;
    if (updates.razonSocial !== undefined) payload.nombre_sucursal = updates.razonSocial;
    if (updates.nombre_sucursal !== undefined) payload.nombre_sucursal = updates.nombre_sucursal;
    if (updates.nombre_comercial !== undefined) payload.nombre_comercial = updates.nombre_comercial;
    if (updates.ubigeo !== undefined) payload.ubigeo = updates.ubigeo;
    if (updates.urbanizacion !== undefined) payload.urbanizacion = updates.urbanizacion;
    if (updates.distrito !== undefined) payload.distrito = updates.distrito;
    if (updates.provincia !== undefined) payload.provincia = updates.provincia;
    if (updates.departamento !== undefined) payload.departamento = updates.departamento;
    
    // SUNAT Config
    if (updates.sunat_url !== undefined) payload.sunat_url = updates.sunat_url;
    if (updates.sunatEnvironment !== undefined) {
        payload.modo_sunat = updates.sunatEnvironment === 'PRODUCTION' ? '1' : 
                            (updates.sunatEnvironment === 'BETA' ? '0' : '2');
    }
    
    // SUNAT Credentials
    if (updates.sol_user !== undefined) payload.sol_user = updates.sol_user;
    if (updates.solUser !== undefined) payload.sol_user = updates.solUser;
    if (updates.sol_pass !== undefined) payload.sol_pass = updates.sol_pass;
    if (updates.solPass !== undefined) payload.sol_pass = updates.solPass;
    if (updates.firma_pass !== undefined) payload.firma_pass = updates.firma_pass;
    if (updates.firmaPass !== undefined) payload.firma_pass = updates.firmaPass;
    
    // WhatsApp
    if (updates.whatsapp_instance !== undefined) payload.whatsapp_instance = updates.whatsapp_instance;
    if (updates.whatsapp_instance_name !== undefined) payload.whatsapp_instance_name = updates.whatsapp_instance_name;
    if (updates.whatsapp_token !== undefined) payload.whatsapp_token = updates.whatsapp_token;
    
    // Yape / Currency / IGV
    if (updates.yape_tenant_id !== undefined) payload.yape_tenant_id = updates.yape_tenant_id;
    if (updates.yapeTenantId !== undefined) payload.yape_tenant_id = updates.yapeTenantId;
    if (updates.porcentaje_igv !== undefined) payload.porcentaje_igv = updates.porcentaje_igv;
    if (updates.moneda_simbolo !== undefined) payload.moneda_simbolo = updates.moneda_simbolo;
    if (updates.currencySymbol !== undefined) payload.moneda_simbolo = updates.currencySymbol;
    
    // Series Fiscales
    if (updates.serieBoleta !== undefined) payload.serie_boleta = updates.serieBoleta;
    if (updates.serieFactura !== undefined) payload.serie_factura = updates.serieFactura;
    if (updates.serieNotaVenta !== undefined) payload.serie_nv = updates.serieNotaVenta;
    if (updates.serieNcFactura !== undefined) payload.serie_nc_factura = updates.serieNcFactura;
    if (updates.serieNcBoleta !== undefined) payload.serie_nc_boleta = updates.serieNcBoleta;

    // Order Config (Padding, Suffix, etc.)
    if (updates.order_zeros_count !== undefined) payload.order_zeros_count = updates.order_zeros_count;
    if (updates.orderZerosCount !== undefined) payload.order_zeros_count = updates.orderZerosCount;
    
    if (updates.use_order_reset !== undefined) payload.use_order_reset = updates.use_order_reset;
    if (updates.limite_reconteo !== undefined) payload.limite_reconteo = updates.limite_reconteo;
    
    if (updates.use_order_suffix !== undefined) payload.use_order_suffix = updates.use_order_suffix;
    if (updates.useOrderSuffix !== undefined) payload.use_order_suffix = updates.useOrderSuffix;
    
    if (updates.order_current_suffix !== undefined) {
        payload.order_current_suffix = updates.order_current_suffix;
        payload.prefijo_sufijo = updates.order_current_suffix;
    }
    if (updates.orderCurrentSuffix !== undefined) {
        payload.order_current_suffix = updates.orderCurrentSuffix;
        payload.prefijo_sufijo = updates.orderCurrentSuffix;
    }
    
    if (updates.order_suffix_position !== undefined) payload.order_suffix_position = updates.order_suffix_position;
    if (updates.orderSuffixPosition !== undefined) payload.order_suffix_position = updates.orderSuffixPosition;

    if (updates.pointsEquivalency !== undefined) payload.puntos_equivalencia = updates.pointsEquivalency;

    const { error = null } = await supabase.from('sucursales').update(payload).eq('id', id);
    if (error) throw error;
};

// --- COMPRAS ---

export const dbGetPurchases = async (): Promise<Purchase[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    const { data, error } = await supabase.from('compras_insumos').select('*, items_compra_insumos(*)').eq('sucursal_id', branchId).order('fecha_compra', { ascending: false });
    if (error) return [];
    return (data || []).map(p => ({
        id: p.id,
        sucursal_id: p.sucursal_id,
        date: p.fecha_compra,
        supplier: p.proveedor,
        totalAmount: Number(p.total),
        items: (p.items_compra_insumos || []).map((it: any) => ({
            supplyId: it.insumo_id,
            name: fixEncoding(it.descripcion),
            quantity: Number(it.cantidad),
            unitCost: Number(it.precio_unitario),
            total: Number(it.subtotal)
        }))
    }));
};

export const dbSavePurchase = async (p: Omit<Purchase, 'id'>) => {
    const { data: compra, error } = await supabase.from('compras_insumos').insert({ sucursal_id: p.sucursal_id, proveedor: p.supplier, total: p.totalAmount, registrado_por: 'SISTEMA' }).select().single();
    if (error) throw error;
    const items = p.items.map(it => ({ compra_id: compra.id, insumo_id: it.supplyId, descripcion: it.name, cantidad: it.quantity, precio_unitario: it.unitCost, subtotal: it.total }));
    const { error: itemsError } = await supabase.from('items_compra_insumos').insert(items);
    if (itemsError) throw itemsError;
    for (const it of p.items) {
        const { data: supply } = await supabase.from('insumos').select('stock_actual, costo_promedio, stock_inicial').eq('id', it.supplyId).single();
        if (supply) {
            const currentStock = Number(supply.stock_actual || 0);
            const newStock = currentStock + Number(it.quantity);
            await supabase.from('insumos').update({ stock_actual: newStock, ultimo_costo: it.unitCost }).eq('id', it.supplyId);
            await supabase.from('kardex_insumos').insert({ sucursal_id: p.sucursal_id, insumo_id: it.supplyId, tipo_movimiento: 'ENTRADA', cantidad: it.quantity, costo_unitario: it.unitCost, registrado_por: 'SISTEMA' });
        }
    }
};

export const dbUpdateItemStatus = async (orderId: string, itemIds: string[], status: OrderStatus, machineId?: string, duration?: number, totalKg?: number) => {
    try {
        const user = localStorage.getItem('sislav_current_user_name') || 'SISTEMA';
        console.log(`🔄 [dbUpdateItemStatus] Cambiando items a ${status}:`, itemIds);
        
        // 0. SI NO VIENE totalKg, lo calculamos sumando los pesos de los items seleccionados
        let calculatedKg = totalKg;
        if (!calculatedKg && (status === 'EN_LAVADO' || status === 'EN_SECADO')) {
            const { data: itemWeights } = await supabase.from('items_venta').select('peso, cantidad').in('id', itemIds);
            if (itemWeights) {
                // Si ya tienen peso guardado usamos ese, sino 0.4 por cantidad
                calculatedKg = itemWeights.reduce((sum, it) => sum + (Number(it.peso) || (Number(it.cantidad) * 0.4)), 0);
            }
        }

        const { error } = await supabase.from('items_venta').update({ estado: status, estado_id: ORDER_STATUS_MAP[status] }).in('id', itemIds);
        if (error) {
            console.error("❌ Error de Supabase al actualizar items_venta:", error);
            if (error.code === '42501') {
                throw new Error("Permiso denegado: No tienes autorización para cambiar el estado de las prendas.");
            }
            throw error;
        }

        for (const itemId of itemIds) {
            const { error: histErr } = await supabase.from('items_historial').insert({ item_id: itemId, estado_nuevo: status, usuario: user, fecha_cambio: new Date().toISOString() });
            if (histErr) console.warn("⚠️ No se pudo guardar el historial del item:", histErr);
        }
        
        // 3. Lógica robusta de liberación de máquinas
        // Buscamos todas las máquinas que tengan esta orden asignada
        const { data: machinesToUpdate } = await supabase.from('maquinas')
            .select('id, tipo, orden_actual_id')
            .ilike('orden_actual_id', `%${orderId}%`);

        if (machinesToUpdate && machinesToUpdate.length > 0) {
            for (const machine of machinesToUpdate) {
                const assignedOrders = (machine.orden_actual_id || '').split(',').map((id: string) => id.trim()).filter((id: string) => !!id);
                const targetStatus = machine.tipo === 'LAVADORA' ? 'EN_LAVADO' : 'EN_SECADO';
                
                // Verificamos si CUALQUIERA de las órdenes asignadas a esta máquina todavía tiene items en el estado objetivo
                const { data: activeItems } = await supabase.from('items_venta')
                    .select('id')
                    .eq('estado', targetStatus)
                    .in('venta_id', assignedOrders);

                if (!activeItems || activeItems.length === 0) {
                    // Si no quedan items para NINGUNA de las órdenes en esta máquina, la liberamos
                    await supabase.from('maquinas').update({ 
                        estado_operativo: 'DISPONIBLE', 
                        orden_actual_id: null, 
                        fecha_inicio_proceso: null, 
                        duracion_estimada_minutos: null 
                    }).eq('id', machine.id);
                }
            }
        }

        if (machineId && (status === 'EN_LAVADO' || status === 'EN_SECADO')) {
            const { data: machine } = await supabase.from('maquinas').select('total_ciclos, total_kg, total_minutos').eq('id', machineId).single();
            if (machine) {
                await supabase.from('maquinas').update({ 
                    estado_operativo: 'OCUPADO', 
                    orden_actual_id: orderId, 
                    fecha_inicio_proceso: new Date().toISOString(), 
                    duracion_estimada_minutos: duration || 30, 
                    total_ciclos: (machine.total_ciclos || 0) + 1, 
                    total_kg: (machine.total_kg || 0) + (calculatedKg || 0), 
                    total_minutos: (machine.total_minutos || 0) + (duration || 30) 
                }).eq('id', machineId);

                // Disparar validación de alerta de mantenimiento
                checkAndSendMachineMaintenanceAlert(machineId).catch(err => {
                    console.error("⚠️ Falló verificar/enviar alerta de mantenimiento para la máquina durante proceso:", err);
                });
            }
        }
    } catch (e) {
        console.error("❌ Falló el cambio de estado:", e);
        throw e;
    }
};

export const dbGetActiveItems = async (): Promise<any[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    
    const cacheKey = `active_items_${branchId}`;
    const cached = getCached(cacheKey, 10000); // 10s TTL
    if (cached) return cached;
    
    // Join with ventas to filter by sucursal_id
    const { data } = await supabase.from('items_venta')
        .select('id, venta_id, estado, ventas!inner(sucursal_id, estado)')
        .eq('ventas.sucursal_id', branchId)
        .neq('ventas.estado', 'CANCELADO')
        .in('estado', ['EN_LAVADO', 'EN_SECADO']);
        
    const result = (data || []).map(it => ({
        id: it.id,
        venta_id: it.venta_id,
        estado: it.estado
    }));
    
    setCache(cacheKey, result);
    return result;
};

export const dbSyncMachines = async () => {
    const branchId = getActiveBranchId();
    if (!branchId) return;

    const { data: machines } = await supabase.from('maquinas').select('*').eq('sucursal_id', branchId).eq('estado_operativo', 'OCUPADO');
    if (!machines || machines.length === 0) return;
    
    for (const machine of machines) {
        if (!machine.orden_actual_id) {
            await supabase.from('maquinas').update({ estado_operativo: 'DISPONIBLE', orden_actual_id: null, fecha_inicio_proceso: null, duracion_estimada_minutos: null }).eq('id', machine.id);
            continue;
        }
        
        const orderIds = machine.orden_actual_id.split(',');
        const targetStatus = machine.tipo === 'LAVADORA' ? 'EN_LAVADO' : 'EN_SECADO';
        
        const { data: activeItems } = await supabase.from('items_venta').select('id').in('venta_id', orderIds).eq('estado', targetStatus);
        
        if (!activeItems || activeItems.length === 0) {
            await supabase.from('maquinas').update({ estado_operativo: 'DISPONIBLE', orden_actual_id: null, fecha_inicio_proceso: null, duracion_estimada_minutos: null }).eq('id', machine.id);
        }
    }
};

export const dbGetEmployees = async (): Promise<Employee[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    
    const cacheKey = `employees_${branchId}`;
    const cached = getCached(cacheKey, 30000); // 30s TTL
    if (cached) return cached;

    const { data, error } = await supabase.from('usuarios_login').select('*').eq('sucursal_id', branchId);
    if (error) return [];
    const employees = (data || []).map(e => ({ 
        id: e.id, 
        sucursal_id: e.sucursal_id, 
        name: e.nombre_completo, 
        username: e.username, 
        role: e.rol as any, 
        phone: e.telefono, 
        photoUrl: e.url_foto, 
        isActive: e.activo, 
        permissions: e.permisos_json || {},
        nombreEmpresa: e.nombre_empresa
    }));
    setCache(cacheKey, employees);
    return employees;
};

// Instancia única para creación de empleados para evitar advertencia de múltiples GoTrueClients
let tempAuthClient: any = null;

export const dbSaveEmployee = async (emp: Omit<Employee, 'id'>, holdingId?: string, holdingName?: string) => {
    const activeHoldingId = holdingId || await ensureHoldingId(emp.sucursal_id);
    
    // Si no tenemos el nombre de la empresa, lo buscamos para que se guarde en el perfil
    let finalHoldingName = holdingName;
    if (!finalHoldingName) {
        const { data: branchData } = await supabase
            .from('sucursales')
            .select('empresas_holding(nombre_empresa)')
            .eq('id', emp.sucursal_id)
            .maybeSingle();
        finalHoldingName = (branchData as any)?.empresas_holding?.nombre_empresa || emp.nombreEmpresa;
    }

    // 0. Verificar si el username ya existe en la tabla usuarios_login
    const { data: existingUser } = await supabase
        .from('usuarios_login')
        .select('id')
        .eq('username', emp.username.trim().toLowerCase())
        .maybeSingle();
    
    if (existingUser) {
        throw new Error(`El nombre de usuario "${emp.username}" ya está registrado. Por favor elija otro.`);
    }

    const virtualEmail = `${emp.username.trim().toLowerCase()}@sislav.com`;

    // 1. Obtener o crear el cliente de autenticación temporal
    if (!tempAuthClient) {
        const { createClient } = await import('@supabase/supabase-js');
        tempAuthClient = createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: false,
                    storageKey: 'sislav-employee-creation-temp',
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            }
        );
    }

    const { data: authUser, error: authError } = await tempAuthClient.auth.signUp({
        email: virtualEmail,
        password: emp.password || '',
        options: {
            data: {
                full_name: emp.name,
                sucursal_id: emp.sucursal_id
            }
        }
    });

    let finalUserId: string | null = null;

    if (authError) {
        if (authError.message.includes('User already registered')) {
            // ESCENARIO: El usuario existe en Auth pero no en la tabla usuarios_login
            // Intentamos hacer login para obtener su ID y "re-vincularlo"
            const { data: signInData, error: signInError } = await tempAuthClient.auth.signInWithPassword({
                email: virtualEmail,
                password: emp.password || ''
            });

            if (signInError) {
                console.error("Error al intentar recuperar cuenta existente:", signInError);
                throw new Error(`El usuario "${emp.username}" ya existe en el sistema de autenticación con otra contraseña. Para usar este nombre de usuario, debes eliminarlo manualmente desde el Dashboard de Supabase -> Authentication.`);
            }
            finalUserId = signInData.user?.id || null;
        } else {
            console.error("Error en Supabase Auth SignUp:", authError);
            if (authError.message.includes('rate limit exceeded')) {
                throw new Error("Límite de correos de Supabase alcanzado. Para solucionar esto permanentemente, debes ir a tu Dashboard de Supabase -> Authentication -> Providers -> Email y DESACTIVAR la opción 'Confirm Email'.");
            }
            throw new Error(`Error de autenticación: ${authError.message}`);
        }
    } else {
        finalUserId = authUser.user?.id || null;
    }
    
    if (!finalUserId) throw new Error("No se pudo obtener el ID del usuario");

    // 2. Insertar el perfil usando la función RPC (SECURITY DEFINER)
    const { error: insertError } = await supabase.rpc('create_user_profile', {
        p_id: finalUserId,
        p_auth_user_id: finalUserId,
        p_sucursal_id: emp.sucursal_id,
        p_empresa_id: activeHoldingId,
        p_nombre_completo: emp.name,
        p_username: emp.username,
        p_rol: emp.role,
        p_telefono: emp.phone || null,
        p_url_foto: emp.photoUrl || null,
        p_permisos_json: emp.permissions || {},
        p_password_hash: emp.password || '',
        p_nombre_empresa: finalHoldingName || null
    });

    if (insertError) {
        console.error("Error al crear perfil vía RPC:", insertError);
        throw new Error(`Error de base de datos (RPC): ${insertError.message}`);
    }

    invalidateCache('employees');

    // Limpieza: Si habíamos iniciado sesión en el cliente temporal, cerramos
    try {
        await tempAuthClient.auth.signOut();
    } catch (e) {
        // Ignorar errores al cerrar sesión
    }
};

export const dbUpdateEmployee = async (id: string, emp: Partial<Employee>) => {
    const { error } = await supabase
        .from('usuarios_login')
        .update({
            nombre_completo: emp.name?.toUpperCase(),
            username: emp.username?.toLowerCase(),
            rol: emp.role,
            telefono: emp.phone,
            url_foto: emp.photoUrl,
            permisos_json: emp.permissions,
            activo: emp.isActive
        })
        .eq('id', id);
    if (error) throw error;
    invalidateCache('employees');
};

export const dbDeleteEmployee = async (id: string) => {
    // 1. Primero lo desactivamos en la tabla (borrado lógico)
    const { error: dbError } = await supabase
        .from('usuarios_login')
        .update({ activo: false })
        .eq('id', id);
    
    if (dbError) throw dbError;
    invalidateCache('employees');
};

export const dbHardDeleteEmployee = async (id: string) => {
    const { error } = await supabase
        .from('usuarios_login')
        .delete()
        .eq('id', id);
    if (error) throw error;
    invalidateCache('employees');
};

export const dbReactivateEmployee = async (id: string) => {
    const { error } = await supabase
        .from('usuarios_login')
        .update({ activo: true })
        .eq('id', id);
    if (error) throw error;
    invalidateCache('employees');
};

export const dbGetCorrelativos = async () => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    const { data, error } = await supabase.from('dispensador_correlativos').select('*').eq('sucursal_id', branchId);
    if (error) return [];
    return data;
};

export const dbSetCorrelative = async (tipo: string, serie: string, valor: number) => {
    const branchId = getActiveBranchId();
    if (!branchId) return;
    const { error } = await supabase.from('dispensador_correlativos').upsert({ sucursal_id: branchId, tipo_documento: tipo, serie: serie, ultimo_numero: valor }, { onConflict: 'sucursal_id,tipo_documento,serie' });
    if (error) throw error;
};

export const dbGetWaCampaignConfig = async () => {
    const branchId = getActiveBranchId();
    if (!branchId) return null;
    const { data, error = null } = await supabase.from('sucursal_wa_config').select('*').eq('sucursal_id', branchId).maybeSingle();
    if (error) return null;
    return data;
};

export const dbMarkDeliveryAsSeen = async (id: string) => {
    await supabase.from('ventas').update({ visto_delivery: true }).eq('id', id);
};

export const dbConvertInvoice = async (invoiceId: string, targetType: InvoiceType, targetSerie: string, finalClient: Client) => {
    const branchId = getActiveBranchId();
    if (!branchId) throw new Error("No hay contexto de sucursal");

    // 1. Obtener el siguiente correlativo usando el RPC atómico (bloquea la fila en Postgres)
    const { data: nextNumber, error: rpcError } = await supabase.rpc('obtener_siguiente_correlativo', {
        p_sucursal_id: branchId,
        p_tipo_documento: targetType,
        p_serie: targetSerie
    });

    if (rpcError) {
        console.error("❌ Error al obtener correlativo via RPC:", rpcError);
        if (rpcError.message?.includes('violates row-level security policy')) {
            throw new Error("ERROR DE PERMISOS: No se pudo asignar el correlativo. Asegúrese de que la serie esté configurada en la sucursal o contacte al administrador.");
        }
        throw rpcError;
    }

    // 2. Actualizar la venta con el número garantizado
    const { data: updatedVenta, error: updateError } = await supabase
        .from('ventas')
        .update({
            tipo_documento_codigo: targetType,
            serie: targetSerie,
            correlativo: nextNumber,
            cliente_id: finalClient.id,
            sunat_status: 'PENDING',
            fecha_emision: new Date().toISOString()
        })
        .eq('id', invoiceId)
        .select()
        .single();

    if (updateError) {
        console.error("Error al actualizar venta convertida:", updateError);
        if (updateError.code === '23505') {
            throw new Error("El correlativo ya existe. Por favor, intente convertir de nuevo.");
        }
        throw updateError;
    }

    invalidateCache('invoices');
    return updatedVenta;
};

export const dbGetMovements = async (): Promise<StockMovement[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    const { data, error = null } = await supabase.from('kardex_insumos').select('*, insumos(nombre)').eq('sucursal_id', branchId).order('fecha_registro', { ascending: false });
    if (error) return [];
    return (data || []).map(m => ({ id: m.id, sucursal_id: m.sucursal_id, date: m.fecha_registro, supplyId: m.insumo_id, supplyName: (m as any).insumos?.nombre || 'Insumo', type: m.tipo_movimiento as any, quantity: m.quantity, cost: m.costo_unitario }));
};

export const dbSaveInventoryCount = async (count: Omit<InventoryCount, 'id' | 'fecha_registro'>) => {
    const branchId = getActiveBranchId();
    if (!branchId) throw new Error("No hay sucursal activa");
    const { data, error } = await supabase.from('conteo_inventario').insert({
        ...count,
        sucursal_id: branchId
    }).select().single();
    if (error) throw error;
    return data;
};

export const dbGetInventoryCounts = async (): Promise<InventoryCount[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    const { data, error } = await supabase
        .from('conteo_inventario')
        .select('*')
        .eq('sucursal_id', branchId)
        .order('fecha_registro', { ascending: false });
    if (error) return [];
    return data || [];
};

export const dbRegisterCatalogImage = async (name: string, url: string, modulo: string) => {
    let table = '';
    if (modulo === 'CATEGORIA') table = 'global_cat_categorias';
    else if (modulo === 'METODO_PAGO') table = 'global_cat_metodos_pago';
    else if (modulo === 'MAQUINA') table = 'global_cat_maquinas';
    if (!table) throw new Error("Módulo de catálogo no válido");
    
    // Usar RPC para evitar problemas de RLS en tablas globales al subir imágenes personalizadas
    const { data, error } = await supabase.rpc('rpc_insert_catalog_item', {
        p_table_name: table,
        p_nombre: name.toUpperCase(),
        p_url: url
    });

    if (error) {
        console.error("Error al registrar en catálogo vía RPC:", error);
        // Fallback al insert directo por si el RPC no existe aún (para retrocompatibilidad momentánea)
        const { data: directData, error: directError } = await supabase.from(table).insert({ nombre: name.toUpperCase(), url: url, activo: true }).select('id').single();
        if (directError) throw directError;
        return directData.id;
    }
    
    return data; // El RPC devuelve el ID
};

export const dbValidateCoupon = async (code: string) => {
    const branchId = getActiveBranchId();
    if (!branchId) return { valid: false, message: 'Contexto no válido' };
    const { data, error } = await supabase.from('cupones').select('*').eq('sucursal_id', branchId).eq('usado', false).eq('activo', true).maybeSingle();
    if (error || !data) return { valid: false, message: 'Cupón no válido o ya usado' };
    const expDate = new Date(data.fecha_expiracion);
    if (expDate < new Date()) return { valid: false, message: 'Cupón vencido' };
    return { valid: true, coupon: { id: data.id, code: data.codigo, amount: data.monto_fijo } };
};

export const dbRedeemCoupon = async (id: string) => {
    await supabase.from('cupones').update({ usado: true, fecha_uso: new Date().toISOString() }).eq('id', id);
};

export const dbGetCoupons = async (): Promise<Coupon[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    const { data, error = null } = await supabase.from('cupones').select('*').eq('sucursal_id', branchId).order('fecha_registro', { ascending: false });
    if (error) return [];
    return (data || []).map(c => ({ id: c.id, sucursal_id: c.sucursal_id, code: c.codigo, amount: c.monto_fijo, expirationDate: c.fecha_expiracion, isUsed: c.usado, conditions: c.condiciones }));
};

export const dbCreateCoupon = async (c: any) => {
    const branchId = getActiveBranchId();
    if (!branchId) throw new Error("Sin sucursal activa");
    const holdingId = await ensureHoldingId(branchId);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('cupones').insert({ sucursal_id: branchId, empresa_holding_id: holdingId, codigo: code, monto_fijo: c.amount, fecha_expiracion: c.expirationDate, condiciones: c.conditions, usado: false, activo: true });
    if (error) throw error;
};

export const dbGetGlobalColors = async (): Promise<GlobalColor[]> => {
    const { data, error } = await supabase.from('global_cat_colores').select('*').eq('activo', true);
    if (error) return [];
    return (data || []).map(c => ({ id: c.id, nombre: c.nombre, hex: c.hex, url_imagen: c.url_imagen, activo: c.activo }));
};

export const dbRemovePayment = async (paymentId: string) => {
    const { error } = await supabase.from('pagos_venta').delete().eq('id', paymentId);
    if (error) throw error;
};

export const dbUpdatePaymentTransactionMethod = async (paymentId: string, methodId: string) => {
    const { error } = await supabase.from('pagos_venta').update({ metodo_pago_id: methodId }).eq('id', paymentId);
    if (error) throw error;
};

export const dbRestoreOrderToReady = async (ventaId: string) => {
    const { error } = await supabase.from('ventas').update({ 
        estado: 'LISTO', 
        estado_id: ORDER_STATUS_MAP['LISTO'],
        entregado_at: null 
    }).eq('id', ventaId);
    if (error) throw error;
};

export const dbGetPaymentsForSession = async (sessionId: string, branchId: string): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('pagos_venta')
            .select(`
                *,
                metodos_pago (nombre),
                ventas!inner (
                    id,
                    sucursal_id,
                    serie,
                    correlativo,
                    clientes (nombres, apellidos)
                )
            `)
            .eq('cash_session_id', sessionId)
            .eq('ventas.sucursal_id', branchId);

        if (error) throw error;
        return (data || []).map(p => ({
            ...p,
            metodo_pago_name: (p.metodos_pago as any)?.nombre || 'EFECTIVO'
        }));
    } catch (e) {
        console.error("Error fetching session payments:", e);
        return [];
    }
};

export const dbGetExpensesForSession = async (sessionId: string, branchId: string): Promise<Expense[]> => {
    try {
        const { data, error } = await supabase
            .from('egresos')
            .select('*')
            .eq('cash_session_id', sessionId)
            .eq('sucursal_id', branchId);

        if (error) throw error;
        return (data || []).map(e => ({
            id: e.id,
            sucursal_id: e.sucursal_id,
            description: e.descripcion,
            amount: Number(e.monto),
            date: e.fecha_gasto,
            category: e.categoria,
            paymentMethod: e.metodo_pago,
            evidencePhoto: e.url_evidencia,
            usuarioRegistro: e.registrado_por,
            usuarioId: e.usuario_id,
            cash_session_id: e.cash_session_id
        })) as Expense[];
    } catch (e) {
        console.error("Error fetching session expenses:", e);
        return [];
    }
};

export const dbGetActiveCashClosingDate = async (): Promise<Date> => {
    const branchId = getActiveBranchId();
    if (!branchId) return new Date(0);
    const { data, error } = await supabase.from('cierres_caja')
        .select('fecha_cierre')
        .eq('sucursal_id', branchId)
        .order('fecha_cierre', { ascending: false })
        .limit(1)
        .maybeSingle();
    
    if (error || !data) return new Date(0);
    return new Date(data.fecha_cierre);
};

export const dbGetActiveCashClosing = async () => {
    const branchId = getActiveBranchId();
    if (!branchId) return null;
    
    // Eliminamos el filtro por usuario_id para que la caja sea compartida por la sucursal
    // tal como solicita el usuario ("el indicador verde de caja abierta se le muestra a todos")
    const { data, error } = await supabase
        .from('cierres_caja')
        .select('*')
        .eq('sucursal_id', branchId)
        .eq('estado', 'ABIERTO')
        .order('fecha_apertura', { ascending: false })
        .limit(1)
        .maybeSingle();
    
    if (error || !data) return null;
    
    return { 
        id: data.id, 
        sucursal_id: data.sucursal_id, 
        usuario_id: data.usuario_id,
        cajero: data.registrado_por, 
        caja: data.caja, 
        turno: data.turno, 
        fechaApertura: data.fecha_apertura, 
        openingBalance: Number(data.saldo_apertura) || 0 
    };
};

export const dbOpenCashClosing = async (openingBalance: number, turno: string, cajaName: string = 'CAJA PRINCIPAL') => {
    const branchId = getActiveBranchId();
    if (!branchId) throw new Error("No hay contexto de sucursal");
    const holdingId = await ensureHoldingId(branchId);
    
    let userId = getActiveUserId();
    if (!userId) {
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData.session?.user?.id || null;
    }
    if (!userId) throw new Error("Usuario no identificado");

    const userName = localStorage.getItem('sislav_current_user_name') || 'SISTEMA';

    const { data, error } = await supabase.from('cierres_caja').insert({ 
        sucursal_id: branchId, 
        empresa_holding_id: holdingId, 
        usuario_id: userId,
        fecha_apertura: new Date().toISOString(), 
        saldo_apertura: openingBalance, 
        estado: 'ABIERTO',
        registrado_por: userName,
        caja: cajaName,
        turno: turno
    }).select().single();

    if (error) throw error;
    return data;
};

export const dbGetCashClosings = async (): Promise<CashClosing[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];
    const { data, error = null } = await supabase.from('cierres_caja').select('*').eq('sucursal_id', branchId).order('fecha_cierre', { ascending: false });
    if (error) return [];
    return (data || []).map(c => ({ 
        id: c.id, 
        sucursal_id: c.sucursal_id, 
        cajero: c.registrado_por || 'SISTEMA', 
        caja: c.caja || 'CAJA PRINCIPAL', 
        turno: c.turno || 'TURNO', 
        fechaApertura: c.fecha_apertura, 
        fechaCierre: c.fecha_cierre, 
        openingBalance: Number(c.saldo_apertura) || 0, 
        cashSales: Number(c.ventas_efectivo) || 0, 
        otherSales: (() => {
            const val = typeof c.otras_ventas_json === 'string' ? JSON.parse(c.otras_ventas_json) : (c.otras_ventas_json || []);
            if (Array.isArray(val)) {
                return val.reduce((acc: Record<string, number>, curr: any) => {
                    acc[curr.methodName] = curr.amount;
                    return acc;
                }, {});
            }
            return (val && typeof val === 'object') ? val : {};
        })(),
        expenses: Number(c.gastos) || 0, 
        expectedCash: Number(c.esperado) || 0, 
        actualCash: Number(c.real) || 0, 
        difference: Number(c.diferencia) || 0, 
        liquidation: Number(c.monto_liquidacion) || 0,
        transactions: typeof c.transacciones_json === 'string' ? JSON.parse(c.transacciones_json) : (c.transacciones_json || []),
        topCategories: typeof (c as any).top_categories_json === 'string' 
            ? JSON.parse((c as any).top_categories_json) 
            : ((c as any).top_categories_json || [])
    }));
};

export const dbUpdateCashClosing = async (id: string, c: CashClosing) => {
    const { error } = await supabase.from('cierres_caja')
        .update({ 
            fecha_cierre: c.fechaCierre || new Date().toISOString(), 
            ventas_efectivo: c.cashSales, 
            gastos: c.expenses, 
            real: c.actualCash, 
            monto_liquidacion: c.liquidation || 0,
            estado: 'CERRADO',
            otras_ventas_json: Object.entries(c.otherSales).map(([methodName, amount]) => ({ methodName, amount })),
            transacciones_json: c.transactions || [],
            top_categories_json: c.topCategories || []
        })
        .eq('id', id);
    if (error) throw error;
};

export const dbGetLastAccumulatedBalance = async (branchId: string, userId: string): Promise<number> => {
    const holdingId = getActiveHoldingId();
    
    let query = supabase
        .from('cierres_caja')
        .select('real, monto_liquidacion')
        .eq('sucursal_id', branchId)
        .eq('usuario_id', userId)
        .eq('estado', 'CERRADO');
    
    if (holdingId) {
        query = query.eq('empresa_holding_id', holdingId);
    }

    const { data, error } = await query
        .order('fecha_cierre', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return 0;

    // Fórmula: Saldo Final - Liquidación = Lo que queda para el siguiente turno
    const lastReal = Number(data.real) || 0;
    const lastLiquidation = Number(data.monto_liquidacion) || 0;
    
    return Math.max(0, lastReal - lastLiquidation);
};

export const dbCreateCashClosing = async (c: CashClosing) => {
    const branchId = getActiveBranchId();
    if (!branchId) throw new Error("No hay contexto de sucursal");
    const holdingId = await ensureHoldingId(branchId);
    
    // Intentar obtener el ID del usuario de varias fuentes para mayor robustez
    let userId = getActiveUserId();
    
    if (!userId) {
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData.session?.user?.id || null;
    }

    if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
    }

    if (!userId) throw new Error("No se detectó el usuario autenticado.");

    const { error } = await supabase.from('cierres_caja').insert({ 
        sucursal_id: branchId, 
        empresa_holding_id: holdingId, 
        usuario_id: userId,
        fecha_apertura: c.fechaApertura, 
        fecha_cierre: c.fechaCierre, 
        saldo_apertura: c.openingBalance, 
        ventas_efectivo: c.cashSales, 
        gastos: c.expenses, 
        real: c.actualCash, 
        monto_liquidacion: c.liquidation || 0,
        esperado: c.expectedCash,
        diferencia: c.difference,
        estado: 'CERRADO',
        registrado_por: c.cajero,
        caja: c.caja,
        turno: c.turno,
        otras_ventas_json: Object.entries(c.otherSales).map(([methodName, amount]) => ({ methodName, amount })),
        transacciones_json: c.transactions || [],
        top_categories_json: c.topCategories || []
    });
    if (error) throw error;
};

export const dbSaveWaCampaignTemplates = async (templates: CampaignTemplate[], delay: number, isReminder: boolean = false) => {
    const branchId = getActiveBranchId();
    if (!branchId) return;
    
    const updateData: any = { sucursal_id: branchId, delay_segundos: delay };
    if (isReminder) {
        updateData.plantillas_recordatorio_json = templates;
    } else {
        updateData.plantillas_json = templates;
    }
    
    await supabase.from('sucursal_wa_config').upsert(updateData, { onConflict: 'sucursal_id' });
};

export const dbSaveWaCampaignImage = async (url: string) => {
    const branchId = getActiveBranchId();
    if (!branchId) return;
    await supabase.from('sucursal_wa_config').upsert({ sucursal_id: branchId, url_imagen_campania: url }, { onConflict: 'sucursal_id' });
};

// --- MÓDULO DE MENSAJES (WA TEMPLATES) ---

export const dbGetWaTemplates = async (category?: WaTemplateCategory): Promise<WaTemplate[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];

    // Incluimos tanto las de la sucursal como las globales (sucursal_id null)
    let query = supabase.from('wa_templates').select('*').or(`sucursal_id.eq.${branchId},sucursal_id.is.null`);
    if (category) query = query.eq('category', category);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching WA templates:', error);
        return [];
    }
    return data || [];
};

export const dbSaveWaTemplate = async (template: Partial<WaTemplate>): Promise<WaTemplate | null> => {
    const branchId = getActiveBranchId();
    if (!branchId) return null;

    const templateData = {
        ...template,
        sucursal_id: branchId,
        is_active: template.is_active ?? true,
        created_at: template.created_at || new Date().toISOString()
    };

    const { data, error } = await supabase.from('wa_templates').upsert(templateData).select().single();
    if (error) {
        console.error('Error saving WA template:', error);
        throw error;
    }
    return data;
};

export const dbDeleteWaTemplate = async (id: string) => {
    const { error } = await supabase.from('wa_templates').delete().eq('id', id);
    if (error) throw error;
};

export const dbToggleWaTemplate = async (id: string, active: boolean) => {
    const { error } = await supabase.from('wa_templates').update({ is_active: active }).eq('id', id);
    if (error) throw error;
};

export const dbGetTrackingInfo = async (id: string) => {
    console.log(`🔍 [dbGetTrackingInfo] Buscando ID: ${id}`);
    
    // 1. Intentar obtener el recojo primero (sin joins para máxima resiliencia RLS)
    const { data: pickup, error: pErr } = await supabase.from('recojos_delivery').select('*').eq('id', id).maybeSingle();
    
    if (pickup) {
        console.log("✅ Recojo encontrado:", pickup.id);
        const { data: company } = await supabase.from('sucursales').select('*').eq('id', pickup.sucursal_id).maybeSingle();
        const { data: client } = await supabase.from('clientes').select('id, nombres, puntos, sucursal_id, telefono').eq('id', pickup.cliente_id).maybeSingle();
        const { data: invoice } = await supabase.from('ventas').select('*, items_venta(*)').eq('pickup_id', id).maybeSingle();
        
        // Fetch payments if invoice exists
        let pagos: any[] = [];
        if (invoice) {
            const { data: pData } = await supabase.from('pagos_venta').select('monto, metodo_pago_id, fecha_pago').eq('venta_id', invoice.id);
            pagos = pData || [];
        }

        return { 
            pickup: { ...pickup, clientes: client }, 
            invoice: invoice ? { ...invoice, clientes: client, pagos_venta: pagos } : null, 
            company: company ? normalizeSucursal(company) : null 
        };
    }

    // 2. Si no es recojo, intentar con venta directa
    let vQuery = supabase.from('ventas').select('*, items_venta(*), clientes(*)').eq('id', id);
    let { data: v } = await vQuery.maybeSingle();

    // 2.1 Fallback: Buscar por codigo_orden o serie-correlativo
    if (!v) {
        // Intentar por codigo_orden directo
        const { data: vByCode } = await supabase.from('ventas').select('*, items_venta(*), clientes(*)').eq('codigo_orden', id).maybeSingle();
        v = vByCode;

        // Si no se encontró, intentar parsear serie-correlativo (ej: B001-00000058)
        if (!v && id.includes('-')) {
            const parts = id.split('-');
            if (parts.length === 2) {
                const serieSearch = parts[0].toUpperCase();
                const correlativoSearch = parseInt(parts[1], 10);
                if (!isNaN(correlativoSearch)) {
                    const { data: vByDoc } = await supabase.from('ventas')
                        .select('*, items_venta(*), clientes(*)')
                        .eq('serie', serieSearch)
                        .eq('correlativo', correlativoSearch)
                        .maybeSingle();
                    v = vByDoc;
                }
            }
        }
    }

    if (v) {
        console.log("✅ Venta encontrada:", v.id);
        const { data: companyRaw } = await supabase.from('sucursales').select('*').eq('id', v.sucursal_id).maybeSingle();
        const clientRaw = v.clientes;
        
        // Fetch payments
        const { data: pagosVenta } = await supabase.from('pagos_venta').select('*, metodos_pago(nombre)').eq('venta_id', v.id);

        const totalPagado = (pagosVenta || []).reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
        const client = normalizeRelation(clientRaw);
        
        const mappedInvoice: Invoice = {
            id: v.id,
            sucursal_id: v.sucursal_id,
            cliente_id: v.cliente_id,
            client: client ? {
                id: client.id,
                docType: client.tipo_documento_codigo || 'DNI',
                docNumber: client.dni,
                name: client.nombres,
                phone: client.telefono,
                address: client.direccion,
                points: client.puntos || 0,
                sucursal_id: client.sucursal_id
            } : { id: '', docType: '0', docNumber: '0', name: 'PUBLICO GENERAL', address: '', points: 0, sucursal_id: v.sucursal_id },
            ordenNumber: v.codigo_orden,
            serie: v.serie,
            correlativo: v.correlativo,
            type: v.tipo_documento_codigo as InvoiceType,
            items: (v.items_venta || []).map((it: any) => ({
                id: it.id,
                name: (it.descripcion || it.nombre || 'SERVICIO').toUpperCase(),
                quantity: Number(it.cantidad || 0),
                price: Number(it.precio_unitario || 0),
                subtotal: Number(it.subtotal || 0),
                category: it.categoria || '',
                unitCode: it.codigo_unidad || 'ZZ',
                activo: true,
                stock: 0,
                cost: 0,
                estado: it.estado || 'PENDIENTE',
                status: it.estado as OrderStatus,
                estado_id: it.estado_id,
                color: it.color,
                defectos: it.defectos,
                details: it.observaciones,
                item_id_raw: it.id,
                audioNote: it.url_audio
            })),
            payments: (pagosVenta || []).map(p => ({
                id: p.id,
                metodo_pago_id: p.metodo_pago_id,
                metodo_pago_name: (p.metodos_pago as any)?.nombre || 'EFECTIVO',
                monto: Number(p.monto),
                date: p.fecha_pago
            })),
            totals: {
                total: Number(v.total) || 0,
                igv: Number(v.total_igv) || 0,
                gravada: Number(v.total_gravada) || 0,
                exonerada: Number(v.total_exonerada) || 0,
                inafecta: Number(v.total_inafecta) || 0
            },
            date: v.fecha_recepcion || v.fecha || new Date().toISOString(),
            fecha_emision: v.fecha_emision,
            deliveryDate: v.fecha_entrega,
            orderStatus: (v.estado as OrderStatus) || 'PENDIENTE',
            sunatStatus: v.sunat_status || (v.tipo_documento_codigo === InvoiceType.NOTA_VENTA ? 'INTERNAL' : 'PENDING'),
            prePaymentAmount: totalPagado,
            qrCodeData: v.qr_code_data || null,
            sunatResponse: {
                success: v.sunat_status === 'ACCEPTED',
                description: v.sunat_description,
                hash: v.sunat_hash,
                pdfUrl: v.sunat_pdf_url,
                xmlUrl: v.sunat_xml_url,
                cdrUrl: v.sunat_cdr_url
            }
        };

        return { 
            invoice: mappedInvoice, 
            company: companyRaw ? normalizeSucursal(companyRaw) : null 
        };
    }

    if (pErr) {
        console.error("❌ Error en dbGetTrackingInfo:", pErr);
    } else {
        console.warn("⚠️ No se encontró ninguna coincidencia para el ID proporcionado: " + id);
    }
    return null;
};

export const dbGetItemHistory = async (itemId: string) => {
    const { data, error = null } = await supabase.from('items_historial').select('*').eq('item_id', itemId).order('fecha_cambio', { ascending: false });
    if (error) return [];
    return data;
};

export const dbIncrementTrackingGenerated = async (id: string, type: 'invoice' | 'pickup') => {
    const table = type === 'invoice' ? 'ventas' : 'recojos_delivery';
    const { data: current } = await supabase.from(table).select('tracking_generado_count').eq('id', id).single();
    const count = (current?.tracking_generado_count || 0) + 1;
    await supabase.from(table).update({ tracking_generado_count: count }).eq('id', id);
};

export const dbIncrementTrackingViewed = async (id: string, type: 'invoice' | 'pickup') => {
    const table = type === 'invoice' ? 'ventas' : 'recojos_delivery';
    const { data: current } = await supabase.from(table).select('tracking_visto_count').eq('id', id).single();
    const count = (current?.tracking_visto_count || 0) + 1;
    await supabase.from(table).update({ tracking_visto_count: count }).eq('id', id);
};

/**
 * LOGISTICA HUB & SPOKE
 */

export const dbGetLogisticsDrivers = async () => {
    const holdingId = getActiveHoldingId();
    if (!holdingId) return [];
    const { data, error } = await supabase
        .from('usuarios_login')
        .select('*')
        .eq('empresa_holding_id', holdingId)
        .eq('rol', UserRole.DELIVERY)
        .eq('activo', true);
    if (error) throw error;
    return data;
};

export const dbGetDriverRoutes = async (choferId: string) => {
    const holdingId = getActiveHoldingId();
    const { data, error } = await supabase
        .from('chofer_sucursales')
        .select('*, sucursales(*)')
        .eq('chofer_id', choferId)
        .eq('holding_id', holdingId);
    if (error) throw error;
    return data;
};

export const dbAssignDriverRoute = async (choferId: string, sucursalId: string) => {
    const holdingId = getActiveHoldingId();
    const { error } = await supabase
        .from('chofer_sucursales')
        .upsert({ 
            chofer_id: choferId, 
            sucursal_id: sucursalId,
            holding_id: holdingId
        }, { onConflict: 'chofer_id,sucursal_id' });
    if (error) throw error;
};

export const dbRemoveDriverRoute = async (choferId: string, sucursalId: string) => {
    const { error } = await supabase
        .from('chofer_sucursales')
        .delete()
        .eq('chofer_id', choferId)
        .eq('sucursal_id', sucursalId);
    if (error) throw error;
};

export const dbCreateGuiaRemision = async (guia: Partial<GuiaRemision>, items: { id: string, venta_id?: string }[]) => {
    const holdingId = getActiveHoldingId();
    const userId = getActiveUserId();
    const userName = localStorage.getItem('sislav_current_user_name') || 'Sistema';

    // 1. Crear la guía
    const { data: guiaData, error: guiaError } = await supabase
        .from('guias_remision')
        .insert({
            codigo_guia: guia.codigo_guia,
            sucursal_origen_id: guia.sucursal_origen_id,
            sucursal_destino_id: guia.sucursal_destino_id,
            chofer_id: guia.chofer_id,
            tipo_guia: guia.tipo_guia,
            notas: guia.notas,
            estado: guia.estado || 'PENDIENTE',
            empresa_holding_id: holdingId,
            registrado_por: userName
        })
        .select()
        .single();

    if (guiaError) throw guiaError;

    const itemIds = items.map(it => it.id);

    // 2. Vincular items y registrar movimiento inicial como "Asignado"
    // Si la guía es PENDIENTE, la ubicación inicial sigue siendo la SUCURSAL de origen
    const isPending = (guia.estado || 'PENDIENTE') === 'PENDIENTE';
    
    const { error: rpcError } = await supabase.rpc('procesar_movimiento_logistico', {
        p_items_ids: itemIds,
        p_guia_id: guiaData.id,
        p_nuevo_estado: guia.tipo_guia === 'RECOJO' ? 'EN_TRANSITO_CENTRAL' : 'EN_TRANSITO_ACOPIO',
        p_ubicacion_tipo: isPending ? 'SUCURSAL' : 'DELIVERY',
        p_ubicacion_id: isPending ? guia.sucursal_origen_id : guia.chofer_id,
        p_usuario_id: userId,
        p_usuario_nombre: userName,
        p_empresa_holding_id: holdingId
    });

    if (rpcError) throw rpcError;

    // 3. Forzar el estado de la guía a PENDIENTE si el RPC lo cambió (mecanismo de seguridad)
    if (isPending) {
        await supabase
            .from('guias_remision')
            .update({ estado: 'PENDIENTE' })
            .eq('id', guiaData.id);
    }

    // 3. Insertar en items_guia para referencia
    // Nota: El RPC procesar_movimiento_logistico podría ya estar insertando en items_guia
    // en algunas versiones del esquema. Verificamos si ya existen para evitar duplicados o errores.
    const { data: existingRelations } = await supabase
        .from('items_guia')
        .select('*')
        .eq('guia_id', guiaData.id);

    const existingIds = new Set((existingRelations || []).map(r => r.item_venta_id || r.item_id));
    const itemsToInsert = items.filter(item => !existingIds.has(item.id));

    if (itemsToInsert.length > 0) {
        const itemsGuiaMap = itemsToInsert.map(item => {
            const entry: any = {
                guia_id: guiaData.id,
                item_venta_id: item.id,
                estado_item: 'CARGADO',
                empresa_holding_id: holdingId
            };
            // Solo incluimos venta_id si tenemos un UUID válido para evitar violaciones de FK
            if (item.venta_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.venta_id)) {
                entry.venta_id = item.venta_id;
            }
            return entry;
        });

        const { error: itemsError } = await supabase.from('items_guia').insert(itemsGuiaMap);
        if (itemsError) {
            console.warn("Items guide insertion failed, trying fallback:", itemsError.message);
            // Reintentar con solo item_venta_id (esto ya es lo que hace el map arriba, pero por si acaso falló por algo más)
            const fallback1 = itemsToInsert.map(it => ({
                guia_id: guiaData.id,
                item_venta_id: it.id,
                estado_item: 'CARGADO',
                empresa_holding_id: holdingId
            }));
            const { error: err1 } = await supabase.from('items_guia').insert(fallback1);
            if (err1) {
                console.error("Retrying guide item insertion failed:", err1.message);
            }
        }
    }

    return guiaData;
};

export const dbGetGuiasRemision = async (filters: { 
    sucursal_id?: string, 
    chofer_id?: string, 
    estado?: string,
    sucursal_origen_id?: string,
    sucursal_destino_id?: string
}) => {
    let query = supabase
        .from('guias_remision')
        .select('*, sucursal_origen:sucursales!sucursal_origen_id(*), sucursal_destino:sucursales!sucursal_destino_id(*), chofer:usuarios_login!chofer_id(*)');
    
    if (filters.sucursal_id) {
        query = query.or(`sucursal_origen_id.eq.${filters.sucursal_id},sucursal_destino_id.eq.${filters.sucursal_id}`);
    }
    if (filters.sucursal_origen_id) {
        query = query.eq('sucursal_origen_id', filters.sucursal_origen_id);
    }
    if (filters.sucursal_destino_id) {
        query = query.eq('sucursal_destino_id', filters.sucursal_destino_id);
    }
    if (filters.chofer_id) {
        query = query.eq('chofer_id', filters.chofer_id);
    }
    if (filters.estado) {
        query = query.eq('estado', filters.estado);
    }

    const { data, error } = await query.order('fecha_registro', { ascending: false });
    if (error) throw error;
    return data;
};

export const dbGetGuiaDetails = async (guiaId: string) => {
    // Consulta optimizada y simplificada para evitar errores de alias de Supabase (clientes_2, etc)
    const { data, error } = await supabase
        .from('items_guia')
        .select(`
            *,
            items_venta (
                *,
                ventas (
                    *,
                    clientes (
                        id, 
                        nombres, 
                        apellidos, 
                        dni, 
                        ruc, 
                        razon_social
                    )
                )
            )
        `)
        .eq('guia_id', guiaId);
        
    if (error) {
        console.warn("Simple join failed:", error.message);
        throw error;
    }
    
    // Mapear para compatibilidad: Asegurar que existan item e items_venta
    return (data || []).map(row => ({
        ...row,
        item: row.items_venta,
        item_venta: row.items_venta,
        items_venta: row.items_venta
    }));
};

export const dbGetItemLogisticsHistory = async (itemId: string) => {
    const { data, error } = await supabase
        .from('items_historial_logistica')
        .select(`
            *,
            guia:guias_remision (
                codigo_guia,
                tipo_guia,
                fecha_registro,
                sucursal_origen:sucursales!guias_remision_sucursal_origen_id_fkey(nombre_sucursal),
                sucursal_destino:sucursales!guias_remision_sucursal_destino_id_fkey(nombre_sucursal)
            ),
            usuario:usuarios_login(nombre_completo)
        `)
        .eq('item_id', itemId)
        .order('fecha_registro', { ascending: false });

    if (error) throw error;
    return data;
};

export const dbUpdateGuiaEstado = async (guiaId: string, nuevoEstadoGuia: string, itemEstado?: string, itemsToProcess?: string[]) => {
    const userId = getActiveUserId();
    const userName = localStorage.getItem('sislav_current_user_name') || 'Sistema';
    const holdingId = getActiveHoldingId();

    // 1. Obtener items y datos de la guía
    const { data: guia, error: guiaError } = await supabase
        .from('guias_remision')
        .select('*, items_guia(*)')
        .eq('id', guiaId)
        .single();
    
    if (guiaError) throw guiaError;
    const itemsIds = itemsToProcess || (guia.items_guia || []).map((i: any) => i.item_venta_id || i.item_id);

    // 2. Determinar nuevo estado de los items si no se provee
    let finalItemEstado = itemEstado;
    if (!finalItemEstado) {
        if (nuevoEstadoGuia === 'ENTREGADO') {
            finalItemEstado = guia.tipo_guia === 'RECOJO' ? 'RECIBIDO_CENTRAL' : 'RECIBIDO_ACOPIO';
        } else if (nuevoEstadoGuia === 'EN_TRANSITO') {
            finalItemEstado = guia.tipo_guia === 'RECOJO' ? 'EN_TRANSITO_CENTRAL' : 'EN_TRANSITO_ACOPIO';
        }
    }

    // 3. Determinar ubicación para auditoría
    let ubicacionTipo = 'DELIVERY';
    let ubicacionId = guia.chofer_id;

    if (nuevoEstadoGuia === 'ENTREGADO') {
        ubicacionTipo = 'SUCURSAL';
        ubicacionId = guia.sucursal_destino_id;
    }

    // 4. Actualizar items y auditoría vía RPC
    if (finalItemEstado) {
        const { error: rpcError } = await supabase.rpc('procesar_movimiento_logistico', {
            p_items_ids: itemsIds,
            p_guia_id: guiaId,
            p_nuevo_estado: finalItemEstado,
            p_ubicacion_tipo: ubicacionTipo,
            p_ubicacion_id: ubicacionId,
            p_usuario_id: userId,
            p_usuario_nombre: userName
        });
        if (rpcError) throw rpcError;
    }

    // 5. Actualizar estado de la guía
    const updatePayload: any = { estado: nuevoEstadoGuia };
    if (nuevoEstadoGuia === 'ENTREGADO') updatePayload.fecha_entrega = new Date().toISOString();

    const { error: updateError } = await supabase
        .from('guias_remision')
        .update(updatePayload)
        .eq('id', guiaId);

    if (updateError) throw updateError;
};

export const dbUpdateGuiaItemStatus = async (guiaId: string, itemId: string, nuevoEstado: string) => {
    // Intentar con item_venta_id
    const { error } = await supabase
        .from('items_guia')
        .update({ estado_item: nuevoEstado })
        .eq('guia_id', guiaId)
        .eq('item_venta_id', itemId);
    
    if (error) {
        // Reintentar con item_id si falló por columna inexistente
        await supabase
            .from('items_guia')
            .update({ estado_item: nuevoEstado })
            .eq('guia_id', guiaId)
            .eq('item_id', itemId);
    }
};

/**
 * Actualiza el estado de múltiples ítems de venta y registra los movimientos
 */
export const dbUpdateMultipleItemsStatus = async (itemIds: string[], nuevoEstado: string, sucursalId: string, usuarioId: string, usuarioNombre: string) => {
    // 1. Actualizar los ítems
    const { error: itemError } = await supabase
        .from('items_venta')
        .update({ estado: nuevoEstado })
        .in('id', itemIds);

    if (itemError) throw itemError;

    // 2. Registrar movimientos
    const movements = itemIds.map(id => ({
        item_venta_id: id,
        estado_nuevo: nuevoEstado,
        ubicacion_tipo: 'SUCURSAL',
        ubicacion_id: sucursalId,
        usuario_id: usuarioId,
        usuario_nombre: usuarioNombre,
        fecha_registro: new Date().toISOString()
    }));

    const { error: logError } = await supabase
        .from('logistica_movimientos')
        .insert(movements);

    if (logError) throw logError;
};

/**
 * Obtiene los items que están físicamente en una sucursal central para procesamiento
 */
export const dbGetItemsEnPlanta = async (sucursalId: string | null) => {
    // Simplificado: Solo mostramos lo que está recibido en central o ya empaquetado
    // Intentamos traer también info de la última guía asociada para consolidación
    // Intento 1: Con join a items_guia
    let { data, error } = await supabase
        .from('items_venta')
        .select(`
            *, 
            ventas (
                *, 
                clientes (
                    id, 
                    nombres, 
                    apellidos, 
                    dni, 
                    ruc, 
                    razon_social
                ), 
                sucursales (*)
            ), 
            items_guia (
                guia_id, 
                guias_remision (
                    codigo_guia
                )
            )
        `)
        .in('estado', ['RECIBIDO_CENTRAL', 'EMPAQUETADO']);

    if (error) {
        console.warn("dbGetItemsEnPlanta join failed, using simple fetch:", error.message);
        const { data: simpleData, error: simpleError } = await supabase
            .from('items_venta')
            .select(`
                *, 
                ventas (
                    *, 
                    clientes (id, nombres, apellidos, dni, ruc, razon_social), 
                    sucursales (*)
                )
            `)
            .in('estado', ['RECIBIDO_CENTRAL', 'EMPAQUETADO']);
        
        if (simpleError) throw simpleError;
        data = simpleData;
    }
    
    return (data || []).map(it => {
        const guias = Array.isArray((it as any).items_guia) ? (it as any).items_guia : [(it as any).items_guia].filter(Boolean);
        const latestGuia = (guias as any[])[(guias as any[]).length - 1]?.guias_remision;

        return {
            ...it,
            codigo_guia: latestGuia?.codigo_guia || 'SIN GUÍA'
        };
    });
};

// --- LOGÍSTICA: CONEXIONES ENTRE SUCURSALES ---

export const dbGetSucursalConexiones = async (holdingId: string) => {
    const { data, error } = await supabase
        .from('sucursal_conexiones')
        .select('*')
        .eq('holding_id', holdingId);
    
    if (error) {
        console.error('Error fetching sucursal connections:', error);
        return [];
    }
    return data;
};

export const dbAddSucursalConexion = async (origenId: string, destinoId: string, holdingId: string) => {
    const { error } = await supabase
        .from('sucursal_conexiones')
        .insert({
            sucursal_origen_id: origenId,
            sucursal_destino_id: destinoId,
            holding_id: holdingId
        });
    
    if (error) throw error;
};

export const dbRemoveSucursalConexion = async (origenId: string, destinoId: string, holdingId: string) => {
    const { error } = await supabase
        .from('sucursal_conexiones')
        .delete()
        .eq('sucursal_origen_id', origenId)
        .eq('sucursal_destino_id', destinoId)
        .eq('holding_id', holdingId);
    
    if (error) throw error;
};

export const dbGetItemsPendientesLogistica = async (sucursalId: string, tipoSucursal: string) => {
    let query = supabase
        .from('items_venta')
        .select('*, ventas(*, clientes(*))');

    if (tipoSucursal === 'CENTRAL' || tipoSucursal === 'PLANTA') {
        // Para la planta, pendientes de envío son los que ya están empaquetados o marcados como listos en planta
        // Independientemente de su sucursal_id original (vienen de cualquier lado)
        query = query.in('estado', ['EMPAQUETADO', 'LISTO_EN_PLANTA', 'LISTO_PARA_RETORNO']);
    } else {
        // Para tiendas/acopios, pendientes de envío son los nuevos o recién recibidos
        query = query.eq('sucursal_id', sucursalId).in('estado', ['RECIBIDO', 'PENDIENTE', 'LISTO']);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
};

export const dbDeleteSupply = async (id: string) => {
    const { error } = await supabase.from('insumos').update({ activo: false }).eq('id', id);
    if (error) throw error;
};

// --- WHATSAPP REMINDERS ---

export const dbGetUndeliveredOrdersForReminders = async (): Promise<Invoice[]> => {
    const branchId = getActiveBranchId();
    if (!branchId) return [];

    try {
        const { data: ventas, error } = await supabase
            .from('ventas')
            .select(`
                *,
                clientes (*),
                items_venta (*)
            `)
            .eq('sucursal_id', branchId)
            .not('estado', 'in', '("ENTREGADO","CANCELADO")')
            .order('fecha_recepcion', { ascending: false });

        if (error) {
            console.error('Error fetching undelivered orders:', error);
            return [];
        }

        if (!ventas || ventas.length === 0) return [];

        const ventaIds = ventas.map(v => v.id);
        const { data: todosLosPagos } = await supabase
            .from('pagos_venta')
            .select('venta_id, monto')
            .in('venta_id', ventaIds);

        return ventas.map(v => {
            const pagosVenta = (todosLosPagos || []).filter(p => p.venta_id === v.id);
            const totalPagado = pagosVenta.reduce((sum, p) => sum + Number(p.monto), 0);

            return {
                id: v.id,
                sucursal_id: v.sucursal_id,
                empresa_holding_id: v.empresa_holding_id,
                cliente_id: v.cliente_id,
                client: {
                    id: v.clientes?.id,
                    sucursal_id: v.sucursal_id,
                    empresa_holding_id: v.empresa_holding_id,
                    name: fixEncoding(v.clientes?.nombres || 'CLIENTE').toUpperCase(),
                    phone: v.clientes?.telefono || '',
                    docNumber: v.clientes?.dni || '',
                    docType: v.clientes?.tipo_documento || 'DNI',
                    address: v.clientes?.direccion || '',
                    points: Number(v.clientes?.puntos) || 0
                },
                ordenNumber: v.codigo_orden,
                serie: v.serie_comprobante,
                correlativo: Number(v.correlativo_comprobante),
                type: v.tipo_comprobante as InvoiceType,
                orderStatus: v.estado as OrderStatus,
                totals: {
                    gravada: Number(v.total_gravada) || 0,
                    exonerada: Number(v.total_exonerada) || 0,
                    inafecta: Number(v.total_inafecta) || 0,
                    igv: Number(v.total_igv || v.monto_igv) || 0,
                    total: Number(v.total || v.total_venta) || 0
                },
                date: v.fecha_recepcion,
                items: (v.items_venta || []).map((it: any) => ({
                    id: it.id,
                    name: fixEncoding(it.descripcion),
                    quantity: Number(it.cantidad),
                    price: Number(it.precio_unitario),
                    subtotal: Number(it.subtotal),
                    status: it.estado as OrderStatus,
                    estado_id: it.estado_id
                })),
                notes: v.notes,
                descuento: Number(v.descuento) || 0,
                prePaymentAmount: totalPagado,
                sunatStatus: v.sunat_status || 'INTERNAL',
                ultimo_whatsapp_recuerdo_at: v.ultimo_whatsapp_recuerdo_at,
                reminderCount: Number(v.tracking_generado_count) || 0
            };
        });
    } catch (e) {
        console.error('Exception in dbGetUndeliveredOrdersForReminders:', e);
        return [];
    }
};

export const dbUpdateItemObservations = async (itemId: string, observaciones: string) => {
    const { error } = await supabase
        .from('items_venta')
        .update({ observaciones })
        .eq('id', itemId);
    if (error) throw error;
};

export const dbUpdateLastReminderSent = async (orderId: string) => {
    // Fetch current count to increment
    const { data } = await supabase
        .from('ventas')
        .select('tracking_generado_count')
        .eq('id', orderId)
        .single();
    
    const nextCount = (Number(data?.tracking_generado_count) || 0) + 1;

    const { error } = await supabase
        .from('ventas')
        .update({ 
            ultimo_whatsapp_recuerdo_at: new Date().toISOString(),
            tracking_generado_count: nextCount
        })
        .eq('id', orderId);
    if (error) throw error;
};

export const INITIAL_STORE_ITEMS: StoreItem[] = [
    { id: 'st1', name: 'DETERGENTE PREMIUM 20L', price: 85.00, provider: 'QUIMICA INDUSTRIAL', providerPhone: '51999888777', category: 'QUIMICOS', imageUrl: 'https://images.unsplash.com/photo-1584622781564-1d9876a13d00?q=80&w=400&auto=format&fit=crop', isRecommended: true },
    { id: 'st2', name: 'SUAVIZANTE SPRING 10L', price: 45.00, provider: 'QUIMICA INDUSTRIAL', providerPhone: '51999888777', category: 'QUIMICOS', imageUrl: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?q=80&w=400&auto=format&fit=crop' }
];

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';
import { SaasCompany, SaasBranch, SaasGlobalConfig, UserRole } from '../types';

/**
 * Helper para añadir timeout a promesas
 */
const withTimeout = <T>(promise: any, timeoutMs: number = 60000): Promise<T> => {
    return Promise.race([
        promise as Promise<T>,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms excedido`)), timeoutMs)
        )
    ]);
};

/**
 * Obtiene la configuración y catálogos globales
 */
export const getSaasGlobalConfig = async (): Promise<SaasGlobalConfig> => {
    const defaultConfig: SaasGlobalConfig = {
        apiToken: '',
        whatsappIconUrl: '',
        defaultColors: [],
        defaultHelpVideos: [],
        defaultCategoryImages: [],
        defaultPaymentImages: [],
        defaultMachineImages: [],
        globalModules: {},
        bannerCobro: '',
        whatsapp_saas: 0,
        whatsapp_cod_pais: '',
        url_bot: '',
        instancia_bot: '',
        apikey_bot: ''
    };

    try {
        // Reducimos timeout para config global en dev/inicio para no bloquear
        const isDev = import.meta.env.DEV;
        const baseConfigRes = await withTimeout<any>(
            supabase.from('saas_configuracion_global').select('*').order('id').limit(1).maybeSingle(),
            isDev ? 30000 : 60000 // 30s en dev, 60s en prod
        ).catch(() => ({ data: null }));
        
        const baseConfig = baseConfigRes.data;
        
        // Paralelismo con timeouts más largos para catálogos
        const catalogTimeout = isDev ? 30000 : 60000;
        const [
            catsRes,
            paymentsRes,
            machinesRes,
            colorsRes,
            videosRes
        ] = await Promise.all([
            withTimeout<any>(supabase.from('global_cat_categorias').select('*').eq('activo', true).order('nombre'), catalogTimeout).catch(() => ({ data: [] })),
            withTimeout<any>(supabase.from('global_cat_metodos_pago').select('*').eq('activo', true).order('nombre'), catalogTimeout).catch(() => ({ data: [] })),
            withTimeout<any>(supabase.from('global_cat_maquinas').select('*').eq('activo', true).order('nombre'), catalogTimeout).catch(() => ({ data: [] })),
            withTimeout<any>(supabase.from('global_cat_colores').select('*').eq('activo', true).order('nombre'), catalogTimeout).catch(() => ({ data: [] })),
            withTimeout<any>(supabase.from('global_cat_videos_ayuda').select('*').eq('activo', true).order('fecha_registro', { ascending: false }), catalogTimeout).catch(() => ({ data: [] }))
        ]);

        const cats = catsRes.data;
        const payments = paymentsRes.data;
        const machines = machinesRes.data;
        const colors = colorsRes.data;
        const videos = videosRes.data;

        return {
            apiToken: baseConfig?.token_maestro_identidad || '',
            whatsappIconUrl: baseConfig?.whatsapp_icon_url || '',
            defaultColors: colors || [],
            defaultHelpVideos: (videos || []).map((v: any) => ({
                id: v.id,
                title: v.titulo,
                youtubeUrl: v.url_youtube,
                category: 'TUTORIAL'
            })),
            defaultCategoryImages: (cats || []).map((c: any) => ({ id: c.id, name: c.nombre, url: c.url })),
            defaultPaymentImages: (payments || []).map((p: any) => ({ id: p.id, name: p.nombre, url: p.url })),
            defaultMachineImages: (machines || []).map((m: any) => ({ id: m.id, name: m.nombre, url: m.url, type: m.tipo })),
            globalModules: baseConfig?.modulos_globales || {},
            bannerCobro: baseConfig?.banner_cobro,
            whatsapp_saas: baseConfig?.whatsapp_saas,
            whatsapp_cod_pais: baseConfig?.whatsapp_cod_pais,
            url_bot: baseConfig?.url_bot,
            instancia_bot: baseConfig?.instancia_bot,
            apikey_bot: baseConfig?.apikey_bot
        };
    } catch (error) {
        console.error("Error en getSaasGlobalConfig:", error);
        return defaultConfig;
    }
};

/**
 * Sube imagen al storage en carpetas ordenadas
 */
export const uploadGlobalAsset = async (file: File, modulo: string): Promise<string> => {
    let folder = "";
    switch (modulo) {
        case 'CATEGORIA': folder = "global/a-categoria"; break;
        case 'MAQUINA': folder = "global/b-maquina"; break;
        case 'METODO_PAGO': folder = "global/c-metodo-pago"; break;
        case 'COLOR': folder = "global/d-textura"; break; // Carpeta para texturas
        case 'BANNER_COBRO': folder = "global/f-otros"; break;
        default: folder = "global/otros";
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('laundry-assets')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('laundry-assets')
        .getPublicUrl(filePath);

    return publicUrl;
};

/**
 * Sube imagen de empresa (Logo corporativo / Favicon)
 */
export const uploadCompanyAsset = async (file: File, companyName: string, field: 'LOGO' | 'FAVICON' = 'LOGO'): Promise<string> => {
    const cleanName = companyName.trim().toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const folderName = field === 'LOGO' ? 'logo_corporativo' : 'favicon_corporativo';
    const folder = `global/empresa/${cleanName}/${folderName}`;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('laundry-assets')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('laundry-assets')
        .getPublicUrl(filePath);

    return publicUrl;
};

/**
 * Sube imagen de sede (Logo/Favicon) al storage con ruta específica por holding y slug
 */
export const uploadBranchAsset = async (file: File, holdingName: string, branchSlug: string, field: 'LOGO' | 'FAVICON' = 'LOGO'): Promise<string> => {
    const cleanHolding = holdingName.trim().toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const folderName = field === 'LOGO' ? 'logos' : 'favicons';
    const folder = `global/empresa/${cleanHolding}/${branchSlug}/${folderName}`;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('laundry-assets')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('laundry-assets')
        .getPublicUrl(filePath);

    return publicUrl;
};

/**
 * Agrega un item al catálogo global (DB)
 */
export const addGlobalCatalogItem = async (item: { nombre: string, url?: string, hex?: string, tipo?: string, modulo: string }) => {
    let table = "";
    let payload: any = { nombre: item.nombre.toUpperCase(), activo: true };

    switch (item.modulo) {
        case 'CATEGORIA': 
            table = "global_cat_categorias"; 
            payload.url = item.url;
            break;
        case 'METODO_PAGO': 
            table = "global_cat_metodos_pago"; 
            payload.url = item.url;
            break;
        case 'MAQUINA': 
            table = "global_cat_maquinas"; 
            payload.url = item.url;
            payload.tipo = item.tipo || 'LAVADORA';
            break;
        case 'COLOR': 
            table = "global_cat_colores"; 
            payload.hex = item.hex || '#FFFFFF';
            payload.url_imagen = item.url || null; // Guardar URL de textura
            break;
        case 'VIDEO':
            table = "global_cat_videos_ayuda";
            payload.titulo = item.nombre;
            payload.url_youtube = item.url;
            delete payload.nombre;
            break;
        default: throw new Error("Módulo no reconocido");
    }

    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) throw error;
    return data;
};

export const softDeleteGlobalItem = async (id: string, modulo: string) => {
    let table = "";
    switch (modulo) {
        case 'CATEGORIA': table = "global_cat_categorias"; break;
        case 'METODO_PAGO': table = "global_cat_metodos_pago"; break;
        case 'MAQUINA': table = "global_cat_maquinas"; break;
        case 'COLOR': table = "global_cat_colores"; break;
        case 'VIDEO': table = "global_cat_videos_ayuda"; break;
        default: return;
    }
    const { error } = await supabase.from(table).update({ activo: false }).eq('id', id);
    if (error) throw error;
};

export const updateGlobalCatalogItem = async (id: string, modulo: string, item: { nombre: string, url?: string, hex?: string, tipo?: string }) => {
    let table = "";
    let payload: any = { nombre: item.nombre.toUpperCase() };

    switch (modulo) {
        case 'CATEGORIA': 
            table = "global_cat_categorias"; 
            if (item.url) payload.url = item.url;
            break;
        case 'METODO_PAGO': 
            table = "global_cat_metodos_pago"; 
            if (item.url) payload.url = item.url;
            break;
        case 'MAQUINA': 
            table = "global_cat_maquinas"; 
            if (item.url) payload.url = item.url;
            if (item.tipo) payload.tipo = item.tipo;
            break;
        case 'COLOR': 
            table = "global_cat_colores"; 
            if (item.hex) payload.hex = item.hex;
            if (item.url) payload.url_imagen = item.url;
            break;
        case 'VIDEO':
            table = "global_cat_videos_ayuda";
            payload.titulo = item.nombre;
            payload.url_youtube = item.url;
            delete payload.nombre;
            break;
        default: throw new Error("Módulo no reconocido");
    }

    const { error } = await supabase.from(table).update(payload).eq('id', id);
    if (error) throw error;
};

export const addGlobalHelpVideo = async (video: { titulo: string, url_youtube: string }) => {
    const { data, error } = await supabase.from('global_cat_videos_ayuda').insert({
        titulo: video.titulo.toUpperCase(),
        url_youtube: video.url_youtube,
        activo: true
    }).select().single();
    if (error) throw error;
    return data;
};

export const deleteGlobalHelpVideo = async (id: string) => {
    const { error } = await supabase.from('global_cat_videos_ayuda').update({ activo: false }).eq('id', id);
    if (error) throw error;
};

export const getSaasCompanies = async (page: number = 1, pageSize: number = 50) => {
    try {
        console.log(`⏳ [getSaasCompanies] Iniciando recuperación de empresas (Página: ${page})...`);
        
        const session = JSON.parse(localStorage.getItem('sislav_auth_session') || 'null');
        const isMaster = session?.user?.role === UserRole.SAAS_MASTER || session?.user?.isMasterBypass;

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let res;
        if (isMaster) {
            console.log("🛡️ [getSaasCompanies] Intentando consulta directa (Master)...");
            // Intentamos primero directa.
            res = await withTimeout<any>(supabase.from('empresas_holding').select('*', { count: 'exact' }).order('nombre_empresa').range(from, to), 20000)
                .catch(err => {
                    console.warn("⚠️ Consulta directa dio timeout o error:", err);
                    return { error: err, data: null, count: 0 };
                });
            
            // Solo vamos al RPC si hubo un error de RLS (PGRST116 o similar) no si es un 404 (PGRST125/404)
            if (res.error && res.error.code !== 'PGRST125' && res.error.status !== 404) {
                console.log("🔄 [getSaasCompanies] Error de permisos, intentando fallback RPC...");
                res = await withTimeout<any>(supabase.rpc('get_master_companies_paginated', { p_from: from, p_to: to }), 40000)
                    .catch(rpcErr => {
                        console.error("❌ Fallback RPC también falló:", rpcErr);
                        return { error: rpcErr, data: [], count: 0 };
                    });
            }
        } else {
            res = await withTimeout<any>(supabase.from('empresas_holding').select('*', { count: 'exact' }).order('nombre_empresa').range(from, to), 40000);
        }
        
        if (res.error) {
            console.error("❌ Error Supabase getSaasCompanies:", res.error);
            return { companies: [], total: 0 };
        }
        
        const data = res.data || [];
        console.log(`📊 [getSaasCompanies] Empresas encontradas: ${data.length}`);
        
        const mapped = data.map((c: any) => ({
            id: c.id,
            ruc: c.ruc,
            name: c.nombre_empresa,
            logoUrl: c.url_logo,
            faviconUrl: c.url_favicon,
            primaryColor: c.color_primario || '#4f46e5',
            secondaryColor: c.color_secundario || '#0f172a',
            ownerName: c.propietario_nombre,
            phone: c.telefono_contacto || c.telefono,
            email: c.correo_login,
            paymentStatus: c.estado_pago || 'PAID',
            isActive: c.activo !== false,
            createdAt: c.creado_en
        }));

        return { companies: mapped, total: res.count || 0 };
    } catch (e) {
        console.error("Excepción en getSaasCompanies:", e);
        return { companies: [], total: 0 };
    }
};

export const deleteSaasCompany = async (id: string) => {
    const { error } = await supabase
        .from('empresas_holding')
        .update({ activo: false, estado: 'i' })
        .eq('id', id);
    
    if (error) throw error;
    return true;
};

export const getSaasBranches = async (empresaId?: string, page: number = 1, pageSize: number = 50) => {
    try {
        console.log(`⏳ [getSaasBranches] Recuperando sedes${empresaId ? ' para empresa ' + empresaId : ''} (Página: ${page})...`);
        
        const session = JSON.parse(localStorage.getItem('sislav_auth_session') || 'null');
        const isMaster = session?.user?.role === UserRole.SAAS_MASTER || session?.user?.isMasterBypass;

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let res;
        if (isMaster) {
            console.log("🛡️ [getSaasBranches] Intentando consulta directa (Master)...");
            let query = supabase.from('sucursales').select('*', { count: 'exact' });
            if (empresaId) query = query.eq('empresa_id', empresaId);
            
            res = await withTimeout<any>(query.order('nombre_sucursal').range(from, to), 20000)
                .catch(err => {
                    console.warn("⚠️ Consulta directa sedes dio timeout o error:", err);
                    return { error: err, data: null, count: 0 };
                });

            if (res.error && res.error.code !== 'PGRST125' && res.error.status !== 404) {
                console.log("🔄 [getSaasBranches] Error de permisos, intentando fallback RPC...");
                res = await withTimeout<any>(supabase.rpc('get_master_branches_paginated', { p_empresa_id: empresaId, p_from: from, p_to: to }), 40000)
                    .catch(rpcErr => {
                        console.error("❌ Fallback RPC sedes también falló:", rpcErr);
                        return { error: rpcErr, data: [], count: 0 };
                    });
            }
        } else {
            let query = supabase.from('sucursales').select('*', { count: 'exact' });
            if (empresaId) query = query.eq('empresa_id', empresaId);
            res = await withTimeout<any>(query.order('nombre_sucursal').range(from, to), 40000);
        }
        
        if (res.error) {
            console.error("❌ Error Supabase getSaasBranches:", res.error);
            return { branches: [], total: 0 };
        }
        
        const data = res.data || [];
        console.log(`📊 [getSaasBranches] Sedes encontradas: ${data.length}`);
        
        const mapped = data.map((b: any) => ({
            id: b.id, 
            dbId: b.id,
            empresaId: b.empresa_id,
            name: b.nombre_sucursal,
            slug: b.slug,
            isActive: b.activo !== false,
            primaryColor: b.color_primario,
            secondaryColor: b.color_secundario,
            logoUrl: b.url_logo,
            faviconUrl: b.url_favicon,
            phone: b.telefono,
            address: b.direccion,
            ruc: b.ruc,
            razonSocial: b.razon_social,
            createdAt: b.creado_en,
            cobranza: b.cobranza,
            porcentajeIgv: b.porcentaje_igv,
            moneda_simbolo: b.moneda_simbolo,
            modo_sunat: b.modo_sunat,
            sunat_url: b.sunat_url,
            sol_user: b.sol_user,
            sol_pass: b.sol_pass,
            serie_boleta: b.serie_boleta,
            serie_factura: b.serie_factura,
            serie_nv: b.serie_nv,
            serie_nc_factura: b.serie_nc_factura,
            serie_nc_boleta: b.serie_nc_boleta,
            nombre_comercial: b.nombre_comercial,
            ubigeo: b.ubigeo,
            urbanizacion: b.urbanizacion,
            distrito: b.distrito,
            provincia: b.provincia,
            departamento: b.departamento,
            whatsapp_instance: b.whatsapp_instance,
            whatsapp_token: b.whatsapp_token,
            whatsapp_instance_name: b.whatsapp_instance_name,
            yape_tenant_id: b.yape_tenant_id,
            order_zeros_count: parseInt(b.order_zeros_count) || 5,
            use_order_suffix: b.use_order_suffix,
            order_current_suffix: b.prefijo_sufijo || b.order_current_suffix,
            prefijo_sufijo: b.prefijo_sufijo || b.order_current_suffix,
            order_suffix_position: b.order_suffix_position,
            puntos_equivalencia: b.puntos_equivalencia,
            use_order_reset: b.use_order_reset,
            limite_reconteo: b.limite_reconteo,
            modulos_config: b.modulos_config || {},
            doc_enforce_enabled: b.doc_enforce_enabled || false,
            doc_enforce_threshold: b.doc_enforce_threshold || 700
        }));

        return { branches: mapped, total: res.count || 0 };
    } catch (e) {
        console.error("Excepción en getSaasBranches:", e);
        return { branches: [], total: 0 };
    }
};

export const getTenants = async () => {
    const res = await withTimeout<any>(supabase.from('sucursales').select('*').eq('estado', 'a'));
    const data = res.data;
    return (data || []).map((b: any) => ({
        id: b.id, slug: b.slug, name: b.nombre_sucursal, isActive: b.activo,
        logoUrl: b.url_logo, primaryColor: b.color_primario, secondaryColor: b.color_secundario,
        cobranza: b.cobranza
    }));
};

export const createSaasCompany = async (company: any) => {
    // Obtenemos la sesión para usar el password maestro como llave de seguridad
    const session = JSON.parse(localStorage.getItem('sislav_auth_session') || 'null');
    let masterToken = session?.user?.masterPassword;

    // Si no está en la sesión, intentamos buscarlo en una llave de respaldo temporal
    if (!masterToken) {
        masterToken = localStorage.getItem('sislav_master_token_fallback');
    }

    if (!masterToken) {
        console.error("❌ No se encontró la llave de seguridad (Master Password).");
        throw new Error("Error de seguridad: Sesión maestra no autorizada. Por favor, cierre sesión y vuelva a entrar con su PIN Maestro para autorizar esta acción.");
    }

    // Usamos RPC con validación de Password para máxima seguridad
    const { data, error } = await supabase.rpc('admin_create_holding', {
        p_token: masterToken, // Usamos el password como token de seguridad
        p_ruc: company.ruc, 
        p_nombre_empresa: company.name, 
        p_propietario_nombre: company.ownerName,
        p_telefono_contacto: company.phone, 
        p_correo_login: company.email, 
        p_password_hash: company.password,
        p_url_logo: company.logoUrl,
        p_url_favicon: company.faviconUrl,
        p_color_primario: company.primaryColor,
        p_color_secundario: company.secondaryColor
    });

    if (error) {
        console.error("Error en RPC admin_create_holding:", error);
        throw error;
    }
    
    return data;
};

export const createInitialHoldingUser = async (userData: any) => {
    // Registrar en Supabase Auth para acceso corporativo
    // IMPORTANTE: Usamos un cliente temporal para evitar que el Super Admin sea deslogueado al crear un usuario
    const { createClient } = await import('@supabase/supabase-js');
    
    const tempClient = createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        }
    );

    const { data: authUser, error: authError } = await tempClient.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
            data: {
                full_name: userData.name,
                empresa_holding_id: userData.empresaHoldingId,
                role: UserRole.OWNER
            }
        }
    });

    if (authError) throw authError;
    if (!authUser.user) throw new Error("No se pudo crear el usuario en Auth");

    // 2. Guardar en la tabla usuarios_login usando RPC para bypass de RLS
    const { error: dbError } = await supabase.rpc('crear_usuario_sucursal', {
        p_auth_user_id: authUser.user.id,
        p_empresa_holding_id: userData.empresaHoldingId,
        p_sucursal_id: null, // Los usuarios de holding no están amarrados a una sucursal específica
        p_username: userData.username,
        p_nombre_completo: userData.name,
        p_rol: userData.role || UserRole.OWNER,
        p_password_hash: userData.password, // Se pasa para consistencia, aunque el auth ya lo maneja
        p_nombre_empresa: userData.holdingName || null
    });

    if (dbError) {
        console.error("Error al llamar a crear_usuario_sucursal:", dbError);
        throw dbError;
    }

    return authUser.user;
};

export const updateSaasCompany = async (id: string, company: any) => {
    const payload: any = {
        ruc: company.ruc,
        nombre_empresa: company.name,
        propietario_nombre: company.ownerName,
        telefono_contacto: company.phone,
        correo_login: company.email,
        url_logo: company.logoUrl,
        url_favicon: company.faviconUrl,
        color_primario: company.primaryColor,
        color_secundario: company.secondaryColor,
        activo: company.isActive
    };
    if (company.password) {
        payload.password_hash = company.password;
    }
    const { data, error } = await supabase.from('empresas_holding').update(payload).eq('id', id);
    if (error) throw error;
    return data;
};

export const createSaasBranch = async (branch: any) => {
    const { data, error } = await supabase.from('sucursales').insert({
        empresa_id: branch.empresaId,
        nombre_sucursal: branch.name,
        razon_social: branch.razonSocial,
        slug: branch.slug,
        ruc: branch.ruc,
        direccion: branch.address,
        telefono: branch.phone,
        modo_sunat: branch.modo_sunat,
        sunat_url: branch.sunat_url,
        sol_user: branch.sol_user,
        sol_pass: branch.sol_pass,
        serie_boleta: branch.serie_boleta,
        serie_factura: branch.serie_factura,
        serie_nv: branch.serie_nv,
        serie_nc_factura: branch.serie_nc_factura,
        serie_nc_boleta: branch.serie_nc_boleta,
        nombre_comercial: branch.nombre_comercial,
        ubigeo: branch.ubigeo,
        urbanizacion: branch.urbanizacion,
        distrito: branch.distrito,
        provincia: branch.provincia,
        departamento: branch.departamento,
        whatsapp_instance: branch.whatsapp_instance,
        whatsapp_token: branch.whatsapp_token,
        whatsapp_instance_name: branch.whatsapp_instance_name,
        yape_tenant_id: branch.yape_tenant_id,
        order_zeros_count: parseInt(branch.order_zeros_count),
        use_order_suffix: branch.use_order_suffix,
        order_current_suffix: branch.order_current_suffix,
        order_suffix_position: branch.order_suffix_position,
        use_order_reset: branch.use_order_reset || false,
        limite_reconteo: parseInt(branch.limite_reconteo) || 10000,
        puntos_equivalencia: branch.puntos_equivalencia || 10,
        cobranza: branch.cobranza || false,
        color_primario: branch.color_primario,
        color_secundario: branch.color_secundario,
        url_logo: branch.url_logo,
        url_favicon: branch.url_favicon,
        activo: true,
        estado: 'a',
        porcentaje_igv: branch.porcentaje_igv || 18.00,
        moneda_simbolo: branch.moneda_simbolo || 'S/',
        modulos_config: branch.modulos_config || {},
        doc_enforce_enabled: branch.doc_enforce_enabled || false,
        doc_enforce_threshold: parseFloat(branch.doc_enforce_threshold) || 700
    }).select().single();
    if (error) throw error;
    return data;
};

export const createInitialBranchUser = async (userData: any) => {
    const virtualEmail = `${userData.username.trim().toLowerCase()}@sislav.com`;

    // 1. Registrar en Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: virtualEmail,
        password: userData.password,
        options: {
            data: {
                full_name: userData.name,
                sucursal_id: userData.sucursalId
            }
        }
    });

    if (authError) throw authError;
    if (!authUser.user) throw new Error("No se pudo crear el usuario en Auth");

    // 2. Guardar en la tabla usuarios_login usando RPC para bypass de RLS
    const { error } = await supabase.rpc('crear_usuario_sucursal', {
        p_auth_user_id: authUser.user.id,
        p_empresa_holding_id: userData.empresaId,
        p_sucursal_id: userData.sucursalId,
        p_username: userData.username,
        p_nombre_completo: userData.name,
        p_rol: UserRole.ADMIN,
        p_password_hash: userData.password,
        p_nombre_empresa: userData.holdingName || null
    });

    if (error) {
        console.error("Error al llamar a crear_usuario_sucursal para sede:", error);
        throw error;
    }
    return authUser.user;
};

export const updateSaasBranch = async (id: string, branch: any) => {
    const { data, error } = await supabase.from('sucursales').update({
        nombre_sucursal: branch.name,
        razon_social: branch.razonSocial,
        ruc: branch.ruc,
        direccion: branch.address,
        telefono: branch.phone,
        modo_sunat: branch.modo_sunat,
        sunat_url: branch.sunat_url,
        sol_user: branch.sol_user,
        sol_pass: branch.sol_pass,
        serie_boleta: branch.serie_boleta,
        serie_factura: branch.serie_factura,
        serie_nv: branch.serie_nv,
        serie_nc_factura: branch.serie_nc_factura,
        serie_nc_boleta: branch.serie_nc_boleta,
        nombre_comercial: branch.nombre_comercial,
        ubigeo: branch.ubigeo,
        urbanizacion: branch.urbanizacion,
        distrito: branch.distrito,
        provincia: branch.provincia,
        departamento: branch.departamento,
        whatsapp_instance: branch.whatsapp_instance,
        whatsapp_token: branch.whatsapp_token,
        whatsapp_instance_name: branch.whatsapp_instance_name,
        yape_tenant_id: branch.yape_tenant_id,
        order_zeros_count: parseInt(branch.order_zeros_count),
        use_order_suffix: branch.use_order_suffix,
        order_current_suffix: branch.order_current_suffix,
        prefijo_sufijo: branch.order_current_suffix,
        order_suffix_position: branch.order_suffix_position,
        use_order_reset: branch.use_order_reset,
        limite_reconteo: parseInt(branch.limite_reconteo),
        puntos_equivalencia: branch.puntos_equivalencia,
        cobranza: branch.cobranza,
        color_primario: branch.color_primario,
        color_secundario: branch.color_secundario,
        url_logo: branch.url_logo,
        url_favicon: branch.url_favicon,
        activo: branch.isActive,
        porcentaje_igv: branch.porcentaje_igv,
        moneda_simbolo: branch.moneda_simbolo,
        modulos_config: branch.modulos_config,
        doc_enforce_enabled: branch.doc_enforce_enabled,
        doc_enforce_threshold: parseFloat(branch.doc_enforce_threshold)
    }).eq('id', id);
    if (error) throw error;
    return data;
};

export const updateSaasGlobalConfig = async (updates: any) => {
    try {
        console.log("⏳ [updateSaasGlobalConfig] Intentando actualización...", updates);
        
        // 1. Intentamos obtener el ID del primer registro (solo debería haber uno)
        const { data: firstRow, error: fetchError } = await supabase
            .from('saas_configuracion_global')
            .select('id')
            .limit(1)
            .maybeSingle();

        if (fetchError) {
            console.error("❌ Error al buscar ID de configuración global:", fetchError);
            throw fetchError;
        }

        const targetId = firstRow?.id || 1;
        console.log(`🎯 [updateSaasGlobalConfig] Target ID: ${targetId}`);

        // 2. Ejecutamos la actualización
        const { error: updateError } = await supabase
            .from('saas_configuracion_global')
            .update(updates)
            .eq('id', targetId);

        if (updateError) {
            console.error("❌ Error en update configuracion global:", updateError);
            throw updateError;
        }
        
        console.log("✅ [updateSaasGlobalConfig] Actualización exitosa.");
    } catch (err) {
        console.error("🔥 Excepción crítica en updateSaasGlobalConfig:", err);
        throw err;
    }
};
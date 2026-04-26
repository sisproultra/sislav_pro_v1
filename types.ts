export enum UserRole {
    SAAS_MASTER = 'SAAS_MASTER',
    OWNER = 'OWNER',
    ADMIN = 'ADMIN',
    CAJERO = 'CAJERO',
    OPERARIO = 'OPERARIO',
    DELIVERY = 'DELIVERY',
    CONTABILIDAD = 'CONTABILIDAD'
}

export interface AuthSession {
    user: {
        id: string;
        username: string;
        name: string;
        role: UserRole;
        holding_id?: string;
        holding_name?: string;
        sucursal_id?: string;
        isMasterBypass?: boolean;
        masterPassword?: string;
        sucursal_data?: any;
        permissions?: Record<string, boolean>;
    };
}

declare global {
  interface Window {
    __SUCURSAL_BRANDING__?: any;
    __BRANDING_STATUS__?: 'none' | 'loading' | 'ready' | 'failed';
  }
}

export interface BaseEntity {
    id: string;
    sucursal_id: string;
    empresa_holding_id?: string;
}

export interface PromoBanner {
    id: string;
    url: string;
    name: string;
    isActive: boolean;
}

export interface Company extends BaseEntity {
    razonSocial: string;
    ruc: string;
    ubigeo?: string;
    address: string;
    logoUrl?: string;
    sunatEnvironment: 'BETA' | 'PRODUCTION' | 'INTERNAL';
    nombre_comercial?: string;
    urbanizacion?: string;
    distrito?: string;
    provincia?: string;
    departamento?: string;
    apiToken: string;
    serieBoleta: string;
    serieFactura: string;
    serieNotaVenta: string;
    moneda_simbolo?: string;
    currencySymbol?: string;
    porcentajeIgv?: number;
    primaryColor?: string;
    secondaryColor?: string;
    sunat_url?: string;
    solUser?: string;
    solPass?: string;
    orderZerosCount?: number;
    order_zeros_count?: number;
    useOrderSuffix?: boolean;
    use_order_suffix?: boolean;
    orderCurrentSuffix?: string;
    order_current_suffix?: string;
    prefijo_sufijo?: string;
    orderSuffixPosition?: 'BEFORE' | 'AFTER';
    order_suffix_position?: string;
    use_order_reset?: boolean;
    limite_reconteo?: number;
    whatsapp_instance?: string;
    whatsapp_token?: string;
    whatsapp_instance_name?: string;
    pointsEquivalency?: number;
    promoBanners?: PromoBanner[];
    yapeTenantId?: string;
    yapeVisibilityMode?: 'ALL' | 'TODAY' | 'CONFIG_24H' | 'RANGE';
    yapeStartTime?: string;
    yapeEndTime?: string;
    yapeConfigTimestamp?: string;
    contactPhone?: string;
    msgPickup?: string;
    orderCurrentNumber?: number;
    ticketPolicies?: string;
    serieNcFactura?: string;
    serieNcBoleta?: string;
    holding_name?: string;
    activo?: boolean;
    cobranza?: boolean;
    modulos_config?: Record<string, any>;
    mostrar_codigo_barras?: boolean;
    doc_enforce_enabled?: boolean;
    doc_enforce_threshold?: number;
}

export interface Sucursal extends Company {
    nombre_sucursal: string;
    color_primario: string;
    color_secundario: string;
    url_logo?: string;
    url_favicon?: string;
    telefono?: string;
    direccion: string;
    slug: string;
}

export interface Client extends BaseEntity {
    docType: string;
    docNumber: string;
    name: string;
    ruc?: string;
    razon_social?: string;
    phone?: string;
    email?: string;
    address: string;
    ubigeo?: string;
    urbanizacion?: string;
    distrito?: string;
    provincia?: string;
    departamento?: string;
    points: number;
    birthday?: string;
    gender?: string;
    alertMessage?: string;
    alertColor?: string;
    activo?: boolean;
    sunatStatus?: string;
    sunatCondition?: string;
    latitude?: number;
    longitude?: number;
    googleMapsUrl?: string;
}

export type OrderStatus = 'PENDIENTE' | 'RECIBIDO' | 'EN_LAVADO' | 'EN_SECADO' | 'LISTO' | 'EN_RUTA' | 'ENTREGADO' | 'ENTREGA_PARCIAL' | 'CANCELADO' | 'NO_ENTREGADO' | 'LISTO_PARA_RECOJO' | 'EN_TRANSITO_CENTRAL' | 'RECIBIDO_CENTRAL' | 'PROCESANDO_CENTRAL' | 'LISTO_PARA_RETORNO' | 'EN_TRANSITO_ACOPIO' | 'RECIBIDO_ACOPIO';

export const ORDER_STATUS_MAP: Record<OrderStatus, number> = {
    'PENDIENTE': 1,
    'RECIBIDO': 2,
    'EN_LAVADO': 3,
    'EN_SECADO': 4,
    'LISTO': 5,
    'EN_RUTA': 6,
    'ENTREGADO': 7,
    'CANCELADO': 9,
    'NO_ENTREGADO': 8,
    'ENTREGA_PARCIAL': 10,
    'LISTO_PARA_RECOJO': 11,
    'EN_TRANSITO_CENTRAL': 12,
    'RECIBIDO_CENTRAL': 13,
    'PROCESANDO_CENTRAL': 14,
    'LISTO_PARA_RETORNO': 15,
    'EN_TRANSITO_ACOPIO': 16,
    'RECIBIDO_ACOPIO': 17
};

export enum InvoiceType { FACTURA = '01', NOTA_CREDITO = '07', BOLETA = '03', NOTA_VENTA = '80' }
export enum IgvType { GRAVADO = '10', EXONERADO = '20', INAFECTO = '30' }
export enum UnitCode { ZZ = 'ZZ', NIU = 'NIU', KGM = 'KGM', MTK = 'MTK', LTR = 'LTR' }
export enum UmSaas { UNIDAD = 'UNIDAD', KILO = 'KILO', PIEZA = 'PIEZA', METROS = 'METROS', LITRO = 'LITRO' }

export interface Product extends BaseEntity {
    name: string;
    price: number;
    category: string;
    description?: string;
    activo: boolean;
    unitCode: UnitCode;
    um_saas?: UmSaas;
    igvType?: IgvType;
    stock: number;
    pointsPrice?: number;
    cost: number;
    estado: string;
    categoria_id?: string;
    showInCatalog?: boolean;
    imageUrl?: string;
    imagen_id?: string;
    recipe?: RecipeItem[];
    trackStock?: boolean;
    processingTime?: string;
}

export interface CartItem extends Product {
    quantity: number;
    subtotal: number;
    producto_id?: string;
    color?: string;
    defectos?: string;
    details?: string;
    status?: OrderStatus;
    images?: string[];
    audioNote?: string;
    itemDeliveryDate?: string;
    unitDetails?: ItemDetalle[];
    originalPrice?: number;
    isAnulado?: boolean;
    es_ajuste?: boolean;
    estado_id?: number;
    // SUNAT / PRECISIÓN
    tipo_igv_codigo?: string;
    codigo_unidad?: string;
    valor_unitario?: number;
    igv_item?: number;
    descuento_item?: number;
    photoUrl?: string;
    voiceNoteUrl?: string;
}

export interface ItemDetalle {
    color?: string;
    defectos?: string;
    observaciones?: string;
    fecha_entrega_especifica?: string;
    unit_images?: string[];
    unit_audio?: string | null;
}

export interface PaymentRecord {
    id?: string;
    metodo_pago_id: string;
    metodo_pago_name?: string;
    monto: number;
    date?: string;
    usuario_id?: string;
}

export interface Invoice extends BaseEntity {
    cliente_id: string;
    client: Client;
    ordenNumber?: string;
    serie: string;
    correlativo: number;
    type: InvoiceType;
    orderStatus: OrderStatus;
    totals: InvoiceTotals;
    date: string;
    fecha_emision?: string;
    items: CartItem[];
    payments?: PaymentRecord[];
    sunatStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'INTERNAL';
    deliveryDate?: string;
    origin?: 'TIENDA' | 'DELIVERY';
    pickupId?: string;
    notes?: string;
    prePaymentAmount?: number;
    descuento?: number;
    qrCodeData?: string;
    sunatResponse?: SunatResponse;
    vistoDelivery?: boolean;
    paymentMethod?: string;
    orderCorrelativoRaw?: number;
    lavanderia_at?: string;
    listo_at?: string;
    en_camino_entrega_at?: string;
    entregado_at?: string;
    operario_id?: string;
    ticketNumber?: string;
    relatedDocument?: {
        serie: string;
        correlativo: number;
        type: string;
    };
    url_foto_cliente_1?: string;
    url_foto_cliente_2?: string;
    url_foto_cliente_3?: string;
}

export interface InvoiceTotals { gravada: number; exonerada: number; inafecta: number; igv: number; total: number; }
export interface Category extends BaseEntity { name: string; isActive: boolean; imageUrl?: string; imagen_id?: string; }

export interface PaymentMethodConfig {
    id: string;
    name: string;
    isActive: boolean;
    icon: string;
    sunatCode: string;
    imagen_id?: string;
    color?: string;
}

export interface Expense extends BaseEntity { 
    description: string; 
    amount: number; 
    date: string; 
    category: string; 
    paymentMethod: string; 
    evidencePhoto?: string; 
    usuarioRegistro?: string; 
    usuarioId?: string;
}

export interface Machine extends BaseEntity {
    name: string;
    type: 'LAVADORA' | 'SECADORA';
    capacityKg: number;
    estado_operativo: 'DISPONIBLE' | 'OCUPADO' | 'MANTENIMIENTO';
    imageUrl: string;
    totalCycles: number;
    totalKg: number;
    totalMinutes: number;
    currentOrderId?: string | null;
    startTime?: string | null;
    estimatedDuration?: number | null;
    maintenanceIntervalHours?: number;
    maintenanceIntervalKg?: number;
    maintenanceIntervalCycles?: number;
    totalOrders?: number;
    activo: boolean;
    estado: string;
}

export interface PickupRequest extends BaseEntity {
    clientName: string;
    address: string;
    phone: string;
    scheduledDate: string;
    timeRange: string;
    status: string;
    cliente_id?: string;
    createdAt?: string;
    isSelfScheduled?: boolean;
    isReadByAdmin?: boolean;
    googleMapsUrl?: string;
    latitude?: number;
    longitude?: number;
    priority?: 'NORMAL' | 'ALTA';
    notes?: string;
    completedAt?: string;
    en_camino_recojo_at?: string;
    recogido_at?: string;
}

export interface GlobalHelpVideo { id: string; title: string; youtubeUrl: string; category?: string; }
export interface GlobalCategoryImage { id: string; name: string; url: string; }
export interface GlobalPaymentImage { id: string; name: string; url: string; }
export interface GlobalColor {
    id: string;
    nombre: string;
    hex: string;
    url_imagen?: string;
    activo: boolean;
}

export interface SaasGlobalConfig {
    defaultHelpVideos: GlobalHelpVideo[];
    globalModules: Record<string, any>;
    apiToken: string;
    whatsappIconUrl: string;
    defaultColors: GlobalColor[];
    defaultCategoryImages: any[];
    defaultPaymentImages: any[];
    defaultMachineImages: any[];
    bannerCobro?: string;
    whatsapp_saas?: number;
    whatsapp_cod_pais?: string;
    url_bot?: string;
    instancia_bot?: string;
    apikey_bot?: string;
}

export interface Supply extends BaseEntity {
    name: string;
    unit: string;
    minStock: number;
    maxStock?: number;
    currentStock: number;
    lastCost?: number;
    averageCost?: number;
    color?: string;
}

export interface RecipeItem {
    supplyId: string;
    name: string;
    quantity: number;
    unit: string;
    cost: number;
}

export enum IdentityDocumentType {
    DNI = '1',
    RUC = '6',
    SIN_DOCUMENTO = '0'
}

export enum PaymentMethod {
    CONTADO = '1',
    CREDITO = '2'
}

export interface SunatResponse {
    success: boolean;
    description: string;
    hash?: string;
    pdfUrl?: string;
    xmlUrl?: string;
    cdrUrl?: string;
}

export interface GlobalModuleConfig {
    isActive: boolean;
    isNew?: boolean;
    allowedRoles?: UserRole[];
}

export interface PausedSale extends BaseEntity {
    date: string;
    client: Client | null;
    cart: CartItem[];
    docType: InvoiceType;
    es_cotizacion?: boolean;
    cliente_nombre?: string;
    numero_cotizacion?: number;
}

export interface TenantConfig {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    modules?: Record<string, boolean>;
}

export interface Purchase extends BaseEntity {
    date: string;
    supplier: string;
    totalAmount: number;
    items: PurchaseItem[];
}

export interface PurchaseItem {
    supplyId: string;
    name: string;
    quantity: number;
    unitCost: number;
    total: number;
}

export interface CashClosing extends BaseEntity {
    cajero: string;
    caja: string;
    turno: string;
    fechaApertura: string;
    fechaCierre: string;
    openingBalance: number;
    cashSales: number;
    otherSales: Record<string, number>;
    expenses: number;
    expectedCash: number;
    actualCash: number;
    difference: number;
    transactions: any[];
    topCategories?: { name: string; quantity: number; amount: number }[];
}

export interface StockMovement extends BaseEntity {
    date: string;
    supplyId: string;
    supplyName: string;
    type: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
    quantity: number;
    cost: number;
}

export interface MachineImage {
    id: string;
    name: string;
    url: string;
    type: 'LAVADORA' | 'SECADORA';
}

export interface StoreItem {
    id: string;
    name: string;
    price: number;
    provider: string;
    providerPhone: string;
    category: 'QUIMICOS' | 'ACCESORIOS' | 'PREMIUM';
    imageUrl: string;
    isRecommended?: boolean;
}

export interface Employee extends BaseEntity {
    name: string;
    username: string;
    password?: string;
    role: UserRole;
    phone?: string;
    photoUrl?: string;
    isActive: boolean;
    permissions?: PermissionMap;
    nombreEmpresa?: string;
}

export type PermissionMap = Record<string, boolean>;

export interface PermissionDefinition {
    id: string;
    label: string;
    description: string;
    group: 'PRINCIPAL' | 'GESTION' | 'LOGISTICA' | 'MARKETING' | 'ADMIN';
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
    { id: 'view:dashboard', label: 'Dashboard', description: 'Vista general de KPIs', group: 'PRINCIPAL' },
    { id: 'view:agenda', label: 'Agenda', description: 'Control de entregas', group: 'PRINCIPAL' },
    { id: 'view:pos', label: 'Punto de Venta', description: 'Realizar ventas', group: 'PRINCIPAL' },
    { id: 'view:orders', label: 'Mis Órdenes', description: 'Gestión de tickets', group: 'PRINCIPAL' },
    { id: 'view:operations', label: 'Operaciones', description: 'Lavado y Secado', group: 'PRINCIPAL' },
    { id: 'view:cash_closing', label: 'Cierre de Caja', description: 'Arqueos de turno', group: 'PRINCIPAL' },
    { id: 'view:history', label: 'Documentos Elec.', description: 'Historial SUNAT', group: 'PRINCIPAL' },
    { id: 'view:yape', label: 'Mis Yapes', description: 'Monitor de pagos Yape', group: 'PRINCIPAL' },
    
    { id: 'view:inventory', label: 'Servicios', description: 'Catálogo de precios', group: 'GESTION' },
    { id: 'view:clients', label: 'Clientes', description: 'Cartera de clientes', group: 'GESTION' },
    { id: 'view:employees', label: 'Empleados', description: 'Gestión de personal', group: 'GESTION' },
    { id: 'view:expenses', label: 'Egresos', description: 'Salidas de caja y gastos', group: 'GESTION' },
    
    { id: 'view:machines', label: 'Máquinas', description: 'Control de equipos', group: 'LOGISTICA' },
    { id: 'view:callcenter', label: 'Call Center', description: 'Gestión de pedidos telefónicos', group: 'LOGISTICA' },
    { id: 'view:delivery', label: 'Delivery', description: 'Gestión de repartos', group: 'LOGISTICA' },
    { id: 'view:supplies', label: 'Insumos', description: 'Stock de detergentes', group: 'LOGISTICA' },
    { id: 'view:purchases', label: 'Compras', description: 'Ingresos de almacén', group: 'LOGISTICA' },
    { id: 'view:package_inventory', label: 'Inv. Paquetes', description: 'Control de paquetes de ropa', group: 'LOGISTICA' },
    { id: 'view:product_counting', label: 'Conteo Inventario', description: 'Registro de pallets y cajas', group: 'LOGISTICA' },
    
    { id: 'view:loyalty', label: 'Fidelización', description: 'Cupones de descuento', group: 'MARKETING' },
    { id: 'view:bonus_points', label: 'Puntos Bonus', description: 'Canjes de clientes', group: 'MARKETING' },
    { id: 'view:promotions', label: 'Promociones', description: 'Ofertas y packs', group: 'MARKETING' },
    { id: 'view:wa_campaign', label: 'Campaña WA', description: 'Marketing por WhatsApp', group: 'MARKETING' },
    
    { id: 'view:categories', label: 'Categorías', description: 'Clasificación de servicios', group: 'ADMIN' },
    { id: 'view:payment_methods', label: 'Pagos', description: 'Métodos de pago aceptados', group: 'ADMIN' },
    { id: 'view:reports', label: 'Reportes', description: 'Análisis de ventas y egresos', group: 'ADMIN' },
    { id: 'view:accounting', label: 'Contabilidad', description: 'Reportes para contador y SUNAT', group: 'ADMIN' },
    { id: 'view:settings', label: 'Ajustes', description: 'Configuración local', group: 'ADMIN' },
    { id: 'view:my_reports', label: 'Mis Reportes', description: 'Reportes de ingresos y ventas', group: 'PRINCIPAL' }
];

export const SUNAT_PAYMENT_CODES = [
    { code: '001', label: 'DEPÓSITO EN CUENTA' },
    { code: '003', label: 'TRANSFERENCIA DE FONDOS' },
    { code: '005', label: 'TARJETA DE DÉBITO' },
    { code: '006', label: 'TARJETA DE CRÉDITO' },
    { code: '008', label: 'EFECTIVO - COBRANZA' },
    { code: '009', label: 'EFECTIVO' }
];

export interface SaasCompany {
    id: string;
    ruc: string;
    name: string;
    logoUrl?: string;
    faviconUrl?: string;
    faviconLogisticaUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    ownerName: string;
    phone: string;
    email?: string;
    paymentStatus: string;
    isActive: boolean;
    createdAt: string;
}

export interface SaasBranch {
    id: string;
    dbId: string;
    empresaId: string;
    name: string;
    slug: string;
    isActive: boolean;
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
    faviconUrl?: string;
    phone?: string;
    address: string;
    ruc: string;
    razonSocial?: string;
    createdAt: string;
    cobranza?: boolean;
    porcentajeIgv?: number;
    moneda_simbolo?: string;
    modo_sunat?: string;
    sunat_url?: string;
    sol_user?: string;
    sol_pass?: string;
    serie_boleta?: string;
    serie_factura?: string;
    serie_nv?: string;
    serie_nc_factura?: string;
    serie_nc_boleta?: string;
    whatsapp_instance?: string;
    whatsapp_token?: string;
    whatsapp_instance_name?: string;
    yape_tenant_id?: string;
    order_zeros_count?: number;
    use_order_suffix?: boolean;
    order_current_suffix?: string;
    order_suffix_position?: string;
    puntos_equivalencia?: number;
    use_order_reset?: boolean;
    limite_reconteo?: number;
}

export enum SucursalType {
    ESTANDAR = 'ESTANDAR',
    ACOPIO = 'ACOPIO',
    CENTRAL = 'CENTRAL'
}

export interface GuiaRemision {
    id: string;
    empresa_holding_id: string;
    sucursal_origen_id: string;
    sucursal_destino_id: string;
    chofer_id: string;
    codigo_guia: string;
    tipo_guia: 'RECOJO' | 'RETORNO';
    estado: 'PENDIENTE' | 'EN_TRANSITO' | 'ENTREGADO' | 'CANCELADO';
    fecha_registro: string;
    fecha_entrega?: string;
    registrado_por: string;
    notas?: string;
    sucursal_origen?: any;
    sucursal_destino?: any;
    chofer?: any;
}

export interface ItemGuia {
    id: string;
    guia_id: string;
    item_id: string;
    venta_id: string;
    estado_item: string;
    fecha_registro: string;
}

export interface HistorialLogistica {
    id: string;
    item_id: string;
    venta_id: string;
    guia_id?: string;
    estado_anterior: string;
    estado_nuevo: string;
    ubicacion_tipo: 'ACOPIO' | 'DELIVERY' | 'CENTRAL';
    ubicacion_id: string;
    usuario_id: string;
    usuario_nombre: string;
    fecha_registro: string;
    metadata?: any;
}

export interface ChoferSucursal {
    id: string;
    chofer_id: string;
    sucursal_id: string;
    fecha_asignacion: string;
}

export interface Coupon extends BaseEntity {
    code: string;
    amount: number;
    expirationDate: string;
    isUsed: boolean;
    conditions?: string;
}

export interface Contact {
    id: string;
    name: string;
    phone: string;
    status: 'pending' | 'processing' | 'sent' | 'failed';
    sentAt?: Date;
    error?: string;
}

export interface CampaignTemplate {
    text: string;
}

export enum CampaignStatus {
    IDLE = 'IDLE',
    RUNNING = 'RUNNING',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED'
}

export interface CampaignMetrics {
    total: number;
    sent: number;
    failed: number;
    pending: number;
}

export interface EvolutionConfig {
    baseUrl: string;
    apiKey: string;
    instanceName: string;
}

export interface InventoryCount extends BaseEntity {
    producto_id: string;
    codigo: string;
    nombre: string;
    pallets: number;
    cajas: number;
    unidades: number;
    cantidad: number;
    fecha_vencimiento?: string;
    usuario_registro: string;
    fecha_registro?: string;
    fotos?: string[];
    zona?: string;
    accion?: string;
    cantidad_accion?: number;
    fecha_accion?: string;
}

export type PickupStatus = 'PENDING' | 'IN_ROUTE' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
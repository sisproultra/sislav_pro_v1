# Documentación Funcional y Técnica - SISLAV (As-Built)

## 1. DESCRIPCIÓN GENERAL

### Nombre del Sistema
**SISLAV** (Sistema Integral de Lavandería)

### Propósito
SISLAV es una plataforma SaaS (Software as a Service) diseñada para la gestión integral de negocios de lavandería. Permite la administración de múltiples empresas (holdings) y sucursales, cubriendo desde la recepción de prendas hasta la entrega final, incluyendo control de inventario, caja, procesos en máquinas y fidelización de clientes.

### Tecnologías Utilizadas
- **Frontend**: React 18+, TypeScript, Tailwind CSS.
- **Iconografía**: Lucide React.
- **Animaciones**: Motion (framer-motion).
- **Backend**: Supabase (BaaS) - Auth, Database (PostgreSQL), Storage, Edge Functions (RPC).
- **Estado Global**: React Hooks (useState, useEffect, useContext).
- **Consultas**: Supabase JS Client.

### Arquitectura (MVC)
El sistema implementa un patrón de arquitectura desacoplado:
- **Modelos (M)**: Definidos mediante interfaces de TypeScript en `src/types.ts`. Representan la estructura de datos del sistema.
- **Vistas (V)**: Componentes de React ubicados en `src/views/` y `src/components/`. Se encargan de la representación visual y la interacción del usuario.
- **Controladores (C)**: Implementados como servicios en `src/services/dbService.ts` (lógica de negocio de sucursal) y `src/services/saasService.ts` (lógica de administración SaaS). Estos servicios actúan como intermediarios entre las vistas y la base de datos.

---

## 2. ARQUITECTURA DEL SISTEMA

### Flujo de Datos Real
1. **Usuario**: Interactúa con la interfaz (ej. hace clic en "Finalizar Venta").
2. **Vista**: Captura el evento y llama a una función del **Servicio** correspondiente (ej. `dbCreateInvoice`).
3. **Controlador (Servicio)**: Valida los datos, prepara el payload y realiza la petición a **Supabase** (usando `supabase-js` o llamando a un `RPC` en la base de datos).
4. **Base de Datos**: Procesa la solicitud (PostgreSQL), aplica reglas de seguridad (RLS) y retorna el resultado.
5. **Vista**: Recibe la respuesta, actualiza el estado local y muestra feedback al usuario.

### Estructura de Carpetas y Responsabilidades
- `/src/components`: Componentes UI reutilizables (Botones, Selectores, Modales).
- `/src/views`: Vistas principales (Dashboard, POS, Inventario, SuperAdmin).
- `/src/services`: Servicios que encapsulan la comunicación con Supabase.
- `/src/utils`: Utilidades para cálculos matemáticos, formateo de fechas y números de orden.
- `/src/types.ts`: Definición centralizada de tipos para todo el proyecto.
- `/public`: Archivos estáticos y documentación descargable.

---

## 3. MÓDULOS DEL SISTEMA

El sistema está organizado en grupos de permisos que definen el acceso a los diferentes módulos funcionales:

### 3.1 Grupo PRINCIPAL (Operación Diaria)
- **Dashboard**: Panel con indicadores clave de rendimiento (KPIs), ventas del día, órdenes pendientes y estados de máquinas.
- **Agenda**: Calendario y lista de control para entregas y recojos programados.
- **Punto de Venta (POS)**: Interfaz para recepción de prendas, selección de servicios, aplicación de descuentos y procesamiento de pagos múltiples.
- **Mis Órdenes**: Listado y gestión de tickets generados, con filtros por estado y búsqueda por correlativo.
- **Operaciones**: Módulo para el control de procesos de Lavado y Secado, permitiendo asignar prendas a máquinas específicas.
- **Cierre de Caja**: Proceso de arqueo de turno para validar ingresos en efectivo y otros métodos frente al sistema.
- **Documentos Electrónicos**: Historial de comprobantes enviados a SUNAT (Boletas, Facturas, Notas de Crédito).
- **Mis Yapes**: Monitor específico para validar pagos realizados vía Yape mediante integración de IDs de transacción.

### 3.2 Grupo GESTIÓN (Administración de Sucursal)
- **Servicios/Productos**: Mantenimiento del catálogo de precios, definición de categorías y recetas de insumos por producto.
- **Clientes (CRM)**: Base de datos de clientes con historial de puntos, alertas personalizadas y geolocalización.
- **Empleados**: Gestión de personal, asignación de roles (Administrador, Caja, Operario, Delivery) y permisos granulares.
- **Gastos**: Registro de egresos de caja con categorización y adjunto de comprobantes/fotos de evidencia.

### 3.3 Grupo LOGÍSTICA (Planta y Almacén)
- **Máquinas**: Configuración de equipos, monitoreo de ciclos de vida y alertas de mantenimiento preventivo.
- **Call Center**: Gestión optimizada para pedidos telefónicos y atención al cliente remota.
- **Delivery**: Panel de despacho para repartidores con integración de rutas y estados de entrega.
- **Insumos**: Control de stock de detergentes, suavizantes y otros materiales con alertas de stock mínimo.
- **Compras**: Registro de ingreso de mercadería y actualización automática de costos promedio y último costo.
- **Inventario de Paquetes**: Control específico para el empaquetado y rotulado de ropa lista para entrega.
- **Conteo de Inventario**: Auditoría física de productos terminados, pallets y cajas con registro de fotos.

### 3.4 Grupo MARKETING (Fidelización)
- **Fidelización/Cupones**: Generación de códigos de descuento con fechas de expiración y condiciones de uso.
- **Puntos Bonus**: Sistema de canje de puntos acumulados por servicios gratuitos o descuentos especiales.
- **Promociones**: Configuración de ofertas temporales, banners promocionales y packs de servicios.
- **Campaña WA**: Herramienta de marketing masivo por WhatsApp para envío de promociones y avisos a la base de clientes.

### 3.5 Grupo CONFIGURACIÓN (Ajustes de Sistema)
- **Categorías**: Clasificación visual y organizativa de los servicios ofrecidos.
- **Métodos de Pago**: Configuración de pasarelas y medios de pago aceptados (Efectivo, Tarjetas, Billeteras).
- **Reportes**: Análisis avanzado de ventas, rentabilidad, productividad de operarios y comportamiento de clientes.
- **Ajustes**: Configuración de branding (colores, logos), parámetros de SUNAT, tokens de WhatsApp y series de facturación.

### 3.6 Módulo SuperAdmin (SaaS Master)
- **Descripción**: Panel de control global para el dueño del SaaS.
- **Funcionalidades**:
    - Creación y edición de Empresas Holding.
    - Gestión de Sucursales (Configuración de SUNAT, WhatsApp, Branding).
    - Catálogos globales (Categorías, Métodos de Pago, Máquinas, Colores).
    - Configuración de tokens y parámetros globales del sistema.
- **Control**: `getSaasCompanies`, `createSaasBranch`, `updateSaasGlobalConfig` en `saasService.ts`.
- **Modelos**: `SaasCompany`, `SaasBranch`, `SaasGlobalConfig`.
- **Tablas**: `empresas_holding`, `sucursales`, `saas_configuracion_global`, `global_cat_*`.

---

## 4. BASE DE DATOS

### Tablas Principales
- `empresas_holding`: Datos de las empresas clientes del SaaS.
- `sucursales`: Configuración específica de cada local (series, colores, tokens).
- `usuarios_login`: Perfiles de usuario y credenciales.
- `clientes`: CRM de clientes con puntos y ubicación.
- `productos`: Catálogo de servicios y productos.
- `ventas`: Cabecera de transacciones comerciales.
- `items_venta`: Detalle de prendas/productos por venta.
- `pagos_venta`: Registro de pagos realizados.
- `insumos`: Materia prima (detergentes, suavizantes).
- `maquinas`: Activos fijos para el proceso de lavado/secado.
- `recojos_delivery`: Agenda de logística externa.

### Relaciones Clave
- `sucursales` -> `empresas_holding` (N:1)
- `ventas` -> `clientes` (N:1)
- `items_venta` -> `ventas` (N:1)
- `productos` -> `categorias` (N:1)
- `productos_recetas` -> `productos` e `insumos` (N:N)

---

## 5. FLUJOS CRÍTICOS

### Registro de Venta Atómica (RPC)
El sistema utiliza un procedimiento almacenado en PostgreSQL (`procesar_venta_atomica`) para garantizar la integridad de los datos. En una sola transacción:
1. Se crea la cabecera de la venta.
2. Se insertan los items de detalle.
3. Se registran los pagos.
4. Se actualiza el stock de productos e insumos (si aplica).
5. Se generan los correlativos internos.

### Flujo de Estados de una Prenda
`PENDIENTE` -> `EN_LAVADO` -> `EN_SECADO` -> `EN_PLANCHADO` -> `LISTO` -> `ENTREGADO`.
Cada cambio de estado registra un evento en `items_historial`.

---

## 6. INTEGRACIONES Y SEGURIDAD

### Integraciones
- **SUNAT**: Preparado para envío de comprobantes electrónicos (vía API externa configurada en sucursal).
- **WhatsApp**: Envío de notificaciones de estado y campañas de marketing (vía instancia configurada).
- **Google Maps**: Visualización de ubicación de clientes para delivery.

### Seguridad
- **Autenticación**: Supabase Auth con JWT. Se utilizan correos virtuales (`usuario@sislav.com`) para desacoplar la identidad del usuario de su correo personal.
- **Modo Maestro (SaaS Master)**: Los administradores globales pueden autenticarse mediante un flujo especial (`dbMasterAuth`) que utiliza una función RPC (`check_master_login`) para validar credenciales sin depender de los flujos estándar de Auth de Supabase, permitiendo el acceso administrativo a cualquier sucursal mediante un "Bypass" controlado.
- **Autorización**: Row Level Security (RLS) en PostgreSQL para aislar datos entre sucursales y holdings. Cada consulta incluye filtros por `sucursal_id` o `empresa_holding_id`.
- **Protección de Datos**: Uso de funciones RPC con el modificador `SECURITY DEFINER` para operaciones sensibles (como la creación de empleados o procesamiento de ventas) que requieren elevar privilegios de forma segura y atómica.
- **Optimización de Carga**: Implementación de caché en `localStorage` para la configuración global y datos de sesión, reduciendo el tiempo de resolución inicial y eliminando bloqueos visuales ("Sincronizando") en recargas.
- **Login Eficiente**: El flujo de autenticación devuelve el perfil de sucursal completo en una sola transacción, eliminando peticiones redundantes al servidor durante el ingreso.
- **Validación**: Tipado estricto con TypeScript en todo el flujo de datos, desde la base de datos hasta los componentes de la interfaz.

---
*Documentación generada automáticamente basada en el estado actual del sistema (As-Built).*

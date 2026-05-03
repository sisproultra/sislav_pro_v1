# Documentación Funcional y Técnica - SISLAV (As-Built)

## 1. DESCRIPCIÓN GENERAL

### Nombre del Sistema
**SISLAV** (Sistema Integral de Lavandería)

### Propósito
SISLAV es una plataforma SaaS (Software as a Service) diseñada para la gestión integral de negocios de lavandería. Permite la administración de múltiples empresas (holdings) y sucursales, cubriendo desde la recepción de prendas hasta la entrega final, incluyendo control de inventario, caja, procesos en máquinas y fidelización de clientes.

### Tecnologías Utilizadas
- **Frontend**: React 18+, TypeScript, Tailwind CSS.
- **Iconografía**: Lucide React.
- **Animaciones**: Motion (motion/react).
- **Backend**: Supabase (BaaS) - Auth, Database (PostgreSQL), Storage, Edge Functions (RPC).
- **Estado Global**: React Hooks (useState, useEffect, useContext) y React Query.
- **PWA**: PWA Dinámica con manifest generado en tiempo real vía `/api/manifest`.

### Arquitectura (MVC)
El sistema implementa un patrón de arquitectura desacoplado:
- **Modelos (M)**: Definidos en `types.ts`.
- **Vistas (V)**: Componentes en `components/` y `views/`.
- **Controladores (C)**: Servicios en `services/dbService.ts` y `services/saasService.ts`.

---

## 2. ARQUITECTURA DEL SISTEMA

### Estructura de Carpetas
- `components/`: Componentes UI reutilizables. El componente `Layout.tsx` controla el sidebar dinámico que oculta categorías vacías según permisos y búsqueda.
- `views/`: Pantallas principales de la aplicación.
- `services/`: Lógica de comunicación con Supabase y APIs externas.
- `api/`: Funciones de servidor para el API de Manifest y otras utilidades de backend.
- `types.ts`: Tipado estricto para toda la aplicación.

---

## 3. MÓDULOS DEL SISTEMA

### 3.1 Grupo PRINCIPAL (Operación Diaria)
- **Dashboard**: KPIs en tiempo real y estados de máquinas.
- **Agenda**: Gestión de recojos y entregas programadas.
- **Punto de Venta (POS)**: Recepción de prendas y procesamiento de cobros.
- **Mis Órdenes**: Seguimiento detallado de tickets de servicio.
- **Operaciones**: Gestión de procesos de Lavado, Secado y Planchado.
- **Cierre de Caja**: Arqueos de caja por turno.
- **Mis Yapes**: Validación rápida de pagos digitales.

### 3.2 Grupo GESTIÓN
- **Servicios/Productos**: Catálogo de precios y servicios.
- **Clientes (CRM)**: Historial de clientes y fidelización.
- **Empleados**: Control de roles y permisos granulares.
- **Egresos**: Registro de gastos operativos.

### 3.3 Grupo LOGÍSTICA
- **Logística Hub**: Gestión centralizada de transportes y guías.
- **Delivery**: Control de despachos en ruta para repartidores.
- **Insumos**: Control de stock de materiales de lavado.
- **Máquinas**: Monitoreo y mantenimiento de equipos.

### 3.4 SaaS Master (SuperAdmin)
- Control total de empresas (`empresas_holding`) y sedes (`sucursales`).
- Configuración global de módulos, activos y parámetros de SUNAT/WhatsApp.

---

## 4. BASE DE DATOS Y SEGURIDAD

### Seguridad (RLS)
El sistema utiliza **Row Level Security (RLS)** de PostgreSQL. Cada tabla está protegida para que un usuario solo pueda leer/escribir datos de su propia `sucursal_id` o `empresa_holding_id`.

### Modo Maestro
Permite el acceso administrativo global mediante un flujo de autenticación especial que valida credenciales SaaS Master para supervisar cualquier sede del sistema sin comprometer los datos de otras empresas.

---

## 5. CONTEXTO PARA INTELIGENCIA ARTIFICIAL (IA)

Si estás trabajando en este proyecto como una IA, ten en cuenta lo siguiente:

1.  **Fuente de Verdad**: `types.ts` contiene todas las interfaces. Consúltalo siempre antes de modificar un servicio o componente.
2.  **Lógica de Negocio**: No modifiques `dbService.ts` a menos que sea necesario cambiar la comunicación con el servidor. La mayoría de los cambios visuales o de comportamiento de UI ocurren en `views/` o `components/Layout.tsx`.
3.  **Sidebar Dinámico**: La visibilidad de las opciones depende de `getModuleConfig` y `isSectionVisible` en `components/Layout.tsx`. No fuerces visibilidad de ítems sin verificar los permisos en `SYSTEM_MODULES`.
4.  **PWA y Branding**: Las sucursales personalizan su logo y colores. El sistema inyecta estas variables CSS en el `index.html` y el `manifest` dinámico utiliza estas mismas rutas.

---
*Documentación As-Built actualizada - Mayo 2026*

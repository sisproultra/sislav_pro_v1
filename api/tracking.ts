import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// URL Cleansing matching server & client
const cleanUrl = (urlStr: string) => {
  if (!urlStr) return '';
  try {
    let trimmed = urlStr.trim();
    if (!trimmed.toLowerCase().startsWith('http')) {
      trimmed = `https://${trimmed}`;
    }
    const parsed = new URL(trimmed);
    let cleanPath = parsed.pathname.replace(/\/rest\/v1\/?$/, '');
    if (cleanPath === '/') cleanPath = '';
    return `${parsed.origin}${cleanPath}`;
  } catch (e) {
    return urlStr.trim().replace(/\/$/, '').split('/rest/v1')[0];
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = (req.query.id || req.body?.id) as string;

  if (!id) {
    return res.status(400).json({ error: 'ID o Código de tracking es requerido' });
  }

  try {
    console.log(`🔍 [Vercel API Tracking] Buscando ID/Código: ${id}`);

    // Configuración de Supabase Admin
    const rawUrl = (process.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co').replace(/['"]/g, '').trim();
    const rawKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY || 
      process.env.SUPABASE_SERVICE_KEY || 
      process.env.SUPABASE_SECRET_KEY || 
      process.env.SERVICE_ROLE_KEY || 
      process.env.SUPABASE_ADMIN_KEY || 
      'N/A'
    ).replace(/['"]/g, '').trim();

    const supabaseUrl = cleanUrl(rawUrl);
    const supabaseServiceKey = rawKey;

    if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'N/A') {
      return res.status(500).json({ 
        error: 'Las credenciales de administración (SUPABASE_SERVICE_ROLE_KEY) no están configuradas en el servidor.' 
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const normalizeRelation = (rel: any) => {
      if (!rel) return null;
      if (Array.isArray(rel)) {
        return rel.length > 0 ? rel[0] : null;
      }
      return rel;
    };

    // 1. Intentar obtener el recojo primero
    const { data: pickup } = await supabaseAdmin.from('recojos_delivery').select('*').eq('id', id).maybeSingle();
    
    if (pickup) {
      console.log("✅ Recojo encontrado via Vercel:", pickup.id);
      const { data: company } = await supabaseAdmin.from('sucursales').select('*').eq('id', pickup.sucursal_id).maybeSingle();
      const { data: client } = await supabaseAdmin.from('clientes').select('id, nombres, puntos, sucursal_id, telefono, cod_pais, direccion, google_maps_url, tipo_documento, dni, latitud, longitud').eq('id', pickup.cliente_id).maybeSingle();
      const { data: invoice } = await supabaseAdmin.from('ventas').select('*, items_venta(*)').eq('pickup_id', id).maybeSingle();
      
      let pagos: any[] = [];
      if (invoice) {
        const { data: pData } = await supabaseAdmin.from('pagos_venta').select('monto, metodo_pago_id, fecha_pago').eq('venta_id', invoice.id);
        pagos = pData || [];
      }

      const mappedCompany = company ? {
        id: company.id,
        sucursal_id: company.id,
        empresa_id: company.empresa_id || company.empresa_holding_id,
        empresa_holding_id: company.empresa_id || company.empresa_holding_id,
        slug: company.slug,
        razonSocial: company.nombre_sucursal ?? company.name ?? 'SISLAV SUCURSAL',
        nombre_sucursal: company.nombre_sucursal ?? company.name ?? 'SISLAV SUCURSAL',
        primaryColor: company.color_primario ?? company.primaryColor ?? '#0054A6',
        secondaryColor: company.color_secundario ?? company.secondaryColor ?? '#10B981',
        color_primario: company.color_primario ?? company.primaryColor ?? '#0054A6',
        color_secundario: company.color_secundario ?? company.secondaryColor ?? '#10B981',
        logoUrl: company.url_logo ?? company.logoUrl,
        url_logo: company.url_logo ?? company.logoUrl,
        address: company.direccion || '',
        direccion: company.direccion || '',
        ruc: company.ruc || '00000000000',
        contactPhone: company.telefono || '',
        ticketPolicies: company.politicas_ticket || '',
        moneda_simbolo: company.moneda_simbolo || 'S/'
      } : null;

      return res.status(200).json({ 
        pickup: { ...pickup, clientes: normalizeRelation(client) }, 
        invoice: invoice ? { ...invoice, clientes: normalizeRelation(client), pagos_venta: pagos } : null, 
        company: mappedCompany
      });
    }

    // 2. Si no es recojo, intentar con venta directa
    let { data: v } = await supabaseAdmin.from('ventas').select('*, items_venta(*), clientes(*)').eq('id', id).maybeSingle();

    // 2.1 Fallback: Buscar por codigo_orden o serie-correlativo
    if (!v) {
      const { data: vByCode } = await supabaseAdmin.from('ventas').select('*, items_venta(*), clientes(*)').eq('codigo_orden', id).maybeSingle();
      v = vByCode;

      if (!v && id.includes('-')) {
        const parts = id.split('-');
        if (parts.length === 2) {
          const serieSearch = parts[0].toUpperCase();
          const correlativoSearch = parseInt(parts[1], 10);
          if (!isNaN(correlativoSearch)) {
            const { data: vByDoc } = await supabaseAdmin.from('ventas')
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
      console.log("✅ Venta encontrada via Vercel:", v.id);
      const { data: companyRaw } = await supabaseAdmin.from('sucursales').select('*').eq('id', v.sucursal_id).maybeSingle();
      const clientRaw = normalizeRelation(v.clientes);
      
      const { data: pagosVenta } = await supabaseAdmin.from('pagos_venta').select('*, metodos_pago(nombre)').eq('venta_id', v.id);
      const totalPagado = (pagosVenta || []).reduce((sum: number, p: any) => sum + (Number(p.monto) || 0), 0);

      const mappedCompany = companyRaw ? {
        id: companyRaw.id,
        sucursal_id: companyRaw.id,
        empresa_id: companyRaw.empresa_id || companyRaw.empresa_holding_id,
        empresa_holding_id: companyRaw.empresa_id || companyRaw.empresa_holding_id,
        slug: companyRaw.slug,
        razonSocial: companyRaw.nombre_sucursal ?? companyRaw.name ?? 'SISLAV SUCURSAL',
        nombre_sucursal: companyRaw.nombre_sucursal ?? companyRaw.name ?? 'SISLAV SUCURSAL',
        primaryColor: companyRaw.color_primario ?? companyRaw.primaryColor ?? '#0054A6',
        secondaryColor: companyRaw.color_secundario ?? companyRaw.secondaryColor ?? '#10B981',
        color_primario: companyRaw.color_primario ?? companyRaw.primaryColor ?? '#0054A6',
        color_secundario: companyRaw.color_secundario ?? companyRaw.secondaryColor ?? '#10B981',
        logoUrl: companyRaw.url_logo ?? companyRaw.logoUrl,
        url_logo: companyRaw.url_logo ?? companyRaw.logoUrl,
        address: companyRaw.direccion || '',
        direccion: companyRaw.direccion || '',
        ruc: companyRaw.ruc || '00000000000',
        contactPhone: companyRaw.telefono || '',
        ticketPolicies: companyRaw.politicas_ticket || '',
        moneda_simbolo: companyRaw.moneda_simbolo || 'S/'
      } : null;

      const mappedInvoice = {
        id: v.id,
        sucursal_id: v.sucursal_id,
        cliente_id: v.cliente_id,
        descuento: Number(v.descuento || 0),
        discount: Number(v.descuento || 0),
        client: clientRaw ? {
          id: clientRaw.id,
          docType: clientRaw.tipo_documento_codigo || 'DNI',
          docNumber: clientRaw.dni,
          name: clientRaw.nombres,
          phone: clientRaw.telefono,
          address: clientRaw.direccion,
          points: clientRaw.puntos || 0,
          sucursal_id: clientRaw.sucursal_id
        } : { id: '', docType: '0', docNumber: '0', name: 'PUBLICO GENERAL', address: '', points: 0, sucursal_id: v.sucursal_id },
        ordenNumber: v.codigo_orden,
        serie: v.serie,
        correlativo: v.correlativo,
        type: v.tipo_documento_codigo,
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
          status: it.estado,
          estado_id: it.estado_id,
          color: it.color,
          defectos: it.defectos,
          details: it.observaciones,
          item_id_raw: it.id,
          audioNote: it.url_audio
        })),
        payments: (pagosVenta || []).map((p: any) => ({
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
        orderStatus: (v.estado) || 'PENDIENTE',
        sunatStatus: v.sunat_status || (v.tipo_documento_codigo === '80' ? 'INTERNAL' : 'PENDING'),
        prePaymentAmount: totalPagado,
        qrCodeData: v.qr_code_data || `${mappedCompany?.ruc || '00000000000'}|${v.tipo_documento_codigo}|${v.serie}|${v.correlativo}|${Number(v.total_igv || 0).toFixed(2)}|${Number(v.total || 0).toFixed(2)}|${(v.fecha_recepcion || v.created_at || '').split('T')[0]}|${clientRaw?.tipo_documento === 'DNI' ? '1' : clientRaw?.tipo_documento === 'RUC' ? '6' : '0'}|${clientRaw?.dni || '00000000'}|`,
        sunatResponse: {
          success: v.sunat_status === 'ACCEPTED',
          description: v.sunat_description,
          hash: v.sunat_hash,
          pdfUrl: v.sunat_pdf_url,
          xmlUrl: v.sunat_xml_url,
          cdrUrl: v.sunat_cdr_url
        }
      };

      return res.status(200).json({ 
        invoice: mappedInvoice, 
        company: mappedCompany
      });
    }

    console.warn(`⚠️ [Vercel API Tracking] No se encontró coincidencia para: ${id}`);
    return res.status(404).json({ error: 'Pedido no encontrado' });

  } catch (error: any) {
    console.error('❌ Error en Vercel tracking API:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

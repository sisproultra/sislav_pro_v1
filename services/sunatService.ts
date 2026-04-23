
import { Invoice, Company, SunatResponse, InvoiceType, IgvType } from '../types';
import { getPeruDateTime } from '../utils/calculations';

/**
 * Servicio de integración con el API de Facturación Electrónica Peruana.
 */
export const sendBillToSunat = async (invoice: Invoice, company: Company): Promise<SunatResponse> => {
  
  // Usamos la URL de la base de datos si existe, de lo contrario el proxy (que es el default antiguo)
  const dbUrl = company.sunat_url?.trim();
  const finalUrl = dbUrl && dbUrl.startsWith('http') ? dbUrl : '/api-proxy/sunat';
  
  // Base URL para archivos PDF/XML/CDR
  const apiBaseUrl = dbUrl ? dbUrl.split('/post.php')[0] : 'https://apisu.sysventa.com/API_SUNAT';

  const peruTime = getPeruDateTime();
  const dateToUse = invoice.fecha_emision || invoice.date;
  const fechaEmision = dateToUse ? dateToUse.split('T')[0] : peruTime.date;
  const horaEmision = dateToUse ? new Date(dateToUse).toLocaleTimeString('en-GB') : peruTime.time;

  let codigoTipoEntidad = '0'; 
  const docTypeClean = String(invoice.client.docType).toUpperCase();
  if (docTypeClean.includes('DNI')) codigoTipoEntidad = '1';
  else if (docTypeClean.includes('RUC')) codigoTipoEntidad = '6';
  else if (docTypeClean.includes('CEX') || docTypeClean.includes('EXTRANJER')) codigoTipoEntidad = '4';
  else if (docTypeClean === '-' || docTypeClean === 'VARIOS') codigoTipoEntidad = '0';

  const igvRate = company.porcentajeIgv || 18.00;
  const igvFactor = 1 + (igvRate / 100);

  const cleanDoc = (doc: string) => doc.replace(/[^0-9]/g, '').trim();
  const cleanText = (text: string) => (text || "").toUpperCase().replace(/[<>&"']/g, '').trim();

  const itemsPayload = invoice.items.map((item, idx) => {
    const itemIgvType = item.igvType || '10';
    let precioBase = Number(item.price) || 0;
    if (itemIgvType === '10') {
        precioBase = Number((precioBase / igvFactor).toFixed(2));
    }
    const cleanProductName = cleanText(item.name || "PRODUCTO");

    return {
        "producto": cleanProductName,
        "cantidad": (Number(item.quantity) || 0).toString(),
        "precio_base": precioBase.toFixed(2), 
        "codigo_producto": item.id ? item.id.substring(0, 15) : `p-${idx}`,
        "codigo_unidad": item.unitCode || 'NIU', 
        "tipo_igv_codigo": itemIgvType
    };
  });

  const isTestMode = company.sunatEnvironment === 'TEST' || 
                     (company.sunatEnvironment === 'BETA' && (company.solUser === 'MODDATOS' || !company.solUser));

  if (company.sunatEnvironment === 'PRODUCTION' && (company.solUser === 'MODDATOS' || !company.solUser)) {
     return {
         success: false,
         description: "⚠️ ERROR DE SEGURIDAD: Está en modo PRODUCCIÓN pero no ha configurado sus credenciales SOL reales (MODDATOS detectado). Configure el Usuario SOL en ajustes."
     };
  }

  const safeNumber = (val: any) => {
    const n = Number(val);
    if (isNaN(n) || n === 0) return "";
    // Si es entero, enviarlo sin decimales para mayor compatibilidad
    return Number.isInteger(n) ? n.toString() : n.toFixed(2);
  };

  const payload: any = {
    "empresa": {
        // Si es modo prueba con MODDATOS, forzamos el RUC de prueba que la API acepta
        "ruc": isTestMode ? "20604051984" : cleanDoc(company.ruc),
        "razon_social": cleanText(company.razonSocial || "EMPRESA DE PRUEBA"),
        "nombre_comercial": cleanText(company.nombre_comercial || company.razonSocial || "EMPRESA DE PRUEBA"), 
        "domicilio_fiscal": cleanText(company.address || "CALLE PRUEBA 123"),
        "ubigeo": company.ubigeo || "150101",
        "urbanizacion": cleanText(company.urbanizacion || "-"),
        "distrito": cleanText(company.distrito || "LIMA"),
        "provincia": cleanText(company.provincia || "LIMA"),
        "departamento": cleanText(company.departamento || "LIMA"),
        "modo": company.sunatEnvironment === 'PRODUCTION' ? "1" : "0", 
        "usu_secundario_produccion_user": (company.solUser || "MODDATOS").trim(), 
        "usu_secundario_produccion_password": (company.solPass || "MODDATOS").trim()
    },
    "cliente": {
        "razon_social_nombres": cleanText(invoice.client.name || "CLIENTE VARIOS"),
        "numero_documento": (codigoTipoEntidad === '0') ? '00000000' : cleanDoc(invoice.client.docNumber),
        "codigo_tipo_entidad": codigoTipoEntidad,
        "cliente_direccion": (invoice.client.address && invoice.client.address !== '-') ? cleanText(invoice.client.address) : "-"
    },
    "venta": {
        "serie": invoice.serie.toUpperCase().trim(),
        "numero": invoice.correlativo.toString(),
        "fecha_emision": fechaEmision,
        "hora_emision": horaEmision,
        "fecha_vencimiento": "",
        "moneda_id": company.moneda_simbolo?.includes('$') ? "2" : "1", 
        "forma_pago_id": "1", 
        "total_gravada": safeNumber(invoice.totals.gravada),
        "total_igv": safeNumber(invoice.totals.igv),
        "total_exonerada": safeNumber(invoice.totals.exonerada),
        "total_inafecta": safeNumber(invoice.totals.inafecta),
        "tipo_documento_codigo": invoice.type,
        "nota": cleanText(invoice.notes || "VENTA REALIZADA DESDE SISTEMA POS"),
        // Campos para Nota de Crédito (Tipo 07)
        ...(invoice.type === '07' && invoice.relatedDocument ? {
            "tipo_documento_referencia": invoice.relatedDocument.type,
            "serie_referencia": invoice.relatedDocument.serie,
            "numero_referencia": String(invoice.relatedDocument.correlativo),
            "motivo_codigo": "01", // 01: Anulación de la operación
            "motivo_descripcion": "ANULACION DE LA OPERACION"
        } : {})
    },
    "items": invoice.items.map((item, idx) => {
        const itemIgvType = item.igvType || '10';
        let precioBase = Number(item.price) || 0;
        if (itemIgvType === '10') {
            precioBase = Number((precioBase / igvFactor).toFixed(2));
        }
        return {
            "producto": cleanText(item.name || "PRODUCTO"),
            "cantidad": (Number(item.quantity) || 0).toString(),
            "precio_base": safeNumber(precioBase), 
            "codigo_sunat": "-",
            "codigo_producto": item.id ? item.id.substring(0, 15) : `p-${idx}`,
            "codigo_unidad": item.unitCode || 'NIU', 
            "tipo_igv_codigo": itemIgvType
        };
    })
  };

  try {
      console.log("Enviando payload a SUNAT:", JSON.stringify(payload, null, 2));
      const response = await fetch(finalUrl, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
          const errorText = await response.text();
          return { 
              success: false, 
              description: `Error del servidor API (${response.status}): ${errorText.substring(0, 100)}` 
          };
      }

      const responseText = await response.text();
      console.log("Respuesta bruta de SUNAT API:", responseText);

      if (!responseText || responseText.trim() === "") {
          return { success: false, description: "Error: La API de SUNAT devolvió una respuesta vacía." };
      }

      let body;
      try {
          body = JSON.parse(responseText);
      } catch (parseError) {
          return { 
              success: false, 
              description: `Error de formato en respuesta: La API no devolvió JSON válido. Respuesta: ${responseText.substring(0, 100)}...` 
          };
      }
      
      const data = body.data; 

      if (body.success === true || (data && (String(data.respuesta_sunat_codigo) === "0" || data.respuesta_sunat_codigo === 0))) {
          return {
              success: true,
              description: data?.respuesta_sunat_descripcion || "Comprobante Aceptado por SUNAT",
              hash: data?.hash || "---",
              pdfUrl: data?.ruta_pdf || data?.url_pdf || `${apiBaseUrl}/files/facturacion_electronica/PDF/${company.ruc}-${invoice.serie}-${invoice.correlativo}.pdf`,
              xmlUrl: data?.ruta_xml || `${apiBaseUrl}/files/facturacion_electronica/XML/${company.ruc}-${invoice.serie}-${invoice.correlativo}.xml`,
              cdrUrl: data?.ruta_cdr || `${apiBaseUrl}/files/facturacion_electronica/CDR/R-${company.ruc}-${invoice.serie}-${invoice.correlativo}.zip`
          };
      } else {
          return {
              success: false,
              description: data?.respuesta_sunat_descripcion || body?.mensaje || body?.error || 'Rechazo en validación SUNAT'
          };
      }
  } catch (e: any) {
      return { success: false, description: "Error de comunicación: " + e.message };
  }
};

/**
 * Envío masivo de boletas por Resumen Diario
 */
export const sendSummaryToSunat = async (invoices: Invoice[], company: Company) => {
  const { solUser, solPass, sunatEnvironment, ruc, razonSocial } = company;
  
  if (sunatEnvironment === 'PRODUCTION' && (solUser === 'MODDATOS' || !solUser)) {
     return {
         success: false,
         description: "⚠️ ERROR DE SEGURIDAD: Está en modo PRODUCCIÓN pero no ha configurado sus credenciales SOL reales."
     };
  }

  const today = new Date().toISOString().split('T')[0];
  const dateFormatted = today.replace(/-/g, '');

  const payload = {
    "empresa": {
      "ruc": ruc || "20000000000",
      "razon_social": razonSocial || "MI EMPRESA",
      "modo": sunatEnvironment === 'PRODUCTION' ? 1 : 0,
      "usu_secundario_user": (solUser && solUser !== 'MODDATOS') ? solUser : "MODDATOS",
      "usu_secundario_password": (solPass && solPass !== 'moddatos') ? solPass : "moddatos"
    },
    "resumen": {
      "numero": dateFormatted,
      "correlativo": "1",
      "fecha_documentos": today,
      "fecha_resumen": today
    },
    "comprobantes": invoices.map(inv => ({
      "tipo_documento": inv.type, 
      "serie": inv.serie,
      "numero": String(inv.correlativo),
      "cliente_tipo_documento": inv.client.docType === 'DNI' ? '1' : (inv.client.docType === 'RUC' ? '6' : '0'),
      "cliente_numero_documento": inv.client.docNumber,
      "status": "1",
      "total_a_pagar": Number(inv.totals.total.toFixed(2)),
      "total_igv": Number(inv.totals.igv.toFixed(2)),
      "total_gravada": Number(inv.totals.gravada.toFixed(2))
    }))
  };

  const dbUrl = company.sunat_url?.trim();
  const summaryBaseUrl = dbUrl ? dbUrl.split('/post.php')[0] : 'https://apisu.sysventa.com/API_SUNAT';
  const finalUrl = dbUrl ? `${summaryBaseUrl}/api/resumen` : '/api-proxy/sunat/api/resumen';

  try {
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const res = await response.json();
    return {
      success: res.success || false,
      description: res.message || res.description || (res.success ? "Resumen enviado con éxito" : "Error al procesar resumen"),
      ticket: res.ticket || null,
      pdfUrl: res.links?.pdf,
      xmlUrl: res.links?.xml,
      cdrUrl: res.links?.cdr
    };
  } catch (e) {
    console.error("Error en envío de resumen:", e);
    return { success: false, description: "Error de conexión con el proveedor de SUNAT" };
  }
};

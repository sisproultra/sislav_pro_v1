
import { Invoice, Company, SunatResponse, InvoiceType, IgvType } from '../types';
import { getPeruDateTime } from '../utils/calculations';

/**
 * Servicio de integración con el API de Facturación Electrónica Peruana.
 */
export const sendBillToSunat = async (invoice: Invoice, company: Company): Promise<SunatResponse> => {
  
  // Usamos la URL configurada en la sucursal
  const dbUrl = company.sunat_url?.trim();
  
  // LOGICA DE PROXY: 
  // Si la URL apunta a 'apisu.sysventa.com', usamos el proxy interno '/api-proxy/sunat'
  // para evitar problemas de CORS.
  let finalUrl = '/api-proxy/sunat';
  let isProxy = true;
  
  if (dbUrl && dbUrl.startsWith('http')) {
      if (dbUrl.includes('apisu.sysventa.com')) {
          finalUrl = '/api-proxy/sunat';
          isProxy = true;
      } else {
          finalUrl = dbUrl;
          isProxy = false;
      }
  }

  console.log(`🚀 Preparando envío a SUNAT. URL Final: ${finalUrl} (Proxy: ${isProxy})`);
  
  // Base URL para generar los links de descarga (PDF/XML/CDR)
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

  const isTestMode = company.sunatEnvironment === 'BETA' || company.sunatEnvironment === 'INTERNAL';

  if (company.sunatEnvironment === 'PRODUCTION' && (company.solUser === 'MODDATOS' || !company.solUser)) {
     return {
         success: false,
         description: "⚠️ ERROR DE SEGURIDAD: Está en modo PRODUCCIÓN pero no ha configurado sus credenciales SOL reales (MODDATOS detectado). Configure el Usuario SOL en ajustes."
     };
  }

  const safeNumber = (val: any) => {
    const n = Number(val);
    if (isNaN(n)) return "0.00";
    return n.toFixed(2);
  };

  const payload: any = {
    "empresa": {
        // RUC de prueba estándar si está en modo BETA
        "ruc": isTestMode ? "20604051984" : cleanDoc(company.ruc),
        "razon_social": cleanText(company.razonSocial || "EMPRESA DE PRUEBA"),
        "nombre_comercial": cleanText(company.nombre_comercial || company.razonSocial || "EMPRESA DE PRUEBA"), 
        "domicilio_fiscal": cleanText(company.address || "CALLE PRUEBA 123"),
        "ubigeo": company.ubigeo || "150101",
        "urbanizacion": cleanText(company.urbanizacion && company.urbanizacion !== '-' ? company.urbanizacion : ""),
        "distrito": cleanText(company.distrito || "LIMA"),
        "provincia": cleanText(company.provincia || "LIMA"),
        "departamento": cleanText(company.departamento || "LIMA"),
        "modo": company.sunatEnvironment === 'PRODUCTION' ? "1" : "0", 
        // Enviamos ambos formatos de credenciales para máxima compatibilidad con diferentes versiones del backend
        "usu_secundario_user": (company.solUser || "MODDATOS").trim(), 
        "usu_secundario_password": (company.solPass || "MODDATOS").trim(),
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
        "fecha_vencimiento": fechaEmision, // Usamos la misma fecha si no hay vencimiento
        "moneda_id": company.moneda_simbolo?.includes('$') ? "2" : "1", 
        "forma_pago_id": "1", 
        "total_gravada": safeNumber(invoice.totals.gravada),
        "total_igv": safeNumber(invoice.totals.igv),
        "total_exonerada": safeNumber(invoice.totals.exonerada),
        "total_inafecta": safeNumber(invoice.totals.inafecta),
        "total_gratuitas": "0.00",
        "total_otros_cargos": "0.00",
        "total_descuento": "0.00",
        "total_exportacion": "0.00",
        "total_venta": safeNumber(invoice.totals.total),
        "tipo_documento_codigo": invoice.type,
        "nota": cleanText(invoice.notes || "VENTA REALIZADA DESDE SISTEMA POS"),
        // Campos para Nota de Crédito (Tipo 07)
        ...(invoice.type === '07' && invoice.relatedDocument ? {
            "tipo_documento_referencia": invoice.relatedDocument.type,
            "serie_referencia": invoice.relatedDocument.serie,
            "numero_referencia": String(invoice.relatedDocument.correlativo),
            "motivo_codigo": "01", 
            "motivo_descripcion": "ANULACION DE LA OPERACION"
        } : {})
    },
    "items": invoice.items.map((item, idx) => {
        const itemIgvType = item.igvType || '10';
        let valorUnitario = Number(item.price) || 0;
        if (itemIgvType === '10') {
            valorUnitario = Number((valorUnitario / igvFactor).toFixed(6)); // Más precisión
        }
        
        const cantidad = Number(item.quantity) || 0;
        const total = Number((Number(item.price) * cantidad).toFixed(2));
        const subtotal = Number((valorUnitario * cantidad).toFixed(2));
        const igv = Number((total - subtotal).toFixed(2));

        return {
            "producto": cleanText(item.name || "PRODUCTO"),
            "cantidad": cantidad.toString(),
            "valor_unitario": valorUnitario.toFixed(2),
            "precio_unitario": safeNumber(item.price),
            "precio_base": valorUnitario.toFixed(2), // Compatibilidad
            "codigo_sunat": "",
            "codigo_producto": item.id ? item.id.substring(0, 15) : `p-${idx}`,
            "codigo_unidad": item.unitCode || 'NIU', 
            "tipo_igv_codigo": itemIgvType,
            "igv": igv.toFixed(2),
            "subtotal": subtotal.toFixed(2),
            "total": total.toFixed(2)
        };
    })
  };

  try {
      console.log("Enviando payload a SUNAT:", JSON.stringify(payload, null, 2));

      let response;
      try {
          response = await fetch(finalUrl, { 
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
      } catch (fetchError: any) {
          console.error("Error en fetch inicial:", fetchError);
          // Si el proxy falló por "Failed to fetch" (común en entornos con Service Workers o bloqueos de red),
          // y tenemos una URL de DB válida, intentamos el envío directo al servidor de SUNAT.
          if (isProxy && dbUrl && dbUrl.startsWith('http')) {
              console.warn("Reintentando conexión directa a:", dbUrl);
              response = await fetch(dbUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
              });
          } else {
              throw fetchError;
          }
      }
      
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

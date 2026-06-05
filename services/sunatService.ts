
import { Invoice, Company, SunatResponse, InvoiceType, IgvType } from '../types';
import { getPeruDateTime } from '../utils/calculations';

/**
 * Convierte un número decimal a representación textual en castellano para facturación.
 */
const numeroALetras = (num: number) => {
    const aLetras = (n: number): string => {
        const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
        const decenas = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
        const decenas2 = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
        const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

        if (n === 0) return "CERO";
        if (n === 100) return "CIEN";
        
        let output = "";
        if (n >= 100) { output += centenas[Math.floor(n / 100)] + " "; n %= 100; }
        if (n >= 20) { 
            output += decenas2[Math.floor(n / 10)]; 
            if (n % 10 > 0) output += " Y " + unidades[n % 10];
        } else if (n >= 10) {
            output += decenas[n - 10];
        } else if (n > 0) {
            output += unidades[n];
        }
        return output.trim();
    };

    const entero = Math.floor(num);
    const decimales = Math.round((num - entero) * 100);
    const letrasEntero = entero === 0 ? "CERO" : aLetras(entero);
    const centimos = String(decimales).padStart(2, '0');

    return `${letrasEntero} CON ${centimos}/100 SOLES`;
};

/**
 * Servicio de integración alterno e independiente con la API de Visioner7 para Boletas, Facturas y Notas de Crédito.
 */
export const sendBillToVisioner7 = async (invoice: Invoice, company: Company): Promise<SunatResponse> => {
  const dbUrl = company.sunat_url?.trim() || 'https://service1.visioner7-api.com/api/v1/sunat/generar-cpe';
  
  // Usamos el proxy seguro de Vercel/Node para pasar los headers correctos
  const finalUrl = `/api/sunat-proxy?url=${encodeURIComponent(dbUrl)}`;

  console.log(`🚀 [Visioner7] Preparando envío a Visioner7 API. URL: ${finalUrl}`);
  
  const peruTime = getPeruDateTime();
  const dateToUse = invoice.fecha_emision || invoice.date;
  const fechaEmision = dateToUse ? dateToUse.split('T')[0] : peruTime.date;
  
  let horaEmision = peruTime.time;
  if (dateToUse && dateToUse.includes('T')) {
      const parts = dateToUse.split('T');
      if (parts[1]) {
          horaEmision = parts[1].split('.')[0].split('-')[0].split('+')[0];
      }
  }

  const cleanDoc = (doc: string) => (doc || "").replace(/[^0-9]/g, '').trim();
  const cleanText = (text: string) => (text || "").toUpperCase().replace(/[<>&"']/g, '').trim();

  let codigoTipoEntidad = '0'; 
  const docTypeClean = String(invoice.client.docType || '-').toUpperCase();
  const rawDocNumber = cleanDoc(invoice.client.docNumber || '');

  if (docTypeClean.includes('DNI') && rawDocNumber.length > 0 && rawDocNumber !== '99999999') {
      codigoTipoEntidad = '1';
  } else if (docTypeClean.includes('RUC')) {
      codigoTipoEntidad = '6';
  } else if (docTypeClean.includes('CEX') || docTypeClean.includes('EXTRANJER')) {
      codigoTipoEntidad = '4';
  } else {
      codigoTipoEntidad = '0';
  }

  const igvRate = company.porcentajeIgv || 18.00;
  const igvFactor = 1 + (igvRate / 100);
  const isTestMode = company.sunatEnvironment === 'BETA' || company.sunatEnvironment === 'INTERNAL';

  const safeNumber = (val: any) => {
    const n = Number(val);
    if (isNaN(n)) return "0.00";
    return n.toFixed(2);
  };

  // Mapear Tipo Comprobante
  let tipoComprobante = '03'; // Default Boleta (03)
  if ((invoice.type as any) === InvoiceType.FACTURA || (invoice.type as any) === '01') {
      tipoComprobante = '01';
  } else if ((invoice.type as any) === InvoiceType.NOTA_CREDITO || (invoice.type as any) === '07') {
      tipoComprobante = '07';
  }

  // Mapear datos para Nota de Crédito si aplica
  let txtTIPO_COMPROBANTE_MODIFICA = "";
  let txtNRO_DOCUMENTO_MODIFICA = "";
  let txtCOD_TIPO_MOTIVO = "";
  let txtDESCRIPCION_MOTIVO = "";

  if (tipoComprobante === '07' && invoice.relatedDocument) {
      txtTIPO_COMPROBANTE_MODIFICA = invoice.relatedDocument.type === 'FACTURA' || invoice.relatedDocument.type === '01' ? '01' : '03';
      txtNRO_DOCUMENTO_MODIFICA = `${invoice.relatedDocument.serie}-${String(invoice.relatedDocument.correlativo).padStart(8, '0')}`;
      txtCOD_TIPO_MOTIVO = "01"; // Anulación de la operación por defecto
      txtDESCRIPCION_MOTIVO = cleanText(invoice.notes || "ANULACION DE LA OPERACION");
  }

  const payload: any = {
    "txtTIPO_OPERACION": "0101",
    "txtTOTAL_GRAVADAS": safeNumber(invoice.totals.gravada),
    "txtTOTAL_INAFECTA": safeNumber(invoice.totals.inafecta),
    "txtTOTAL_EXONERADAS": safeNumber(invoice.totals.exonerada),
    "txtTOTAL_GRATUITAS": "0.00",
    "txtSUB_TOTAL": safeNumber(Number(invoice.totals.gravada) + Number(invoice.totals.exonerada) + Number(invoice.totals.inafecta)),
    "txtTOTAL_DESCUENTO": safeNumber(invoice.descuento || 0),
    "txtPOR_IGV": safeNumber(igvRate),
    "txtTOTAL_IGV": safeNumber(invoice.totals.igv),
    "txtTOTAL": safeNumber(invoice.totals.total),
    "txtSUB_TOTAL_PERCEPCIONES": "0.00",
    "txtPOR_PERCEPCIONES": "0.00",
    "txtBI_PERCEPCIONES": "0.00",
    "txtTOTAL_PERCEPCIONES": "0.00",
    "txtPOR_RETENCIONES": "0.00",
    "txtBI_RETENCIONES": "0.00",
    "txtTOTAL_RETENCIONES": "0.00",
    "txtTOTAL_BONIFICACIONES": "0.00",
    "txtTOTAL_EXPORTACION": "0.00",
    "txtCOD_MEDIO_PAGO": "",
    "txtCTA_BANCARIA_BN": "",
    "txtCODIGO_DETRACCION": "",
    "txtPOR_DETRACCION": "0.00",
    "txtTOTAL_DETRACCIONES": "0.00",
    "txtTOTAL_ISC": "0.00",
    "txtTOTAL_OTR_IMP": "0.00",
    "ICBP": "0.00",
    "txtTOTAL_LETRAS": numeroALetras(invoice.totals.total).toUpperCase(),
    "txtNRO_GUIA_REMISION": "",
    "txtCOD_GUIA_REMISION": "",
    "txtFECHA_GUIA_REMISION": "",
    "txtNRO_OTR_COMPROBANTE": "",
    "txtCOD_OTR_COMPROBANTE": "",
    "txtTIPO_COMPROBANTE_MODIFICA": txtTIPO_COMPROBANTE_MODIFICA,
    "txtNRO_DOCUMENTO_MODIFICA": txtNRO_DOCUMENTO_MODIFICA,
    "txtCOD_TIPO_MOTIVO": txtCOD_TIPO_MOTIVO,
    "txtDESCRIPCION_MOTIVO": txtDESCRIPCION_MOTIVO,
    "txtNRO_COMPROBANTE": `${invoice.serie.toUpperCase().trim()}-${String(invoice.correlativo).padStart(8, '0')}`,
    "txtFECHA_DOCUMENTO": fechaEmision,
    "txtFECHA_VTO": fechaEmision,
    "txtCOD_TIPO_DOCUMENTO": tipoComprobante,
    "txtCOD_MONEDA": company.moneda_simbolo?.includes('$') ? "USD" : "PEN",
    "txtOBSERVACIONES": cleanText(invoice.notes || "VENTA"),
    "detalle_forma_pago": [
      {
        "COD_FORMA_PAGO": "Contado",
        "MONTO_FORMA_PAGO": safeNumber(invoice.totals.total)
      }
    ],
    "txtNRO_DOCUMENTO_CLIENTE": codigoTipoEntidad === '0' ? "00000000" : rawDocNumber,
    "txtRAZON_SOCIAL_CLIENTE": codigoTipoEntidad === '0' ? "CLIENTE VARIOS" : cleanText(invoice.client.name || "CLIENTE VARIOS"),
    "txtTIPO_DOCUMENTO_CLIENTE": codigoTipoEntidad,
    "txtDIRECCION_CLIENTE": cleanText(invoice.client.address) || "-",
    "txtCOD_UBIGEO_CLIENTE": invoice.client.ubigeo || "150101",
    "txtDEPARTAMENTO_CLIENTE": invoice.client.departamento || "LIMA",
    "txtPROVINCIA_CLIENTE": invoice.client.provincia || "LIMA",
    "txtDISTRITO_CLIENTE": invoice.client.distrito || "LIMA",
    "txtCIUDAD_CLIENTE": invoice.client.distrito || "LIMA",
    "txtNRO_DOCUMENTO_EMPRESA": isTestMode ? "11111111111" : cleanDoc(company.ruc),
    "txtTIPO_DOCUMENTO_EMPRESA": "6",
    "txtNOMBRE_COMERCIAL_EMPRESA": cleanText(company.nombre_comercial || company.razonSocial),
    "txtCODIGO_UBIGEO_EMPRESA": company.ubigeo || "150101",
    "txtDIRECCION_EMPRESA": cleanText(company.address) || "-",
    "txtDEPARTAMENTO_EMPRESA": cleanText(company.departamento || "LIMA"),
    "txtPROVINCIA_EMPRESA": cleanText(company.provincia || "LIMA"),
    "txtDISTRITO_EMPRESA": cleanText(company.distrito || "LIMA"),
    "txtCODIGO_PAIS_EMPRESA": "PE",
    "txtRAZON_SOCIAL_EMPRESA": cleanText(company.razonSocial),
    "txtCONTACTO_EMPRESA": cleanText(company.contactPhone || "ADMIN"),
    "txtTELEFONO_EMPRESA": company.contactPhone || "",
    "txtFORMATO_IMPRESION": "",
    "txtFLG_ANTICIPO": "0",
    "txtFLG_REGU_ANTICIPO": "0",
    "txtNRO_COMPROBANTE_REF_ANT": "",
    "txtMONEDA_REGU_ANTICIPO": "",
    "txtMONTO_REGU_ANTICIPO": "0.00",
    "txtMONTO_REGU_ANTICIPO_TOTAL": "0.00",
    "txtTIPO_DOCUMENTO_EMP_REGU_ANT": "",
    "txtNRO_DOCUMENTO_EMP_REGU_ANT": "",
    "txtUSUARIO_SOL_EMPRESA": (company.solUser || "MODDATOS").trim(),
    "txtPASS_SOL_EMPRESA": (company.solPass || "MODDATOS").trim(),
    "txtCONTRA": (company.firmaPass || company.solPass || "MODDATOS").trim(),
    "txtPAS_FIRMA": (company.firmaPass || company.solPass || "MODDATOS").trim(),
    "txtTIPO_PROCESO": isTestMode ? "3" : "1",
    "detalle": invoice.items.map((item, idx) => {
        const itemIgvType = item.igvType || '10';
        const cantidadOriginal = Number(item.quantity) || 0;
        const precioOriginal = Number(item.price) || 0;
        const descuentoUnitario = Number(item.descuento_unitario) || 0;
        const precioConDescuento = Math.max(0, precioOriginal - descuentoUnitario);
        
        const totalLine = Math.floor((precioConDescuento * cantidadOriginal) * 10 + 0.0001) / 10;
        
        let valorUnitario;
        let subtotal;
        let igv;
        let precioBase;
        let descuentoPrecioBase;

        if (itemIgvType === '10') {
            subtotal = Number((totalLine / igvFactor).toFixed(2));
            igv = Number((totalLine - subtotal).toFixed(2));
            valorUnitario = cantidadOriginal > 0 ? subtotal / cantidadOriginal : (precioConDescuento / igvFactor);
            precioBase = precioOriginal / igvFactor;
            descuentoPrecioBase = descuentoUnitario / igvFactor;
        } else {
            subtotal = totalLine;
            igv = 0;
            valorUnitario = precioConDescuento;
            precioBase = precioOriginal;
            descuentoPrecioBase = descuentoUnitario;
        }
        
        return {
          "txtITEM": String(idx + 1),
          "txtUNIDAD_MEDIDA_DET": item.unitCode || 'NIU',
          "txtCANTIDAD_DET": cantidadOriginal.toFixed(2),
          "txtPRECIO_DET": precioOriginal.toFixed(2),
          "txtIMPORTE_DET": subtotal.toFixed(2),
          "txtPRECIO_TIPO_CODIGO": "01",
          "txtIGV": igv.toFixed(2),
          "POR_IGV": igvRate.toFixed(2),
          "txtISC": "0.00",
          "txtCOD_TIPO_OPERACION": itemIgvType,
          "txtCODIGO_DET": item.id ? item.id.substring(0, 15) : idx.toString(),
          "txtDESCRIPCION_DET": cleanText(item.name || "PRODUCTO"),
          "txtPRECIO_SIN_IGV_DET": valorUnitario.toFixed(4),
          "FLG_ICBPER": 0,
          "IMPUESTO_BP": "0.00",
          "IMPORTE_BP": "0.00"
        };
    })
  };

  try {
      console.log("[Visioner7] Payload enviado:", JSON.stringify(payload, null, 2));

      const response = await fetch(finalUrl, { 
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(company.whatsapp_token || company.apiToken || '').trim()}`
          },
          body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
          const errorText = await response.text();
          const isPending = response.status >= 500;
          return { 
              success: false, 
              isPending,
              description: `Error del servidor API (${response.status}): ${errorText.substring(0, 100)}` 
          };
      }

      const responseText = await response.text();
      console.log("[Visioner7] Respuesta bruta:", responseText);

      if (!responseText || responseText.trim() === "") {
          return { success: false, isPending: true, description: "La API de Visioner7 devolvió una respuesta vacía." };
      }

      let body;
      try {
          body = JSON.parse(responseText);
      } catch (parseError) {
          return { 
              success: false, 
              description: `Error de formato en respuesta: La API no devolvió un JSON válido. Respuesta: ${responseText.substring(0, 100)}...` 
          };
      }

      const successVal = body.success === true || body.success === 'true' || body.status === 'OK' || body.data?.success === true || body.codigo === '0' || body.code === 200 || body?.errors === undefined;
      const descVal = body.message || body.msg || body.description || body.data?.message || (successVal ? "Comprobante generado y enviado con éxito" : "Error de emisión");

      const pdfUrl = body.ruta_pdf || body.url_pdf || body.pdf || body.data?.ruta_pdf || body.data?.url_pdf || body.data?.pdf || "";
      const xmlUrl = body.ruta_xml || body.url_xml || body.xml || body.data?.ruta_xml || body.data?.url_xml || body.data?.xml || "";
      const cdrUrl = body.ruta_cdr || body.url_cdr || body.cdr || body.data?.ruta_cdr || body.data?.url_cdr || body.data?.cdr || "";
      const hashVal = body.hash || body.firma || body.hash_cpe || body.data?.hash || body.data?.firma || "---";

      return {
          success: successVal,
          description: descVal,
          hash: hashVal,
          pdfUrl,
          xmlUrl,
          cdrUrl
      };

  } catch (e: any) {
      console.error("[Visioner7] Error catch:", e);
      return { success: false, isPending: true, description: "Error de comunicación con Visioner7: " + e.message };
  }
};

/**
 * Servicio de integración con el API de Facturación Electrónica Peruana.
 */
export const sendBillToSunat = async (invoice: Invoice, company: Company): Promise<SunatResponse> => {
  
  // Usamos la URL configurada en la sucursal
  const dbUrl = company.sunat_url?.trim() || "";
  
  // Si la url está armada para el nuevo CPE de Visioner7, redirigimos el flujo en paralelo para no romper producción
  if (dbUrl.includes('visioner7') || dbUrl.includes('generar-cpe')) {
     return sendBillToVisioner7(invoice, company);
  }
  
  // LOGICA DE PROXY: 
  // Si la URL apunta a 'apisu.sysventa.com', usamos el proxy interno '/api-proxy/sunat'
  // para evitar problemas de CORS.
    let finalUrl = '/api-proxy/sunat';
    let isProxy = true;

    if (dbUrl && dbUrl.startsWith('http')) {
        // Proxy universal: funciona con cualquier dominio, sin importar el proveedor
        const urlWithoutProtocol = dbUrl.replace('https://', '').replace('http://', '');
        finalUrl = `/api-proxy/sunat-vps/${urlWithoutProtocol}`;
        isProxy = true;
    }

  console.log(`🚀 Preparando envío a SUNAT. URL Final: ${finalUrl} (Proxy: ${isProxy})`);
  
  // Base URL para generar los links de descarga (PDF/XML/CDR)
  const apiBaseUrl = dbUrl ? dbUrl.split('/post.php')[0] : 'https://apisu.sysventa.com/API_SUNAT';

  const peruTime = getPeruDateTime();
  const dateToUse = invoice.fecha_emision || invoice.date;
  const fechaEmision = dateToUse ? dateToUse.split('T')[0] : peruTime.date;
  
  let horaEmision = peruTime.time;
  if (dateToUse && dateToUse.includes('T')) {
      const parts = dateToUse.split('T');
      if (parts[1]) {
          // Tomar sólo HH:MM:SS de la parte de hora
          horaEmision = parts[1].split('.')[0].split('-')[0].split('+')[0];
      }
  }

  const cleanDoc = (doc: string) => (doc || "").replace(/[^0-9]/g, '').trim();
  const cleanText = (text: string) => (text || "").toUpperCase().replace(/[<>&"']/g, '').trim();

  let codigoTipoEntidad = '0'; 
  const docTypeClean = String(invoice.client.docType || '-').toUpperCase();
  const rawDocNumber = cleanDoc(invoice.client.docNumber || '');

  if (docTypeClean.includes('DNI') && rawDocNumber.length > 0 && rawDocNumber !== '99999999') {
      codigoTipoEntidad = '1';
  } else if (docTypeClean.includes('RUC')) {
      codigoTipoEntidad = '6';
  } else if (docTypeClean.includes('CEX') || docTypeClean.includes('EXTRANJER')) {
      codigoTipoEntidad = '4';
  } else {
      codigoTipoEntidad = '0';
  }

  const igvRate = company.porcentajeIgv || 18.00;
  const igvFactor = 1 + (igvRate / 100);

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
        "razon_social_nombres": (codigoTipoEntidad === '0') ? "CLIENTES VARIOS" : cleanText(invoice.client.name || "CLIENTES VARIOS"),
        "numero_documento": (codigoTipoEntidad === '0') ? '-' : rawDocNumber,
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
        "tipo_moneda": company.moneda_simbolo?.includes('$') ? "USD" : "PEN",
        "moneda": company.moneda_simbolo?.includes('$') ? "USD" : "PEN",
        "forma_pago_id": "1", 
        "total_gravada": safeNumber(invoice.totals.gravada),
        "total_igv": safeNumber(invoice.totals.igv),
        "total_exonerada": safeNumber(invoice.totals.exonerada),
        "total_inafecta": safeNumber(invoice.totals.inafecta),
        "total_gratuita": "0.00",
        "total_otros_cargos": "0.00",
        "total_descuento": safeNumber(invoice.descuento || 0),
        "descuento_global": safeNumber(invoice.descuento || 0),
        "total_exportacion": "0.00",
        "total_venta": safeNumber(invoice.totals.total),
        "total_pago": safeNumber(invoice.totals.total),
        "tipo_documento_codigo": invoice.type,
        "nota": cleanText(invoice.notes || "VENTA REALIZADA DESDE SISTEMA POS"),
        "motivo_descripcion": cleanText(invoice.notes || "VENTA REALIZADA DESDE SISTEMA POS"),
        // Campos para Nota de Crédito (Tipo 07)
        ...(invoice.type === '07' && invoice.relatedDocument ? {
            "relacionado_serie": invoice.relatedDocument.serie.toUpperCase().trim(),
            "relacionado_numero": String(invoice.relatedDocument.correlativo),
            "relacionado_tipo_documento": invoice.relatedDocument.type,
            "relacionado_motivo_codigo": "01",
            "motivo_codigo": "01",
            "des_motivo": cleanText(invoice.notes || "ANULACION DE LA OPERACION"),
            "sustento": cleanText(invoice.notes || "ANULACION DE LA OPERACION"),
            "tipo_nota_id": "1",
            // Mantener estos como fallback por si acaso, pero los principales son los de arriba
            "documento_que_se_modifica_tipo": invoice.relatedDocument.type,
            "documento_que_se_modifica_serie": invoice.relatedDocument.serie.toUpperCase().trim(),
            "documento_que_se_modifica_numero": String(invoice.relatedDocument.correlativo),
            "documento_que_se_modifica_fecha": invoice.relatedDocument.date ? invoice.relatedDocument.date.split('T')[0] : "",
            "fecha_documento_referencia": invoice.relatedDocument.date ? invoice.relatedDocument.date.split('T')[0] : ""
        } : {})
    },
    "items": invoice.items.map((item, idx) => {
        const itemIgvType = item.igvType || '10';
        const cantidadOriginal = Number(item.quantity) || 0;
        const precioOriginal = Number(item.price) || 0;
        const descuentoUnitario = Number(item.descuento_unitario) || 0;
        
        const precioConDescuento = Math.max(0, precioOriginal - descuentoUnitario);
        
        // IMPORTANTE: El total de línea debe redondearse igual que en calculateTotals (roundToOneDecimal)
        // para que la suma de ítems coincida con el total de venta en la cabecera.
        const totalLine = Math.floor((precioConDescuento * cantidadOriginal) * 10 + 0.0001) / 10;
        
        let valorUnitario;
        let subtotal;
        let igv;
        let precioBase;
        let descuentoPrecioBase;

        if (itemIgvType === '10') {
            // Gravado: Desglosamos el IGV del total de la línea (ya redondeado a 1 decimal)
            subtotal = Number((totalLine / igvFactor).toFixed(2));
            igv = Number((totalLine - subtotal).toFixed(2));
            // Recalculamos el valor unitario para que cuadre exactamente con el subtotal
            valorUnitario = cantidadOriginal > 0 ? subtotal / cantidadOriginal : (precioConDescuento / igvFactor);
            precioBase = precioOriginal / igvFactor;
            descuentoPrecioBase = descuentoUnitario / igvFactor;
        } else {
            // Exonerado / Inafecto
            subtotal = totalLine;
            igv = 0;
            valorUnitario = precioConDescuento;
            precioBase = precioOriginal;
            descuentoPrecioBase = descuentoUnitario;
        }
        
        return {
            "producto": cleanText(item.name || "PRODUCTO"),
            "cantidad": cantidadOriginal.toFixed(6),
            "valor_unitario": valorUnitario.toFixed(10),
            "precio_unitario": precioOriginal.toFixed(6),
            "precio_base": precioBase.toFixed(10), 
            "descuento_precio_base": descuentoPrecioBase.toFixed(10),
            "codigo_sunat": "",
            "codigo_producto": item.id ? item.id.substring(0, 15) : `p-${idx}`,
            "codigo_unidad": item.unitCode || 'NIU', 
            "tipo_igv_codigo": itemIgvType,
            "igv": igv.toFixed(2),
            "subtotal": subtotal.toFixed(2),
            "total": totalLine.toFixed(2)
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
          const isPending = response.status >= 500;
          return { 
              success: false, 
              isPending,
              description: `Error del servidor API (${response.status}): ${errorText.substring(0, 100)}` 
          };
      }

      const responseText = await response.text();
      console.log("Respuesta bruta de SUNAT API:", responseText);

      if (!responseText || responseText.trim() === "") {
          return { success: false, isPending: true, description: "Error: La API de SUNAT devolvió una respuesta vacía." };
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

      // Detección de error "Ya informado" o "Registrado previamente"
      const errorMessage = (data?.respuesta_sunat_descripcion || body?.mensaje || body?.error || "").toUpperCase();
      const isAlreadyAccepted = errorMessage.includes("INFORMADO ANTERIORMENTE") || 
                                errorMessage.includes("REGISTRADO PREVIAMENTE") ||
                                errorMessage.includes("YA EXISTE EL COMPROBANTE") ||
                                errorMessage.includes("DUPLICADO");

      if (body.success === true || (data && (String(data.respuesta_sunat_codigo) === "0" || data.respuesta_sunat_codigo === 0)) || isAlreadyAccepted) {
          return {
              success: true,
              description: isAlreadyAccepted ? "Comprobante ya informado anteriormente (Aceptado)" : (data?.respuesta_sunat_descripcion || "Comprobante Aceptado por SUNAT"),
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
      return { success: false, isPending: true, description: "Error de comunicación: " + e.message };
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
    "comprobantes": invoices.map(inv => {
      const docTypeClean = String(inv.client.docType || '-').toUpperCase();
      const rawDocNumber = (inv.client.docNumber || '').replace(/[^0-9]/g, '').trim();
      
      let clientDocType = '0';
      let clientDocNum = '-';

      if (docTypeClean.includes('DNI') && rawDocNumber.length > 0 && rawDocNumber !== '99999999') {
          clientDocType = '1';
          clientDocNum = rawDocNumber;
      } else if (docTypeClean.includes('RUC')) {
          clientDocType = '6';
          clientDocNum = rawDocNumber;
      }

      return {
        "tipo_documento": inv.type, 
        "serie": inv.serie,
        "numero": String(inv.correlativo),
        "cliente_tipo_documento": clientDocType,
        "cliente_numero_documento": clientDocNum,
        "status": "1",
        "total_a_pagar": Number(inv.totals.total.toFixed(2)),
        "total_igv": Number(inv.totals.igv.toFixed(2)),
        "total_gravada": Number(inv.totals.gravada.toFixed(2))
      };
    })
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

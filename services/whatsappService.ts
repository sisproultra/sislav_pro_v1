
import { Invoice, Company, InvoiceType } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabaseClient';

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

    return `SON: ${letrasEntero} CON ${centimos}/100 SOLES`;
};

// Proxy URL para evitar problemas de CORS en el navegador
const PROXY_URL = 'https://corsproxy.io/?'; 

/**
 * Convierte una URL de imagen a Base64 con múltiples intentos y manejo de CORS
 */
const getBase64ImageFromUrl = async (url: string): Promise<string | null> => {
    if (!url) return null;
    
    // Si ya es base64, lo devolvemos directamente
    if (url.startsWith('data:image')) return url;

    const tryFetch = async (targetUrl: string): Promise<string | null> => {
        try {
            const response = await fetch(targetUrl);
            if (!response.ok) return null;
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                   const result = reader.result as string;
                   resolve(result && result.length > 100 ? result : null);
                };
                reader.onerror = () => reject(new Error("FileReader error"));
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            return null;
        }
    };

    // Intento 1: Directo (Supabase Storage suele permitir CORS en buckets públicos)
    let result = await tryFetch(url);
    if (result) return result;

    // Intento 2: Con Proxy (corsproxy.io)
    const proxiedUrl = `${PROXY_URL}${encodeURIComponent(url)}`;
    result = await tryFetch(proxiedUrl);
    if (result) return result;

    // Intento 3: Con otro Proxy (allorigins) como respaldo
    const alternativeProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    result = await tryFetch(alternativeProxy);
    
    return result;
};

/**
 * Formatea los detalles de un ítem (color, defectos, observaciones)
 */
const formatItemDetailsInternal = (item: any) => {
    if (!item) return '';
    const details = item.details || '';
    
    // Si viene como JSON (unidades del carrito)
    try {
        const parsed = JSON.parse(details);
        if (Array.isArray(parsed) && parsed.length > 0) {
            const unit = parsed[0]; 
            const color = unit.color ? `COLOR: ${unit.color.toUpperCase()}` : '';
            const def = (unit.defectos || unit.defect) ? `DEF: ${(unit.defectos || unit.defect).toUpperCase()}` : '';
            const obs = (unit.details || unit.observaciones || unit.obs) ? `OBS: ${(unit.details || unit.observaciones || unit.obs).toUpperCase()}` : '';
            return [color, def, obs].filter(Boolean).join(' - ');
        }
    } catch (e) {}

    // Si viene como objeto plano
    const color = item.color ? `COLOR: ${item.color.toUpperCase()}` : '';
    const def = item.defectos ? `DEF: ${item.defectos.toUpperCase()}` : '';
    const obs = details ? `OBS: ${details.toUpperCase()}` : '';
    return [color, def, obs].filter(Boolean).join(' - ');
};

/**
 * Genera un PDF en formato Blob localmente para Notas de Venta
 */
export const generateInternalPDFBlob = async (invoice: Invoice, company: Company): Promise<Blob> => {
    // 1. Obtener Configuración de Ticket
    let config: any = null;
    // Intentamos obtener el ID de sucursal de la forma más robusta posible
    const branchId = invoice.sucursal_id || (company as any).sucursal_id || company.id;
    
    try {
        const { data } = await supabase.from('sucursal_ticket_config').select('*').eq('sucursal_id', branchId).maybeSingle();
        config = data;
    } catch (e) {
        console.error("Error fetching ticket config for PDF:", e);
    }

    const doc = new jsPDF({
        unit: 'mm',
        format: [80, 400] 
    });

    const primaryFont = 'helvetica';
    let currentY = 10;

    // 2. Logo - Intentar múltiples fuentes posibles para el logo
    const logoUrl = config?.url_logo_ticket || 
                    (company as any).url_logo || 
                    (company as any).logo_url || 
                    company.logoUrl || 
                    localStorage.getItem('sucursal_url_logo');
    
    if (logoUrl) {
        try {
            // Obtener el base64 de la imagen
            const base64 = await getBase64ImageFromUrl(logoUrl);
            
            if (base64 && base64.length > 500) {
                const logoSize = Math.max(10, Math.min(60, config?.logo_ticket_size || 30));
                
                // Determinamos el formato de la imagen de forma segura
                let format: 'PNG' | 'JPEG' | 'WEBP' = 'PNG';
                const baseHeader = base64.toLowerCase().substring(0, 50);
                if (baseHeader.includes('image/jpeg') || baseHeader.includes('image/jpg')) format = 'JPEG';
                else if (baseHeader.includes('image/webp')) format = 'WEBP';
                
                // Centrar y añadir imagen
                doc.addImage(base64, format, 40 - (logoSize / 2), currentY, logoSize, logoSize, undefined, 'FAST');
                currentY += logoSize + 5;
            } else {
                console.warn("Logo URL no pudo convertirse a Base64 válido:", logoUrl);
            }
        } catch (logoError) {
            console.error("Fallo crítico insertando logo al PDF:", logoError);
        }
    }

    // 3. Cabecera Empresa
    doc.setFont(primaryFont, 'bold');
    doc.setFontSize(10);
    doc.text(company.razonSocial.toUpperCase(), 40, currentY, { align: 'center' });
    currentY += 5;
    
    doc.setFontSize(9);
    doc.text(`RUC: ${company.ruc}`, 40, currentY, { align: 'center' });
    currentY += 4;
    
    doc.setFontSize(7.5);
    doc.setFont(primaryFont, 'normal');
    const splitAddress = doc.splitTextToSize(company.address.toUpperCase(), 70);
    doc.text(splitAddress, 40, currentY, { align: 'center' });
    currentY += (splitAddress.length * 3.5);

    const horario = config?.horario_atencion || localStorage.getItem('sucursal_horario_atencion') || '';
    if (horario) {
        doc.setFont(primaryFont, 'italic');
        doc.setFontSize(7);
        doc.text(horario.toUpperCase(), 40, currentY, { align: 'center' });
        currentY += 4;
    }

    doc.setLineWidth(0.2);
    doc.line(5, currentY, 75, currentY);
    currentY += 6;

    // 4. Datos del Documento
    doc.setFontSize(11);
    doc.setFont(primaryFont, 'bold');
    const docTitle = invoice.type === InvoiceType.NOTA_VENTA ? 'NOTA DE VENTA' : (invoice.type === InvoiceType.FACTURA ? 'FACTURA' : 'BOLETA');
    doc.text(docTitle, 40, currentY, { align: 'center' });
    currentY += 5;
    doc.text(`${invoice.serie}-${String(invoice.correlativo).padStart(8, '0')}`, 40, currentY, { align: 'center' });
    currentY += 5;

    doc.setFontSize(8);
    doc.setFont(primaryFont, 'normal');
    const fechaEmision = invoice.fecha_emision || invoice.date;
    doc.text(`Emisión: ${new Date(fechaEmision).toLocaleString('es-PE')}`, 40, currentY, { align: 'center' });
    currentY += 4;

    doc.line(5, currentY, 75, currentY);
    currentY += 6;

    // 5. Cliente
    doc.setFontSize(8.5);
    doc.setFont(primaryFont, 'normal');
    doc.text(`CLIENTE: ${invoice.client.name.toUpperCase()}`, 5, currentY);
    currentY += 4;
    doc.text(`${invoice.client.docType || 'DOC'}: ${invoice.client.docNumber}`, 5, currentY);
    currentY += 4;
    doc.text(`TEL: ${invoice.client.phone || '-'}`, 5, currentY);
    currentY += 4;
    doc.text(`DIR: ${(invoice.client.address || '-').toUpperCase()}`, 5, currentY);
    currentY += 4;
    doc.text(`MONEDA: SOLES`, 5, currentY);
    currentY += 5;

    doc.line(5, currentY, 75, currentY);
    currentY += 2;

    // 6. Tabla de Ítems
    const tableBody: any[] = [];
    invoice.items.forEach(item => {
        // Fila 1: Cantidad, Nombre, Total
        tableBody.push([
            item.quantity.toFixed(2),
            { content: item.name.toUpperCase(), styles: { fontStyle: 'bold' } },
            (item.price * item.quantity).toFixed(2)
        ]);
        
        // Fila 2: Detalles (Color, Defectos, Obs)
        const detailsStr = formatItemDetailsInternal(item);
        if (detailsStr) {
            tableBody.push([
                '',
                { content: detailsStr.toUpperCase(), styles: { fontSize: 6.5, fontStyle: 'italic', textColor: [100, 100, 100] } },
                ''
            ]);
        }
        
        // Fila 3: Precio Unitario
        tableBody.push([
            '',
            { content: `P.U: ${item.price.toFixed(2)}`, styles: { fontSize: 7, fontStyle: 'italic', textColor: [100, 100, 100] } },
            ''
        ]);
    });

    autoTable(doc, {
        startY: currentY,
        head: [['CANT.', 'DESCRIPCIÓN', 'TOTAL']],
        body: tableBody,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1, font: primaryFont },
        headStyles: { fontStyle: 'bold', lineWidth: { bottom: 0.1 }, lineColor: [150, 150, 150] },
        columnStyles: {
            0: { cellWidth: 12 },
            2: { halign: 'right', cellWidth: 20 }
        },
        margin: { left: 5, right: 5 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // 7. Desglose Financiero
    doc.setFontSize(8);
    doc.setFont(primaryFont, 'normal');
    const opGravada = invoice.totals.total / 1.18;
    const igv = invoice.totals.total - opGravada;

    doc.text('Op. Gravada:', 50, currentY, { align: 'right' });
    doc.text(`${opGravada.toFixed(2)}`, 75, currentY, { align: 'right' });
    currentY += 4;
    doc.text('IGV (18%):', 50, currentY, { align: 'right' });
    doc.text(`${igv.toFixed(2)}`, 75, currentY, { align: 'right' });
    currentY += 6;

    doc.setFont(primaryFont, 'bold');
    doc.setFontSize(11);
    doc.text('TOTAL A PAGAR:', 50, currentY, { align: 'right' });
    doc.text(`S/ ${invoice.totals.total.toFixed(2)}`, 75, currentY, { align: 'right' });
    currentY += 6;

    // 8. Monto en Letras
    doc.setFontSize(8);
    doc.setFont(primaryFont, 'bold');
    doc.text(numeroALetras(invoice.totals.total), 5, currentY);
    currentY += 4;

    doc.line(5, currentY, 75, currentY);
    currentY += 5;

    // 9. Forma de Pago y Saldos
    let paymentMethod = (invoice as any).paymentMethod || '';
    
    // Si no hay nombre resolutorio, buscamos en los pagos
    if (!paymentMethod || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentMethod)) {
       if (invoice.payments && invoice.payments.length > 0) {
           if (invoice.payments.length > 1) {
               paymentMethod = 'MÚLTIPLE';
           } else {
               // Intentar obtener el nombre si se incluyó en la relación, de lo contrario fallback a EFECTIVO
               const firstPayment = invoice.payments[0] as any;
               paymentMethod = firstPayment.metodo_pago_name || firstPayment.metodo_pago?.nombre || 'AL CONTADO';
           }
       } else {
           paymentMethod = 'AL CONTADO';
       }
    }
    
    doc.setFontSize(8.5);
    doc.setFont(primaryFont, 'normal');
    doc.text('FORMA DE PAGO:', 5, currentY);
    doc.setFont(primaryFont, 'bold');
    // Truncar si por alguna razón sigue siendo muy largo para evitar solapamiento
    const displayPayMethod = paymentMethod.toUpperCase().substring(0, 25);
    doc.text(displayPayMethod, 75, currentY, { align: 'right' });
    currentY += 4;

    if (invoice.prePaymentAmount && invoice.prePaymentAmount > 0) {
        doc.setFont(primaryFont, 'bold');
        doc.text('PAGADO (ADELANTO):', 5, currentY);
        doc.text(`S/ ${invoice.prePaymentAmount.toFixed(2)}`, 75, currentY, { align: 'right' });
        currentY += 4;
        doc.text('SALDO PENDIENTE:', 5, currentY);
        doc.text(`S/ ${(invoice.totals.total - invoice.prePaymentAmount).toFixed(2)}`, 75, currentY, { align: 'right' });
        currentY += 4;
    }
    currentY += 2;

    doc.line(5, currentY, 75, currentY);
    currentY += 8;

    // 10. Orden y Políticas
    doc.setFontSize(12);
    doc.setFont(primaryFont, 'bold');
    doc.text(`ORDEN: ${invoice.ordenNumber || '---'}`, 40, currentY, { align: 'center' });
    currentY += 8;

    doc.line(5, currentY, 75, currentY);
    currentY += 6;

    doc.setFontSize(8);
    doc.setFont(primaryFont, 'bold');
    doc.text('CONDICIONES DE SERVICIO:', 5, currentY);
    currentY += 5;
    
    doc.setFontSize(7);
    doc.setFont(primaryFont, 'normal');
    
    // Obtener políticas con múltiples fallbacks para asegurar que siempre aparezcan
    const politicasRaw = config?.politicas || 
                         company.ticketPolicies || 
                         localStorage.getItem('sucursal_ticket_policies') || 
                         localStorage.getItem('sucursal_politicas') || 
                         '';
                         
    // Limpiar HTML y formatear
    const politicasText = politicasRaw.replace(/<[^>]*>?/gm, '').trim();
    
    if (politicasText) {
        const splitPoliticas = doc.splitTextToSize(politicasText.toUpperCase(), 70);
        doc.text(splitPoliticas, 5, currentY);
        currentY += (splitPoliticas.length * 3.5) + 10;
    } else {
        doc.text('REVISAR POLÍTICAS EN EL ESTABLECIMIENTO.', 5, currentY);
        currentY += 15;
    }

    doc.setFontSize(10);
    doc.setFont(primaryFont, 'bold');
    doc.text('¡VUELVA PRONTO!', 40, currentY, { align: 'center' });

    return doc.output('blob');
};

/**
 * Sube un archivo a Supabase Storage y retorna la URL pública con Cache Buster
 */
const uploadToSupabaseStorage = async (fileBlob: Blob, fileName: string): Promise<string> => {
    const bucketName = 'tickets'; 
    
    // Subir/Sobrescribir archivo (upsert: true garantiza que siempre sea la versión más actual)
    const { error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, fileBlob, {
            contentType: 'application/pdf',
            upsert: true
        });

    if (error) {
        console.error("Error subiendo a Storage:", error);
        throw new Error("No se pudo alojar el archivo actualizado.");
    }

    // Obtener URL Pública
    const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

    // Añadir Cache Buster (timestamp) para forzar que WhatsApp lo envíe como nuevo siempre
    const cacheBuster = `t=${new Date().getTime()}`;
    const finalUrl = publicUrlData.publicUrl.includes('?') 
        ? `${publicUrlData.publicUrl}&${cacheBuster}` 
        : `${publicUrlData.publicUrl}?${cacheBuster}`;

    return finalUrl;
};

/**
 * Genera el link de WhatsApp Web tradicional como respaldo (Fallback)
 */
export const generateWhatsAppLink = (invoice: Invoice, company: Company, phoneNumber: string) => {
    const isNotaVenta = invoice.type === InvoiceType.NOTA_VENTA;
    const docName = isNotaVenta ? 'Nota de Venta' : (invoice.type === InvoiceType.FACTURA ? 'Factura' : 'Boleta');
    
    let text = `*${company.razonSocial}*\nEstimado cliente, aquí tiene el detalle de su *${docName} ${invoice.serie}-${invoice.correlativo}*:\n\n`;
    invoice.items.forEach(it => {
        text += `• ${it.quantity} x ${it.name} = S/ ${(it.price * it.quantity).toFixed(2)}\n`;
    });
    text += `\n*TOTAL: S/ ${invoice.totals.total.toFixed(2)}*\n`;
    text += `\n¡Gracias por su preferencia!`;
    
    return `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
};

/**
 * Envía una notificación de que el pedido está listo para recoger.
 */
export const sendReadyNotification = async (
  invoice: Invoice,
  company: Company,
  phoneNumber: string
): Promise<{ success: boolean; message: string; fallbackUrl?: string }> => {
  const baseUrl = company.whatsapp_instance?.trim();
  const apiKey = company.whatsapp_token?.trim();
  const instance = company.whatsapp_instance_name?.trim();

  const clientName = (invoice.client.name || 'Cliente').toUpperCase();
  const orden = invoice.ordenNumber || 'S/N';
  const text = `*${company.razonSocial}*\n\nEstimado(a) *${clientName}*,\n\nLe informamos que su pedido con orden *#${orden}* ya se encuentra *LISTO* ✅.\n\nPuede pasar a recogerlo en nuestro local en: ${company.address.toUpperCase()}.\n\n¡Le esperamos! 🧺✨`;
  
  const fallbackUrl = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

  if (!baseUrl || !apiKey || !instance) {
    return { success: false, message: 'Configuración incompleta.', fallbackUrl };
  }

  try {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const payload = {
      "number": cleanNumber,
      "text": text,
      "delay": 1200
    };

    let finalBaseUrl = baseUrl;
    if (!finalBaseUrl.startsWith('http')) finalBaseUrl = `https://${finalBaseUrl}`;
    const finalEndpoint = `${finalBaseUrl}/message/sendText/${instance}`;
    const proxiedUrl = `${PROXY_URL}${encodeURIComponent(finalEndpoint)}`;

    const response = await fetch(proxiedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      body: JSON.stringify(payload)
    });

    if (response.ok) return { success: true, message: 'Notificación enviada' };
    return { success: false, message: 'Error en API', fallbackUrl };
  } catch (e: any) {
    return { success: false, message: e.message, fallbackUrl };
  }
};

/**
 * Convierte una URL de archivo a Base64 usando el proxy
 */
const getBase64FromUrl = async (url: string): Promise<string> => {
    const proxiedUrl = `${PROXY_URL}${encodeURIComponent(url)}`;
    const response = await fetch(proxiedUrl);
    if (!response.ok) throw new Error(`No se pudo descargar el archivo: ${response.statusText}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            // Retornar solo la parte de datos (sin el prefijo data:application/pdf;base64,)
            resolve(base64String.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Envía el comprobante al cliente vía WhatsApp mediante un link de descarga directa.
 * OPTIMIZACIÓN: Ya no genera el PDF en el navegador para ahorrar tiempo y recursos, 
 * en su lugar envía un link que abre el comprobante en el módulo de Tracking.
 */
export const sendInvoiceViaWhatsApp = async (
  invoice: Invoice, 
  company: Company, 
  phoneNumber: string
): Promise<{ success: boolean; message: string; fallbackUrl?: string }> => {
  
  const baseUrl = company.whatsapp_instance?.trim();
  const apiKey = company.whatsapp_token?.trim();
  const instance = company.whatsapp_instance_name?.trim();

  // Generamos el link de vista digital (Tracking + Receipt mode)
  const downloadUrl = `${window.location.origin}/?t=${invoice.id}&v=receipt`;
  const isNotaVenta = invoice.type === InvoiceType.NOTA_VENTA;
  const docTypeName = isNotaVenta ? 'Nota de Venta' : (invoice.type === InvoiceType.FACTURA ? 'Factura' : 'Boleta');

  // Texto optimizado para el mensaje
  let text = `*${company.razonSocial}*\n`;
  text += `Estimado cliente, puede visualizar y descargar su *${docTypeName}* desde el siguiente enlace:\n\n`;
  text += `🔗 ${downloadUrl}\n\n`;
  text += `📄 *Número*: ${invoice.serie}-${invoice.correlativo}\n`;
  text += `💰 *Importe*: S/ ${invoice.totals.total.toFixed(2)}\n\n`;
  text += `¡Gracias por su preferencia!`;

  const fallbackUrl = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

  if (!baseUrl || !apiKey || !instance) {
    return { success: false, message: 'API no configurada. Redirigiendo...', fallbackUrl };
  }

  try {
      const downloadUrl = `${window.location.origin}/?t=${invoice.id}&v=receipt`;
      const isNotaVenta = invoice.type === InvoiceType.NOTA_VENTA;
      const docTypeName = isNotaVenta ? 'Nota de Venta' : (invoice.type === InvoiceType.FACTURA ? 'Factura' : 'Boleta');

      let text = `*${company.razonSocial}*\n`;
      text += `Estimado cliente, puede visualizar y descargar su *${docTypeName}* desde el siguiente enlace:\n\n`;
      text += `🔗 ${downloadUrl}\n\n`;
      text += `📄 *Número*: ${invoice.serie}-${invoice.correlativo}\n`;
      text += `💰 *Importe*: S/ ${invoice.totals.total.toFixed(2)}\n\n`;
      text += `¡Gracias por su preferencia!`;

      const fallbackUrl = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

      if (!baseUrl || !apiKey || !instance) {
        return { success: false, message: 'API no configurada. Redirigiendo...', fallbackUrl };
      }

      console.log(`🚀 Solicitando envío de WA al servidor...`);
      
      const response = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            baseUrl,
            apiKey,
            instance,
            phoneNumber,
            text
          })
      });

      const result = await response.json();

      if (response.ok && result.success) {
          return { success: true, message: 'Link enviado con éxito' };
      } else {
          console.warn("⚠️ Fallo envío automático:", result.message);
          return { success: false, message: `Reintentando por WhatsApp...`, fallbackUrl };
      }
  } catch (error: any) {
    console.error("Error en flujo de envío WA:", error);
    const downloadUrl = `${window.location.origin}/?t=${invoice.id}&v=receipt`;
    const text = `*${company.razonSocial}*\nLink: ${downloadUrl}`;
    const fallbackUrl = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
    return { success: false, message: 'Fallo de conexión, intente manual', fallbackUrl };
  }
};

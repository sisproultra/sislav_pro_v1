
import { Invoice, Company, InvoiceType, PausedSale } from '../types';
import { dbGetTicketConfig } from '../services/dbService';
import bwipjs from 'bwip-js';

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

const formatItemDetails = (item: any, hidePrefix = false, displayMeta: 'none' | 'icons' | 'all' = 'all') => {
    if (!item) return '';
    const details = typeof item === 'string' ? item : (item.details || '');
    
    try {
        const parsed = JSON.parse(details);
        if (Array.isArray(parsed)) {
            if (parsed.length === 0) return '';
            
            const getItemMeta = (unit: any) => {
                if (displayMeta === 'none') return '';
                const hasImages = (unit.unit_images && unit.unit_images.length > 0) || (unit.images && unit.images.length > 0) || (unit.url_foto_1) || (unit.url_foto_2) || (unit.url_foto_3);
                const hasAudio = !!(unit.unit_audio || unit.audioNote || unit.url_audio);
                let meta = '';
                if (hasImages) {
                    meta += displayMeta === 'all' ? ' 📷 [FOTO]' : ' 📷';
                }
                if (hasAudio) {
                    meta += displayMeta === 'all' ? ' 🎤 [AUDIO]' : ' 🎤';
                }
                return meta;
            };

            // Si solo hay un detalle y queremos ocultar el prefijo (útil para items desglosados)
            if (hidePrefix && parsed.length === 1) {
                const unit = parsed[0];
                const color = unit.color ? `Color: ${unit.color}` : '';
                const obs = (unit.details || unit.observaciones) ? ` - Obs: ${unit.details || unit.observaciones}` : '';
                const multimedia = getItemMeta(unit);
                const result = `${color}${obs}${multimedia}`.trim();
                return result.startsWith(' - ') ? result.substring(3) : result;
            }
            return parsed.map((unit: any, idx: number) => {
                const color = unit.color ? `Color: ${unit.color}` : '';
                const obs = (unit.details || unit.observaciones) ? ` - Obs: ${unit.details || unit.observaciones}` : '';
                const multimedia = getItemMeta(unit);
                return `U${idx + 1}: ${color}${obs}${multimedia}`;
            }).join(' | ');
        }
    } catch (e) {
        // No era JSON
    }

    // Caso de ítems desglosados o con propiedades directas
    if (typeof item === 'object') {
        const color = item.color ? `Color: ${item.color}` : '';
        const def = item.defectos ? ` - Def: ${item.defectos}` : '';
        const obs = details ? ` - Obs: ${details}` : '';
        
        let multimedia = '';
        if (displayMeta !== 'none') {
            const hasImages = (item.images && item.images.length > 0) || (item.url_foto_1) || (item.url_foto_2) || (item.url_foto_3);
            const hasAudio = !!(item.audioNote || item.url_audio);
            if (hasImages) multimedia += displayMeta === 'all' ? ' 📷 [FOTO]' : ' 📷';
            if (hasAudio) multimedia += displayMeta === 'all' ? ' 🎤 [AUDIO]' : ' 🎤';
        }
        
        let result = `${color}${def}${obs}${multimedia}`.trim();
        if (result.startsWith(' - ')) result = result.substring(3);
        return result;
    }

    return details;
};

const generateQRCodeDataUrl = (text: string) => {
    if (!text) return '';
    try {
        const canvas = document.createElement('canvas');
        // @ts-ignore
        bwipjs.toCanvas(canvas, {
            bcid: 'qrcode',
            text: text,
            scale: 3,
            height: 10,
            width: 10,
        });
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error("Error generating QR:", e);
        return '';
    }
};

const generateBarcodeDataUrl = (text: string) => {
    if (!text || text === '---') return '';
    try {
        const canvas = document.createElement('canvas');
        // @ts-ignore
        bwipjs.toCanvas(canvas, {
            bcid: 'code128',
            text: text,
            scale: 2,
            height: 10,
            includetext: true,
            textxalign: 'center',
        });
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error("Error generating barcode:", e);
        return '';
    }
};

export const printQuoteDirectly = async (quote: PausedSale, company: Company, passedConfig?: any) => {
    const config = passedConfig || await dbGetTicketConfig(company.id).catch(() => null);
    
    // Create hidden iframe for printing
    let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
    }

    const attendingUser = localStorage.getItem('sislav_current_user_name') || 'SISTEMA';
    const formattedDate = new Date(quote.date).toLocaleString('sv-SE').replace('T', ' ');
    const total = quote.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const montoLetras = numeroALetras(total);
    
    const logoUrl = config?.url_logo_ticket || company.logoUrl;
    const logoSize = config?.logo_ticket_size || 100;

    let html = `
      <html>
        <head>
          <title>SISLAV - Cotización</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { 
              margin: 0; padding: 4mm; 
              font-family: Arial, Helvetica, sans-serif; 
              width: 72mm; 
              font-size: 10pt; 
              line-height: 1.2; 
              color: #000;
              -webkit-print-color-adjust: exact;
            }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1.5px solid #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 8pt; }
            th { text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; font-size: 8.5pt; }
            td { padding: 3px 0; vertical-align: top; }
            .logo-ticket { max-width: ${logoSize}%; height: auto; margin: 0 auto 3mm auto; display: block; }
            .flex-between { display: flex; justify-content: space-between; }
            .validity-note { 
                font-size: 7.5pt; 
                text-align: center; 
                margin-top: 10px; 
                font-style: italic;
                border: 1px solid #000;
                padding: 5px;
            }
            .software-footer { 
                margin-top: 15px; 
                font-size: 8pt; 
                text-align: center;
                border-top: 1px solid #ccc;
                padding-top: 5px;
            }
          </style>
        </head>
        <body>
          <div class="text-center">
            ${logoUrl ? `<img src="${logoUrl}" class="logo-ticket" />` : ''}
            <div class="bold" style="font-size: 12pt;">${company.razonSocial.toUpperCase()}</div>
            <div class="bold">RUC: ${company.ruc}</div>
            <div style="font-size: 8pt;">${company.address.toUpperCase()}</div>
            <div class="divider"></div>
            <div class="bold" style="font-size: 14pt; margin: 5px 0;">
                COTIZACIÓN<br/>
                #${String(quote.numero_cotizacion || 0).padStart(5, '0')}
            </div>
            <div style="margin-top: 4px;">Fecha: ${formattedDate}</div>
            <div class="divider"></div>
          </div>

          <div style="margin: 6px 0; font-size: 8.5pt;">
            <div>CLIENTE: ${quote.cliente_nombre?.toUpperCase() || 'PÚBLICO GENERAL'}</div>
          </div>

          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th align="left">CANT.</th>
                <th align="left">DESCRIPCIÓN</th>
                <th align="right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${quote.cart.map(item => `
                <tr style="border-bottom: 0.5px solid #eee">
                  <td width="15%">${item.quantity.toFixed(2)}</td>
                  <td style="text-transform: uppercase">
                    <div class="bold">${item.name}</div>
                  </td>
                  <td align="right" width="25%">${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="divider"></div>
          <div style="margin: 4px 0;">
            <div class="flex-between bold" style="font-size: 11pt; margin-top: 6px;">
                <span>TOTAL ESTIMADO:</span> 
                <span>S/ ${total.toFixed(2)}</span>
            </div>
          </div>

          <div style="margin-top: 10px; font-size: 8pt;" class="bold">
            ${montoLetras}
          </div>

          <div class="validity-note">
            Esta cotización tiene una validez de 15 días. <br/>
            Pasado este periodo, los precios pueden variar.
          </div>

          <div class="atendido-por" style="margin-top: 10px; font-size: 8pt; text-align: center;">
            Atendido por: ${attendingUser.toUpperCase()}
          </div>

          <div class="software-footer">
            GENERADO POR SISLAV - 931200353
          </div>
        </body>
      </html>
    `;

    const doc = iframe.contentWindow?.document;
    if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        
        // Give a small moment for styles/images to settle, then print
        setTimeout(() => {
            try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            } catch (e) {
                console.error("Error al intentar imprimir (Posible bloqueo de sandbox):", e);
            }
        }, 100);
    }
};

export const printInvoiceDirectly = async (invoice: Invoice, company: Company, passedConfig?: any, clientOnly = false) => {
    const config = passedConfig || await dbGetTicketConfig(company.id).catch(() => null);
    
    // Create hidden iframe for printing
    let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
    }

    const attendingUser = localStorage.getItem('sislav_current_user_name') || 'SISTEMA';
    const getDocTitle = () => {
        switch (invoice.type) {
            case InvoiceType.FACTURA: return 'FACTURA ELECTRÓNICA';
            case InvoiceType.BOLETA: return 'BOLETA ELECTRÓNICA';
            case InvoiceType.NOTA_VENTA: return 'NOTA DE VENTA';
            default: return 'COMPROBANTE';
        }
    };
    const docTitle = getDocTitle();
    const formattedDate = new Date(invoice.date).toLocaleString('sv-SE').replace('T', ' ');
    const deliveryDateObj = invoice.deliveryDate ? new Date(invoice.deliveryDate) : null;
    const deliveryDate = deliveryDateObj ? deliveryDateObj.toLocaleDateString('es-PE') : 'POR DEFINIR';
    const deliveryTime = deliveryDateObj ? deliveryDateObj.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
    const fullDeliveryInfo = deliveryDateObj ? `${deliveryDate} ${deliveryTime}` : 'POR DEFINIR';
    
    const montoLetras = numeroALetras(invoice.totals.total);
    const igvRate = company.porcentajeIgv || 18.00;

    // Assets dinámicos
    const logoUrl = config?.url_logo_ticket || company.logoUrl;
    const logoSize = config?.logo_ticket_size || 100;
    const horario = config?.horario_atencion || '';
    const politicas = config?.politicas || company.ticketPolicies || 'Gracias por su preferencia.';
    const promoImg = config?.url_imagen_promocional || '';
    
    // Barcode generation
    let barcodeUrl = '';
    if (config?.mostrar_codigo_barras !== false && invoice.ordenNumber) {
        barcodeUrl = generateBarcodeDataUrl(invoice.ordenNumber);
    }

    // Build SUNAT QR string if missing but we have a hash
    // The format is: RUC|TIPO_DOC|SERIE|CORRELATIVO|IGV|TOTAL|FECHA|TIPO_DOC_CLIENTE|NUMERO_DOC_CLIENTE|HASH|
    if ([InvoiceType.BOLETA, InvoiceType.FACTURA, InvoiceType.NOTA_CREDITO].includes(invoice.type as any) && !invoice.qrCodeData && invoice.sunatResponse?.hash) {
        const docTypeClient = invoice.client.docType === 'RUC' ? '6' : (invoice.client.docType === 'DNI' ? '1' : '0');
        const formattedDateIso = (invoice.fecha_emision || invoice.date).split('T')[0];
        
        invoice.qrCodeData = `${company.ruc}|${invoice.type}|${invoice.serie}|${invoice.correlativo}|${invoice.totals.igv.toFixed(2)}|${invoice.totals.total.toFixed(2)}|${formattedDateIso}|${docTypeClient}|${invoice.client.docNumber}|${invoice.sunatResponse.hash}|`;
    }

    // QR Code generation (LOCAL)
    let qrUrl = '';
    if ([InvoiceType.BOLETA, InvoiceType.FACTURA, InvoiceType.NOTA_CREDITO].includes(invoice.type as any)) {
        qrUrl = generateQRCodeDataUrl(invoice.qrCodeData || '');
    }

    let html = `
      <html>
        <head>
          <title>SISLAV - Impresión Directa</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { 
              margin: 0; padding: 4mm; 
              font-family: Arial, Helvetica, sans-serif; 
              width: 72mm; 
              font-size: 10pt; 
              line-height: 1.2; 
              color: #000;
              -webkit-print-color-adjust: exact;
            }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .black { font-weight: 800; }
            .divider { border-top: 2px solid #000; margin: 8px 0; }
            .divider-dashed { border-top: 2px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 8pt; }
            th { text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; font-size: 8.5pt; }
            td { padding: 3px 0; vertical-align: top; }
            .qr-code { width: 35mm; height: 35mm; margin: 6px auto; display: block; image-rendering: pixelated; }
            .barcode { width: 50mm; height: auto; margin: 6px auto; display: block; }
            .promo-banner { width: 100%; height: auto; margin-top: 5mm; border-top: 0.5px solid #000; padding-top: 2mm; }
            .logo-ticket { max-width: ${logoSize}%; height: auto; margin: 0 auto 3mm auto; display: block; }
            
            .politicas-container {
                font-size: ${config?.politicas_font_size || 7}pt;
                text-align: justify;
                margin-top: 6px;
                white-space: pre-line;
                line-height: 1.3;
            }

            /* ESTILOS ESPECÍFICOS ORDEN DE TRABAJO (MODERNO) */
            .work-order-container {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .order-number-giant { 
                font-size: 32pt; 
                font-weight: 900; 
                margin: 5px 0; 
                display: block; 
                line-height: 1;
                text-align: center;
                letter-spacing: -2px;
                word-break: break-all;
            }
            .page-break { page-break-after: always; }
            .box-header { 
                border-bottom: 4px solid #000; 
                padding: 2px 20px; 
                display: inline-block; 
                margin-bottom: 10px; 
                font-size: 11pt; 
                font-weight: normal;
                letter-spacing: 1px;
            }
            .flex-between { display: flex; justify-content: space-between; }
            .pu-row { font-size: 8pt; color: #000; padding-left: 10px; font-style: italic; }
            .hash-text { font-size: 7pt; font-family: monospace; margin: 5px 0; word-break: break-all; }
            .atendido-por { margin-top: 5px; font-size: 9pt; border-top: 1.5px solid #000; padding-top: 3px; }
            .software-footer { 
                margin-top: 15px; 
                font-size: 8.5pt; 
                font-weight: bold; 
                border-top: 1px solid #ccc;
                padding-top: 8px;
                text-transform: uppercase;
                text-align: center;
                font-family: 'Inter', sans-serif;
            }

            /* Quitar negrita de las etiquetas del ticket interno */
            .work-order-container .black:not(.order-number-giant) {
                font-weight: normal !important;
            }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
        </head>
        <body>
          <!-- TICKET DEL CLIENTE -->
          <div class="text-center">
            ${logoUrl ? `<img src="${logoUrl}" class="logo-ticket" referrerPolicy="no-referrer" />` : ''}
            <div class="bold" style="font-size: 12pt;">${company.razonSocial.toUpperCase()}</div>
            <div class="bold">RUC: ${company.ruc}</div>
            <div style="font-size: 8pt;">${company.address.toUpperCase()}</div>
            ${horario ? `<div style="font-size: 8pt; font-style: italic; margin-top: 1mm;">${horario}</div>` : ''}
            <div class="divider"></div>
            <div class="bold" style="font-size: 10pt;">${docTitle}</div>
            <div class="bold" style="font-size: 10pt;">${invoice.serie}-${String(invoice.correlativo).padStart(8, '0')}</div>
            <div style="margin-top: 4px;">Emisión: ${formattedDate}</div>
            <div class="divider"></div>
          </div>

          <div style="margin: 6px 0; font-size: 8.5pt;">
            <div>CLIENTE: ${invoice.client.name.toUpperCase()}</div>
            <div>${invoice.client.docType}: ${invoice.client.docNumber}</div>
            <div>TEL: ${invoice.client.phone || '-'}</div>
            <div>DIR: ${invoice.client.address || '-'}</div>
            <div>MONEDA: SOLES</div>
          </div>

          <div class="divider"></div>
          <table>
            <thead>
              <tr style="font-size: 8pt;">
                <th align="left">CANT.</th>
                <th align="left">DESCRIPCIÓN</th>
                <th align="right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.flatMap(item => {
                  // Canceled check
                  const isCanceled = (item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO';
                  if (isCanceled) return [];

                  // Aplicamos la misma lógica de desglose para que el ticket del cliente coincida con la base de datos
                  let detailsArray: any[] = [];
                  try {
                      const parsed = JSON.parse(item.details || '[]');
                      if (Array.isArray(parsed) && parsed.length > 0) detailsArray = parsed;
                  } catch(e) {}

                  // Solo desglosamos si la cantidad es mayor a 1 y hay múltiples detalles y NO es producto por peso
                  const isWeight = item.unitCode === 'KGM' || item.um_saas === 'KILO' || item.um_saas === 'METROS' || item.um_saas === 'LITRO' || item.unitCode === 'MTK' || item.unitCode === 'LTR';
                  if (item.quantity > 1 && detailsArray.length > 0 && !isWeight) {
                      return detailsArray.map(det => ({
                          ...item,
                          quantity: 1,
                          details: JSON.stringify([det]),
                          subtotal: item.price // Al ser 1 unidad, el subtotal es el precio
                      }));
                  }
                  return [item];
              }).map(item => `
                <tr style="border-bottom: 0.5px solid #eee; font-size: 8.5pt;">
                  <td width="15%">${item.quantity.toFixed(2)}</td>
                  <td style="text-transform: uppercase">
                    <div class="bold" style="font-size: 8pt;">${item.name}</div>
                    ${(item.details || item.color || item.defectos) ? `<div style="font-size: 7pt; font-style: italic; color: #444; margin-top: 2px; font-weight: 700;">${formatItemDetails(item, true, 'none')}</div>` : ''}
                  </td>
                  <td align="right" width="25%">${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
                <tr>
                  <td></td>
                  <td colspan="2" class="pu-row" style="font-size: 7.5pt;">P.U: ${item.price.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="divider"></div>
          <div style="margin: 4px 0;">
            <div class="flex-between"><span>Op. Gravada:</span> <span>${invoice.totals.gravada.toFixed(2)}</span></div>
            <div class="flex-between"><span>IGV (${igvRate.toFixed(0)}%):</span> <span>${invoice.totals.igv.toFixed(2)}</span></div>
            <div class="flex-between bold" style="font-size: 11pt; margin-top: 6px;">
                <span>TOTAL A PAGAR:</span> 
                <span>S/ ${invoice.totals.total.toFixed(2)}</span>
            </div>
          </div>

          <div style="margin-top: 10px; font-size: 8pt;" class="bold">
            ${montoLetras}
          </div>

          <div class="divider"></div>
          <div style="font-size: 8.5pt;">
            <div class="flex-between"><span>FORMA DE PAGO:</span> <span class="bold">${((invoice as any).paymentMethod && (invoice as any).paymentMethod !== 'undefined') ? (invoice as any).paymentMethod : (invoice.payments && invoice.payments.length > 0 ? 'MÚLTIPLE' : 'CONTADO')}</span></div>
            ${invoice.prePaymentAmount ? `
            <div class="flex-between bold"><span>PAGADO (ADELANTO):</span> <span>S/ ${invoice.prePaymentAmount.toFixed(2)}</span></div>
            <div class="flex-between bold"><span>SALDO PENDIENTE:</span> <span>S/ ${(invoice.totals.total - invoice.prePaymentAmount).toFixed(2)}</span></div>
            ` : ''}
          </div>

          ${qrUrl ? `
            <img src="${qrUrl}" class="qr-code" referrerPolicy="no-referrer" />
            <div class="text-center hash-text">HASH: ${invoice.sunatResponse?.hash || '---'}</div>
            <div class="text-center" style="font-size: 7.5pt;">Representación impresa de la ${docTitle}.<br/>Autorizado mediante Resolución de Intendencia Nro. 034-005-0005315</div>
          ` : ''}

          <div class="divider"></div>
          <div class="politicas-container">
            <div style="font-weight: 900; font-size: 11pt; margin-bottom: 1mm; text-align: center;">ORDEN: ${invoice.ordenNumber || '---'}</div>
            <div style="font-weight: 700; font-size: 9.5pt; margin-bottom: 2mm; text-align: center; border: 1px solid #000; padding: 2px;">ENTREGA ESTIMADA: ${fullDeliveryInfo}</div>
            ${politicas}
          </div>

          ${barcodeUrl ? `<img src="${barcodeUrl}" class="barcode" referrerPolicy="no-referrer" />` : ''}

          ${promoImg ? `<img src="${promoImg}" class="promo-banner" referrerPolicy="no-referrer" />` : ''}

          <div class="text-center bold" style="margin-top: 15px; font-size: 10pt;">¡VUELVA PRONTO!</div>
          
          <div class="software-footer">
            SISLAV: software para lavanderia 931200353
          </div>

          ${!clientOnly ? `
          <div class="page-break"></div>

          <!-- ORDEN DE TRABAJO (PLANTA) -->
          <div class="work-order-container">
            <div class="text-center">
              <div class="box-header">ORDEN DE TRABAJO</div>
              <div class="order-number-giant">${invoice.ordenNumber || String(invoice.correlativo).padStart(5, '0')}</div>
            </div>

            <div style="margin: 10px 0; font-size: 10.5pt;">
              <div class="black">FECHA ENTREGA: ${deliveryDate}</div>
              <div class="black" style="font-size: 13pt; margin-top: 2px;">HORA ENTREGA: ${deliveryTime}</div>
              <div class="black" style="font-size: 12pt; margin-top: 5px;">CLIENTE: ${invoice.client.name.toUpperCase()}</div>
              <div class="black" style="font-size: 11pt; margin-top: 2px;">TELÉFONO: ${invoice.client.phone || '-'}</div>
              <div class="atendido-por">
                <span class="black" style="font-size: 9pt;">ATENDIDO POR:</span>
                <span style="font-size: 10pt; font-weight: normal;">${attendingUser.toUpperCase()}</span>
              </div>
            </div>

            <div class="divider" style="border-top-width: 2px; margin: 5px 0;"></div>
            <div class="black" style="margin-bottom: 8px; font-size: 10pt; text-transform: uppercase;">Detalle de Prendas:</div>
            
            <table style="font-size: 11pt;">
              <tbody>
                ${invoice.items.flatMap(item => {
                    // Canceled check
                    const isCanceled = (item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO';
                    if (isCanceled) return [];

                    // Lógica de desglose para el ticket de planta
                    let detailsArray: any[] = [];
                    try {
                        const parsed = JSON.parse(item.details || '[]');
                        if (Array.isArray(parsed) && parsed.length > 0) detailsArray = parsed;
                    } catch(e) {}

                    // Solo desglosamos si la cantidad es mayor a 1 y hay múltiples detalles y NO es un producto por peso
                    const isWeightOrder = item.unitCode === 'KGM' || item.um_saas === 'KILO' || item.um_saas === 'METROS' || item.um_saas === 'LITRO' || item.unitCode === 'MTK' || item.unitCode === 'LTR';
                    if (item.quantity > 1 && detailsArray.length > 0 && !isWeightOrder) {
                        return detailsArray.map(det => ({
                            ...item,
                            quantity: 1,
                            details: JSON.stringify([det]) // Envolvemos en array para que formatItemDetails lo procese
                        }));
                    }
                    return [item];
                }).map(item => `
                  <tr style="border-bottom: 1px solid #000">
                    <td width="20%" class="black" style="font-size: 17pt; padding: 10px 0; font-weight: normal !important;">${item.quantity.toFixed(2)}</td>
                    <td style="padding: 10px 0;">
                      <div class="black" style="font-size: 11pt; font-weight: normal !important; display: flex; justify-content: space-between;">
                        <span>${item.name.toUpperCase()}</span>
                        <span>S/ ${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      ${(item.details || item.color || item.defectos || (item.images && item.images.length > 0) || (item as any).url_foto_1 || item.audioNote) ? `<div style="font-size: 8pt; font-weight: normal; font-style: italic; background: #f0f0f0; padding: 5px; margin-top: 5px; border-left: 5px solid #000;">${formatItemDetails(item, true, 'icons')}</div>` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div style="margin-top: 10px; border: 2px solid #000; padding: 8px;">
                <div style="display: flex; justify-content: space-between; font-size: 11pt; font-weight: bold;">
                    <span>TOTAL SERVICIOS:</span>
                    <span>S/ ${invoice.totals.total.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 10pt; margin-top: 2px;">
                    <span>PAGADO (ADELANTO):</span>
                    <span>S/ ${(invoice.prePaymentAmount || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 9pt; margin-top: 2px; color: #444; font-style: italic;">
                    <span>MÉTODO DE PAGO:</span>
                    <span>${((invoice as any).paymentMethod && (invoice as any).paymentMethod !== 'undefined') ? (invoice as any).paymentMethod : (invoice.payments && invoice.payments.length > 0 ? 'MÚLTIPLE' : 'EFECTIVO')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12pt; font-weight: 900; margin-top: 4px; border-top: 2px solid #000; padding-top: 4px;">
                    <span>SALDO PENDIENTE:</span>
                    <span>S/ ${(invoice.totals.total - (invoice.prePaymentAmount || 0)).toFixed(2)}</span>
                </div>
            </div>

            <div style="margin-top: 15px;">
              <div class="black" style="font-size: 10pt; text-transform: uppercase;">Observaciones:</div>
              <div style="min-height: 40px; border-top: 1.5px dashed #000; padding-top: 5px; margin-top: 3px; font-size: 9.5pt; font-style: italic; font-weight: normal;">
                  ${invoice.notes || 'SIN OBSERVACIONES ADICIONALES.'}
              </div>
            </div>

            ${barcodeUrl ? `<img src="${barcodeUrl}" class="barcode" style="width: 40mm;" referrerPolicy="no-referrer" />` : ''}
            
            <div style="margin-top: 35px; border-top: 1.5px solid #000; padding-top: 10px; text-align: center; font-size: 8pt; font-weight: normal; opacity: 0.9;">
              SISTEMA DE GESTIÓN SISLAV
            </div>
          </div>` : ''}
        </body>
      </html>
    `;

    const doc = iframe.contentWindow?.document;
    if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        
        // Un respiro para renderizado y luego impresión
        setTimeout(() => {
            try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            } catch (e) {
                console.error("Error al intentar imprimir (Posible bloqueo de sandbox):", e);
                // Si falla por el sandbox de AI Studio, informamos al usuario de forma amigable
                alert("⚠️ LA IMPRESIÓN FUE BLOQUEADA POR EL NAVEGADOR:\n\nDebido a restricciones de seguridad en la previsualización, para IMPRIMIR de verdad debe abrir el sistema en una PESTAÑA NUEVA usando el botón azul 'OPEN IN NEW TAB' en la esquina superior derecha.");
            }
        }, 300);
    }
};

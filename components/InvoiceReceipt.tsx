import React, { useEffect, useState } from 'react';
import { Invoice, InvoiceType, Company } from '../types';
import { Loader2, Printer, X, FileText, Download } from 'lucide-react';
import { generateInternalPDFBlob } from '../services/whatsappService';
import { dbGetTicketConfig } from '../services/dbService';
import bwipjs from 'bwip-js';

interface InvoiceReceiptProps {
    invoice: Invoice;
    company: Company;
    onClose: () => void;
    hideInternalOrder?: boolean;
    downloadOnly?: boolean;
    isTrackingView?: boolean;
}

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

const InvoiceReceipt: React.FC<InvoiceReceiptProps> = ({ invoice, company, onClose, hideInternalOrder = false, downloadOnly = false, isTrackingView = false }) => {
    const [ticketConfig, setTicketConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [barcodeUrl, setBarcodeUrl] = useState<string>('');
    const brandPrimary = document.documentElement.style.getPropertyValue('--brand-primary').trim() || '#0054A6';

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

    useEffect(() => {
        // Generar siempre si no está explícitamente desactivado
        if (ticketConfig?.mostrar_codigo_barras !== false && invoice.ordenNumber) {
            const url = generateBarcodeDataUrl(invoice.ordenNumber);
            setBarcodeUrl(url);
        } else {
            setBarcodeUrl('');
        }
    }, [ticketConfig?.mostrar_codigo_barras, invoice.ordenNumber]);

    useEffect(() => {
        const loadConfigAndPrint = async () => {
            try {
                const config = await dbGetTicketConfig(company.id);
                setTicketConfig(config);
                
                // Generate barcode URL immediately for the print to avoid race condition with state
                let currentBarcodeUrl = '';
                if (config?.mostrar_codigo_barras !== false && invoice.ordenNumber) {
                    currentBarcodeUrl = generateBarcodeDataUrl(invoice.ordenNumber);
                }

            } catch (e) {
                // Silenciosamente fallar si no hay config
            } finally {
                setIsLoading(false);
            }
        };
        loadConfigAndPrint();
    }, [downloadOnly]);

    const isElectronic = [InvoiceType.BOLETA, InvoiceType.FACTURA].includes(invoice.type);

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

                return parsed.map((unit: any, idx: number) => {
                    const color = unit.color ? `Color: ${unit.color}` : '';
                    const obs = (unit.details || unit.observaciones) ? ` - Obs: ${unit.details || unit.observaciones}` : '';
                    const multimedia = getItemMeta(unit);
                    
                    if (hidePrefix && parsed.length === 1) {
                        const result = `${color}${obs}${multimedia}`.trim();
                        return result.startsWith(' - ') ? result.substring(3) : result;
                    }
                    
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

    const handlePrint = async (config: any, overrideBarcodeUrl?: string) => {
        try {
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert("Por favor, permita las ventanas emergentes para imprimir los tickets.");
                onClose();
                return;
            }

        const attendingUser = localStorage.getItem('sislav_current_user_name') || 'SISTEMA';
        const docTitle = getDocTitle();
        const formattedDate = new Date(invoice.date).toLocaleString('sv-SE').replace('T', ' ');
        const formattedEmissionDate = invoice.fecha_emision ? new Date(invoice.fecha_emision).toLocaleString('sv-SE').replace('T', ' ') : null;
        const deliveryDateObj = invoice.deliveryDate ? new Date(invoice.deliveryDate) : null;
        const deliveryDate = deliveryDateObj ? deliveryDateObj.toLocaleDateString('es-PE') : 'POR DEFINIR';
        const deliveryTime = deliveryDateObj ? deliveryDateObj.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
        const fullDeliveryInfo = deliveryDateObj ? `${deliveryDate} ${deliveryTime}` : 'POR DEFINIR';
        const montoLetras = numeroALetras(invoice.totals.total);
        const igvRate = company.porcentajeIgv || 18.00;
        const activeBarcodeUrl = overrideBarcodeUrl || barcodeUrl;

        // Assets dinámicos
        const logoUrl = config?.url_logo_ticket || company.logoUrl;
        const logoSize = config?.logo_ticket_size || 100;
        const horario = config?.horario_atencion || '';
        const politicas = config?.politicas || company.ticketPolicies || 'Gracias por su preferencia.';
        const promoImg = config?.url_imagen_promocional || '';

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
            table { width: 100%; border-collapse: collapse; margin: 6px 0; }
            td { padding: 3px 0; vertical-align: top; }
            .qr-code { width: 40mm; height: 40mm; margin: 8px auto; display: block; }
            .barcode { width: 55mm; height: auto; margin: 8px auto; display: block; }
            .promo-banner { width: 100%; height: auto; margin-top: 5mm; border-top: 1px solid #000; padding-top: 2mm; }
            .logo-ticket { max-width: ${logoSize}%; height: auto; margin: 0 auto 4mm auto; display: block; }
            
            .politicas-container {
                font-size: ${config?.politicas_font_size || 7}pt;
                text-align: justify;
                margin-top: 8px;
                white-space: pre-line;
                line-height: 1.2;
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
                line-height: 1.1;
                text-align: center;
                letter-spacing: -2px;
                word-break: break-all;
            }
            .page-break { page-break-after: always; }
            .box-header { 
                border-bottom: 5px solid #000; 
                padding: 2px 20px; 
                display: inline-block; 
                margin-bottom: 12px; 
                font-size: 11pt; 
                font-weight: bold;
                letter-spacing: 1px;
            }
            .flex-between { display: flex; justify-content: space-between; }
            .pu-row { font-size: 10pt; color: #000; padding-left: 10px; font-weight: bold; }
            .hash-text { font-size: 8pt; font-family: monospace; margin: 5px 0; word-break: break-all; }
            .atendido-por { margin-top: 8px; font-size: 10pt; border-top: 2px solid #000; padding-top: 4px; }
            .software-footer { 
                margin-top: 18px; 
                font-size: 9pt; 
                font-weight: bold; 
                border-top: 1px solid #000;
                padding-top: 10px;
                text-transform: uppercase;
                text-align: center;
                font-family: Arial, sans-serif;
            }

            /* Quitar negrita de las etiquetas del ticket interno */
            .work-order-container .black:not(.order-number-giant) {
                font-weight: normal !important;
            }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
        </head>
        <body>
          <!-- TICKET DEL CLIENTE (FORMATO ANTERIOR) -->
          <div class="text-center">
            ${logoUrl ? `<img src="${logoUrl}" class="logo-ticket" referrerPolicy="no-referrer" />` : ''}
            <div class="bold" style="font-size: 12pt;">${company.razonSocial.toUpperCase()}</div>
            <div class="bold">RUC: ${company.ruc}</div>
            <div style="font-size: 8pt;">${company.address.toUpperCase()}</div>
            ${horario ? `<div style="font-size: 8pt; font-style: italic; margin-top: 1mm;">${horario}</div>` : ''}
            <div class="divider"></div>
            <div class="bold" style="font-size: 10pt;">${docTitle}</div>
            <div class="bold" style="font-size: 10pt;">${invoice.serie}-${String(invoice.correlativo).padStart(8, '0')}</div>
            <div style="margin-top: 4px;">F. Venta: ${formattedDate}</div>
            ${formattedEmissionDate ? `<div style="margin-top: 2px;">F. Emisión: ${formattedEmissionDate}</div>` : ''}
            <div class="divider"></div>
          </div>

          <div style="margin: 8px 0; font-size: 10pt;" class="bold">
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
              ${invoice.items.filter(item => !((item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO')).map(item => `
                <tr style="font-size: 8.5pt;">
                  <td width="15%">${item.quantity.toFixed(2)}</td>
                  <td style="text-transform: uppercase">
                    ${item.name}
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

          ${isElectronic ? `
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoice.qrCodeData || '')}" class="qr-code" referrerPolicy="no-referrer" />
            <div class="text-center hash-text">HASH: ${invoice.sunatResponse?.hash || '---'}</div>
            <div class="text-center" style="font-size: 7.5pt;">Representación impresa de la ${docTitle}.<br/>Autorizado mediante Resolución de Intendencia Nro. 034-005-0005315</div>
          ` : ''}

          <div class="divider"></div>
          <div class="politicas-container">
            <div style="font-weight: 900; font-size: 11pt; margin-bottom: 1mm; text-align: center;">ORDEN: ${invoice.ordenNumber || '---'}</div>
            <div style="font-weight: 700; font-size: 9.5pt; margin-bottom: 2mm; text-align: center; border: 1px solid #000; padding: 2px;">ENTREGA ESTIMADA: ${fullDeliveryInfo}</div>
            ${politicas}
          </div>

          ${activeBarcodeUrl ? `<img src="${activeBarcodeUrl}" class="barcode" referrerPolicy="no-referrer" />` : ''}

          ${promoImg ? `<img src="${promoImg}" class="promo-banner" referrerPolicy="no-referrer" />` : ''}

          <div class="text-center bold" style="margin-top: 15px; font-size: 10pt;">¡VUELVA PRONTO!</div>
          
          <div class="software-footer">
            SISLAV: software para lavanderia 931200353
          </div>
        `;

        if (!hideInternalOrder) {
            html += `
          <div class="page-break"></div>

          <!-- ORDEN DE TRABAJO (PLANTA - FORMATO MODERNO) -->
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
                ${invoice.items.filter(item => !((item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO')).map(item => `
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

            <div style="margin-top: 10px; border: 1px solid #000; padding: 8px;">
                <div style="display: flex; justify-content: space-between; font-size: 11pt; font-weight: bold;">
                    <span>TOTAL SERVICIOS:</span>
                    <span>S/ ${invoice.totals.total.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 10pt; margin-top: 2px;">
                    <span>PAGADO / ADELANTO:</span>
                    <span>S/ ${(invoice.prePaymentAmount || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 9pt; margin-top: 2px; color: #444; font-style: italic;">
                    <span>MÉTODO DE PAGO:</span>
                    <span>${((invoice as any).paymentMethod && (invoice as any).paymentMethod !== 'undefined') ? (invoice as any).paymentMethod : (invoice.payments && invoice.payments.length > 0 ? 'MÚLTIPLE' : 'EFECTIVO')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11pt; font-weight: 900; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px;">
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

            ${activeBarcodeUrl ? `<img src="${activeBarcodeUrl}" class="barcode" style="width: 40mm;" referrerPolicy="no-referrer" />` : ''}
            
            <div style="margin-top: 35px; border-top: 1.5px solid #000; padding-top: 10px; text-align: center; font-size: 8pt; font-weight: normal; opacity: 0.9;">
              SISTEMA DE GESTIÓN SISLAV
            </div>
          </div>
        `;
        }

        html += `
          <script>
            window.onload = function() { 
                window.focus();
                window.print(); 
                setTimeout(function() { window.close(); }, 500); 
            };
          </script>
        </body>
      </html>
        `;

                printWindow.document.write(html);
                printWindow.document.close();
        } catch (e) {
            console.error("Error in handlePrint:", e);
        }
    };

    const handleDownloadPDF = async () => {
        setIsGeneratingPDF(true);
        try {
            if (invoice.sunatResponse?.pdfUrl) {
                window.open(invoice.sunatResponse.pdfUrl, '_blank');
            } else {
                const blob = await generateInternalPDFBlob(invoice, company);
                const url = URL.createObjectURL(blob);
                
                // On mobile, window.open blob url works better sometimes
                // but a hidden link click is more universal for downloads
                const a = document.createElement('a');
                a.href = url;
                a.download = `TICKET-${invoice.serie}-${invoice.correlativo}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (e) {
            console.error("Error generating PDF:", e);
            alert("No se pudo generar el PDF regionalmente.");
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const getDocTitle = () => {
        switch (invoice.type) {
            case InvoiceType.FACTURA: return 'FACTURA ELECTRÓNICA';
            case InvoiceType.BOLETA: return 'BOLETA ELECTRÓNICA';
            case InvoiceType.NOTA_VENTA: return 'NOTA DE VENTA';
            default: return 'COMPROBANTE';
        }
    };

    const igvRate = company.porcentajeIgv || 18.00;
    const docTitle = getDocTitle();
    const formattedDate = new Date(invoice.date).toLocaleString('sv-SE').replace('T', ' ');
    const deliveryDateObj = invoice.deliveryDate ? new Date(invoice.deliveryDate) : null;
    const fullDeliveryInfo = deliveryDateObj 
        ? `${deliveryDateObj.toLocaleDateString('es-PE')} ${deliveryDateObj.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}` 
        : 'POR DEFINIR';
        
    const montoLetras = numeroALetras(invoice.totals.total);

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-slate-900/90 z-[2000] flex items-center justify-center backdrop-blur-md">
                <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center text-center max-w-sm animate-in zoom-in-95">
                    <div style={{ backgroundColor: brandPrimary }} className="p-6 rounded-full mb-8 shadow-xl">
                        <Printer size={64} className="text-white animate-pulse" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 uppercase tracking-tight mb-2">Preparando Ticket...</h3>
                    <div className="mt-8 flex items-center gap-2" style={{ color: brandPrimary }}>
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-[9px] font-bold uppercase tracking-widest">Cargando configuración</span>
                    </div>
                </div>
            </div>
        );
    }

    if (isTrackingView) {
        return (
            <div className="fixed inset-0 bg-slate-100 z-[2000] flex flex-col items-center pt-1 pb-10 px-0 overflow-y-auto">
                <div className="w-full max-w-[400px] animate-in zoom-in-95 duration-300 relative px-2">
                    {/* Boton X Flotante */}
                    <button 
                        onClick={onClose} 
                        className="fixed top-4 right-4 z-[2100] bg-white text-slate-400 p-3 rounded-full shadow-lg hover:text-red-500 transition-all active:scale-95 border border-slate-200 flex items-center justify-center"
                    >
                        <X size={20} />
                    </button>

                    <div className="bg-white shadow-[0_0_20px_rgba(0,0,0,0.05)] border border-slate-200 flex flex-col min-h-screen sm:min-h-0 sm:rounded-lg">
                        <div className="p-6 font-mono text-[12px] leading-relaxed text-black">
                            {/* Header exacto como la imagen */}
                            <div className="text-center mb-4">
                                {ticketConfig?.url_logo_ticket && (
                                    <div className="flex justify-center mb-4">
                                        <img 
                                            src={ticketConfig.url_logo_ticket} 
                                            className="max-w-[140px] h-auto" 
                                            referrerPolicy="no-referrer" 
                                        />
                                    </div>
                                )}
                                <div className="font-bold text-base mb-1 tracking-tight leading-tight">{company.razonSocial.toUpperCase()}</div>
                                <div className="font-bold text-[11px] mb-0.5">RUC: {company.ruc}</div>
                                <div className="text-[10px] text-slate-700 leading-tight mb-0.5 uppercase">{company.address.toUpperCase()}</div>
                                {ticketConfig?.horario_atencion && (
                                    <div className="text-[9px] italic text-slate-600 mb-1 leading-tight uppercase font-bold">
                                        {ticketConfig.horario_atencion}
                                    </div>
                                )}
                                
                                <div className="border-t-[1.5px] border-black my-3"></div>
                                
                                <div className="font-black text-[13px] tracking-normal mb-0.5 uppercase">{docTitle}</div>
                                <div className="font-black text-[14px] mb-1">{invoice.serie}-{String(invoice.correlativo).padStart(8, '0')}</div>
                                <div className="text-[10px] uppercase">Emisión: {formattedDate}</div>
                                
                                <div className="border-t-[1.5px] border-black my-3"></div>
                            </div>

                            {/* Info Cliente */}
                            <div className="mb-4 space-y-0.5 text-[10.5px]">
                                <div className="flex justify-start gap-2"><span>CLIENTE:</span> <span className="font-bold uppercase">{invoice.client.name.toUpperCase()}</span></div>
                                <div className="flex justify-start gap-2"><span>{invoice.client.docType === 'DNI' ? '<' : invoice.client.docType}:</span> <span className="font-bold">{invoice.client.docNumber}</span></div>
                                <div className="flex justify-start gap-2"><span>TEL:</span> <span className="font-bold">{invoice.client.phone || '-'}</span></div>
                                <div className="flex justify-start gap-2"><span>DIR:</span> <span className="font-bold uppercase">{invoice.client.address || '-'}</span></div>
                                <div className="flex justify-start gap-2"><span>MONEDA:</span> <span className="font-bold">SOLES</span></div>
                            </div>

                            {/* Tabla de Items */}
                            <div className="border-t-[1.5px] border-black mb-1"></div>
                            <table className="w-full mb-2">
                                <thead>
                                    <tr className="text-[10.5px] font-bold border-b border-black">
                                        <th className="text-left py-1 w-[15%]">CANT.</th>
                                        <th className="text-left py-1">DESCRIPCIÓN</th>
                                        <th className="text-right py-1 w-[20%]">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="">
                                    {invoice.items.filter(item => !((item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO')).map((item, idx) => (
                                        <React.Fragment key={idx}>
                                            <tr className="align-top text-[11px] font-medium">
                                                <td className="py-1 pr-1">{item.quantity.toFixed(2)}</td>
                                                <td className="py-1 uppercase leading-tight font-black tracking-tight">
                                                    {item.name}
                                                </td>
                                                <td className="py-1 text-right">{(item.price * item.quantity).toFixed(2)}</td>
                                            </tr>
                                            <tr>
                                                <td></td>
                                                <td colSpan={2} className="text-[9.5px] italic pb-1 pl-4 font-bold">
                                                    P.U: {item.price.toFixed(2)}
                                                    {(item.details || item.color || item.defectos) && (
                                                        <div className="text-[8.5px] mt-0.5 text-slate-700 leading-tight not-italic font-bold">
                                                            {formatItemDetails(item, true, 'none')}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>

                            {/* Totales */}
                            <div className="border-t-[1.5px] border-black my-2 pt-1">
                                <div className="flex justify-between text-[11px]"><span>Op. Gravada:</span> <span className="font-bold">{invoice.totals.gravada.toFixed(2)}</span></div>
                                <div className="flex justify-between text-[11px]"><span>IGV (18%):</span> <span className="font-bold">{invoice.totals.igv.toFixed(2)}</span></div>
                                <div className="flex justify-between text-[14px] font-black mt-1">
                                    <span>TOTAL A PAGAR:</span> 
                                    <span>S/ {invoice.totals.total.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="mt-4 font-black text-[10px] leading-tight uppercase">{montoLetras}</div>
                            
                            <div className="border-t-[1.5px] border-black my-3"></div>
                            
                            {/* Métodos de Pago */}
                            <div className="space-y-0.5 text-[10.5px]">
                                <div className="flex justify-between"><span>FORMA DE PAGO:</span> <span className="font-bold uppercase">MÚLTIPLE</span></div>
                                {invoice.prePaymentAmount ? (
                                    <>
                                        <div className="flex justify-between font-bold"><span>PAGADO (ADELANTO):</span> <span>S/ {invoice.prePaymentAmount.toFixed(2)}</span></div>
                                        <div className="flex justify-between font-bold"><span>SALDO PENDIENTE:</span> <span>S/ {(invoice.totals.total - invoice.prePaymentAmount).toFixed(2)}</span></div>
                                    </>
                                ) : (
                                    <div className="flex justify-between font-bold"><span>PAGADO:</span> <span>S/ {invoice.totals.total.toFixed(2)}</span></div>
                                )}
                            </div>

                            {/* QR y HASH como en la imagen */}
                            {invoice.qrCodeData && (
                                <div className="mt-4 flex flex-col items-center">
                                    <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invoice.qrCodeData)}`} 
                                        className="w-[140px] h-[140px]" 
                                        alt="Sunat QR" 
                                        referrerPolicy="no-referrer"
                                    />
                                    <div className="text-[8.5px] font-black mt-1 text-center font-mono">HASH: {invoice.sunatResponse?.hash || '---'}</div>
                                    
                                    <div className="text-center text-[8.5px] mt-4 leading-tight font-medium max-w-[280px] mx-auto uppercase">
                                        Representación impresa de la {docTitle}.<br/>
                                        Autorizado mediante Resolución de Intendencia Nro. 034-005-0005315
                                    </div>
                                </div>
                            )}

                            <div className="border-t-[1.5px] border-black my-4"></div>

                            {/* Otras políticas o info */}
                            <div className="text-center mb-4 p-2 border border-slate-200">
                                <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Entrega Estimada</div>
                                <div className="text-[12px] font-black tracking-tight">{fullDeliveryInfo}</div>
                            </div>

                            <div className="text-[9.5px] text-center leading-tight italic font-bold">
                                {ticketConfig?.politicas || company.ticketPolicies || 'Gracias por su preferencia.'}
                            </div>
                            
                            <div className="text-center font-black mt-8 text-slate-300 text-[10px] tracking-[0.2em] uppercase">
                                SISLAV: software para lavanderia 931200353
                            </div>
                        </div>
                    </div>

                    {/* Botón de Descarga Persistente */}
                    <div className="my-6 px-4">
                        <button 
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl"
                        >
                            {isGeneratingPDF ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} 
                            {isGeneratingPDF ? 'Generando PDF...' : 'Descargar en PDF'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-950/95 z-[2000] flex items-center justify-center p-0 md:p-4 backdrop-blur-xl overflow-y-auto">
            <div className="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-[3rem] shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200"><Printer size={24} strokeWidth={2.5} /></div>
                        <div>
                            <h3 className="font-bold text-xl text-slate-900 uppercase tracking-tight leading-none mb-1">Comprobante de Venta</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{docTitle} #{invoice.serie}-{invoice.correlativo}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-full transition-all text-slate-400 hover:text-slate-900 active:scale-90"><X size={32} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-slate-100/50 flex justify-center items-start">
                    <div className="bg-white p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-slate-200 rounded-2xl w-full max-w-[380px] font-mono text-[12px] leading-relaxed text-black relative">
                        {/* Decorative ticket edge */}
                        <div className="absolute -top-2 left-4 right-4 h-4 bg-white rounded-full blur-sm opacity-50"></div>
                        
                        <div className="text-center mb-6">
                            {ticketConfig?.url_logo_ticket && <img src={ticketConfig.url_logo_ticket} className="max-w-[120px] mx-auto mb-4" />}
                            <div className="font-bold text-base mb-1">{company.razonSocial.toUpperCase()}</div>
                            <div className="text-[10px] text-slate-600 mb-1">RUC: {company.ruc}</div>
                            <div className="text-[10px] text-slate-500 leading-tight">{company.address.toUpperCase()}</div>
                            <div className="border-t-2 border-black border-dashed my-4"></div>
                            <div className="font-bold text-sm tracking-widest">{docTitle}</div>
                            <div className="font-bold text-base">{invoice.serie}-{String(invoice.correlativo).padStart(8, '0')}</div>
                            <div className="text-[10px] mt-1">FECHA: {formattedDate}</div>
                            <div className="border-t-2 border-black border-dashed my-4"></div>
                        </div>

                        <div className="mb-6 space-y-1">
                            <div className="flex justify-between"><span>CLIENTE:</span> <span className="font-bold">{invoice.client.name.toUpperCase()}</span></div>
                            <div className="flex justify-between"><span>{invoice.client.docType}:</span> <span className="font-bold">{invoice.client.docNumber}</span></div>
                            <div className="flex justify-between"><span>TEL:</span> <span className="font-bold">{invoice.client.phone || '-'}</span></div>
                        </div>

                        <div className="border-t border-black my-2"></div>
                        <table className="w-full mb-4">
                            <thead>
                                <tr className="border-b-2 border-black text-[10px]">
                                    <th className="text-left py-1">CANT</th>
                                    <th className="text-left py-1">DESCRIPCIÓN</th>
                                    <th className="text-right py-1">TOTAL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {invoice.items.filter(item => !((item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO')).map((item, idx) => (
                                    <tr key={idx} className="align-top">
                                        <td className="py-2 pr-2 font-bold">{item.quantity.toFixed(1)}</td>
                                        <td className="py-2 uppercase text-[11px] leading-tight">
                                            {item.name}
                                            {(item.details || item.color || item.defectos) && <div className="text-[9px] text-slate-500 mt-1 italic leading-none">{formatItemDetails(item, true, 'none')}</div>}
                                        </td>
                                        <td className="py-2 text-right font-bold">{(item.price * item.quantity).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="border-t-2 border-black border-dashed my-4"></div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-slate-600"><span>Op. Gravada:</span> <span>{invoice.totals.gravada.toFixed(2)}</span></div>
                            <div className="flex justify-between text-slate-600"><span>IGV ({igvRate}%):</span> <span>{invoice.totals.igv.toFixed(2)}</span></div>
                            <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-100"><span>TOTAL:</span> <span>S/ {invoice.totals.total.toFixed(2)}</span></div>
                        </div>

                        <div className="mt-6 font-bold text-[10px] leading-tight text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">{montoLetras}</div>
                        
                        <div className="border-t-2 border-black border-dashed my-6"></div>
                        
                        <div className="text-center mb-4 border-2 border-black p-2 rounded-lg bg-slate-50">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Entrega Estimada</div>
                            <div className="text-sm font-black text-slate-900">{fullDeliveryInfo}</div>
                        </div>

                        <div className="text-left text-justify text-[10px] italic leading-relaxed text-slate-600 whitespace-pre-line px-1" style={{ textAlign: 'justify' }}>
                            {ticketConfig?.politicas || company.ticketPolicies || 'Gracias por su preferencia.'}
                        </div>
                        
                        {barcodeUrl && (
                            <div className="mt-4 flex flex-col items-center">
                                <img src={barcodeUrl} className="max-w-[200px] h-auto" alt="Barcode" />
                            </div>
                        )}

                        <div className="text-center font-bold mt-6 tracking-[0.3em] text-slate-400">¡VUELVA PRONTO!</div>
                    </div>
                </div>

                <div className="p-8 border-t border-slate-100 bg-white shrink-0 flex flex-col md:flex-row gap-4">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-[2rem] font-bold text-sm uppercase tracking-[0.2em] transition-all active:scale-95"
                    >
                        Nueva Venta
                    </button>
                    
                    <button 
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPDF}
                        className="flex-1 py-5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-[2rem] font-bold text-sm uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-3 border-2 border-indigo-100"
                    >
                        {isGeneratingPDF ? <Loader2 size={24} className="animate-spin" /> : <FileText size={24} strokeWidth={2.5} />} 
                        {invoice.sunatResponse?.pdfUrl ? 'PDF Sunat' : 'Ver PDF'}
                    </button>

                    <button 
                        onClick={() => handlePrint(ticketConfig, barcodeUrl)}
                        className="flex-[1.5] py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-bold text-sm uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                        <Printer size={24} strokeWidth={3} /> Imprimir Ticket
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InvoiceReceipt;
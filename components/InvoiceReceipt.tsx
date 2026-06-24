import React, { useEffect, useState } from 'react';
import { Invoice, InvoiceType, Company } from '../types';
import { Loader2, Printer, X, FileText, Download, Clock } from 'lucide-react';
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

const formatPolicies = (policiesText: string) => {
    if (!policiesText) return null;
    
    // Normalize and clean up text
    const lines = policiesText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
        
    if (lines.length === 0) return null;
    
    return (
        <div className="text-[10px] text-justify leading-relaxed font-bold uppercase space-y-2.5 mt-5 border-t border-dashed border-gray-350 pt-4 text-slate-900 w-full">
            {lines.map((line, idx) => {
                // If it looks like a title/header (ends with ":" or includes "CONDICIONES" or "POLITICAS")
                const isHeader = (line.endsWith(':') || line.toLowerCase().includes('condiciones') || line.toLowerCase().includes('políticas')) && line.length < 50;
                
                // Check if it starts with a list bullet/number (e.g. "1.", "-", "*", "•")
                const listPrefixMatch = line.match(/^(\d+\.|\-|\*|•)\s*(.*)$/);
                
                if (isHeader) {
                    return (
                        <div key={idx} className="text-center font-extrabold text-[11px] tracking-wide mb-2 text-slate-950 border-b border-gray-150 pb-1 mt-3">
                            {line}
                        </div>
                    );
                }
                
                if (listPrefixMatch) {
                    const prefix = listPrefixMatch[1];
                    const content = listPrefixMatch[2];
                    return (
                        <div key={idx} className="flex gap-2 text-justify items-start leading-snug w-full">
                            <span className="text-slate-950 font-extrabold shrink-0 select-none">
                                {prefix === '-' || prefix === '*' || prefix === '•' ? '•' : prefix}
                            </span>
                            <span className="flex-1 text-justify break-words">{content}</span>
                        </div>
                    );
                }
                
                // Regular line
                return (
                    <p key={idx} className="text-justify break-words leading-snug w-full">
                        {line}
                    </p>
                );
            })}
        </div>
    );
};

const InvoiceReceipt: React.FC<InvoiceReceiptProps> = ({ invoice, company, onClose, hideInternalOrder = false, downloadOnly = false, isTrackingView = false }) => {
    const [ticketConfig, setTicketConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [barcodeUrl, setBarcodeUrl] = useState<string>('');
    const brandPrimary = document.documentElement.style.getPropertyValue('--brand-primary').trim() || '#0054A6';

    const uniquePaymentMethods = invoice.payments && invoice.payments.length > 0 
      ? Array.from(new Set(invoice.payments.map((p: any) => (p.metodo_pago_name || p.metodos_pago?.nombre || 'EFECTIVO').trim().toUpperCase()).filter(Boolean))) 
      : [];
    const paymentMethodText = ((invoice as any).paymentMethod && (invoice as any).paymentMethod !== 'undefined' && String((invoice as any).paymentMethod).trim() !== '') 
      ? (invoice as any).paymentMethod 
      : (uniquePaymentMethods.length === 1 ? uniquePaymentMethods[0] : (uniquePaymentMethods.length > 1 ? 'MÚLTIPLE' : 'CONTADO'));

    const paymentMethodTextEfectivo = ((invoice as any).paymentMethod && (invoice as any).paymentMethod !== 'undefined' && String((invoice as any).paymentMethod).trim() !== '') 
      ? (invoice as any).paymentMethod 
      : (uniquePaymentMethods.length === 1 ? uniquePaymentMethods[0] : (uniquePaymentMethods.length > 1 ? 'MÚLTIPLE' : 'EFECTIVO'));

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

    const isElectronic = [InvoiceType.BOLETA, InvoiceType.FACTURA].includes(invoice.type) || 
                         invoice.type === '01' || 
                         invoice.type === '03' || 
                         String(invoice.type || '').toUpperCase() === 'BOLETA' || 
                         String(invoice.type || '').toUpperCase() === 'FACTURA';

    const formatItemDetails = (item: any, hidePrefix = false, displayMetaInput: 'none' | 'icons' | 'all' = 'all') => {
        // Safe override: always promote 'none' to 'all' to ensure maximum service details are rendered for customers
        const displayMeta = displayMetaInput === 'none' ? 'all' : displayMetaInput;
        if (!item) return '';
        const details = typeof item === 'string' ? item : (item.details || item.observaciones || '');
        
        try {
            const parsed = JSON.parse(details);
            if (Array.isArray(parsed)) {
                if (parsed.length === 0) return '';
                const getItemMeta = (unit: any) => {
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
            const hasImages = (item.images && item.images.length > 0) || (item.url_foto_1) || (item.url_foto_2) || (item.url_foto_3);
            const hasAudio = !!(item.audioNote || item.url_audio);
            if (hasImages) multimedia += displayMeta === 'all' ? ' 📷 [FOTO]' : ' 📷';
            if (hasAudio) multimedia += displayMeta === 'all' ? ' 🎤 [AUDIO]' : ' 🎤';
            
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
              line-height: 1.25; 
              color: #000;
              -webkit-print-color-adjust: exact;
              text-transform: uppercase;
            }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .black { font-weight: 800; }
            .divider-thick { border-top: 2px solid #000; margin: 8px 0; }
            .divider-thin { border-top: 1px solid #e5e7eb; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin: 6px 0; }
            td { padding: 3px 0; vertical-align: top; }
            .qr-code { width: 40mm; height: 40mm; margin: 8px auto; display: block; filter: grayscale(100%); }
            .barcode { width: 55mm; height: auto; margin: 8px auto; display: block; filter: grayscale(100%); }
            .logo-ticket { max-width: ${logoSize}%; height: auto; margin: 0 auto 4mm auto; display: block; filter: grayscale(100%); }
            
            .politicas-container {
                font-size: ${config?.politicas_font_size || 8}pt;
                text-align: justify;
                margin-top: 8px;
                white-space: pre-line;
                line-height: 1.2;
                font-style: italic;
                font-weight: bold;
            }

            .flex-between { display: flex; justify-content: space-between; }
            .item-total { font-weight: bold; text-align: right; }
            .pu-row { font-size: 8.5pt; color: #444; font-style: italic; }
            .hash-text { font-size: 8pt; font-family: monospace; margin: 5px 0; word-break: break-all; color: #666; }
            .footer-text { font-size: 8.5pt; color: #999; font-weight: bold; margin-top: 15px; }

            .page-break { page-break-after: always; }
          </style>
        </head>
        <body>
          <!-- TICKET DEL CLIENTE (FORMATO NUEVO) -->
          <header class="text-center">
            ${logoUrl ? `<img src="${logoUrl}" class="logo-ticket" referrerPolicy="no-referrer" />` : ''}
            <div class="black" style="font-size: 13pt;">${company.razonSocial.toUpperCase()}</div>
            <div class="bold" style="font-size: 11pt;">RUC: ${company.ruc}</div>
            <div style="font-size: 9pt;">${company.address.toUpperCase()}</div>
            ${horario ? `<div style="font-size: 8pt; font-style: italic; margin-top: 1mm;">${horario}</div>` : ''}
          </header>

          <div class="divider-thick"></div>

          <section class="text-center">
            <div class="bold" style="font-size: 11pt;">${docTitle}</div>
            <div class="bold" style="font-size: 12pt;">${invoice.serie}-${String(invoice.correlativo).padStart(8, '0')}</div>
            <div style="margin-top: 4px; font-size: 9pt;">EMISIÓN: ${formattedDate}</div>
          </section>

          <div class="divider-thick"></div>

          <section style="font-size: 9.5pt;">
            <div class="flex-between"><span>CLIENTE:</span> <span class="bold">${invoice.client.name.toUpperCase()}</span></div>
            <div class="flex-between"><span>${invoice.client.docType}:</span> <span>${invoice.client.docNumber}</span></div>
            <div class="flex-between"><span>TEL:</span> <span>${invoice.client.phone || '-'}</span></div>
            <div class="flex-between"><span>DIR:</span> <span>${invoice.client.address || '-'}</span></div>
            <div class="flex-between"><span>MONEDA:</span> <span>SOLES</span></div>
          </section>

          <div class="divider-thick"></div>

          <table>
            <thead>
              <tr style="font-size: 9pt; border-bottom: 1px solid #000;">
                <th align="left">CANT.</th>
                <th align="left">DESCRIPCIÓN</th>
                <th align="right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.filter(item => !((item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO')).map((item, idx, arr) => `
                <tr style="font-size: 9.5pt;">
                  <td width="15%" class="bold">${item.quantity.toFixed(2)}</td>
                  <td class="bold">${item.name.toUpperCase()}</td>
                  <td align="right" class="bold">${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
                <tr>
                  <td></td>
                  <td colspan="2" class="pu-row">P.U: ${item.price.toFixed(2)}</td>
                </tr>
                ${(item.details || item.observaciones || item.color || item.defectos) ? `
                  <tr>
                    <td></td>
                    <td colspan="2" style="font-size: 8pt; font-style: normal; font-weight: bold; color: #000; padding-bottom: 4px;">
                      - ${formatItemDetails(item, true, 'none')}
                    </td>
                  </tr>
                ` : ''}
                ${idx < arr.length - 1 ? `<tr><td colspan="3"><div class="divider-thin"></div></td></tr>` : ''}
              `).join('')}
            </tbody>
          </table>

          <div class="divider-thick"></div>

          <section style="font-size: 10pt;">
            ${Number(invoice.descuento || (invoice as any).discount || 0) > 0 ? `
              <div class="flex-between"><span>Subtotal:</span> <span>S/ ${(invoice.totals.total + Number(invoice.descuento || (invoice as any).discount || 0)).toFixed(2)}</span></div>
              <div class="flex-between" style="color: #b91c1c; font-weight: bold;">
                <span>Descuento:</span>
                <span>-S/ ${Number(invoice.descuento || (invoice as any).discount || 0).toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="flex-between"><span>Op. Gravada:</span> <span>${invoice.totals.gravada.toFixed(2)}</span></div>
            <div class="flex-between"><span>IGV (${igvRate.toFixed(0)}%):</span> <span>${invoice.totals.igv.toFixed(2)}</span></div>
            <div class="flex-between black" style="font-size: 12pt; margin-top: 6px;">
                <span>TOTAL A PAGAR:</span> 
                <span>S/ ${invoice.totals.total.toFixed(2)}</span>
            </div>
            <div style="margin-top: 8px; font-size: 9pt;" class="bold">
              ${montoLetras}
            </div>
          </section>

          <div class="divider-thick"></div>

          <footer class="text-center">
            <div class="flex-between bold" style="font-size: 9pt;">
              <span>FORMA DE PAGO:</span> 
              <span>${paymentMethodText}</span>
            </div>

            ${invoice.prePaymentAmount ? `
              <div class="flex-between bold" style="font-size: 11pt; margin-top: 4px;"><span>PAGADO (ADELANTO):</span> <span>S/ ${invoice.prePaymentAmount.toFixed(2)}</span></div>
              <div class="flex-between bold" style="font-size: 11pt;"><span>SALDO PENDIENTE:</span> <span>S/ ${(invoice.totals.total - invoice.prePaymentAmount).toFixed(2)}</span></div>
            ` : ''}

            ${invoice.notes ? `
            <div style="margin-top: 8px; border: 1.5px solid #000; padding: 4px; font-size: 9pt; text-align: left;">
              <div style="font-weight: bold; text-decoration: underline;">OBSERVACIONES:</div>
              <div style="font-style: italic;">${invoice.notes}</div>
            </div>
            ` : ''}

            ${isElectronic ? `
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoice.qrCodeData || '')}" class="qr-code" referrerPolicy="no-referrer" />
              <div class="hash-text">HASH: ${invoice.sunatResponse?.hash || '---'}</div>
              <div style="font-size: 8pt; margin-top: 4px;">Representación impresa de la ${docTitle}.<br/>Autorizado mediante Resolución de Intendencia Nro. 034-005-0005315</div>
            ` : ''}

            <div class="divider-thick"></div>

            <div style="border: 2px solid #000; padding: 4px; margin: 8px 0;">
              <div style="font-size: 8pt; font-weight: bold; color: #666;">ENTREGA ESTIMADA</div>
              <div style="font-size: 12pt; font-weight: 800;">${fullDeliveryInfo}</div>
            </div>

            <div class="politicas-container">
              ${politicas}
            </div>

            ${activeBarcodeUrl ? `<img src="${activeBarcodeUrl}" class="barcode" referrerPolicy="no-referrer" />` : ''}

            <div class="footer-text">
              SISLAV: SOFTWARE PARA LAVANDERIA 931200353
            </div>
          </footer>
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
                      ${(item.details || item.color || item.defectos || (item.images && item.images.length > 0) || (item as any).url_foto_1 || item.audioNote) ? `<div style="font-size: 8.5pt; font-weight: bold; font-style: normal; color: #000; border: 1.2px solid #000; padding: 5px; margin-top: 5px;">${formatItemDetails(item, true, 'icons')}</div>` : ''}
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
                    <span>${paymentMethodTextEfectivo}</span>
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
            case InvoiceType.NOTA_VENTA: return (company?.custom_nv_name || company?.modulos_config?.custom_nv_name || 'NOTA DE VENTA').toUpperCase();
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

                    <div className="bg-white p-0 shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-slate-200 rounded-2xl w-full max-w-[380px] font-mono text-[11px] leading-relaxed text-black relative mx-auto mt-6">
                        <main className="receipt-container w-full bg-white p-[15px] text-[#000] text-[11px] leading-tight rounded-2xl">
                            {/* BEGIN: MainHeader */}
                            <header className="text-center mb-4">
                                {/* Logo Section */}
                                <div className="flex flex-col items-center mb-2">
                                    {(ticketConfig?.url_logo_ticket || company.logoUrl) && (
                                        <div className="w-16 h-16 mb-1">
                                            <img 
                                                alt="Laundry Logo" 
                                                className="w-full h-full object-contain grayscale" 
                                                src={ticketConfig?.url_logo_ticket || company.logoUrl} 
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                    )}
                                </div>
                                {/* Business Info */}
                                <div className="uppercase space-y-0.5">
                                    <h1 className="text-sm font-extrabold tracking-tight">{company.razonSocial.toUpperCase()}</h1>
                                    <p className="font-bold">RUC: {company.ruc}</p>
                                    <p>{company.address.toUpperCase()}</p>
                                    {ticketConfig?.horario_atencion && (
                                        <p className="italic text-[9px] mt-1">{ticketConfig.horario_atencion}</p>
                                    )}
                                </div>
                            </header>
                            
                            <div className="border-t-2 border-black my-2"></div>
                            
                            {/* BEGIN: DocumentInfo */}
                            <section className="text-center py-1 uppercase">
                                <h2 className="font-bold text-[13px]">{docTitle}</h2>
                                <p className="font-bold text-[12px]">{invoice.serie}-{String(invoice.correlativo).padStart(8, '0')}</p>
                                <p className="mt-1">Emisión: {formattedDate}</p>
                            </section>
                            
                            <div className="border-t-2 border-black my-2"></div>
                            
                            {/* BEGIN: CustomerInfo */}
                            <section className="space-y-0.5 py-1 uppercase">
                                <div className="flex">
                                    <span className="w-16 shrink-0 text-gray-500 font-bold">CLIENTE:</span>
                                    <span className="font-bold">{invoice.client.name.toUpperCase()}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-16 shrink-0 text-gray-500 font-bold">{invoice.client.docType === 'DNI' ? 'DNI' : invoice.client.docType}:</span>
                                    <span className="font-bold">{invoice.client.docNumber}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-16 shrink-0 text-gray-500 font-bold">TEL:</span>
                                    <span>{invoice.client.phone || '-'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-16 shrink-0 text-gray-500 font-bold">DIR:</span>
                                    <span>{invoice.client.address || '-'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-16 shrink-0 text-gray-500 font-bold">MONEDA:</span>
                                    <span>SOLES</span>
                                </div>
                            </section>
                            
                            <div className="border-t-2 border-black my-2"></div>
                            
                            {/* BEGIN: ItemsTable */}
                            <section>
                                <table className="w-full text-left border-collapse uppercase">
                                    <thead>
                                        <tr className="font-bold border-b border-black">
                                            <th className="py-1 w-12 text-[11px]">CANT.</th>
                                            <th className="py-1 text-[11px]">DESCRIPCIÓN</th>
                                            <th className="py-1 text-right text-[11px]">TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[11px]">
                                        {invoice.items.filter(item => {
                                            const isCanceled = (item as any).estado_id === 9 || 
                                                               (item as any).status === 'ANULADO' || 
                                                               item.status === 'CANCELADO' ||
                                                               (item as any).estado === 'CANCELADO' ||
                                                               (item as any).estado === 'ANULADO';
                                            return !isCanceled;
                                        }).map((item, idx) => (
                                            <React.Fragment key={idx}>
                                                <tr>
                                                    <td className="pt-2 align-top">{item.quantity.toFixed(2)}</td>
                                                    <td className="pt-2 font-bold leading-none">
                                                        {item.name}
                                                    </td>
                                                    <td className="pt-2 align-top text-right">{(item.price * item.quantity).toFixed(2)}</td>
                                                </tr>
                                                <tr>
                                                    <td></td>
                                                    <td className="pb-2 italic text-[9px] text-gray-700" colSpan={2}>
                                                        P.U: {item.price.toFixed(2)}
                                                        {(item.details || item.color || item.defectos) && (
                                                            <div className="mt-0.5 not-italic text-black font-semibold">
                                                                - {formatItemDetails(item, true, 'none')}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                                {idx < invoice.items.length - 1 && (
                                                    <tr><td colSpan={3}><div className="border-t border-gray-200 my-1"></div></td></tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </section>
                            
                            <div className="border-t-2 border-black my-2"></div>
                            
                            {/* BEGIN: Totals */}
                            <section className="space-y-1 py-1">
                                {Number(invoice.descuento || (invoice as any).discount || 0) > 0 && (
                                    <>
                                        <div className="flex justify-between">
                                            <span>Subtotal:</span>
                                            <span>S/ {(invoice.totals.total + Number(invoice.descuento || (invoice as any).discount || 0)).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-rose-600 font-bold">
                                            <span>Descuento:</span>
                                            <span>-S/ {Number(invoice.descuento || (invoice as any).discount || 0).toFixed(2)}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between">
                                    <span>Op. Gravada:</span>
                                    <span>{invoice.totals.gravada.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>IGV ({igvRate.toFixed(0)}%):</span>
                                    <span>{invoice.totals.igv.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-end mt-2">
                                    <span className="font-extrabold text-[14px]">TOTAL A PAGAR:</span>
                                    <span className="font-extrabold text-[14px]">S/ {invoice.totals.total.toFixed(2)}</span>
                                </div>
                                <div className="mt-2 font-bold uppercase text-[10px]">
                                    {montoLetras}
                                </div>
                            </section>
                            
                            <div className="border-t-2 border-black my-2"></div>
                            
                            {/* BEGIN: Footer */}
                            <footer className="text-center mt-2 space-y-3">
                                <div className="flex justify-between uppercase font-bold text-[10px]">
                                    <span>FORMA DE PAGO:</span>
                                    <span className="uppercase">{paymentMethodText}</span>
                                </div>

                                {invoice.prePaymentAmount ? (
                                    <div className="space-y-1 py-1 border-y border-gray-100">
                                        <div className="flex justify-between text-[11px] font-bold"><span>PAGADO (ADELANTO):</span> <span>S/ {invoice.prePaymentAmount.toFixed(2)}</span></div>
                                        <div className="flex justify-between text-[11px] font-bold"><span>SALDO PENDIENTE:</span> <span>S/ {(invoice.totals.total - invoice.prePaymentAmount).toFixed(2)}</span></div>
                                    </div>
                                ) : null}

                                {Number(invoice.descuento || (invoice as any).discount || 0) > 0 && (
                                    <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl px-3 py-2.5 text-center text-[10.5px] font-extrabold uppercase tracking-wide my-2 shadow-sm">
                                        🎉 ¡Ahorraste S/ {Number(invoice.descuento || (invoice as any).discount || 0).toFixed(2)} gracias a nuestros descuentos!
                                    </div>
                                )}

                                {/* QR Code Section */}
                                {isElectronic && invoice.qrCodeData && (
                                    <div className="py-2">
                                        <div className="flex justify-center">
                                            <img 
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoice.qrCodeData)}`} 
                                                className="w-[150px] h-[150px] grayscale" 
                                                alt="Sunat QR" 
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                        <p className="text-[8px] mt-1 text-gray-500 uppercase font-mono">HASH: {invoice.sunatResponse?.hash || (invoice as any).sunat_hash || '---'}</p>
                                    </div>
                                )}
                                
                                {/* Legal Text */}
                                <div className="text-[9px] px-2 leading-tight uppercase font-medium">
                                    Representación impresa de la {docTitle}. <br/>
                                    Autorizado mediante Resolución de Intendencia Nro. 034-005-0005315
                                </div>

                                <div className="border-t-2 border-black my-2"></div>

                                {/* Entrega info */}
                                <div className="text-center bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4 mt-2">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Entrega Estimada</div>
                                    <div className="text-sm font-black text-slate-900">{fullDeliveryInfo}</div>
                                </div>

                                {formatPolicies(ticketConfig?.politicas || company.ticketPolicies || 'Gracias por su preferencia.')}

                                {barcodeUrl && (
                                    <div className="mt-4 flex flex-col items-center">
                                        <img src={barcodeUrl} className="max-w-[200px] h-auto grayscale" alt="Barcode" />
                                    </div>
                                )}

                                <div className="text-[9px] font-black text-slate-300 mt-4 tracking-[0.3em] uppercase">
                                    SISLAV: software para lavanderia 931200353
                                </div>
                            </footer>
                        </main>
                    </div>

                    {/* Botón de Descarga Persistente */}
                    <div className="my-6 px-4">
                        <button 
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-indigo-100"
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
                    <div className="bg-white p-0 shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-slate-200 rounded-2xl w-full max-w-[380px] font-mono text-[11px] leading-relaxed text-black relative">
                        <main className="receipt-container w-full bg-white p-[15px] text-[#000] text-[11px] leading-tight rounded-2xl">
                            {/* BEGIN: MainHeader */}
                            <header className="text-center mb-4">
                                {/* Logo Section */}
                                <div className="flex flex-col items-center mb-2">
                                    {(ticketConfig?.url_logo_ticket || company.logoUrl) && (
                                        <div className="w-16 h-16 mb-1">
                                            <img 
                                                alt="Laundry Logo" 
                                                className="w-full h-full object-contain grayscale" 
                                                src={ticketConfig?.url_logo_ticket || company.logoUrl} 
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                    )}
                                </div>
                                {/* Business Info */}
                                <div className="uppercase space-y-0.5">
                                    <h1 className="text-sm font-extrabold tracking-tight">{company.razonSocial.toUpperCase()}</h1>
                                    <p className="font-bold">RUC: {company.ruc}</p>
                                    <p>{company.address.toUpperCase()}</p>
                                    {ticketConfig?.horario_atencion && (
                                        <p className="italic text-[9px] mt-1">{ticketConfig.horario_atencion}</p>
                                    )}
                                </div>
                            </header>
                            
                            <div className="border-t-2 border-black my-2"></div>
                            
                            {/* BEGIN: DocumentInfo */}
                            <section className="text-center py-1 uppercase">
                                <h2 className="font-bold text-[13px]">{docTitle}</h2>
                                <p className="font-bold text-[12px]">{invoice.serie}-{String(invoice.correlativo).padStart(8, '0')}</p>
                                <p className="mt-1">Emisión: {formattedDate}</p>
                            </section>
                            
                            <div className="border-t-2 border-black my-2"></div>
                            
                            {/* BEGIN: CustomerInfo */}
                            <section className="space-y-0.5 py-1 uppercase">
                                <div className="flex">
                                    <span className="w-16 shrink-0 text-gray-500 font-bold">CLIENTE:</span>
                                    <span className="font-bold">{invoice.client.name.toUpperCase()}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-16 shrink-0 text-gray-500 font-bold">{invoice.client.docType === 'DNI' ? 'DNI' : invoice.client.docType}:</span>
                                    <span className="font-bold">{invoice.client.docNumber}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-16 shrink-0 text-gray-500 font-bold">TEL:</span>
                                    <span>{invoice.client.phone || '-'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-16 shrink-0 text-gray-500 font-bold">DIR:</span>
                                    <span>{invoice.client.address || '-'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-16 shrink-0 text-gray-500 font-bold">MONEDA:</span>
                                    <span>SOLES</span>
                                </div>
                            </section>
                            
                            <div className="border-t-2 border-black my-2"></div>
                            
                            {/* BEGIN: ItemsTable */}
                            <section>
                                <table className="w-full text-left border-collapse uppercase">
                                    <thead>
                                        <tr className="font-bold border-b border-black">
                                            <th className="py-1 w-12">CANT.</th>
                                            <th className="py-1">DESCRIPCIÓN</th>
                                            <th className="py-1 text-right">TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[11px]">
                                        {invoice.items.filter(item => {
                                            const isCanceled = (item as any).estado_id === 9 || 
                                                               (item as any).status === 'ANULADO' || 
                                                               item.status === 'CANCELADO';
                                            return !isCanceled;
                                        }).map((item, idx) => (
                                            <React.Fragment key={idx}>
                                                <tr>
                                                    <td className="pt-2 align-top">{item.quantity.toFixed(2)}</td>
                                                    <td className="pt-2 font-bold leading-none">
                                                        {item.name}
                                                    </td>
                                                    <td className="pt-2 align-top text-right">{(item.price * item.quantity).toFixed(2)}</td>
                                                </tr>
                                                <tr>
                                                    <td></td>
                                                    <td className="pb-2 italic text-[9px] text-gray-700" colSpan={2}>
                                                        P.U: {item.price.toFixed(2)}
                                                        {(item.details || item.color || item.defectos) && (
                                                            <div className="mt-0.5 not-italic text-black font-semibold">
                                                                - {formatItemDetails(item, true, 'none')}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                                {idx < invoice.items.length - 1 && (
                                                    <tr><td colSpan={3}><div className="border-t border-gray-200 my-1"></div></td></tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </section>
                            
                            <div className="border-t-2 border-black my-2"></div>
                            
                            {/* BEGIN: Totals */}
                            <section className="space-y-1 py-1">
                                {Number(invoice.descuento || (invoice as any).discount || 0) > 0 && (
                                    <>
                                        <div className="flex justify-between">
                                            <span>Subtotal:</span>
                                            <span>S/ {(invoice.totals.total + Number(invoice.descuento || (invoice as any).discount || 0)).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-rose-600 font-bold">
                                            <span>Descuento:</span>
                                            <span>-S/ {Number(invoice.descuento || (invoice as any).discount || 0).toFixed(2)}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between">
                                    <span>Op. Gravada:</span>
                                    <span>{invoice.totals.gravada.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>IGV ({igvRate.toFixed(0)}%):</span>
                                    <span>{invoice.totals.igv.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-end mt-2">
                                    <span className="font-extrabold text-[14px]">TOTAL A PAGAR:</span>
                                    <span className="font-extrabold text-[14px]">S/ {invoice.totals.total.toFixed(2)}</span>
                                </div>
                                <div className="mt-2 font-bold uppercase text-[10px]">
                                    {montoLetras}
                                </div>
                            </section>
                            
                            <div className="border-t-2 border-black my-2"></div>
                            
                            {/* BEGIN: Footer */}
                            <footer className="text-center mt-2 space-y-3">
                                <div className="flex justify-between uppercase font-bold text-[10px]">
                                    <span>FORMA DE PAGO:</span>
                                    <span className="uppercase">{paymentMethodText}</span>
                                </div>

                                {invoice.prePaymentAmount ? (
                                    <div className="space-y-1 py-1 border-y border-gray-100">
                                        <div className="flex justify-between text-[11px] font-bold"><span>PAGADO (ADELANTO):</span> <span>S/ {invoice.prePaymentAmount.toFixed(2)}</span></div>
                                        <div className="flex justify-between text-[11px] font-bold"><span>SALDO PENDIENTE:</span> <span>S/ {(invoice.totals.total - invoice.prePaymentAmount).toFixed(2)}</span></div>
                                    </div>
                                ) : null}

                                {Number(invoice.descuento || (invoice as any).discount || 0) > 0 && (
                                    <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl px-3 py-2.5 text-center text-[10.5px] font-extrabold uppercase tracking-wide my-2 shadow-sm">
                                        🎉 ¡Ahorraste S/ {Number(invoice.descuento || (invoice as any).discount || 0).toFixed(2)} gracias a nuestros descuentos!
                                    </div>
                                )}

                                {/* QR Code Section */}
                                {isElectronic && invoice.qrCodeData && (
                                    <div className="py-2">
                                        <div className="flex justify-center">
                                            <img 
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(invoice.qrCodeData)}`} 
                                                className="w-[150px] h-[150px] grayscale" 
                                                alt="Sunat QR" 
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                        <p className="text-[8px] mt-1 text-gray-500 uppercase font-mono">HASH: {invoice.sunatResponse?.hash || (invoice as any).sunat_hash || '---'}</p>
                                    </div>
                                )}
                                
                                {/* Legal Text */}
                                <div className="text-[9px] px-2 leading-tight uppercase font-medium">
                                    Representación impresa de la {docTitle}. <br/>
                                    Autorizado mediante Resolución de Intendencia Nro. 034-005-0005315
                                </div>

                                <div className="border-t-2 border-black my-2"></div>

                                {/* Entrega info */}
                                <div className="text-center bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4 mt-2">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Entrega Estimada</div>
                                    <div className="text-sm font-black text-slate-900">{fullDeliveryInfo}</div>
                                </div>

                                {formatPolicies(ticketConfig?.politicas || company.ticketPolicies || 'Gracias por su preferencia.')}

                                {barcodeUrl && (
                                    <div className="mt-4 flex flex-col items-center">
                                        <img src={barcodeUrl} className="max-w-[200px] h-auto grayscale" alt="Barcode" />
                                    </div>
                                )}

                                <div className="text-[9px] font-black text-slate-300 mt-4 tracking-[0.3em] uppercase">
                                    SISLAV: software para lavanderia 931200353
                                </div>
                            </footer>
                        </main>
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
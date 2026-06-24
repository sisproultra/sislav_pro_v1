
import React, { useState } from 'react';
import { Invoice, Company, InvoiceType } from '../types';
import { Printer, X, Tag, FileText, CheckSquare, ChevronRight, Bookmark } from 'lucide-react';
import { printInvoiceDirectly } from '../utils/printService';
import bwipjs from 'bwip-js';

const formatItemDetailsHelper = (item: any, hidePrefix = false, displayMeta: 'none' | 'icons' | 'all' = 'all') => {
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

interface OrderPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  company: Company;
  primaryColor?: string;
  secondaryColor?: string;
  ticketConfig?: any;
}

const OrderPrintModal: React.FC<OrderPrintModalProps> = ({ isOpen, onClose, invoice, company, primaryColor = '#000', secondaryColor = '#64748b', ticketConfig }) => {
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [printingMode, setPrintingMode] = useState<'TAGS' | 'HAND_TAGS'>('TAGS');
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !invoice) return null;

  const generateQRCode = (text: string) => {
    try {
        const canvas = document.createElement('canvas');
        // @ts-ignore
        bwipjs.toCanvas(canvas, {
            bcid: 'qrcode',
            text: text,
            scale: 2,
            height: 10,
            width: 10,
        });
        return canvas.toDataURL('image/png');
    } catch (e) {
        console.error("Error generating QR:", e);
        return '';
    }
  };

  const toggleItem = (idx: number) => {
    const newSet = new Set(selectedIndexes);
    if (newSet.has(idx)) newSet.delete(idx);
    else newSet.add(idx);
    setSelectedIndexes(newSet);
  };

  const printWindowContent = (htmlContent: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Habilite las ventanas emergentes para imprimir.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintTags = () => {
    if (selectedIndexes.size === 0) return;
    
    if (printingMode === 'HAND_TAGS') {
        handlePrintHandTags();
        return;
    }

    let totalPiecesInOrder = 0;
    invoice.items.forEach(item => {
      const isCanceled = (item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO';
      const isWeight = item.unitCode === 'KGM' || item.um_saas === 'KILO' || item.um_saas === 'METROS' || item.um_saas === 'LITRO' || item.unitCode === 'MTK' || item.unitCode === 'LTR';
      if (!isCanceled) {
        totalPiecesInOrder += (isWeight) ? 1 : Math.ceil(item.quantity);
      }
    });

    let tagsHtml = '';
    let currentGlobalPieceIndex = 1;

    invoice.items.forEach((item, idx) => {
      const isSelected = selectedIndexes.has(idx);
      const isCanceled = (item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO';
      if (isCanceled) return;

      const isWeight = item.unitCode === 'KGM' || item.um_saas === 'KILO' || item.um_saas === 'METROS' || item.um_saas === 'LITRO' || item.unitCode === 'MTK' || item.unitCode === 'LTR';
      const piecesToPrint = isWeight ? 1 : Math.ceil(item.quantity);

      for (let i = 0; i < piecesToPrint; i++) {
        if (isSelected) {
          const deliveryDate = invoice.deliveryDate ? new Date(invoice.deliveryDate).toLocaleDateString('es-PE') : '--';
          
          tagsHtml += `
            <div class="tag-container">
              <div class="header">
                <span class="ticket-id">${invoice.ordenNumber}</span>
                <span class="fraction">${currentGlobalPieceIndex}/${totalPiecesInOrder}</span>
              </div>
              <div class="client-name">${invoice.client.name.toUpperCase()}</div>
              <div class="line-thick"></div>
              <div class="item-name">
                <div>${item.name.toUpperCase()} ${isWeight ? `(${item.quantity}${item.um_saas === 'METROS' ? 'm' : item.um_saas === 'LITRO' ? 'L' : 'kg'})` : ''}</div>
                ${(item.details || item.color || item.defectos || (item.images && item.images.length > 0) || (item as any).url_foto_1 || item.audioNote) ? `<div class="item-details-tag">${formatItemDetailsHelper(item, true, 'icons')}</div>` : ''}
              </div>
              <div class="line-dashed"></div>
              <div class="footer">
                ENTREGA: ${deliveryDate}
              </div>
            </div>
          `;
        }
        currentGlobalPieceIndex++;
      }
    });

    const finalHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700;900&display=swap');
          @page { margin: 0; size: 80mm auto; orientation: portrait; }
          body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; font-weight: 900; color: #000; width: 80mm; }
          .tag-container { width: 80mm; padding: 4mm; display: flex; flex-direction: column; page-break-after: always; overflow: hidden; box-sizing: border-box; min-height: 50mm; }
          .header { display: flex; justify-content: space-between; align-items: baseline; }
          .ticket-id { font-size: 30pt; line-height: 1; }
          .fraction { font-size: 24pt; line-height: 1; }
          .client-name { font-size: 13pt; margin-top: 1mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700; }
          .line-thick { border-top: 3.5pt solid #000; margin: 1.5mm 0; }
          .item-name { font-size: 14pt; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; line-height: 1.1; font-weight: 900; padding: 2mm 0; }
          .item-details-tag { font-size: 10pt; font-weight: 900; font-style: normal; margin-top: 3px; text-transform: uppercase; color: #000; }
          .line-dashed { border-top: 1pt dashed #000; margin: 1mm 0; }
          .footer { font-size: 10pt; text-align: center; font-weight: 700; padding-bottom: 2mm; }
        </style>
      </head>
      <body>
        ${tagsHtml}
        <script>
          window.onload = function() { window.focus(); window.print(); setTimeout(function() { window.close(); }, 500); };
        </script>
      </body>
      </html>
    `;

    printWindowContent(finalHtml);
    setShowItemSelector(false);
  };

  const handlePrintHandTags = () => {
    const sucursalName = (company as any).nombre_sucursal || company.razonSocial || '---';
    const clientName = invoice.client.name.toUpperCase();
    const orderNum = invoice.ordenNumber || '---';
    
    // Preparar fecha y hora
    const dDate = invoice.deliveryDate ? new Date(invoice.deliveryDate) : null;
    const deliveryDateStr = dDate ? dDate.toLocaleDateString('es-PE') : '--';
    const deliveryTimeStr = dDate ? dDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }) : '--';

    let tagsHtml = '';
    
    invoice.items.forEach((item, idx) => {
      if (!selectedIndexes.has(idx)) return;
      
      const isCanceled = (item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO';
      if (isCanceled) return;

      const prendaName = item.name.toUpperCase();
      const itemDetails = formatItemDetailsHelper(item).toUpperCase();

      // Construir contenido del QR según lo solicitado
      const qrContent = `SUCURSAL: ${sucursalName}\nCLIENTE: ${clientName}\nFECHA ENTREGA: ${deliveryDateStr}\nHORA ENTREGA: ${deliveryTimeStr}\nTICKET: ${orderNum}\nPRENDA: ${prendaName}\nDETALLES: ${itemDetails}`;
      
      const qrUrl = generateQRCode(qrContent);
      
      const piecesToPrint = item.unitCode === 'KGM' ? 1 : Math.ceil(item.quantity);
      
      for (let i = 0; i < piecesToPrint; i++) {
        tagsHtml += `
          <div class="handtag-container">
            <div class="main-row">
              <div class="qr-col">
                <img src="${qrUrl}" />
              </div>
              <div class="data-col">
                <div class="top-data">
                  <span class="order-id">${orderNum}</span>
                  <span class="date-label">Fe: ${deliveryDateStr}</span>
                </div>
                <div class="client-name">${clientName}</div>
              </div>
            </div>
          </div>
        `;
      }
    });

    const finalHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700;900&display=swap');
          @page { 
            margin: 0; 
            size: 40mm 15mm; 
          }
          body { 
            margin: 0; 
            padding: 0; 
            font-family: 'Inter', sans-serif; 
            background: white;
          }
          .handtag-container {
            width: 40mm;
            height: 15mm;
            padding: 1mm 2mm;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            page-break-after: always;
            overflow: hidden;
            position: relative;
          }
          .main-row {
            display: flex;
            width: 100%;
            height: 100%;
            align-items: center;
            gap: 2mm;
          }
          .qr-col {
            width: 11mm;
            height: 11mm;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .qr-col img {
            width: 100%;
            height: 100%;
            image-rendering: pixelated;
          }
          .data-col {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-width: 0;
          }
          .top-data {
            display: flex;
            justify-content: flex-start;
            align-items: baseline;
            gap: 2mm;
            margin-bottom: 0.5mm;
          }
          .order-id {
            font-size: 13pt;
            font-weight: 900;
            white-space: nowrap;
          }
          .date-label {
            font-size: 7.5pt;
            font-weight: 700;
            white-space: nowrap;
          }
          .client-name {
            font-size: 8.5pt;
            font-weight: 900;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1;
          }
        </style>
      </head>
      <body>
        ${tagsHtml}
        <script>
          window.onload = function() { window.focus(); window.print(); setTimeout(function() { window.close(); }, 500); };
        </script>
      </body>
      </html>
    `;

    printWindowContent(finalHtml);
    setShowItemSelector(false);
  };

  const handlePrintFull = async () => {
    setIsPrinting(true);
    try {
      await printInvoiceDirectly(invoice, company, ticketConfig);
      onClose();
    } catch (error) {
      console.error("Error al imprimir:", error);
    } finally {
      setIsPrinting(false);
    }
  };

  if (showItemSelector) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
          <div className="px-8 pt-10 pb-4 relative text-center">
            <button 
              onClick={() => setShowItemSelector(false)} 
              className="absolute right-8 top-8 text-slate-300 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-full"
            >
              <X size={24} />
            </button>
            <h3 className="font-bold text-xl uppercase tracking-tight" style={{ color: primaryColor }}>
                {printingMode === 'HAND_TAGS' ? 'Imprimir Hand Tags' : 'Imprimir Etiquetas'}
            </h3>
            <p className="text-sm text-slate-400 mt-1 font-medium">
                {printingMode === 'HAND_TAGS' ? 'Etiquetas pequeñas para lavado.' : 'Seleccione prendas para identificar en planta.'}
            </p>
          </div>

          <div className="overflow-y-auto px-8 py-4 space-y-3 flex-1 custom-scrollbar">
            {invoice.items.map((item, idx) => {
              const isCanceled = (item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO';
              const isSelected = selectedIndexes.has(idx);
              
              if (isCanceled) return null;

              return (
                <div 
                  key={idx} 
                  onClick={() => toggleItem(idx)}
                  className={`flex items-center justify-between p-5 rounded-[1.5rem] cursor-pointer border-2 transition-all duration-200 ${
                    isSelected ? 'bg-slate-50 border-opacity-100 shadow-lg' : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                  style={{ borderColor: isSelected ? primaryColor : undefined }}
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div 
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'text-white shadow-md' : 'bg-slate-50 border border-slate-200'}`}
                      style={{ backgroundColor: isSelected ? primaryColor : undefined }}
                    >
                      {isSelected && <CheckSquare size={18} strokeWidth={3} />}
                    </div>
                    <span className={`font-bold text-sm uppercase truncate ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                      {item.name}
                    </span>
                  </div>
                  <div className="shrink-0 ml-3">
                    <span 
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase border ${isSelected ? 'text-white' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                      style={{ backgroundColor: isSelected ? primaryColor : undefined, borderColor: isSelected ? primaryColor : undefined }}
                    >
                      {item.quantity} {item.unitCode === 'KGM' ? 'KG' : 'UND'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-8 bg-white">
            <button 
                onClick={handlePrintTags}
                disabled={selectedIndexes.size === 0}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all text-xs uppercase tracking-widest ${
                    selectedIndexes.size > 0 ? 'text-white shadow-xl active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                style={{ backgroundColor: selectedIndexes.size > 0 ? primaryColor : undefined }}
            >
                {printingMode === 'HAND_TAGS' ? <Bookmark size={20} strokeWidth={3} /> : <Tag size={20} strokeWidth={3} />}
                <span>Imprimir ({selectedIndexes.size}) {printingMode === 'HAND_TAGS' ? 'Hand Tags' : 'Etiquetas'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden transform transition-all scale-100 flex flex-col border border-slate-100">
        <div className="px-8 py-6 flex justify-between items-center shrink-0" style={{ backgroundColor: primaryColor }}>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-xl">
              <Printer size={20} className="text-white" />
            </div>
            <h3 className="text-white font-bold text-lg uppercase tracking-tight">Reimprimir</h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"><X size={24} /></button>
        </div>

        <div className="p-10 space-y-5">
          <div className="text-center mb-8">
            <div className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] mb-2">GESTIÓN DE IMPRESIÓN</div>
            <div 
                className="text-4xl font-black tracking-tighter"
                style={{ color: primaryColor }}
            >
                {invoice.ordenNumber || '---'}
            </div>
          </div>

          <button
            onClick={handlePrintFull}
            disabled={isPrinting}
            className="w-full flex items-center justify-between p-6 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-slate-300 hover:bg-slate-50 transition-all group shadow-sm active:scale-[0.98] disabled:opacity-50"
          >
            <div className="flex items-center gap-5">
              <div 
                className="text-white p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                <FileText size={24} />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-900 uppercase tracking-tight">{isPrinting ? 'PROCESANDO...' : 'TICKET COMPLETO'}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Cliente + Orden Trabajo</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
          </button>

          <button
            onClick={() => {
                setPrintingMode('TAGS');
                setShowItemSelector(true);
            }}
            className="w-full flex items-center justify-between p-6 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-slate-300 hover:bg-slate-50 transition-all group shadow-sm active:scale-[0.98]"
          >
            <div className="flex items-center gap-5">
              <div 
                className="text-white p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-lg"
                style={{ backgroundColor: secondaryColor }}
              >
                <Tag size={24} />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-900 uppercase tracking-tight">ETIQUETAS PRENDA</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Imprimir por unidades</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
          </button>
          
          <button
            onClick={() => {
                setPrintingMode('HAND_TAGS');
                setShowItemSelector(true);
            }}
            className="w-full flex items-center justify-between p-6 bg-white border-2 border-slate-100 rounded-[2rem] hover:border-slate-300 hover:bg-slate-50 transition-all group shadow-sm active:scale-[0.98]"
          >
            <div className="flex items-center gap-5">
              <div 
                className="text-white p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-lg"
                style={{ backgroundColor: '#f59e0b' }}
              >
                <Bookmark size={24} />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-900 uppercase tracking-tight">HAND TAG</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Etiqueta de lavado</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-slate-300" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderPrintModal;

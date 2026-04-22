import { CartItem, IgvType, InvoiceTotals, Company } from '../types';

/**
 * Redondea un valor a un decimal siguiendo la regla:
 * .34 -> .30
 * .35 -> .40
 * .37 -> .40
 */
export const roundToOneDecimal = (value: number): number => {
    return Math.round(value * 10) / 10;
};

export const calculateTotals = (items: CartItem[], igvPercentage: number = 18.00): InvoiceTotals => {
  let gravada = 0, exonerada = 0, inafecta = 0, igv = 0;
  const igvFactor = 1 + (igvPercentage / 100);

  items.forEach(item => {
    // Calculamos el subtotal de la línea basándonos en el precio que ya incluye IGV
    // Si la empresa usa el redondeo a 1 decimal para el público, lo respetamos aquí
    const lineTotal = roundToOneDecimal(item.price * item.quantity);
    
    if (item.igvType === IgvType.GRAVADO) {
      // Valor Unitario (Sin IGV) con 4 decimales para SUNAT
      item.valor_unitario = Number((item.price / igvFactor).toFixed(4));
      // IGV del ítem con 4 decimales
      item.igv_item = Number((lineTotal - (lineTotal / igvFactor)).toFixed(4));
      
      // Base Imponible de la línea
      const itemBase = Number((lineTotal / igvFactor).toFixed(4));
      
      gravada += itemBase;
      igv += (lineTotal - itemBase);
    } else if (item.igvType === IgvType.EXONERADO) {
      exonerada += lineTotal;
      item.valor_unitario = item.price;
      item.igv_item = 0;
    } else if (item.igvType === IgvType.INAFECTO) {
      inafecta += lineTotal;
      item.valor_unitario = item.price;
      item.igv_item = 0;
    }
  });

  return { 
    gravada: Number(gravada.toFixed(2)), 
    exonerada: Number(exonerada.toFixed(2)), 
    inafecta: Number(inafecta.toFixed(2)), 
    igv: Number(igv.toFixed(2)), 
    total: Number((gravada + igv + exonerada + inafecta).toFixed(2))
  };
};

/**
 * Retorna la siguiente letra del alfabeto (A-Z). Si llega a Z, reinicia en A.
 */
export const getNextLetter = (letter: string): string => {
    if (!letter || letter.length === 0) return 'A';
    const charCode = letter.charCodeAt(0);
    if (charCode >= 90) return 'A';
    return String.fromCharCode(charCode + 1);
};

/**
 * Retorna el número de orden formateado según la configuración de la empresa.
 */
export const formatOrderNumber = (num: number, config: Company): string => {
    const zeros = config.orderZerosCount ?? 5;
    const numStr = String(num).padStart(zeros, '0');
    
    if (!config.useOrderSuffix) return numStr;
    
    const suffix = config.prefijo_sufijo || config.orderCurrentSuffix || 'A';
    return config.orderSuffixPosition === 'BEFORE' 
        ? `${suffix}-${numStr}` 
        : `${numStr}-${suffix}`;
};

/**
 * Retorna la fecha formateada en la zona horaria local del navegador.
 */
export const formatDateSafe = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    });
};

/**
 * Retorna la hora formateada en la zona horaria local del navegador.
 */
export const formatTimeSafe = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
    });
};

/**
 * Retorna fecha y hora completa local.
 */
export const formatDateTimeSafe = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return `${formatDateSafe(dateStr)} ${formatTimeSafe(dateStr)}`;
};

/**
 * Función CRÍTICA para SUNAT: Obtiene la fecha y hora actual forzada a zona horaria de Lima (Perú).
 */
export const getPeruDateTime = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;
    
    const date = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    const time = `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
    
    return { date, time, iso: `${date}T${time}` };
};
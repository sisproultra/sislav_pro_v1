import { CartItem, IgvType, InvoiceTotals, Company } from '../types';

/**
 * Redondea un valor a un decimal hacia abajo (siempre a favor del cliente):
 * .34 -> .30
 * .35 -> .30
 * .37 -> .30
 */
export const roundToOneDecimal = (value: number): number => {
    return Math.floor(value * 10 + 0.0001) / 10;
};

export const calculateTotals = (items: CartItem[], igvPercentage: number = 18.00, globalDiscount: number = 0): InvoiceTotals => {
  const igvFactor = 1 + (igvPercentage / 100);

  // 1. Calcular totales brutos por tipo de IGV en el carrito
  let rawGravadaConIgv = 0;
  let rawExonerada = 0;
  let rawInafecta = 0;

  items.forEach(item => {
    const discountedPrice = Math.max(0, item.price - (item.descuento_unitario || 0));
    const lineTotal = roundToOneDecimal(discountedPrice * item.quantity);
    
    if (item.igvType === IgvType.GRAVADO) {
      rawGravadaConIgv += lineTotal;
      item.valor_unitario = Number((discountedPrice / igvFactor).toFixed(4));
      item.igv_item = Number((lineTotal - (lineTotal / igvFactor)).toFixed(4));
    } else if (item.igvType === IgvType.EXONERADO) {
      rawExonerada += lineTotal;
      item.valor_unitario = discountedPrice;
      item.igv_item = 0;
    } else if (item.igvType === IgvType.INAFECTO) {
      rawInafecta += lineTotal;
      item.valor_unitario = discountedPrice;
      item.igv_item = 0;
    }
  });

  const rawTotal = rawGravadaConIgv + rawExonerada + rawInafecta;

  // 2. Distribución proporcional del descuento global si existe
  let netGravadaConIgv = rawGravadaConIgv;
  let netExonerada = rawExonerada;
  let netInafecta = rawInafecta;

  if (globalDiscount > 0 && rawTotal > 0) {
    const propGravada = rawGravadaConIgv / rawTotal;
    const propExonerada = rawExonerada / rawTotal;
    const propInafecta = rawInafecta / rawTotal;

    const discGravada = globalDiscount * propGravada;
    const discExonerada = globalDiscount * propExonerada;
    const discInafecta = globalDiscount * propInafecta;

    netGravadaConIgv = Math.max(0, rawGravadaConIgv - discGravada);
    netExonerada = Math.max(0, rawExonerada - discExonerada);
    netInafecta = Math.max(0, rawInafecta - discInafecta);

    // Ajustamos por redondeo de suma para que calce exacto al céntimo
    const expectedNetTotal = Math.max(0, rawTotal - globalDiscount);
    const actualSum = netGravadaConIgv + netExonerada + netInafecta;
    const diff = expectedNetTotal - actualSum;
    if (Math.abs(diff) < 1.0) {
      if (netGravadaConIgv >= netExonerada && netGravadaConIgv >= netInafecta && netGravadaConIgv > 0) {
        netGravadaConIgv += diff;
      } else if (netExonerada >= netInafecta && netExonerada > 0) {
        netExonerada += diff;
      } else if (netInafecta > 0) {
        netInafecta += diff;
      }
    }
  }

  // Volver a calcular bases e IGV a partir de los subtotales netos ponderados
  const gravada = Number((netGravadaConIgv / igvFactor).toFixed(2));
  const igv = Number((netGravadaConIgv - gravada).toFixed(2));
  const exonerada = Number(netExonerada.toFixed(2));
  const inafecta = Number(netInafecta.toFixed(2));

  return { 
    gravada, 
    exonerada, 
    inafecta, 
    igv, 
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
    // Si es una fecha YYYY-MM-DD, la formateamos directamente para evitar offsets de zona horaria (UTC)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-PE', { 
        timeZone: 'America/Lima',
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    });
};

/**
 * Retorna la hora formateada forzada a la zona horaria de Perú.
 */
export const formatTimeSafe = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-PE', { 
        timeZone: 'America/Lima',
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
    });
};

/**
 * Retorna fecha y hora completa forzada a la zona horaria de Perú.
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
    
    return { date, time, iso: `${date}T${time}-05:00` };
};

/**
 * Retorna la fecha formateada en formato "YYYY-MM-DD" forzada a la zona horaria de Perú, 
 * sin importar la zona horaria del servidor o de la base de datos.
 */
export const getPeruLocalDateString = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    // Si ya es un formato simple YYYY-MM-DD, lo retornamos como está
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    
    const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(d);
};

/**
 * Retorna la fecha de Perú (hoy) restándole 2 días, en formato YYYY-MM-DD.
 */
export const getRetroactivePeruDate = (): string => {
    const { date } = getPeruDateTime();
    const [year, month, day] = date.split('-').map(Number);
    const pDate = new Date(year, month - 1, day);
    pDate.setDate(pDate.getDate() - 2);
    
    const yStr = pDate.getFullYear();
    const mStr = String(pDate.getMonth() + 1).padStart(2, '0');
    const dStr = String(pDate.getDate()).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
};

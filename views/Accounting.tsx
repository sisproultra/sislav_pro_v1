import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, Company, PaymentMethodConfig, InvoiceType } from '../types';
import { dbGetPaymentsInRange, dbGetInvoices } from '../services/dbService';
import { 
    Calendar, 
    Download, 
    Filter, 
    BadgeDollarSign, 
    FileText, 
    PieChart as PieChartIcon,
    Table as TableIcon,
    CheckCircle2,
    XCircle,
    Info,
    Wallet,
    TrendingUp,
    ChevronLeft,
    ChevronRight,
    X,
    FileSpreadsheet,
    DollarSign,
    RefreshCw
} from 'lucide-react';
import { 
    PieChart, 
    Pie, 
    Cell, 
    ResponsiveContainer, 
    Tooltip, 
    Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';

interface AccountingProps {
    invoices: Invoice[];
    paymentMethods: PaymentMethodConfig[];
    company: Company | null;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f43f5e', '#3b82f6'];

const Accounting: React.FC<AccountingProps> = ({ invoices, paymentMethods, company }) => {
    // Helper to get local date string YYYY-MM-DD safely
    const getLocalDateString = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Calculate default date range (1st day of current month to current day)
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);

    const [activeTab, setActiveTab] = useState<'emitidos' | 'cobranzas'>('emitidos');
    const [startDate, setStartDate] = useState(getLocalDateString(firstDayOfMonth));
    const [endDate, setEndDate] = useState(getLocalDateString(new Date()));
    const [docTypeFilter, setDocTypeFilter] = useState<string>('ALL');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL'); // Default to ALL (always TODO)
    const [filterByType, setFilterByType] = useState<'COBRO' | 'VENTA'>('VENTA');
     const [paymentsInRange, setPaymentsInRange] = useState<any[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = useState(false);
    const [invoicesInRange, setInvoicesInRange] = useState<Invoice[]>([]);
    const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    // Modal State
    const [isRecaudoModalOpen, setIsRecaudoModalOpen] = useState(false);

    const currency = company?.currencySymbol || 'S/';

    // Unified list of all invoices
    const allInvoices = useMemo(() => {
        const map = new Map<string, Invoice>();
        // Add prop invoices first
        invoices.forEach(inv => {
            if (inv.id) map.set(inv.id, inv);
        });
        // Override/add range invoices (which are precise for selected dates)
        invoicesInRange.forEach(inv => {
            if (inv.id) map.set(inv.id, inv);
        });
        return Array.from(map.values());
    }, [invoices, invoicesInRange]);

    // --- FETCH APPLICABLE DATA IN DATE RANGE ---
    const fetchRangeData = async () => {
        setIsLoadingPayments(true);
        setIsLoadingInvoices(true);
        try {
            const [paymentsData, invoicesData] = await Promise.all([
                dbGetPaymentsInRange(startDate, endDate),
                dbGetInvoices(1, 10000, '', false, startDate, endDate)
            ]);
            setPaymentsInRange(paymentsData || []);
            setInvoicesInRange(invoicesData?.invoices || []);
        } catch (err) {
            console.error("Error fetching accounting range data:", err);
        } finally {
            setIsLoadingPayments(false);
            setIsLoadingInvoices(false);
        }
    };

    useEffect(() => {
        fetchRangeData();
    }, [startDate, endDate]);

    // Reset pagination to page 1 dynamic whenever filter values change
    useEffect(() => {
        setCurrentPage(1);
    }, [startDate, endDate, docTypeFilter, paymentStatusFilter, filterByType, activeTab]);

    // --- FILTRADO VENTAS (Sorted by Emission Date / Time Descending by default) ---
    const filteredInvoices = useMemo(() => {
        const results = allInvoices.filter(inv => {
            const date = (inv.fecha_emision || inv.date || '').slice(0, 10);
            const inDateRange = date >= startDate && date <= endDate;
            const matchesDocType = docTypeFilter === 'ALL' || inv.type === docTypeFilter;
            
            const isPaid = (inv.prePaymentAmount || 0) >= inv.totals.total;
            const matchesPaymentStatus = paymentStatusFilter === 'ALL' || 
                                       (paymentStatusFilter === 'PAID' && isPaid) ||
                                       (paymentStatusFilter === 'PENDING' && !isPaid);

            return inDateRange && matchesDocType && matchesPaymentStatus;
        });

        // Ordered by date descending (most recent first)
        return [...results].sort((a, b) => new Date(b.fecha_emision || b.date || '').getTime() - new Date(a.fecha_emision || a.date || '').getTime());
    }, [allInvoices, startDate, endDate, docTypeFilter, paymentStatusFilter]);

    // --- FILTRADO COBRANZAS REALIZADAS ---
    const filteredPayments = useMemo(() => {
        return paymentsInRange.filter(p => {
            const pDate = (p.date || '').slice(0, 10);
            const inDateRange = pDate >= startDate && pDate <= endDate;
            if (!inDateRange) return false;

            const pInvoice = allInvoices.find(inv => inv.id === p.venta_id);
            if (!pInvoice) return false;
            
            const matchesDocType = docTypeFilter === 'ALL' || pInvoice.type === docTypeFilter;
            return matchesDocType;
        }).sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
    }, [paymentsInRange, allInvoices, startDate, endDate, docTypeFilter]);

    // --- PAGINATED DATA ---
    const paginatedInvoices = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredInvoices.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredInvoices, currentPage, itemsPerPage]);

    const paginatedPayments = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredPayments, currentPage, itemsPerPage]);

    const currentTotalItems = activeTab === 'emitidos' ? filteredInvoices.length : filteredPayments.length;

    const totalPages = useMemo(() => {
        return Math.ceil(currentTotalItems / itemsPerPage) || 1;
    }, [currentTotalItems, itemsPerPage]);

    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    // --- ESTADÍSTICAS SINCRO ---
    const stats = useMemo(() => {
        if (activeTab === 'emitidos') {
            const total = filteredInvoices.reduce((sum, inv) => sum + inv.totals.total, 0);
            
            // Find payments corresponding to the filtered invoices to avoid mismatches
            const invoiceIds = new Set(filteredInvoices.map(inv => inv.id));
            const relevantPayments = paymentsInRange.filter(p => invoiceIds.has(p.venta_id));
            
            const collected = relevantPayments.reduce((sum, p) => sum + p.monto, 0);
            
            const byMethod: Record<string, number> = {};
            const countByMethod: Record<string, number> = {};
            
            relevantPayments.forEach(p => {
                const methodObj = paymentMethods.find(m => m.id === p.metodo_pago_id);
                const methodName = methodObj ? methodObj.name : 'EFECTIVO';
                byMethod[methodName] = (byMethod[methodName] || 0) + p.monto;
                countByMethod[methodName] = (countByMethod[methodName] || 0) + 1;
            });

            // Ensure we capture overall methods even with 0 if needed, or just list present
            const chartData = Object.entries(byMethod)
                .map(([name, value]) => ({ 
                    name, 
                    value, 
                    count: countByMethod[name] || 0,
                    percentage: collected > 0 ? Number(((value / collected) * 100).toFixed(1)) : 0
                }))
                .sort((a, b) => b.value - a.value);

            return { total, collected, chartData, totalPaymentsCount: relevantPayments.length };
        } else {
            // activeTab === 'cobranzas'
            const collected = filteredPayments.reduce((sum, p) => sum + p.monto, 0);
            
            // For parent invoices
            const invoiceIds = new Set(filteredPayments.map(p => p.venta_id));
            const uniqueInvoices = allInvoices.filter(inv => invoiceIds.has(inv.id));
            const total = uniqueInvoices.reduce((sum, inv) => sum + inv.totals.total, 0);

            const byMethod: Record<string, number> = {};
            const countByMethod: Record<string, number> = {};
            
            filteredPayments.forEach(p => {
                const methodObj = paymentMethods.find(m => m.id === p.metodo_pago_id);
                const methodName = methodObj ? methodObj.name : 'EFECTIVO';
                byMethod[methodName] = (byMethod[methodName] || 0) + p.monto;
                countByMethod[methodName] = (countByMethod[methodName] || 0) + 1;
            });

            const chartData = Object.entries(byMethod)
                .map(([name, value]) => ({ 
                    name, 
                    value, 
                    count: countByMethod[name] || 0,
                    percentage: collected > 0 ? Number(((value / collected) * 100).toFixed(1)) : 0
                }))
                .sort((a, b) => b.value - a.value);

            return { total, collected, chartData, totalPaymentsCount: filteredPayments.length };
        }
    }, [activeTab, filteredInvoices, filteredPayments, paymentsInRange, paymentMethods, allInvoices]);

    // Breakdown for document types in Tab 1
    const documentBreakdown = useMemo(() => {
        let facturasSum = 0;
        let facturasCount = 0;
        let boletasSum = 0;
        let boletasCount = 0;
        let notasSum = 0;
        let notasCount = 0;

        filteredInvoices.forEach(inv => {
            if (inv.type === InvoiceType.FACTURA) {
                facturasSum += inv.totals.total;
                facturasCount++;
            } else if (inv.type === InvoiceType.BOLETA) {
                boletasSum += inv.totals.total;
                boletasCount++;
            } else {
                notasSum += inv.totals.total;
                notasCount++;
            }
        });

        return {
            facturasSum, facturasCount,
            boletasSum, boletasCount,
            notasSum, notasCount
        };
    }, [filteredInvoices]);

    // Helper to extract granular payment methods for each document row
    const getInvoicePayments = (inv: Invoice) => {
        const list: { name: string; amount: number }[] = [];
        if (inv.payments && inv.payments.length > 0) {
            inv.payments.forEach(p => {
                const method = paymentMethods.find(m => m.id === p.metodo_pago_id);
                list.push({
                    name: (method ? method.name : (p.metodo_pago_name || 'OTRO')).toUpperCase().trim(),
                    amount: p.monto
                });
            });
        } else {
            // Fallback: check matching loaded range payments for this invoice id
            const matchedPayments = paymentsInRange.filter(p => p.venta_id === inv.id);
            if (matchedPayments.length > 0) {
                matchedPayments.forEach(p => {
                    const method = paymentMethods.find(m => m.id === p.metodo_pago_id);
                    list.push({
                        name: (method ? method.name : (p.metodo_pago_name || 'OTRO')).toUpperCase().trim(),
                        amount: p.monto
                    });
                });
            } else {
                const paidAmount = inv.prePaymentAmount !== undefined ? inv.prePaymentAmount : inv.totals.total;
                list.push({
                    name: (inv.paymentMethod || 'EFECTIVO').toUpperCase().trim(),
                    amount: paidAmount
                });
            }
        }
        return list;
    };

    // Style helper for payment badges compatible with local methods (Yape, Plin, Cash, Cards, Bank Transfers)
    const getPaymentBadgeStyles = (methodName: string) => {
        const name = methodName.toUpperCase();
        if (name.includes('YAPE')) {
            return 'bg-purple-100 text-purple-800 border-purple-200';
        }
        if (name.includes('PLIN')) {
            return 'bg-teal-100 text-teal-800 border-teal-200';
        }
        if (name.includes('EFECTIVO') || name.includes('CASH')) {
            return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        }
        if (name.includes('TARJETA') || name.includes('CARD') || name.includes('VISA') || name.includes('MASTERCARD') || name.includes('POS')) {
            return 'bg-blue-100 text-blue-800 border-blue-200';
        }
        if (name.includes('TRANSFERENCIA') || name.includes('DEPOSITO') || name.includes('BCP') || name.includes('BBVA') || name.includes('BANCO') || name.includes('INTERBANK')) {
            return 'bg-amber-100 text-amber-800 border-amber-200';
        }
        return 'bg-slate-100 text-slate-800 border-slate-200';
    };

    // --- EXPORTACIÓN FORMATO EXCEL COMPLETO (Soporta Factura, Boleta y Nota de venta) ---
    const handleExportExcel = () => {
        // En la hoja ventas deben estar TODAS las ventas registradas: NOTA_VENTA (80), BOLETA (03) y FACTURA (01)
        const validInvoices = filteredInvoices;

        if (validInvoices.length === 0) {
            alert("No hay ventas registradas (Notas de Venta, Boletas o Facturas) para exportar en el periodo seleccionado.");
            return;
        }

        // Ordenar deterministicamente por tipo y número descendente
        const sortedInvoices = [...validInvoices].sort((a, b) => {
            if (a.type !== b.type) {
                return a.type.localeCompare(b.type);
            }
            return b.correlativo - a.correlativo;
        });

        const [year, month] = startDate.split('-');
        const periodTitle = `${year}-${month}`;
        const commercialName = company?.razonSocial || 'LAVANDERIA IMPERIAL';

        // --- HOJA 1: VENTAS (Incluye Factura, Boleta, Nota de Venta) ---
        const ventasData = sortedInvoices.map(inv => {
            const dateObj = new Date(inv.fecha_emision || inv.date);
            const period = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}00`;
            
            let docType = '0';
            const clientDocType = inv.client?.docType?.toUpperCase() || '';
            if (clientDocType === 'DNI') docType = '1';
            else if (clientDocType === 'RUC') docType = '6';

            // Get standard document human description
            let humType = 'NOTA DE VENTA';
            if (inv.type === InvoiceType.FACTURA) humType = 'FACTURA';
            else if (inv.type === InvoiceType.BOLETA) humType = 'BOLETA';
            
            return {
                'Periodo': period,
                'Correlativo': 'M0001',
                'Fecha de emisión': inv.date ? (new Date(inv.date).toLocaleDateString('es-PE')) : '---',
                'Fecha de vto': inv.deliveryDate ? (new Date(inv.deliveryDate).toLocaleDateString('es-PE')) : '---',
                'Tipo de comprobante': inv.type, 
                'Descripción comprobante': humType,
                'Serie': inv.serie,
                'Número': inv.correlativo,
                'Tipo doc cliente': docType,
                'Número doc cliente': inv.client?.docNumber || '---',
                'Nombre cliente': inv.client?.name || 'CLIENTE VARIOS',
                'Valor exportación': 0.00,
                'Base imponible': Number((inv.totals?.gravada || 0).toFixed(2)),
                'Exonerado': Number((inv.totals?.exonerada || 0).toFixed(2)),
                'Inafecto': Number((inv.totals?.inafecta || 0).toFixed(2)),
                'IGV (18%)': Number((inv.totals?.igv || 0).toFixed(2)),
                'ISC': 0.00,
                'Otros tributos': 0.00,
                'Total': Number((inv.totals?.total || 0).toFixed(2)),
                'Tipo de cambio': '1.000',
                'Moneda': 'PEN',
                'Estado SUNAT': inv.sunatStatus || 'INTERNO',
                'Estado Pago': (inv.prePaymentAmount || 0) >= inv.totals.total ? 'COBRADO' : 'PENDIENTE'
            };
        });

        const wb = XLSX.utils.book_new();
        
        // Crear hoja de ventas con encabezado personalizado
        const wsVentas = XLSX.utils.aoa_to_sheet([
            [commercialName.toUpperCase()],
            [`REGISTRO CENTRALIZADO DE TODAS LAS VENTAS (FACTURAS, BOLETAS, NOTAS DE Venta) - PERIODO ${periodTitle}`],
            [] // Espacio en blanco
        ]);

        // Agregar los datos debajo del encabezado
        XLSX.utils.sheet_add_json(wsVentas, ventasData, { origin: "A4" });

        // --- HOJA 2: DETALLE DE COBRANZA ---
        const invoiceIds = new Set(filteredInvoices.map(inv => inv.id));
        const matchedPayments = paymentsInRange.filter(p => invoiceIds.has(p.venta_id));

        const cobranzaData = matchedPayments.map(p => {
            const method = paymentMethods.find(m => m.id === p.metodo_pago_id);
            const dateStr = p.date || '';
            const isValidDate = dateStr && !isNaN(new Date(dateStr).getTime());
            
            // Find parent invoice for metadata
            const pInvoice = allInvoices.find(inv => inv.id === p.venta_id);
            let docCode = '---';
            let docDesc = 'NOTA DE VENTA';
            if (pInvoice) {
                docCode = `${pInvoice.serie}-${pInvoice.correlativo}`;
                if (pInvoice.type === InvoiceType.FACTURA) docDesc = 'FACTURA';
                else if (pInvoice.type === InvoiceType.BOLETA) docDesc = 'BOLETA';
            }

            return {
                'FECHA COBRO': isValidDate ? (new Date(dateStr).toLocaleDateString('es-PE')) : '---',
                'HORA': isValidDate ? new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---',
                'COMPROBANTE': docCode,
                'TIPO': docDesc,
                'CLIENTE': pInvoice?.client?.name || '---',
                'MÉTODO PAGO': (method ? method.name : 'OTROS').toUpperCase(),
                'MONTO COBRADO': Number(p.monto.toFixed(2))
            };
        });
        const wsCobranza = XLSX.utils.json_to_sheet(cobranzaData);

        // --- HOJA 3: RESUMEN DE RECAUDO ---
        const resumenData = stats.chartData.map(item => ({
            'MÉTODO DE PAGO': item.name.toUpperCase(),
            'TRANSACCIONES': item.count,
            'PORCENTAJE': `${item.percentage}%`,
            'TOTAL RECAUDADO': Number(item.value.toFixed(2))
        }));
        resumenData.push({
            'MÉTODO DE PAGO': 'TOTAL GENERAL',
            'TRANSACCIONES': stats.totalPaymentsCount,
            'PORCENTAJE': '100%',
            'TOTAL RECAUDADO': Number(stats.collected.toFixed(2))
        });
        const wsResumen = XLSX.utils.json_to_sheet(resumenData);

        // Column widths for Ventas
        const colWidths = [
            { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, 
            { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 32 }, { wch: 15 }, 
            { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, 
            { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }
        ];
        wsVentas['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas");
        XLSX.utils.book_append_sheet(wb, wsCobranza, "Detalle Cobranza");
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Pago");

        XLSX.writeFile(wb, `Reporte_Ventas_Contable_${periodTitle}.xlsx`);
    };

    const detailedTable = (
        <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-2 rounded-xl text-slate-700">
                        <TableIcon size={18} />
                    </div>
                    <div>
                        <h3 className="font-black text-xs uppercase text-slate-700 tracking-wider">
                            {activeTab === 'emitidos' ? 'Ventas y Documentos del Periodo' : 'Detalle de Cobros del Periodo'}
                        </h3>
                        <p className="text-slate-400 text-[10px] font-semibold uppercase mt-0.5">
                            Mostrando registros filtrados ordenados cronológicamente
                        </p>
                    </div>
                </div>
                <span className="bg-indigo-50/80 hover:bg-indigo-50 px-3.5 py-1.5 rounded-full text-[10px] font-bold text-indigo-600 border border-indigo-100 uppercase transition-all">
                    {activeTab === 'emitidos' ? filteredInvoices.length : filteredPayments.length} {activeTab === 'emitidos' ? 'Ventas' : 'Cobros'} encontradas
                </span>
            </div>

            {/* TABLE ELEMENT */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/20 text-slate-400">
                            {/* HEADERS */}
                            {activeTab === 'emitidos' ? (
                                <>
                                    <th className="p-4 pl-6 text-[10px] font-bold uppercase tracking-widest">Fecha Emisión</th>
                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest">Documento</th>
                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest">Cliente</th>
                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest">Tipo de Pago</th>
                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-right">Subtotal</th>
                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-right">Descuento</th>
                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-right">Op. Gravada</th>
                                    <th className="p-4 pr-6 text-[10px] font-bold uppercase tracking-widest text-right font-sans">Monto Total</th>
                                </>
                            ) : (
                                <>
                                    <th className="p-4 pl-6 text-[10px] font-bold uppercase tracking-widest">Fecha/Hora Cobro</th>
                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest">Documento Origen</th>
                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest">Cliente</th>
                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest">Método de Pago</th>
                                    <th className="p-4 pr-6 text-[10px] font-bold uppercase tracking-widest text-right font-sans">Monto Cobrado</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                        {activeTab === 'emitidos' ? (
                            paginatedInvoices.map((inv) => {
                                const paymentBreakdown = getInvoicePayments(inv);
                                
                                // Comprobante label details
                                let compColor = 'bg-rose-50 text-rose-700 border-rose-100';
                                let compName = 'N. VENTA';
                                if (inv.type === InvoiceType.FACTURA) {
                                    compColor = 'bg-blue-50 text-blue-700 border-blue-100';
                                    compName = 'FACTURA';
                                } else if (inv.type === InvoiceType.BOLETA) {
                                    compColor = 'bg-emerald-50 text-emerald-800 border-emerald-100';
                                    compName = 'BOLETA';
                                }

                                // Invoice Date parsing
                                const invDate = new Date(inv.fecha_emision || inv.date);
                                const displayDate = !isNaN(invDate.getTime()) 
                                    ? invDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : '---';
                                const displayTime = !isNaN(invDate.getTime()) 
                                    ? invDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
                                    : '---';

                                const isInvoiceFullyPaid = (inv.prePaymentAmount || 0) >= inv.totals.total;

                                return (
                                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                                        {/* FECHA EMISION */}
                                        <td className="p-4 pl-6 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 tracking-tight">{displayDate}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{displayTime}</span>
                                            </div>
                                        </td>

                                        {/* DOCUMENTO */}
                                        <td className="p-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${compColor}`}>
                                                    {compName}
                                                </span>
                                                <span className="font-mono font-bold text-slate-700">
                                                    {inv.serie}-{String(inv.correlativo).padStart(6, '0')}
                                                </span>
                                            </div>
                                        </td>

                                        {/* CLIENTE */}
                                        <td className="p-4">
                                            <div className="flex flex-col max-w-[200px] truncate">
                                                <span className="font-black text-slate-700 truncate capitalize">
                                                    {inv.client?.name?.toLowerCase() || 'cliente varios'}
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-400 font-semibold uppercase mt-0.5">
                                                    {inv.client?.docType || 'DNI'}: {inv.client?.docNumber || '00000000'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* TIPO DE PAGO */}
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                                                {paymentBreakdown.filter(p => p.amount > 0).map((p, idx) => (
                                                    <span 
                                                        key={idx} 
                                                        className={`border rounded-lg inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-1 tracking-tight shadow-sm ${getPaymentBadgeStyles(p.name)}`}
                                                    >
                                                        <span>{p.name}</span>
                                                        <span className="opacity-60">({currency}{p.amount.toFixed(1)})</span>
                                                    </span>
                                                ))}

                                                {paymentBreakdown.filter(p => p.amount > 0).length === 0 && (
                                                    <span className="bg-slate-50 text-slate-400 border border-slate-100 rounded-lg text-[9px] font-bold px-2 py-1 uppercase">
                                                        SIN COBROS
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* SUBTOTAL */}
                                        <td className="p-4 text-right whitespace-nowrap text-slate-700 font-medium font-sans">
                                            {currency} {(inv.totals?.total + Number((inv as any).descuento || (inv as any).discount || 0)).toFixed(2)}
                                        </td>

                                        {/* DESCUENTO */}
                                        <td className="p-4 text-right whitespace-nowrap text-rose-600 font-medium font-sans">
                                            {Number((inv as any).descuento || (inv as any).discount || 0) > 0 ? `-${currency} ${Number((inv as any).descuento || (inv as any).discount || 0).toFixed(2)}` : `${currency} 0.00`}
                                        </td>

                                        {/* OP. GRAVADA */}
                                        <td className="p-4 text-right whitespace-nowrap text-slate-800 font-bold font-sans">
                                            {currency} {(inv.totals?.gravada || (inv.totals?.total / 1.18)).toFixed(2)}
                                        </td>

                                        {/* MONTO */}
                                        <td className="p-4 pr-6 text-right whitespace-nowrap">
                                            <div className="flex flex-col items-end justify-center">
                                                <span className="font-black text-slate-800 text-sm tracking-tight">
                                                    {currency} {inv.totals?.total?.toFixed(2)}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-medium">
                                                    IGV: {currency} {(inv.totals?.igv || (inv.totals?.total - (inv.totals?.total / 1.18))).toFixed(2)}
                                                </span>
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border mt-1 select-none tracking-wider ${
                                                    isInvoiceFullyPaid 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                        : 'bg-rose-50 text-rose-700 border-rose-100'
                                                }`}>
                                                    {isInvoiceFullyPaid ? 'Liquidado' : 'Por Cobrar'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            paginatedPayments.map((p) => {
                                const inv = allInvoices.find(i => i.id === p.venta_id);
                                
                                // Comprobante label details
                                let compColor = 'bg-rose-50 text-rose-700 border-rose-100';
                                let compName = 'N. VENTA';
                                if (inv?.type === InvoiceType.FACTURA) {
                                    compColor = 'bg-blue-50 text-blue-700 border-blue-100';
                                    compName = 'FACTURA';
                                } else if (inv?.type === InvoiceType.BOLETA) {
                                    compColor = 'bg-emerald-50 text-emerald-800 border-emerald-100';
                                    compName = 'BOLETA';
                                }

                                // Date parsing
                                const pDate = new Date(p.date || '');
                                const displayDate = !isNaN(pDate.getTime()) 
                                    ? pDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : '---';
                                const displayTime = !isNaN(pDate.getTime()) 
                                    ? pDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
                                    : '---';

                                const methodObj = paymentMethods.find(m => m.id === p.metodo_pago_id);
                                const methodName = (methodObj ? methodObj.name : (p.metodo_pago_name || 'OTRO')).toUpperCase().trim();

                                return (
                                    <tr key={p.id || p.venta_id + p.date} className="hover:bg-slate-50/50 transition-colors group">
                                        {/* FECHA COBRO */}
                                        <td className="p-4 pl-6 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 tracking-tight">{displayDate}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{displayTime}</span>
                                            </div>
                                        </td>

                                        {/* DOCUMENTO ORIGEN */}
                                        <td className="p-4 whitespace-nowrap">
                                            {inv ? (
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-widest ${compColor}`}>
                                                        {compName}
                                                    </span>
                                                    <span className="font-mono font-bold text-slate-700">
                                                        {inv.serie}-{String(inv.correlativo).padStart(6, '0')}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 italic">No disponible</span>
                                            )}
                                        </td>

                                        {/* CLIENTE */}
                                        <td className="p-4">
                                            <div className="flex flex-col max-w-[200px] truncate">
                                                <span className="font-black text-slate-700 truncate capitalize">
                                                    {inv?.client?.name?.toLowerCase() || 'cliente varios'}
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-400 font-semibold uppercase mt-0.5">
                                                    {inv?.client?.docType || 'DNI'}: {inv?.client?.docNumber || '00000000'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* METODO DE PAGO */}
                                        <td className="p-4">
                                            <span 
                                                className={`border rounded-lg inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-1 tracking-tight shadow-sm ${getPaymentBadgeStyles(methodName)}`}
                                            >
                                                {methodName}
                                            </span>
                                        </td>

                                        {/* MONTO COBRADO */}
                                        <td className="p-4 pr-6 text-right whitespace-nowrap font-sans">
                                            <span className="font-black text-emerald-600 text-sm tracking-tight">
                                                + {currency} {p.monto.toFixed(2)}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}

                        {/* EMPTY STATE */}
                        {currentTotalItems === 0 && (
                            <tr>
                                <td colSpan={5} className="py-20 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3 opacity-35 max-w-sm mx-auto">
                                        <div className="bg-slate-100 p-4 rounded-full text-slate-400">
                                            <FileText size={48} />
                                        </div>
                                        <h6 className="font-black text-xs uppercase text-slate-600 tracking-wider">No se encontraron registros</h6>
                                        <p className="text-slate-400 text-[11px] leading-relaxed">
                                            Pruebe expandiendo el rango de fechas en el filtro superior o cambiando los comprobantes.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* PAGINATION PANEL */}
            {currentTotalItems > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 px-6 py-4 border-t border-slate-100">
                    {/* TRACKER */}
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                        Mostrando <span className="text-slate-700 font-extrabold">{Math.min(currentTotalItems, (currentPage - 1) * itemsPerPage + 1)}</span> a <span className="text-slate-700 font-extrabold">{Math.min(currentTotalItems, currentPage * itemsPerPage)}</span> de <span className="text-slate-700 font-extrabold">{currentTotalItems}</span> registros
                    </div>

                    {/* CONTROLS */}
                    <div className="flex items-center gap-1 hover:cursor-pointer select-none">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Anterior"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        
                        <div className="flex items-center gap-1">
                            {getPageNumbers().map(num => (
                                <button
                                    key={num}
                                    onClick={() => setCurrentPage(num)}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                        currentPage === num 
                                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10' 
                                            : 'hover:bg-slate-200/50 text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Siguiente"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* PAGE SIZE SELECTOR */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mostrar:</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-white border border-slate-200 text-xs font-bold text-slate-600 py-1 px-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 cursor-pointer focus:outline-none"
                        >
                            <option value={10}>10 filas</option>
                            <option value={15}>15 filas</option>
                            <option value={20}>20 filas</option>
                            <option value={30}>30 filas</option>
                            <option value={50}>50 filas</option>
                        </select>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="p-4 lg:p-8 h-full overflow-y-auto bg-slate-50 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* HEADER ROW */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600">
                            <FileText size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                                Contabilidad y Ventas
                            </h2>
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-0.5">
                                Conciliación local, SUNAT e informes contables
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        {/* BOTÓN RESUMEN RECAUDO */}
                        <button 
                            id="btn-ver-resumen"
                            onClick={() => setIsRecaudoModalOpen(true)}
                            className="flex-1 md:flex-none bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl border border-indigo-100 transition-all flex items-center justify-center gap-2"
                        >
                            <PieChartIcon size={16} />
                            Resumen de Recaudo
                        </button>

                        {/* EXCEL EXPORTER BUTTON */}
                        <button 
                            id="btn-exportar-excel"
                            onClick={handleExportExcel}
                            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl shadow-md hover:shadow-emerald-600/10 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <FileSpreadsheet size={16} />
                            Exportar Excel
                        </button>
                    </div>
                </div>

                {/* TABS SELECTOR */}
                <div className="flex gap-2 border-b border-slate-200/80 -mb-[1px] relative z-10 pl-2">
                    <button
                        onClick={() => {
                            setActiveTab('emitidos');
                            setFilterByType('VENTA');
                            setStartDate(getLocalDateString(firstDayOfMonth));
                            setEndDate(getLocalDateString(new Date()));
                        }}
                        className={`px-6 py-4 rounded-t-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border-t-2 border-x ${
                            activeTab === 'emitidos'
                                ? 'bg-white text-indigo-600 border-t-indigo-600 border-x-slate-200 -mb-[1px] relative z-10'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-transparent border-x-transparent'
                        }`}
                    >
                        <FileText size={16} />
                        1: Ventas del Mes (Emitidos)
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('cobranzas');
                            setFilterByType('COBRO');
                        }}
                        className={`px-6 py-4 rounded-t-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border-t-2 border-x ${
                            activeTab === 'cobranzas'
                                ? 'bg-white text-indigo-600 border-t-indigo-600 border-x-slate-200 -mb-[1px] relative z-10'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 border-transparent border-x-transparent'
                        }`}
                    >
                        <BadgeDollarSign size={16} />
                        2: Cobrado en el Periodo
                    </button>
                </div>

                {/* FILTERS PANEL */}
                <div className="bg-white p-6 rounded-b-[2rem] rounded-tr-[2rem] border border-slate-200/80 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                        <Filter className="text-slate-400" size={16} />
                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Filtros de Búsqueda</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {/* START DATE */}
                        <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Calendar size={12} /> Fecha Inicio
                            </label>
                            <input 
                                type="date" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans"
                            />
                        </div>

                        {/* END DATE */}
                        <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Calendar size={12} /> Fecha Fin
                            </label>
                            <input 
                                type="date" 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans"
                            />
                        </div>

                        {/* DOC TYPE FILTER */}
                        <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <FileText size={12} /> Comprobante
                            </label>
                            <select 
                                value={docTypeFilter}
                                onChange={(e) => setDocTypeFilter(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer font-sans"
                            >
                                <option value="ALL">TODOS LOS COMPROBANTES</option>
                                <option value={InvoiceType.FACTURA}>FACTURAS (01)</option>
                                <option value={InvoiceType.BOLETA}>BOLETAS (03)</option>
                                <option value={InvoiceType.NOTA_VENTA}>NOTAS DE VENTA (80)</option>
                            </select>
                        </div>

                        {/* PAYMENT STATUS FILTER */}
                        <div className="space-y-1.5 flex flex-col font-sans">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <BadgeDollarSign size={12} /> Estado Pago
                            </label>
                            <select 
                                value={paymentStatusFilter}
                                onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
                                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-3 text-xs font-extrabold text-slate-500 transition-all cursor-not-allowed uppercase"
                                disabled
                            >
                                <option value="ALL">TODO</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* REVENUE OVERVIEW & HISTORIC METRICS CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* TOTAL CARDS */}
                    <div className="bg-indigo-600 text-white py-4 px-5 rounded-2xl shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:rotate-6 transition-transform">
                            <BadgeDollarSign size={52} />
                        </div>
                        <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">
                            Total Emitido
                        </p>
                        <h4 className="text-2xl font-black tracking-tight mt-1">{currency} {stats.total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h4>
                    </div>

                    <div className="bg-emerald-600 text-white py-4 px-5 rounded-2xl shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:rotate-6 transition-transform">
                            <Wallet size={52} />
                        </div>
                        <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">
                            Total Cobrado
                        </p>
                        <h4 className="text-2xl font-black tracking-tight mt-1">{currency} {stats.collected.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h4>
                    </div>
                </div>

                {/* DYNAMIC VIEW ACCORDING TO THE ACTIVE TAB WITH HIGH-END RESPONSIVE LAYOUTS */}
                {activeTab === 'emitidos' ? (
                    <div className="space-y-6">
                        {/* DOC TYPE MINI BREAKDOWN */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* FACTURAS */}
                            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                <div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                        FACTURAS (01)
                                    </h5>
                                    <p className="text-xl font-extrabold text-slate-800">
                                        {currency} {documentBreakdown.facturasSum.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <span className="bg-blue-50 text-blue-700 border border-blue-100 font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wide">
                                    {documentBreakdown.facturasCount} docs
                                </span>
                            </div>

                            {/* BOLETAS */}
                            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                <div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                        BOLETAS (03)
                                    </h5>
                                    <p className="text-xl font-extrabold text-slate-800">
                                        {currency} {documentBreakdown.boletasSum.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wide">
                                    {documentBreakdown.boletasCount} docs
                                </span>
                            </div>

                            {/* NOTAS DE VENTA */}
                            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                <div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                        NOTAS DE VENTA (80)
                                    </h5>
                                    <p className="text-xl font-extrabold text-slate-800">
                                        {currency} {documentBreakdown.notasSum.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <span className="bg-rose-50 text-rose-700 border border-rose-100 font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wide">
                                    {documentBreakdown.notasCount} docs
                                </span>
                            </div>
                        </div>

                        {/* FULL WIDTH TABLE */}
                        {detailedTable}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LEFT COLUMN: RESUMEN DE COBRES POR METODO */}
                        <div className="lg:col-span-1 flex flex-col gap-6">
                            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200/80 shadow-sm flex flex-col gap-6">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <PieChartIcon className="text-indigo-600" size={16} />
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Resumen de Cobros</span>
                                </div>

                                {/* TOTAL GENERAL EN EL PERIODO */}
                                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-5 rounded-2xl shadow-sm">
                                    <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-80 mb-1">
                                        Total Recaudado en Periodo
                                    </p>
                                    <h3 className="text-2xl font-black">
                                        {currency}{stats.collected.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </h3>
                                    <p className="text-[9px] font-bold uppercase tracking-wider opacity-70 mt-1.5">
                                        {stats.totalPaymentsCount} Transacciones de pago
                                    </p>
                                </div>

                                {/* DISTRIBUCIÓN DETALLADA POR MÉTODO */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Métodos de Pago
                                    </h4>
                                    <div className="space-y-4">
                                        {stats.chartData.map((item, index) => (
                                            <div key={index} className="space-y-1.5 pb-2 border-b border-slate-50 last:border-0 font-sans">
                                                <div className="flex justify-between items-center text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${getPaymentBadgeStyles(item.name)}`}>
                                                            {item.name}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 font-mono">({item.count} ops)</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-extrabold text-slate-800">{currency}{item.value.toFixed(2)}</span>
                                                        <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded ml-1.5">{item.percentage}%</span>
                                                    </div>
                                                </div>
                                                {/* Percentage progress bar */}
                                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full rounded-full" 
                                                        style={{ 
                                                            width: `${item.percentage}%`,
                                                            backgroundColor: COLORS[index % COLORS.length] 
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        {stats.chartData.length === 0 && (
                                            <p className="text-slate-400 text-[11px] text-center py-6 italic">
                                                Sin cobros reportados en este periodo
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* PIE CHART IN PANEL */}
                                {stats.chartData.length > 0 && (
                                    <div className="h-44 w-full flex items-center justify-center relative bg-slate-50/50 rounded-2xl py-2">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={stats.chartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={36}
                                                    outerRadius={54}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                >
                                                    {stats.chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(val: any) => [`${currency} ${Number(val).toFixed(2)}`, 'Monto']} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Soles</span>
                                            <span className="text-xs font-black text-slate-600">PEN</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: THE DETAILED TABLE (2/3 columns) */}
                        <div className="lg:col-span-2">
                            {detailedTable}
                        </div>
                    </div>
                )}
            </div>

            {/* --- MODAL: RESUMEN DE RECAUDO POR METODOS DE PAGO --- */}
            <AnimatePresence>
                {isRecaudoModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]"
                        >
                            {/* MODAL HEADER */}
                            <div className="p-6 pb-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-100 text-indigo-600 p-2.5 rounded-xl">
                                        <PieChartIcon size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">
                                            Recaudo por Métodos de Pago
                                        </h3>
                                        <p className="text-slate-400 text-[10px] font-bold uppercase mt-0.5">
                                            Del {new Date(startDate).toLocaleDateString()} al {new Date(endDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={() => setIsRecaudoModalOpen(false)}
                                    className="p-2 hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 rounded-xl transition-all"
                                    title="Cerrar"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* MODAL CONTENT */}
                            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                                {/* OVERALL STATS COMPACT CARD */}
                                <div className="bg-indigo-600 text-white rounded-2xl p-5 shadow-sm text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">
                                        Total Recaudado en Periodo
                                    </p>
                                    <h2 className="text-3xl font-black">{currency} {stats.collected.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h2>
                                    <p className="text-[9px] font-bold uppercase tracking-wider opacity-70 mt-1.5">
                                        {stats.totalPaymentsCount} Transacciones de pago registradas
                                    </p>
                                </div>

                                {/* PIECHART VISUALIZATION & TABLE ANALYSIS */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                    {/* RECHARTS PIE */}
                                    <div className="h-44 w-full flex items-center justify-center relative">
                                        {stats.chartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={stats.chartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={45}
                                                        outerRadius={65}
                                                        paddingAngle={4}
                                                        dataKey="value"
                                                    >
                                                        {stats.chartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        formatter={(value: any) => [`S/ ${Number(value).toFixed(2)}`, 'Monto']}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="text-slate-300 uppercase text-[10px] font-bold text-center">
                                                Sin datos para gráfica
                                            </div>
                                        )}
                                        {/* Dynamic absolute inner label */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase">Soles</span>
                                            <span className="text-sm font-black text-slate-700">PEN</span>
                                        </div>
                                    </div>

                                    {/* COLOR LED CODE INDICATORS */}
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Distribución Recaudo</h4>
                                        <div className="space-y-2">
                                            {stats.chartData.map((item, index) => (
                                                <div key={index} className="flex justify-between items-center text-xs pb-1.5 border-b border-dashed border-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                                        <span className="font-extrabold text-slate-600 uppercase tracking-tight">{item.name}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-black text-slate-800">{currency}{item.value.toFixed(1)}</span>
                                                        <span className="text-[8px] font-bold text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded ml-1.5">{item.percentage}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {stats.chartData.length === 0 && (
                                                <p className="text-slate-400 text-xs text-center py-4">Sin operaciones registradas en el rango.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* GRANULAR TABLE IN MODAL */}
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <TableIcon size={14} /> Detalle Numérico Resumido
                                    </h4>
                                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                                        <div className="grid grid-cols-4 p-3 bg-slate-100/60 font-black text-[9px] text-slate-500 tracking-wider uppercase border-b border-slate-200">
                                            <span>Método Pago</span>
                                            <span className="text-center">Transacciones</span>
                                            <span className="text-right">Proporción</span>
                                            <span className="text-right">Suma Total</span>
                                        </div>
                                        <div className="divide-y divide-slate-150">
                                            {stats.chartData.map((item, index) => (
                                                <div key={index} className="grid grid-cols-4 p-3 text-xs items-center">
                                                    <span className="font-bold text-slate-700 uppercase">{item.name}</span>
                                                    <span className="text-center font-bold text-slate-500">{item.count} pagos</span>
                                                    <span className="text-right font-medium text-slate-500">{item.percentage}%</span>
                                                    <span className="text-right font-black text-slate-800">{currency}{item.value.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            ))}
                                            {stats.chartData.length > 0 && (
                                                <div className="grid grid-cols-4 p-3 text-xs items-center bg-slate-100/30 font-black border-t border-slate-200">
                                                    <span className="text-indigo-600 uppercase">Total General</span>
                                                    <span className="text-center text-slate-600">{stats.totalPaymentsCount}</span>
                                                    <span className="text-right text-slate-600">100%</span>
                                                    <span className="text-right text-indigo-600">{currency}{stats.collected.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* MODAL FOOTER */}
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                                <button 
                                    onClick={() => setIsRecaudoModalOpen(false)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wide px-6 py-3.5 rounded-xl shadow-md transition-all active:scale-95"
                                >
                                    Terminar Visualización
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Accounting;

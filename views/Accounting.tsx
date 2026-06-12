
import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, Company, PaymentMethodConfig, InvoiceType } from '../types';
import { dbGetPaymentsInRange } from '../services/dbService';
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
    TrendingUp
} from 'lucide-react';
import { 
    PieChart, 
    Pie, 
    Cell, 
    ResponsiveContainer, 
    Tooltip, 
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';
import * as XLSX from 'xlsx';

interface AccountingProps {
    invoices: Invoice[];
    paymentMethods: PaymentMethodConfig[];
    company: Company | null;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f43f5e', '#3b82f6'];

const Accounting: React.FC<AccountingProps> = ({ invoices, paymentMethods, company }) => {
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [docTypeFilter, setDocTypeFilter] = useState<string>('ALL');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('PAID'); // Default to PAID as requested
    const [filterByType, setFilterByType] = useState<'COBRO' | 'VENTA'>('COBRO');
    const [paymentsInRange, setPaymentsInRange] = useState<any[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = useState(false);

    const currency = company?.currencySymbol || 'S/';

    // --- FETCH PAYMENTS IN RANGE ---
    useEffect(() => {
        const fetchPayments = async () => {
            setIsLoadingPayments(true);
            try {
                const data = await dbGetPaymentsInRange(startDate, endDate);
                setPaymentsInRange(data);
            } catch (err) {
                console.error("Error fetching payments:", err);
            } finally {
                setIsLoadingPayments(false);
            }
        };
        fetchPayments();
    }, [startDate, endDate]);

    // --- FILTRADO VENTAS ---
    const filteredInvoices = useMemo(() => {
        if (filterByType === 'VENTA') {
            return invoices.filter(inv => {
                const date = (inv.date || '').slice(0, 10);
                const inDateRange = date >= startDate && date <= endDate;
                const matchesDocType = docTypeFilter === 'ALL' || inv.type === docTypeFilter;
                
                // Accountant logic: Only cares about what was collected
                const isPaid = (inv.prePaymentAmount || 0) >= inv.totals.total;
                const matchesPaymentStatus = paymentStatusFilter === 'ALL' || 
                                           (paymentStatusFilter === 'PAID' && isPaid) ||
                                           (paymentStatusFilter === 'PENDING' && !isPaid);

                return inDateRange && matchesDocType && matchesPaymentStatus;
            }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        } else {
            // Filtrar por COBRO: Facturas que tienen pagos en el rango
            const invoiceIdsWithPaymentsInRange = new Set(paymentsInRange.map(p => p.venta_id));
            return invoices.filter(inv => {
                const hasPaymentInRange = invoiceIdsWithPaymentsInRange.has(inv.id);
                const matchesDocType = docTypeFilter === 'ALL' || inv.type === docTypeFilter;
                
                const isPaid = (inv.prePaymentAmount || 0) >= inv.totals.total;
                const matchesPaymentStatus = paymentStatusFilter === 'ALL' || 
                                           (paymentStatusFilter === 'PAID' && isPaid) ||
                                           (paymentStatusFilter === 'PENDING' && !isPaid);

                return hasPaymentInRange && matchesDocType && matchesPaymentStatus;
            }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
    }, [invoices, paymentsInRange, startDate, endDate, docTypeFilter, paymentStatusFilter, filterByType]);

    // --- ESTADÍSTICAS ---
    const stats = useMemo(() => {
        const total = filteredInvoices.reduce((sum, inv) => sum + inv.totals.total, 0);
        const collected = paymentsInRange.reduce((sum, p) => sum + p.monto, 0);
        
        const byMethod: Record<string, number> = {};
        paymentsInRange.forEach(p => {
            const methodObj = paymentMethods.find(m => m.id === p.metodo_pago_id);
            const methodName = methodObj ? methodObj.name : 'OTROS';
            byMethod[methodName] = (byMethod[methodName] || 0) + p.monto;
        });

        const chartData = Object.entries(byMethod)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { total, collected, chartData };
    }, [filteredInvoices, paymentsInRange, paymentMethods]);

    // --- EXPORTACIÓN FORMATO 14.1 MODIFICADO ---
    const handleExportExcel = () => {
        // Filtrar solo Facturas y Boletas (Excluir Notas de Venta / Tipo 80)
        const validInvoices = filteredInvoices.filter(inv => 
            inv.type === InvoiceType.FACTURA || inv.type === InvoiceType.BOLETA
        );

        if (validInvoices.length === 0) {
            alert("No hay Facturas o Boletas para exportar en el periodo seleccionado.");
            return;
        }

        // Ordenar: Facturas primero, luego Boletas. Dentro de cada uno, por número descendente (más reciente primero)
        const sortedInvoices = [...validInvoices].sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === InvoiceType.FACTURA ? -1 : 1;
            }
            return b.correlativo - a.correlativo;
        });

        const [year, month] = startDate.split('-');
        const periodTitle = `${year}-${month}`;
        const commercialName = company?.razonSocial || 'LAVANDERIA LAVAFLASH';

        // --- HOJA 1: VENTAS ---
        const ventasData = sortedInvoices.map(inv => {
            const dateObj = new Date(inv.fecha_emision || inv.date);
            const period = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}00`;
            
            let docType = '0';
            const clientDocType = inv.client.docType?.toUpperCase();
            if (clientDocType === 'DNI') docType = '1';
            else if (clientDocType === 'RUC') docType = '6';
            
            return {
                'Periodo': period,
                'Correlativo': 'M0001',
                'Fecha de emisión': inv.date ? (new Date(inv.date).toLocaleDateString('es-PE')) : '---',
                'Tipo de comprobante': inv.type, 
                'Serie': inv.serie,
                'Número': inv.correlativo,
                'Tipo doc cliente': docType,
                'Número doc cliente': inv.client.docNumber,
                'Nombre cliente': inv.client.name,
                'Valor exportación': 0.00,
                'Base imponible': Number((inv.totals.gravada || 0).toFixed(2)),
                'Exonerado': Number((inv.totals.exonerada || 0).toFixed(2)),
                'Inafecto': Number((inv.totals.inafecta || 0).toFixed(2)),
                'IGV': Number((inv.totals.igv || 0).toFixed(2)),
                'ISC': 0.00,
                'Otros tributos': 0.00,
                'Total': Number((inv.totals.total || 0).toFixed(2)),
                'Tipo de cambio': '1.000',
                'Moneda': 'PEN',
                'Estado': inv.sunatStatus === 'REJECTED' ? 'RECHAZADO' : 'ACEPTADO'
            };
        });

        const wb = XLSX.utils.book_new();
        
        // Crear hoja de ventas con encabezado personalizado
        const wsVentas = XLSX.utils.aoa_to_sheet([
            [commercialName.toUpperCase()],
            [`REGISTRO DE VENTAS E INGRESOS DEL PERIODO ${periodTitle}`],
            [] // Espacio en blanco
        ]);

        // Agregar los datos debajo del encabezado
        XLSX.utils.sheet_add_json(wsVentas, ventasData, { origin: "A4" });

        // --- HOJA 2: DETALLE DE COBRANZA ---
        const cobranzaData = paymentsInRange.map(p => {
            const method = paymentMethods.find(m => m.id === p.metodo_pago_id);
            const dateStr = p.date || '';
            const isValidDate = dateStr && !isNaN(new Date(dateStr).getTime());
            
            return {
                'FECHA COBRO': isValidDate ? (new Date(dateStr).toLocaleDateString('es-PE')) : '---',
                'HORA': isValidDate ? new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---',
                'DOCUMENTO': p.invoice ? `${p.invoice.serie}-${p.invoice.correlativo}` : '---',
                'CLIENTE': p.invoice?.client?.name || '---',
                'MÉTODO PAGO': method ? method.name : 'OTROS',
                'MONTO': Number(p.monto.toFixed(2))
            };
        });
        const wsCobranza = XLSX.utils.json_to_sheet(cobranzaData);

        // --- HOJA 3: RESUMEN DE PAGO ---
        const resumenData = stats.chartData.map(item => ({
            'MÉTODO DE PAGO': item.name,
            'TOTAL RECAUDADO': Number(item.value.toFixed(2))
        }));
        resumenData.push({
            'MÉTODO DE PAGO': 'TOTAL GENERAL',
            'TOTAL RECAUDADO': Number(stats.collected.toFixed(2))
        });
        const wsResumen = XLSX.utils.json_to_sheet(resumenData);

        // Auto-ajuste de columnas para la hoja de ventas
        const colWidths = [
            { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, 
            { wch: 10 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, 
            { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, 
            { wch: 10 }, { wch: 15 }
        ];
        wsVentas['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, wsVentas, "Ventas");
        XLSX.utils.book_append_sheet(wb, wsCobranza, "Detalle Cobranza");
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Pago");

        XLSX.writeFile(wb, `Registro_Ventas_${year}_${month}.xlsx`);
    };

    return (
        <div className="p-6 lg:p-10 h-full overflow-y-auto bg-slate-50">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <FileText className="text-indigo-600" size={32} />
                            Módulo Contabilidad
                        </h2>
                        <p className="text-slate-500 font-medium mt-1">Reportes de ventas y conciliación para SUNAT</p>
                    </div>
                    <button 
                        onClick={handleExportExcel}
                        className="bg-emerald-600 text-white px-8 py-4 rounded-[2rem] font-bold text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center gap-3 active:scale-95"
                    >
                        <Download size={18} /> Exportar Excel Contable
                    </button>
                </div>

                {/* FILTERS */}
                <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp size={14} /> Filtrar por
                        </label>
                        <select 
                            value={filterByType}
                            onChange={(e) => setFilterByType(e.target.value as any)}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                        >
                            <option value="COBRO">FECHA DE COBRO (RECAUDO)</option>
                            <option value="VENTA">FECHA DE EMISIÓN (VENTA)</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Calendar size={14} /> Desde
                        </label>
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Calendar size={14} /> Hasta
                        </label>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Filter size={14} /> Tipo Documento
                        </label>
                        <select 
                            value={docTypeFilter}
                            onChange={(e) => setDocTypeFilter(e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                        >
                            <option value="ALL">TODOS LOS DOCUMENTOS</option>
                            <option value={InvoiceType.FACTURA}>FACTURAS</option>
                            <option value={InvoiceType.BOLETA}>BOLETAS</option>
                            <option value={InvoiceType.NOTA_VENTA}>NOTAS DE VENTA</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <BadgeDollarSign size={14} /> Estado de Pago
                        </label>
                        <select 
                            value={paymentStatusFilter}
                            onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all"
                        >
                            <option value="ALL">TODOS (COBRADOS Y PENDIENTES)</option>
                            <option value="PAID">SOLO COBRADOS (SUSTENTADOS)</option>
                            <option value="PENDING">SOLO PENDIENTES</option>
                        </select>
                    </div>
                </div>

                {/* DASHBOARD SUMMARY */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4 space-y-8">
                        <div className="bg-indigo-600 p-10 rounded-[3rem] text-white shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform"><BadgeDollarSign size={120} /></div>
                            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-4">
                                {filterByType === 'VENTA' ? 'Total Ventas (Emisión)' : 'Total Documentos con Cobros'}
                            </p>
                            <h4 className="text-5xl font-black tabular-nums leading-none">{currency} {stats.total.toFixed(2)}</h4>
                            <div className="mt-8 flex items-center gap-3 text-indigo-100">
                                <CheckCircle2 size={18} className="text-emerald-400" />
                                <span className="text-xs font-bold uppercase tracking-tight">Recaudo Total: {currency} {stats.collected.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                                <Wallet size={16} className="text-indigo-600" /> Resumen de Recaudo por Método
                            </h3>
                            
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 pb-4 border-b border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Método de Pago</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight text-right">Recaudo Total</span>
                                </div>
                                
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {stats.chartData.map((item, index) => (
                                        <div key={index} className="flex justify-between items-center group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                                <span className="text-xs font-bold text-slate-700 uppercase">{item.name}</span>
                                            </div>
                                            <span className="text-xs font-black text-slate-900 tabular-nums">
                                                {currency} {item.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    ))}
                                    
                                    {stats.chartData.length === 0 && (
                                        <div className="py-10 text-center opacity-30">
                                            <p className="text-[10px] font-bold uppercase">Sin recaudos en este periodo</p>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t-2 border-slate-100 flex justify-between items-center">
                                    <span className="text-xs font-black text-slate-900 uppercase">Total Recaudado</span>
                                    <span className="text-lg font-black text-indigo-600 tabular-nums">
                                        {currency} {stats.collected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-8 bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-8 bg-slate-50 border-b flex justify-between items-center">
                            <h3 className="font-bold text-xs uppercase text-slate-700 flex items-center gap-3">
                                <TableIcon size={18} /> Detalle de Documentos para Contabilidad
                            </h3>
                            <span className="bg-white px-4 py-2 rounded-full text-[10px] font-bold text-slate-500 border border-slate-200 uppercase">
                                {filteredInvoices.length} Documentos
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                                    <tr>
                                        <th className="p-6 text-[10px] uppercase tracking-widest">Fecha / Doc</th>
                                        <th className="p-6 text-[10px] uppercase tracking-widest">Cliente</th>
                                        <th className="p-6 text-[10px] uppercase tracking-widest">Base Imponible</th>
                                        <th className="p-6 text-[10px] uppercase tracking-widest">IGV (18%)</th>
                                        <th className="p-6 text-[10px] uppercase tracking-widest text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredInvoices.map((inv) => {
                                        // Helper to get payment breakdown for the tooltip/UI
                                        const paymentBreakdown = inv.payments && inv.payments.length > 0
                                            ? inv.payments.map(p => {
                                                const method = paymentMethods.find(m => m.id === p.metodo_pago_id);
                                                return { name: method ? method.name : 'Otro', amount: p.monto, date: p.date };
                                            })
                                            : [{ name: inv.paymentMethod || 'EFECTIVO', amount: inv.prePaymentAmount || 0, date: inv.date }];

                                        return (
                                            <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="p-6">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900">
                                                            {new Date(inv.date).toLocaleDateString()} 
                                                            <span className="text-[10px] text-slate-400 ml-2 font-medium">
                                                                {new Date(inv.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </span>
                                                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">{inv.type}: {inv.serie}-{inv.correlativo}</span>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700">{inv.client.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-medium">{inv.client.docNumber || 'SIN DOC'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-6 font-medium text-slate-600 tabular-nums">
                                                    {currency} {inv.totals.gravada.toFixed(2)}
                                                </td>
                                                <td className="p-6 font-medium text-slate-600 tabular-nums">
                                                    {currency} {inv.totals.igv.toFixed(2)}
                                                </td>
                                                <td className="p-6 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-black text-slate-900 tabular-nums">{currency} {inv.totals.total.toFixed(2)}</span>
                                                        
                                                        {/* Payment Breakdown Mini-list */}
                                                        <div className="flex flex-wrap justify-end gap-1 mt-1 max-w-[150px]">
                                                            {paymentBreakdown.filter(p => p.amount > 0).map((p, idx) => (
                                                                <div key={idx} className="flex flex-col items-end">
                                                                    <span className="text-[7px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                                                                        {p.name}: {p.amount.toFixed(1)}
                                                                    </span>
                                                                    {p.date && (
                                                                        <span className="text-[6px] text-slate-400 font-medium">
                                                                            {new Date(p.date).toLocaleDateString()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-1 ${
                                                            (inv.prePaymentAmount || 0) >= inv.totals.total 
                                                            ? 'bg-emerald-50 text-emerald-600' 
                                                            : 'bg-rose-50 text-rose-600'
                                                        }`}>
                                                            {(inv.prePaymentAmount || 0) >= inv.totals.total ? 'Cobrado' : 'Pendiente'}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredInvoices.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-20 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-20">
                                                    <FileText size={64} />
                                                    <p className="font-bold uppercase text-xs tracking-widest">No hay documentos en este rango</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* SUGGESTION BOX */}
                <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[3rem] flex flex-col md:flex-row items-center gap-8">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                        <Info size={32} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h4 className="font-bold text-indigo-900 text-lg">Sugerencia para Contabilidad: Reporte de Impuestos Mensual (IGV)</h4>
                        <p className="text-indigo-700/70 text-sm mt-2 leading-relaxed">
                            Para facilitar la declaración mensual, se recomienda generar un **Reporte de Compras vs Ventas**. 
                            Esto permitiría al contador calcular el crédito fiscal acumulado por la compra de insumos (detergentes, repuestos) 
                            frente al débito fiscal de las ventas, optimizando el pago de impuestos.
                        </p>
                    </div>
                    <button className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-sm hover:shadow-md transition-all shrink-0">
                        Ver Sugerencia
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Accounting;

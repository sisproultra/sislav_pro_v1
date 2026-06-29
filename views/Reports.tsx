
import React, { useState, useMemo, useEffect } from 'react';
import { 
    FileBarChart, Search, Download, Printer, Calendar, 
    TrendingDown, ArrowRight, Table as TableIcon, Filter,
    CheckCircle2, AlertCircle, FileText, ChevronRight,
    TrendingUp, BadgeDollarSign, PieChart as PieChartIcon,
    Users, ShoppingBag, Layers, Target, Clock, Star,
    CreditCard, BarChart2, Activity, Shirt, ArrowUpRight, Trophy, PackageCheck, Info
} from 'lucide-react';
import { Expense, Company, Invoice, Client, InvoiceType, PaymentMethodConfig } from '../types';
import { dbGetPaymentsReport, dbGetPaymentsTotalBefore } from '../services/dbService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';

interface ReportsProps {
    expenses: Expense[];
    invoices: Invoice[];
    clients: Client[];
    company: Company;
    paymentMethods: PaymentMethodConfig[];
}

// FIX: Updated 'CLIENTES' to 'CLIENTS' to match the IDs used in the code
type ReportSubModule = 'CLIENTS' | 'ESTADOS' | 'INGRESOS_EGRESOS';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f43f5e', '#3b82f6'];

const Reports: React.FC<ReportsProps> = ({ expenses, invoices, clients, company, paymentMethods }) => {
    const [activeTab, setActiveTab] = useState<ReportSubModule>('INGRESOS_EGRESOS');
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = useState(false);
    const [previousPaymentsTotal, setPreviousPaymentsTotal] = useState(0);

    // --- FETCH PAYMENTS IN RANGE ---
    useEffect(() => {
        const fetchPayments = async () => {
            setIsLoadingPayments(true);
            try {
                const [data, prevTotal] = await Promise.all([
                    dbGetPaymentsReport(startDate, endDate),
                    dbGetPaymentsTotalBefore(startDate)
                ]);
                setPayments(data);
                setPreviousPaymentsTotal(prevTotal);
            } catch (err) {
                console.error("Error fetching payments report in Reports:", err);
            } finally {
                setIsLoadingPayments(false);
            }
        };
        fetchPayments();
    }, [startDate, endDate]);
    
    const currency = company.currencySymbol || 'S/';
    const primaryColor = document.documentElement.style.getPropertyValue('--primary-color') || '#4f46e5';

    // --- FILTRADO COMÚN POR FECHAS ---
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const date = inv.date.split('T')[0];
            return date >= startDate && date <= endDate;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [invoices, startDate, endDate]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            const date = (exp.date || '').split('T')[0];
            return date >= startDate && date <= endDate;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [expenses, startDate, endDate]);

    // --- CÁLCULOS SUB-MÓDULO VENTAS ---
    const salesStats = useMemo(() => {
        const total = filteredInvoices.reduce((sum, inv) => sum + inv.totals.total, 0);
        const collected = filteredInvoices.reduce((sum, inv) => sum + (inv.prePaymentAmount || 0), 0);
        const boletas = filteredInvoices.filter(i => i.type === InvoiceType.BOLETA).length;
        const facturas = filteredInvoices.filter(i => i.type === InvoiceType.FACTURA).length;
        const notasVenta = filteredInvoices.filter(i => i.type === InvoiceType.NOTA_VENTA).length;

        return { total, collected, boletas, facturas, notasVenta };
    }, [filteredInvoices]);

    // --- CÁLCULOS SUB-MÓDULO EGRESOS ---
    const expenseStats = useMemo(() => {
        const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const categories = filteredExpenses.reduce((acc, e) => {
            const cat = e.category || 'GENERAL';
            acc[cat] = (acc[cat] || 0) + e.amount;
            return acc;
        }, {} as Record<string, number>);

        return { total, categories };
    }, [filteredExpenses]);

    // --- CÁLCULOS SUB-MÓDULO CLIENTES ---
    const clientStats = useMemo(() => {
        const map = new Map();
        filteredInvoices.forEach(inv => {
            const current = map.get(inv.client.name) || { total: 0, orders: 0 };
            map.set(inv.client.name, { total: current.total + inv.totals.total, orders: current.orders + 1 });
        });
        const topClients = Array.from(map.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        return { topClients, totalActive: map.size };
    }, [filteredInvoices]);

    // --- CÁLCULOS SUB-MÓDULO ESTADOS ---
    const statusStats = useMemo(() => {
        const counts: Record<string, number> = { PENDING: 0, READY: 0, DELIVERED: 0, IN_ROUTE_DELIVERY: 0 };
        filteredInvoices.forEach(inv => {
            const s = inv.orderStatus || 'PENDING';
            if (counts[s] !== undefined) counts[s]++;
            else if (['WASHING', 'DRYING'].includes(s)) counts['PENDING']++;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredInvoices]);

    // --- CÁLCULOS SUB-MÓDULO INGRESOS VS EGRESOS (BALANCES DE MOVIMIENTOS) ---
    const previousExpensesTotal = useMemo(() => {
        return expenses.reduce((sum, e) => {
            const date = (e.date || '').split('T')[0];
            return date < startDate ? sum + e.amount : sum;
        }, 0);
    }, [expenses, startDate]);

    const saldoAnterior = previousPaymentsTotal - previousExpensesTotal;

    const ledgerStats = useMemo(() => {
        const entries: {
            id: string;
            date: Date;
            dateStr: string;
            type: 'INGRESO' | 'EGRESO';
            description: string;
            method: string;
            haber: number;
            deber: number;
        }[] = [];

        payments.forEach((p, idx) => {
            const pDate = p.date ? new Date(p.date) : new Date();
            entries.push({
                id: `ingreso-${p.id || idx}`,
                date: pDate,
                dateStr: pDate.toLocaleString('es-PE'),
                type: 'INGRESO',
                description: `${p.ticket || 'TICKET'} - ${p.clientName || 'CLIENTE'}`,
                method: p.methodName || 'OTROS',
                haber: p.amount,
                deber: 0
            });
        });

        filteredExpenses.forEach((e, idx) => {
            const eDate = e.date ? new Date(e.date) : new Date();
            entries.push({
                id: `egreso-${e.id || idx}`,
                date: eDate,
                dateStr: isNaN(eDate.getTime()) ? (e.date || '---') : eDate.toLocaleString('es-PE'),
                type: 'EGRESO',
                description: e.description || 'EGRESO GENERAL',
                method: e.paymentMethod || 'EFECTIVO',
                haber: 0,
                deber: e.amount
            });
        });

        const sortedAsc = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());

        let currentBalance = saldoAnterior;
        const processedAsc = sortedAsc.map(entry => {
            currentBalance += (entry.haber - entry.deber);
            return {
                ...entry,
                runningBalance: currentBalance
            };
        });

        const totalHaber = payments.reduce((sum, p) => sum + p.amount, 0);
        const totalDeber = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const netUtility = totalHaber - totalDeber;

        // Grouping by payment method
        const incomeByMethod: Record<string, number> = {};
        const expenseByMethod: Record<string, number> = {};

        payments.forEach(p => {
            const m = (p.methodName || 'OTROS').toUpperCase().trim();
            incomeByMethod[m] = (incomeByMethod[m] || 0) + p.amount;
        });

        filteredExpenses.forEach(e => {
            const m = (e.paymentMethod || 'EFECTIVO').toUpperCase().trim();
            expenseByMethod[m] = (expenseByMethod[m] || 0) + e.amount;
        });

        return {
            entries: processedAsc, // Oldest to Newest
            totalHaber,
            totalDeber,
            netUtility,
            incomeByMethod,
            expenseByMethod
        };
    }, [payments, filteredExpenses, saldoAnterior]);

    const handlePrintLedger = () => {
        const logoUrl = company.logoUrl || 'https://iili.io/fXXft0Q.png';
        const saldoFinal = saldoAnterior + ledgerStats.totalHaber - ledgerStats.totalDeber;

        const initialRowHtml = `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px; background-color: #f8fafc; font-weight: bold;">
                <td style="padding: 4px 6px; color: #718096; font-style: italic;">---</td>
                <td style="padding: 4px 6px; color: #4a5568;"><span style="background-color: #e2e8f0; padding: 2px 4px; border-radius: 4px; font-size: 8px;">INICIAL</span></td>
                <td style="padding: 4px 6px; text-transform: uppercase; color: #4a5568;">SALDO ANTERIOR ACUMULADO</td>
                <td style="padding: 4px 6px; text-transform: uppercase; color: #718096;">---</td>
                <td style="padding: 4px 6px; text-align: right; color: #718096;">---</td>
                <td style="padding: 4px 6px; text-align: right; color: #718096;">---</td>
                <td style="padding: 4px 6px; text-align: right; color: #1a202c; font-family: monospace;">${currency} ${saldoAnterior.toFixed(2)}</td>
            </tr>
        `;

        const rowsHtml = initialRowHtml + ledgerStats.entries.map(e => `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px;">
                <td style="padding: 4px 6px; color: #4a5568;">${e.dateStr}</td>
                <td style="padding: 4px 6px; font-weight: bold; color: ${e.type === 'INGRESO' ? '#10b981' : '#ef4444'}">${e.type}</td>
                <td style="padding: 4px 6px; font-weight: bold; text-transform: uppercase;">${e.description}</td>
                <td style="padding: 4px 6px; text-transform: uppercase; color: #4a5568;">${e.method}</td>
                <td style="padding: 4px 6px; text-align: right; font-weight: bold; color: #10b981;">${e.haber > 0 ? `${currency} ${e.haber.toFixed(2)}` : '---'}</td>
                <td style="padding: 4px 6px; text-align: right; font-weight: bold; color: #ef4444;">${e.deber > 0 ? `${currency} ${e.deber.toFixed(2)}` : '---'}</td>
                <td style="padding: 4px 6px; text-align: right; font-weight: bold; color: #1a202c; font-family: monospace;">${currency} ${e.runningBalance.toFixed(2)}</td>
            </tr>
        `).join('');

        const incomeMethodsHtml = Object.entries(ledgerStats.incomeByMethod).map(([method, total]) => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; font-weight: bold; text-transform: uppercase; color: #334155;">${method}</td>
                <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #10b981;">${currency} ${total.toFixed(2)}</td>
            </tr>
        `).join('') || `<tr><td colspan="2" style="padding: 6px 0; text-align: center; color: #94a3b8; font-style: italic;">Sin ingresos registrados</td></tr>`;

        const expenseMethodsHtml = Object.entries(ledgerStats.expenseByMethod).map(([method, total]) => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 4px 0; font-weight: bold; text-transform: uppercase; color: #334155;">${method}</td>
                <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #ef4444;">-${currency} ${total.toFixed(2)}</td>
            </tr>
        `).join('') || `<tr><td colspan="2" style="padding: 6px 0; text-align: center; color: #94a3b8; font-style: italic;">Sin egresos registrados</td></tr>`;

        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>REPORTE DE INGRESOS VS EGRESOS</title>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2d3748; padding: 10px; background: white; margin: 0; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid ${company.primaryColor || '#0054A6'}; padding-bottom: 8px; margin-bottom: 15px; }
                    .header-title h1 { margin: 0; font-size: 18px; font-weight: 800; color: #1a202c; text-transform: uppercase; }
                    .header-title p { margin: 3px 0 0 0; font-size: 10px; font-weight: bold; color: #718096; text-transform: uppercase; letter-spacing: 1px; }
                    .header-logo { height: 40px; width: auto; object-fit: contain; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; font-size: 10px; font-weight: bold; }
                    .info-box { background: #f7fafc; padding: 8px 10px; border-radius: 6px; border: 1px solid #edf2f7; }
                    .info-box span { display: block; color: #718096; margin-bottom: 2px; text-transform: uppercase; font-size: 8px; letter-spacing: 0.5px; }
                    .stats-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 15px; }
                    .stat-card { padding: 8px 12px; border-radius: 8px; text-align: center; border: 1px solid #edf2f7; }
                    .stat-card.anterior { background: #f8fafc; border-color: #e2e8f0; color: #475569; }
                    .stat-card.ingresos { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
                    .stat-card.egresos { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
                    .stat-card.utilidad { background: #f5f3ff; border-color: #ddd6fe; color: #5b21b6; }
                    .stat-title { font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
                    .stat-value { font-size: 14px; font-weight: 900; }
                    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                    th { background-color: #f7fafc; color: #718096; font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 6px; text-align: left; border-bottom: 2px solid #edf2f7; }
                    td { padding: 4px 6px; border-bottom: 1px solid #edf2f7; }
                    .footer { text-align: center; margin-top: 20px; font-size: 9px; color: #a0aec0; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-top: 1px solid #edf2f7; padding-top: 8px; }
                    @media print {
                        body { padding: 0; }
                        button { display: none !important; }
                        .no-print { display: none !important; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-title">
                        <h1>${company.razonSocial || 'LAVANDERÍA'}</h1>
                        <p>Estado de Cuenta - Ingresos y Egresos</p>
                    </div>
                    ${logoUrl ? `<img src="${logoUrl}" class="header-logo" alt="Logo" />` : ''}
                </div>

                <div class="info-grid">
                    <div class="info-box">
                        <span>SUCURSAL</span>
                        ${company.nombre_comercial || company.razonSocial || 'SUCURSAL PRINCIPAL'}
                    </div>
                    <div class="info-box" style="text-align: right;">
                        <span>PERÍODO DE REPORTE</span>
                        DESDE ${startDate} HASTA ${endDate}
                    </div>
                </div>

                <div class="stats-row">
                    <div class="stat-card anterior">
                        <div class="stat-title">SALDO ANTERIOR</div>
                        <div class="stat-value">${currency} ${saldoAnterior.toFixed(2)}</div>
                    </div>
                    <div class="stat-card ingresos">
                        <div class="stat-title">INGRESOS PERÍODO</div>
                        <div class="stat-value">${currency} ${ledgerStats.totalHaber.toFixed(2)}</div>
                    </div>
                    <div class="stat-card egresos">
                        <div class="stat-title">EGRESOS PERÍODO</div>
                        <div class="stat-value">-${currency} ${ledgerStats.totalDeber.toFixed(2)}</div>
                    </div>
                    <div class="stat-card utilidad" style="${saldoFinal >= 0 ? 'background: #f5f3ff; border-color: #ddd6fe; color: #5b21b6;' : 'background: #fef2f2; border-color: #fecaca; color: #991b1b;'}">
                        <div class="stat-title">SALDO FINAL DE CAJA</div>
                        <div class="stat-value">${currency} ${saldoFinal.toFixed(2)}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Fecha/Hora</th>
                            <th>Tipo</th>
                            <th>Descripción / Detalle</th>
                            <th>Método / Cuenta</th>
                            <th style="text-align: right;">Ingreso (+)</th>
                            <th style="text-align: right;">Egreso (-)</th>
                            <th style="text-align: right;">Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <!-- RESUMEN POR TIPO DE PAGO -->
                <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; page-break-inside: avoid;">
                    <div style="background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 10px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px; letter-spacing: 0.5px;">Resumen de Ingresos por Medio de Pago</h3>
                        <table style="width: 100%; margin-top: 0; font-size: 10px; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 1px solid #cbd5e1;">
                                    <th style="padding: 4px 0; background: transparent; border: none; font-size: 9px; color: #64748b; text-align: left;">Método</th>
                                    <th style="padding: 4px 0; background: transparent; border: none; font-size: 9px; color: #64748b; text-align: right;">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${incomeMethodsHtml}
                            </tbody>
                        </table>
                    </div>

                    <div style="background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 10px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px; letter-spacing: 0.5px;">Resumen de Egresos por Medio de Pago</h3>
                        <table style="width: 100%; margin-top: 0; font-size: 10px; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 1px solid #cbd5e1;">
                                    <th style="padding: 4px 0; background: transparent; border: none; font-size: 9px; color: #64748b; text-align: left;">Método</th>
                                    <th style="padding: 4px 0; background: transparent; border: none; font-size: 9px; color: #64748b; text-align: right;">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${expenseMethodsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="footer">
                    Sislav POS • Reporte Generado el ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE')}
                </div>

                <div class="no-print" style="margin-top: 20px; text-align: center;">
                    <button onclick="window.print();" style="background-color: ${company.primaryColor || '#0054A6'}; color: white; padding: 10px 24px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; box-shadow: 0 3px 5px rgba(0,0,0,0.1);">Imprimir Reporte</button>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(content);
            printWindow.document.close();
        }
    };

    // --- ACCIONES DE EXPORTACIÓN ---
    const handleExport = () => {
        let dataToExport: any[] = [];
        let fileName = "";

        if (activeTab === 'INGRESOS_EGRESOS') {
            const initialRow = {
                'FECHA/HORA': '---',
                'TIPO': 'SALDO INICIAL',
                'DESCRIPCIÓN / DETALLE': 'SALDO ANTERIOR ACUMULADO (A LA FECHA DE INICIO)',
                'MÉTODO / CUENTA': '---',
                'HABER (INGRESOS)': 0,
                'DEBER (EGRESOS)': 0,
                'SALDO ACUMULADO': saldoAnterior
            };
            dataToExport = [
                initialRow,
                ...ledgerStats.entries.map(e => ({
                    'FECHA/HORA': e.dateStr,
                    'TIPO': e.type,
                    'DESCRIPCIÓN / DETALLE': e.description,
                    'MÉTODO / CUENTA': e.method,
                    'HABER (INGRESOS)': e.haber > 0 ? e.haber : 0,
                    'DEBER (EGRESOS)': e.deber > 0 ? e.deber : 0,
                    'SALDO ACUMULADO': e.runningBalance
                }))
            ];
            fileName = `REPORTE_HABER_DEBER_BALANCE_${startDate}_${endDate}`;
        }

        if (dataToExport.length === 0) return alert("Sin datos en el rango seleccionado.");

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
    };

    const saldoFinal = saldoAnterior + ledgerStats.totalHaber - ledgerStats.totalDeber;

    return (
        <div className="p-6 lg:p-10 h-full overflow-y-auto bg-slate-50 custom-scrollbar animate-in fade-in duration-500">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* 1. HEADER & GLOBAL FILTERS */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 text-indigo-600 font-bold text-xs uppercase tracking-[0.3em] mb-2">
                            <FileBarChart size={14} /> Inteligencia de Negocios
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">Reportes Consolidados</h2>
                        <p className="text-xs text-slate-500 font-medium">Analítica avanzada de su operación local.</p>
                    </div>

                    <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto">
                        <div className="flex items-center gap-3 px-4 border-r border-slate-100 flex-1 md:flex-none">
                            <Calendar className="text-indigo-500" size={16} />
                            <div className="flex flex-col">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Desde</span>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-xs font-bold outline-none text-slate-700 cursor-pointer" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 flex-1 md:flex-none">
                            <ArrowRight className="text-slate-300" size={14} />
                            <div className="flex flex-col">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Hasta</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-xs font-bold outline-none text-slate-700 cursor-pointer" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. SUB-MODULE NAVIGATION */}
                <div className="flex overflow-x-auto no-scrollbar bg-white p-1 rounded-2xl border border-slate-200 shadow-sm gap-1">
                    {[
                        { id: 'INGRESOS_EGRESOS', label: 'Balance General', icon: BarChart2, color: 'text-indigo-600', bg: 'bg-indigo-50/75' },
                        { id: 'CLIENTS', label: 'Clientes', icon: Users, color: 'text-violet-600', bg: 'bg-violet-50/75' },
                        { id: 'ESTADOS', label: 'Operativo', icon: Activity, color: 'text-sky-600', bg: 'bg-sky-50/75' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${
                                activeTab === tab.id 
                                ? `${tab.bg} ${tab.color} shadow-inner scale-[0.98]` 
                                : 'hover:bg-slate-50 text-slate-400'
                            }`}
                        >
                            <tab.icon size={15} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* 3. SUB-MODULE CONTENT */}
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                    
                    {/* --- CLIENTES --- */}
                    {/* FIX: Corrected comparison string to match type ReportSubModule */}
                    {activeTab === 'CLIENTS' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                                <h3 className="text-xs font-black uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <Trophy className="text-amber-500" size={16} /> Top 10 Clientes
                                </h3>
                                <div className="space-y-4">
                                    {clientStats.topClients.map((client, idx) => (
                                        <div key={idx} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg font-bold text-slate-200 group-hover:text-indigo-100 transition-colors">#{idx + 1}</span>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-xs uppercase text-slate-800 truncate">{client.name}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{client.orders} Órdenes</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-indigo-600 text-sm tabular-nums">{currency} {client.total.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[300px]">
                                <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12"><Users size={100} /></div>
                                <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-indigo-300 mb-4 relative z-10">Captación en Periodo</h3>
                                <h4 className="text-4xl font-black tracking-tight mb-1 relative z-10">{clientStats.totalActive}</h4>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 relative z-10">Clientes Atendidos</p>
                                <div className="mt-6 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-xl border border-white/10 relative z-10">
                                    <p className="text-[9px] font-bold uppercase opacity-60">Ticket Promedio Global</p>
                                    <p className="text-xl font-black uppercase mt-1 tabular-nums">{currency} {(salesStats.total / (filteredInvoices.length || 1)).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- ESTADOS --- */}
                    {activeTab === 'ESTADOS' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center min-w-0">
                                <h3 className="text-xs font-black uppercase tracking-wider w-full mb-6 flex justify-between items-center">
                                    Distribución Operativa
                                    <Activity className="text-sky-500" size={18} />
                                </h3>
                                <div className="w-full h-64 min-h-[256px] relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={statusStats}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={6}
                                                dataKey="value"
                                            >
                                                {statusStats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip 
                                                contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.08)' }}
                                                itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="grid grid-cols-2 gap-3 w-full mt-6">
                                    {statusStats.map((s, i) => (
                                        <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-0">
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                            <div className="min-w-0">
                                                <p className="text-[8px] font-bold text-slate-400 uppercase truncate">{s.name}</p>
                                                <p className="text-xs font-black text-slate-800 tabular-nums">{s.value} Unid.</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-md flex items-center justify-between group overflow-hidden">
                                    <div className="space-y-1 relative z-10">
                                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-75">Órdenes Entregadas</p>
                                        <h4 className="text-3xl font-black tabular-nums">{statusStats.find(s=>s.name==='DELIVERED')?.value || 0}</h4>
                                    </div>
                                    <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform">
                                        <PackageCheck size={32} />
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group overflow-hidden">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">En Planta (Por Lavar)</p>
                                        <h4 className="text-3xl font-black text-slate-900 tabular-nums">{statusStats.find(s=>s.name==='PENDING')?.value || 0}</h4>
                                    </div>
                                    <div className="bg-indigo-50 p-4 rounded-xl text-indigo-600 group-hover:rotate-12 transition-transform">
                                        <Shirt size={32} />
                                    </div>
                                </div>
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-4">
                                    <Info className="text-indigo-600 shrink-0" size={20} />
                                    <p className="text-[10px] font-bold text-indigo-900 uppercase leading-relaxed tracking-tight">
                                        Use estos datos para optimizar los tiempos de entrega y el uso de insumos en su planta de lavado.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- INGRESOS VS EGRESOS --- */}
                    {activeTab === 'INGRESOS_EGRESOS' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform text-slate-600">
                                        <Activity size={64} />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Saldo Anterior</p>
                                    <h4 className="text-2xl font-black text-slate-700 tabular-nums leading-none">
                                        {currency} {saldoAnterior.toFixed(2)}
                                    </h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-3">Acumulado antes del {startDate}</p>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform text-emerald-600">
                                        <TrendingUp size={64} />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ingresos del Periodo</p>
                                    <h4 className="text-2xl font-black text-emerald-600 tabular-nums leading-none">
                                        {currency} {ledgerStats.totalHaber.toFixed(2)}
                                    </h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-3">Cobros recibidos en este rango</p>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform text-rose-600">
                                        <TrendingDown size={64} />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Egresos del Periodo</p>
                                    <h4 className="text-2xl font-black text-rose-600 tabular-nums leading-none">
                                        {currency} {ledgerStats.totalDeber.toFixed(2)}
                                    </h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-3">Gastos registrados en este rango</p>
                                </div>

                                <div className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden group ${
                                    saldoFinal >= 0 
                                        ? 'bg-slate-900 text-white border-slate-850 shadow-slate-200/50' 
                                        : 'bg-rose-600 text-white border-rose-500 shadow-rose-200/50'
                                }`}>
                                    <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:rotate-12 transition-transform">
                                        <BadgeDollarSign size={64} />
                                    </div>
                                    <p className="text-[10px] font-bold text-white/75 uppercase tracking-widest mb-2">Saldo Final de Caja</p>
                                    <h4 className="text-2xl font-black tabular-nums leading-none">
                                        {currency} {saldoFinal.toFixed(2)}
                                    </h4>
                                    <div className="mt-3 flex gap-2">
                                        <button 
                                            onClick={handlePrintLedger} 
                                            className="bg-white text-slate-900 px-3 py-1.5 rounded-lg font-bold text-[8px] uppercase tracking-widest shadow-md hover:bg-slate-50 transition-all flex items-center gap-1 active:scale-95"
                                        >
                                            <Printer size={10} /> Imprimir Estado
                                        </button>
                                        <button 
                                            onClick={handleExport} 
                                            className="bg-slate-800 text-white border border-slate-700 px-3 py-1.5 rounded-lg font-bold text-[8px] uppercase tracking-widest shadow-md hover:bg-slate-700 transition-all flex items-center gap-1 active:scale-95"
                                        >
                                            <Download size={10} /> Excel
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* State of Account Table */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-w-0">
                                <div className="p-5 bg-slate-50 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div className="space-y-0.5">
                                        <h3 className="font-bold text-[11px] uppercase text-slate-700 flex items-center gap-2">
                                            <BarChart2 size={16} /> Historial de Movimientos de Caja (Ingresos y Egresos)
                                        </h3>
                                        <p className="text-[10px] font-medium text-slate-400">
                                            Estado consolidado de flujo de efectivo en orden cronológico ascendente (desde el más antiguo al más nuevo).
                                        </p>
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button 
                                            onClick={handlePrintLedger} 
                                            className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg transition-all shadow-sm font-bold text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                                        >
                                            <Printer size={12} /> Imprimir
                                        </button>
                                        <button 
                                            onClick={handleExport} 
                                            className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-sm font-bold text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5"
                                        >
                                            <Download size={12} /> Excel
                                        </button>
                                    </div>
                                </div>

                                {ledgerStats.entries.length === 0 ? (
                                    <div className="p-12 text-center text-slate-500 font-medium text-xs">
                                        No se encontraron ingresos ni egresos registrados en este rango de fechas.
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b bg-slate-50/50">
                                                    <th className="p-5">Fecha/Hora</th>
                                                    <th className="p-5">Tipo</th>
                                                    <th className="p-5">Descripción / Detalle</th>
                                                    <th className="p-5">Método / Cuenta</th>
                                                    <th className="p-5 text-right">Ingreso (+)</th>
                                                    <th className="p-5 text-right">Egreso (-)</th>
                                                    <th className="p-5 text-right">Saldo Acumulado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 text-xs">
                                                <tr className="bg-slate-50/50 hover:bg-slate-50 transition-colors font-bold">
                                                    <td className="p-5 font-bold text-slate-400 whitespace-nowrap">---</td>
                                                    <td className="p-5">
                                                        <span className="px-2 py-0.5 rounded-full font-bold uppercase text-[8px] bg-slate-150 text-slate-600">
                                                            INICIAL
                                                        </span>
                                                    </td>
                                                    <td className="p-5 text-slate-500 uppercase">
                                                        SALDO ANTERIOR ACUMULADO (A LA FECHA DE INICIO)
                                                    </td>
                                                    <td className="p-5 text-slate-400">---</td>
                                                    <td className="p-5 text-right text-slate-400">---</td>
                                                    <td className="p-5 text-right text-slate-400">---</td>
                                                    <td className={`p-5 text-right font-mono font-black text-xs ${saldoAnterior >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                                                        {currency} {saldoAnterior.toFixed(2)}
                                                    </td>
                                                </tr>
                                                {ledgerStats.entries.map((e) => (
                                                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-5 font-bold text-slate-500 whitespace-nowrap">
                                                            {e.dateStr}
                                                        </td>
                                                        <td className="p-5">
                                                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[8px] ${
                                                                e.type === 'INGRESO' 
                                                                    ? 'bg-emerald-50 text-emerald-700' 
                                                                    : 'bg-rose-50 text-rose-700'
                                                            }`}>
                                                                {e.type}
                                                            </span>
                                                        </td>
                                                        <td className="p-5 font-bold uppercase text-slate-800">
                                                            {e.description}
                                                        </td>
                                                        <td className="p-5">
                                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase text-[8px]">
                                                                {e.method}
                                                            </span>
                                                        </td>
                                                        <td className="p-5 text-right font-black text-emerald-600 text-xs">
                                                            {e.haber > 0 ? `${currency} ${e.haber.toFixed(2)}` : '---'}
                                                        </td>
                                                        <td className="p-5 text-right font-black text-rose-600 text-xs">
                                                            {e.deber > 0 ? `-${currency} ${e.deber.toFixed(2)}` : '---'}
                                                        </td>
                                                        <td className="p-5 text-right font-mono font-black text-slate-950 text-xs">
                                                            {currency} {e.runningBalance.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* RESUMEN POR TIPO DE PAGO */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <h4 className="font-bold text-[11px] uppercase text-slate-700 border-b pb-3 mb-3 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                        Resumen de Ingresos por Medio de Pago
                                    </h4>
                                    <div className="space-y-2">
                                        {Object.entries(ledgerStats.incomeByMethod).map(([method, total]) => (
                                            <div key={method} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                <span className="font-bold text-[9px] uppercase text-slate-600 tracking-wider">{method}</span>
                                                <span className="font-black text-emerald-600 text-xs tabular-nums">{currency} {total.toFixed(2)}</span>
                                            </div>
                                        ))}
                                        {Object.keys(ledgerStats.incomeByMethod).length === 0 && (
                                            <p className="text-[10px] text-slate-400 text-center py-3 font-medium italic">Sin ingresos registrados</p>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <h4 className="font-bold text-[11px] uppercase text-slate-700 border-b pb-3 mb-3 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                                        Resumen de Egresos por Medio de Pago
                                    </h4>
                                    <div className="space-y-2">
                                        {Object.entries(ledgerStats.expenseByMethod).map(([method, total]) => (
                                            <div key={method} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                <span className="font-bold text-[9px] uppercase text-slate-600 tracking-wider">{method}</span>
                                                <span className="font-black text-rose-600 text-xs tabular-nums">-{currency} {total.toFixed(2)}</span>
                                            </div>
                                        ))}
                                        {Object.keys(ledgerStats.expenseByMethod).length === 0 && (
                                            <p className="text-[10px] text-slate-400 text-center py-3 font-medium italic">Sin egresos registrados</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Reports;
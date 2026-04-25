import React, { useState, useRef, useEffect, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { Invoice, OrderStatus, Company, Client, PaymentMethodConfig, CartItem, InvoiceType, Contact } from '../types';
import {
    Search, Clock, CheckCircle2, Package, Trash2, Printer, Camera, X, Calendar,
    AlertTriangle, Phone, Eye, Image as ImageIcon, MessageSquare,
    ListFilter, Shirt, Check, Store, Truck, Smartphone, Loader2, Navigation,
    MoreVertical, PackageCheck, Send, Edit, Waves, Wind, DollarSign, Save, CreditCard, Banknote, QrCode, Landmark, Wallet,
    Square, CheckSquare, Maximize2, MapPin, ExternalLink, Info, History, ArrowLeft, Tag,
    ChevronLeft, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import OrderItemsDetailModal from '../components/OrderItemsDetailModal';
import OrderPrintModal from '../components/OrderPrintModal';
import DeliveryItemsModal from '../components/DeliveryItemsModal';
import OrderAuditModal from '../components/OrderAuditModal';
import LogisticsDispatchModal from '../components/LogisticsDispatchModal';
import Tracking from './Tracking';
import { dbUpdateInvoiceDiscount, dbGetInvoicesForReport } from '../services/dbService';
import { sendInvoiceViaWhatsApp, generateWhatsAppLink } from '../services/whatsappService';
import { formatOrderNumber } from '../utils/calculations';

interface MyOrdersProps {
    invoices: Invoice[];
    total: number;
    currentPage: number;
    onPageChange: (page: number, search: string) => void;
    onSearch: (page: number, search: string) => void;
    company: Company;
    onUpdateStatus: (id: string, status: OrderStatus) => Promise<void>;
    onEditOrder?: (invoice: Invoice) => void;
    onAddPayment?: (invoiceId: string, amount: number, method: string) => void;
    onUnifiedAction?: (orderId: string, payments: { amount: number, methodName: string }[], itemIds: string[], discount?: number) => Promise<void>;
    onAddClient: (client: Client) => Promise<Client>;
    paymentMethods: PaymentMethodConfig[];
    clients: Client[];
    onUpdateItemStatus: (orderId: string, itemIds: string[], status: OrderStatus, machineId?: string, duration?: number, totalKg?: number, proofImages?: string[]) => Promise<void>;
    canManage?: boolean;
    globalColors?: any[];
    ticketConfig?: any;
    globalStats?: { toCollect: number, toDeliver: number };
    currentUser?: { id: string, name: string, username: string };
    onOpenWaCampaign?: (contacts?: Contact[]) => void;
}

interface PaymentEntry {
    id: string;
    methodName: string;
    amount: number;
    isCash?: boolean;
}

const CircularProgress = ({ percent, color: customColor }: { percent: number; color?: string }) => {
    const radius = 20;
    const strokeWidth = 5;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    let color = customColor || "#94a3b8";
    if (!customColor) {
        if (percent === 0) color = "#e2e8f0";
        else if (percent > 0 && percent <= 30) color = "#f43f5e";
        else if (percent > 30 && percent < 100) color = "#f59e0b";
        else if (percent === 100) color = "#10b981";
    }

    return (
        <div className="relative flex items-center justify-center w-14 h-14 shrink-0 overflow-visible group">
            <svg height="52" width="52" viewBox="0 0 52 52" className="transform -rotate-90 drop-shadow-sm">
                {/* Background track */}
                <circle 
                    stroke="#f1f5f9" 
                    fill="transparent" 
                    strokeWidth={strokeWidth} 
                    r={radius} 
                    cx="26" 
                    cy="26" 
                />
                {/* Progress track */}
                <circle 
                    stroke={color} 
                    fill="transparent" 
                    strokeWidth={strokeWidth} 
                    strokeDasharray={circumference}
                    style={{ 
                        strokeDashoffset: strokeDashoffset, 
                        transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        filter: percent > 0 ? `drop-shadow(0 0 2px ${color}40)` : 'none'
                    }}
                    strokeLinecap="round" 
                    r={radius} 
                    cx="26" 
                    cy="26" 
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <span 
                        className="text-[10px] font-black leading-none tracking-tighter"
                        style={{ color: percent > 0 ? color : '#64748b' }}
                    >
                        {percent}%
                    </span>
                </div>
            </div>
            
            {/* Inner glow effect for 100% */}
            {percent === 100 && (
                <div className="absolute inset-2 bg-emerald-50 rounded-full -z-10 animate-pulse opacity-40" />
            )}
        </div>
    );
};

const MyOrders: React.FC<MyOrdersProps> = ({
    invoices, total, currentPage, onPageChange, onSearch, company, onUpdateStatus, onEditOrder, onAddPayment, onUnifiedAction, onAddClient, paymentMethods, clients, onUpdateItemStatus, canManage = true, globalColors = [], ticketConfig, globalStats, currentUser, onOpenWaCampaign
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [filterStatus, setFilterStatus] = useState<OrderStatus | 'ALL'>('ALL');
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<Invoice | null>(null);
    const [selectedOrderToPrint, setSelectedOrderToPrint] = useState<Invoice | null>(null);
    const [selectedOrderToDeliver, setSelectedOrderToDeliver] = useState<Invoice | null>(null);
    const [selectedOrderToPay, setSelectedOrderToPay] = useState<Invoice | null>(null);
    const [selectedOrderToDispatch, setSelectedOrderToDispatch] = useState<Invoice | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
    const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

    const [payAmount, setPayAmount] = useState('');
    const [payments, setPayments] = useState<PaymentEntry[]>([]);
    const [localDiscount, setLocalDiscount] = useState('');
    const [showDiscount, setShowDiscount] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedSummaryFilter, setSelectedSummaryFilter] = useState<'NONE' | 'TO_COLLECT' | 'TO_DELIVER'>('NONE');
    const [selectedItemsToDeliver, setSelectedItemsToDeliver] = useState<Set<string>>(new Set());

    const [sendingWaId, setSendingWaId] = useState<string | null>(null);
    const [sentSuccessIds, setSentSuccessIds] = useState<Set<string>>(new Set());

    const [selectedReportDate, setSelectedReportDate] = useState<string | null>(null);
    const [reportEndDate, setReportEndDate] = useState<string | null>(null);
    const [dailySalesTotal, setDailySalesTotal] = useState<number>(0);
    const [isCalculatingDailyTotal, setIsCalculatingDailyTotal] = useState(false);

    const [missingInfoOrder, setMissingInfoOrder] = useState<Invoice | null>(null);
    const [quickPhone, setQuickPhone] = useState('');
    const [quickMaps, setQuickMaps] = useState('');
    const [isUpdatingClient, setIsUpdatingClient] = useState(false);

    const [auditItemId, setAuditItemId] = useState<string | null>(null);
    const [auditItemName, setAuditItemName] = useState('');

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim() || '#0054A6';
    const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-secondary').trim() || '#10B981';
    const currency = company.moneda_simbolo || 'S/';

    // Debounce search
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (isSearching) {
                onSearch(1, searchTerm);
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, onSearch, isSearching]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTerm(val);
        
        // REGLAS DE BÚSQUEDA:
        // 1. Si está vacío, se marca para buscar (limpiar).
        // 2. Si es numérico puro, se marca para buscar (tickets cortos).
        // 3. Si es texto, solo si tiene 3 o más caracteres.
        const trimmedVal = val.trim();
        const isNumeric = trimmedVal !== '' && /^\d+$/.test(trimmedVal);
        
        if (trimmedVal === '' || isNumeric || trimmedVal.length >= 3) {
            setIsSearching(true);
        }
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        onSearch(1, '');
    };

    const totalPages = Math.ceil(total / 50); // 50 is the pageSize in App.tsx

    useEffect(() => {
        const handleClick = () => setOpenMenuId(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const stats = useMemo(() => {
        return invoices.reduce((acc, inv) => {
            if (inv.orderStatus === 'CANCELADO') return acc;
            const isDelivered = inv.orderStatus === 'ENTREGADO';
            const total = inv.totals?.total || 0;
            const paid = inv.prePaymentAmount || 0;
            const disc = inv.descuento || 0;
            const balance = total - disc - paid;
            
            if (balance > 0) acc.toCollect += balance;
            if (!isDelivered) acc.toDeliver += 1;
            
            return acc;
        }, { toCollect: 0, toDeliver: 0 });
    }, [invoices]);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            if (inv.orderStatus === 'CANCELADO') return false;
            if (inv.type === '07') return false;
            
            if (selectedSummaryFilter === 'TO_COLLECT') {
                const total = inv.totals?.total || 0;
                const paid = inv.prePaymentAmount || 0;
                const disc = inv.descuento || 0;
                return (total - disc - paid) > 0.01;
            }
            
            if (selectedSummaryFilter === 'TO_DELIVER') {
                return inv.orderStatus !== 'ENTREGADO';
            }
            
            return true;
        });
    }, [invoices, selectedSummaryFilter]);

    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            const allData = await dbGetInvoicesForReport(selectedSummaryFilter === 'NONE' ? 'ALL' : selectedSummaryFilter);
            if (!allData || allData.length === 0) {
                alert("No se encontraron órdenes para exportar con el filtro seleccionado.");
                return;
            }
            const data = allData.map(inv => ({
                'N° TICKET': inv.ticketNumber || `${inv.serie}-${inv.correlativo}`,
                'CLIENTE': inv.client?.name || 'Varios',
                'TELÉFONO': inv.client?.phone || '-',
                'FECHA ATENCIÓN': inv.date ? (new Date(inv.date).toISOString().slice(0, 10)) : 'N/A',
                'DEUDA': (inv.totals.total - (inv.descuento || 0) - (inv.prePaymentAmount || 0)).toFixed(2)
            }));

            const totalDeuda = allData.reduce((sum, inv) => sum + (inv.totals.total - (inv.descuento || 0) - (inv.prePaymentAmount || 0)), 0);
            const ws = utils.json_to_sheet(data);
            utils.sheet_add_aoa(ws, [
                [],
                ['GENERADO POR:', currentUser?.name || currentUser?.username || 'Sistema'],
                ['FECHA REPORTE:', new Date().toLocaleString()],
                ['TOTAL ÓRDENES:', allData.length],
                ['TOTAL DEUDA:', `S/ ${totalDeuda.toFixed(2)}`]
            ], { origin: -1 });

            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, 'Ordenes');
            writeFile(wb, `Reporte_Ordenes_${new Date().toISOString().split('T')[0]}.xlsx`);
        } finally { setIsExporting(false); }
    };

    const handleDailySalesReport = async (dateStr: string, endDateStr?: string) => {
        setSelectedReportDate(dateStr);
        setReportEndDate(endDateStr || null);
        setIsCalculatingDailyTotal(true);
        setIsReportModalOpen(false);
        try {
            const searchVal = endDateStr ? `${dateStr}:${endDateStr}` : dateStr;
            onSearch(1, searchVal);
            
            const allData = await dbGetInvoicesForReport('ALL');
            const dailyInvoices = allData.filter(inv => {
                const invDate = new Date(inv.date).toISOString().split('T')[0];
                if (endDateStr) {
                    return invDate >= dateStr && invDate <= endDateStr;
                }
                return invDate === dateStr;
            });
            const total = dailyInvoices.reduce((sum, inv) => sum + (inv.totals.total), 0);
            setDailySalesTotal(total);
        } catch (e) {
            console.error("Error calculating daily total:", e);
        } finally {
            setIsCalculatingDailyTotal(false);
        }
    };

    const clearDailyReport = () => {
        setSelectedReportDate(null);
        setReportEndDate(null);
        onSearch(1, ''); 
    };

    const handlePrintSummary = async () => {
        setIsExporting(true);
        try {
            const allData = await dbGetInvoicesForReport(selectedSummaryFilter === 'NONE' ? 'ALL' : selectedSummaryFilter);
            if (!allData || allData.length === 0) {
                alert("No se encontraron órdenes para imprimir con el filtro seleccionado.");
                return;
            }
            const printWindow = window.open('', '_blank');
            if (!printWindow) return;

            const totalDeuda = allData.reduce((sum, inv) => sum + (inv.totals.total - (inv.descuento || 0) - (inv.prePaymentAmount || 0)), 0);

            const content = `
                <html>
                    <head>
                        <title>Reporte de Órdenes</title>
                        <style>
                            body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 2mm; font-size: 14px; color: #000; line-height: 1.3; }
                            .header { text-align: center; border-bottom: 3px solid #000; margin-bottom: 10px; padding-bottom: 5px; }
                            .header h2 { margin: 0; font-size: 20px; text-transform: uppercase; font-weight: 900; }
                            .info { margin-bottom: 12px; font-size: 13px; border-bottom: 1px solid #000; padding-bottom: 5px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                            th { border-bottom: 2px solid #000; text-align: left; padding: 8px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; }
                            td { border-bottom: 1px dashed #666; padding: 10px 0; vertical-align: top; font-size: 12px; }
                            .ticket-col { width: 30%; }
                            .client-col { width: 45%; }
                            .debt-col { width: 25%; text-align: right; font-weight: bold; font-size: 13px; }
                            .summary { border-top: 3px solid #000; margin-top: 20px; padding-top: 10px; }
                            .summary-row { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px; font-size: 16px; }
                            .footer { text-align: center; margin-top: 25px; font-size: 11px; border-top: 1px solid #eee; padding-top: 8px; font-weight: bold; }
                            .sub-info { font-size: 11px; color: #333; display: block; margin-top: 4px; font-weight: normal; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h2>REPORTE ÓRDENES</h2>
                            <div style="font-weight: bold; font-size: 16px;">${company.razonSocial || 'TIENDA'}</div>
                        </div>
                        
                        <div class="info">
                            <strong>EMISIÓN:</strong> ${new Date().toLocaleString()}<br/>
                            <strong>USUARIO:</strong> ${(currentUser?.name || currentUser?.username || 'SISTEMA').toUpperCase()}<br/>
                            <strong>FILTRO:</strong> ${selectedSummaryFilter === 'TO_COLLECT' ? 'POR COBRAR' : selectedSummaryFilter === 'TO_DELIVER' ? 'POR ENTREGAR' : 'TODOS'}
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th class="ticket-col">TICKET/FECHA</th>
                                    <th class="client-col">CLIENTE/TEL.</th>
                                    <th class="debt-col">DEUDA</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allData.map(inv => `
                                    <tr>
                                        <td>
                                            <div style="font-weight: 900; font-size: 14px;">${inv.ticketNumber || `${inv.serie}-${inv.correlativo}`}</div>
                                            <span class="sub-info">${new Date(inv.date).toLocaleDateString()}</span>
                                        </td>
                                        <td>
                                            <div style="font-weight: bold;">${(inv.client?.name || 'VARIOS').toUpperCase()}</div>
                                            <span class="sub-info">📞 ${inv.client?.phone || '-'}</span>
                                        </td>
                                        <td class="debt-col">S/ ${(inv.totals.total - (inv.descuento || 0) - (inv.prePaymentAmount || 0)).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <div class="summary">
                            <div class="summary-row">
                                <span>TOTAL ÓRDENES:</span>
                                <span>${allData.length}</span>
                            </div>
                            <div class="summary-row" style="font-size: 18px; border-top: 1px solid #000; padding-top: 6px;">
                                <span>TOTAL DEUDA:</span>
                                <span>S/ ${totalDeuda.toFixed(2)}</span>
                            </div>
                        </div>

                        <div class="footer">
                            SISLAV AI POS - GESTIÓN TOTAL
                        </div>
                    </body>
                </html>
            `;

            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        } finally { setIsExporting(false); }
    };

    const getItemProgress = (inv: Invoice) => {
        const counts = { pending: 0, washing: 0, drying: 0, ready: 0, delivered: 0 };
        inv.items.forEach(item => {
            const isCanceled = (item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO';
            if (isCanceled) return;

            if (!item.status || item.status === 'PENDIENTE') counts.pending++;
            else if (item.status === 'EN_LAVADO') counts.washing++;
            else if (item.status === 'EN_SECADO') counts.drying++;
            else if (item.status === 'LISTO') counts.ready++;
            else if (item.status === 'ENTREGADO') counts.delivered++;
        });
        return counts;
    };

    const markAsSeenLocally = (id: string) => {
        const seen = JSON.parse(localStorage.getItem('sislav_seen_deliveries') || '[]');
        if (!seen.includes(id)) {
            seen.push(id);
            localStorage.setItem('sislav_seen_deliveries', JSON.stringify(seen));
        }
    };

    const handleSendWA = async (order: Invoice) => {
        if (!order.client.phone) {
            alert("El cliente no tiene un número de teléfono registrado.");
            return;
        }
        setSendingWaId(order.id);
        try {
            const res = await sendInvoiceViaWhatsApp(order, company, order.client.phone);
            if (res.success) {
                setSentSuccessIds(prev => new Set(prev).add(order.id));
            } else {
                if (res.fallbackUrl) window.open(res.fallbackUrl, '_blank');
                else alert("❌ Error: " + res.message);
            }
        } catch (e) {
            const link = generateWhatsAppLink(order, company, order.client.phone);
            window.open(link, '_blank');
        } finally {
            setSendingWaId(null);
        }
    };

    const handleDeliverItems = async (itemIds: string[]) => {
        if (!selectedOrderToDeliver) return;
        await onUpdateItemStatus(selectedOrderToDeliver.id, itemIds, 'ENTREGADO');
        setSelectedOrderToDeliver(null);
    };

    const handleOpenUnifiedModal = (inv: Invoice) => {
        setSelectedOrderToPay(inv);
        setPayments([]);
        setPayAmount('');
        setLocalDiscount(inv.descuento?.toString() || '');
        const readyIds = inv.items.filter(it => it.status === 'LISTO').map(it => it.id);
        setSelectedItemsToDeliver(new Set(readyIds));
    };

    const handleSendToRoute = (inv: Invoice) => {
        if (!inv.client.phone || !inv.client.googleMapsUrl || inv.client.phone.length < 5 || !inv.client.googleMapsUrl.startsWith('http')) {
            setQuickPhone(inv.client.phone || '');
            setQuickMaps(inv.client.googleMapsUrl || '');
            setMissingInfoOrder(inv);
        } else {
            markAsSeenLocally(inv.id);
            onUpdateStatus(inv.id, 'EN_RUTA');
        }
    };

    const handleSaveMissingInfo = async () => {
        if (!missingInfoOrder) return;
        if (!quickPhone || !quickMaps) {
            alert("El teléfono y la ubicación son requeridos para el delivery.");
            return;
        }
        setIsUpdatingClient(true);
        try {
            await onAddClient({ ...missingInfoOrder.client, phone: quickPhone, googleMapsUrl: quickMaps });
            markAsSeenLocally(missingInfoOrder.id);
            await onUpdateStatus(missingInfoOrder.id, 'EN_RUTA');
            setMissingInfoOrder(null);
        } catch (e) { alert("Error al actualizar datos del cliente."); } finally { setIsUpdatingClient(false); }
    };

    const toggleItemDelivery = (id: string) => {
        const next = new Set(selectedItemsToDeliver);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedItemsToDeliver(next);
    };

    const handleSelectAllToDeliver = () => {
        if (!selectedOrderToPay) return;
        const deliverableIds = selectedOrderToPay.items
            .filter(it => it.status !== 'ENTREGADO')
            .map(it => it.id);
        setSelectedItemsToDeliver(new Set(deliverableIds));
    };

    const handleAddPaymentEntry = (method: PaymentMethodConfig) => {
        if (!selectedOrderToPay) return;
        const total = selectedOrderToPay.totals.total;
        const alreadyPaid = selectedOrderToPay.prePaymentAmount || 0;
        const currentSessionPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        const currentDiscount = parseFloat(localDiscount) || 0;
        const pending = Math.max(0, total - currentDiscount - alreadyPaid - currentSessionPaid);

        if (pending <= 0) return;

        const isCash = method.sunatCode === '009' || method.name.toLowerCase().includes('efectivo');
        let amountVal = parseFloat(payAmount);

        if (isNaN(amountVal) || amountVal <= 0) {
            amountVal = pending;
        }

        if (!isCash && amountVal > pending) amountVal = pending;

        const newPayment: PaymentEntry = {
            id: Date.now().toString(),
            methodName: method.name.toUpperCase(),
            amount: amountVal,
            isCash: isCash
        };
        setPayments([...payments, newPayment]);
        setPayAmount('');
    };

    const removePaymentEntry = (id: string) => {
        setPayments(payments.filter(p => p.id !== id));
    };

    const handleConfirmUnifiedAction = async () => {
        if (!selectedOrderToPay || !onAddPayment) return;
        
        const orderId = selectedOrderToPay.id;
        const paymentsToProcess = [...payments];
        const itemsToDeliver = Array.from(selectedItemsToDeliver);
        const finalDisc = parseFloat(localDiscount) || 0;
        const hasDiscountChanged = finalDisc !== (selectedOrderToPay.descuento || 0);

        // Respuesta instantánea: Cerramos modal y limpiamos estados locales
        setSelectedOrderToPay(null);
        setSelectedItemsToDeliver(new Set());
        setPayments([]);

        // Ejecución asíncrona (optimista si el padre lo soporta)
        if (onUnifiedAction) {
            onUnifiedAction(orderId, paymentsToProcess, itemsToDeliver, hasDiscountChanged ? finalDisc : undefined);
        } else {
            // Fallback si no existe el handler unificado (aunque debería existir)
            setIsProcessingPayment(true);
            try {
                if (hasDiscountChanged) await dbUpdateInvoiceDiscount(orderId, finalDisc);
                for (const p of paymentsToProcess) { await onAddPayment(orderId, p.amount, p.methodName); }
                if (itemsToDeliver.length > 0) await onUpdateItemStatus(orderId, itemsToDeliver, 'ENTREGADO');
            } catch (e) { 
                alert("Error al procesar la operación en segundo plano."); 
            } finally { 
                setIsProcessingPayment(false); 
            }
        }
    };

    const getMethodIcon = (methodName: string, size: number = 16) => {
        const pm = paymentMethods.find(p => p.name.toUpperCase() === methodName.toUpperCase());
        const iconData = pm?.icon || '';
        if (iconData.startsWith('data:') || iconData.startsWith('http')) {
            return <img src={iconData} className="w-full h-full object-contain" />;
        }
        switch (iconData) {
            case 'banknote': return <Banknote size={size} />;
            case 'smartphone': return <Smartphone size={size} />;
            case 'qr-code': return <QrCode size={size} />;
            case 'landmark': return <Landmark size={size} />;
            case 'credit-card': return <CreditCard size={size} />;
            default: return <DollarSign size={size} />;
        }
    };

    const currentTotalPaidInModal = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalAmountInvoiced = selectedOrderToPay?.totals.total || 0;
    const previouslyPaid = selectedOrderToPay?.prePaymentAmount || 0;
    const discountVal = parseFloat(localDiscount) || 0;
    const totalToPayInModal = Math.max(0, totalAmountInvoiced - discountVal - previouslyPaid);
    const pendingInModal = Math.max(0, totalToPayInModal - currentTotalPaidInModal);
    const hasCashInModal = payments.some(p => p.isCash);
    const rawChangeInModal = currentTotalPaidInModal - totalToPayInModal;
    const changeInModal = (hasCashInModal && rawChangeInModal > 0) ? rawChangeInModal : 0;

    return (
        <div className="p-4 lg:p-6 h-full flex flex-col bg-gray-50 overflow-hidden">
            <style>{`
          @keyframes blink-red {
              0%, 100% { color: #ef4444; }
              50% { color: #991b1b; transform: scale(1.02); }
          }
          .animate-blink-red { animation: blink-red 0.8s infinite; display: inline-block; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

            <div className="max-w-full mx-auto w-full flex-1 flex flex-col overflow-hidden">

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                <Package className="text-brand-primary" /> Gestión de Órdenes
                            </h2>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Sislav AI • {filteredInvoices.length} Activos</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative group">
                                <div 
                                    onClick={() => setSelectedSummaryFilter(selectedSummaryFilter === 'TO_COLLECT' ? 'NONE' : 'TO_COLLECT')}
                                    className={`bg-white border ${selectedSummaryFilter === 'TO_COLLECT' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-100'} px-5 py-3 rounded-[2rem] flex flex-col items-center justify-center min-w-[110px] shadow-sm transition-all cursor-pointer hover:-translate-y-1 active:scale-95`}
                                >
                                    <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tighter leading-none">Por Cobrar</span>
                                    <span className="text-sm font-black text-amber-700 leading-tight">S/ {(globalStats?.toCollect || 0).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="relative group">
                                <div 
                                    onClick={() => setSelectedSummaryFilter(selectedSummaryFilter === 'TO_DELIVER' ? 'NONE' : 'TO_DELIVER')}
                                    className={`bg-white border ${selectedSummaryFilter === 'TO_DELIVER' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-100'} px-5 py-3 rounded-[2rem] flex flex-col items-center justify-center min-w-[110px] shadow-sm transition-all cursor-pointer hover:-translate-y-1 active:scale-95`}
                                >
                                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter leading-none">Por Entregar</span>
                                    <span className="text-sm font-black text-emerald-700 leading-tight">{globalStats?.toDeliver || 0} <span className="text-[8px] font-bold">und</span></span>
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSummaryFilter('TO_DELIVER');
                                        setIsReportModalOpen(true);
                                    }}
                                    className="absolute -top-1.5 -right-1.5 p-1.5 bg-black text-white rounded-full shadow-lg border border-white/20 hover:scale-110 active:scale-90 transition-all z-10"
                                    title="Imprimir Entregas"
                                >
                                    <Printer size={10} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        {selectedReportDate && (
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-white border-2 border-brand-primary px-4 py-2 rounded-2xl flex flex-col items-center justify-center min-w-[130px] shadow-lg shadow-brand-primary/10 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:scale-125 transition-transform">
                                    <DollarSign size={30} className="text-brand-primary" />
                                </div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[8px] font-black text-brand-primary uppercase tracking-widest">
                                        Venta: {selectedReportDate === new Date().toISOString().split('T')[0] && !reportEndDate ? 'HOY' : 
                                               reportEndDate ? `${selectedReportDate} al ${reportEndDate}` : selectedReportDate}
                                    </span>
                                    <button onClick={clearDailyReport} className="p-0.5 hover:bg-slate-100 rounded-full text-slate-400">
                                        <X size={10} />
                                    </button>
                                </div>
                                <span className="text-sm font-black text-slate-800 tabular-nums">
                                    {isCalculatingDailyTotal ? (
                                        <Loader2 size={14} className="animate-spin text-brand-primary" />
                                    ) : (
                                        `${currency} ${dailySalesTotal.toFixed(2)}`
                                    )}
                                </span>
                            </motion.div>
                        )}

                        <button 
                            onClick={() => {
                                setSelectedSummaryFilter('NONE');
                                setIsReportModalOpen(true);
                            }}
                            className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-600 hover:text-brand-primary hover:border-brand-primary/30 shadow-sm transition-all hover:scale-110 active:scale-90"
                            title="Opciones de Reporte General"
                        >
                            <ListFilter size={20} />
                        </button>

                        <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="N° Ticket, Nombre..."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-[1.2rem] text-sm font-bold focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary outline-none shadow-sm transition-all"
                                />
                                {searchTerm && (
                                    <button 
                                        onClick={handleClearSearch}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white rounded-[2rem] border border-gray-200 shadow-xl overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto">
                        {/* Desktop View Table */}
                        <div className="hidden lg:block">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="text-white sticky top-0 z-10" style={{ backgroundColor: primaryColor }}>
                                    <tr className="text-xs font-bold uppercase tracking-widest">
                                        <th className="px-6 py-6">Orden</th>
                                        <th className="px-6 py-6">Documento</th>
                                        <th className="px-6 py-6">Cliente</th>
                                        <th className="px-6 py-6">Finanzas</th>
                                        <th className="px-6 py-6 text-center">Progreso</th>
                                        <th className="px-6 py-6 text-center">Entregas</th>
                                        <th className="px-6 py-6 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredInvoices.map(inv => {
                                        const progress = getItemProgress(inv);
                                        const activeItems = inv.items.filter(it => !((it as any).estado_id === 9 || (it.status as any) === 'ANULADO' || it.status === 'CANCELADO'));
                                        const totalItemsCount = activeItems.length || 1;
                                        const deliveredPercent = Math.round((progress.delivered / totalItemsCount) * 100);
                                        const genDate = new Date(inv.date);
                                        const dateStr = genDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                        const timeStr = genDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
                                        const displayOrderNumber = (inv.ordenNumber && inv.ordenNumber !== '---') 
                                            ? inv.ordenNumber 
                                            : (inv.orderCorrelativoRaw ? formatOrderNumber(inv.orderCorrelativoRaw, company) : '---');
                                        const canSendToRoute = inv.orderStatus === 'LISTO';
                                        const isInRoute = inv.orderStatus === 'EN_RUTA';
                                        const isFullyDelivered = deliveredPercent === 100;
                                        const balance = inv.totals.total - (inv.descuento || 0) - (inv.prePaymentAmount || 0);

                                        return (
                                            <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-base font-bold inline-block shadow-sm w-fit border-2 border-indigo-100">{displayOrderNumber}</div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            <div className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border w-fit flex items-center gap-1.5 ${inv.origin === 'DELIVERY' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                                {inv.origin === 'DELIVERY' ? <Truck size={12} /> : <Store size={12} />}
                                                                {inv.origin === 'DELIVERY' ? 'DELIVERY' : 'TIENDA'}
                                                            </div>
                                                            {(() => {
                                                                const photos = [inv.url_foto_cliente_1, inv.url_foto_cliente_2, inv.url_foto_cliente_3].filter(Boolean) as string[];
                                                                if (photos.length === 0) return null;
                                                                return (
                                                                    <div 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setViewerPhotos(photos);
                                                                            setCurrentPhotoIndex(0);
                                                                        }}
                                                                        className="relative group/thumb cursor-pointer"
                                                                    >
                                                                        <img 
                                                                            src={photos[0]} 
                                                                            alt="Cliente" 
                                                                            className="w-8 h-8 rounded-lg object-cover border-2 border-white shadow-sm group-hover/thumb:scale-110 transition-transform" 
                                                                            referrerPolicy="no-referrer"
                                                                        />
                                                                        {photos.length > 1 && (
                                                                            <div className="absolute -top-1 -right-1 bg-brand-primary text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-sm">
                                                                                +{photos.length - 1}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                            {isInRoute && <div className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border w-fit flex items-center gap-1.5 bg-rose-600 text-white border-rose-700 animate-pulse"><Navigation size={12} /> EN RUTA</div>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-1.5 min-w-[140px]">
                                                        <span className={`px-2 py-0.5 rounded-md w-fit text-[10px] font-bold tracking-wider ${inv.type === InvoiceType.FACTURA ? 'bg-blue-100 text-blue-800' : (inv.type === InvoiceType.NOTA_VENTA ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}`}>{inv.type === InvoiceType.FACTURA ? 'FACTURA' : (inv.type === InvoiceType.NOTA_VENTA ? 'NOTA VENTA' : 'BOLETA')}</span>
                                                        <p className="text-xs text-slate-900 font-black font-mono tracking-tighter">{inv.serie}-{String(inv.correlativo).padStart(8, '0')}</p>
                                                        <div className="flex flex-col gap-1 mt-1">
                                                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight flex items-center gap-1.5">{dateStr}</p>
                                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight flex items-center gap-1.5"><Clock size={12} /> {timeStr}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="font-bold text-slate-800 uppercase text-sm leading-tight mb-2 tracking-tight">{inv.client?.name || 'CLIENTE VARIOS'}</div>
                                                    {inv.client?.phone && <div className="text-sm text-slate-600 font-medium flex items-center gap-2 mb-1"><Phone size={14} className="text-brand-primary" /> {inv.client.phone}</div>}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-1.5 max-w-[150px] text-xs font-black uppercase tracking-tight">
                                                        <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-400">Total:</span><span className="text-slate-900">S/ {inv.totals.total.toFixed(2)}</span></div>
                                                        <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-400">Pagado:</span><span className="text-blue-600">S/ {(inv.prePaymentAmount || 0).toFixed(2)}</span></div>
                                                        <div className="flex justify-between pt-1"><span className="text-slate-400">Saldo:</span><span className={balance > 0 ? 'text-rose-600 font-black' : 'text-emerald-600'}>S/ {balance.toFixed(2)}</span></div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex justify-center items-center">
                                                        <CircularProgress 
                                                            percent={Math.round(((progress.ready + progress.delivered) / totalItemsCount) * 100)} 
                                                            color="#3b82f6"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex justify-center items-center">
                                                        <CircularProgress percent={deliveredPercent} color="#10b981" />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex justify-center items-center gap-3">
                                                        <button 
                                                            onClick={() => handleSendWA(inv)} 
                                                            className={`w-10 h-10 rounded-full transition-all flex items-center justify-center relative shadow-sm border ${sendingWaId === inv.id ? 'bg-slate-100 border-slate-200' : 'bg-white hover:bg-emerald-50 border-slate-200 hover:border-emerald-300 active:scale-95'}`}
                                                            title="Enviar WhatsApp"
                                                        >
                                                            {sendingWaId === inv.id ? (
                                                                <Loader2 size={20} className="animate-spin text-emerald-600" />
                                                            ) : (
                                                                <>
                                                                    <img src="https://iili.io/fXXft0Q.png" className="w-5 h-5 object-contain" alt="WA" />
                                                                    {sentSuccessIds.has(inv.id) && (
                                                                        <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full shadow-lg border-2 border-white p-0.5">
                                                                            <Check size={8} className="text-white" strokeWidth={5} />
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </button>

                                                        {(!isFullyDelivered || balance > 0) ? (
                                                            <button 
                                                                onClick={() => canManage && handleOpenUnifiedModal(inv)} 
                                                                className={`h-9 px-4 rounded-full transition-all shadow-sm active:scale-95 font-bold text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 border ${
                                                                    balance > 0 
                                                                        ? 'bg-amber-500 border-amber-400 text-white hover:bg-amber-600' 
                                                                        : 'bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600'
                                                                } ${!canManage && 'opacity-50 grayscale cursor-not-allowed'}`}
                                                            >
                                                                {balance > 0 ? (
                                                                    <><DollarSign size={12} strokeWidth={3} /> COBRAR Y ENTREGAR</>
                                                                ) : (
                                                                    <><PackageCheck size={12} strokeWidth={2.5} /> ENTREGAR PEDIDO</>
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <div className="h-9 px-4 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center gap-2 font-bold text-[9px] uppercase tracking-widest">
                                                                <CheckCircle2 size={12} /> FINALIZADO
                                                            </div>
                                                        )}

                                                        <div className="relative">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === inv.id ? null : inv.id); }} 
                                                                className={`p-2 rounded-xl transition-all ${openMenuId === inv.id ? 'bg-slate-200 text-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                                            >
                                                                <MoreVertical size={20} />
                                                            </button>
                                                            {openMenuId === inv.id && (
                                                                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                                    <button onClick={() => { setSelectedOrderDetails(inv); setOpenMenuId(null); }} className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center gap-3 text-xs font-bold text-slate-600 transition-colors"><Eye size={16} className="text-indigo-500" /> Ver Detalles</button>
                                                                    <button onClick={() => { setSelectedOrderToPrint(inv); setOpenMenuId(null); }} className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3 text-xs font-bold text-slate-600 transition-colors border-t border-slate-50"><Printer size={16} className="text-slate-400" /> Reimprimir</button>
                                                                    <button onClick={() => { setTrackingOrderId(inv.id); setOpenMenuId(null); }} className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center gap-3 text-xs font-bold text-indigo-600 transition-colors border-t border-slate-50"><Navigation size={16} /> Ver Seguimiento</button>
                                                                    {canManage && (
                                                                        <button onClick={() => { setSelectedOrderToDispatch(inv); setOpenMenuId(null); }} className="w-full px-4 py-3 text-left hover:bg-amber-50 flex items-center gap-3 text-xs font-bold text-amber-600 transition-colors border-t border-slate-50"><Truck size={16} /> Despacho Logística</button>
                                                                    )}
                                                                    {canManage && canSendToRoute && !isInRoute && (
                                                                        <button onClick={() => { handleSendToRoute(inv); setOpenMenuId(null); }} className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 text-xs font-bold text-blue-600 transition-colors border-t border-slate-50"><Truck size={16} /> Enviar a Ruta</button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="lg:hidden p-4 space-y-4">
                            {filteredInvoices.map(inv => {
                                const progress = getItemProgress(inv);
                                const totalItemsCount = inv.items.length || 1;
                                const deliveredPercent = Math.round((progress.delivered / totalItemsCount) * 100);
                                const readyPercent = Math.round(((progress.ready + progress.delivered) / totalItemsCount) * 100);
                                const displayOrderNumber = (inv.ordenNumber && inv.ordenNumber !== '---') 
                                    ? inv.ordenNumber 
                                    : (inv.orderCorrelativoRaw ? formatOrderNumber(inv.orderCorrelativoRaw, company) : '---');
                                const balance = inv.totals.total - (inv.descuento || 0) - (inv.prePaymentAmount || 0);
                                const genDate = new Date(inv.date);
                                const dateStr = genDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });
                                const timeStr = genDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });

                                return (
                                    <div key={inv.id} className="bg-white border border-slate-100 rounded-[2rem] p-5 shadow-sm space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex flex-col gap-2">
                                                <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-sm font-bold w-fit border border-indigo-100">{displayOrderNumber}</div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">{dateStr} • {timeStr}</span>
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${inv.type === InvoiceType.FACTURA ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                        {inv.type === InvoiceType.FACTURA ? 'FACTURA' : 'BOLETA/NV'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                 <CircularProgress percent={readyPercent} color="#3b82f6" />
                                                 <CircularProgress percent={deliveredPercent} color="#10b981" />
                                            </div>
                                        </div>

                                        <div className="border-b border-slate-50 pb-3">
                                            <div className="font-bold text-slate-800 uppercase text-sm leading-tight tracking-tight">{inv.client?.name || 'CLIENTE VARIOS'}</div>
                                            {inv.client?.phone && (
                                                <div className="text-xs text-slate-600 font-medium mt-2 flex items-center gap-1.5">
                                                    <Phone size={12} className="text-brand-primary" /> {inv.client.phone}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between bg-slate-50/50 p-3 rounded-2xl border border-slate-50">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                                                <span className="text-xs font-black text-slate-900">S/ {inv.totals.total.toFixed(2)}</span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pendiente</span>
                                                <span className={`text-xs font-black ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>S/ {balance.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <button 
                                                onClick={() => handleSendWA(inv)}
                                                className="h-10 w-10 flex items-center justify-center bg-white border border-slate-200 rounded-full shadow-sm text-emerald-600 active:scale-95 transition-all"
                                            >
                                                <img src="https://iili.io/fXXft0Q.png" className="w-5 h-5 object-contain" alt="WA" />
                                            </button>

                                            <button 
                                                onClick={() => canManage && handleOpenUnifiedModal(inv)}
                                                style={{ backgroundColor: balance > 0 ? '#f59e0b' : '#10b981' }}
                                                className="flex-1 h-10 rounded-full text-[9px] font-bold text-white uppercase tracking-[0.1em] shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                                            >
                                                {balance > 0 ? <><DollarSign size={14} /> COBRAR Y ENTREGAR</> : <><PackageCheck size={14} /> ENTREGAR PEDIDO</>}
                                            </button>

                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === inv.id ? null : inv.id); }}
                                                className="h-10 w-10 flex items-center justify-center bg-slate-50 rounded-xl text-slate-400"
                                            >
                                                <MoreVertical size={20} />
                                            </button>
                                        </div>

                                        {openMenuId === inv.id && (
                                            <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 duration-200">
                                                <button onClick={() => { setSelectedOrderDetails(inv); setOpenMenuId(null); }} className="px-3 py-2.5 bg-slate-50 rounded-xl text-[9px] font-bold text-slate-600 uppercase flex items-center gap-2"><Eye size={12} className="text-indigo-500" /> Detalles</button>
                                                <button onClick={() => { setSelectedOrderToPrint(inv); setOpenMenuId(null); }} className="px-3 py-2.5 bg-slate-50 rounded-xl text-[9px] font-bold text-slate-600 uppercase flex items-center gap-2"><Printer size={12} className="text-slate-400" /> Ticket</button>
                                                <button onClick={() => { setTrackingOrderId(inv.id); setOpenMenuId(null); }} className="px-3 py-2.5 bg-slate-50 rounded-xl text-[9px] font-bold text-indigo-600 uppercase flex items-center gap-2"><Navigation size={12} /> Seguimiento</button>
                                                {canManage && (
                                                    <button onClick={() => { setSelectedOrderToDispatch(inv); setOpenMenuId(null); }} className="px-3 py-2.5 bg-slate-50 rounded-xl text-[9px] font-bold text-amber-600 uppercase flex items-center gap-2"><Truck size={12} /> Despacho</button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="px-6 py-5 bg-white border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-6 shrink-0">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                            Página {currentPage} de {totalPages || 1} • {total} Órdenes
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                disabled={currentPage === 1}
                                onClick={() => onPageChange(currentPage - 1, searchTerm)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm active:scale-95"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            
                            <div className="hidden sm:flex gap-1.5">
                                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                    const p = i + 1;
                                    return (
                                        <button 
                                            key={p}
                                            onClick={() => onPageChange(p, searchTerm)}
                                            style={currentPage === p ? { backgroundColor: primaryColor } : {}}
                                            className={`w-9 h-9 rounded-xl text-[10px] font-bold uppercase transition-all ${currentPage === p ? 'text-white shadow-lg' : 'bg-white border border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>

                            <button 
                                disabled={currentPage === totalPages || totalPages === 0}
                                onClick={() => onPageChange(currentPage + 1, searchTerm)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm active:scale-95"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL DE DESPACHO LOGÍSTICO */}
            {selectedOrderToDispatch && (
                <LogisticsDispatchModal 
                    isOpen={!!selectedOrderToDispatch}
                    onClose={() => setSelectedOrderToDispatch(null)}
                    invoice={selectedOrderToDispatch}
                    onSuccess={() => {
                        // Opcional: Recargar datos o mostrar notificación
                    }}
                />
            )}

            {/* MODAL PARA COMPLETAR DATOS FALTANTES DE DELIVERY */}
            {missingInfoOrder && (
                <div className="fixed inset-0 bg-slate-950/80 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95">
                        <div className="p-6 bg-blue-600 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3"><AlertTriangle size={24} /><div><h3 className="font-bold text-lg uppercase tracking-tight">Datos de Delivery</h3><p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">Información requerida para ruta</p></div></div>
                            <button onClick={() => setMissingInfoOrder(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-6 bg-slate-50">
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3 mb-2"><Info className="text-blue-600 shrink-0 mt-0.5" size={16} /><p className="text-[11px] text-blue-800 font-bold uppercase leading-tight">Faltan datos del cliente para que el motorizado pueda ubicarlo. Por favor, actualice:</p></div>
                            <div className="space-y-4">
                                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Teléfono de Contacto</label><div className="relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="tel" value={quickPhone} onChange={e => setQuickPhone(e.target.value.replace(/\D/g, ''))} className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-blue-500 transition-all shadow-inner" placeholder="999888777" /></div></div>
                                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Ubicación Google Maps (URL)</label><div className="relative"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" value={quickMaps} onChange={e => setQuickMaps(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-blue-600 underline outline-none focus:border-blue-500 transition-all shadow-inner text-xs" placeholder="https://maps.app.goo.gl/..." /></div></div>
                            </div>
                        </div>
                        <div className="p-6 bg-white border-t border-slate-100"><button onClick={handleSaveMissingInfo} disabled={isUpdatingClient || !quickPhone || !quickMaps} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">{isUpdatingClient ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle2 size={20} /> GUARDAR Y ENVIAR A RUTA</>}</button></div>
                    </div>
                </div>
            )}

            {/* MODAL UNIFICADO: COBRO Y GESTIÓN DE ENTREGA - OPTIMIZADO PARA NO SCROLL Y UX */}
            {selectedOrderToPay && (
                <div className="fixed inset-0 bg-slate-950/95 z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-5xl shadow-[0_0_80px_rgba(0,0,0,0.4)] overflow-hidden border border-white/20 flex flex-col md:flex-row max-h-[95vh] sm:max-h-[92vh] animate-in slide-in-from-bottom sm:zoom-in-95">

                        {/* PANEL IZQUIERDO: CAJA / PAGOS */}
                        <div className="w-full md:w-5/12 p-5 md:p-6 border-b md:border-b-0 md:border-r border-slate-100 bg-white flex flex-col overflow-hidden shrink-0 md:shrink">
                            <div className="flex items-center justify-between mb-4 md:mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl text-white shadow-lg shadow-indigo-100" style={{ backgroundColor: primaryColor }}><DollarSign size={20} /></div>
                                    <div>
                                        <h3 className="font-bold text-base md:text-lg uppercase tracking-tight leading-none">Cerrar Cuenta</h3>
                                        <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Orden #{selectedOrderToPay.ordenNumber}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedOrderToPay(null)} className="md:hidden p-2 text-slate-400"><X size={20} /></button>
                            </div>

                            <div className="space-y-3 overflow-y-auto no-scrollbar md:flex-1 md:flex md:flex-col md:space-y-4">
                                <div className="grid grid-cols-2 gap-2.5 md:gap-3 shrink-0">
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 block">Total</span>
                                        <p className="text-base md:text-lg font-bold text-slate-900 leading-none">{currency} {totalAmountInvoiced.toFixed(2)}</p>
                                    </div>
                                    <div className="p-3 rounded-2xl border bg-slate-50 border-slate-100">
                                        <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5 block">Abonado</span>
                                        <p className="text-base md:text-lg font-bold text-indigo-600 leading-none">{currency} {previouslyPaid.toFixed(2)}</p>
                                    </div>
                                </div>

                                <div className="bg-slate-900 p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] shadow-xl text-white text-center relative overflow-hidden group shrink-0">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700 hidden md:block"><DollarSign size={80} /></div>
                                    <span className="text-[8px] md:text-[9px] font-bold text-indigo-300 uppercase tracking-[0.3em] mb-1 md:mb-2 block relative z-10">Saldo Pendiente</span>
                                    <h4 className="text-2xl md:text-4xl font-bold tabular-nums tracking-tight relative z-10 leading-none">
                                        {currency} {pendingInModal.toFixed(2)}
                                    </h4>
                                    {changeInModal > 0 && (
                                        <div className="mt-2 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg text-[9px] md:text-[10px] font-bold uppercase inline-flex items-center gap-1.5 border border-emerald-500/30 relative z-10">
                                            Vuelto: {currency} {changeInModal.toFixed(2)}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3 shrink-0">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                <Tag size={12} className="text-indigo-600" /> Aplicar Descuento
                                            </label>
                                            <button 
                                                onClick={() => setShowDiscount(!showDiscount)}
                                                className={`w-10 h-5 rounded-full transition-all relative ${showDiscount ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                            >
                                                <div className={`absolute top-0.5 h-4 w-4 bg-white rounded-full transition-all ${showDiscount ? 'left-5.5' : 'left-0.5'}`} />
                                            </button>
                                        </div>
                                        
                                        <AnimatePresence>
                                            {showDiscount && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="relative pt-2">
                                                        <span className="absolute left-4 top-[58%] -translate-y-1/2 text-slate-300 font-bold text-base md:text-xl">{currency}</span>
                                                        <input 
                                                            type="number" 
                                                            value={localDiscount} 
                                                            onChange={e => setLocalDiscount(e.target.value)} 
                                                            className="w-full bg-white border-2 border-slate-100 rounded-xl px-12 py-2.5 md:py-3 text-lg md:text-xl font-bold outline-none focus:border-indigo-500 transition-all shadow-sm text-slate-800" 
                                                            placeholder="0.00" 
                                                        />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div className="relative">
                                        <style>{`
                                            @keyframes neon-pulse {
                                                0% { box-shadow: 0 0 5px #4f46e5, 0 0 10px #4f46e5; border-color: #4f46e5; }
                                                50% { box-shadow: 0 0 15px #4f46e5, 0 0 25px #6366f1; border-color: #6366f1; }
                                                100% { box-shadow: 0 0 5px #4f46e5, 0 0 10px #4f46e5; border-color: #4f46e5; }
                                            }
                                            .neon-pulse-input {
                                                animation: neon-pulse 1.5s infinite;
                                            }
                                        `}</style>
                                        <input
                                            type="number"
                                            value={payAmount}
                                            onChange={e => setPayAmount(e.target.value)}
                                            placeholder={pendingInModal > 0 ? `Cobro (${currency} ${pendingInModal.toFixed(2)})` : "0.00"}
                                            className="w-full bg-white border-4 border-indigo-500 rounded-2xl px-5 py-3 md:py-4 text-2xl md:text-3xl font-black text-slate-900 outline-none transition-all shadow-2xl neon-pulse-input text-center placeholder:text-slate-300"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex md:grid md:grid-cols-5 gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                                        {paymentMethods.filter(pm => pm.isActive).map(pm => (
                                            <button
                                                key={pm.id}
                                                onClick={() => handleAddPaymentEntry(pm)}
                                                disabled={pendingInModal <= 0}
                                                className="bg-white border-2 border-slate-100 p-3 md:p-2.5 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center disabled:opacity-30 disabled:grayscale group shadow-sm min-w-[50px] shrink-0"
                                                title={pm.name}
                                            >
                                                <div className="group-hover:scale-110 transition-transform duration-500">{getMethodIcon(pm.name, 20)}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="hidden md:block flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                                    {payments.length === 0 ? (
                                        <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl">
                                            <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Sin abonos en esta sesión</p>
                                        </div>
                                    ) : (
                                        payments.map(p => (
                                            <div key={p.id} className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center justify-between animate-in slide-in-from-right-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">{getMethodIcon(p.methodName, 12)}</div>
                                                    <span className="text-[9px] font-bold text-slate-600 uppercase truncate max-w-[120px]">{p.methodName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-[11px] text-slate-900">{currency} {p.amount.toFixed(2)}</span>
                                                    <button onClick={() => removePaymentEntry(p.id)} className="p-1.5 text-slate-200 hover:text-red-500 transition-colors bg-slate-50 rounded-lg"><Trash2 size={12} /></button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* PANEL DERECHO: ENTREGA / ITEMS */}
                        <div className="w-full md:w-7/12 p-5 md:p-6 bg-slate-50 flex flex-col overflow-hidden grow md:grow-0">
                            <div className="flex items-center justify-between mb-4 md:mb-5 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl text-white shadow-lg shadow-emerald-100" style={{ backgroundColor: secondaryColor }}><PackageCheck size={20} /></div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-sm md:text-lg uppercase tracking-tight leading-none truncate">{selectedOrderToPay.client.name}</h3>
                                        <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestión de entrega física</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleSelectAllToDeliver}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 md:px-4 py-2 rounded-xl font-bold text-[8px] md:text-[9px] uppercase tracking-widest transition-all shadow-md active:scale-95 flex items-center gap-2"
                                >
                                    <CheckSquare size={14} /> TODO
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 mb-4">
                                {selectedOrderToPay.items.map(it => {
                                    const isDelivered = it.status === 'ENTREGADO';
                                    const isReady = it.status === 'LISTO';
                                    const isSelected = selectedItemsToDeliver.has(it.id);

                                    return (
                                        <div
                                            key={it.id}
                                            className={`p-3 rounded-2xl border-2 transition-all flex flex-col gap-2 ${isDelivered ? 'bg-slate-200 border-slate-200 opacity-60 cursor-not-allowed' :
                                                isSelected ? 'bg-white border-emerald-500 shadow-md ring-4 ring-emerald-50/50' :
                                                    'bg-white border-white hover:border-slate-200 shadow-sm'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 grow" onClick={() => !isDelivered && toggleItemDelivery(it.id)}>
                                                    <div className="cursor-pointer shrink-0">
                                                        {isDelivered ? <CheckCircle2 size={18} className="text-slate-400" /> :
                                                            isSelected ? <CheckSquare size={18} className="text-emerald-600" /> :
                                                                <Square size={18} className="text-slate-200" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`font-bold text-[11px] md:text-xs uppercase truncate max-w-[120px] md:max-w-[180px] ${isSelected ? 'text-emerald-900' : 'text-slate-700'}`}>{it.quantity} x {it.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className={`text-[7px] md:text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${isDelivered ? 'bg-slate-300 text-slate-600' :
                                                                isReady ? 'bg-emerald-100 text-emerald-600' :
                                                                    'bg-orange-100 text-orange-600'
                                                                }`}>
                                                                {isDelivered ? 'ENTREGADO' : isReady ? 'LISTO' : 'PROCESANDO'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className="text-right mr-2">
                                                        <p className="text-[8px] font-bold text-slate-400 leading-none mb-0.5">{currency} {(it.price || 0).toFixed(2)} <span className="text-[7px] opacity-70 italic">c/u</span></p>
                                                        <p className="text-[11px] font-black text-slate-900 leading-none">{currency} {(it.subtotal || 0).toFixed(2)}</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setAuditItemId(it.id); setAuditItemName(it.name); }}
                                                        className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white transition-all shadow-sm border border-transparent hover:border-indigo-100"
                                                        title="Historial de Auditoría"
                                                    >
                                                        <History size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Detalles Multimedia */}
                                            {(it.photoUrl || it.voiceNoteUrl) && (
                                                <div className="flex items-center gap-2 pl-8 pt-1 border-t border-slate-50 mt-1">
                                                    {it.photoUrl && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setViewerPhotos([it.photoUrl!]); setCurrentPhotoIndex(0); }}
                                                            className="w-10 h-10 rounded-lg overflow-hidden border border-slate-100 shadow-sm hover:scale-105 transition-transform"
                                                        >
                                                            <img src={it.photoUrl} className="w-full h-full object-cover" alt="Detalle" referrerPolicy="no-referrer" />
                                                        </button>
                                                    )}
                                                    {it.voiceNoteUrl && (
                                                        <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                                                            <Smartphone size={12} className="text-indigo-600" />
                                                            <audio src={it.voiceNoteUrl} controls className="h-6 w-32 scale-90" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-auto pt-3 md:pt-4 border-t border-slate-200 shrink-0">
                                <div className="flex items-center justify-between bg-indigo-900 text-white p-4 md:p-5 rounded-[1.5rem] md:rounded-[1.8rem] shadow-2xl group transition-all">
                                    <div className="min-w-0">
                                        <p className="text-[7px] md:text-[8px] font-bold uppercase tracking-widest text-indigo-300 mb-0.5">Estado de Cierre</p>
                                        <p className="text-[9px] md:text-[11px] font-bold leading-tight opacity-90 truncate">
                                            {payments.length} abonos • {selectedItemsToDeliver.size} prendas
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleConfirmUnifiedAction}
                                        disabled={isProcessingPayment || (payments.length === 0 && selectedItemsToDeliver.size === 0 && discountVal === (selectedOrderToPay.descuento || 0))}
                                        className="bg-white text-indigo-900 px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold text-[8px] md:text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2 disabled:opacity-40 shrink-0"
                                    >
                                        {isProcessingPayment ? <Loader2 size={14} className="animate-spin" /> : (
                                            <>
                                                <Check size={14} strokeWidth={4} /> 
                                                {(() => {
                                                    const hasPayments = payments.length > 0;
                                                    const hasDeliveries = selectedItemsToDeliver.size > 0;
                                                    if (hasPayments && hasDeliveries) return "ENTREGAR Y COBRAR";
                                                    if (hasPayments) return "COBRAR";
                                                    if (hasDeliveries) return "ENTREGAR";
                                                    return "PROCESAR";
                                                })()}
                                            </>
                                        )}
                                    </button>
                                </div>
                                <button 
                                    onClick={() => setSelectedOrderToPay(null)} 
                                    className="w-full mt-3 md:mt-4 py-3 md:py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl flex items-center justify-center gap-3 border-b-4 border-slate-950"
                                >
                                    <ArrowLeft size={18} strokeWidth={3} /> VOLVER AL LISTADO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* OVERLAY DE TRACKING PANEL */}
            {trackingOrderId && (
                <div className="fixed inset-0 z-[500] bg-white animate-in fade-in duration-300">
                    <div className="absolute top-6 right-6 z-[510]">
                        <button 
                            onClick={() => setTrackingOrderId(null)} 
                            className="bg-black/20 hover:bg-black/40 text-white p-3 rounded-full transition-all border border-white/20 shadow-xl active:scale-90"
                        >
                            <X size={24} strokeWidth={3} />
                        </button>
                    </div>
                    <div className="h-full overflow-y-auto">
                        <Tracking id={trackingOrderId} />
                    </div>
                </div>
            )}

            {selectedOrderDetails && <OrderItemsDetailModal isOpen={true} onClose={() => setSelectedOrderDetails(null)} invoice={selectedOrderDetails} paymentMethods={paymentMethods} globalColors={globalColors} currency={currency} />}
            <OrderPrintModal 
                isOpen={!!selectedOrderToPrint} 
                onClose={() => setSelectedOrderToPrint(null)} 
                invoice={selectedOrderToPrint!} 
                company={company} 
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                ticketConfig={ticketConfig}
            />
            {selectedOrderToDeliver && (
                <DeliveryItemsModal
                    isOpen={true}
                    onClose={() => setSelectedOrderToDeliver(null)}
                    invoice={selectedOrderToDeliver}
                    onConfirm={handleDeliverItems}
                />
            )}

            {auditItemId && (
                <OrderAuditModal
                    isOpen={!!auditItemId}
                    onClose={() => setAuditItemId(null)}
                    itemId={auditItemId}
                    itemName={auditItemName}
                />
            )}

            {/* MODAL VISOR DE FOTOS */}
            <AnimatePresence>
                {viewerPhotos.length > 0 && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setViewerPhotos([])}
                            className="absolute inset-0 bg-black/95 backdrop-blur-md"
                        />
                        
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-5xl h-[85vh] flex flex-col items-center justify-center"
                        >
                            <button 
                                onClick={() => setViewerPhotos([])}
                                className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors flex items-center gap-2 font-bold text-sm uppercase tracking-widest bg-white/10 px-4 py-2 rounded-full backdrop-blur-md border border-white/20"
                            >
                                <X size={20} /> Cerrar
                            </button>

                            <div className="relative w-full h-full flex items-center justify-center group overflow-hidden rounded-3xl bg-black/40 border border-white/10 shadow-2xl">
                                <AnimatePresence mode="wait">
                                    <motion.img
                                        key={viewerPhotos[currentPhotoIndex]}
                                        src={viewerPhotos[currentPhotoIndex]}
                                        initial={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                        exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                                        transition={{ duration: 0.4, ease: "circOut" }}
                                        className="h-full w-full object-contain pointer-events-none select-none"
                                        referrerPolicy="no-referrer"
                                    />
                                </AnimatePresence>

                                {viewerPhotos.length > 1 && (
                                    <>
                                        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentPhotoIndex(prev => (prev === 0 ? viewerPhotos.length - 1 : prev - 1));
                                            }}
                                            className="absolute left-6 w-14 h-14 rounded-full bg-white/10 hover:bg-white/30 text-white backdrop-blur-xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-white/20 hover:scale-110 active:scale-95 shadow-2xl"
                                        >
                                            <ChevronLeft size={32} strokeWidth={2.5} />
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentPhotoIndex(prev => (prev === viewerPhotos.length - 1 ? 0 : prev + 1));
                                            }}
                                            className="absolute right-6 w-14 h-14 rounded-full bg-white/10 hover:bg-white/30 text-white backdrop-blur-xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-white/20 hover:scale-110 active:scale-95 shadow-2xl"
                                        >
                                            <ChevronRight size={32} strokeWidth={2.5} />
                                        </button>
                                        
                                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 px-6 py-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg">
                                            {viewerPhotos.map((_, idx) => (
                                                <button 
                                                    key={idx}
                                                    onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(idx); }}
                                                    className={`h-2 rounded-full transition-all duration-300 ${idx === currentPhotoIndex ? 'bg-white w-8' : 'bg-white/30 w-2 hover:bg-white/50'}`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            <div className="mt-4 text-white/50 font-black text-[10px] uppercase tracking-widest flex items-center gap-4">
                                <span>FOTO {currentPhotoIndex + 1} DE {viewerPhotos.length}</span>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span>SISLAV AI • REGISTRO VISUAL</span>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de Opciones de Reporte */}
            <AnimatePresence>
                {isReportModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">Acciones de Reporte</h3>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                                        {selectedSummaryFilter === 'TO_COLLECT' ? 'Pendientes de Pago' : selectedSummaryFilter === 'TO_DELIVER' ? 'Pendientes de Entrega' : 'Todas las Órdenes'}
                                    </p>
                                </div>
                                <button onClick={() => setIsReportModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                 {/* Reportes Diarios */}
                                <div className="space-y-3 pt-2">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Reporte de Ventas Diarias</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            onClick={() => handleDailySalesReport(new Date().toISOString().split('T')[0])}
                                            className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                                        >
                                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                                <Clock size={20} />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-xs font-black text-slate-800">HOY</div>
                                                <div className="text-[9px] font-bold text-slate-400">Ventas de hoy</div>
                                            </div>
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const yesterday = new Date();
                                                yesterday.setDate(yesterday.getDate() - 1);
                                                handleDailySalesReport(yesterday.toISOString().split('T')[0]);
                                            }}
                                            className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                                        >
                                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                                <History size={20} />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-xs font-black text-slate-800">AYER</div>
                                                <div className="text-[9px] font-bold text-slate-400">Ventas de ayer</div>
                                            </div>
                                        </button>
                                    </div>
                                    
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 group hover:bg-indigo-50 hover:border-indigo-200 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                                <Calendar size={20} />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-xs font-black text-slate-800 uppercase">Rango de Fechas</div>
                                                <div className="text-[9px] font-bold text-slate-400">Seleccionar desde / hasta</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="date" 
                                                defaultValue={new Date().toISOString().split('T')[0]}
                                                id="report-start"
                                                className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                                            />
                                            <span className="text-slate-400 text-[10px] font-bold">al</span>
                                            <input 
                                                type="date" 
                                                defaultValue={new Date().toISOString().split('T')[0]}
                                                id="report-end"
                                                className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                                            />
                                            <button 
                                                onClick={() => {
                                                    const start = (document.getElementById('report-start') as HTMLInputElement)?.value;
                                                    const end = (document.getElementById('report-end') as HTMLInputElement)?.value;
                                                    if (start && end) handleDailySalesReport(start, end);
                                                }}
                                                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700"
                                            >
                                                <Search size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {selectedSummaryFilter === 'TO_COLLECT' && (
                                    <button
                                        onClick={async () => {
                                            const allData = await dbGetInvoicesForReport('TO_COLLECT');
                                            const uniqueDebtorsMap = new Map<string, Contact>();
                                            
                                            allData.forEach((inv, idx) => {
                                                const client = inv.client;
                                                if (!client) return;
                                                
                                                let rawPhone = client.phone || '';
                                                let clean = rawPhone.replace(/\D/g, '');
                                                if (clean.length === 9 && (clean.startsWith('9') || clean.startsWith('8'))) {
                                                    clean = '51' + clean;
                                                }
                                                
                                                if (clean.length > 5 && !uniqueDebtorsMap.has(clean)) {
                                                    uniqueDebtorsMap.set(clean, {
                                                        id: client.id || `inv-${inv.id}-${idx}`,
                                                        name: client.name || 'Cliente',
                                                        phone: clean,
                                                        status: 'pending' as const
                                                    });
                                                }
                                            });

                                            const debtors = Array.from(uniqueDebtorsMap.values());
                                            if (onOpenWaCampaign) onOpenWaCampaign(debtors);
                                            setIsReportModalOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between p-5 bg-green-500 border border-green-600 rounded-2xl hover:bg-green-600 transition-all shadow-lg shadow-green-200 group"
                                    >
                                        <div className="flex items-center gap-4 text-white">
                                            <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform">
                                                <img src="https://iili.io/BWIGQGs.png" alt="WA" className="w-6 h-6 object-contain brightness-0 invert" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-black text-base leading-none">Campaña Recordatorio</div>
                                                <div className="text-[10px] font-bold opacity-80 uppercase tracking-tighter mt-1">Lanzar cobranza masiva WA</div>
                                            </div>
                                        </div>
                                        <Send className="text-white opacity-40" />
                                    </button>
                                )}
                            </div>
                            
                            <div className="p-4 bg-gray-50 text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold">
                                Sislav AI • Report Engine v2.0
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MyOrders;
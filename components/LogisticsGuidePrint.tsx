
import React, { useEffect, useState } from 'react';
import { X, Printer, Loader2, Download, QrCode } from 'lucide-react';
import bwipjs from 'bwip-js';
import { GuiaRemision } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LogisticsGuidePrintProps {
    guia: GuiaRemision;
    items: any[];
    onClose: () => void;
}

const LogisticsGuidePrint: React.FC<LogisticsGuidePrintProps> = ({ guia, items, onClose }) => {
    const [qrUrl, setQrUrl] = useState<string>('');
    const [printFormat] = useState<'80mm' | 'A4'>('80mm');

    useEffect(() => {
        if (guia.codigo_guia) {
            const canvas = document.createElement('canvas');
            try {
                // @ts-ignore
                bwipjs.toCanvas(canvas, {
                    bcid: 'qrcode',
                    text: guia.codigo_guia,
                    scale: 3,
                    height: 10,
                    includetext: false,
                });
                setQrUrl(canvas.toDataURL('image/png'));
            } catch (e) {
                console.error("Error generating QR:", e);
            }
        }
    }, [guia.codigo_guia]);

    useEffect(() => {
        if (qrUrl) {
            // Wait slightly for QR rendering
            const timer = setTimeout(() => {
                window.print();
                onClose();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [qrUrl, onClose]);

    const totalPrendas = items.reduce((acc, item) => acc + (item.cantidad || 1), 0);

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { 
                        margin: 0; 
                        size: auto;
                    }
                    html, body {
                        height: auto !important;
                        overflow: visible !important;
                        background: white !important;
                    }
                    body * { 
                        visibility: hidden !important; 
                        display: none !important;
                    }
                    #printable-guide, #printable-guide * { 
                        visibility: visible !important; 
                        display: block !important;
                    }
                    #printable-guide { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: ${printFormat === '80mm' ? '80mm' : '100%'} !important; 
                        height: auto !important;
                        padding: 5mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        background: white !important;
                        z-index: 99999 !important;
                        display: flex !important;
                        flex-direction: column !important;
                    }
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        display: table !important;
                    }
                    th, td {
                        border-bottom: 1px solid #e2e8f0 !important;
                        display: table-cell !important;
                    }
                    tr {
                        display: table-row !important;
                    }
                    thead {
                        display: table-header-group !important;
                    }
                    tbody {
                        display: table-row-group !important;
                    }
                    img {
                        display: block !important;
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}} />

            <div className="fixed inset-0 opacity-0 pointer-events-none z-[-1] overflow-hidden no-print">
                {/* Esta clase no-print y la div oculta previenen que aparezca en el DOM normal visible */}
            </div>

            {/* PRINT CONTENT - SEPARATE CONTAINER */}
            <div id="printable-guide" className={`bg-white font-mono text-slate-800 p-6 ${printFormat === '80mm' ? 'w-[80mm]' : 'w-[210mm]'} hidden print:block`}>
                
                {/* HEADER */}
                <div className="text-center border-b-2 border-dashed border-slate-200 pb-4 mb-4">
                    <h1 className="font-bold text-lg uppercase mb-1">Guía de Traslado</h1>
                    <p className="text-xl font-black mb-1">{guia.codigo_guia}</p>
                    {qrUrl && <img src={qrUrl} className="w-32 h-32 mx-auto my-2" alt="QR Guide" />}
                </div>

                        {/* INFO */}
                        <div className="space-y-1 text-xs mb-4">
                            <div className="flex justify-between">
                                <span className="font-bold">FECHA/HORA:</span>
                                <span>{format(new Date(guia.fecha_registro), 'dd/MM/yyyy HH:mm:ss')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold">ORIGEN:</span>
                                <span className="text-right truncate ml-4 uppercase">{guia.sucursal_origen?.nombre_sucursal}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold">DESTINO:</span>
                                <span className="text-right truncate ml-4 uppercase">{guia.sucursal_destino?.nombre_sucursal}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold">CHOFER:</span>
                                <span className="text-right truncate ml-4 uppercase">{guia.chofer?.nombre_completo || 'POR ASIGNAR'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold">OPERADOR:</span>
                                <span className="text-right truncate ml-4 uppercase">{guia.registrado_por}</span>
                            </div>
                        </div>

                        {/* DETAIL TABLE */}
                        <div className="border-t-2 border-b-2 border-dashed border-slate-200 py-4 mb-4 overflow-x-auto">
                            <table className="w-full text-[9px] leading-tight">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left pb-2 font-black uppercase w-8">#</th>
                                        <th className="text-left pb-2 font-black uppercase w-16">Ticket</th>
                                        <th className="text-left pb-2 font-black uppercase w-20">Cliente</th>
                                        <th className="text-left pb-2 font-black uppercase">Servicio / Detalle</th>
                                        <th className="text-right pb-2 font-black uppercase w-8">Cant</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => {
                                        const ticket = item.ticketNumber || item.ventas?.codigo_orden || item.ordenNumber || 'S/N';
                                        const cliente = item.clientName || item.ventas?.clientes?.nombres || item.ventas?.clientes?.nombre || item.cliente_nombre || '-';
                                        return (
                                            <tr key={idx} className="border-b border-slate-100">
                                                <td className="py-2 align-top">{idx + 1}</td>
                                                <td className="py-2 align-top font-bold">{ticket}</td>
                                                <td className="py-2 align-top uppercase">{cliente}</td>
                                                <td className="py-2 align-top">
                                                    <div className="font-bold uppercase">{item.nombre_prenda || item.itemName || item.descripcion || 'PRENDA'}</div>
                                                    {(item.detalle || item.details || item.observaciones) && <div className="text-[8px] italic opacity-70">{item.detalle || item.details || item.observaciones}</div>}
                                                </td>
                                                <td className="text-right py-2 align-top font-bold">{item.cantidad || 1}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* FOOTER */}
                        <div className="text-right mb-8">
                            <p className="text-sm font-black">TOTAL PRENDAS: {totalPrendas}</p>
                        </div>

                        <div className="mt-12 pt-8 border-t border-slate-200 text-center space-y-8">
                            <div className="flex flex-col items-center">
                                <div className="w-48 border-b border-slate-400 mb-2"></div>
                                <p className="text-[10px] font-bold uppercase">Firma del Chofer</p>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-48 border-b border-slate-400 mb-2"></div>
                                <p className="text-[10px] font-bold uppercase">Recibido por (Destino)</p>
                            </div>
                        </div>

                        <div className="mt-8 text-center text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                            SISLAV LOGISTICS HUB
                        </div>
                    </div>
        </>
    );
};

export default LogisticsGuidePrint;

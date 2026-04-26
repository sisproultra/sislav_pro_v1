
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
        <div className="fixed inset-0 opacity-0 pointer-events-none z-[-1] overflow-hidden">
            {/* PRINT CONTENT - ONLY VISIBLE TO PRINTER */}
            <div id="printable-guide" className={`bg-white font-mono text-slate-800 p-6 ${printFormat === '80mm' ? 'w-[80mm]' : 'w-[210mm]'}`}>
                
                <style>{`
                    @media print {
                        @page { margin: 0; }
                        body * { display: none !important; }
                        #printable-guide, #printable-guide * { display: block !important; visibility: visible !important; }
                        #printable-guide { 
                            position: absolute !important; 
                            left: 0 !important; 
                            top: 0 !important; 
                            width: ${printFormat === '80mm' ? '80mm' : '210mm'} !important; 
                            padding: 10px !important;
                            margin: 0 !important;
                            box-shadow: none !important;
                        }
                    }
                `}</style>

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
                        <div className="border-t-2 border-b-2 border-dashed border-slate-200 py-4 mb-4">
                            <table className="w-full text-[10px] sm:text-xs">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="text-left pb-2 font-black uppercase">Orden / Prenda</th>
                                        <th className="text-right pb-2 font-black uppercase">Cant</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="border-b border-slate-50">
                                            <td className="py-2">
                                                <div className="font-bold uppercase">#{item.ordenNumber || 'S/N'}</div>
                                                <div className="uppercase opacity-70">{item.nombre_prenda}</div>
                                                {item.detalle && <div className="text-[9px] italic opacity-50">{item.detalle}</div>}
                                                <div className="text-[9px] font-bold text-indigo-600">ENTREGA: {item.fecha_entrega ? format(new Date(item.fecha_entrega), 'dd/MM/yyyy') : '-'}</div>
                                            </td>
                                            <td className="text-right py-2 font-bold">{item.cantidad || 1}</td>
                                        </tr>
                                    ))}
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
                </div>
    );
};

export default LogisticsGuidePrint;

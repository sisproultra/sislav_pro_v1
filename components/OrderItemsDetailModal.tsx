
import React, { useState, useRef, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { 
  X, Shirt, Clock, Calendar, StickyNote, ImageIcon, Mic, 
  CheckCircle2, Waves, Wind, Loader2, Play, Eye, Palette, 
  Volume2, AlertTriangle, Maximize2, DollarSign, CreditCard, 
  Banknote, Info, User, Phone, MapPin, Tag, Smartphone,
  Check, Archive, Landmark, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Invoice, OrderStatus, GlobalColor, PaymentMethodConfig } from '../types';
import { dbGetInvoiceFull } from '../services/dbService';

interface OrderItemsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  paymentMethods?: PaymentMethodConfig[];
  globalColors?: GlobalColor[];
  currency?: string;
}

const OrderItemsDetailModal: React.FC<OrderItemsDetailModalProps> = ({ 
  isOpen, onClose, invoice: initialInvoice, 
  paymentMethods = [], globalColors = [],
  currency = 'S/'
}) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const brandPrimary = document.documentElement.style.getPropertyValue('--brand-primary').trim() || '#0054A6';

  useEffect(() => {
    if (isOpen) {
        loadFullInvoice();
    }
  }, [isOpen, initialInvoice.id]);

  const loadFullInvoice = async () => {
      setIsLoading(true);
      try {
          const full = await dbGetInvoiceFull(initialInvoice.id);
          setInvoice(full);
      } catch (e) {
          console.error("Error cargando detalles:", e);
      } finally {
          setIsLoading(false);
      }
  };

  if (!isOpen) return null;

  const handlePlayAudio = (audioData: string) => {
    if (playingAudio === audioData) {
        audioRef.current?.pause();
        setPlayingAudio(null);
        return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(audioData);
    audioRef.current = audio;
    audio.onended = () => setPlayingAudio(null);
    audio.play();
    setPlayingAudio(audioData);
  };

  const getStatusBadge = (status?: OrderStatus | string) => {
    switch (status) {
      case 'EN_LAVADO': return <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-[10px] font-black border border-blue-100 shadow-sm"><Waves size={12}/> LAVADO</span>;
      case 'EN_SECADO': return <span className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-[10px] font-black border border-orange-100 shadow-sm"><Wind size={12}/> SECADO</span>;
      case 'LISTO': return <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-black border border-emerald-100 shadow-sm"><CheckCircle2 size={12}/> LISTO</span>;
      case 'ENTREGADO': return <span className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black border border-slate-200 shadow-sm"><CheckCircle2 size={12}/> ENTREGADO</span>;
      case 'EN_RUTA': return <span className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full text-[10px] font-black border border-indigo-100 shadow-sm"><Smartphone size={12}/> EN RUTA</span>;
      case 'ANULADO':
      case 'CANCELADO':
        return <span className="flex items-center gap-1.5 text-red-600 bg-red-50 px-3 py-1 rounded-full text-[10px] font-black border border-red-100 shadow-sm"><X size={12} strokeWidth={3}/> CANCELADO</span>;
      default: return <span className="flex items-center gap-1.5 text-slate-400 bg-slate-50 px-3 py-1 rounded-full text-[10px] font-black border border-slate-100 shadow-sm"><Loader2 size={12} className="animate-spin"/> PENDIENTE</span>;
    }
  };

  const getMethodName = (methodId: string) => {
    return paymentMethods.find(m => m.id === methodId)?.name || 'MÉTODO DESCONOCIDO';
  };

  const getPayStatus = (inv: Invoice) => {
    const total = inv.totals.total - (inv.descuento || 0);
    const paid = inv.prePaymentAmount || 0;
    const isPaid = paid >= total - 0.01;
    return {
        isPaid,
        pending: Math.max(0, total - paid)
    };
  };

  const payInfo = invoice ? getPayStatus(invoice) : { isPaid: false, pending: 0 };

  return (
    <div className="fixed inset-0 bg-white z-[500] flex flex-col animate-in fade-in duration-300">
      <div className="w-full h-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
        
        {/* HEADER MODERNO - FULLWIDTH */}
        <div className="p-4 md:px-8 md:py-5 shrink-0 relative overflow-hidden flex items-center justify-between shadow-lg" style={{ backgroundColor: brandPrimary }}>
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/20">
                <Shirt size={28} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-xl md:text-3xl text-white uppercase tracking-tighter leading-none">Orden #{initialInvoice.ordenNumber}</h3>
              <p className="text-[10px] md:text-[11px] font-bold text-white/80 uppercase tracking-[0.2em] mt-1">{initialInvoice.client.name.toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white border border-white/10 z-20"><X size={28} strokeWidth={3}/></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
          {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-6 py-20 animate-pulse">
                  <div className="relative">
                    <Loader2 className="animate-spin text-indigo-600" size={64} strokeWidth={3} />
                    <DollarSign className="absolute inset-0 m-auto text-indigo-400" size={24} />
                  </div>
                  <div className="text-center font-black uppercase tracking-[0.3em] text-slate-900">Sincronizando Auditoría...</div>
              </div>
          ) : !invoice ? (
              <div className="h-full flex flex-col items-center justify-center p-10 text-slate-400 gap-4">
                <AlertTriangle size={48} className="text-amber-500" />
                <p className="uppercase font-black text-xs tracking-widest">No se pudo recuperar la información</p>
                <button onClick={loadFullInvoice} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold uppercase">Reintentar</button>
              </div>
          ) : (
            <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
              
              {/* SECCIÓN 1: CABECERA DE ESTADO (Compacta en Mobile) */}
              <div className="grid grid-cols-3 gap-2 md:gap-5">
                <div className="bg-white border-b-2 md:border-b-6 border-emerald-500 p-2 md:p-5 rounded-2xl md:rounded-3xl shadow-xl flex flex-col items-center text-center">
                  <span className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</span>
                  <p className="text-sm md:text-3xl font-black text-slate-900 tracking-tighter">{currency} {(invoice.totals.total - (invoice.descuento || 0)).toFixed(1)}</p>
                </div>
                <div className="bg-white border-b-2 md:border-b-6 border-indigo-500 p-2 md:p-5 rounded-2xl md:rounded-3xl shadow-xl flex flex-col items-center text-center">
                  <span className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Abonado</span>
                  <p className="text-sm md:text-3xl font-black text-indigo-600 tracking-tighter">{currency} {(invoice.prePaymentAmount || 0).toFixed(1)}</p>
                </div>
                <div className={`bg-white border-b-2 md:border-b-6 p-2 md:p-5 rounded-2xl md:rounded-3xl shadow-xl flex flex-col items-center text-center ${payInfo.isPaid ? 'border-emerald-500' : 'border-red-500'}`}>
                  <span className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo</span>
                  <p className={`text-sm md:text-3xl font-black tracking-tighter ${payInfo.isPaid ? 'text-slate-300' : 'text-red-600 animate-pulse'}`}>{currency} {payInfo.pending.toFixed(1)}</p>
                </div>
              </div>

              {/* SECCIÓN 1.5: HISTORIAL DE PAGOS DETALLADO */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                  <h4 className="font-black text-lg text-slate-900 uppercase tracking-tight">Detalle de Pagos</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {invoice.payments && invoice.payments.length > 0 ? invoice.payments.map((p, idx) => {
                    const pm = paymentMethods.find(m => m.id === p.metodo_pago_id);
                    const hasCustomIcon = pm?.icon && (pm.icon.startsWith('http') || pm.icon.startsWith('/'));
                    
                    let iconName = pm?.icon || 'Banknote';
                    if (iconName === 'qr-code') iconName = 'QrCode';
                    if (iconName === 'smartphone') iconName = 'Smartphone';
                    if (iconName === 'credit-card') iconName = 'CreditCard';
                    if (iconName === 'banknote') iconName = 'Banknote';
                    
                    const IconComponent = (LucideIcons as any)[iconName] || (LucideIcons as any)[pm?.icon || ''] || Banknote;
                    return (
                      <div key={idx} className="bg-white p-3 md:p-4 rounded-2xl shadow-lg border border-slate-100 flex items-center justify-between group hover:border-emerald-200 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden border border-slate-100">
                            {hasCustomIcon ? (
                              <img src={pm.icon} alt={pm.name} className="w-full h-full object-contain p-1.5" />
                            ) : (
                              <IconComponent size={20} />
                            )}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-[10px] md:text-[11px] uppercase leading-none mb-1">{pm?.name || 'OTRO'}</p>
                            <p className="text-[11px] md:text-[12px] font-bold text-slate-400 uppercase tracking-widest">
                              {p.date ? new Date(p.date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) + ' ' + new Date(p.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'S/F'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900 text-base md:text-lg tracking-tighter leading-none">{currency} {p.monto.toFixed(1)}</p>
                          <span className="text-[7px] md:text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center justify-end gap-1 mt-1"><Check size={10} strokeWidth={4}/> OK</span>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="col-span-full py-8 bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-300 gap-2">
                       <CreditCard size={32} />
                       <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sin historial de pagos</p>
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN 2: DETALLE DE PRENDAS (ESTILO CARDS FOTO) */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                  <h4 className="font-black text-lg text-slate-900 uppercase tracking-tight">Análisis Técnico de Prendas</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {[...invoice.items].sort((a: any, b: any) => {
                      const isACanceled = a.estado_id === 9 || a.status === 'ANULADO' || a.status === 'CANCELADO';
                      const isBCanceled = b.estado_id === 9 || b.status === 'ANULADO' || b.status === 'CANCELADO';
                      return (isACanceled ? 1 : 0) - (isBCanceled ? 1 : 0);
                  }).flatMap((item, itemIdx) => {
                      let units: any[] = [];
                      const rawSource = (item as any).observaciones || item.details || '';
                      
                      try { 
                          if (rawSource && typeof rawSource === 'string' && rawSource.trim().startsWith('[')) {
                              const parsed = JSON.parse(rawSource);
                              if (Array.isArray(parsed) && parsed.length > 0) {
                                  units = parsed.map(u => ({
                                      ...u,
                                      details: u.observaciones || u.details || '' // Mapeamos observaciones internas al campo details para renderizado
                                  }));
                              }
                          }
                          if (units.length === 0) throw new Error();
                      } catch (e) { 
                          units = [{ 
                              details: (rawSource && typeof rawSource === 'string' && rawSource.trim().startsWith('[')) ? '' : rawSource, 
                              images: [ (item as any).url_foto_1, (item as any).url_foto_2, (item as any).url_foto_3 ].filter(Boolean),
                              audioNote: (item as any).url_audio || (item as any).unit_audio || (item as any).audioNote, 
                              color: (item as any).color,
                              defects: (item as any).defectos ? (item as any).defectos.split(', ') : [],
                              deliveryDate: (item as any).fecha_entrega_item || (item as any).fecha_entrega_especifica || item.itemDeliveryDate
                          }]; 
                      }

                      return units.map((unit, uIdx) => {
                          const isCanceled = (item as any).estado_id === 9 || (item.status as any) === 'ANULADO' || item.status === 'CANCELADO';
                          const colorName = String(unit.color || '').trim();
                          const matchedColor = globalColors.find(c => String(c.nombre || '').trim().toLowerCase() === colorName.toLowerCase());
                          const defects = Array.isArray(unit.defects) ? unit.defects : (unit.defectos ? String(unit.defectos).split(', ') : []);
                          
                          // Gather all images from specific columns and JSON
                          const itemImages = [
                            (item as any).url_foto_1, 
                            (item as any).url_foto_2, 
                            (item as any).url_foto_3,
                            ...(Array.isArray(unit.images) ? unit.images : [])
                          ].filter(Boolean);

                          const deliveryDateVal = unit.deliveryDate || (item as any).fecha_entrega_item || invoice.deliveryDate;
                          const formattedDate = deliveryDateVal ? new Date(deliveryDateVal).toISOString().split('T')[0] : '';
                          const formattedTime = deliveryDateVal ? new Date(deliveryDateVal).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

                          return (
                          <div key={`${itemIdx}-${uIdx}`} className={`rounded-3xl p-4 md:p-5 shadow-xl border flex flex-col gap-4 relative overflow-hidden group transition-all ${ isCanceled ? 'bg-red-50/50 border-red-200' : (item as any).es_ajuste ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                              {/* Barrita lateral de color */}
                              <div className="absolute top-0 left-0 bottom-0 w-1" style={{ backgroundColor: isCanceled ? '#ef4444' : (item as any).es_ajuste ? '#2563eb' : (matchedColor?.hex || brandPrimary) }}></div>

                              {/* Fila 1: Imagen Color, Nombre Prenda, Fotos, Audio */}
                              <div className={`flex flex-col gap-3 ${isCanceled ? 'opacity-70' : ''}`}>
                                  <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div 
                                            className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-white shadow-md flex-shrink-0"
                                            style={{ 
                                                backgroundColor: matchedColor?.url_imagen ? undefined : (isCanceled ? '#fee2e2' : (matchedColor?.hex || '#f8fafc')), 
                                                backgroundImage: matchedColor?.url_imagen ? `url(${matchedColor.url_imagen})` : undefined, 
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center'
                                            }}
                                        />
                                        <div className="min-w-0">
                                          <h6 className={`font-black text-[12px] md:text-[14px] leading-tight uppercase line-clamp-2 gap-2 flex items-center ${isCanceled ? 'text-red-700 strike-through' : 'text-slate-800'}`}>
                                            {item.name}
                                            {(item as any).es_ajuste && !isCanceled && (
                                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[8px] font-black rounded-md border border-indigo-200">ADICIONAL</span>
                                            )}
                                          </h6>
                                          <div className="flex items-center gap-2 mt-1">
                                             <p className={`font-bold text-[8px] md:text-[9px] uppercase tracking-widest leading-none truncate max-w-[80px] ${isCanceled ? 'text-red-400' : 'text-indigo-500'}`}>{unit.color || 'NO COLOR'}</p>
                                             <span className="text-slate-300">•</span>
                                             {getStatusBadge(isCanceled ? 'CANCELADO' : item.status)}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="shrink-0 flex gap-2">
                                        {unit.audioNote && !isCanceled && (
                                          <button onClick={() => handlePlayAudio(unit.audioNote)} className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition-all shrink-0 ${playingAudio === unit.audioNote ? 'bg-slate-900 text-white animate-pulse' : 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100'}`}>
                                            <Volume2 size={18} />
                                          </button>
                                        )}
                                        {isCanceled ? (
                                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-red-100 text-red-600 border border-red-200 flex items-center justify-center shadow-inner">
                                            <X size={18} strokeWidth={3} />
                                          </div>
                                        ) : (
                                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-rose-50 text-rose-300 border border-rose-100 flex items-center justify-center opacity-40">
                                            <LucideIcons.Trash2 size={18} />
                                          </div>
                                        )}
                                      </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-2 border-t pt-3">
                                      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                                        {itemImages.slice(0, 4).map((img, pIdx) => (
                                          <div key={pIdx} className="w-9 h-9 md:w-10 md:h-10 rounded-lg overflow-hidden border border-slate-50 shadow-sm cursor-pointer hover:scale-110 transition-transform shrink-0" onClick={() => { if (!isCanceled) { setPreviewImages(itemImages); setCurrentImageIndex(pIdx); } }}>
                                            <img src={img} className={`w-full h-full object-cover ${isCanceled ? 'grayscale' : ''}`} />
                                          </div>
                                        ))}
                                        {itemImages.length > 4 && (
                                          <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white text-[8px] md:text-[10px] font-black cursor-pointer" onClick={() => { if (!isCanceled) { setPreviewImages(itemImages); setCurrentImageIndex(0); } }}>
                                            +{itemImages.length - 4}
                                          </div>
                                        )}
                                      </div>
                                  </div>
                              </div>

                              {/* Fila 2: Tags de Defectos (DENSE) */}
                              <div className="flex flex-wrap gap-1">
                                  {defects.length > 0 ? defects.map((def: string, di: number) => (
                                      <span key={di} className={`px-2 py-0.5 md:py-1 rounded-md text-[8px] md:text-[8.5px] font-black uppercase tracking-tighter shadow-sm border ${di === 1 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
                                        {def}
                                      </span>
                                  )) : (
                                    <span className="text-[7px] md:text-[8px] font-black uppercase text-slate-300 tracking-[0.2em] italic flex items-center gap-1.5 px-0.5 whitespace-nowrap"><Check size={10}/> Sin desperfectos</span>
                                  )}
                              </div>

                              {/* Fila 3: Fechas */}
                              <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-0.5">
                                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                      <Calendar size={9} className="text-indigo-500" /> Entrega
                                    </label>
                                    <div className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-bold text-slate-700 text-[11px] md:text-[12px] flex items-center justify-center">
                                      <span className="truncate">{formattedDate || '---'}</span>
                                    </div>
                                  </div>
                                  <div className="space-y-0.5">
                                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                      <Clock size={9} className="text-indigo-500" /> Hora
                                    </label>
                                    <div className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 font-bold text-slate-700 text-[11px] md:text-[12px] flex items-center justify-center">
                                      <span className="truncate">{formattedTime || '---'}</span>
                                    </div>
                                  </div>
                              </div>

                              {/* Fila 4: Notas de Recepción */}
                              <div className="space-y-0.5">
                                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                  <StickyNote size={9} className="text-slate-400" /> Notas Recepción
                                </label>
                                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 font-bold text-slate-600 text-[10px] md:text-[11px] uppercase leading-snug min-h-[36px] line-clamp-2">
                                  {unit.details || 'SIN OBSERVACIONES.'}
                                </div>
                              </div>
                          </div>
                          );
                      });
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACCIONES - FULLWIDTH */}
        <div className="p-5 md:px-10 border-t bg-white flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.05)] shrink-0">
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visualización en alta fidelidad • 2026</p>
            </div>
            <button 
                onClick={onClose} 
                className="px-10 md:px-16 py-3.5 md:py-4.5 bg-slate-950 text-white font-black rounded-2xl text-[12px] md:text-[14px] uppercase tracking-[0.2em] hover:bg-black transition-all shadow-2xl active:scale-95"
            >
                Cerrar Detalle
            </button>
        </div>
      </div>

      {previewImages.length > 0 && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/98 flex items-center justify-center p-4 select-none" onClick={() => setPreviewImages([])}>
          <button 
            className="absolute top-8 right-8 text-white bg-white/10 hover:bg-white/20 p-4 rounded-full backdrop-blur-md border border-white/20 z-50 transition-all active:scale-95"
            onClick={(e) => { e.stopPropagation(); setPreviewImages([]); }}
          >
            <X size={36} strokeWidth={3} />
          </button>
          
          {previewImages.length > 1 && (
            <div className="absolute inset-x-4 md:inset-x-12 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-40">
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => (prev - 1 + previewImages.length) % previewImages.length); }}
                className="pointer-events-auto bg-white/10 hover:bg-white/20 text-white p-5 rounded-full border border-white/20 backdrop-blur-md transition-all active:scale-90"
              >
                <ChevronLeft size={32} strokeWidth={3} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => (prev + 1) % previewImages.length); }}
                className="pointer-events-auto bg-white/10 hover:bg-white/20 text-white p-5 rounded-full border border-white/20 backdrop-blur-md transition-all active:scale-90"
              >
                <ChevronRight size={32} strokeWidth={3} />
              </button>
            </div>
          )}

          <div className="relative flex flex-col items-center gap-6" onClick={(e) => e.stopPropagation()}>
            <img 
              src={previewImages[currentImageIndex]} 
              className="max-w-[95vw] max-h-[75vh] object-contain rounded-3xl shadow-[0_0_120px_rgba(0,0,0,1)] border-4 border-white/10 animate-in zoom-in-95 duration-300" 
            />
            
            {previewImages.length > 1 && (
               <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-md border border-white/20">
                {previewImages.map((_, i) => (
                  <div 
                    key={i} 
                    onClick={() => setCurrentImageIndex(i)}
                    className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${i === currentImageIndex ? 'bg-white scale-125' : 'bg-white/30 hover:bg-white/50'}`} 
                  />
                ))}
              </div>
            )}
            
            <p className="text-white/40 text-[11px] font-black uppercase tracking-[0.4em]">
              Imagen {currentImageIndex + 1} de {previewImages.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderItemsDetailModal;

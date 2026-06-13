
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
import { dbGetInvoiceFull, dbUpdateItemObservations } from '../services/dbService';
import { formatDateSafe, formatTimeSafe, formatDateTimeSafe } from '../utils/calculations';

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
  const [editingCell, setEditingCell] = useState<{ itemIdx: number; uIdx: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSavingDetail, setIsSavingDetail] = useState(false);
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

  const handleSaveSingleDetail = async (item: any, itemIdx: number, uIdx: number, newValue: string) => {
    setIsSavingDetail(true);
    try {
      const rawSource = item.observaciones || item.details || '';
      let updatedObservaciones = '';

      if (rawSource && typeof rawSource === 'string' && rawSource.trim().startsWith('[')) {
        const parsed = JSON.parse(rawSource);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (parsed[uIdx]) {
            parsed[uIdx].observaciones = newValue.toUpperCase();
            parsed[uIdx].details = newValue.toUpperCase();
          }
          updatedObservaciones = JSON.stringify(parsed);
        }
      } else {
        updatedObservaciones = newValue.toUpperCase();
      }

      await dbUpdateItemObservations(item.id, updatedObservaciones);
      
      // Update local invoice state immediately to avoid reloading lag
      if (invoice) {
        const updatedItems = invoice.items.map((it: any, idx: number) => {
          if (idx === itemIdx) {
            return {
              ...it,
              observaciones: updatedObservaciones,
              details: updatedObservaciones
            };
          }
          return it;
        });
        setInvoice({
          ...invoice,
          items: updatedItems
        });
      }

      setEditingCell(null);
    } catch (e) {
      console.error("Error al guardar el detalle:", e);
      alert("No se pudo guardar el cambio. Intente de nuevo.");
    } finally {
      setIsSavingDetail(false);
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
        <div className="p-4 md:px-8 md:py-4 shrink-0 relative overflow-hidden flex items-center justify-between shadow-lg" style={{ backgroundColor: brandPrimary }}>
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md border border-white/20 shadow-inner">
                <Shirt size={24} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg md:text-2xl text-white uppercase tracking-tighter leading-none">Orden #{initialInvoice.ordenNumber}</h3>
              <p className="text-[9px] md:text-[10px] font-bold text-white/70 uppercase tracking-[0.2em] mt-1">{initialInvoice.client.name.toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white border border-white/10 z-20 shadow-lg active:scale-90"><X size={24} strokeWidth={3}/></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
          {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 py-20">
                  <div className="relative">
                    <Loader2 className="animate-spin" style={{ color: brandPrimary }} size={48} strokeWidth={3} />
                  </div>
                  <div className="text-center font-black uppercase tracking-[0.2em] text-slate-400 text-[10px]">Sincronizando Auditoría...</div>
              </div>
          ) : !invoice ? (
              <div className="h-full flex flex-col items-center justify-center p-10 text-slate-400 gap-4">
                <AlertTriangle size={48} className="text-amber-500" />
                <p className="uppercase font-black text-xs tracking-widest">No se pudo recuperar la información</p>
                <button onClick={loadFullInvoice} className="px-6 py-2 rounded-xl font-bold uppercase text-white shadow-lg" style={{ backgroundColor: brandPrimary }}>Reintentar</button>
              </div>
          ) : (
            <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
              
              {/* SECCIÓN 1: CABECERA DE ESTADO (Compacta en Mobile) */}
              <div className="grid grid-cols-3 gap-2 md:gap-4">
                <div className="bg-white border-b-4 border-emerald-500 p-2 md:p-4 rounded-2xl md:rounded-[1.5rem] shadow-md flex flex-col items-center text-center">
                  <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</span>
                  <p className="text-sm md:text-2xl font-black text-slate-800 tracking-tighter">{currency} {(invoice.totals.total - (invoice.descuento || 0)).toFixed(2)}</p>
                </div>
                <div className="bg-white border-b-4 border-indigo-500 p-2 md:p-4 rounded-2xl md:rounded-[1.5rem] shadow-md flex flex-col items-center text-center">
                  <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Abonado</span>
                  <p className="text-sm md:text-2xl font-black text-indigo-600 tracking-tighter">{currency} {(invoice.prePaymentAmount || 0).toFixed(2)}</p>
                </div>
                <div className={`bg-white border-b-4 p-2 md:p-4 rounded-2xl md:rounded-[1.5rem] shadow-md flex flex-col items-center text-center ${payInfo.isPaid ? 'border-emerald-500' : 'border-red-500'}`}>
                  <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo</span>
                  <p className={`text-sm md:text-2xl font-black tracking-tighter ${payInfo.isPaid ? 'text-slate-300' : 'text-red-600 animate-pulse'}`}>{currency} {payInfo.pending.toFixed(2)}</p>
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
                      <div key={idx} className="bg-white p-3 md:p-4 rounded-2xl shadow-lg border border-slate-100 flex items-center justify-between group hover:border-slate-200 transition-all">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden border"
                            style={(pm?.color || pm?.fontColor) ? {
                              color: pm.color || pm.fontColor,
                              borderColor: `${pm.color || pm.fontColor}33`,
                              backgroundColor: `${pm.color || pm.fontColor}11`
                            } : {
                              backgroundColor: '#f8fafc',
                              borderColor: '#f1f5f9'
                            }}
                          >
                            {hasCustomIcon ? (
                              <img src={pm.icon} alt={pm.name} className="w-full h-full object-contain p-1.5" />
                            ) : (
                              <IconComponent size={20} />
                            )}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-[10px] md:text-[11px] uppercase leading-none mb-1">{pm?.name || 'OTRO'}</p>
                            <p className="text-[11px] md:text-[12px] font-bold text-slate-400 uppercase tracking-widest">
                              {p.date ? formatDateTimeSafe(p.date) : 'S/F'}
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

              {/* SECCIÓN 2: DETALLE DE PRENDAS (TIPO TABLA) */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 bg-indigo-600 rounded-full" style={{ backgroundColor: brandPrimary }}></div>
                  <h4 className="font-black text-base text-slate-800 uppercase tracking-tight">Análisis Técnico de Prendas</h4>
                </div>

                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100">
                          <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Prenda / Color</th>
                          <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Defectos / Notas</th>
                          <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Multim.</th>
                          <th className="px-4 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Entrega</th>
                          <th className="px-4 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
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
                                        units = parsed.map(u => ({ ...u, details: u.observaciones || u.details || '' }));
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
                                
                                const itemImages = [
                                  (item as any).url_foto_1, (item as any).url_foto_2, (item as any).url_foto_3,
                                  ...(Array.isArray(unit.images) ? unit.images : [])
                                ].filter(Boolean);

                                const deliveryDateVal = unit.deliveryDate || (item as any).fecha_entrega_item || invoice.deliveryDate;
                                const formattedDate = deliveryDateVal ? new Date(deliveryDateVal).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }) : '';
                                const formattedTime = deliveryDateVal ? new Date(deliveryDateVal).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

                                return (
                                  <tr key={`${itemIdx}-${uIdx}`} className={`group transition-colors ${isCanceled ? 'bg-red-50/30' : 'hover:bg-slate-50/50'}`}>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        <div 
                                            className="w-8 h-8 rounded-lg border shadow-sm shrink-0"
                                            style={{ 
                                                backgroundColor: matchedColor?.url_imagen ? undefined : (matchedColor?.hex || '#f8fafc'), 
                                                backgroundImage: matchedColor?.url_imagen ? `url(${matchedColor.url_imagen})` : undefined, 
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center'
                                            }}
                                        />
                                        <div className="min-w-0">
                                          <p className={`text-[12px] font-black uppercase tracking-tight leading-none ${isCanceled ? 'text-red-400 line-through' : 'text-slate-800'}`}>{item.name}</p>
                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{unit.color || 'SIN COLOR'}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {defects.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-1">
                                          {defects.map((def: string, di: number) => (
                                            <span key={di} className="text-[7px] font-black text-slate-500 bg-slate-100 px-1 py-0.5 rounded uppercase">{def}</span>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {editingCell?.itemIdx === itemIdx && editingCell?.uIdx === uIdx ? (
                                        <div className="flex flex-col gap-1.5 w-full max-w-xs animate-in slide-in-from-top-1 duration-200">
                                          <textarea
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="w-full px-3 py-1.5 text-[10px] font-bold text-slate-900 uppercase bg-slate-50 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none leading-normal min-h-[50px]"
                                            placeholder="Escribe la nota/detalle aquí..."
                                            autoFocus
                                          />
                                          <div className="flex items-center gap-1.5 self-end">
                                            <button
                                              onClick={() => setEditingCell(null)}
                                              className="px-2 py-1 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                                              title="Cancelar"
                                            >
                                              Cancelar
                                            </button>
                                            <button
                                              onClick={() => handleSaveSingleDetail(item, itemIdx, uIdx, editValue)}
                                              disabled={isSavingDetail}
                                              className="px-2 py-1 text-[8px] font-black uppercase tracking-[0.2em] rounded-md transition-all flex items-center gap-1 border"
                                              style={{ 
                                                color: brandPrimary, 
                                                borderColor: `${brandPrimary}30`, 
                                                backgroundColor: `${brandPrimary}08` 
                                              }}
                                              title="Guardar"
                                            >
                                              {isSavingDetail ? (
                                                <>
                                                  <Loader2 size={10} className="animate-spin" /> Guardando...
                                                </>
                                              ) : (
                                                <>
                                                  <Check size={10} strokeWidth={3} /> Guardar
                                                </>
                                              )}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 group/note justify-between min-h-[22px]">
                                          <p className="text-[10px] text-slate-600 font-bold uppercase leading-tight">
                                            {unit.details || <span className="text-slate-300 italic font-medium">Sin notas</span>}
                                          </p>
                                          {invoice?.orderStatus !== 'ENTREGADO' && (
                                            <button
                                              onClick={() => {
                                                setEditingCell({ itemIdx, uIdx });
                                                setEditValue(unit.details || '');
                                              }}
                                              className="hover:scale-110 active:scale-95 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-1.5 rounded-lg transition-all ml-2 flex-shrink-0 flex items-center justify-center"
                                              title="Editar detalle"
                                            >
                                              <LucideIcons.Pencil size={11} />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        {itemImages.length > 0 && (
                                          <div className="flex -space-x-2">
                                            {itemImages.slice(0, 2).map((img, i) => (
                                              <img key={i} src={img} className="w-7 h-7 rounded-md border-2 border-white object-cover cursor-pointer" onClick={() => { setPreviewImages(itemImages); setCurrentImageIndex(i); }} />
                                            ))}
                                            {itemImages.length > 2 && (
                                              <div className="w-7 h-7 rounded-md bg-slate-800 text-white text-[8px] font-black flex items-center justify-center border-2 border-white">+{itemImages.length - 2}</div>
                                            )}
                                          </div>
                                        )}
                                        {unit.audioNote && (
                                          <button onClick={() => handlePlayAudio(unit.audioNote)} className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${playingAudio === unit.audioNote ? 'bg-indigo-600 text-white animate-pulse' : 'bg-emerald-50 text-emerald-600'}`}>
                                            <Volume2 size={14} />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <p className="text-[10px] font-black text-slate-700 leading-none">{formattedDate}</p>
                                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{formattedTime}</p>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {getStatusBadge(isCanceled ? 'CANCELADO' : item.status)}
                                    </td>
                                  </tr>
                                );
                            });
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACCIONES - FULLWIDTH */}
        <div className="p-4 md:px-10 border-t bg-white flex items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.05)] shrink-0">
            <div>
              <p className="text-[8px] md:text-[9px] font-bold text-slate-300 uppercase tracking-widest">Visualización en alta fidelidad • 2026</p>
            </div>
            <button 
                onClick={onClose} 
                className="px-8 md:px-12 py-3 md:py-4 text-white font-black rounded-2xl text-[11px] md:text-[13px] uppercase tracking-[0.15em] hover:opacity-90 transition-all shadow-xl active:scale-95"
                style={{ backgroundColor: brandPrimary }}
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

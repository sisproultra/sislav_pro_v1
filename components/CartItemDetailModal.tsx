
import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Save, Trash2, Mic, Square, Play, Calendar, Palette, Clock, AlertTriangle, Search, Check, Wallet } from 'lucide-react';
import { GlobalColor, PaymentMethodConfig, Product } from '../types';

interface CartItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (details: string, images: string[], audioNote?: string, itemDeliveryDate?: string, paymentMethodId?: string, selectedProduct?: Product) => void;
  initialDetails: string;
  initialImages: string[];
  initialAudio?: string;
  initialDate?: string;
  itemName?: string;
  globalColors?: GlobalColor[];
  paymentMethods?: PaymentMethodConfig[];
  availableProducts?: Product[];
  isAdjustment?: boolean;
}

const DEFECTOS_OPCIONES = ["ROTO", "MANCHADO", "MOHO", "HUECO"];

const CartItemDetailModal: React.FC<CartItemDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialDetails, 
  initialImages,
  initialAudio,
  initialDate,
  itemName,
  globalColors = [],
  paymentMethods = [],
  availableProducts = [],
  isAdjustment = false
}) => {
  const [details, setDetails] = useState(initialDetails);
  const [images, setImages] = useState<string[]>(initialImages);
  const [color, setColor] = useState('#0054A6');
  const [defects, setDefects] = useState<string[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00 PM');

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<string | null>(initialAudio || null);
  const [recordingTime, setRecordingTime] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
        setDetails(initialDetails);
        setImages(initialImages || []);
        setAudioBlob(initialAudio || null);
        setSelectedProduct(null);
        setProductSearch('');
        setSelectedPaymentMethod(null);
        if (initialDate) {
            const d = new Date(initialDate);
            setDate(d.toISOString().split('T')[0]);
            setTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase());
        }
        setRecordingTime(5);
        
        // Extraer color si existe en los detalles guardados
        if (initialDetails.includes('COLOR: ')) {
            const match = initialDetails.match(/COLOR: (#[A-Fa-f0-9]+)/);
            if (match) setColor(match[1]);
        }
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { alert("No se pudo acceder a la cámara."); setIsCameraActive(false); }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      canvasRef.current.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.7);
      if (images.length < 5) setImages([...images, dataUrl]);
      else alert("Máximo 5 fotos permitidas.");
    }
  };

  const startRecording = async () => {
      try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
              throw new Error("Su navegador no soporta la grabación de audio o no está en un entorno seguro (HTTPS).");
          }

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // Detectar formato soportado (iOS prefiere audio/mp4 o audio/aac)
          const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/wav'];
          const supportedMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
          
          const options = supportedMime ? { mimeType: supportedMime } : {};
          const mediaRecorder = new MediaRecorder(stream, options);
          
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];
          
          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) audioChunksRef.current.push(event.data);
          };
          
          mediaRecorder.onstop = () => {
              const blob = new Blob(audioChunksRef.current, { type: supportedMime || 'audio/wav' });
              const reader = new FileReader();
              reader.readAsDataURL(blob);
              reader.onloadend = () => setAudioBlob(reader.result as string);
              stream.getTracks().forEach(track => track.stop());
          };
          
          mediaRecorder.start();
          setIsRecording(true);
          setRecordingTime(5);
          timerRef.current = window.setInterval(() => {
              setRecordingTime(prev => { 
                if (prev <= 1) { stopAudioRecording(); return 0; } 
                return prev - 1; 
              });
          }, 1000);
      } catch (err) { 
          console.error("Mic Error:", err);
          const message = err instanceof Error ? err.message : "Error al acceder al micrófono.";
          alert(message + "\n\nAsegúrese de otorgar permisos y usar HTTPS."); 
      }
  };

  const stopAudioRecording = () => {
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setIsRecording(false);
  };

  const handlePlayAudio = () => {
      if (audioBlob) {
          if (!audioPlayerRef.current) {
              audioPlayerRef.current = new Audio(audioBlob);
              audioPlayerRef.current.onended = () => setIsPlaying(false);
          } else audioPlayerRef.current.src = audioBlob;
          audioPlayerRef.current.play();
          setIsPlaying(true);
      }
  };

  const toggleDefect = (def: string) => {
      setDefects(prev => prev.includes(def) ? prev.filter(d => d !== def) : [...prev, def]);
  };

  const handleSave = () => {
      let finalDetails = details;
      if (defects.length > 0) finalDetails = `DEFECTOS: ${defects.join(', ')} | ` + finalDetails;
      finalDetails = `COLOR: ${color} | ` + finalDetails;
      
      let finalDateStr = undefined;
      if (date) {
        const [h, m_mod] = time.split(':');
        const [m, mod] = m_mod.split(' ');
        let hour = parseInt(h);
        if (mod === 'PM' && hour < 12) hour += 12;
        if (mod === 'AM' && hour === 12) hour = 0;
        finalDateStr = `${date}T${hour.toString().padStart(2,'0')}:${m}:00Z`;
      }

      onSave(finalDetails, images, audioBlob || undefined, finalDateStr, selectedPaymentMethod || undefined, selectedProduct || undefined);
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-2 md:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[98dvh] sm:h-auto sm:max-h-[95vh] animate-in fade-in zoom-in duration-200 my-auto">
        <div className="bg-indigo-600 text-white px-5 sm:px-6 py-3 sm:py-4 flex justify-between items-center shrink-0">
          <div className="overflow-hidden">
            <h3 className="font-black text-sm sm:text-lg uppercase tracking-tight truncate">
              {isAdjustment && !itemName ? 'Agregar Nueva Prenda' : 'Detallar Prenda'}
            </h3>
            <p className="text-[10px] font-bold opacity-80 truncate uppercase tracking-widest mt-0.5">
              {selectedProduct ? `${selectedProduct.name} - ${selectedProduct.category}` : (itemName || 'Configuración de Servicio')}
            </p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-xl transition-all"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 custom-scrollbar">
            {/* BUSCADOR DE PRODUCTO (SI ES NUEVO) */}
            {isAdjustment && !itemName && !selectedProduct && (
                <div className="space-y-4 pb-6 border-b border-gray-100 animate-in slide-in-from-top-4 duration-300">
                    <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest pl-1">Seleccionar Prenda / Servicio</label>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text"
                            placeholder="BUSCAR PRODUCTO..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value.toUpperCase())}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                            autoFocus
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                         {availableProducts.filter(p => p.name.includes(productSearch) || p.category.includes(productSearch)).map(p => (
                             <button 
                                key={p.id}
                                onClick={() => setSelectedProduct(p)}
                                className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-600 hover:bg-indigo-50 transition-all text-left shadow-sm group"
                             >
                                 <div>
                                    <p className="text-xs font-bold text-slate-800 uppercase">{p.name}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.category}</p>
                                 </div>
                                 <p className="text-xs font-bold text-indigo-600 group-hover:scale-110 transition-transform">S/ {p.price.toFixed(2)}</p>
                             </button>
                         ))}
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    {/* COLOR PICKER ACTUALIZADO CON CATÁLOGO */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Palette size={14}/> Catálogo de Colores y Texturas</label>
                        <div className="flex flex-wrap gap-2">
                            {globalColors.length > 0 ? (
                                globalColors.map(c => (
                                    <button 
                                        key={c.id} 
                                        onClick={() => setColor(c.hex)}
                                        className={`w-9 h-9 rounded-xl border-2 transition-all relative group ${color === c.hex ? 'border-indigo-600 ring-2 ring-indigo-200 scale-110' : 'border-white hover:scale-105 shadow-sm'}`}
                                        style={{ backgroundColor: c.hex }}
                                        title={c.nombre}
                                    >
                                        {c.url_imagen && (
                                            <img src={c.url_imagen} className="absolute inset-0 w-full h-full object-cover rounded-[0.4rem] mix-blend-overlay opacity-30" referrerPolicy="no-referrer" />
                                        )}
                                        {color === c.hex && <Check className="text-white absolute inset-0 m-auto drop-shadow-md" size={14} />}
                                    </button>
                                ))
                            ) : (
                                <div className="flex items-center gap-4">
                                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-16 h-16 rounded-xl cursor-pointer border-4 border-white shadow-md" />
                                    <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 font-mono font-bold text-indigo-600 uppercase tracking-wider">{color}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* DEFECTOS */}
                    <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100">
                        <label className="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2"><AlertTriangle size={14}/> Defectos Detectados</label>
                        <div className="flex flex-wrap gap-2">
                            {DEFECTOS_OPCIONES.map(def => (
                                <button key={def} type="button" onClick={() => toggleDefect(def)} className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all border-2 ${defects.includes(def) ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white text-red-400 border-red-100 hover:border-red-200'}`}>{def}</button>
                            ))}
                        </div>
                    </div>

                    {/* NOTA DE VOZ (5s COUNTDOWN) */}
                    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-white">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Mic size={14}/> Grabación de Evidencia (5s Máx.)</label>
                        <div className="flex items-center justify-between">
                            {!audioBlob ? (
                                !isRecording ? (
                                    <button onClick={startRecording} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all w-full justify-center shadow-lg"><Mic size={18} /> INICIAR GRABACIÓN</button>
                                ) : (
                                    <div className="flex items-center justify-between w-full bg-red-600/20 p-3 rounded-xl border border-red-600/30">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]"></div>
                                            <span className="text-xl font-bold font-mono">00:0{recordingTime}</span>
                                        </div>
                                        <button onClick={stopAudioRecording} className="bg-white text-red-600 p-2 rounded-full hover:scale-110 transition-transform"><Square size={20} fill="currentColor" /></button>
                                    </div>
                                )
                            ) : (
                                <div className="flex items-center gap-2 w-full">
                                    <button onClick={handlePlayAudio} disabled={isPlaying} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg">{isPlaying ? <span className="animate-pulse">ESCUCHANDO...</span> : <><Play size={18} fill="currentColor" /> REPRODUCIR NOTA</>}</button>
                                    <button onClick={() => setAudioBlob(null)} className="p-3 bg-red-600/10 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={20} /></button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* FOTOS (MAX 5) */}
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col h-full">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex justify-between"><span>Fotos de Evidencia</span><span>{images.length}/5</span></label>
                        <div className={`bg-black rounded-2xl overflow-hidden relative flex items-center justify-center shadow-inner border-2 border-slate-200 shrink-0 transition-all duration-300 ${isCameraActive ? 'aspect-video' : 'h-24'}`}>
                            {isCameraActive ? (
                                <>
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                    <canvas ref={canvasRef} className="hidden" />
                                    <div className="absolute bottom-4 flex gap-4">
                                        <button onClick={() => { streamRef.current?.getTracks().forEach(t=>t.stop()); setIsCameraActive(false); }} className="bg-black/50 text-white p-3 rounded-full backdrop-blur-md border border-white/20"><X size={20}/></button>
                                        <button onClick={capturePhoto} className="bg-white text-black p-4 rounded-full shadow-2xl border-4 border-gray-200 active:scale-95 transition-transform"><Camera size={32}/></button>
                                    </div>
                                </>
                            ) : (
                                <button onClick={startCamera} className="flex flex-col items-center gap-2 text-white/30 hover:text-white transition-colors">
                                    <Camera size={32} />
                                    <span className="text-[8px] font-bold tracking-[0.2em] uppercase">Abrir Cámara</span>
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar py-1">
                            {images.map((img, idx) => (
                                <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 bg-white group shadow-sm shrink-0">
                                    <img src={img} className="w-full h-full object-cover" />
                                    <button onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))} className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* NOTA Y FECHA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nota / Observación Adicional</label>
                    <textarea value={details} onChange={(e) => setDetails(e.target.value.toUpperCase())} className="w-full border-2 border-gray-200 rounded-2xl p-4 text-sm font-bold focus:border-indigo-500 outline-none resize-none h-24 bg-yellow-50/30 uppercase" placeholder="Ej: MANCHA CERCA AL CUELLO..."/>
                </div>
                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex flex-col justify-center">
                    <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1"><Calendar size={14} /> Fecha de Entrega Especial</label>
                    <div className="flex gap-2">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 border-2 border-indigo-100 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-indigo-600"/>
                        <select value={time} onChange={e => setTime(e.target.value)} className="w-32 border-2 border-indigo-100 rounded-xl px-2 py-3 font-bold text-xs bg-white outline-none focus:border-indigo-600">
                            {["08:00 AM", "10:00 AM", "12:00 PM", "02:00 PM", "04:00 PM", "06:00 PM", "08:00 PM", "10:00 PM"].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
            </div>
            {/* REGISTRO DE PAGO (OPCIONAL EN AJUSTE) */}
            {isAdjustment && (selectedProduct || itemName) && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                    <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2"><Wallet size={14}/> Registrar Pago Inmediato (Opcional)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                        {paymentMethods.filter(m => m.isActive).map(m => (
                            <button
                                key={m.id}
                                onClick={() => setSelectedPaymentMethod(selectedPaymentMethod === m.id ? null : m.id)}
                                className={`flex flex-col items-center justify-center gap-2 p-2 rounded-2xl border-2 transition-all group ${selectedPaymentMethod === m.id ? 'border-emerald-500 bg-emerald-50 shadow-md scale-105' : 'border-slate-50 bg-white hover:border-slate-200'}`}
                            >
                                <div className={`p-1.5 rounded-xl transition-all ${selectedPaymentMethod === m.id ? 'bg-emerald-600 text-white' : 'bg-slate-50 grayscale group-hover:grayscale-0'}`}>
                                    {m.icon ? (
                                        <img src={m.icon} className="w-8 h-8 md:w-9 md:h-9 object-contain" referrerPolicy="no-referrer" />
                                    ) : (
                                        <Wallet size={20} />
                                    )}
                                </div>
                                <span className={`text-[7px] font-bold uppercase tracking-tight text-center leading-none ${selectedPaymentMethod === m.id ? 'text-emerald-900' : 'text-slate-400'}`}>
                                    {m.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
            <button onClick={onClose} className="px-6 py-3 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-all">Cancelar</button>
            <button 
                onClick={handleSave} 
                disabled={isAdjustment && !selectedProduct && !itemName}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 px-10 rounded-xl transition-all shadow-xl shadow-indigo-600/30 flex items-center gap-3 uppercase tracking-widest text-xs active:scale-95"
            >
                <Save size={20} /> Guardar Cambios
            </button>
        </div>
      </div>
    </div>
  );
};

export default CartItemDetailModal;

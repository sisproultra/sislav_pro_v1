import React, { useState, useRef, useEffect } from 'react';
import { 
    X, Camera, Save, Mic, Palette, Shirt, Volume2, Activity,
    Check, Square, Pause, Trash2, Loader2, Play, Image as ImageIcon, Calendar, Clock, Maximize2
} from 'lucide-react';
import { CartItem, GlobalColor, ItemDetalle, Company, UmSaas } from '../types';
import { dbGetGlobalColors, dbUploadImage } from '../services/dbService';

interface MultiItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (detalles: ItemDetalle[], totalQuantity?: number) => void;
  item: CartItem;
  company: Company;
}

const DEFECTOS_BASE = ["ROTO", "MANCHADO", "MOHO", "HUECO", "DECOLORADO"];

const DELIVERY_HOURS = [
    "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", 
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM", 
    "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM"
];

const MultiItemDetailModal: React.FC<MultiItemDetailModalProps> = ({ isOpen, onClose, onSave, item, company }) => {
    const [itemsData, setItemsData] = useState<any[]>([]);
    const [availableColors, setAvailableColors] = useState<GlobalColor[]>([]);
    const [activeColorPicker, setActiveColorPicker] = useState<number | null>(null);
    const [isUploading, setIsUploading] = useState<number | null>(null);
    
    const [cameraTarget, setCameraTarget] = useState<number | null>(null);
    const [audioTarget, setAudioTarget] = useState<number | null>(null);
    
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(5);
    const [activeAudioPlaying, setActiveAudioPlaying] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioTimerRef = useRef<number | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    const brandPrimary = document.documentElement.style.getPropertyValue('--brand-primary').trim() || '#0054A6';

    useEffect(() => {
        if (isOpen) {
            loadColors();
            
            // Determinar si es un producto por peso/volumen que no debe partirse
            const isBulk = item.um_saas === UmSaas.KILO || 
                          item.um_saas === UmSaas.LITRO || 
                          item.um_saas === UmSaas.METROS;
            
            // Si es bulk, solo una entrada. Si no, partir según la cantidad (ceil)
            const length = isBulk ? 1 : Math.ceil(item.quantity || 1);

            let initial: any[] = [];
            
            // Intentar cargar detalles existentes si hay
            if (item.details) {
                try {
                    const parsed = JSON.parse(item.details);
                    if (Array.isArray(parsed)) {
                        initial = parsed.map((d: any, i: number) => {
                            // Extraer color hex si es posible
                            const hexMatch = d.color ? d.color.match(/#(?:[0-9a-fA-F]{3}){1,2}/) : null;
                            
                            // Reconstruir fecha y hora
                            let dDate = '';
                            let dTime = '05:00 PM';
                            if (d.fecha_entrega_especifica) {
                                const dateObj = new Date(d.fecha_entrega_especifica);
                                dDate = dateObj.toISOString().split('T')[0];
                                dTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
                            }

                            return {
                                index: i,
                                details: d.observaciones || '',
                                color: d.color || '',
                                hex: hexMatch ? hexMatch[0] : '',
                                url_imagen: '', // No tenemos la URL de textura fácilmente aquí sin buscar en availableColors
                                defects: d.defectos ? d.defectos.split(', ').filter(Boolean) : [],
                                images: d.unit_images || [],
                                audioNote: d.unit_audio || null,
                                deliveryDate: dDate,
                                deliveryTime: dTime,
                                width: d.width || 0,
                                height: d.height || 0,
                                calculatedQuantity: d.width && d.height ? d.width * d.height : (isBulk ? item.quantity : 1)
                            };
                        });
                    }
                } catch (e) {
                    console.error("Error al parsear detalles existentes:", e);
                }
            }

            // Si no hay datos previos o la cantidad cambió (y no es bulk), regeneramos/completamos
            if (initial.length === 0) {
                initial = Array.from({ length }, (_, i) => ({ 
                    index: i, 
                    details: '', 
                    color: '', 
                    hex: '',
                    url_imagen: '',
                    defects: [], 
                    images: [], 
                    audioNote: null, 
                    deliveryDate: '',
                    deliveryTime: '05:00 PM',
                    width: 0,
                    height: 0,
                    calculatedQuantity: isBulk ? item.quantity : 1
                }));
            } else if (isBulk) {
                // Para bulk, siempre forzamos a una sola entrada (la primera)
                initial = [initial[0]];
            } else if (initial.length < length) {
                // Si faltan entradas, agregar las nuevas
                const missing = Array.from({ length: length - initial.length }, (_, i) => ({
                    index: initial.length + i,
                    details: '',
                    color: '',
                    hex: '',
                    url_imagen: '',
                    defects: [],
                    images: [],
                    audioNote: null,
                    deliveryDate: '',
                    deliveryTime: '05:00 PM',
                    width: 0,
                    height: 0,
                    calculatedQuantity: 1
                }));
                initial = [...initial, ...missing];
            } else if (initial.length > length) {
                // Si sobran (porque bajó la cantidad), recortamos
                initial = initial.slice(0, length);
            }

            setItemsData(initial);
        }
        return () => { stopCamera(); stopAudioPlayback(); };
    }, [isOpen, item.quantity, item.um_saas, item.details]);

    const loadColors = async () => {
        const colors = await dbGetGlobalColors();
        const sortedColors = [...colors].sort((a, b) => {
            const aIsTexture = !!a.url_imagen;
            const bIsTexture = !!b.url_imagen;
            if (aIsTexture !== bIsTexture) return aIsTexture ? 1 : -1;
            return a.nombre.localeCompare(b.nombre);
        });
        setAvailableColors(sortedColors);
    };

    const getFormattedTimestamp = () => {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${String(now.getFullYear()).slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    };

    const getStoragePath = (folder: string, extension: string) => {
        const holding = company.holding_name?.toLowerCase().replace(/\s+/g, '_') || 'demo';
        const slug = (company as any).slug || 'demo_lima';
        const timestamp = getFormattedTimestamp();
        return `global/empresas/${holding}/${slug}/${folder}/${timestamp}.${extension}`;
    };

    const stopCamera = () => { 
        if (streamRef.current) { 
            streamRef.current.getTracks().forEach(t => t.stop()); 
            streamRef.current = null; 
        } 
        setCameraTarget(null); 
    };

    const startCamera = async (idx: number) => { 
        try { 
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); 
            streamRef.current = stream; 
            setCameraTarget(idx);
            setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100); 
        } catch (e) { alert("No se pudo acceder a la cámara."); } 
    };

    const capturePhoto = async () => { 
        if (cameraTarget === null || !videoRef.current || !canvasRef.current) return;
        const targetIdx = cameraTarget; 
        const currentImages = itemsData[targetIdx]?.images || [];
        if (currentImages.length >= 3) {
            alert("Máximo 3 fotos por prenda.");
            stopCamera();
            return;
        }

        const canvas = canvasRef.current; 
        canvas.width = videoRef.current.videoWidth; 
        canvas.height = videoRef.current.videoHeight; 
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0); 
        
        const dataUrl = canvas.toDataURL('image/png', 0.8);
        
        setItemsData(prev => prev.map((it, i) => i === targetIdx ? { ...it, images: [...it.images, dataUrl].slice(0,3) } : it)); 

        setIsUploading(targetIdx);
        try {
            const path = getStoragePath('imagen_detalle', 'png');
            const url = await dbUploadImage('laundry-assets', dataUrl, path);
            setItemsData(prev => prev.map((it, i) => i === targetIdx ? { 
                ...it, 
                images: it.images.map((img: string) => img === dataUrl ? url : img) 
            } : it)); 
        } catch (e) { 
            alert("Error al subir foto."); 
            setItemsData(prev => prev.map((it, i) => i === targetIdx ? { 
                ...it, 
                images: it.images.filter((img: string) => img !== dataUrl) 
            } : it)); 
        }
        finally { setIsUploading(null); }
    };

    const startRecording = async (idx: number) => { 
        try { 
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Su navegador no soporta la grabación de audio o no está en un entorno seguro (HTTPS).");
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); 
            
            // Detectar formato soportado (iOS prefiere audio/mp4 o audio/aac)
            const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/wav'];
            const supportedMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
            const extension = supportedMime.includes('mp4') ? 'mp4' : (supportedMime.includes('webm') ? 'webm' : 'wav');
            
            const options = supportedMime ? { mimeType: supportedMime } : {};
            const mr = new MediaRecorder(stream, options); 
            
            mediaRecorderRef.current = mr; 
            audioChunksRef.current = []; 
            mr.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            }; 
            mr.onstop = async () => { 
                const blob = new Blob(audioChunksRef.current, { type: supportedMime || 'audio/wav' }); 
                setIsUploading(idx);
                try {
                    const path = getStoragePath('audio_detalle', extension);
                    const url = await dbUploadImage('laundry-assets', blob, path);
                    setItemsData(prev => prev.map((it, i) => i === idx ? { ...it, audioNote: url } : it)); 
                } catch (e) { alert("Error al subir audio."); }
                finally { setIsUploading(null); setAudioTarget(null); setIsRecording(false); }
                stream.getTracks().forEach(track => track.stop()); 
            }; 
            mr.start(); 
            setAudioTarget(idx);
            setIsRecording(true); 
            setRecordingTime(5); 
            audioTimerRef.current = window.setInterval(() => { 
                setRecordingTime(prev => {
                    if (prev <= 1) { 
                        if (mr.state === 'recording') mr.stop(); 
                        clearInterval(audioTimerRef.current!); 
                        return 0; 
                    }
                    return prev - 1;
                }); 
            }, 1000); 
        } catch (err) { 
            console.error("Mic Error:", err);
            const message = err instanceof Error ? err.message : "Error al acceder al micrófono.";
            alert(message + "\n\nAsegúrese de otorgar permisos y usar HTTPS."); 
            setIsRecording(false);
            setAudioTarget(null);
        } 
    };

    const handlePlayAudio = (audioUrl: string) => {
        if (audioPlayerRef.current) stopAudioPlayback();
        const audio = new Audio(audioUrl);
        audioPlayerRef.current = audio;
        audio.play();
        setActiveAudioPlaying(audioUrl);
        audio.onended = () => setActiveAudioPlaying(null);
    };

    const stopAudioPlayback = () => { 
        if (audioPlayerRef.current) { 
            audioPlayerRef.current.pause(); 
            setActiveAudioPlaying(null);
        } 
    };

    const handleSave = () => { 
        let totalQty = 0;
        const normalDetails: ItemDetalle[] = itemsData.map(it => {
            let finalISO = undefined;
            if (it.deliveryDate && it.deliveryTime) {
                const [h_m, ampm] = it.deliveryTime.split(' ');
                let [h, m] = h_m.split(':');
                let hour = parseInt(h);
                if (ampm === 'PM' && hour < 12) hour += 12;
                if (ampm === 'AM' && hour === 12) hour = 0;
                finalISO = `${it.deliveryDate}T${String(hour).padStart(2,'0')}:${m}:00Z`;
            }

            totalQty += (it.calculatedQuantity || 1);

            return {
                color: it.color,
                defectos: it.defects.join(', '),
                observaciones: it.details.toUpperCase(),
                fecha_entrega_especifica: finalISO,
                unit_images: it.images,
                unit_audio: it.audioNote,
                width: it.width,
                height: it.height
            };
        });
        onSave(normalDetails, item.requiresAreaCalc ? totalQty : undefined); 
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/90 z-[200] flex items-center justify-center p-2 md:p-4 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
                <div className="text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md" style={{ backgroundColor: brandPrimary }}>
                    <div className="flex items-center gap-3"><Shirt size={22} /><h3 className="font-bold text-base uppercase tracking-tight truncate max-w-[220px]">{item.name}</h3></div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-slate-100 custom-scrollbar">
                    {itemsData.map((data, idx) => (
                        <div key={idx} className="rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4 relative overflow-hidden bg-white p-4">
                            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: data.hex || '#cbd5e1' }}></div>
                            <div className="flex items-center justify-between pl-2">
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setActiveColorPicker(idx)} 
                                        className="w-10 h-10 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-all bg-cover bg-center" 
                                        style={{ 
                                            backgroundColor: data.url_imagen ? 'transparent' : (data.hex || '#f1f5f9'),
                                            backgroundImage: data.url_imagen ? `url(${data.url_imagen})` : 'none'
                                        }}
                                    >
                                        {!data.color && <Palette size={18} className="text-slate-400" />}
                                    </button>
                                    <div className="flex flex-col"><span className="font-bold text-slate-950 text-xs uppercase leading-none">Prenda {idx + 1}</span><span className="text-[9px] font-bold text-slate-500 uppercase">{data.color || 'Sin color'}</span></div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex items-center gap-1">
                                        {data.images.map((img: string, i: number) => (
                                            <div key={i} className="w-8 h-8 rounded-lg border overflow-hidden relative group">
                                                <img src={img} className="w-full h-full object-cover" />
                                                <button onClick={() => setItemsData(prev => prev.map((it, j) => j === idx ? { ...it, images: it.images.filter((_: any, k: number) => k !== i) } : it))} className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={10}/></button>
                                            </div>
                                        ))}
                                        {data.images.length < 3 && (
                                            <button onClick={() => startCamera(idx)} className="p-2 bg-slate-50 border rounded-xl text-slate-500 hover:text-indigo-600 transition-all">{isUploading === idx ? <Loader2 className="animate-spin" size={18}/> : <Camera size={18} />}</button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {data.audioNote ? (
                                            <div className="flex gap-1">
                                                <button onClick={() => handlePlayAudio(data.audioNote)} className={`p-2 border rounded-xl transition-all ${activeAudioPlaying === data.audioNote ? 'bg-emerald-600 text-white border-emerald-600 animate-pulse' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                                                    <Volume2 size={18} />
                                                </button>
                                                <button onClick={() => setItemsData(prev => prev.map((it, i) => i === idx ? { ...it, audioNote: null } : it))} className="p-2 bg-red-50 text-red-600 border border-red-100 rounded-xl"><Trash2 size={18}/></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => startRecording(idx)} className="p-2 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:text-red-600 transition-all">
                                                <Mic size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="pl-2 flex flex-wrap gap-1.5">
                                {DEFECTOS_BASE.map(def => (
                                    <button key={def} onClick={() => setItemsData(prev => prev.map((it, i) => i === idx ? { ...it, defects: it.defects.includes(def) ? it.defects.filter((d: string) => d !== def) : [...it.defects, def] } : it))} className={`px-3 py-1.5 rounded-xl text-[9px] font-bold border transition-all ${data.defects.includes(def) ? 'bg-slate-950 border-slate-950 text-white' : 'bg-white text-slate-950 border-slate-300'}`}>{def}</button>
                                ))}
                            </div>

                            {/* CÁLCULO POR AREA (PARA ALFOMBRAS) */}
                            {item.requiresAreaCalc && (
                                <div className="pl-2 border-t border-indigo-100 pt-3 pb-1">
                                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Maximize2 size={16} /> Cálculo de Área (Ancho x Largo)
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center ml-1">
                                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Ancho (m)</label>
                                            </div>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={data.width || ''} 
                                                    onChange={e => {
                                                        const w = parseFloat(e.target.value) || 0;
                                                        setItemsData(prev => prev.map((it, i) => i === idx ? { 
                                                            ...it, 
                                                            width: w, 
                                                            calculatedQuantity: w * (it.height || 0),
                                                            details: `${w.toFixed(2)}x${(it.height || 0).toFixed(2)} m2 ${it.details.replace(/^\d+(\.\d+)?x\d+(\.\d+)? m2 /, '')}`.toUpperCase()
                                                        } : it));
                                                    }}
                                                    className="w-full px-4 py-3 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all shadow-inner"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center ml-1">
                                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Alto / Largo (m)</label>
                                            </div>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={data.height || ''} 
                                                    onChange={e => {
                                                        const h = parseFloat(e.target.value) || 0;
                                                        setItemsData(prev => prev.map((it, i) => i === idx ? { 
                                                            ...it, 
                                                            height: h, 
                                                            calculatedQuantity: (it.width || 0) * h,
                                                            details: `${(it.width || 0).toFixed(2)}x${h.toFixed(2)} m2 ${it.details.replace(/^\d+(\.\d+)?x\d+(\.\d+)? m2 /, '')}`.toUpperCase()
                                                        } : it));
                                                    }}
                                                    className="w-full px-4 py-3 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all shadow-inner"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 bg-slate-900 rounded-xl p-3 flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total metros cuadrados:</span>
                                        <span className="text-sm font-black text-white tabular-nums">{(data.calculatedQuantity || 0).toFixed(2)} m²</span>
                                    </div>
                                </div>
                            )}
                            
                            {/* NUEVOS INPUTS: FECHA Y HORA DE ENTREGA POR ITEM */}
                            <div className="pl-2 grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Calendar size={10}/> Fecha Entrega</label>
                                    <input 
                                        type="date" 
                                        value={data.deliveryDate} 
                                        onChange={e => setItemsData(prev => prev.map((it, i) => i === idx ? { ...it, deliveryDate: e.target.value } : it))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1"><Clock size={10}/> Hora Entrega</label>
                                    <select 
                                        value={data.deliveryTime}
                                        onChange={e => setItemsData(prev => prev.map((it, i) => i === idx ? { ...it, deliveryTime: e.target.value } : it))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-900 outline-none focus:border-indigo-500 appearance-none bg-no-repeat bg-[right_0.5rem_center] transition-all"
                                    >
                                        {DELIVERY_HOURS.map(hour => <option key={hour} value={hour}>{hour}</option>)}
                                    </select>
                                </div>
                            </div>

                            <textarea value={data.details} onChange={e => setItemsData(prev => prev.map((it, i) => i === idx ? { ...it, details: e.target.value.toUpperCase() } : it))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-bold text-slate-950 outline-none h-12 uppercase" placeholder="OBSERVACIONES / MANCHAS..."/>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t bg-white flex flex-col gap-2 shrink-0">
                    <button onClick={handleSave} className="w-full py-4 rounded-3xl font-bold text-sm uppercase tracking-widest text-white shadow-xl flex items-center justify-center gap-3" style={{ backgroundColor: brandPrimary }}><Save size={20} /> GUARDAR AUDITORÍA</button>
                </div>

                {cameraTarget !== null && (
                    <div className="absolute inset-0 z-[250] bg-slate-950/80 flex items-center justify-center p-6 animate-in fade-in">
                        <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col aspect-[4/5] border border-white/20">
                            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase tracking-widest">Captura de Prenda {cameraTarget + 1}</span>
                                <button onClick={stopCamera} className="p-1 hover:bg-white/10 rounded-full"><X size={20}/></button>
                            </div>
                            <div className="flex-1 bg-black relative flex items-center justify-center">
                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                <canvas ref={canvasRef} className="hidden" />
                                <div className="absolute bottom-6 flex justify-center gap-4 w-full px-6">
                                    <button onClick={stopCamera} className="bg-white/20 p-3 rounded-full text-white backdrop-blur-md border border-white/20"><X size={24}/></button>
                                    <button onClick={capturePhoto} className="bg-white p-5 rounded-full text-slate-900 shadow-2xl active:scale-95">
                                        <Camera size={32}/>
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 flex justify-center gap-3 shrink-0 overflow-x-auto no-scrollbar min-h-[80px]">
                                {itemsData[cameraTarget]?.images.map((img: string, i: number) => (
                                    <div key={i} className="w-14 h-14 rounded-xl border-2 border-indigo-600 bg-white flex items-center justify-center overflow-hidden transition-all shrink-0 animate-in zoom-in">
                                        <img src={img} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                                {itemsData[cameraTarget]?.images.length === 0 && (
                                    <div className="flex flex-col items-center justify-center text-slate-300 opacity-50 py-2">
                                        <ImageIcon size={24} />
                                        <p className="text-[8px] font-bold uppercase tracking-widest mt-1">Sin fotos</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {audioTarget !== null && isRecording && (
                    <div className="absolute inset-0 z-[250] bg-slate-950/80 flex items-center justify-center p-6 animate-in fade-in">
                        <div className="bg-white rounded-[2rem] w-full max-w-xs p-10 shadow-2xl flex flex-col items-center gap-6 border border-white/20">
                            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600 ring-8 ring-red-50 animate-pulse">
                                <Mic size={40} />
                            </div>
                            <div className="text-center">
                                <h4 className="text-3xl font-bold text-slate-900 tabular-nums">00:0{recordingTime}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Grabando evidencia de voz...</p>
                            </div>
                            <button onClick={() => mediaRecorderRef.current?.stop()} className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                                <Square size={16} fill="currentColor" /> DETENER AHORA
                            </button>
                        </div>
                    </div>
                )}

                {activeColorPicker !== null && (
                    <div className="absolute inset-0 bg-slate-950/80 z-[210] flex items-center justify-center p-6">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-8 shadow-2xl animate-in zoom-in-95">
                            <h4 className="text-sm font-bold uppercase text-slate-950 mb-6 text-center">Color de Prenda</h4>
                            <div className="grid grid-cols-4 gap-4 max-h-[300px] overflow-y-auto no-scrollbar">
                                {availableColors.map(color => (
                                    <button 
                                        key={color.id} 
                                        onClick={() => { 
                                            setItemsData(prev => prev.map((it, i) => i === activeColorPicker ? { 
                                                ...it, 
                                                color: color.nombre, 
                                                hex: color.hex,
                                                url_imagen: color.url_imagen
                                            } : it)); 
                                            setActiveColorPicker(null); 
                                        }} 
                                        className="flex flex-col items-center gap-2"
                                    >
                                        <div 
                                            className="w-12 h-12 rounded-full border-2 border-slate-100 shadow-md bg-cover bg-center" 
                                            style={{ 
                                                backgroundColor: color.url_imagen ? 'transparent' : color.hex,
                                                backgroundImage: color.url_imagen ? `url(${color.url_imagen})` : 'none'
                                            }} 
                                        />
                                        <span className="text-[8px] font-bold uppercase text-slate-500 truncate w-full text-center">{color.nombre}</span>
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setActiveColorPicker(null)} style={{ backgroundColor: brandPrimary }} className="w-full mt-8 py-3 text-white rounded-xl font-bold text-[10px] uppercase">Cerrar</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MultiItemDetailModal;
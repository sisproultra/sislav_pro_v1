

import React, { useState, useRef, useEffect } from 'react';
import { Expense, Company, Employee, UserRole, PaymentMethodConfig } from '../types';
import { dbUploadImage } from '../services/dbService';
import { Plus, X, Calendar, DollarSign, Tag, Camera, Trash2, Loader2, ImageIcon, User, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';

interface ExpensesProps {
  expenses: Expense[];
  company: Company;
  currentUser?: Employee | null;
  paymentMethods: PaymentMethodConfig[];
  onSave: (exp: Omit<Expense, 'id'>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  canManage?: boolean;
}

const Expenses: React.FC<ExpensesProps> = ({ expenses, company, currentUser, paymentMethods, onSave, onDelete, canManage = true }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('General');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // Estados de cámara
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const currency = company.currencySymbol || 'S/';

  useEffect(() => {
    if (cameraActive && cameraStream && videoRef.current) {
        videoRef.current.srcObject = cameraStream;
    }
  }, [cameraActive, cameraStream]);

  const startCamera = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setCameraStream(stream);
        setCameraActive(true);
    } catch (err) {
        alert("No se pudo acceder a la cámara del dispositivo.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            setIsUploading(true);
            try {
                const url = await dbUploadImage('egresos', dataUrl, `gasto_${Date.now()}.jpg`);
                setEvidencePhoto(url);
                stopCamera();
                if ('vibrate' in navigator) navigator.vibrate(50);
            } catch (e) {
                alert("Error al subir foto de evidencia.");
            } finally {
                setIsUploading(false);
            }
        }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;

    setIsCapturing(true);
    const now = new Date();
    const finalDate = date === now.toLocaleDateString('en-CA') 
        ? now.toISOString() 
        : new Date(date + 'T12:00:00').toISOString();

    // FIX: Add sucursal_id to onSave payload
    await onSave({
      sucursal_id: company.id,
      description: description.toUpperCase(),
      amount: parseFloat(amount),
      date: finalDate,
      category,
      paymentMethod,
      evidencePhoto: evidencePhoto || undefined,
      usuarioRegistro: currentUser?.name || UserRole.OPERARIO
    });
    setIsModalOpen(false);
    setIsCapturing(false);
    resetForm();
  };

  const resetForm = () => {
      setDescription('');
      setAmount('');
      setEvidencePhoto(null);
      setDate(new Date().toLocaleDateString('en-CA'));
      stopCamera();
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="p-6 lg:p-8 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Egresos</h2>
            <p className="text-sm text-gray-500">Registro de salidas de dinero, recaudos y gastos operativos</p>
          </div>
          <div className="flex items-center gap-4">
              <div className="text-right">
                  <p className="text-xs text-gray-500 font-bold uppercase">Total Mes</p>
                  <p className="text-xl font-bold text-red-600">{currency} {totalExpenses.toFixed(2)}</p>
              </div>
              {canManage && (
                <button 
                  onClick={() => { resetForm(); setIsModalOpen(true); }}
                  className="bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-700 shadow-lg shadow-red-600/20"
                >
                  <Plus size={18} /> Registrar Egreso
                </button>
              )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                    <tr>
                        <th className="p-4">Fecha</th>
                        <th className="p-4">Descripción</th>
                        <th className="p-4">Categoría</th>
                        <th className="p-4">Registrado por</th>
                        <th className="p-4 text-right">Monto</th>
                        <th className="p-4 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {expenses.length === 0 ? (
                        <tr><td colSpan={6} className="p-12 text-center text-gray-400">No hay egresos registrados.</td></tr>
                    ) : (
                        expenses.map((exp, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="p-4 text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-gray-400"/>
                                        <div className="flex flex-col">
                                            <span>{new Date(exp.date).toLocaleDateString()}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(exp.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 font-medium text-gray-800">
                                    <div className="flex items-center gap-2">
                                        {exp.evidencePhoto && <ImageIcon size={14} className="text-indigo-500 shrink-0" />}
                                        {exp.description}
                                    </div>
                                </td>
                                <td className="p-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs uppercase font-bold">{exp.category}</span></td>
                                <td className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1.5 mt-1">
                                    <User size={12} /> {exp.usuarioRegistro || 'SISTEMA'}
                                </td>
                                <td className="p-4 text-right font-bold text-red-600 tabular-nums">{currency} {exp.amount.toFixed(2)}</td>
                                <td className="p-4">
                                    <div className="flex justify-center">
                                        {canManage && (
                                            <button 
                                                onClick={() => setExpenseToDelete(exp.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Eliminar Egreso"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>

      <ConfirmationModal 
          isOpen={!!expenseToDelete}
          onClose={() => setExpenseToDelete(null)}
          onConfirm={async () => { if (expenseToDelete && onDelete) { await onDelete(expenseToDelete); setExpenseToDelete(null); } }}
          title="Eliminar Egreso"
          message={<p className="font-bold text-slate-800">¿Desea eliminar este registro de salida de dinero? Esta acción es irreversible.</p>}
          confirmText="Sí, Eliminar"
          isDangerous={true}
      />

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[150] flex items-center justify-center p-2 md:p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-white/20">
             <div className="p-6 border-b flex justify-between items-center bg-red-50 shrink-0">
                 <div className="flex items-center gap-3">
                    <div className="bg-red-600 p-2 rounded-xl text-white shadow-lg">
                        <DollarSign size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-red-900 uppercase tracking-tight">Nuevo Egreso</h3>
                 </div>
                 <button onClick={() => { setIsModalOpen(false); stopCamera(); }} className="p-2 hover:bg-red-100 rounded-full transition-colors"><X size={24} className="text-red-800"/></button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar bg-white">
                 <div className="relative aspect-video bg-slate-900 rounded-[2rem] overflow-hidden border-2 border-slate-100 flex items-center justify-center group shadow-inner">
                    {isUploading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-indigo-500" size={48} />
                            <span className="text-[10px] text-white font-bold uppercase tracking-widest">Subiendo evidencia...</span>
                        </div>
                    ) : cameraActive ? (
                        <>
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <canvas ref={canvasRef} className="hidden" />
                            <div className="absolute inset-x-0 bottom-6 flex justify-center">
                                <button 
                                    type="button" 
                                    onClick={capturePhoto} 
                                    className="bg-white text-slate-900 p-5 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.5)] active:scale-90 transition-transform"
                                >
                                    <Camera size={32} />
                                </button>
                            </div>
                            <button 
                                type="button" 
                                onClick={stopCamera} 
                                className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black transition-all"
                            >
                                <X size={20} />
                            </button>
                        </>
                    ) : evidencePhoto ? (
                        <div className="relative w-full h-full animate-in zoom-in-95">
                            <img src={evidencePhoto} className="w-full h-full object-cover" alt="Evidencia" />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
                            <button 
                                type="button" 
                                onClick={() => setEvidencePhoto(null)} 
                                className="absolute top-4 right-4 bg-red-600 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                            >
                                <Trash2 size={20} />
                            </button>
                            <div className="absolute bottom-4 left-6 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-bold text-white uppercase border border-white/30 tracking-widest">
                                Foto Almacenada OK
                            </div>
                        </div>
                    ) : (
                        <button 
                            type="button" 
                            onClick={startCamera} 
                            className="flex flex-col items-center gap-4 text-slate-500 hover:text-indigo-400 transition-all hover:scale-105"
                        >
                            <div className="bg-slate-800 p-6 rounded-full border border-slate-700 shadow-2xl relative">
                                <div className="absolute -inset-2 bg-indigo-500/20 rounded-full animate-ping"></div>
                                <Camera size={48} className="relative z-10" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Habilitar Cámara</span>
                        </button>
                    )}
                 </div>

                 <form onSubmit={handleSubmit} className="space-y-6">
                     <div className="space-y-1">
                         <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Descripción</label>
                         <input required value={description} onChange={e => setDescription(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-bold uppercase outline-none focus:bg-white focus:border-red-500 transition-all shadow-inner" placeholder="PAGO DE LUZ, RECIBO N°..." />
                     </div>
                     <div className="space-y-1">
                         <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Monto del Egreso</label>
                         <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-red-600 text-lg">{currency}</span>
                            <input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-3xl font-bold outline-none focus:bg-white focus:border-red-500 transition-all text-slate-900 shadow-inner" placeholder="0.00" />
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                             <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Fecha del Egreso</label>
                             <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:bg-white transition-all shadow-sm" />
                         </div>
                         <div className="space-y-1">
                             <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Categoría</label>
                             <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold uppercase outline-none focus:bg-white appearance-none shadow-sm">
                                <option>Servicios</option>
                                <option>Personal</option>
                                <option>Mantenimiento</option>
                                <option>Insumos</option>
                                <option>Recaudo</option>
                                <option>Descuento</option>
                                <option>Otros</option>
                             </select>
                         </div>
                     </div>

                     <div className="space-y-1">
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Medio de Pago</label>
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                             {paymentMethods.filter(m => m.isActive).map(method => (
                                 <button
                                     key={method.id}
                                     type="button"
                                     onClick={() => setPaymentMethod(method.name)}
                                     className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${paymentMethod === method.name ? 'border-red-600 bg-red-50 text-red-600' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                                 >
                                     <span className="text-[9px] font-bold uppercase truncate w-full text-center">{method.name}</span>
                                 </button>
                             ))}
                         </div>
                     </div>
                     
                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                             <ShieldCheck size={18} />
                         </div>
                         <div className="flex-1">
                             <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-0.5">Operador Responsable</p>
                             <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{currentUser?.name || UserRole.ADMIN}</p>
                         </div>
                     </div>

                     <button 
                        type="submit" 
                        disabled={isCapturing || isUploading}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-5 rounded-[1.8rem] shadow-2xl shadow-red-600/30 active:scale-95 transition-all flex justify-center items-center gap-3 uppercase tracking-[0.2em] text-xs disabled:opacity-50"
                     >
                        {isCapturing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} strokeWidth={3} />}
                        {isCapturing ? 'Procesando...' : 'Confirmar Registro Egreso'}
                     </button>
                 </form>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;

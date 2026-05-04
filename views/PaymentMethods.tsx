import React, { useState } from 'react';
import { PaymentMethodConfig, SUNAT_PAYMENT_CODES, GlobalPaymentImage } from '../types';
import { dbUploadImage, dbRegisterCatalogImage } from '../services/dbService';
import { 
    Plus, X, Upload, Image as ImageIcon, Trash2, Landmark, Check, Ban, Edit, Eye, EyeOff, LayoutGrid, Save, Loader2, RotateCcw, AlertTriangle, Pause, Play
} from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';

interface PaymentMethodsProps {
  methods: PaymentMethodConfig[];
  globalPaymentCatalog?: GlobalPaymentImage[];
  onSave: (pm: Omit<PaymentMethodConfig, 'id'>) => Promise<void>;
  onUpdate: (id: string, pm: Partial<PaymentMethodConfig>) => Promise<void>;
  canManage?: boolean;
}

const PaymentMethods: React.FC<PaymentMethodsProps> = ({ methods, globalPaymentCatalog = [], onSave, onUpdate, canManage = true }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCatalogSelectorOpen, setIsCatalogSelectorOpen] = useState(false);
  
  // State para anulación y suspensión
  const [methodToToggle, setMethodToToggle] = useState<PaymentMethodConfig | null>(null);
  const [methodToSuspend, setMethodToSuspend] = useState<PaymentMethodConfig | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sunatCode, setSunatCode] = useState('009'); 
  
  // Image State
  const [selectedImageId, setSelectedImageId] = useState<string>(''); 
  const [previewUrl, setPreviewUrl] = useState('');

  const openCreateModal = () => {
      setEditingId(null);
      setName('');
      setSunatCode('009');
      setSelectedImageId('');
      setPreviewUrl('');
      setIsModalOpen(true);
  };

  const openEditModal = (pm: PaymentMethodConfig) => {
      setEditingId(pm.id);
      setName(pm.name);
      setSunatCode(pm.sunatCode);
      setSelectedImageId(pm.imagen_id || '');
      setPreviewUrl(pm.icon || '');
      setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsUploading(true);
          try {
              const fileName = `pay_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
              const publicUrl = await dbUploadImage('laundry-assets', file, fileName);
              const catalogId = await dbRegisterCatalogImage(name || file.name, publicUrl, 'METODO_PAGO');
              
              setSelectedImageId(catalogId);
              setPreviewUrl(publicUrl);
          } catch (err: any) {
              alert("Error al subir el icono.");
          } finally {
              setIsUploading(false);
          }
      }
  };

  const selectFromCatalog = (catalogItem: GlobalPaymentImage) => {
      setSelectedImageId(catalogItem.id);
      setPreviewUrl(catalogItem.url);
      setIsCatalogSelectorOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || isSubmitting || isUploading) return;

    setIsSubmitting(true);
    try {
        const pmData: any = {
            name: name.toUpperCase(),
            sunatCode,
            imagen_id: selectedImageId || null,
            icon: previewUrl
        };

        if (editingId) {
            await onUpdate(editingId, pmData);
        } else {
            pmData.isActive = true;
            await onSave(pmData);
        }
        setIsModalOpen(false);
    } catch (error: any) {
        alert("Hubo un error al guardar.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleConfirmToggle = async () => {
      if (!methodToToggle) return;
      try {
          await onUpdate(methodToToggle.id, { isActive: !methodToToggle.isActive });
          setMethodToToggle(null);
      } catch (e) {
          console.error("Error al cambiar estado:", e);
          alert("Error al cambiar estado de activación.");
      }
  };

  const handleConfirmSuspend = async () => {
    if (!methodToSuspend) return;
    try {
        await onUpdate(methodToSuspend.id, { isSuspended: !methodToSuspend.isSuspended });
        setMethodToSuspend(null);
    } catch (e) {
        console.error("Error al suspender/reanudar método:", e);
        alert("Error al cambiar suspensión. Verifique que la columna 'suspendido' exista en la tabla 'metodos_pago'.");
    }
  };

  return (
    <div className="p-6 lg:p-10 h-full overflow-y-auto bg-slate-50 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-3">
                <Landmark className="text-indigo-600" size={32} /> Administrador de Pagos
            </h2>
            <p className="text-sm text-slate-500 font-medium">Configure los medios disponibles para el cobro en terminales.</p>
          </div>
          {canManage && (
            <button onClick={openCreateModal} className="bg-indigo-600 text-white px-8 py-4 rounded-[1.5rem] font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex gap-3 items-center transition-all active:scale-95 uppercase tracking-widest text-xs">
              <Plus size={20} strokeWidth={4} /> Crear Método
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
             {methods.map(pm => {
                 const isAnulado = !pm.isActive;
                 const isSuspended = pm.isSuspended;
                 
                 return (
                  <div key={pm.id} className={`bg-white rounded-[2rem] border-2 transition-all flex flex-col relative group overflow-hidden ${isAnulado ? 'border-red-100 bg-red-50/10 grayscale opacity-70' : isSuspended ? 'border-amber-100 bg-amber-50/10' : 'border-slate-100 shadow-sm hover:shadow-xl'}`}>
                      
                      {isAnulado && (
                          <div className="absolute top-4 right-4 z-10 bg-red-600 text-white px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-widest shadow-lg border border-red-500">
                              Anulado
                          </div>
                      )}

                      {isSuspended && !isAnulado && (
                          <div className="absolute top-4 right-4 z-10 bg-amber-500 text-white px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase tracking-widest shadow-lg border border-amber-400">
                              Suspendido
                          </div>
                      )}

                      <div className="p-6 flex items-center gap-5 flex-1">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden shadow-inner border ${isAnulado ? 'bg-red-50 border-red-100' : isSuspended ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                              {pm.icon ? <img src={pm.icon} alt={pm.name} className="w-full h-full object-contain p-2" /> : <Landmark size={32} className="text-slate-300" />}
                          </div>
                          <div className="min-w-0 flex-1">
                              <h3 className={`font-bold text-base uppercase leading-tight truncate ${isAnulado ? 'text-red-900 line-through' : isSuspended ? 'text-amber-900' : 'text-slate-800'}`}>{pm.name}</h3>
                              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">SUNAT: {pm.sunatCode}</p>
                          </div>
                      </div>

                      <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div className="flex gap-2">
                              {canManage && (
                                <button 
                                   onClick={() => openEditModal(pm)} 
                                   className="p-2 bg-white border border-slate-200 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all shadow-sm active:scale-90"
                                   title="Editar"
                                >
                                   <Edit size={14} />
                                </button>
                              )}
                              {canManage && !isAnulado && (
                                <button 
                                   onClick={() => setMethodToSuspend(pm)} 
                                   className={`p-2 border rounded-xl transition-all shadow-sm active:scale-90 flex items-center gap-1.5 ${isSuspended ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-amber-200 text-amber-600 hover:bg-amber-50'}`}
                                   title={isSuspended ? "Reanudar" : "Suspender"}
                                >
                                   {isSuspended ? <Play size={14} /> : <Pause size={14} />}
                                   <span className="text-[9px] font-bold uppercase tracking-tight">{isSuspended ? 'REANUDAR' : 'SUSPENDER'}</span>
                                </button>
                              )}
                              {canManage && (
                                <button 
                                   onClick={() => setMethodToToggle(pm)} 
                                   className={`p-2 border rounded-xl transition-all shadow-sm active:scale-90 flex items-center gap-1.5 ${!isAnulado ? 'bg-white border-red-200 text-red-600 hover:bg-red-50' : 'bg-green-600 border-green-700 text-white shadow-green-100'}`}
                                   title={!isAnulado ? "Anular" : "Recuperar"}
                                >
                                   {!isAnulado ? <Ban size={14} /> : <RotateCcw size={14} />}
                                   <span className="text-[9px] font-bold uppercase tracking-tight">{!isAnulado ? 'ANULAR' : 'RECOBRAR'}</span>
                                </button>
                              )}
                          </div>
                          
                          <div className={`w-2 h-2 rounded-full ${isAnulado ? 'bg-red-400' : isSuspended ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'}`} />
                      </div>
                  </div>
                 );
             })}
        </div>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
              <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><Landmark size={20}/></div>
                        <h3 className="font-bold text-xl text-slate-900 uppercase tracking-tight">{editingId ? 'Editar Método' : 'Nuevo Método'}</h3>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="bg-white p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-all"><X size={24}/></button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="p-10 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                      <div className="flex flex-col items-center gap-6">
                          <div className="relative group">
                              <div className="w-32 h-32 bg-slate-50 border-4 border-white shadow-xl rounded-[2.5rem] flex items-center justify-center overflow-hidden transition-all group-hover:scale-105">
                                  {isUploading ? <Loader2 className="animate-spin text-indigo-500" size={32} /> : (previewUrl ? <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-4" /> : <ImageIcon className="text-slate-200" size={48} />)}
                              </div>
                              <label className="absolute -bottom-2 -right-2 bg-slate-900 text-white p-3 rounded-2xl shadow-xl cursor-pointer hover:bg-indigo-600 transition-all active:scale-90">
                                  <Upload size={18} strokeWidth={3} />
                                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                              </label>
                          </div>
                          
                          <button type="button" onClick={() => setIsCatalogSelectorOpen(true)} className="bg-indigo-50 text-indigo-600 border-2 border-indigo-100 px-6 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-100 transition-all">
                              <LayoutGrid size={16} /> Ver Catálogo Global
                          </button>
                      </div>

                      <div className="space-y-6">
                          <div>
                               <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Nombre Comercial</label>
                              <input required value={name} onChange={e => setName(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner text-slate-800" placeholder="EJ: YAPE / PLIN" />
                          </div>
                          <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Código SUNAT (Catálogo 51)</label>
                              <select value={sunatCode} onChange={e => setSunatCode(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold bg-white outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner appearance-none text-slate-700">
                                  {SUNAT_PAYMENT_CODES.map(c => <option key={c.code} value={c.code}>{c.code} - {c.label}</option>)}
                              </select>
                          </div>
                      </div>

                      <button type="submit" disabled={isSubmitting || isUploading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-3xl shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 uppercase text-xs tracking-widest">
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={20} strokeWidth={3} />} {editingId ? 'ACTUALIZAR CONFIGURACIÓN' : 'GUARDAR MÉTODO'}
                      </button>
                  </form>
              </div>
          </div>
      )}

      {isCatalogSelectorOpen && (
          <div className="fixed inset-0 bg-slate-950/80 z-[120] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
              <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/20">
                  <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                      <h4 className="font-bold text-xl tracking-tight uppercase">Iconos Predeterminados</h4>
                      <button onClick={() => setIsCatalogSelectorOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-colors"><X size={24}/></button>
                  </div>
                  <div className="p-8 overflow-y-auto flex-1 bg-slate-50 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 custom-scrollbar">
                      {globalPaymentCatalog.map((img, idx) => (
                          <button key={img.id || idx} onClick={() => selectFromCatalog(img)} className="flex flex-col bg-white rounded-3xl border-2 border-slate-200 hover:border-indigo-500 hover:scale-105 transition-all shadow-sm overflow-hidden group">
                              <div className="aspect-square p-4">
                                <img src={img.url} className="w-full h-full object-contain" alt={img.name} />
                              </div>
                              <p className="bg-slate-900 p-2 text-[8px] font-bold text-center uppercase text-indigo-400 truncate w-full">{img.name}</p>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      <ConfirmationModal 
          isOpen={!!methodToSuspend}
          onClose={() => setMethodToSuspend(null)}
          onConfirm={handleConfirmSuspend}
          title={methodToSuspend?.isSuspended ? "Reanudar Método de Pago" : "Suspender Método de Pago"}
          isDangerous={false}
          confirmText={methodToSuspend?.isSuspended ? "SÍ, REANUDAR" : "SÍ, SUSPENDER"}
          message={
              <div className="space-y-3">
                  <p className="font-bold text-slate-800">
                      ¿Desea {methodToSuspend?.isSuspended ? 'REANUDAR' : 'SUSPENDER'} el método <strong>{methodToSuspend?.name}</strong>?
                  </p>
                  <p className="text-xs text-slate-500 uppercase font-medium leading-relaxed">
                      {methodToSuspend?.isSuspended 
                        ? 'Al reanudarlo, volverá a estar disponible de inmediato en el terminal.' 
                        : 'Al suspenderlo, no aparecerá en el terminal momentáneamente. Podrá reanudarlo después.'}
                  </p>
              </div>
          }
      />

      <ConfirmationModal 
          isOpen={!!methodToToggle}
          onClose={() => setMethodToToggle(null)}
          onConfirm={handleConfirmToggle}
          title={methodToToggle?.isActive ? "Anular Método de Pago" : "Reactivar Método de Pago"}
          isDangerous={methodToToggle?.isActive}
          confirmText={methodToToggle?.isActive ? "SÍ, ANULAR" : "SÍ, REACTIVAR"}
          message={
              <div className="space-y-3">
                  <p className="font-bold text-slate-800">
                      ¿Está seguro de que desea {methodToToggle?.isActive ? 'ANULAR' : 'REACTIVAR'} el método de pago <strong>{methodToToggle?.name}</strong>?
                  </p>
                  <p className="text-xs text-slate-500 uppercase font-medium leading-relaxed">
                      {methodToToggle?.isActive 
                        ? 'Al anularlo, dejará de aparecer inmediatamente en el terminal de ventas (POS) para nuevas órdenes.' 
                        : 'Al reactivarlo, volverá a estar disponible como opción de pago en el terminal de ventas.'}
                  </p>
              </div>
          }
      />
    </div>
  );
};

export default PaymentMethods;
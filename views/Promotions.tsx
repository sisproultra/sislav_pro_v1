import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Plus, Search, Edit, Trash2, AlertCircle, ImageIcon, Upload, X, Zap, Check, Eye, EyeOff, FlaskConical, Loader2 } from 'lucide-react';
import { Product, Category, Company, Supply, PromoBanner } from '../types';
import { dbUploadImage, dbGetSucursalBanners, dbSaveSucursalBanner, dbUpdateSucursalBanner, dbDeleteSucursalBanner } from '../services/dbService';
import ConfirmationModal from '../components/ConfirmationModal';
import InventoryModal from '../components/InventoryModal';

interface PromotionsProps {
  products: Product[];
  categories: Category[];
  supplies: Supply[];
  company: Company;
  onSavePromotion: (promo: Omit<Product, 'id'>) => Promise<void>;
  onUpdatePromotion: (id: string, promo: Partial<Product>) => Promise<void>;
  onDeletePromotion: (id: string) => Promise<void>;
  onSaveCompany: (c: Company) => Promise<void>;
  canCreateService?: boolean;
  canManageBanners?: boolean;
}

const Promotions: React.FC<PromotionsProps> = ({ 
    products, categories, supplies, company, 
    onSavePromotion, onUpdatePromotion, onDeletePromotion,
    canCreateService = true, canManageBanners = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Product | null>(null);
  const [promoToDelete, setPromoToDelete] = useState<string | null>(null);
  const [bannerToDeleteId, setBannerToDeleteId] = useState<string | null>(null);
  
  // Nuevo estado para banners cargados de tabla relacional
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [isLoadingBanners, setIsLoadingBanners] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currency = company.currencySymbol || 'S/';

  useEffect(() => {
    loadBanners();
  }, [company.id]);

  const loadBanners = async () => {
    setIsLoadingBanners(true);
    const data = await dbGetSucursalBanners();
    setBanners(data);
    setIsLoadingBanners(false);
  };

  const promos = products.filter(p => p.category === 'PROMO' && p.estado !== 'i');

  const filteredPromos = promos.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const cleanNameForPath = (name: string) => {
    return name.trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const holdingName = cleanNameForPath(company.holding_name || 'demo');
        // FIX: Cast company to any as slug exists on Sucursal but type is Company
        const branchSlug = cleanNameForPath((company as any).slug || 'demo_lima');
        const fileName = `banner_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        
        // Ruta absoluta según requerimiento
        const storagePath = `global/empresas/${holdingName}/${branchSlug}/imagen_campania/${fileName}`;
        
        const publicUrl = await dbUploadImage('laundry-assets', file, storagePath);
        
        // GUARDADO EN TABLA RELACIONAL (No JSON)
        await dbSaveSucursalBanner({
          name: 'PROMOCIÓN SIN TÍTULO',
          url: publicUrl
        });

        await loadBanners();
      } catch (err) {
        console.error("Error upload banner:", err);
        alert("Error al subir el banner promocional.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const toggleBannerStatus = async (banner: PromoBanner) => {
    try {
        await dbUpdateSucursalBanner(banner.id, { isActive: !banner.isActive });
        await loadBanners();
    } catch (e) {
        alert("Error al cambiar estado");
    }
  };

  const updateBannerTitle = async (id: string, name: string) => {
    try {
        await dbUpdateSucursalBanner(id, { name: name.toUpperCase() });
        setBanners(prev => prev.map(b => b.id === id ? { ...b, name: name.toUpperCase() } : b));
    } catch (e) {
        console.error(e);
    }
  };

  const removeBannerAction = async () => {
    if (bannerToDeleteId === null) return;
    try {
        await dbDeleteSucursalBanner(bannerToDeleteId);
        await loadBanners();
        setBannerToDeleteId(null);
    } catch (e) {
        alert("Error al eliminar banner");
    }
  };

  return (
    <div className="p-6 lg:p-8 h-full overflow-y-auto bg-slate-50 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-10 pb-20">
        
        {/* SECCIÓN 1: GESTIÓN DE SERVICIOS PROMO */}
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight flex items-center gap-3">
                        <Zap className="text-indigo-600" size={32} /> GESTIÓN DE PACKS "PROMO"
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Cree servicios especiales que aparecerán en el POS.</p>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar promoción..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 shadow-sm transition-all"
                        />
                    </div>
                    {canCreateService && (
                      <button 
                          onClick={() => { setEditingPromo(null); setIsModalOpen(true); }} 
                          className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 flex gap-2 items-center transition-all active:scale-95 uppercase tracking-widest shrink-0"
                      >
                          <Plus size={20} strokeWidth={4} /> NUEVA PROMO
                      </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200">
                    <tr>
                      <th className="px-8 py-5">Nombre de la Promoción</th>
                      <th className="px-8 py-5">Descripción / Detalles</th>
                      <th className="px-8 py-5 text-right">Precio Oferta</th>
                      <th className="px-8 py-5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPromos.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="px-8 py-12 text-center text-slate-400">
                                <p className="font-bold uppercase tracking-widest text-[10px]">No hay promociones configuradas</p>
                            </td>
                        </tr>
                    ) : (
                        filteredPromos.map(promo => (
                        <tr key={promo.id} className="hover:bg-indigo-50/20 transition-colors group">
                            <td className="px-8 py-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold shadow-sm shrink-0">
                                        %
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-800 uppercase tracking-tight">{promo.name}</span>
                                        {promo.recipe && promo.recipe.length > 0 && (
                                            <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600 shadow-sm border border-indigo-100" title="Este servicio consume insumos">
                                                <FlaskConical size={14} strokeWidth={2.5} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-8 py-5">
                                <p className="text-xs text-slate-500 font-medium italic line-clamp-1">{promo.description || 'Sin descripción detallada'}</p>
                            </td>
                            <td className="px-8 py-5 text-right">
                                <span className="font-bold text-indigo-600 text-lg tabular-nums">{currency} {(Number(promo.price) || 0).toFixed(2)}</span>
                            </td>
                            <td className="px-8 py-5">
                                <div className="flex justify-center gap-2">
                                    {canCreateService && (
                                      <>
                                        <button 
                                            onClick={() => { setEditingPromo(promo); setIsModalOpen(true); }} 
                                            className="p-2.5 bg-slate-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all border border-slate-100 shadow-sm" 
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button 
                                            onClick={() => setPromoToDelete(promo.id)} 
                                            className="p-2.5 bg-slate-50 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all border border-slate-100 shadow-sm" 
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                      </>
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
        </div>

        {/* SECCIÓN 2: BANNER PROMOCIONAL PARA TRACKING (RELACIONAL) */}
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight flex items-center gap-3">
                        <Sparkles className="text-amber-500" size={32} /> BANNER PROMOCIONAL TRACKING
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Imágenes almacenadas en tabla relacional `sucursal_banners`.</p>
                </div>
                {canManageBanners && (
                  <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-black shadow-xl flex gap-2 items-center transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50"
                  >
                      {isUploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} strokeWidth={3} />} 
                      {isUploading ? 'CARGANDO...' : 'CARGAR BANNER'}
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleBannerUpload} disabled={isUploading} />
                  </button>
                )}
            </div>

            {isLoadingBanners ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={48} className="animate-spin text-indigo-600" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Cargando banners...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {banners.map((banner) => (
                        <div key={banner.id} className={`bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm group hover:shadow-xl transition-all relative ${!banner.isActive && 'opacity-60'}`}>
                            <div className="p-3">
                                <div className={`relative aspect-video rounded-3xl overflow-hidden border-[4px] transition-all ${banner.isActive ? 'border-indigo-50 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-neon-glow' : 'border-slate-300 shadow-none'}`}>
                                    <img src={banner.url} className="w-full h-full object-cover" alt={banner.name} />
                                    {!banner.isActive && (
                                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center">
                                            <span className="bg-slate-800 text-white px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest">INACTIVO</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="px-6 py-4 space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre Promoción</label>
                                    <input 
                                    disabled={!canManageBanners}
                                    value={banner.name}
                                    onChange={e => setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, name: e.target.value.toUpperCase() } : b))}
                                    onBlur={e => updateBannerTitle(banner.id, e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-50 disabled:cursor-not-allowed"
                                    placeholder="Ej: LAVADO DE TERNOS 2X1"
                                    />
                                </div>
                                {canManageBanners && (
                                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                    <button 
                                        onClick={() => toggleBannerStatus(banner)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${banner.isActive ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 text-slate-50'}`}
                                    >
                                        {banner.isActive ? <><Eye size={14}/> ACTIVO</> : <><EyeOff size={14}/> INACTIVO</>}
                                    </button>
                                    <button 
                                        onClick={() => setBannerToDeleteId(banner.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                        title="Eliminar Banner"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {banners.length === 0 && (
                         <div className="col-span-full py-20 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
                            <ImageIcon size={64} className="text-slate-100 mb-4" />
                            <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">No hay banners en esta sucursal</p>
                         </div>
                    )}
                </div>
            )}
        </div>
      </div>

      <InventoryModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={async (data) => {
            const promoData = { ...data, category: 'PROMO' }; 
            if (editingPromo) await onUpdatePromotion(editingPromo.id, promoData);
            else await onSavePromotion(promoData);
            setIsModalOpen(false);
        } }
        supplies={supplies}
        categories={[{ id: 'promo-cat', name: 'PROMO', isActive: true, sucursal_id: company.id }]} 
        initialData={editingPromo ? { ...editingPromo, category: 'PROMO' } : null}
        company={company}
      />

      <ConfirmationModal 
          isOpen={!!promoToDelete}
          onClose={() => setPromoToDelete(null)}
          onConfirm={() => { if (promoToDelete) { onDeletePromotion(promoToDelete); setPromoToDelete(null); } }}
          title="Eliminar Promoción"
          message={<p className="font-bold text-slate-800">¿Desea borrar esta oferta? Dejará de aparecer en el sistema de ventas.</p>}
          confirmText="Sí, Eliminar"
          isDangerous={true}
      />

      <ConfirmationModal 
          isOpen={bannerToDeleteId !== null}
          onClose={() => setBannerToDeleteId(null)}
          onConfirm={removeBannerAction}
          title="Eliminar Banner Publicitario"
          message={<div className="space-y-3">
              <p className="font-bold text-slate-800">¿Estás seguro de eliminar este banner?</p>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">Esta acción quitará la imagen de la pantalla de seguimiento de todos tus clientes y eliminará el registro de la base de datos.</p>
          </div>}
          confirmText="Sí, Eliminar Imagen"
          isDangerous={true}
      />
      
      <style>{`
        @keyframes neon-glow {
          0%, 100% { border-color: #6366f1; box-shadow: 0 0 5px rgba(99,102,241,0.5), 0 0 10px rgba(99,102,241,0.3); }
          50% { border-color: #ec4899; box-shadow: 0 0 20px rgba(236,72,153,0.6), 0 0 30px rgba(236,72,153,0.4); }
        }
        .animate-neon-glow {
          animation: neon-glow 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Promotions;
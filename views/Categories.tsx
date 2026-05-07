
import React, { useState, useMemo } from 'react';
import { Category, GlobalCategoryImage } from '../types';
import { dbUploadImage, dbRegisterCatalogImage } from '../services/dbService';
import { Plus, Tag, X, Save, Upload, Image as ImageIcon, Edit, LayoutGrid, Trash2, Loader2, Search } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';

interface CategoriesProps {
  categories: Category[];
  globalCatalog?: GlobalCategoryImage[];
  primaryColor?: string;
  onSave: (cat: Omit<Category, 'id'>) => Promise<void>;
  onUpdate: (id: string, cat: Partial<Category>) => Promise<void>;
  canManage?: boolean;
}

const Categories: React.FC<CategoriesProps> = ({ categories, globalCatalog = [], primaryColor = '#4f46e5', onSave, onUpdate, canManage = true }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatalogSelectorOpen, setIsCatalogSelectorOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedImageId, setSelectedImageId] = useState(''); 
  const [previewUrl, setPreviewUrl] = useState(''); 
  const [isActive, setIsActive] = useState(true);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete || isSubmittingDelete) return;
    
    setIsSubmittingDelete(true);
    try {
        await onUpdate(categoryToDelete.id, { isActive: false });
        setCategoryToDelete(null);
    } catch (error) {
        console.error("Error al eliminar categoría:", error);
    } finally {
        setIsSubmittingDelete(false);
    }
  };

  const filteredCatalog = useMemo(() => {
    if (!globalCatalog) return [];
    return globalCatalog.filter(img => 
      (img.name || '').toLowerCase().includes((catalogSearch || '').toLowerCase())
    );
  }, [globalCatalog, catalogSearch]);

  const openCreateModal = () => {
      setEditingId(null);
      setName('');
      setSelectedImageId('');
      setPreviewUrl('');
      setIsActive(true);
      setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
      setEditingId(cat.id);
      setName(cat.name);
      setSelectedImageId(cat.imagen_id || '');
      setPreviewUrl(cat.imageUrl || '');
      setIsActive(cat.isActive);
      setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          // Límite de 2MB
          const MAX_SIZE = 2 * 1024 * 1024;
          if (file.size > MAX_SIZE) {
              alert("La imagen es demasiado pesada. El límite es de 2MB.");
              return;
          }

          setIsUploading(true);
          try {
              const fileName = `cat_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
              const publicUrl = await dbUploadImage('laundry-assets', file, fileName);
              const catalogId = await dbRegisterCatalogImage(name || file.name, publicUrl, 'CATEGORIA');
              
              setSelectedImageId(catalogId);
              setPreviewUrl(publicUrl);
          } catch (err: any) {
              console.error("Error al procesar la imagen:", err);
              alert("Error al procesar la imagen: " + (err.message || "Error de permisos o conexión"));
          } finally {
              setIsUploading(false);
          }
      }
  };

  const selectFromCatalog = (catalogItem: GlobalCategoryImage) => {
      setSelectedImageId(catalogItem.id);
      setPreviewUrl(catalogItem.url);
      setIsCatalogSelectorOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || isSubmitting || isUploading) return;

    setIsSubmitting(true);
    try {
        const catData: any = {
            name: name.toUpperCase(),
            imagen_id: selectedImageId || null,
            isActive: isActive
        };

        if (editingId) {
            await onUpdate(editingId, catData);
        } else {
            await onSave(catData);
        }
        setIsModalOpen(false);
    } catch (error: any) {
        console.error("Error al guardar:", error);
        alert("Hubo un error al intentar guardar: " + (error.message || "Error desconocido"));
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Tag style={{ color: primaryColor }} /> Categorías de Productos
            </h2>
            <p className="text-sm text-gray-500">Organiza tus servicios con imágenes vinculadas al catálogo.</p>
          </div>
          {canManage && (
            <button onClick={openCreateModal} className="text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all" style={{ backgroundColor: primaryColor, boxShadow: `0 10px 15px -3px ${primaryColor}40` }}>
              <Plus size={18} /> Nueva Categoría
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
             {categories.map(cat => (
                 <div key={cat.id} className={`bg-white rounded-2xl border transition-all flex flex-col relative group overflow-hidden ${cat.isActive ? 'border-gray-200 shadow-sm hover:shadow-md' : 'border-gray-100 opacity-60'}`}>
                     <div className="h-32 w-full bg-gray-50 border-b border-gray-100 flex items-center justify-center overflow-hidden">
                         {cat.imageUrl ? <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-contain p-2" /> : <Tag size={40} className="text-gray-300" />}
                     </div>
                     <div className="p-4 flex-1 flex flex-col">
                         <h3 className="font-bold text-gray-800 text-sm uppercase leading-tight truncate">{cat.name}</h3>
                     </div>
                     <div className="p-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                         <div className="flex items-center gap-2">
                             <span className={`text-[10px] font-bold ${cat.isActive ? 'text-green-600' : 'text-gray-400'}`}>{cat.isActive ? 'ACTIVO' : 'OFF'}</span>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={() => openEditModal(cat)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={16} /></button>
                             <button onClick={() => setCategoryToDelete(cat)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                         </div>
                     </div>
                 </div>
             ))}
        </div>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-900 text-lg">{editingId ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="bg-white p-1 rounded-full hover:bg-gray-200 text-gray-500"><X size={20}/></button>
                  </div>
                  <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1 overflow-y-auto">
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative group">
                          <div className="w-28 h-28 bg-gray-100 border-2 border-dashed border-gray-300 rounded-[2rem] flex items-center justify-center overflow-hidden">
                            {isUploading ? <Loader2 className="animate-spin" style={{ color: primaryColor }} /> : (previewUrl ? <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-2" /> : <ImageIcon className="text-gray-400" size={28} />)}
                          </div>
                        </div>
                        <div className="flex gap-2 w-full">
                          <button type="button" onClick={() => setIsCatalogSelectorOpen(true)} className="flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:opacity-80" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor, border: `1px solid ${primaryColor}30` }}>
                            <LayoutGrid size={14} /> Catálogo Global
                          </button>
                          <label className="flex-1 cursor-pointer bg-slate-100 border border-slate-200 py-3 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-2 text-slate-600 hover:bg-slate-200">
                            <Upload size={14} /> {isUploading ? 'Subiendo...' : 'Subir Imagen'}
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Nombre</label>
                        <input required value={name} onChange={e => setName(e.target.value.toUpperCase())} className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none transition-all uppercase text-slate-800 focus:border-[var(--brand-primary)]" placeholder="EJ: EDREDONES" />
                      </div>
                      <div className="flex items-center gap-2 cursor-pointer mt-2">
                         <input type="checkbox" id="catActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 rounded" style={{ color: primaryColor }} />
                         <label htmlFor="catActive" className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer">Activo</label>
                      </div>
                      <button type="submit" disabled={isSubmitting || isUploading} className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50">
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18} />} {editingId ? 'Actualizar Categoría' : 'Guardar Categoría'}
                      </button>
                  </form>
              </div>
          </div>
      )}

      {isCatalogSelectorOpen && (
          <div className="fixed inset-0 bg-slate-950/80 z-[120] flex items-center justify-center p-2 sm:p-6 backdrop-blur-md animate-in fade-in">
              <div className="bg-white rounded-2xl sm:rounded-[2rem] w-full h-full max-w-[98vw] sm:max-w-[95vw] max-h-[98vh] sm:max-h-[92vh] shadow-2xl overflow-hidden flex flex-col border border-white/20">
                  <div className="p-3 sm:p-5 text-white flex justify-between items-center shrink-0 shadow-lg" style={{ backgroundColor: primaryColor }}>
                      <div className="flex items-center gap-3 sm:gap-4">
                          <div className="bg-white/10 p-2 sm:p-2.5 rounded-xl">
                             <LayoutGrid size={20} className="sm:w-6 sm:h-6" />
                          </div>
                          <div>
                            <h4 className="font-black text-base sm:text-xl tracking-tight uppercase">Catálogo Global</h4>
                            <p className="text-[8px] sm:text-[10px] font-bold opacity-80 uppercase tracking-widest leading-none">Biblioteca Maestra de Recursos</p>
                          </div>
                      </div>
                      <button onClick={() => { setIsCatalogSelectorOpen(false); setCatalogSearch(''); }} className="hover:bg-white/10 p-2 rounded-xl transition-colors"><X size={24} className="sm:w-8 sm:h-8"/></button>
                  </div>
                  
                  <div className="p-2 sm:p-4 bg-white border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
                      <div className="relative flex-1 group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[var(--brand-primary)] transition-colors" size={18} />
                          <input 
                            type="text" 
                            placeholder="BUSCAR IMAGEN..." 
                            value={catalogSearch}
                            onChange={(e) => setCatalogSearch(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 sm:py-4 bg-gray-50 border-2 border-transparent rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest outline-none focus:bg-white transition-all focus:border-[var(--brand-primary)]" 
                          />
                      </div>
                  </div>

                  <div className="p-2 sm:p-6 overflow-y-auto flex-1 bg-gray-50/50 grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-4 custom-scrollbar content-start">
                      {filteredCatalog.map((img, idx) => (
                          <button 
                            key={img.id || idx} 
                            onClick={() => selectFromCatalog(img)} 
                            className="flex flex-col bg-white rounded-xl sm:rounded-3xl border border-slate-100 hover:scale-[1.03] transition-all shadow-sm hover:shadow-lg group relative overflow-hidden hover:border-[var(--brand-primary)]"
                          >
                              <div className="aspect-square p-1 sm:p-3 flex items-center justify-center bg-white overflow-hidden">
                                <img src={img.url} className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-500" alt={img.name} />
                              </div>
                              <div className="p-1 sm:p-2 bg-white border-t border-slate-50">
                                <p className="text-[7px] sm:text-[9px] font-black text-center uppercase text-slate-600 truncate w-full group-hover:text-[var(--brand-primary)] transition-colors tracking-tighter sm:tracking-normal">{img.name}</p>
                              </div>
                              <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--brand-primary)]/5 transition-all pointer-events-none" />
                          </button>
                      ))}
                      
                      {filteredCatalog.length === 0 && (
                          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 gap-4 opacity-70">
                              <ImageIcon size={48} strokeWidth={1} />
                              <p className="font-bold text-[10px] uppercase tracking-widest">No se encontraron resultados para "{catalogSearch}"</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      <ConfirmationModal 
          isOpen={!!categoryToDelete} 
          onClose={() => setCategoryToDelete(null)} 
          onConfirm={handleDeleteConfirm} 
          title="¿Eliminar Categoría?" 
          message={`¿Desea ocultar la categoría "${categoryToDelete?.name}"?`} 
          confirmText="Sí, Eliminar" 
          isDangerous={true} 
          isLoading={isSubmittingDelete}
      />
    </div>
  );
};

export default Categories;

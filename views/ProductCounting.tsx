
import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, Search, Barcode, Save, Trash2, 
  Plus, Minus, Camera, Upload, X, CheckCircle2,
  LayoutGrid, List, History, User, MapPin, Calendar
} from 'lucide-react';
import { Product, InventoryCount, AuthSession } from '../types';
import { dbSaveInventoryCount, dbGetInventoryCounts, dbUploadImage } from '../services/dbService';
import { formatDateSafe } from '../utils/calculations';

interface ProductCountingProps {
  products: Product[];
  authSession: AuthSession | null;
}

const ProductCounting: React.FC<ProductCountingProps> = ({ products, authSession }) => {
  const [view, setView] = useState<'FORM' | 'HISTORY'>('FORM');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Form fields
  const [pallets, setPallets] = useState(0);
  const [cajas, setCajas] = useState(0);
  const [unidades, setUnidades] = useState(0);
  const [zona, setZona] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  
  const [history, setHistory] = useState<InventoryCount[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (view === 'HISTORY') {
      loadHistory();
    }
  }, [view]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await dbGetInventoryCounts();
      setHistory(data);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.estado === 'a' && 
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     p.id.toLowerCase().includes(searchTerm.toLowerCase()))
  ).slice(0, 5);

  const totalQuantity = (pallets * 100) + (cajas * 10) + unidades; // Example calculation, user might want to define multipliers

  const handleSave = async () => {
    if (!selectedProduct) return;
    if (totalQuantity <= 0) {
      alert("La cantidad total debe ser mayor a cero");
      return;
    }

    setIsSubmitting(true);
    try {
      const countData: Omit<InventoryCount, 'id' | 'fecha_registro'> = {
        producto_id: selectedProduct.id,
        codigo: selectedProduct.id.substring(0, 8), // Using ID as code if not available
        nombre: selectedProduct.name,
        pallets,
        cajas,
        unidades,
        cantidad: totalQuantity,
        fecha_vencimiento: fechaVencimiento,
        usuario_registro: authSession?.user.name || 'Usuario',
        fotos,
        zona,
        sucursal_id: '', // Handled by dbService
      };

      await dbSaveInventoryCount(countData);
      alert("Conteo registrado con éxito");
      resetForm();
    } catch (error) {
      console.error("Error saving count:", error);
      alert("Error al guardar el conteo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setSearchTerm('');
    setPallets(0);
    setCajas(0);
    setUnidades(0);
    setZona('');
    setFechaVencimiento('');
    setFotos([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newFotos = [...fotos];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `conteo_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const url = await dbUploadImage('laundry-assets', file, fileName);
        if (url) newFotos.push(url);
      }
      setFotos(newFotos);
    } catch (error) {
      console.error("Error uploading images:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 h-full overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 uppercase tracking-tight">
              <Package className="text-blue-600" /> Conteo de Inventario
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Registro de stock físico</p>
          </div>
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
            <button 
              onClick={() => setView('FORM')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${view === 'FORM' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <Plus size={16} /> NUEVO
            </button>
            <button 
              onClick={() => setView('HISTORY')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${view === 'HISTORY' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <History size={16} /> HISTORIAL
            </button>
          </div>
        </div>

        {view === 'FORM' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Product Selection */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Seleccionar Producto</label>
              {!selectedProduct ? (
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="BUSCAR POR NOMBRE O CÓDIGO..."
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-3xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
                  />
                  {searchTerm && filteredProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                      {filteredProducts.map(p => (
                        <button 
                          key={p.id}
                          onClick={() => { setSelectedProduct(p); setSearchTerm(''); }}
                          className="w-full p-4 text-left hover:bg-blue-50 flex items-center justify-between group transition-colors"
                        >
                          <div>
                            <p className="font-bold text-slate-800 uppercase text-sm">{p.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Stock actual: {p.stock}</p>
                          </div>
                          <Plus size={18} className="text-slate-300 group-hover:text-blue-600" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-3xl border-2 border-blue-100">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200">
                      <Package size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-blue-900 uppercase text-lg leading-none">{selectedProduct.name}</p>
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1">Producto Seleccionado</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedProduct(null)} className="p-2 text-blue-400 hover:text-blue-600 transition-colors">
                    <X size={24} />
                  </button>
                </div>
              )}
            </div>

            {selectedProduct && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95 duration-300">
                  
                  {/* Quantities */}
                  <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200 space-y-8">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <LayoutGrid size={16} className="text-blue-600" /> Cantidades Físicas
                    </h3>
                    
                    <div className="space-y-6">
                      {/* Pallets */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 uppercase text-sm">Pallets</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Unidad mayor</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => setPallets(Math.max(0, pallets - 1))} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"><Minus size={20} /></button>
                          <input type="number" value={pallets} onChange={e => setPallets(parseInt(e.target.value) || 0)} className="w-16 text-center font-bold text-xl bg-transparent outline-none" />
                          <button onClick={() => setPallets(pallets + 1)} className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"><Plus size={20} /></button>
                        </div>
                      </div>
  
                      {/* Cajas */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 uppercase text-sm">Cajas</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Unidad intermedia</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => setCajas(Math.max(0, cajas - 1))} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"><Minus size={20} /></button>
                          <input type="number" value={cajas} onChange={e => setCajas(parseInt(e.target.value) || 0)} className="w-16 text-center font-bold text-xl bg-transparent outline-none" />
                          <button onClick={() => setCajas(cajas + 1)} className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"><Plus size={20} /></button>
                        </div>
                      </div>
  
                      {/* Unidades */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800 uppercase text-sm">Unidades</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Unidad mínima</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => setUnidades(Math.max(0, unidades - 1))} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"><Minus size={20} /></button>
                          <input type="number" value={unidades} onChange={e => setUnidades(parseInt(e.target.value) || 0)} className="w-16 text-center font-bold text-xl bg-transparent outline-none" />
                          <button onClick={() => setUnidades(unidades + 1)} className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"><Plus size={20} /></button>
                        </div>
                      </div>
                    </div>
  
                    <div className="pt-6 border-t border-slate-100">
                      <div className="bg-slate-900 p-6 rounded-[2rem] text-center">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Calculado</p>
                        <h4 className="text-4xl font-bold text-white">{totalQuantity}</h4>
                        <p className="text-[10px] font-bold text-blue-400 uppercase mt-1">Unidades totales</p>
                      </div>
                    </div>
                  </div>

                {/* Details & Photos */}
                <div className="space-y-6">
                  <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200 space-y-6">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <List size={16} className="text-blue-600" /> Detalles Adicionales
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Zona / Ubicación</label>
                        <div className="relative mt-1">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="text" 
                            value={zona}
                            onChange={e => setZona(e.target.value)}
                            placeholder="EJ: PASILLO A, ESTANTE 3..."
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Fecha de Vencimiento</label>
                        <div className="relative mt-1">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input 
                            type="date" 
                            value={fechaVencimiento}
                            onChange={e => setFechaVencimiento(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200 space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <Camera size={16} className="text-blue-600" /> Evidencia Fotográfica
                      </h3>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline disabled:opacity-50"
                      >
                        {isUploading ? 'SUBIENDO...' : 'SUBIR FOTOS'}
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept="image/*" className="hidden" />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {fotos.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 group">
                          <img src={url} alt={`Evidencia ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            onClick={() => setFotos(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      {fotos.length < 6 && (
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-400 transition-all"
                        >
                          <Plus size={24} />
                          <span className="text-[8px] font-bold uppercase mt-1">Agregar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={handleSave}
                    disabled={isSubmitting}
                    className="w-full bg-slate-900 text-white py-5 rounded-[2.5rem] font-bold text-sm uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? 'GUARDANDO...' : <><Save size={20} /> REGISTRAR CONTEO</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <History size={16} className="text-blue-600" /> Últimos Registros
              </h3>
              <button onClick={loadHistory} className="text-blue-600 hover:text-blue-800 transition-colors">
                <RotateCcw size={16} className={isLoadingHistory ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-6 py-4 text-center">P / C / U</th>
                    <th className="px-6 py-4 text-center">Total</th>
                    <th className="px-6 py-4">Zona</th>
                    <th className="px-6 py-4">Usuario</th>
                    <th className="px-6 py-4 text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingHistory ? (
                    <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando historial...</td></tr>
                  ) : history.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest">No hay registros aún</td></tr>
                  ) : (
                    history.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800 uppercase text-xs">{item.nombre}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">ID: {item.producto_id.substring(0, 8)}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{item.pallets}P</span>
                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{item.cajas}C</span>
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{item.unidades}U</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-bold text-slate-900 text-sm">{item.cantidad}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{item.zona || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                              {item.usuario_registro.charAt(0)}
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 uppercase">{item.usuario_registro}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{formatDateSafe(item.fecha_registro || '')}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const RotateCcw = ({ size, className }: { size: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
);

export default ProductCounting;

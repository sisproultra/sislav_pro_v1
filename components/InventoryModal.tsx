
import React, { useState, useEffect } from 'react';
import { Product, IgvType, UnitCode, UmSaas, Supply, RecipeItem, Category, Company } from '../types';
import { X, Wand2, Loader2, FlaskConical, Tag, Plus, Trash2, Box, Clock, Save, Crown, Ruler, Beaker, Calculator } from 'lucide-react';
import { generateProductDescription } from '../services/geminiService';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id'>) => void;
  supplies: Supply[];
  categories?: Category[];
  initialData?: Product | null;
  company: Company;
}

const InventoryModal: React.FC<InventoryModalProps> = ({ 
  isOpen, onClose, onSave, supplies, categories = [], initialData, company 
}) => {
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'RECIPE'>('DETAILS');
  const currency = company?.moneda_simbolo || 'S/';

  const activeCategories = (categories || []).filter(c => c.isActive);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitCode, setUnitCode] = useState<UnitCode>(UnitCode.ZZ);
  const [umSaas, setUmSaas] = useState<UmSaas>(UmSaas.UNIDAD);
  const [price, setPrice] = useState('');
  const [pointsPrice, setPointsPrice] = useState('');
  const [description, setDescription] = useState('');
  const [showInCatalog, setShowInCatalog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [requiresAreaCalc, setRequiresAreaCalc] = useState(false);
  const [pesoEstimado, setPesoEstimado] = useState('0.400');
  const [isSunatLocked, setIsSunatLocked] = useState(true);
  
  // Recipe State
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);
  const [selectedSupplyId, setSelectedSupplyId] = useState('');
  const [useQty, setUseQty] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
      if (isOpen) {
          if (initialData) {
              setName(initialData.name || '');
              // Intentar buscar por ID o por nombre para asegurar que se seleccione la categoría correcta
              const cat = initialData.categoria_id 
                ? (categories || []).find(c => c.id === initialData.categoria_id) 
                : (categories || []).find(c => c.name === initialData.category);
              setCategoryId(cat?.id || '');
              
              setUnitCode(initialData.unitCode || UnitCode.ZZ);
              setUmSaas(initialData.um_saas || UmSaas.UNIDAD);
              setPrice((initialData.price || 0).toString());
              setPointsPrice(initialData.pointsPrice?.toString() || '');
              setDescription(initialData.description || '');
              setShowInCatalog(initialData.showInCatalog ?? false);
              setImageUrl(initialData.imageUrl || '');
              setRequiresAreaCalc(initialData.requiresAreaCalc ?? false);
              setPesoEstimado((initialData.peso_estimado ?? 0.400).toString());
              setRecipe(initialData.recipe || []);
          } else {
              resetFormState();
          }
      }
  }, [isOpen, initialData, categories]);

  const resetFormState = () => {
    setName('');
    setCategoryId(''); 
    setUnitCode(UnitCode.ZZ);
    setUmSaas(UmSaas.UNIDAD);
    setPrice('0');
    setPointsPrice('');
    setDescription('');
    setShowInCatalog(false);
    setImageUrl('');
    setRequiresAreaCalc(false);
    setPesoEstimado('0.400');
    setRecipe([]);
    setActiveTab('DETAILS');
  };

  const handleAddSupply = () => {
      if (!selectedSupplyId || !useQty) return;
      const supply = supplies.find(s => s.id === selectedSupplyId);
      if (!supply) return;

      const qty = parseFloat(useQty);
      const newItem: RecipeItem = {
          supplyId: supply.id,
          name: supply.name,
          quantity: qty,
          unit: supply.unit,
          cost: (supply.lastCost || 0) * qty
      };

      setRecipe([...recipe, newItem]);
      setSelectedSupplyId('');
      setUseQty('');
  };

  const removeSupply = (id: string) => {
      setRecipe(recipe.filter(r => r.supplyId !== id));
  };

  const calculateTotalCost = () => {
      return recipe.reduce((sum, item) => sum + item.cost, 0);
  };

  if (!isOpen) return null;

  const handleGenerateDescription = async () => {
    const catName = categories.find(c => c.id === categoryId)?.name || 'GENERAL';
    if (!name || !categoryId) { alert("Ingrese nombre y categoría."); return; }
    setIsGenerating(true);
    const desc = await generateProductDescription(name, catName);
    setDescription(desc);
    setIsGenerating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
        alert("El nombre del servicio es obligatorio.");
        return;
    }
    if (!categoryId) {
        alert("Debe seleccionar una categoría.");
        return;
    }
    if (price === '') {
        alert("El precio de venta es obligatorio (puede ser 0).");
        return;
    }

    onSave({ 
      sucursal_id: company.id,
      name: name.toUpperCase().trim(), 
      category: categories.find(c => c.id === categoryId)?.name || "GENERAL", 
      categoria_id: categoryId || undefined, 
      price: parseFloat(price) || 0, 
      pointsPrice: pointsPrice === '' ? undefined : parseInt(pointsPrice),
      stock: 0, 
      description, 
      igvType: IgvType.GRAVADO, 
      unitCode: unitCode, 
      um_saas: umSaas,
      requiresAreaCalc,
      peso_estimado: parseFloat(pesoEstimado) || 0,
      cost: calculateTotalCost(), 
      recipe: recipe, 
      showInCatalog,
      imageUrl,
      trackStock: false, 
      processingTime: '24h',
      estado: 'a',
      activo: true
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-2 md:p-4 backdrop-blur-sm overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 border border-white/20 my-auto">
        <div className="px-8 py-6 flex justify-between items-center shrink-0" style={{ backgroundColor: company.primaryColor || '#0054A6' }}>
          <div>
            <h2 className="text-white font-bold text-xl uppercase tracking-tight">{initialData ? 'Editar Servicio' : 'Nuevo Servicio'}</h2>
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Configuración de catálogo y costos</p>
          </div>
          <button onClick={onClose} type="button" className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"><X size={24} /></button>
        </div>

        <div className="flex bg-slate-50 border-b border-slate-200 p-2 gap-2">
            <button 
                type="button"
                onClick={() => setActiveTab('DETAILS')}
                className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'DETAILS' ? 'bg-white shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                style={activeTab === 'DETAILS' ? { color: company.primaryColor || '#0054A6' } : {}}
            >
                General
            </button>
            <button 
                type="button"
                className="flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 text-slate-300 cursor-not-allowed opacity-50"
                title="Próximamente"
            >
                <Beaker size={14} /> Receta de Insumos (Próximamente)
            </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {activeTab === 'DETAILS' ? (
                <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Nombre del Servicio</label>
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 focus:bg-white focus:border-sunat-primary outline-none font-bold text-base uppercase text-slate-800 transition-all shadow-inner"/>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1 font-mono">Nombre del Servicio</label>
                          <input type="text" required value={name} onChange={(e) => setName(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:bg-white outline-none font-black text-lg uppercase text-slate-800 transition-all shadow-inner" style={{ borderColor: isSunatLocked ? '#f1f5f9' : company.primaryColor }}/>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1 font-mono">Categoría</label>
                          <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 font-black text-sm text-slate-800 appearance-none outline-none focus:bg-white">
                            <option value="">Seleccione...</option>
                            {activeCategories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                          </select>
                        </div>
                    </div>

                    <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner space-y-4">
                        <div>
                          <div className="flex justify-between items-center mb-1 ml-1">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 font-mono"><Box size={12}/> Unidad de Medida Interna (SaaS)</label>
                          </div>
                          <select required value={umSaas} onChange={(e) => setUmSaas(e.target.value as UmSaas)} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-4 font-black text-sm text-slate-800 appearance-none outline-none focus:bg-white">
                            <option value={UmSaas.UNIDAD}>UNIDAD</option>
                            <option value={UmSaas.PIEZA}>PIEZA</option>
                            <option value={UmSaas.KILO}>KILO (Permite decimales)</option>
                            <option value={UmSaas.METROS}>METROS (Permite decimales)</option>
                            <option value={UmSaas.LITRO}>LITRO (Permite decimales)</option>
                          </select>
                          <p className="text-[8px] text-slate-400 font-bold uppercase mt-2 ml-1 italic opacity-60">Define si el producto permite cantidades decimales en el carrito.</p>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1 font-mono"><Clock size={12}/> Peso Estimado por Unidad ({umSaas === UmSaas.KILO ? 'KGM' : 'KG'})</label>
                          <input 
                            type="number" 
                            step="0.001" 
                            required 
                            value={pesoEstimado} 
                            onChange={(e) => setPesoEstimado(e.target.value)} 
                            className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-4 font-black text-sm text-slate-800 outline-none focus:bg-white"
                          />
                          <p className="text-[8px] text-slate-400 font-bold uppercase mt-2 ml-1 italic opacity-60">
                            {umSaas === UmSaas.KILO ? 'Para productos al peso, este valor suele ser 1.000 para que se sume el peso real marcado en la balanza.' : 'Para productos por unidad, el promedio estándar es 0.400 KG (400g).'}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 bg-white/50 p-4 rounded-2xl border border-slate-200/50">
                            <div 
                                onClick={() => setRequiresAreaCalc(!requiresAreaCalc)}
                                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${requiresAreaCalc ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${requiresAreaCalc ? 'translate-x-6' : 'translate-x-0'}`} />
                            </div>
                            <div>
                                <span className="block text-[10px] font-black text-slate-700 uppercase tracking-tighter leading-none mb-1">Cálculo por Area (Ancho x Largo)</span>
                                <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-tight leading-none italic">Ideal para Alfombras, Cortinas, etc.</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 font-mono">Precio Venta ({currency})</label>
                                <input type="number" required step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 font-black text-3xl outline-none transition-all" style={{ color: company.primaryColor || '#0054A6' }} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1 font-mono">
                                    <Crown size={12} /> Canje Puntos
                                </label>
                                <input 
                                    type="number" 
                                    step="1" 
                                    value={pointsPrice} 
                                    onChange={(e) => setPointsPrice(e.target.value)} 
                                    className="w-full border-2 border-amber-100 bg-white rounded-2xl px-5 py-4 font-black text-3xl text-amber-600 outline-none" 
                                    placeholder="Ej: 50"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 font-mono">Descripción del Servicio</label>
                        <button type="button" onClick={handleGenerateDescription} disabled={isGenerating} className="text-purple-600 hover:bg-purple-50 p-2 rounded-xl transition-all active:scale-95" title="Mejorar con IA">
                          {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                        </button>
                      </div>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold text-slate-700 resize-none outline-none focus:bg-white shadow-inner" placeholder="Pantalón de gabardina, lavado en seco..."/>
                    </div>

                    {/* Sección Avanzada Sunat Oculta por defecto */}
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                        <div className="flex items-center justify-between px-2">
                           <div className="flex items-center gap-2">
                              <Ruler size={14} className="text-slate-400" />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código Unidad SUNAT</span>
                           </div>
                           <div 
                                onClick={() => setIsSunatLocked(!isSunatLocked)}
                                className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-all flex items-center ${isSunatLocked ? 'bg-slate-200' : 'bg-blue-500'}`}
                            >
                                <div className={`w-3 h-3 bg-white rounded-full transition-all ${isSunatLocked ? 'translate-x-0' : 'translate-x-5'}`} />
                           </div>
                        </div>
                        
                        {!isSunatLocked && (
                          <div className="animate-in slide-in-from-top-2 duration-200">
                             <select value={unitCode} onChange={(e) => setUnitCode(e.target.value as UnitCode)} className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl px-4 py-4 font-black text-xs text-slate-600 appearance-none outline-none focus:bg-white">
                                <option value={UnitCode.ZZ}>SERVICIO (ZZ) - RECOMENDADO</option>
                                <option value={UnitCode.NIU}>UNIDAD (NIU)</option>
                                <option value={UnitCode.KGM}>KILOGRAMO (KG)</option>
                                <option value={UnitCode.MTK}>METRO CUADRADO (M2)</option>
                                <option value={UnitCode.LTR}>LITRO (LT)</option>
                             </select>
                             <p className="text-[8px] text-amber-600 font-bold uppercase mt-2 px-2 text-center">⚠️ Solo modifique este campo si conoce las implicaciones tributarias en sus facturas electrónicas.</p>
                          </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 shadow-inner group transition-all hover:bg-indigo-50">
                        <input 
                            id="showInCatalog"
                            type="checkbox" 
                            checked={showInCatalog}
                            onChange={(e) => setShowInCatalog(e.target.checked)}
                            className="w-6 h-6 rounded-lg border-2 border-indigo-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition-all"
                        />
                        <label htmlFor="showInCatalog" className="cursor-pointer select-none">
                            <span className="block text-[10px] font-bold text-slate-700 uppercase tracking-widest leading-none mb-1">Mostrar en Tienda Virtual</span>
                            <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-tight leading-none italic">
                                {showInCatalog ? '✅ Este servicio será visible para tus clientes.' : '❌ Este servicio no aparecerá en el catálogo web.'}
                            </span>
                        </label>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">URL de Imagen del Servicio</label>
                      <input 
                        type="url" 
                        value={imageUrl} 
                        onChange={(e) => setImageUrl(e.target.value)} 
                        placeholder="https://ejemplo.com/imagen.jpg"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 focus:bg-white focus:border-sunat-primary outline-none font-bold text-xs text-slate-800 transition-all shadow-inner"
                      />
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 ml-1 italic">Proporcione un enlace directo a la imagen cuadrada del servicio.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6 animate-in slide-in-from-right-4">
                    <div className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-xl flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase opacity-60">Costo Estimado de Receta</p>
                            <h4 className="text-4xl font-bold tabular-nums">{currency} {calculateTotalCost().toFixed(2)}</h4>
                        </div>
                        <Beaker size={48} className="opacity-20" />
                    </div>

                    <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                           <Plus size={12}/> Agregar Insumo a la Receta
                        </h4>
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1">
                                <select 
                                    value={selectedSupplyId} 
                                    onChange={e => setSelectedSupplyId(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:bg-white"
                                >
                                    <option value="">Seleccionar Insumo...</option>
                                    {supplies.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-full md:w-32">
                                <input 
                                    type="number" 
                                    value={useQty} 
                                    onChange={e => setUseQty(e.target.value)} 
                                    placeholder="Cant."
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:bg-white"
                                />
                            </div>
                            <button 
                                type="button"
                                onClick={handleAddSupply}
                                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-[10px] uppercase shadow-lg active:scale-95 transition-all"
                            >
                                AÑADIR
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Listado de Consumo</p>
                        <div className="space-y-2">
                            {recipe.length === 0 ? (
                                <div className="py-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                                    <Calculator size={32} className="mx-auto text-slate-200 mb-2" />
                                    <p className="text-[10px] font-bold text-slate-300 uppercase">No hay insumos en la receta</p>
                                </div>
                            ) : (
                                recipe.map((item, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-indigo-600 font-bold text-xs border border-slate-100">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-[11px] text-slate-800 uppercase leading-none mb-1">{item.name}</h5>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">{item.quantity} {item.unit} • Costo: {currency} {item.cost.toFixed(2)}</p>
                                            </div>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => removeSupply(item.supplyId)}
                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="p-8 bg-white border-t border-slate-100 flex justify-end gap-4 shrink-0 shadow-2xl z-20">
            <button type="button" onClick={onClose} className="px-10 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
            <button 
                type="submit"
                className="text-white px-16 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all flex items-center gap-4 active:scale-95 hover:brightness-110"
                style={{ backgroundColor: company.primaryColor || '#0054A6' }}
            >
                <Save size={20} strokeWidth={3} /> Guardar Servicio
            </button>
        </div>
      </form>
    </div>
  );
};

export default InventoryModal;


import React, { useState } from 'react';
import { Plus, Edit, Trash2, Search, Package, AlertCircle, FlaskConical, ShoppingBag } from 'lucide-react';
import { Product, Category, Company } from '../types';
import ConfirmationModal from '../components/ConfirmationModal';

interface InventoryProps {
  products: Product[];
  categories: Category[];
  company: Company;
  onOpenModal: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const Inventory: React.FC<InventoryProps> = ({ 
    products, categories, company, onOpenModal, onEdit, onDelete,
    canCreate = true, canEdit = true, canDelete = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const currency = company?.currencySymbol || 'S/';

  // La DB ya nos devuelve los productos filtrados por sucursal y holding.
  // Aquí aplicamos filtros de búsqueda y estado activo solamente.
  const filtered = products.filter(p => {
      // Regla de negocio: Solo mostrar productos con estado 'a' (activo)
      if (p.estado !== 'a') return false;
      
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
          p.name.toLowerCase().includes(term) || 
          (p.category && p.category.toLowerCase().includes(term)) ||
          (p.description && p.description.toLowerCase().includes(term));
      
      return matchesSearch;
  });

  return (
    <div className="p-6 lg:p-8 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Package className="text-indigo-600" /> Catálogo de Servicios
                </h2>
                <p className="text-sm text-gray-500">Gestione sus productos, precios y control de stock.</p>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Buscar servicio..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-50 bg-white shadow-sm"
                    />
                </div>
                {canCreate && (
                    <button 
                        onClick={onOpenModal} 
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 flex gap-2 items-center transition-all active:scale-95 uppercase tracking-widest shrink-0"
                    >
                        <Plus size={18} strokeWidth={3} /> Nuevo
                    </button>
                )}
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Producto / Servicio</th>
                  <th className="px-6 py-4">Categoría</th>
                  <th className="px-6 py-4 text-center">Peso Est.</th>
                  <th className="px-6 py-4 text-center">Stock</th>
                  <th className="px-6 py-4 text-right">Costo</th>
                  <th className="px-6 py-4 text-right">Precio Venta</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400"><div className="flex flex-col items-center gap-3"><Search size={48} className="opacity-20" /><p className="font-bold uppercase tracking-widest">No se encontraron resultados</p></div></td></tr>
                ) : (
                    filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-800 uppercase">{p.name}</span>
                                {p.recipe && p.recipe.length > 0 && (
                                    <div className="bg-indigo-50 p-1 rounded-md text-indigo-600 border border-indigo-100" title="Contiene receta de insumos">
                                        <FlaskConical size={12} />
                                    </div>
                                )}
                                {p.showInCatalog && (
                                    <div className="bg-emerald-50 p-1 rounded-md text-emerald-600 border border-emerald-100" title="Visible en Tienda Virtual">
                                        <ShoppingBag size={12} />
                                    </div>
                                )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-medium flex items-center gap-2 mt-0.5 uppercase tracking-tight">
                                {p.unitCode} • {p.um_saas || 'UNIDAD'} • {p.igvType === '10' ? 'GRAVADO' : 'EXONERADO'}
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase border border-indigo-100">
                                {p.category || 'SIN CATEGORÍA'}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-bold">
                                {(p.peso_estimado || 0.4).toFixed(3)} KG
                            </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                            {p.unitCode === 'KGM' || p.trackStock ? (
                                <span className={`font-bold text-base ${p.stock <= 5 ? 'text-red-600' : 'text-slate-900'}`}>{p.stock}</span>
                            ) : (
                                <span className="text-gray-300 font-bold italic text-xs uppercase">Servicio</span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <span className="text-gray-500 font-medium">{currency} {(Number(p.cost) || 0).toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <span className="font-bold text-indigo-600 text-lg">{currency} {(Number(p.price) || 0).toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex justify-center gap-2">
                                {canEdit && (
                                    <button onClick={() => onEdit(p)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Editar"><Edit size={18} /></button>
                                )}
                                {canDelete && (
                                    <button onClick={() => setProductToDelete(p.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Eliminar"><Trash2 size={18} /></button>
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

      <ConfirmationModal 
          isOpen={!!productToDelete}
          onClose={() => setProductToDelete(null)}
          onConfirm={() => { if (productToDelete) { onDelete(productToDelete); setProductToDelete(null); } }}
          title="Eliminar Producto"
          message={<div className="space-y-2"><p>¿Estás seguro de que deseas eliminar este producto?</p><div className="p-3 bg-red-50 rounded-xl flex gap-3 text-red-700"><AlertCircle size={18} className="shrink-0" /><p className="text-xs font-bold uppercase">El producto dejará de ser visible en el catálogo de ventas.</p></div></div>}
          confirmText="Sí, Eliminar"
          isDangerous={true}
      />
    </div>
  );
};

export default Inventory;

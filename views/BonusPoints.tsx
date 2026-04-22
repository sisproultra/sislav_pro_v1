
import React, { useState } from 'react';
import { Company, Product, Sucursal } from '../types';
import { Star, Save, Settings, Package, Crown, Search, Check, AlertCircle, Sparkles, Loader2 } from 'lucide-react';

interface BonusPointsProps {
    company: Company;
    products: Product[];
    onSaveCompany: (c: Company) => Promise<void>;
    onUpdateProduct: (id: string, p: Partial<Product>) => Promise<void>;
    canManage?: boolean;
}

const BonusPoints: React.FC<BonusPointsProps> = ({ company, products, onSaveCompany, onUpdateProduct, canManage = true }) => {
    const sucursal = company as Sucursal;
    const primaryColor = sucursal.primaryColor || '#4f46e5';
    
    const [pointsEq, setPointsEq] = useState(company.pointsEquivalency?.toString() || '10');
    const [searchTerm, setSearchTerm] = useState('');
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isUpdatingProduct, setIsUpdatingProduct] = useState<string | null>(null);

    // Sincronizar estado local cuando cambian las props
    React.useEffect(() => {
        if (company.pointsEquivalency !== undefined) {
            setPointsEq(company.pointsEquivalency.toString());
        }
    }, [company.pointsEquivalency]);

    const currency = company.currencySymbol || 'S/';

    const handleSaveConfig = async () => {
        setIsSavingConfig(true);
        try {
            await onSaveCompany({ ...company, pointsEquivalency: parseFloat(pointsEq) || 10 });
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleUpdatePointsPrice = async (productId: string, value: string) => {
        setIsUpdatingProduct(productId);
        const pointsPrice = value === '' ? undefined : parseInt(value);
        await onUpdateProduct(productId, { pointsPrice });
        setIsUpdatingProduct(null);
    };

    const filteredProducts = products.filter(p => 
        p.estado !== 'i' && ( // REGLA: No mostrar productos inactivos
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.category.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-slate-50 custom-scrollbar">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-amber-50 text-amber-500 shadow-inner">
                            <Star size={32} className="fill-amber-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">
                                Puntos Bonus
                            </h2>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Fidelización y Recompensas</p>
                        </div>
                    </div>

                    {showSuccess && (
                        <div 
                            className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 animate-in fade-in slide-in-from-right-4"
                        >
                            <Check size={14} />
                            ¡Configuración Actualizada!
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* CONFIGURACIÓN DE EQUIVALENCIA */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden sticky top-0">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between" style={{ backgroundColor: `${primaryColor}08` }}>
                                <div className="flex items-center gap-3">
                                    <Settings size={18} style={{ color: primaryColor }} />
                                    <h3 className="font-bold text-[10px] uppercase tracking-widest text-slate-700">Equivalencia</h3>
                                </div>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
                                        ¿Cuánto consumo genera 1 punto?
                                    </p>
                                    <div className="relative group">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-[var(--brand-primary)] text-xl opacity-40 group-focus-within:opacity-100 transition-opacity" style={{ color: primaryColor }}>{currency}</span>
                                        <input 
                                            type="number"
                                            value={pointsEq}
                                            disabled={!canManage}
                                            onChange={e => setPointsEq(e.target.value)}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-3xl font-black outline-none transition-all text-center focus:bg-white disabled:opacity-50"
                                            style={{ borderColor: isSavingConfig ? primaryColor : undefined }}
                                        />
                                    </div>
                                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50 flex gap-3">
                                        <AlertCircle size={16} className="text-amber-600 shrink-0" />
                                        <p className="text-[9px] text-amber-800 font-bold uppercase leading-snug">
                                            Por cada <span className="underline decoration-amber-500/30 decoration-2">{currency} {pointsEq || '0'}</span> de consumo el cliente ganará <span className="text-amber-600">1 punto</span>.
                                        </p>
                                    </div>
                                </div>
                                {canManage && (
                                    <button 
                                        onClick={handleSaveConfig}
                                        disabled={isSavingConfig}
                                        className="w-full text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        style={{ 
                                            backgroundColor: primaryColor,
                                            boxShadow: `0 10px 20px -5px ${primaryColor}40`
                                        }}
                                    >
                                        {isSavingConfig ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
                                        {isSavingConfig ? 'Guardando...' : 'Guardar Cambios'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* GESTIÓN DE SERVICIOS CANJEABLES */}
                    <div className="lg:col-span-8">
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-slate-50" style={{ color: primaryColor }}>
                                        <Package size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-700 leading-none">Canje de Servicios</h3>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Asigna costo en puntos para canje directo</p>
                                    </div>
                                </div>
                                <div className="relative w-full sm:w-72 group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--brand-primary)] transition-colors" size={14} style={{ color: searchTerm ? primaryColor : undefined }} />
                                    <input 
                                        type="text"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="FILTRAR SERVICIO..."
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/50 sticky top-0 z-10">
                                        <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                                            <th className="px-8 py-5">Información del Servicio</th>
                                            <th className="px-8 py-5 text-right">Precio ({currency})</th>
                                            <th className="px-8 py-5 text-center w-48">Coste en Puntos</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredProducts.map(product => (
                                            <tr key={product.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="px-8 py-5">
                                                    <div className="font-black text-slate-900 uppercase text-[11px] tracking-tight">{product.name}</div>
                                                    <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-[8px] font-black text-slate-500 uppercase tracking-tighter mt-1.5 group-hover:bg-white transition-colors">{product.category}</div>
                                                </td>
                                                <td className="px-8 py-5 text-right font-black text-slate-500 text-xs">
                                                    {(Number(product.price) || 0).toFixed(2)}
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="relative flex items-center justify-center">
                                                        <div className="absolute left-6 pointer-events-none">
                                                            <Crown size={14} className={`${product.pointsPrice ? 'text-amber-500 animate-pulse' : 'text-slate-200'}`} />
                                                        </div>
                                                        <input 
                                                            type="number"
                                                            defaultValue={product.pointsPrice || ''}
                                                            disabled={!canManage}
                                                            onBlur={(e) => handleUpdatePointsPrice(product.id, e.target.value)}
                                                            placeholder="---"
                                                            className="w-32 pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-xs font-black text-amber-600 outline-none transition-all text-center focus:bg-white focus:border-amber-200 disabled:opacity-50"
                                                        />
                                                        {isUpdatingProduct === product.id && (
                                                            <div className="absolute -right-2">
                                                                <Sparkles className="text-amber-400 animate-bounce" size={16} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {filteredProducts.length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-30 grayscale">
                                    <Package size={64} strokeWidth={1} />
                                    <p className="mt-4 font-black text-[10px] uppercase tracking-widest font-mono">No se encontraron servicios</p>
                                </div>
                            )}

                            <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                                <div className="flex items-center justify-center gap-2 text-slate-400">
                                    <AlertCircle size={12} />
                                    <p className="text-[9px] font-bold uppercase tracking-widest">
                                        Asigna puntos para habilitar canjes directos en el mostrador
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BonusPoints;

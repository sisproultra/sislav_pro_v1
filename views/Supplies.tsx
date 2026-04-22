
import React, { useState, useEffect } from 'react';
import { Supply, StockMovement, Company } from '../types';
import { Plus, AlertTriangle, TrendingUp, TrendingDown, Droplets, Beaker, Download, FileText, Calendar, Search, BellRing, Bell, Clock, Trash2 } from 'lucide-react';
import { dbGetMovements } from '../services/dbService';
import * as XLSX from 'xlsx';
import ConfirmationModal from '../components/ConfirmationModal';

interface SuppliesProps {
  supplies: Supply[];
  company: Company;
  onOpenModal: () => void;
  onDelete?: (id: string) => Promise<void>;
  canManage?: boolean;
}

const LiquidContainer = ({ percent, unit, isLow, color }: { percent: number, unit: string, isLow: boolean, color?: string }) => {
    // Usar el color del insumo o azul por defecto
    const baseColor = color || '#3b82f6';
    
    return (
        <div className="relative w-24 h-36 mx-auto mb-6">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-3 bg-slate-700 rounded-t-md z-20 border-b border-slate-600 shadow-sm"></div>
            <div className="absolute top-3 left-0 right-0 bottom-0 bg-slate-100/40 border-2 border-slate-300 rounded-2xl rounded-t-lg overflow-hidden backdrop-blur-[1px] shadow-inner z-10">
                <div className="absolute left-1.5 top-4 bottom-4 w-2 flex flex-col justify-between opacity-20 z-30">{[...Array(8)].map((_, i) => (<div key={i} className="h-[1px] w-full bg-slate-900"></div>))}</div>
                <div 
                    className="absolute bottom-0 left-0 right-0 transition-all duration-[2000ms] ease-in-out" 
                    style={{ height: `${percent}%`, backgroundColor: baseColor, color: baseColor }}
                >
                    <div className="absolute -top-6 left-0 w-[200%] h-8 opacity-60 animate-[wave_4s_linear_infinite]">
                        <svg viewBox="0 0 120 28" fill="currentColor" className="w-full h-full">
                            <path d="M0 15C30 15 30 0 60 0C90 0 90 15 120 15V28H0V15Z" />
                        </svg>
                    </div>
                </div>
            </div>
            <div className="absolute top-5 left-3 w-1.5 bottom-6 bg-white/30 rounded-full z-20 blur-[1px]"></div>
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded-full z-40 shadow-xl border border-white/20">{percent.toFixed(0)}%</div>
        </div>
    );
};

const Supplies: React.FC<SuppliesProps> = ({ supplies, company, onOpenModal, onDelete, canManage = true }) => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [filterSupplyId, setFilterSupplyId] = useState('ALL');
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplyToDelete, setSupplyToDelete] = useState<string | null>(null);

  const currency = company.currencySymbol || 'S/';

  useEffect(() => {
    dbGetMovements().then(setMovements);
  }, [supplies]);

  const handleExportKardex = () => {
    const filtered = movements.filter(m => {
        const matchesSupply = filterSupplyId === 'ALL' || m.supplyId === filterSupplyId;
        const moveDate = m.date.split('T')[0];
        const matchesDate = moveDate >= startDate && moveDate <= endDate;
        return matchesSupply && matchesDate;
    });
    if (filtered.length === 0) { alert("Sin movimientos en el rango."); return; }
    const excelData = filtered.map(m => {
        const d = new Date(m.date);
        return { 
            'FECHA': d.toLocaleDateString(), 
            'HORA': d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            'PRODUCTO': m.supplyName, 
            'TIPO OPERACIÓN': m.type.replace(/_/g, ' '), 
            'CANTIDAD': m.quantity, 
            'COSTO': m.cost.toFixed(2) 
        };
    });
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kardex");
    XLSX.writeFile(wb, `Kardex_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="p-6 lg:p-8 h-full overflow-y-auto bg-slate-50 custom-scrollbar">
      <style>{`@keyframes wave { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      <div className="max-w-full mx-auto space-y-8">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm">
           <div className="shrink-0">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
                    <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-md"><Beaker size={20} /></div>
                    GESTIÓN DE INSUMOS
                </h2>
           </div>
           <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex-1 sm:flex-initial">
                    <select value={filterSupplyId} onChange={e => setFilterSupplyId(e.target.value)} className="bg-transparent border-none text-[10px] font-bold uppercase outline-none px-2 text-slate-600 min-w-[120px]">
                        <option value="ALL">TODOS</option>
                        {supplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <div className="flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold outline-none text-slate-600" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">al</span>
                    <div className="flex items-center gap-1">
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-bold outline-none text-slate-600" />
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={handleExportKardex} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md uppercase text-[10px] tracking-widest flex-1 sm:flex-initial" title="Descargar Kardex Excel">
                        <Download size={14} /> EXCEL
                    </button>
                    {canManage && (
                        <button onClick={onOpenModal} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-bold hover:bg-indigo-700 shadow-md flex gap-2 items-center transition-all active:scale-95 uppercase tracking-widest flex-1 sm:flex-initial">
                            <Plus size={14} strokeWidth={4} /> NUEVO INSUMO
                        </button>
                    )}
                </div>
           </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
            <ConfirmationModal 
                isOpen={!!supplyToDelete}
                onClose={() => setSupplyToDelete(null)}
                onConfirm={async () => { if (supplyToDelete && onDelete) { await onDelete(supplyToDelete); setSupplyToDelete(null); } }}
                title="Eliminar Insumo"
                message={<p className="font-bold text-slate-800">¿Desea eliminar este insumo del inventario activo? Esta acción ocultará el insumo de los reportes y conteos.</p>}
                confirmText="Sí, Eliminar"
                isDangerous={true}
            />
            {supplies.map(supply => {
                const max = supply.maxStock || (supply.currentStock > 10 ? supply.currentStock * 1.5 : 20);
                const percent = Math.min(100, (supply.currentStock / max) * 100);
                const isLowStock = supply.currentStock <= supply.minStock;
                const isCritical = supply.currentStock <= (supply.minStock / 2);
                const avgCost = supply.averageCost || supply.lastCost || 0;
                
                let alertClass = "bg-emerald-100 text-emerald-600 border-emerald-200";
                let AlertIcon = Bell;
                
                if (isCritical) { 
                    alertClass = "bg-red-600 text-white border-red-500 animate-bounce shadow-lg shadow-red-200"; 
                    AlertIcon = BellRing; 
                } else if (isLowStock) { 
                    alertClass = "bg-orange-500 text-white border-orange-400 animate-pulse"; 
                    AlertIcon = BellRing; 
                }
                
                return (
                    <div key={supply.id} className="bg-white rounded-[2.5rem] border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all group flex flex-col items-center relative overflow-hidden">
                        <div className={`absolute top-4 left-4 p-1.5 rounded-full border z-30 transition-colors ${alertClass}`}>
                            <AlertIcon size={14} strokeWidth={3} />
                        </div>
                        
                        {canManage && (
                            <button 
                                onClick={() => setSupplyToDelete(supply.id)}
                                className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 z-30"
                                title="Eliminar Insumo"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        
                        <LiquidContainer percent={percent} unit={supply.unit} isLow={isLowStock} color={supply.color} />
                        
                        <div className="text-center w-full">
                            <h3 className="font-bold text-slate-800 text-[11px] uppercase tracking-tight line-clamp-1 mb-1 leading-none">{supply.name}</h3>
                            <div className="flex items-baseline justify-center gap-1">
                                <span className={`text-3xl font-bold tracking-tight ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>{supply.currentStock}</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{supply.unit}</span>
                            </div>
                        </div>
                        
                        <div className="w-full mt-6 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Costo Prom.</span>
                                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">{currency} {avgCost.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Stock Mín.</span>
                                <span className="text-[11px] font-bold text-red-500">{supply.minStock}{supply.unit}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
            {supplies.length === 0 && (
                <div className="col-span-full py-24 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center">
                    <Droplets size={60} className="text-slate-100 mb-4" />
                    <h3 className="text-xl font-bold text-slate-300 uppercase tracking-widest">Sin Insumos Registrados</h3>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Supplies;

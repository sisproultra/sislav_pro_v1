
import React, { useState } from 'react';
import { Supply, Company } from '../types';
import { X, Save, Loader2, Beaker, Zap, CheckCircle2, Palette } from 'lucide-react';

interface SupplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supply: Omit<Supply, 'id'>) => Promise<void>;
  // FIX: Added company to props
  company: Company;
}

const PRESET_COLORS = [
    { name: 'Azul Detergente', hex: '#3b82f6' },
    { name: 'Celeste Suavizante', hex: '#60a5fa' },
    { name: 'Rosa Quitamanchas', hex: '#f472b6' },
    { name: 'Verde Ecológico', hex: '#34d399' },
    { name: 'Naranja Cítrico', hex: '#fb923c' },
    { name: 'Púrpura Premium', hex: '#a78bfa' },
];

const SupplyModal: React.FC<SupplyModalProps> = ({ isOpen, onClose, onSave, company }) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('Lt');
  const [stock, setStock] = useState('0');
  const [color, setColor] = useState('#3b82f6');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
        await onSave({
            // FIX: Added sucursal_id to satisfy type requirement
            sucursal_id: company.id,
            name: name.toUpperCase(),
            unit: unit.toUpperCase(),
            currentStock: parseFloat(stock) || 0,
            minStock: 0,
            color: color // Enviamos el color seleccionado a la columna color_insumo
        });
        setName('');
        setUnit('Lt');
        setStock('0');
        setColor('#3b82f6');
        onClose();
    } catch (error: any) {
        console.error("Error al registrar insumo:", error);
        alert("Hubo un error al guardar el insumo.");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-[150] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
        <div className="bg-slate-900 text-white px-10 py-8 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
             <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg"><Beaker size={28}/></div>
             <div>
                <h2 className="font-bold text-2xl uppercase tracking-tight leading-none mb-1">Nuevo Insumo</h2>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Registrar suministro en planta</p>
             </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors"><X size={28} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Nombre del Insumo</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 py-5 text-base font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all uppercase placeholder:text-slate-300 shadow-inner"
              placeholder="Ej. DETERGENTE LÍQUIDO"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Unidad Medida</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all appearance-none shadow-sm"
              >
                <option value="Lt">Litros (Lt)</option>
                <option value="Kg">Kilos (Kg)</option>
                <option value="Und">Unidad (Und)</option>
                <option value="Gal">Galón (Gal)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Stock Inicial</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold outline-none focus:border-indigo-500 focus:bg-white shadow-sm"
              />
            </div>
          </div>

          {/* SELECTOR DE COLOR PERSONALIZADO */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                <Palette size={14} /> Color Representativo (Para Contenedor)
            </label>
            <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                {PRESET_COLORS.map(c => (
                    <button 
                        key={c.hex} 
                        type="button" 
                        onClick={() => setColor(c.hex)}
                        className={`w-10 h-10 rounded-full border-4 transition-all transform active:scale-90 ${color === c.hex ? 'border-white shadow-lg scale-110' : 'border-transparent opacity-60'}`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                    />
                ))}
                <div className="w-px h-10 bg-slate-200 mx-1"></div>
                <div className="relative group">
                    <input 
                        type="color" 
                        value={color} 
                        onChange={e => setColor(e.target.value)}
                        className="w-10 h-10 rounded-full cursor-pointer border-2 border-white shadow-md bg-transparent"
                    />
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Libre</span>
                </div>
            </div>
          </div>

          <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-3">
              <Zap size={20} className="text-amber-500" />
              <p className="text-[10px] text-indigo-700 font-bold uppercase leading-tight italic">
                  * El color ayudará a identificar visualmente el nivel del insumo en el panel principal.
              </p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-6 rounded-[1.5rem] shadow-2xl transition-all flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50 uppercase text-sm tracking-widest"
          >
            {isSaving ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
            {isSaving ? 'Registrando...' : 'Confirmar Registro'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SupplyModal;

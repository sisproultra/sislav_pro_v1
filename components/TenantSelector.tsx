
import React, { useState, useEffect } from 'react';
import { getTenants } from '../services/saasService';
import { TenantConfig } from '../types';
import { Loader2, Store, ArrowRight, X, WashingMachine, Copy, AlertTriangle, Info, ShieldAlert } from 'lucide-react';

interface TenantSelectorProps {
  onSelect: (tenant: any) => void;
  onGoToMasterLogin: () => void;
}

const TenantSelector: React.FC<TenantSelectorProps> = ({ onSelect, onGoToMasterLogin }) => {
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getTenants().then(() => setLoading(false)).catch((err) => {
        console.error("Error cargando sucursales:", err);
        setLoading(false);
    });
  }, []);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = tenantId.trim().toLowerCase();
    if (!cleanId) return;

    setLoading(true);
    setError('');
    try {
        const list = await getTenants();
        // Buscamos coincidencia por slug o por ID
        const found = list.find((t: any) => 
            (t.slug && t.slug.toLowerCase() === cleanId) || 
            (t.id && t.id.toLowerCase() === cleanId)
        );

        if (found) {
            if (!found.isActive) {
                setError("Esta sucursal está suspendida.");
            } else {
                onSelect(found);
            }
        } else {
            setError(`La sucursal '${tenantId}' no existe en nuestra red.`);
        }
    } catch (err) {
        console.error("Manual Login Error:", err);
        setError("Error de conexión al servidor maestro. Intente nuevamente.");
    } finally {
        setLoading(false);
    }
  };

  if (loading) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-indigo-500">
          <Loader2 className="animate-spin" size={48} />
          <p className="text-[10px] font-bold uppercase tracking-widest mt-4 opacity-40">Consultando Red Sislav...</p>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="max-w-md w-full bg-slate-900/70 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden relative z-10">
        <div className="p-8 pb-6 text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
                <WashingMachine className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-1">SISLAV</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Acceso a Terminal</p>
        </div>

        <div className="p-8 pt-2">
            <form onSubmit={handleManualLogin} className="space-y-5">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Identificador de Sucursal (Slug)</label>
                    <input 
                        type="text" 
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value)}
                        placeholder="ej: mi_lavanderia"
                        className="w-full bg-black/40 text-white px-5 py-4 rounded-2xl border border-slate-700 focus:border-indigo-500 outline-none font-bold placeholder:text-slate-600 transition-all"
                        autoFocus
                    />
                </div>
                {error && (
                    <div className="text-red-400 text-[10px] font-bold uppercase bg-red-500/10 p-4 rounded-xl border border-red-500/20 text-center animate-shake">
                        {error}
                    </div>
                )}
                <button 
                    type="submit" 
                    disabled={!tenantId || loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white font-bold py-5 rounded-2xl shadow-xl active:scale-95 transition-all flex justify-center items-center gap-3 uppercase tracking-widest text-xs"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <>CONECTAR TERMINAL <ArrowRight size={18} /></>}
                </button>
            </form>
            
            <div className="mt-10 flex flex-col gap-4 pt-6 border-t border-slate-800/50">
                <button onClick={onGoToMasterLogin} className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2 mx-auto transition-colors group">
                    <ShieldAlert size={12} className="group-hover:animate-pulse" /> ACCESO ADMINISTRADOR MAESTRO
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TenantSelector;

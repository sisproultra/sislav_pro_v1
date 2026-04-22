
import React from 'react';
import { Sucursal } from '../types';
import { Building, Store, ArrowRight, TrendingUp, LogOut, LayoutGrid, Globe, ShieldCheck, AlertTriangle } from 'lucide-react';

interface HoldingDashboardProps {
    branches: Sucursal[];
    onSelectBranch: (s: Sucursal) => void;
    onLogout: () => void;
}

const HoldingDashboard: React.FC<HoldingDashboardProps> = ({ branches, onSelectBranch, onLogout }) => {
    return (
        <div className="min-h-screen bg-bg text-text font-sans flex flex-col p-8 lg:p-12 overflow-y-auto custom-scrollbar">
            <header className="flex justify-between items-center mb-20 max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-5">
                    <div className="bg-accent p-4 rounded-2xl shadow-2xl shadow-accent/20">
                        <Building size={32} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-display font-bold uppercase tracking-tight text-text">Panel de Holding</h1>
                        <p className="text-accent text-[9px] font-bold uppercase tracking-[0.5em] mt-1">Multi-Tenant Core SISLAV</p>
                    </div>
                </div>
                <button onClick={onLogout} className="p-4 bg-bg2 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl transition-all border border-border group active:scale-95">
                    <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
                </button>
            </header>

            <main className="max-w-7xl mx-auto w-full flex-1">
                <div className="mb-12 flex items-center gap-4">
                    <ShieldCheck className="text-emerald-500" size={20} />
                    <h2 className="text-lg font-display font-bold uppercase tracking-tight text-text2">Seleccione Sucursal para Gestionar</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {branches.map(branch => (
                        <div 
                            key={branch.id} 
                            onClick={() => onSelectBranch(branch)}
                            className="bg-bg2 rounded-card-lg border border-border p-10 group hover:border-accent/50 transition-all cursor-pointer shadow-xl relative overflow-hidden flex flex-col"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700 text-text3">
                                <LayoutGrid size={120} />
                            </div>
                            
                            <div className="flex justify-between items-start mb-12 relative z-10">
                                <div className="w-20 h-20 bg-bg3 rounded-2xl border border-border flex items-center justify-center p-3 shadow-inner transform group-hover:scale-110 transition-transform duration-500">
                                    {branch.url_logo ? (
                                        <img src={branch.url_logo} className="max-w-full h-auto object-contain" alt="Logo" referrerPolicy="no-referrer" />
                                    ) : (
                                        <Store size={40} className="text-text3" />
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`px-4 py-1.5 rounded-md text-[8px] font-bold uppercase tracking-widest border ${branch.activo ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                                        {branch.activo ? 'ONLINE' : 'OFFLINE'}
                                    </span>
                                    <div className="w-8 h-1 rounded-full" style={{ backgroundColor: branch.color_primario }}></div>
                                </div>
                            </div>

                            <h3 className="text-2xl font-display font-bold uppercase tracking-tight mb-2 relative z-10 leading-none group-hover:text-accent transition-colors text-text">{branch.nombre_sucursal}</h3>
                            <p className="text-text3 text-[9px] font-bold uppercase tracking-[0.3em] mb-10 relative z-10 flex items-center gap-2">
                                <Globe size={12} className="text-accent" /> ID: {branch.slug}
                            </p>

                            <div className="flex items-center justify-between pt-8 border-t border-border relative z-10 mt-auto">
                                <div className="flex items-center gap-2 text-accent font-bold text-[9px] uppercase tracking-widest">
                                    <TrendingUp size={14} /> Ir a Gestión Directa
                                </div>
                                <div className="p-4 bg-accent rounded-xl text-white shadow-lg group-hover:translate-x-3 transition-all duration-500 group-hover:shadow-accent/40 active:scale-95">
                                    <ArrowRight size={20} strokeWidth={3} />
                                </div>
                            </div>
                        </div>
                    ))}

                    {branches.length === 0 && (
                        <div className="col-span-full py-40 bg-bg2 rounded-card-lg border border-dashed border-border flex flex-col items-center justify-center text-center">
                            <AlertTriangle size={48} className="text-amber-500 mb-6 opacity-40" />
                            <p className="text-lg font-display font-bold uppercase tracking-tight text-text3">No se encontraron sucursales vinculadas</p>
                            <p className="text-[10px] text-text3 font-bold uppercase mt-2">Contacte a soporte técnico para asignar sedes a su holding.</p>
                        </div>
                    )}
                </div>
            </main>

            <footer className="mt-24 text-center pb-8 border-t border-border pt-10">
                <p className="text-[9px] font-bold text-text3 uppercase tracking-[0.8em]">Powered by Sislav AI v2.0 • Realtime SaaS Core</p>
            </footer>
        </div>
    );
};

export default HoldingDashboard;

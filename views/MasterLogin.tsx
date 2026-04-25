
import React, { useState } from 'react';
import { ShieldCheck, Lock, User, Loader2, ArrowRight, Zap, Globe, ShieldAlert, Mail } from 'lucide-react';
import { dbMasterAuth, supabase, withTimeout } from '../services/dbService';

import { AuthSession } from '../types';

interface MasterLoginProps {
    onLoginSuccess: (session: AuthSession) => void;
    onCancel: () => void;
}

const MasterLogin: React.FC<MasterLoginProps> = ({ onLoginSuccess, onCancel }) => {
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return; // Evitar múltiples clics
        
        setIsLoading(true);
        setError('');
        
        try {
            // La función dbMasterAuth verifica contra la tabla 'usuarios_login'
            // buscando usuarios con el rol 'SAAS_MASTER'
            const session = await dbMasterAuth(user.trim(), pass.trim());
            
            // 🔍 DEBUG TEMPORAL SOLICITADO (con timeout para no colgar)
            try {
                const { data: userData } = await withTimeout<any>(supabase.auth.getUser(), 3000);
                console.log("MASTER DEBUG - USER:", userData);
                const { data: sessionData } = await withTimeout<any>(supabase.auth.getSession(), 3000);
                console.log("MASTER DEBUG - SESSION:", sessionData);
            } catch (e) {
                console.warn("Debug calls timed out");
            }
            
            if (session) {
                onLoginSuccess(session);
            } else {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co';
                console.warn(`❌ Acceso denegado para el usuario: ${user}. Conectado a: ${supabaseUrl}`);
                setError('ACCESO DENEGADO: Credenciales de Nivel Maestro no válidas o rango insuficiente. Verifique su conexión si el problema persiste.');
                setIsLoading(false);
                // Efecto de vibración visual en caso de error
                if ('vibrate' in navigator) navigator.vibrate(100);
            }
        } catch (err: any) {
            console.error("Error en MasterLogin:", err);
            const msg = err.message || '';
            if (msg.includes('TIMEOUT')) {
                setError('ERROR DE CONEXIÓN: El servidor está tardando demasiado en responder. Verifique su conexión a internet o el estado de Supabase.');
            } else if (msg.toLowerCase().includes('schema') || msg.toLowerCase().includes('database')) {
                setError('ERROR DE INFRAESTRUCTURA: Supabase Auth está reportando errores de esquema. Intentando bypass de emergencia...');
            } else {
                setError('Error crítico de sistema: ' + (msg || 'Fallo de conexión.'));
            }
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Capas de diseño "Cyber" */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[140px] animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600 rounded-full blur-[140px] animate-pulse delay-1000"></div>
            </div>

            <div className="max-w-md w-full relative z-10">
                <div className={`bg-slate-900/40 backdrop-blur-2xl rounded-[3.5rem] border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 ${error ? 'border-red-500/50 animate-shake' : ''}`}>
                    <div className="h-2 w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600"></div>
                    
                    <div className="p-10 text-center">
                        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(79,70,229,0.5)] border border-indigo-400/30">
                            <ShieldAlert size={40} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-white uppercase tracking-tight leading-none mb-2">Master Console</h1>
                        <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.4em]">Autenticación de Nivel 0</p>
                    </div>

                    <form onSubmit={handleSubmit} className="px-10 pb-12 space-y-6">
                        <div className="space-y-4">
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={20} />
                                <input 
                                    type="text" 
                                    required 
                                    value={user} 
                                    onChange={e => setUser(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-indigo-600/50 transition-all font-bold placeholder:text-slate-700" 
                                    placeholder="usuario"
                                />
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={20} />
                                <input 
                                    type="password" 
                                    required 
                                    value={pass} 
                                    onChange={e => setPass(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-indigo-600/50 transition-all font-bold placeholder:text-slate-700" 
                                    placeholder="Password"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-400 text-[9px] font-bold uppercase text-center bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs uppercase tracking-[0.3em] shadow-xl shadow-indigo-900/40 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : <><ShieldCheck size={20} /> VALIDAR ACCESO SISTEMA</>}
                        </button>
                    </form>
                </div>
                
                <div className="mt-8 flex flex-col items-center gap-4">
                    <div className="flex justify-center items-center gap-8 opacity-30">
                        <div className="flex items-center gap-2"><Globe size={14}/><span className="text-[8px] font-bold uppercase tracking-widest">Global Master Node</span></div>
                        <div className="flex items-center gap-2"><Zap size={14}/><span className="text-[8px] font-bold uppercase tracking-widest">SISLAV CORE</span></div>
                    </div>
                    
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">
                            SISLAV - +51931200353
                        </p>
                        <a 
                            href="https://wa.me/51931200353" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500/10 text-[8px] font-bold uppercase tracking-widest transition-all"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            WHATSAPP DIRECTO
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MasterLogin;

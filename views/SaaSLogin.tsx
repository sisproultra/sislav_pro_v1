import React, { useState, useEffect } from 'react';
import { Lock, User, ShieldCheck, Loader2, Store, ArrowRight, AlertTriangle, ShieldAlert, Sun, Moon } from 'lucide-react';
import { Sucursal } from '../types';

interface SaaSLoginProps {
  onLogin: (u: string, p: string) => Promise<void>;
  sucursal: Sucursal | null;
  onGoToMasterLogin?: () => void;
  hideMasterAdmin?: boolean;
}

const SaaSLogin: React.FC<SaaSLoginProps> = ({ onLogin, sucursal, onGoToMasterLogin, hideMasterAdmin }) => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('sislav_login_theme');
    return saved === 'light' ? false : true;
  });

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('sislav_login_theme', !isDarkMode ? 'dark' : 'light');
  };

  const brandPrimary = sucursal?.color_primario || '#6366f1';
  const brandSecondary = sucursal?.color_secundario || '#ec4899';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await onLogin(user, pass);
    } catch (e: any) {
      setError(e.message || "Credenciales incorrectas");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-bg flex items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-500 ${!isDarkMode ? 'light-theme' : ''}`}>
      {/* Botón de cambio de tema */}
      <button
        onClick={toggleTheme}
        className="absolute top-8 right-8 z-50 p-3 rounded-2xl bg-bg2/40 backdrop-blur-xl border border-white/10 text-text hover:scale-110 active:scale-95 transition-all shadow-lg"
        title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      >
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Elementos ambientales de marca */}
      <div
        className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] opacity-20 animate-pulse"
        style={{ background: brandPrimary }}
      ></div>
      <div
        className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] opacity-10"
        style={{ background: brandSecondary }}
      ></div>

      <div className="max-w-md w-full relative z-10 group">
        {/* Glow effect post-hover */}
        <div
          className="absolute inset-0 rounded-[3.5rem] blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000"
          style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})` }}
        ></div>

        <div className="bg-bg2/40 backdrop-blur-3xl rounded-[3.5rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] relative border border-white/5 group-hover:border-white/10 transition-all duration-700">
          {/* Barra de progreso de marca - más sutil */}
          <div
            className="h-1 w-full opacity-50"
            style={{ background: `linear-gradient(90deg, transparent, ${brandPrimary}, ${brandSecondary}, transparent)` }}
          ></div>

          <div className="p-10 pt-12 text-center">
            <div className="w-32 h-32 mx-auto mb-10 relative">
              <div
                className="absolute inset-0 rounded-full blur-2xl opacity-30 animate-pulse"
                style={{ background: brandPrimary }}
              ></div>
              <div className="relative w-full h-full bg-white backdrop-blur-md rounded-[3rem] flex items-center justify-center p-6 shadow-2xl transform group-hover:scale-110 transition-transform duration-700 ease-out border border-black/5">
                {sucursal?.url_logo ? (
                  <img src={sucursal.url_logo} className="max-w-full h-auto object-contain drop-shadow-lg" alt="Logo" referrerPolicy="no-referrer" />
                ) : (
                  <Store size={56} style={{ color: brandPrimary }} />
                )}
              </div>
            </div>

            <h1 className="text-3xl font-display font-bold text-text uppercase tracking-tight leading-none mb-3 drop-shadow-sm">
              {sucursal?.nombre_sucursal || 'SISLAV POWER'}
            </h1>
            <div className="flex items-center justify-center gap-2">
              <div className="h-px w-8 bg-text/10"></div>
              <p className="text-text3 text-[9px] font-bold uppercase tracking-[0.4em] opacity-50">Terminal Operativo</p>
              <div className="h-px w-8 bg-text/10"></div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-10 pb-12 space-y-6">
            <div className="space-y-4">
              <div className="relative group/input">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-text3 group-focus-within/input:text-brand-primary transition-colors" size={20} />
                <input
                  type="text"
                  required
                  placeholder="Nombre de usuario"
                  value={user}
                  onChange={e => setUser(e.target.value)}
                  className="w-full bg-bg3/50 border border-text/10 rounded-2xl py-5 pl-14 pr-4 text-text outline-none focus:ring-2 focus:bg-bg2 transition-all font-bold placeholder:text-text3"
                  style={{ '--tw-ring-color': brandPrimary } as any}
                />
              </div>
              <div className="relative group/input">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-text3 group-focus-within/input:text-brand-primary transition-colors" size={20} />
                <input
                  type="password"
                  required
                  placeholder="Contraseña"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  className="w-full bg-bg3/50 border border-text/10 rounded-2xl py-5 pl-14 pr-4 text-text outline-none focus:ring-2 focus:bg-bg2 transition-all font-bold placeholder:text-text3"
                  style={{ '--tw-ring-color': brandPrimary } as any}
                />
              </div>
            </div>

            {error && (
              <div className="text-rose-500 text-[10px] font-bold uppercase text-center bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 animate-in slide-in-from-top-2">
                <AlertTriangle className="inline mr-2 mb-0.5" size={12} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-5 rounded-2xl text-white font-bold text-xs uppercase tracking-[0.25em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 hover:brightness-110 group/btn overflow-hidden relative"
              style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})`, boxShadow: `0 20px 40px -10px ${brandPrimary}80` }}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={20} className="group-hover:scale-110 transition-transform" />
                  Entrar al Sistema
                  <ArrowRight size={16} className="opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </>
              )}
            </button>

            {onGoToMasterLogin && !hideMasterAdmin && (
              <button 
                type="button"
                onClick={onGoToMasterLogin}
                className="w-full py-3 text-text3 hover:text-text2 font-bold text-[9px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                <ShieldAlert size={12} />
                Acceso Administrador Maestro
              </button>
            )}
          </form>
        </div>

        <p className="mt-8 text-center text-text3 text-[10px] font-bold uppercase tracking-widest">
          Sislav ultra v1.0 • 931200353 Jhon Obregon
        </p>
      </div>
    </div>
  );
};

export default SaaSLogin;

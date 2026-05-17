import React, { useState, useEffect } from 'react';
import { dbOwnerAuth, supabase } from '../services/dbService';
import { ShieldCheck, Lock, User, Loader2, ArrowRight, Sun, Moon, Mail, Building } from 'lucide-react';
import { motion } from 'framer-motion';
import { UserRole } from '../types';

import { applyDynamicManifest } from '../utils/pwaUtils';

import { APP_VERSION } from '../components/VersionGuard';

interface OwnerLoginProps {
  onLogin: (session: any) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export default function OwnerLogin({ onLogin, isDarkMode, toggleTheme }: OwnerLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<any>(() => {
    return (window as any).__SUCURSAL_BRANDING__ || null;
  });

  const brandingStatus = (window as any).__BRANDING_STATUS__;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ownerId = params.get('o');
    if (ownerId) {
      // Si ya tenemos branding pre-cargado, no hace falta re-fetch
      if ((window as any).__SUCURSAL_BRANDING__) {
        setCompanyInfo((window as any).__SUCURSAL_BRANDING__);
        return;
      }

      supabase.from('empresas_holding').select('*').eq('id', ownerId).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setCompanyInfo(data);
            
            const iconUrl = data.url_favicon || data.url_logo;
            
            if (iconUrl) {
              applyDynamicManifest({
                name: data.nombre_comercial || data.nombre_empresa || 'SISLAV',
                shortName: (data.nombre_comercial || data.nombre_empresa || 'SISLAV').substring(0, 12),
                iconUrl,
                themeColor: data.color_primario || '#1A6EF5',
                backgroundColor: data.color_secundario || '#0d0f14',
                startUrl: window.location.href
              });
            }

            if (data.nombre_comercial || data.nombre_empresa) {
              document.title = `${data.nombre_comercial || data.nombre_empresa} - Panel de Propietario`;
            }
          }
        });
    }
  }, []);

  // Si se espera branding de owner pero aún está cargando
  if (!companyInfo && brandingStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center">
        <Loader2 className="animate-spin text-white/20" size={48} />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Si el usuario no ingresa @, asumimos el dominio corporativo por defecto
      const finalEmail = email.includes('@') ? email : `${email}@sislav.com`;
      console.log(`🔐 Intentando login de dueño para: ${finalEmail}`);
      
      const session = await dbOwnerAuth(finalEmail, password);

      if (session) {
        onLogin(session);
      } else {
        throw new Error('Esta cuenta no está registrada como Propietario de Empresa o credenciales inválidas.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const primaryColor = companyInfo?.color_primario || '#4f8ef7';
  const secondaryColor = companyInfo?.color_secundario || '#0f172a';

  return (
    <div 
      className={`min-h-screen flex items-center justify-center p-4 font-sans transition-colors duration-500 overflow-hidden relative ${isDarkMode ? 'bg-[#0d0f14]' : 'bg-slate-50'}`}
      style={{ 
        '--brand-primary': primaryColor,
        '--brand-secondary': secondaryColor
      } as React.CSSProperties}
    >
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-[120px] opacity-20 animate-pulse"
          style={{ backgroundColor: primaryColor }}
        />
        <div 
          className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-[120px] opacity-10"
          style={{ backgroundColor: primaryColor }}
        />
      </div>

      <div className="absolute top-8 right-8 z-10">
        <button 
          onClick={toggleTheme}
          className={`p-3 rounded-2xl border transition-all hover:scale-110 active:scale-95 ${isDarkMode ? 'bg-surface border-white/5 text-yellow-400 shadow-xl shadow-black/20' : 'bg-white border-gray-200 text-gray-600 shadow-lg shadow-gray-200/50'}`}
        >
          {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={`inline-flex items-center justify-center w-32 h-32 rounded-[2.5rem] border mb-8 shadow-2xl overflow-hidden transition-all relative group ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100'}`}
            style={{ borderColor: companyInfo?.color_primario ? `${companyInfo.color_primario}40` : undefined }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            {companyInfo?.url_favicon ? (
              <img src={companyInfo.url_favicon} className="w-full h-full object-contain p-7 transition-transform group-hover:scale-110 duration-500" alt="Favicon" />
            ) : companyInfo?.url_logo ? (
              <img src={companyInfo.url_logo} className="w-full h-full object-contain p-5 transition-transform group-hover:scale-110 duration-500" alt="Logo" />
            ) : (
              <ShieldCheck className="w-16 h-16 text-brand-primary" />
            )}
          </motion.div>
          
          <motion.h1 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`text-3xl md:text-5xl font-heading font-black mb-3 tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
          >
            {companyInfo?.nombre_empresa || 'SISLAV Corporativo'}
          </motion.h1>
          
          <motion.p 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`text-[10px] font-black ${isDarkMode ? 'text-text3' : 'text-slate-400'} uppercase tracking-[0.3em]`}
          >
            {companyInfo ? `Panel de Gestión Ejecutiva` : 'Acceso Restringido a Propietarios'}
          </motion.p>
        </div>

        <motion.div 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className={`rounded-[2.5rem] p-10 shadow-3xl border backdrop-blur-xl ${isDarkMode ? 'bg-surface/80 border-white/5 shadow-black/80' : 'bg-white/90 border-slate-100 shadow-slate-200/50'}`}
        >
          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-2">
              <label className={`block text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-text3' : 'text-slate-500'}`}>Usuario</label>
              <div className="relative group">
                <User className={`absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isDarkMode ? 'text-text3 group-focus-within:text-brand-primary' : 'text-slate-400 group-focus-within:text-brand-primary'}`} />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full border-2 rounded-2xl py-4.5 pl-14 pr-6 outline-none transition-all font-bold text-sm ${isDarkMode ? 'bg-black/20 border-white/5 text-white focus:border-brand-primary/50' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-brand-primary/30'}`}
                  placeholder="ID de Usuario"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={`block text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-text3' : 'text-slate-500'}`}>Contraseña Maestra</label>
              <div className="relative group">
                <Lock className={`absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isDarkMode ? 'text-text3 group-focus-within:text-brand-primary' : 'text-slate-400 group-focus-within:text-brand-primary'}`} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full border-2 rounded-2xl py-4.5 pl-14 pr-6 outline-none transition-all font-bold text-sm ${isDarkMode ? 'bg-black/20 border-white/5 text-white focus:border-brand-primary/50' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-brand-primary/30'}`}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-4 rounded-2xl text-xs font-bold border flex items-center gap-3 ${isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:brightness-110 disabled:opacity-50 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all group shadow-2xl shadow-brand-primary/30 uppercase tracking-[0.2em] text-[10px] active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Verificar Identidad
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </>
              )}
            </button>
          </form>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center flex flex-col items-center gap-5"
        >
          <div className="flex flex-col gap-1">
            <p className={`text-[9px] font-black uppercase tracking-[0.4em] ${isDarkMode ? 'text-text3' : 'text-slate-400'}`}>
              SISLAV ECOSYSTEM SECURITY
            </p>
            <p className={`text-[8px] font-black uppercase tracking-widest opacity-30 ${isDarkMode ? 'text-text3' : 'text-slate-400'}`}>
              BUILD {APP_VERSION}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href="https://wa.me/51931200353" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`flex items-center gap-3 px-6 py-2.5 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 ${isDarkMode ? 'bg-white/5 border-white/10 text-text2 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 shadow-sm'}`}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
              Soporte VIP
            </a>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

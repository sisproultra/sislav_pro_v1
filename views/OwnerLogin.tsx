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
      className={`min-h-screen flex items-center justify-center p-4 font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[#0d0f14] text-white' : 'bg-gray-50 text-gray-900'}`}
      style={{ 
        '--brand-primary': primaryColor,
        '--brand-secondary': secondaryColor
      } as React.CSSProperties}
    >
      <div className="absolute top-8 right-8">
        <button 
          onClick={toggleTheme}
          className={`p-3 rounded-2xl border transition-all ${isDarkMode ? 'bg-surface border-white/5 text-yellow-400' : 'bg-white border-gray-200 text-gray-600 shadow-sm'}`}
        >
          {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div 
            className={`inline-flex items-center justify-center w-28 h-28 rounded-[2rem] border mb-6 shadow-2xl overflow-hidden transition-all ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100'}`}
            style={{ borderColor: companyInfo?.color_primario ? `${companyInfo.color_primario}40` : undefined }}
          >
            {companyInfo?.url_favicon ? (
              <img src={companyInfo.url_favicon} className="w-full h-full object-contain p-6" alt="Favicon" />
            ) : companyInfo?.url_logo ? (
              <img src={companyInfo.url_logo} className="w-full h-full object-contain p-4" alt="Logo" />
            ) : (
              <ShieldCheck className="w-14 h-14 text-brand-primary" />
            )}
          </div>
          <h1 className={`text-3xl md:text-4xl font-heading font-black mb-2 uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {companyInfo?.nombre_empresa || 'Panel de Propietario'}
          </h1>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-text2' : 'text-gray-500'} uppercase tracking-widest opacity-80`}>
            {companyInfo ? `Acceso Corporativo` : 'Ingresa tus credenciales corporativas'}
          </p>
        </div>

        <div className={`rounded-3xl p-8 shadow-2xl border ${isDarkMode ? 'bg-surface border-white/5 shadow-black/50' : 'bg-white border-gray-100 shadow-gray-200/50'}`}>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-text2' : 'text-gray-600'}`}>Usuario Corporativo</label>
              <div className="relative group">
                <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isDarkMode ? 'text-text3 group-focus-within:text-brand-primary' : 'text-gray-400 group-focus-within:text-brand-primary'}`} />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full border rounded-xl py-4 pl-12 pr-4 outline-none transition-all font-medium ${isDarkMode ? 'bg-bg border-white/5 text-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'}`}
                  placeholder="usuario"
                />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-bold uppercase tracking-widest mb-2 ${isDarkMode ? 'text-text2' : 'text-gray-600'}`}>Contraseña</label>
              <div className="relative group">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isDarkMode ? 'text-text3 group-focus-within:text-brand-primary' : 'text-gray-400 group-focus-within:text-brand-primary'}`} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full border rounded-xl py-4 pl-12 pr-4 outline-none transition-all font-medium ${isDarkMode ? 'bg-bg border-white/5 text-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'}`}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-4 rounded-xl text-sm border ${isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-red-50 border-red-100 text-red-600'}`}
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:brightness-110 disabled:opacity-50 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all group shadow-lg shadow-brand-primary/20 uppercase tracking-widest text-xs"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Ingresar al Dashboard
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center flex flex-col items-center gap-3">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-text3' : 'text-gray-400'}`}>
            SISLAV - +51931200353
          </p>
          <p className={`text-[9px] font-black uppercase tracking-widest opacity-20 -mt-2 ${isDarkMode ? 'text-text3' : 'text-gray-400'}`}>
            Versión {APP_VERSION}
          </p>
          <a 
            href="https://wa.me/51931200353" 
            target="_blank" 
            rel="noopener noreferrer"
            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-text2 hover:bg-white/10 hover:text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Enviar Mensaje
          </a>
        </div>
      </motion.div>
    </div>
  );
}

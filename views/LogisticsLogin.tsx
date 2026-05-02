
import React, { useState } from 'react';
import { dbGlobalLogin } from '../services/dbService';
import { UserRole } from '../types';
import { ShieldCheck, Lock, User, Loader2, ArrowRight, Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';

interface LogisticsLoginProps {
  onLogin: (session: any) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  sucursal?: any;
}

import { applyDynamicManifest } from '../utils/pwaUtils';

export default function LogisticsLogin({ onLogin, isDarkMode, toggleTheme, sucursal }: LogisticsLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdingBranding, setHoldingBranding] = useState<any>(null);
  
  const [localSucursal, setLocalSucursal] = useState<any>(() => {
    return sucursal || (window as any).__SUCURSAL_BRANDING__ || null;
  });

  const brandingStatus = (window as any).__BRANDING_STATUS__;

  React.useEffect(() => {
    if (sucursal) setLocalSucursal(sucursal);
    else if ((window as any).__SUCURSAL_BRANDING__) setLocalSucursal((window as any).__SUCURSAL_BRANDING__);
  }, [sucursal]);

  const brandPrimary = localSucursal?.color_primario || '#4f8ef7';

  // Obtener branding del holding para el PWA de Delivery
  React.useEffect(() => {
    if (localSucursal?.empresa_holding_id || localSucursal?.id) {
       const idToFetch = localSucursal.empresa_holding_id || localSucursal.id;
       import('../services/dbService').then(db => {
         db.dbGetHoldingBranding(idToFetch).then(branding => {
            if (branding) {
              setHoldingBranding(branding);
              applyDynamicManifest({
                name: branding.nombre_comercial || branding.nombre_sucursal || 'SISLAV DELIVERY',
                shortName: (branding.nombre_comercial || branding.nombre_sucursal || 'SISLAV').substring(0, 12),
                iconUrl: branding.url_favicon_logistica || branding.url_favicon || branding.url_logo || localSucursal?.url_logo,
                themeColor: branding.color_primario || brandPrimary,
                backgroundColor: branding.color_secundario || '#0d0f14',
                startUrl: window.location.href
              });
            }
         });
       });
    }
  }, [localSucursal?.id, localSucursal?.empresa_holding_id]);

  // Si se espera branding pero aún está cargando
  if (!localSucursal && brandingStatus === 'loading') {
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
      if (!localSucursal?.id) {
        throw new Error('Sucursal no detectada para el acceso logístico.');
      }
      const session = await dbGlobalLogin(username, password, localSucursal.id);

      if (session) {
        if (session.user.role !== UserRole.DELIVERY) {
            throw new Error('Este acceso es exclusivo para Choferes de Logística.');
        }
        onLogin(session);
      } else {
        throw new Error('Usuario o contraseña incorrectos.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 font-sans transition-colors duration-300 ${isDarkMode ? 'bg-[#0d0f14] text-white' : 'bg-gray-50 text-gray-900'}`}>
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
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl border mb-4 shadow-xl overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100'}`} style={{ borderColor: brandPrimary + '40' }}>
            {localSucursal?.faviconLogisticaUrl || localSucursal?.url_favicon_logistica ? (
              <img src={localSucursal.faviconLogisticaUrl || localSucursal.url_favicon_logistica} alt="Logo" className="w-full h-full object-contain p-2" />
            ) : localSucursal?.url_logo ? (
              <img src={localSucursal.url_logo} alt="Logo" className="w-full h-full object-contain p-2" />
            ) : (
              <ShieldCheck className="w-10 h-10" style={{ color: brandPrimary }} />
            )}
          </div>
          <h1 className={`text-3xl font-heading font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {localSucursal?.nombre_sucursal || 'Panel de Logística'}
          </h1>
          <p className={isDarkMode ? 'text-text2' : 'text-gray-500'}>
            {localSucursal ? 'Acceso para Choferes y Delivery' : 'Acceso exclusivo para Choferes y Delivery'}
          </p>
        </div>

        <div className={`rounded-3xl p-8 shadow-2xl border ${isDarkMode ? 'bg-surface border-white/5 shadow-black/50' : 'bg-white border-gray-100 shadow-gray-200/50'}`}>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-text2' : 'text-gray-600'}`}>Usuario de Chofer</label>
              <div className="relative group">
                <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isDarkMode ? 'text-text3 group-focus-within:text-brand-primary' : 'text-gray-400 group-focus-within:text-brand-primary'}`} style={{ color: isDarkMode ? undefined : brandPrimary }} />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full border rounded-xl py-3 pl-12 pr-4 outline-none transition-all ${isDarkMode ? 'bg-bg border-white/5 text-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'}`}
                  style={{ '--brand-primary': brandPrimary } as any}
                  placeholder="usuario"
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-text2' : 'text-gray-600'}`}>PIN / Contraseña</label>
              <div className="relative group">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isDarkMode ? 'text-text3 group-focus-within:text-brand-primary' : 'text-gray-400 group-focus-within:text-brand-primary'}`} style={{ color: isDarkMode ? undefined : brandPrimary }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full border rounded-xl py-3 pl-12 pr-4 outline-none transition-all ${isDarkMode ? 'bg-bg border-white/5 text-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'}`}
                  style={{ '--brand-primary': brandPrimary } as any}
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
              className="w-full hover:brightness-110 disabled:opacity-50 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all group shadow-lg"
              style={{ background: brandPrimary }}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Iniciar Sesión
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
          <a 
            href="https://wa.me/51931200353" 
            target="_blank" 
            rel="noopener noreferrer"
            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-text2 hover:bg-white/10 hover:text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            WhatsApp Soporte
          </a>
        </div>
      </motion.div>
    </div>
  );
}

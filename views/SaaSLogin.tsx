import React, { useState, useEffect } from 'react';
import { Lock, User, ShieldCheck, Loader2, Store, ArrowRight, AlertTriangle, ShieldAlert, Sun, Moon } from 'lucide-react';
import { Sucursal } from '../types';

import { APP_VERSION } from '../components/VersionGuard';

interface SaaSLoginProps {
  onLogin: (u: string, p: string) => Promise<void>;
  sucursal: Sucursal | null;
  onGoToMasterLogin?: () => void;
  hideMasterAdmin?: boolean;
}

const SaaSLogin: React.FC<SaaSLoginProps> = ({ onLogin, sucursal, onGoToMasterLogin, hideMasterAdmin }) => {
  const [localSucursal, setLocalSucursal] = useState<any>(() => {
    return sucursal || (window as any).__SUCURSAL_BRANDING__ || null;
  });
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('sislav_login_theme');
    return saved === 'dark' ? true : false;
  });

  // Estados para recuperación de contraseñas por WhatsApp (Evolution API)
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [recoveryTempPassword, setRecoveryTempPassword] = useState('');

  const brandingStatus = (window as any).__BRANDING_STATUS__;

  useEffect(() => {
    if (sucursal) {
      setLocalSucursal(sucursal);
    } else if ((window as any).__SUCURSAL_BRANDING__) {
      setLocalSucursal((window as any).__SUCURSAL_BRANDING__);
    }
  }, [sucursal]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('sislav_login_theme', !isDarkMode ? 'dark' : 'light');
  };

  const brandPrimary = localSucursal?.color_primario || '#6366f1';
  const brandSecondary = localSucursal?.color_secundario || '#ec4899';

  // Si se espera branding pero aún está cargando el script del index.html, no mostrar nada genérico
  if (!localSucursal && brandingStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center">
        <Loader2 className="animate-spin text-white/20" size={48} />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await onLogin(user, pass);
      setFailedAttempts(0); // Reiniciar en login exitoso
    } catch (e: any) {
      const isExpiredTemp = e.message?.includes('EXPIRED_TEMP_PASSWORD');
      if (isExpiredTemp) {
        setError(e.message.replace('EXPIRED_TEMP_PASSWORD: ', ''));
      } else {
        setError(e.message || "Credenciales incorrectas");
      }
      setFailedAttempts(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-bg flex items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-500 ${!isDarkMode ? 'light-theme' : ''}`}>
      {/* Botón de cambio de tema */}
      <button
        onClick={toggleTheme}
        className={`absolute top-8 right-8 z-50 p-3 rounded-2xl ${isDarkMode ? 'bg-[#13161e]/40 border-white/10' : 'bg-white/40 border-black/5'} backdrop-blur-xl border text-text hover:scale-110 active:scale-95 transition-all shadow-lg`}
        title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      >
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Elementos ambientales de marca */}
      <div
        className={`absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] animate-pulse transition-opacity duration-500 ${isDarkMode ? 'opacity-20' : 'opacity-55'}`}
        style={{ background: brandPrimary }}
      ></div>
      <div
        className={`absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[150px] transition-opacity duration-500 ${isDarkMode ? 'opacity-10' : 'opacity-45'}`}
        style={{ background: brandSecondary }}
      ></div>

      <div className="max-w-md w-full relative z-10 group">
        {/* Glow effect post-hover */}
        <div
          className={`absolute inset-0 rounded-[3.5rem] blur-3xl transition-opacity duration-1000 ${isDarkMode ? 'opacity-20 group-hover:opacity-40' : 'opacity-40 group-hover:opacity-65'}`}
          style={{ background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})` }}
        ></div>

        <div className={`${isDarkMode ? 'bg-[#13161e]/40 border-white/5 group-hover:border-white/10' : 'bg-white/[0.04] border-black/5 group-hover:border-black/10'} backdrop-blur-3xl rounded-[3.5rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] relative border transition-all duration-700`}>
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
                {localSucursal?.url_logo ? (
                  <img src={localSucursal.url_logo} className="max-w-full h-auto object-contain drop-shadow-lg" alt="Logo" referrerPolicy="no-referrer" />
                ) : (
                  <Store size={56} style={{ color: brandPrimary }} />
                )}
              </div>
            </div>

            <h1 className="text-3xl font-display font-bold text-text uppercase tracking-tight leading-none mb-3 drop-shadow-sm">
              {localSucursal?.nombre_sucursal || 'SISLAV POWER'}
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
                  placeholder="usuario"
                  value={user}
                  onChange={e => setUser(e.target.value)}
                  className={`w-full ${isDarkMode ? 'bg-[#1a1e28]/50 focus:bg-[#13161e]' : 'bg-slate-200/40 focus:bg-white'} border border-text/10 rounded-2xl py-5 pl-14 pr-4 text-text outline-none focus:ring-2 transition-all font-bold placeholder:text-text3`}
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
                  className={`w-full ${isDarkMode ? 'bg-[#1a1e28]/50 focus:bg-[#13161e]' : 'bg-slate-200/40 focus:bg-white'} border border-text/10 rounded-2xl py-5 pl-14 pr-4 text-text outline-none focus:ring-2 transition-all font-bold placeholder:text-text3`}
                  style={{ '--tw-ring-color': brandPrimary } as any}
                />
              </div>
            </div>

            {error && (
              <div className="text-rose-500 text-[10px] font-bold uppercase text-center bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 animate-in slide-in-from-top-2">
                <AlertTriangle className="inline mr-2 mb-0.5" size={12} /> {error}
              </div>
            )}

            {failedAttempts >= 3 && (
              <div className="flex justify-center pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryUsername(user);
                    setRecoveryError('');
                    setRecoverySuccess('');
                    setShowRecoveryModal(true);
                  }}
                  className="px-5 py-2.5 rounded-xl border-2 border-dashed border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-500 hover:text-red-400 text-[10px] font-extrabold uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                >
                  <Lock size={12} className="animate-pulse text-red-500" />
                  ¿Me olvidé mi contraseña?
                </button>
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

        <div className="mt-8 text-center flex flex-col items-center gap-3">
          <p className="text-text3 text-[10px] font-bold uppercase tracking-widest">
            SISLAV - +51931200353
          </p>
          <p className="text-text3 text-[9px] font-black uppercase tracking-widest opacity-20 -mt-2">
            Versión {APP_VERSION}
          </p>
          <a 
            href="https://wa.me/51931200353" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-text3 hover:bg-white/10 hover:text-text2 text-[9px] font-bold uppercase tracking-widest transition-all"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            SOPORTE WHATSAPP
          </a>
        </div>
      </div>

      {/* MODAL DE RECUPERACIÓN DE CONTRASEÑA POR WHATSAPP */}
      {showRecoveryModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-bg2 border border-text/10 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div 
              className="h-1.5 w-full"
              style={{ background: `linear-gradient(90deg, ${brandPrimary}, ${brandSecondary})` }}
            />
            
            <div className="p-8">
              <h2 className="text-lg font-bold text-text uppercase tracking-tight text-center mb-1">Recuperar Contraseña</h2>
              <p 
                className="text-[8px] font-bold uppercase tracking-widest text-center mb-6"
                style={{ color: brandPrimary }}
              >
                Envío seguro por WhatsApp
              </p>
              
              {recoverySuccess ? (
                <div className="space-y-6 text-center py-2">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg animate-bounce"
                    style={{ 
                      background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})`,
                      boxShadow: `0 10px 20px -5px ${brandPrimary}80`
                    }}
                  >
                    <ShieldCheck size={28} />
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-text uppercase tracking-wide">¡Contraseña temporal generada!</p>
                    
                    {recoveryTempPassword ? (
                      <div className="space-y-3">
                        <p className="text-xs text-text2 leading-relaxed">
                          Debido a que tu usuario no cuenta con un número de WhatsApp registrado, o el bot está temporalmente inactivo, tu contraseña temporal se muestra directamente aquí:
                        </p>
                        <div className="bg-bg3 border border-text/10 p-4 rounded-xl font-mono text-2xl font-extrabold tracking-widest inline-block select-all" style={{ color: brandPrimary }}>
                          {recoveryTempPassword}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-text2 leading-relaxed">
                        Se ha enviado un mensaje con tu contraseña de 5 dígitos al WhatsApp registrado: <span className="font-extrabold font-mono text-sm" style={{ color: brandPrimary }}>{recoverySuccess}</span>
                      </p>
                    )}
                    
                    <p className="text-[10px] text-text2 bg-bg3/60 p-3 rounded-xl border border-text/5 leading-normal mt-2">
                      ⚠️ Esta contraseña momentánea es válida por <span className="font-bold" style={{ color: brandSecondary }}>10 minutos</span>. Al entrar, el sistema te forzará a actualizarla por una propia.
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecoveryModal(false);
                      setPass('');
                      setRecoveryTempPassword('');
                      setRecoverySuccess('');
                      setRecoveryUsername('');
                    }}
                    className="w-full py-4 bg-bg3 hover:bg-bg3/80 text-text font-bold text-[10px] uppercase tracking-widest transition-all rounded-xl border border-text/5 active:scale-95"
                  >
                    Entendido, Volver
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[11px] text-text2 leading-relaxed text-center">
                    Ingresa tu nombre de usuario para recibir automáticamente una contraseña momentánea (1 Letra Mayúscula + 4 Números) vía WhatsApp.
                  </p>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-text3 uppercase tracking-widest ml-1">Usuario</label>
                    <div className="relative group/rec">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text3 group-focus-within/rec:text-brand-primary transition-colors" size={16} />
                      <input
                        type="text"
                        required
                        placeholder="ej: pepe"
                        value={recoveryUsername}
                        onChange={e => setRecoveryUsername(e.target.value.toLowerCase().trim())}
                        className="w-full bg-bg3/50 border border-text/10 rounded-xl py-3.5 pl-11 pr-4 text-text outline-none focus:ring-2 transition-all font-bold placeholder:text-text3 text-xs text-center"
                        style={{ '--tw-ring-color': brandPrimary } as any}
                      />
                    </div>
                  </div>
                  
                  {recoveryError && (
                    <div className="text-rose-500 text-[10px] font-bold uppercase text-center bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 leading-normal">
                      <AlertTriangle className="inline mr-1 mb-0.5" size={10} /> {recoveryError}
                    </div>
                  )}
                  
                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      disabled={recoveryLoading}
                      onClick={() => {
                        setShowRecoveryModal(false);
                        setRecoveryTempPassword('');
                        setRecoverySuccess('');
                        setRecoveryUsername('');
                        setRecoveryError('');
                      }}
                      className="flex-1 py-3 bg-bg3 hover:bg-bg3/80 text-text2 rounded-xl border border-text/5 font-bold text-[9px] uppercase tracking-widest transition-all active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={recoveryLoading}
                      onClick={async () => {
                        if (!recoveryUsername) {
                          setRecoveryError('Ingresa tu nombre de usuario.');
                          return;
                        }
                        
                        setRecoveryLoading(true);
                        setRecoveryError('');
                        
                        try {
                          const res = await fetch('/api/auth/recover-password', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              username: recoveryUsername,
                              sucursalId: localSucursal?.id
                            })
                          });
                          
                          const data = await res.json();
                          if (res.ok && data.success) {
                            if (data.tempPassword) {
                              setRecoveryTempPassword(data.tempPassword);
                            }
                            setRecoverySuccess(data.maskedPhone || 'Registrado');
                          } else {
                            setRecoveryError(data.error || 'No se pudo procesar la solicitud.');
                          }
                        } catch (err: any) {
                          console.error("Recovery err:", err);
                          setRecoveryError('Error de red. Intenta nuevamente.');
                        } finally {
                          setRecoveryLoading(false);
                        }
                      }}
                      className="flex-1 py-3 text-white rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95"
                      style={{ 
                        background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})`,
                        boxShadow: `0 10px 20px -5px ${brandPrimary}50`
                      }}
                    >
                      {recoveryLoading ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        'Recuperar'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaaSLogin;

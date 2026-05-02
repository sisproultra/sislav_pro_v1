import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PWAInstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [branding, setBranding] = useState<{name: string, icon: string}>({
        name: 'SISLAV',
        icon: '/icons/icon-192.png'
    });

    useEffect(() => {
        // Verificar si ya está instalada
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        if (isStandalone) return;

        // Detectar iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(ios);

        // Esperar a que el branding esté listo
        const checkBranding = setInterval(() => {
            const s = (window as any).__SUCURSAL_BRANDING__;
            if (s) {
                const isLogistica = window.location.pathname.includes('/logistica');
                setBranding({
                    name: s.nombre_comercial || s.nombre_sucursal || s.nombre_empresa || 'SISLAV',
                    icon: isLogistica 
                        ? (s.url_favicon_logistica || s.url_favicon || s.url_logo || '/icons/icon-192.png')
                        : (s.url_favicon || s.url_logo || '/icons/icon-192.png')
                });
                clearInterval(checkBranding);
            }
        }, 500);

        // Evento estándar para Android / Chrome / Windows
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Mostrar después de 3 segundos
            setTimeout(() => {
                const dismissed = localStorage.getItem('pwa_prompt_dismissed');
                const lastDismissTime = localStorage.getItem('pwa_prompt_dismissed_time');
                const now = Date.now();
                
                // Si se cerró hace menos de 24 horas, no mostrar
                if (dismissed === 'true' && lastDismissTime && (now - parseInt(lastDismissTime)) < 24 * 60 * 60 * 1000) {
                    return;
                }
                
                setIsVisible(true);
            }, 3000);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // FALLBACK: Si después de 8 segundos no se disparó beforeinstallprompt y es móvil, mostrar igual
        // Esto ayuda en casos donde el browser es compatible pero el evento es inconsistente
        setTimeout(() => {
            const isMobile = /android|iphone|ipad|ipod/.test(userAgent);
            if (isMobile && !deferredPrompt) {
                const dismissed = localStorage.getItem('pwa_prompt_dismissed');
                const lastDismissTime = localStorage.getItem('pwa_prompt_dismissed_time');
                const now = Date.now();
                
                if (dismissed === 'true' && lastDismissTime && (now - parseInt(lastDismissTime)) < 24 * 60 * 60 * 1000) {
                    return;
                }
                setIsVisible(true);
            }
        }, 8000);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            clearInterval(checkBranding);
        };
    }, [deferredPrompt]);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setIsVisible(false);
            }
            setDeferredPrompt(null);
        } else {
            // Si no hay deferredPrompt, mostramos alerta con instrucciones
            alert('Para instalar:\n1. Toca los tres puntos (⋮) o el icono de compartir\n2. Selecciona "Instalar aplicación" o "Añadir a pantalla de inicio"');
        }
    };

    const dismissPrompt = () => {
        setIsVisible(false);
        localStorage.setItem('pwa_prompt_dismissed', 'true');
        localStorage.setItem('pwa_prompt_dismissed_time', Date.now().toString());
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    className="fixed top-0 left-0 right-0 z-[9999] p-4 flex justify-center pointer-events-none"
                >
                    <div className="w-full max-w-xl bg-white/95 backdrop-blur-xl border-2 border-indigo-500/20 shadow-[0_20px_50px_rgba(79,70,229,0.2)] rounded-3xl p-4 flex items-center gap-4 pointer-events-auto overflow-hidden relative">
                        {/* Decoración de fondo */}
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
                        
                        <div className="bg-indigo-600 p-0.5 rounded-2xl shadow-lg relative shrink-0">
                            <img 
                                src={branding.icon} 
                                alt={branding.name} 
                                className="w-12 h-12 rounded-[14px] object-cover bg-white"
                                onError={(e) => (e.currentTarget.src = '/icons/icon-192.png')}
                            />
                            <div className="absolute -right-1 -bottom-1 bg-white rounded-full p-1 shadow-md">
                                <Download size={10} className="text-indigo-600" />
                            </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <h3 className="text-[13px] font-black text-slate-900 leading-tight uppercase tracking-tight flex items-center gap-1.5">
                                Instalar {branding.name}
                                <span className="bg-indigo-100 text-indigo-700 text-[8px] px-1.5 py-0.5 rounded-full font-bold">RECOMENDADO</span>
                            </h3>
                            <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                {isIOS 
                                    ? 'Pulsa compartir y luego "Añadir a pantalla de inicio"' 
                                    : 'Acceso directo, más rápido y seguro.'}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {!isIOS && (
                                <button
                                    onClick={handleInstall}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-[11px] font-black transition-all active:scale-95 shadow-lg shadow-indigo-200 uppercase"
                                >
                                    INSTALAR
                                </button>
                            )}
                            {isIOS && (
                                <div className="text-indigo-600 animate-bounce p-2 bg-indigo-50 rounded-xl">
                                    <Share size={20} />
                                </div>
                            )}
                            <button
                                onClick={dismissPrompt}
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

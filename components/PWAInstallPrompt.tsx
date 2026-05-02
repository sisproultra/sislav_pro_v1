import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const PWAInstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Verificar si ya está instalada
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        if (isStandalone) return;

        // Detectar iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(ios);

        // Evento estándar para Android / Chrome / Windows
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Mostrar después de 3 segundos para no interrumpir la carga inicial
            setTimeout(() => {
                const dismissed = sessionStorage.getItem('pwa_prompt_dismissed');
                if (!dismissed) setIsVisible(true);
            }, 3000);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Si es iOS, mostrar de todas formas después de un tiempo
        if (ios) {
            setTimeout(() => {
                const dismissed = sessionStorage.getItem('pwa_prompt_dismissed');
                if (!dismissed) setIsVisible(true);
            }, 5000);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setIsVisible(false);
            }
            setDeferredPrompt(null);
        }
    };

    const dismissPrompt = () => {
        setIsVisible(false);
        sessionStorage.setItem('pwa_prompt_dismissed', 'true');
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
                    <div className="w-full max-w-xl bg-white/90 backdrop-blur-md border border-indigo-100 shadow-2xl rounded-2xl p-4 flex items-center gap-4 pointer-events-auto">
                        <div className="bg-indigo-600 p-3 rounded-xl text-white">
                            <Download size={24} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">Instalar Sistema SISLAV</h3>
                            <p className="text-[11px] text-slate-500 font-medium">
                                {isIOS 
                                    ? 'Toca el icono de compartir y luego "Añadir a pantalla de inicio"' 
                                    : 'Accede más rápido y trabaja sin interrupciones.'}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            {!isIOS && (
                                <button
                                    onClick={handleInstall}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-colors shadow-lg shadow-indigo-200"
                                >
                                    INSTALAR
                                </button>
                            )}
                            {isIOS && (
                                <div className="text-indigo-600 animate-bounce">
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

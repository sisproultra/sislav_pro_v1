import React, { useState, useEffect } from 'react';
import { RefreshCcw, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/dbService'; 
import { motion, AnimatePresence } from 'motion/react';

export const APP_VERSION = '1.3.0';

export const VersionGuard: React.FC = () => {
    const [isOutdated, setIsOutdated] = useState(false);
    const [minVersion, setMinVersion] = useState('');
    const [loading, setLoading] = useState(true);

    const versionToNumber = (v: string) => {
        const parts = v.split('.');
        const major = parseInt(parts[0]) || 0;
        const minor = parseInt(parts[1]) || 0;
        const patch = parseInt(parts[2]) || 0;
        return major * 10000 + minor * 100 + patch;
    };

    useEffect(() => {
        const checkVersion = async () => {
            console.log("Checking version... Code:", APP_VERSION);
            try {
                const { data } = await supabase
                    .from('app_config')
                    .select('value')
                    .eq('key', 'min_required_version')
                    .single();

                const required = data?.value || APP_VERSION;
                setMinVersion(required);
                
                console.log("DB Required Version:", required);
                
                if (versionToNumber(APP_VERSION) < versionToNumber(required)) {
                    console.warn("OUTDATED VERSION DETECTED!");
                    setIsOutdated(true);
                } else {
                    console.log("Version is up to date.");
                    setIsOutdated(false);
                }
            } catch (err) {
                console.error('Error inicial de versión:', err);
            } finally {
                setLoading(false);
            }
        };

        checkVersion();

        const subscription = supabase
            .channel('app_config_changes')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'app_config',
                filter: 'key=eq.min_required_version'
            }, (payload: any) => {
                const newVal = payload?.new?.value;
                if (!newVal) return;
                
                console.log("Realtime version update detected:", newVal);
                setMinVersion(newVal);
                if (versionToNumber(APP_VERSION) < versionToNumber(newVal)) {
                    setIsOutdated(true);
                } else {
                    setIsOutdated(false);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, []);

    const handleUpdate = async () => {
        try {
            // 1. Eliminar Service Workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
            }

            // 2. Limpiar Caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const name of cacheNames) {
                    await caches.delete(name);
                }
            }

            // 3. Hard Reload con Bypass de Cache mediante parámetro único
            const url = new URL(window.location.href);
            url.searchParams.set('reload_v', Date.now().toString());
            window.location.href = url.toString();
        } catch (e) {
            console.error("Error en hard reload:", e);
            window.location.reload();
        }
    };

    if (loading || !isOutdated) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[10000] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl text-center border border-slate-100"
                >
                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="text-amber-500 w-10 h-10" />
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight">
                        Actualización Obligatoria
                    </h2>
                    
                    <div className="mt-4 space-y-3">
                        <p className="text-slate-500 text-sm font-medium leading-relaxed">
                            Estás usando la versión <span className="text-indigo-600 font-bold">{APP_VERSION}</span>. 
                            Se requiere la versión <span className="text-slate-900 font-bold">{minVersion}</span> para continuar garantizando la seguridad de tus datos.
                        </p>
                    </div>

                    <div className="mt-8 space-y-4">
                        <button
                            onClick={handleUpdate}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95"
                        >
                            <RefreshCcw size={18} />
                            ACTUALIZAR AHORA
                        </button>
                        
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            SISLAV PRO — V1.0
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

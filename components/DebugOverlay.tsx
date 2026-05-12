
import React, { useState, useEffect } from 'react';
import { AlertCircle, Terminal, X, CheckCircle2, Bug } from 'lucide-react';
import { dbLogSystemError } from '../services/dbService';

interface DebugLog {
    id: string;
    type: 'error' | 'info' | 'success';
    message: string;
    timestamp: string;
    details?: any;
}

export const DebugOverlay: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [logs, setLogs] = useState<DebugLog[]>([]);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('debug') === 'true') {
            setIsVisible(true);
        }

        // Interceptar console.error
        const originalError = console.error;
        console.error = (...args: any[]) => {
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            
            // Usar setTimeout para evitar "Cannot update a component while rendering a different component"
            // si el error ocurre durante un ciclo de renderizado de React
            setTimeout(() => {
                addLog('error', message, args[1]);
            }, 0);
            
            // Persistir en base de datos de forma asíncrona
            dbLogSystemError(message, args[1]);
            
            originalError.apply(console, args);
        };

        // Interceptar errores no controlados
        const handleError = (event: ErrorEvent) => {
            addLog('error', event.message);
        };
        window.addEventListener('error', handleError);

        return () => {
            console.error = originalError;
            window.removeEventListener('error', handleError);
        };
    }, []);

    const addLog = (type: 'error' | 'info' | 'success', message: string, details?: any) => {
        const newLog: DebugLog = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            message,
            timestamp: new Date().toLocaleTimeString(),
            details
        };
        setLogs(prev => [newLog, ...prev].slice(0, 50));
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999]">
            {!isOpen ? (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="bg-slate-900 text-white p-3 rounded-full shadow-2xl border border-indigo-500/50 hover:scale-110 transition-all animate-pulse"
                >
                    <Bug size={24} />
                    {logs.filter(l => l.type === 'error').length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {logs.filter(l => l.type === 'error').length}
                        </span>
                    )}
                </button>
            ) : (
                <div className="bg-slate-900 border border-white/10 w-96 h-[500px] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-800/50">
                        <div className="flex items-center gap-2">
                            <Terminal size={18} className="text-indigo-400" />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-white">Consola de Diagnóstico</h3>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {logs.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                                <CheckCircle2 size={32} className="opacity-20" />
                                <p className="text-[10px] font-bold uppercase">Sin errores detectados</p>
                            </div>
                        )}
                        {logs.map(log => (
                            <div key={log.id} className={`p-3 rounded-xl border text-[10px] font-mono break-all ${
                                log.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                                log.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                'bg-white/5 border-white/10 text-slate-300'
                            }`}>
                                <div className="flex justify-between mb-1 opacity-50">
                                    <span>[{log.timestamp}]</span>
                                    <span className="uppercase font-bold">{log.type}</span>
                                </div>
                                <p>{log.message}</p>
                                {log.details && (
                                    <pre className="mt-2 p-2 bg-black/30 rounded-lg overflow-x-auto">
                                        {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-3 border-t border-white/5 bg-slate-800/30 flex justify-between items-center">
                        <button 
                            onClick={() => setLogs([])}
                            className="text-[9px] font-bold uppercase text-slate-500 hover:text-white transition-colors"
                        >
                            Limpiar Logs
                        </button>
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">
                            Debug Mode Active
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

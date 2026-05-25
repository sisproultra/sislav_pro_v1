import React from 'react';

export const ModuleLoadingSkeleton: React.FC = () => {
  return (
    <div className="h-full w-full flex flex-col bg-slate-50 dark:bg-slate-900/40 animate-fade-in">
      {/* Indicador superior fino de carga (tipo YouTube / GitHub) */}
      <div className="fixed top-0 left-0 w-full h-[3px] bg-slate-100 dark:bg-slate-800 z-[9999] overflow-hidden">
        <div 
          className="h-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]"
          style={{
            width: '100%',
            animation: 'loaderProgress 2s infinite ease-in-out',
            transformOrigin: '0% 50%',
          }}
        />
      </div>
      
      {/* Estilos inline autocontenidos para la barra de progreso */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes loaderProgress {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.65); }
          100% { transform: scaleX(1); }
        }
      `}} />

      {/* Header del Módulo (Skeleton) */}
      <div className="shrink-0 h-16 border-b border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-900 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          {/* Inputs y botones del header del módulo */}
          <div className="h-9 w-40 bg-slate-100 dark:bg-slate-800/80 rounded-lg animate-pulse hidden sm:block" />
          <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Contenido del Módulo (Skeleton) */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* Fila de Tarjetas Resumen (Kpis) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Sección de Tabla / Grid Principal de datos */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800/40 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
          
          <div className="p-5 space-y-4">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0 dark:border-slate-800/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse shrink-0" />
                  <div className="space-y-2">
                    <div className="h-3.5 w-36 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="h-2.5 w-24 bg-slate-100 dark:bg-slate-800/50 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-3 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse hidden md:block" />
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModuleLoadingSkeleton;

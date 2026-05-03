
import React, { useState, useEffect } from 'react';
import { X, Search, ExternalLink, Youtube, Play, Video, Sparkles, Info, Loader2 } from 'lucide-react';
import { GlobalHelpVideo } from '../types';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos?: GlobalHelpVideo[];
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, videos = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<GlobalHelpVideo | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  const brandPrimary = document.documentElement.style.getPropertyValue('--brand-primary').trim() || '#0054A6';

  const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleSelectVideo = (video: GlobalHelpVideo) => {
    setIsVideoLoading(true);
    setSelectedVideo(video);
  };

  if (!isOpen) return null;

  const filteredVideos = videos.filter(video =>
    (video.title?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-white z-[300] flex flex-col animate-in fade-in duration-300">
      
      {/* HEADER COMPACTO FULLSCREEN */}
      <div className="relative p-5 md:p-6 text-white shrink-0 overflow-hidden shadow-xl z-10" style={{ backgroundColor: brandPrimary }}>
          {/* Decoración de fondo más discreta */}
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none rotate-12 scale-110">
              <Youtube size={180} />
          </div>
          
          <div className="max-w-[1600px] mx-auto w-full">
            <div className="flex justify-between items-center relative z-10 mb-5">
                <div className="flex items-center gap-4">
                    <div className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg">
                        <Sparkles size={24} className="text-yellow-300 animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold uppercase tracking-tight leading-none">Sislav Academy</h2>
                        <div className="flex items-center gap-2 mt-1">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"></div>
                           <p className="text-white/70 text-[9px] font-bold uppercase tracking-widest">Tutoriales de Dominio Total</p>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-2.5 bg-black/20 hover:bg-white/20 rounded-full transition-all active:scale-90 border border-white/10">
                    <X size={24} />
                </button>
            </div>

            <div className="relative z-10 max-w-xl">
                <div className="relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-indigo-600 transition-colors" size={18} />
                    <input 
                        type="text"
                        placeholder="Buscar tutorial (Ej: ventas, caja)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/10 border-2 border-white/10 rounded-2xl py-3.5 pl-14 pr-6 text-white placeholder:text-white/30 focus:bg-white focus:text-slate-900 focus:outline-none transition-all shadow-lg font-bold uppercase text-[10px] tracking-widest"
                        autoFocus
                    />
                </div>
            </div>
          </div>
      </div>

      {/* ÁREA DE CONTENIDO MAXIMIZADA */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-[#f8fafc] custom-scrollbar">
        <div className="max-w-[1600px] mx-auto">
          {filteredVideos.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 md:gap-8">
              {filteredVideos.map((video, idx) => {
                const ytId = getYouTubeId(video.youtubeUrl);
                const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=400&auto=format&fit=crop';
                
                return (
                  <div 
                    key={video.id || idx}
                    className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden hover:border-indigo-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all group flex flex-col animate-in slide-in-from-bottom-4 relative"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <div className="relative aspect-video overflow-hidden bg-slate-900 shrink-0">
                        <img 
                            src={thumbUrl} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                            alt={video.title} 
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (ytId) target.src = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
                            }}
                        />
                        <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors"></div>
                        
                        <div className="absolute inset-0 flex items-center justify-center">
                            <button 
                                onClick={() => handleSelectVideo(video)}
                                className="bg-white/95 p-4 rounded-full shadow-2xl transform transition-all group-hover:scale-110 group-active:scale-95 flex items-center justify-center ring-8 ring-white/10"
                            >
                                <Play size={22} className="text-slate-900 ml-1" fill="currentColor" />
                            </button>
                        </div>
                        
                        <div className="absolute top-4 right-4 bg-red-600 px-3 py-1 rounded-full text-[8px] font-bold text-white uppercase tracking-widest shadow-lg border border-red-500">
                            VIDEO
                        </div>
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                        <h4 className="font-bold text-slate-800 text-xs md:text-sm uppercase leading-tight tracking-tight group-hover:text-indigo-600 transition-colors line-clamp-2 mb-4">
                            {video.title}
                        </h4>
                        
                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-lg">
                                {video.category || 'GENERAL'}
                            </span>
                            <button 
                                onClick={() => handleSelectVideo(video)}
                                className="text-slate-400 hover:text-indigo-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-widest"
                            >
                                VER CLASE <ExternalLink size={10} />
                            </button>
                        </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-40 text-center flex flex-col items-center gap-6">
              <div className="p-10 bg-white rounded-full shadow-inner border border-slate-100">
                <Search size={64} className="text-slate-100" />
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-slate-400 uppercase tracking-tight">Sin resultados para tu búsqueda</p>
                <p className="text-sm font-medium text-slate-300 uppercase tracking-widest">Intenta con palabras clave como "Venta", "Caja" o "Personal".</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER MINIMALISTA */}
      <div className="p-4 border-t border-slate-100 bg-white flex justify-center items-center gap-10 shrink-0">
          <div className="flex items-center gap-3">
            <Info size={14} className="text-indigo-500" />
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.4em]">
               Academy v1.5 • Realtime Cloud Knowledge Base
            </p>
          </div>
      </div>

      {/* REPRODUCTOR DE VIDEO INTEGRADO (MODAL SOBRE EL MODAL) */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-slate-950/95 z-[400] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300 backdrop-blur-sm">
            <div className="w-full max-w-6xl aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border-4 relative" style={{ borderColor: brandPrimary }}>
                {/* Botón Cerrar Video */}
                <button 
                    onClick={() => setSelectedVideo(null)}
                    className="absolute top-6 right-6 z-50 p-3 bg-white text-slate-900 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all"
                >
                    <X size={24} />
                </button>

                {/* Loader / Pantalla de Carga */}
                {isVideoLoading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900 animate-in fade-in duration-300">
                        <Loader2 
                            size={60} 
                            style={{ color: brandPrimary }} 
                            className="animate-spin mb-4 drop-shadow-[0_0_15px_rgba(30,58,138,0.5)]" 
                        />
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.4em] animate-pulse">Cargando Tutorial...</p>
                    </div>
                )}

                {/* Header del Video */}
                <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-bottom from-black/80 to-transparent z-40 pointer-events-none">
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.3em] mb-1">REPRODUCIENDO CLASE</p>
                    <h3 className="text-lg md:text-xl font-bold text-white uppercase tracking-tight line-clamp-1">{selectedVideo.title}</h3>
                </div>

                {/* Iframe de YouTube */}
                <iframe 
                    src={`https://www.youtube.com/embed/${getYouTubeId(selectedVideo.youtubeUrl)}?autoplay=1&modestbranding=1&rel=0`}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={selectedVideo.title}
                    onLoad={() => setIsVideoLoading(false)}
                ></iframe>

                {/* Decoración inferior */}
                <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: brandPrimary }}></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default HelpModal;

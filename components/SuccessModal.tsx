
import React from 'react';
import { CheckCircle2, ArrowRight, X } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  title?: string;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, onClose, message, title = "¡Guardado con éxito!" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[3.5rem] w-full max-w-sm shadow-[0_0_80px_rgba(0,0,0,0.4)] overflow-hidden border border-white/20 flex flex-col items-center text-center p-12 transform animate-in zoom-in-95">
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 transition-colors"
        >
          <X size={24} />
        </button>
        
        <div className="bg-emerald-100 text-emerald-600 p-8 rounded-full mb-10 ring-[12px] ring-emerald-50">
          <CheckCircle2 size={72} strokeWidth={2.5} className="animate-bounce" />
        </div>
        
        <h4 className="text-3xl font-bold text-slate-900 mb-3 uppercase tracking-tight leading-none">
          {title}
        </h4>
        
        <p className="text-base text-slate-500 font-bold leading-tight mb-10">
          {message}
        </p>
        
        <button 
          onClick={onClose} 
          className="w-full bg-slate-900 hover:bg-black text-white font-bold py-5 rounded-3xl transition-all shadow-2xl active:scale-95 uppercase tracking-[0.25em] text-[10px] flex items-center justify-center gap-2"
        >
          CONTINUAR <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default SuccessModal;

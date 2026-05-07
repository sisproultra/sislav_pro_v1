
import React from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isDangerous = false,
  isLoading = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-md">
      <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden transform transition-all scale-100 border border-white/20">
        
        {/* Header */}
        <div className={`px-6 py-4 flex items-center gap-3 ${isDangerous ? 'bg-red-50 border-b border-red-100' : 'bg-gray-50 border-b border-gray-100'}`}>
          <div className={`p-2 rounded-xl ${isDangerous ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            {isLoading ? <Loader2 size={24} className="animate-spin" /> : <AlertTriangle size={24} />}
          </div>
          <h3 className={`text-lg font-bold uppercase tracking-tight ${isDangerous ? 'text-red-700' : 'text-gray-800'}`}>
            {title}
          </h3>
          <button onClick={onClose} disabled={isLoading} className="ml-auto text-gray-400 hover:text-gray-600 p-1 hover:bg-white/50 rounded-full transition-colors disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 text-slate-600 text-sm font-medium leading-relaxed">
          {message}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-5 flex justify-end gap-3 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 font-bold text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={async () => {
              await onConfirm();
              if (!isLoading) onClose();
            }}
            disabled={isLoading}
            className={`px-8 py-3 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
              isDangerous 
                ? 'bg-red-600 hover:bg-red-700 shadow-red-100' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
            } disabled:opacity-50`}
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {isLoading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;

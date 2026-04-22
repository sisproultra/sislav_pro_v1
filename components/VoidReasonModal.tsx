
import React, { useState } from 'react';
import { X, FileWarning } from 'lucide-react';

interface VoidReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const VoidReasonModal: React.FC<VoidReasonModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason);
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-orange-50 border-b border-orange-100 p-4 flex justify-between items-center">
          <h3 className="font-bold text-orange-800 flex items-center gap-2">
            <FileWarning size={20} /> Anular Comprobante
          </h3>
          <button onClick={onClose} className="text-orange-400 hover:text-orange-700">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-700 mb-4">
              <strong>Importante:</strong> Se generará automáticamente una <u>Nota de Crédito</u> electrónica para anular la validez fiscal del comprobante original.
            </div>
            
            <label className="block text-sm font-bold text-gray-700 mb-2">Motivo de la anulación <span className="text-red-500">*</span></label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none h-24"
              placeholder="Ej: Error en el precio, Devolución de item, Error en RUC..."
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!reason.trim()}
              className="px-4 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Confirmar Anulación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VoidReasonModal;

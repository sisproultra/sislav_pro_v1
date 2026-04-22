import React, { useState, useMemo, useEffect } from 'react';
import { Product, Company, Client } from '../types';
import { Plus, MapPin, Phone, Mail, Calendar, User, Building2, Edit, Crown, AlertTriangle, Search, X, ChevronLeft, ChevronRight, Loader2, Info, Database, Trash2 } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';

interface ClientsProps {
  clients: Client[];
  total: number;
  currentPage: number;
  onPageChange: (page: number, search: string) => void;
  onSearch: (page: number, search: string) => void;
  company?: Company;
  onOpenModal: () => void;
  onEdit: (client: Client | null) => void;
  onDelete: (id: string) => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const Clients: React.FC<ClientsProps> = ({ 
    clients = [], 
    total,
    currentPage,
    onPageChange,
    onSearch,
    company, 
    onOpenModal, 
    onEdit, 
    onDelete,
    canCreate = true,
    canEdit = true,
    canDelete = true 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (isSearching) {
        onSearch(1, searchTerm);
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, onSearch, isSearching]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsSearching(true);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    onSearch(1, '');
  };

  const totalPages = Math.ceil(total / 100); // 100 is the pageSize in App.tsx
  const currentItems = clients;

  const formatDateSafe = (dateStr?: string) => {
      if (!dateStr || typeof dateStr !== 'string' || dateStr === '-') return '-';
      try {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
              const [year, month, day] = parts.map(Number);
              const d = new Date(year, month - 1, day);
              return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
          }
          return dateStr;
      } catch (e) {
          return '-';
      }
  };

  const handleWhatsAppClick = (phone?: string) => {
    if (!phone) {
        alert("El cliente no tiene un número de teléfono registrado.");
        return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  return (
    <div className="p-4 lg:p-6 h-full flex flex-col bg-gray-50 overflow-hidden">
      <div className="max-w-full mx-auto w-full space-y-4 flex-1 flex flex-col overflow-hidden px-2">
        
        <ConfirmationModal 
            isOpen={!!clientToDelete}
            onClose={() => setClientToDelete(null)}
            onConfirm={() => { if (clientToDelete) { onDelete(clientToDelete); setClientToDelete(null); } }}
            title="Eliminar Cliente"
            message={<p className="font-bold text-slate-800">¿Desea eliminar este cliente de la cartera? No podrá ser recuperado desde el panel.</p>}
            confirmText="Sí, Eliminar"
            isDangerous={true}
        />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 px-2">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
               <User className="text-indigo-600" /> Cartera de Clientes
            </h2>
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                <Database size={10} /> BRANCH ID: <span className="text-indigo-500 font-bold">{company?.id || 'Desconocido'}</span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Buscar por nombre, documento o cel..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-10 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-50 shadow-sm transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {canCreate && (
                <button 
                  onClick={() => {
                      onOpenModal();
                  }}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 flex gap-2 items-center transition-all active:scale-95 uppercase tracking-widest shrink-0"
                >
                  <Plus size={18} strokeWidth={3} /> Nuevo Cliente
                </button>
            )}
          </div>
        </div>

        {clients.length === 0 && (
            <div className="bg-indigo-50 border-2 border-indigo-100 p-6 rounded-3xl flex items-start gap-4 mx-2 animate-in slide-in-from-top-4">
                <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg">
                    <Info size={24} />
                </div>
                <div>
                    <h4 className="font-bold text-indigo-900 uppercase tracking-tight text-lg">¿Por qué no veo mis clientes?</h4>
                    <p className="text-indigo-700 text-sm font-medium mt-1 leading-relaxed">
                        Si has importado clientes desde el Panel de Programador, asegúrate de estar en la sucursal correcta. <br/>
                        Los clientes pertenecen a la sucursal: <span className="font-bold underline">{company?.id}</span>.
                    </p>
                </div>
            </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 mx-2">
          <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse text-sm table-auto">
              <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 text-center w-16">TIPO</th>
                  <th className="px-4 py-4 w-32">DOCUMENTO</th>
                  <th className="px-4 py-4">NOMBRE / RAZÓN SOCIAL</th>
                  <th className="px-4 py-4 w-40">CONTACTO</th>
                  <th className="px-4 py-4">DIRECCIÓN</th>
                  <th className="px-4 py-4 text-center w-24">PUNTOS</th>
                  <th className="px-4 py-4 text-center w-28">CUMPLEAÑOS</th>
                  <th className="px-4 py-4 text-center w-40">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentItems.length > 0 ? (
                  currentItems.map((c, i) => {
                    if (!c) return null;
                    const isRUC = c.docType === 'RUC';
                    const points = c.points || 0;
                    
                    return (
                      <tr key={c.id || i} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm ${isRUC ? 'bg-indigo-600' : 'bg-sky-500'}`}>
                              {isRUC ? <Building2 size={16} /> : <User size={16} />}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-bold text-gray-300 uppercase">{c.docType}</span>
                            <span className="font-bold text-gray-700 text-xs">{c.docNumber}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800 uppercase tracking-tight truncate max-w-[250px]" title={c.name}>
                              {c.name}
                            </span>
                            {c.alertMessage && (
                              <div 
                                className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${
                                  c.alertColor === 'red' ? 'bg-red-500' :
                                  c.alertColor === 'orange' ? 'bg-orange-500' :
                                  c.alertColor === 'green' ? 'bg-green-500' : 'bg-blue-500'
                                }`} 
                                title={`Alerta: ${c.alertMessage}`}
                              ></div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            {c.phone ? (
                              <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-[11px]">
                                <Phone size={11} className="text-indigo-400" /> {c.phone}
                              </div>
                            ) : (
                              <span className="text-gray-300 italic text-[9px]">Sin teléfono</span>
                            )}
                            {c.email && (
                              <div className="flex items-center gap-1.5 text-gray-400 text-[9px] truncate max-w-[140px]">
                                <Mail size={9} /> {c.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-1.5 max-w-[300px]">
                            <MapPin size={11} className="text-gray-300 shrink-0 mt-0.5" />
                            <span className="text-[10px] text-gray-500 font-medium uppercase line-clamp-1">
                              {c.address && c.address !== '-' ? c.address : '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-100">
                             <Crown size={10} fill="currentColor" />
                             <span className="text-[10px] font-bold">{points}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-gray-600 font-bold text-[10px]">
                              {formatDateSafe(c.birthday)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2.5 items-center">
                            {(c.googleMapsUrl || (c.address && c.address !== '-')) && (
                                <button 
                                    onClick={() => {
                                        const url = c.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`;
                                        window.open(url, '_blank');
                                    }}
                                    className="p-1.5 rounded-lg bg-white hover:bg-blue-50 border border-blue-100 shadow-sm transition-all"
                                    title="Ver en Google Maps"
                                >
                                    <MapPin size={18} className="text-blue-600" />
                                </button>
                            )}
                            <button 
                                onClick={() => handleWhatsAppClick(c.phone)}
                                className="p-1.5 rounded-lg bg-white hover:bg-emerald-50 border border-emerald-100 shadow-sm transition-all flex items-center justify-center"
                                title="Enviar WhatsApp"
                            >
                                <img src="https://iili.io/fXXft0Q.png" className="w-5 h-5 object-contain" alt="WA" />
                            </button>
                            {canEdit && (
                              <button 
                                onClick={() => onEdit(c)}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Editar Cliente"
                              >
                                <Edit size={16} />
                              </button>
                            )}
                            {canDelete && (
                              <button 
                                onClick={() => setClientToDelete(c.id)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Eliminar Cliente"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-300">
                        <Search size={40} className="opacity-20" />
                        <p className="font-bold uppercase tracking-widest text-xs">
                          {searchTerm ? `Sin resultados para "${searchTerm}"` : 'Sin clientes registrados'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                Página {currentPage} de {totalPages || 1} • {total} Clientes
              </div>
              <div className="flex items-center gap-2">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1, searchTerm)}
                    className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button 
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => onPageChange(currentPage + 1, searchTerm)}
                    className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Clients;
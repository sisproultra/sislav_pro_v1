
import React, { useState } from 'react';
import { X, Search, ShoppingBag, Star, TrendingUp, Trash2, Plus, Minus, MessageCircle, Store, AlertTriangle, Check, ShoppingCart } from 'lucide-react';
import { StoreItem, Client, Company } from '../types';
import { roundToOneDecimal } from '../utils/calculations';
import { INITIAL_STORE_ITEMS } from '../services/dbService';

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  company: Company;
}

const StoreModal: React.FC<StoreModalProps> = ({ isOpen, onClose, client, company }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [cart, setCart] = useState<{ item: StoreItem; qty: number }[]>([]);
  const [orderComplete, setOrderComplete] = useState(false);

  const categories = ['ALL', 'QUIMICOS', 'ACCESORIOS', 'PREMIUM'];
  const currency = company.currencySymbol || 'S/';

  const filteredItems = INITIAL_STORE_ITEMS.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.provider.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (item: StoreItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.item.id === id) {
        const newQty = Math.max(1, i.qty + delta);
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.item.id !== id));
  };

  const total = cart.reduce((sum, i) => sum + (i.item.price * i.qty), 0);

  const handleSendOrderToProvider = () => {
    if (cart.length === 0) return;

    const providersInCart = Array.from(new Set(cart.map(i => i.item.provider)));
    
    if (providersInCart.length > 1) {
        alert("Atención: Los artículos seleccionados pertenecen a diferentes proveedores. Se abrirá una ventana de WhatsApp por cada uno.");
    }

    providersInCart.forEach(provName => {
        const provItems = cart.filter(i => i.item.provider === provName);
        const providerPhone = provItems[0].item.providerPhone.replace(/\D/g, '');
        
        let msg = `*🛒 NUEVO PEDIDO - TIENDA ${company.razonSocial}*\n\n`;
        msg += `Hola *${provName}*, se ha generado un nuevo pedido desde nuestra plataforma:\n\n`;
        
        let provTotal = 0;
        provItems.forEach(i => {
          msg += `• ${i.qty} x ${i.item.name} (${currency}${i.item.price.toFixed(2)} c/u)\n`;
          provTotal += (i.item.price * i.qty);
        });
        
        msg += `\n*TOTAL A PAGAR: ${currency}${provTotal.toFixed(2)}*\n\n`;
        if (client) {
            msg += `*DAtos de Envío:*\nCliente: ${client.name}\nDirección: ${client.address || '-'}\n`;
        }
        msg += `\n_Por favor confirmar recepción y stock._`;

        window.open(`https://wa.me/${providerPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    });

    setOrderComplete(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col animate-in fade-in duration-300 overflow-hidden">
        
        {/* HEADER MÁS COMPACTO */}
        <div className="bg-white border-b border-slate-100 p-3 flex justify-between items-center shrink-0 shadow-sm z-30">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <Store size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-tight text-slate-900 leading-none">Marketplace</h2>
              <p className="text-slate-400 text-[8px] font-bold uppercase tracking-widest mt-0.5">Suministros</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
              <div className="hidden md:flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 gap-0.5">
                {categories.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-[8px] font-bold uppercase tracking-widest transition-all ${selectedCategory === cat ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:bg-white/50'}`}
                  >
                    {cat === 'ALL' ? 'Todos' : cat}
                  </button>
                ))}
              </div>
              <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 rounded-full">
                <X size={18} />
              </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden bg-slate-50/20">
          {/* CATALOGO - DISEÑO ULTRA COMPACTO */}
          <div className="flex-1 flex flex-col overflow-hidden p-3 md:p-4">
            <div className="mb-4 max-w-lg">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar productos..."
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700 text-xs transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredItems.map(item => (
                  <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-all duration-300 relative">
                    {/* FOTO COMPACTA AJUSTADA */}
                    <div className="relative h-36 overflow-hidden bg-white flex items-center justify-center p-1">
                      <img src={item.imageUrl} className="max-w-full max-h-full object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" alt={item.name} />
                      {item.isRecommended && (
                        <div className="absolute top-2 left-2 bg-indigo-600 text-white px-1.5 py-0.5 rounded-full text-[6px] font-bold uppercase flex items-center gap-0.5 shadow-md z-10">
                          <TrendingUp size={6} /> TOP
                        </div>
                      )}
                    </div>

                    {/* INFO COMPACTA */}
                    <div className="p-2.5 flex-1 flex flex-col">
                      <h3 className="text-[10px] font-bold text-slate-800 leading-tight mb-1 group-hover:text-indigo-600 transition-colors uppercase truncate" title={item.name}>{item.name}</h3>
                      
                      <div className="mt-auto pt-2 border-t border-slate-50 flex items-end justify-between gap-1">
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-[6px] font-bold text-slate-300 uppercase leading-none mb-0.5 tracking-tight">PROVEEDOR</span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase truncate">{item.provider}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-slate-900 tracking-tight">{currency}{item.price.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* BOTÓN MÁS COMPACTO */}
                    <button 
                      onClick={() => addToCart(item)}
                      className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-2 font-bold uppercase text-[8px] tracking-widest transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Plus size={12} strokeWidth={4} /> AGREGAR
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CARRITO LATERAL - ANCHO AJUSTADO */}
          <div className="w-[260px] bg-white border-l border-slate-100 flex flex-col shadow-xl z-20 shrink-0">
            <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-white">
              <h3 className="font-bold text-xs uppercase tracking-tight flex items-center gap-1.5 text-slate-900">
                <ShoppingBag className="text-indigo-600" size={16} /> Mi Pedido
              </h3>
              <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full text-[7px] font-bold">{cart.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/30">
              {client && (
                <div className="bg-white p-2 rounded-xl border border-slate-100 mb-2 flex items-center gap-2 shadow-sm">
                  <div className="w-7 h-7 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 shadow-inner font-bold text-[10px]">
                    {client.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[6px] font-bold text-slate-300 uppercase leading-none">Comprador</p>
                    <p className="font-bold text-[9px] text-slate-800 truncate uppercase leading-none mt-1">{client.name}</p>
                  </div>
                </div>
              )}

              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 text-center py-10 px-4">
                  <ShoppingBag size={40} strokeWidth={1} className="mb-3 text-slate-200" />
                  <p className="font-bold uppercase tracking-widest text-[8px] leading-relaxed">Carrito vacío</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.item.id} className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className="font-bold text-[9px] text-slate-800 uppercase truncate leading-none">{item.item.name}</h4>
                        <p className="text-[7px] font-bold text-slate-300 mt-0.5 uppercase tracking-widest truncate">{item.item.provider}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.item.id)} className="text-slate-200 hover:text-red-500 transition-colors p-0.5">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 bg-gray-50 p-0.5 rounded-lg border border-gray-100">
                        <button onClick={() => updateQty(item.item.id, -1)} className="w-4 h-4 bg-white rounded flex items-center justify-center text-slate-600 shadow-sm active:scale-90 transition-transform"><Minus size={8} /></button>
                        <span className="w-4 text-center font-bold text-[9px] text-slate-800">{item.qty}</span>
                        <button onClick={() => updateQty(item.item.id, 1)} className="w-4 h-4 bg-white rounded flex items-center justify-center text-slate-600 shadow-sm active:scale-90 transition-transform"><Plus size={8} /></button>
                      </div>
                      <span className="font-bold text-slate-900 text-[10px] tracking-tight">{currency}{roundToOneDecimal(item.item.price * item.qty).toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-50 bg-white">
              <div className="flex justify-between items-end mb-3 px-1">
                <div>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total</p>
                  <p className="text-xl font-bold text-slate-900 tracking-tight">{currency}{roundToOneDecimal(cart.reduce((sum, i) => sum + (i.item.price * i.qty), 0)).toFixed(2)}</p>
                </div>
              </div>

              <button 
                onClick={handleSendOrderToProvider}
                disabled={cart.length === 0}
                className={`w-full py-3 rounded-xl font-bold text-[9px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ${cart.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20' : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'}`}
              >
                <MessageCircle size={16} /> ENVIAR PEDIDO
              </button>
            </div>
          </div>
        </div>

        {/* MODAL DE ÉXITO */}
        {orderComplete && (
          <div className="fixed inset-0 z-[300] bg-slate-950/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-500">
            <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center flex flex-col items-center border border-white/20 shadow-2xl animate-in zoom-in-95">
              <div className="bg-emerald-50 text-emerald-600 p-6 rounded-full mb-6 ring-4 ring-emerald-50/50">
                <Check size={48} strokeWidth={3} className="animate-bounce" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight mb-2 leading-none">Pedido Enviado</h3>
              <p className="text-slate-500 font-bold leading-tight mb-8 uppercase text-[9px] tracking-widest">
                Se han abierto las ventanas de WhatsApp de los proveedores correspondientes.
              </p>
              <button 
                onClick={() => { setOrderComplete(false); setCart([]); onClose(); }}
                className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-all shadow-xl active:scale-95 uppercase tracking-widest text-[9px]"
              >
                VOLVER AL SISTEMA
              </button>
            </div>
          </div>
        )}
    </div>
  );
};

export default StoreModal;

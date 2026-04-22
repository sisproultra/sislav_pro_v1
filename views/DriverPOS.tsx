
import React, { useState } from 'react';
import { Product, CartItem, Client, InvoiceType, PaymentMethodConfig, PickupRequest } from '../types';
import { calculateTotals } from '../utils/calculations';
import { Search, ShoppingCart, Plus, Minus, Trash2, ChevronLeft, Save, CreditCard, DollarSign, Loader2, Banknote, Smartphone, QrCode, Wallet, Landmark } from 'lucide-react';

interface DriverPOSProps {
  products: Product[];
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  onCheckout: (docType: InvoiceType, client: Client, paymentMethodId: string) => Promise<void>;
  paymentMethods: PaymentMethodConfig[];
  pickupRequest: PickupRequest | null;
  onBack: () => void;
}

const DriverPOS: React.FC<DriverPOSProps> = ({
  products, cart, addToCart, removeFromCart, updateQuantity, onCheckout, paymentMethods, pickupRequest, onBack
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id || '');
  const [docType, setDocType] = useState<InvoiceType>(InvoiceType.NOTA_VENTA);
  const [isProcessing, setIsProcessing] = useState(false);

  const totals = calculateTotals(cart);

  const handleCheckout = async () => {
      if (!pickupRequest) return;
      
      // Fixed: Construct temp client with all required Client properties
      const tempClient: Client = {
          id: 'pickup-' + pickupRequest.id,
          sucursal_id: pickupRequest.sucursal_id,
          name: pickupRequest.clientName,
          docType: '-', 
          docNumber: '00000000',
          phone: pickupRequest.phone,
          address: pickupRequest.address,
          points: 0
      };

      setIsProcessing(true);
      await onCheckout(docType, tempClient, paymentMethodId);
      setIsProcessing(false);
      setIsCheckoutOpen(false);
      onBack(); // Go back to Delivery List
  };

  // Helper to get Icon Component based on config string or name fallback
  const getMethodIcon = (pm: PaymentMethodConfig) => {
      const iconData = pm.icon || '';
      
      // Check for Image
      if (iconData.startsWith('data:') || iconData.startsWith('http')) {
          return <img src={iconData} alt="icon" className="w-5 h-5 object-contain" />;
      }

      switch (iconData) {
          case 'banknote': return <Banknote size={14} />;
          case 'smartphone': return <Smartphone size={14} />;
          case 'qr-code': return <QrCode size={14} />;
          case 'wallet': return <Wallet size={14} />;
          case 'landmark': return <Landmark size={14} />;
          case 'dollar-sign': return <DollarSign size={14} />;
          case 'credit-card': return <CreditCard size={14} />;
          default:
              return <CreditCard size={14}/>;
      }
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // If checkout modal is open
  if (isCheckoutOpen) {
      return (
          <div className="h-full flex flex-col bg-white">
              <div className="bg-slate-900 p-4 text-white flex items-center gap-3 shadow-lg">
                  <button onClick={() => setIsCheckoutOpen(false)}><ChevronLeft /></button>
                  <h2 className="font-bold text-lg">Confirmar Recojo</h2>
              </div>
              
              <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <p className="text-xs text-blue-600 font-bold uppercase mb-1">Cliente</p>
                      <p className="font-bold text-lg text-gray-800">{pickupRequest?.clientName}</p>
                      <p className="text-sm text-gray-500">{pickupRequest?.address}</p>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Comprobante</label>
                          <div className="flex gap-2">
                              <button onClick={() => setDocType(InvoiceType.NOTA_VENTA)} className={`flex-1 py-3 rounded-xl border font-bold text-sm ${docType === InvoiceType.NOTA_VENTA ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600'}`}>Nota Venta</button>
                              <button onClick={() => setDocType(InvoiceType.BOLETA)} className={`flex-1 py-3 rounded-xl border font-bold text-sm ${docType === InvoiceType.BOLETA ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600'}`}>Boleta</button>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">Forma de Pago</label>
                          <div className="grid grid-cols-2 gap-2">
                              {paymentMethods.filter(pm => pm.isActive).map(pm => (
                                  <button 
                                    key={pm.id}
                                    onClick={() => setPaymentMethodId(pm.id)}
                                    className={`py-3 px-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 ${paymentMethodId === pm.id ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600'}`}
                                    style={{ borderColor: paymentMethodId === pm.id ? undefined : pm.color, color: (paymentMethodId !== pm.id && pm.color) ? 'black' : undefined }}
                                  >
                                      {getMethodIcon(pm)}
                                      {pm.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>

                  <div className="mt-8 border-t pt-4">
                      <div className="flex justify-between items-center text-xl font-bold text-gray-900 mb-6">
                          <span>TOTAL A PAGAR</span>
                          <span>S/ {totals.total.toFixed(2)}</span>
                      </div>
                      
                      <button 
                        onClick={handleCheckout}
                        disabled={isProcessing}
                        className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
                      >
                          {isProcessing ? <Loader2 className="animate-spin"/> : <Save />}
                          CONFIRMAR VENTA
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 relative">
      {/* Header */}
      <div className="bg-slate-900 p-4 text-white shadow-md z-10 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-1 hover:bg-white/20 rounded-full"><ChevronLeft size={24} /></button>
              <div>
                  <h1 className="font-bold text-base leading-tight">Recojo: {pickupRequest?.clientName}</h1>
                  <p className="text-xs text-slate-400">Seleccione los servicios</p>
              </div>
          </div>
      </div>

      {/* Search */}
      <div className="p-3 bg-white border-b border-gray-200 shrink-0">
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                  autoFocus
                  type="text" 
                  placeholder="Buscar servicio (ej: Edredon)" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-100 border-transparent rounded-xl text-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
          </div>
      </div>

      {/* Product List (Big Cards) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-32">
          {filteredProducts.map(product => {
              const inCart = cart.find(item => item.id === product.id);
              return (
                  <div key={product.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center active:bg-gray-50">
                      <div className="flex-1">
                          <h3 className="font-bold text-gray-800 text-base">{product.name}</h3>
                          <p className="text-blue-600 font-bold">S/ {product.price.toFixed(2)}</p>
                      </div>
                      
                      {inCart ? (
                          <div className="flex items-center bg-slate-100 rounded-lg p-1">
                              <button onClick={() => updateQuantity(product.id, inCart.quantity - 1)} className="p-3 bg-white shadow-sm rounded-md text-gray-700 active:scale-90 transition-transform">
                                  {inCart.quantity === 1 ? <Trash2 size={20} className="text-red-500" /> : <Minus size={20} />}
                              </button>
                              <span className="w-10 text-center font-bold text-lg">{inCart.quantity}</span>
                              <button onClick={() => addToCart(product)} className="p-3 bg-blue-600 shadow-sm rounded-md text-white active:scale-90 transition-transform">
                                  <Plus size={20} />
                              </button>
                          </div>
                      ) : (
                          <button onClick={() => addToCart(product)} className="bg-slate-100 text-slate-600 p-3 rounded-xl hover:bg-slate-200 active:scale-95 transition-transform">
                              <Plus size={24} />
                          </button>
                      )}
                  </div>
              );
          })}
      </div>

      {/* Sticky Cart Footer */}
      {cart.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                      <div className="bg-blue-100 text-blue-700 p-2 rounded-full">
                          <ShoppingCart size={20} />
                      </div>
                      <span className="font-bold text-gray-600">{cart.length} items</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                      S/ {totals.total.toFixed(2)}
                  </div>
              </div>
              <button 
                onClick={() => setIsCheckoutOpen(true)}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-lg shadow-lg active:scale-95 transition-transform flex justify-center items-center gap-2"
              >
                  CONTINUAR <ChevronLeft className="rotate-180" />
              </button>
          </div>
      )}
    </div>
  );
};

export default DriverPOS;

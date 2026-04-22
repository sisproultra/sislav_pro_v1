import React, { useState, useMemo } from 'react';
import { Product, CartItem, PickupRequest, Company, InvoiceType, PaymentMethodConfig } from '../types';
// Added missing icons: Check, Smartphone
import { Search, Plus, Minus, Trash2, X, ShoppingCart, Loader2, ChevronRight, MapPin, ChevronUp, ChevronDown, WashingMachine, FileText, CreditCard, Banknote, Check, Smartphone } from 'lucide-react';
import { calculateTotals, roundToOneDecimal } from '../utils/calculations';
import { EvolutionService } from '../services/evolutionService';

interface FastOrderTakerProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    pickupRequest: PickupRequest;
    company: Company;
    paymentMethods: PaymentMethodConfig[];
    onConfirm: (cart: CartItem[], type: InvoiceType, paymentMethod: string) => Promise<void>;
}

const FastOrderTaker: React.FC<FastOrderTakerProps> = ({ isOpen, onClose, products, pickupRequest, company, paymentMethods, onConfirm }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCartExpanded, setIsCartExpanded] = useState(false);
    
    // Estados para la venta
    const [selectedDocType, setSelectedDocType] = useState<InvoiceType>(InvoiceType.NOTA_VENTA);
    const [selectedPaymentId, setSelectedPaymentId] = useState<string>(paymentMethods.find(pm => pm.name.includes('EFECTIVO') || pm.name.includes('Efectivo'))?.name || 'EFECTIVO');

    const brandPrimary = document.documentElement.style.getPropertyValue('--brand-primary').trim() || '#0054A6';

    const filteredProducts = useMemo(() => {
        return products.filter(p => p.estado !== 'i' && p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [products, searchTerm]);

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id 
                    ? { ...item, quantity: item.quantity + 1, subtotal: roundToOneDecimal((item.quantity + 1) * item.price) } 
                    : item
                );
            }
            return [{ ...product, quantity: 1, subtotal: roundToOneDecimal(product.price), originalPrice: product.price }, ...prev];
        });
    };

    const updateQty = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty, subtotal: roundToOneDecimal(newQty * item.price) };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const removeItem = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const totals = calculateTotals(cart);
    const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const handleFinalize = async () => {
        if (cart.length === 0) return;
        setIsProcessing(true);
        try {
            await onConfirm(cart, selectedDocType, selectedPaymentId);
            
            // Enviar mensaje de WhatsApp automático
            const phone = pickupRequest.phone?.replace(/\D/g, '');
            if (phone && company.whatsapp_instance) {
                const trackingUrl = `${window.location.origin}/?tracking=${pickupRequest.id}`;
                const msg = `Estimado cliente,\nLe confirmamos que su prenda ya ha sido recogida y en este momento nos encontramos en camino a la lavandería para iniciar el proceso de lavado.\n\nGracias por confiar en nosotros. 🧺✨ no olvide seguir el proceso en el link de seguimiento enviado anteriormente:\n${trackingUrl}`;
                
                const service = new EvolutionService({
                    baseUrl: company.whatsapp_instance,
                    apiKey: company.whatsapp_token || '',
                    instanceName: company.whatsapp_instance_name || ''
                });
                await service.sendText(phone, msg).catch(() => {
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                });
            }
            onClose();
        } catch (e) {
            alert("Error al procesar el pedido.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[3000] bg-slate-100 flex flex-col md:hidden animate-in slide-in-from-bottom duration-300">
            <div className="bg-white border-b border-slate-100 p-4 shrink-0 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 bg-slate-50 rounded-xl text-slate-400"><X size={24} /></button>
                    <div>
                        <h2 className="font-bold text-xs uppercase tracking-tight text-slate-400">Recojo de prendas</h2>
                        <p className="text-sm text-slate-900 font-bold truncate max-w-[200px] uppercase">
                            {pickupRequest.clientName}
                        </p>
                    </div>
                </div>
                <div className="bg-indigo-50 px-3 py-1 rounded-full text-[9px] font-bold text-indigo-600 border border-indigo-100">MODO DELIVERY</div>
            </div>

            <div className="p-4 bg-white border-b border-slate-200 shrink-0">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input 
                        type="text"
                        placeholder="Buscar prenda o servicio..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-sm font-bold focus:bg-white focus:border-indigo-500 outline-none transition-all shadow-inner"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar pb-32">
                {filteredProducts.map(p => {
                    const inCart = cart.find(i => i.id === p.id);
                    return (
                        <div key={p.id} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.98] transition-all">
                            <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-xs text-slate-800 uppercase truncate leading-none mb-1">{p.name}</h4>
                                <p className="text-indigo-600 font-bold text-sm tabular-nums">S/ {p.price.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {inCart ? (
                                    <div className="flex items-center bg-slate-50 rounded-2xl p-1 gap-3 border border-slate-100 shadow-inner">
                                        <button onClick={() => updateQty(p.id, -1)} className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-red-500 shadow-sm"><Minus size={18} strokeWidth={3}/></button>
                                        <span className="w-6 text-center font-bold text-sm">{inCart.quantity}</span>
                                        <button onClick={() => addToCart(p)} className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-sm"><Plus size={18} strokeWidth={3}/></button>
                                    </div>
                                ) : (
                                    <button onClick={() => addToCart(p)} className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center active:bg-indigo-600 active:text-white transition-all shadow-sm">
                                        <Plus size={24} strokeWidth={4} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className={`fixed bottom-0 left-0 right-0 z-[310] transition-all duration-500 ${isCartExpanded ? 'h-[85vh]' : 'h-auto'}`}>
                {isCartExpanded && <div className="absolute inset-0 -top-[100vh] bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsCartExpanded(false)}></div>}
                
                <div className={`bg-white h-full rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.15)] flex flex-col relative z-20 border-t border-indigo-50 animate-in slide-in-from-bottom duration-500`}>
                    
                    <div className="absolute -top-16 right-6 z-30">
                        <button 
                            onClick={() => cart.length > 0 && setIsCartExpanded(!isCartExpanded)}
                            style={{ backgroundColor: brandPrimary }}
                            className={`w-14 h-14 rounded-full text-white shadow-2xl flex items-center justify-center transition-all active:scale-90 border-4 border-white relative ${isCartExpanded ? 'rotate-180 bg-slate-800' : 'animate-bounce'}`}
                        >
                            {isCartExpanded ? <X size={24} strokeWidth={3} /> : <WashingMachine size={24} strokeWidth={2.5} />}
                            {totalItemsCount > 0 && !isCartExpanded && (
                                <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-pulse">
                                    {totalItemsCount}
                                </div>
                            )}
                        </button>
                    </div>

                    <div className="pt-8"></div>

                    {isCartExpanded && (
                        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-6 custom-scrollbar">
                            <div className="space-y-4">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo de Comprobante</label>
                                <div className={`grid ${company?.sunatEnvironment === 'PRODUCTION' || company?.sunatEnvironment === 'TEST' ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                                    <button onClick={() => setSelectedDocType(InvoiceType.NOTA_VENTA)} className={`py-3 rounded-2xl text-[10px] font-bold uppercase transition-all border-2 ${selectedDocType === InvoiceType.NOTA_VENTA ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-100'}`}><FileText size={14} className="inline mr-1" /> Nota Venta</button>
                                    {(company?.sunatEnvironment === 'PRODUCTION' || company?.sunatEnvironment === 'TEST') && (
                                        <>
                                            <button 
                                                onClick={() => setSelectedDocType(InvoiceType.BOLETA)} 
                                                className={`py-3 rounded-2xl text-[10px] font-bold uppercase transition-all border-2 ${selectedDocType === InvoiceType.BOLETA ? (company?.sunatEnvironment === 'TEST' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-900 text-white border-slate-900') : 'bg-white text-slate-500 border-slate-100'} ${company?.sunatEnvironment === 'TEST' ? 'animate-pulse bg-emerald-500 border-emerald-600 text-white' : ''}`}
                                            >
                                                <Check size={14} className="inline mr-1" /> Boleta
                                            </button>
                                            <button 
                                                onClick={() => setSelectedDocType(InvoiceType.FACTURA)} 
                                                className={`py-3 rounded-2xl text-[10px] font-bold uppercase transition-all border-2 ${selectedDocType === InvoiceType.FACTURA ? (company?.sunatEnvironment === 'TEST' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-900 text-white border-slate-900') : 'bg-white text-slate-500 border-slate-100'} ${company?.sunatEnvironment === 'TEST' ? 'animate-pulse bg-emerald-500 border-emerald-600 text-white' : ''}`}
                                            >
                                                <FileText size={14} className="inline mr-1" /> Factura
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Método de Pago</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {paymentMethods.filter(pm => pm.isActive).slice(0, 4).map(pm => (
                                        <button key={pm.id} onClick={() => setSelectedPaymentId(pm.name)} className={`py-3 px-2 rounded-2xl text-[10px] font-bold uppercase transition-all border-2 flex items-center justify-center gap-2 ${selectedPaymentId === pm.name ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-white text-slate-500 border-slate-100'}`}>
                                            {pm.name.includes('YAPE') ? <Smartphone size={14}/> : pm.name.includes('EFECTIVO') ? <Banknote size={14}/> : <CreditCard size={14}/>}
                                            {pm.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-xs uppercase text-slate-900">Resumen del Carrito</h4>
                                    <button onClick={() => setCart([])} className="text-[9px] font-bold text-red-500 uppercase flex items-center gap-1 hover:underline"><Trash2 size={12}/> VACIAR</button>
                                </div>
                                <div className="space-y-2 pb-10">
                                    {cart.map(item => (
                                        <div key={item.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                                            <div className="min-w-0 flex-1 pr-3">
                                                <p className="font-bold text-[10px] text-slate-800 uppercase truncate leading-none mb-1">{item.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 tabular-nums">S/ {roundToOneDecimal(item.price * item.quantity).toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center bg-white rounded-xl p-1 border border-slate-200">
                                                    <button onClick={() => updateQty(item.id, -1)} className="p-1 text-red-500"><Minus size={14} strokeWidth={3}/></button>
                                                    <span className="w-5 text-center font-bold text-[10px]">{item.quantity}</span>
                                                    <button onClick={() => addToCart(item)} className="p-1 text-indigo-600"><Plus size={14} strokeWidth={3}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between shrink-0 shadow-2xl">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{selectedDocType === InvoiceType.BOLETA ? 'TOTAL BOLETA' : 'TOTAL NOTA VENTA'}</span>
                            <span className="text-3xl font-bold text-slate-950 tabular-nums tracking-tight">S/ {totals.total.toFixed(2)}</span>
                        </div>
                        {isProcessing ? (
                            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                                <Loader2 className="animate-spin text-indigo-600" />
                            </div>
                        ) : (
                            <button 
                                disabled={cart.length === 0}
                                onClick={handleFinalize}
                                style={{ backgroundColor: brandPrimary }}
                                className={`h-16 px-10 rounded-[1.8rem] font-bold text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center gap-3 ${cart.length > 0 ? 'text-white shadow-indigo-200' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                            >
                                CONFIRMAR <ChevronRight size={20} strokeWidth={4} className={cart.length > 0 ? 'animate-pulse' : ''} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FastOrderTaker;
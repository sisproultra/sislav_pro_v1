import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ShoppingBasket, ShoppingCart, Trash2, Plus, Minus, User, X, Save, Loader2, CheckCircle2, Ticket, Layers, PlusCircle, ClipboardEdit, Camera, Mic, AlertTriangle, ShieldAlert, Pause, Play, Clock, History, Crown, RefreshCcw, Image as ImageIcon, Bell, Shirt, Edit2, Check, DollarSign, WashingMachine, FileText, ListPlus, Calendar, CalendarCheck, AlertCircle } from 'lucide-react';
import { Product, CartItem, InvoiceType, InvoiceTotals, Client, PaymentMethodConfig, PickupRequest, Category, UnitCode, GlobalColor, Company, PausedSale, UmSaas } from '../types';
import { calculateTotals, roundToOneDecimal, getPeruDateTime, getRetroactivePeruDate, formatDateSafe } from '../utils/calculations';
import { dbUploadImage, dbGetPopularityData } from '../services/dbService';
import { printQuoteDirectly } from '../utils/printService';
import ClientModal from '../components/ClientModal';
import PreCheckoutModal from '../components/PreCheckoutModal';
import MultiItemDetailModal from '../components/MultiItemDetailModal';
import CartItemDetailModal from '../components/CartItemDetailModal';

const alertColorMap = {
    red: { border: 'border-red-500', bg: 'bg-red-500', text: 'text-red-600' },
    orange: { border: 'border-orange-500', bg: 'bg-orange-500', text: 'text-orange-600' },
    green: { border: 'border-green-500', bg: 'bg-green-500', text: 'text-green-600' },
    blue: { border: 'border-blue-500', bg: 'bg-blue-500', text: 'text-blue-600' }
};

interface PointOfSaleProps {
  products: Product[];
  clients: Client[];
  cart: CartItem[];
  categories: Category[];
  addToCart: (product: Product, forceNew?: boolean) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updatePrice: (id: string, price: number, discount?: number) => void;
  updateDetails: (id: string, details: string, images?: string[], audioNote?: string, deliveryDate?: string, newQuantity?: number) => void;
  onCheckout: (
      docType: InvoiceType, 
      client: Client, 
      paymentMethodId: string, 
      deliveryDate?: string, 
      notes?: string, 
      prePayment?: number, 
      discount?: number, 
      customerPhotos?: string[], 
      paymentsList?: { methodName: string, amount: number }[], 
      cartOverride?: CartItem[], 
      pickupOverride?: string,
      issueDate?: string
  ) => Promise<void>;
  onAddClient: (client: Client) => Promise<Client>;
  onOpenInventoryModal: () => void;
  paymentMethods: PaymentMethodConfig[];
  initialPickupRequest: PickupRequest | null;
  onClearPickupRequest: () => void;
  isEditing: boolean;
  editingOrderId?: string;
  onUpdateOrder: (notes: string, deliveryDate?: string) => Promise<void>;
  onCancelEdit: () => void;
  apiToken: string;
  globalColors?: GlobalColor[];
  company: Company;
  pausedSales?: PausedSale[];
  onPauseSale?: (sale: Omit<PausedSale, 'id' | 'date'>) => Promise<any>;
  onResumeSale?: (sale: PausedSale) => void;
  onDeletePausedSale?: (id: string) => void;
  bannerCobro?: string;
  canManage?: boolean;
  onSearchClients?: (search: string) => Promise<Client[]>;
  ticketConfig?: any;
}

const PointOfSale: React.FC<PointOfSaleProps> = ({ 
  products, clients, cart, categories, addToCart, removeFromCart, updateQuantity, updatePrice, updateDetails, onCheckout, onAddClient, onOpenInventoryModal, paymentMethods,
  initialPickupRequest, onClearPickupRequest, isEditing, editingOrderId, onUpdateOrder, onCancelEdit, apiToken, globalColors = [], company,
  pausedSales = [], onPauseSale, onResumeSale, onDeletePausedSale, bannerCobro, canManage = true,
  onSearchClients, ticketConfig
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'ALL'>('ALL');
  const [selectedDocType, setSelectedDocType] = useState<InvoiceType>(InvoiceType.NOTA_VENTA);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [localClientSuggestions, setLocalClientSuggestions] = useState<Client[]>([]);
  const [clientError, setClientError] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClientForModal, setEditingClientForModal] = useState<Client | null>(null);
  const [isPreCheckoutOpen, setIsPreCheckoutOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCartItemForMultiDetail, setSelectedCartItemForMultiDetail] = useState<CartItem | null>(null);
  const [selectedCartItemForSingleDetail, setSelectedCartItemForSingleDetail] = useState<CartItem | null>(null);
  const [showFacturaRestriction, setShowFacturaRestriction] = useState(false);
  const [showSunatThresholdModal, setShowSunatThresholdModal] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [showNoClientAlert, setShowNoClientAlert] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [nagVisible, setNagVisible] = useState(false);

  // Estados para Facturación Retroactiva SUNAT
  const [isRetroactiveActive, setIsRetroactiveActive] = useState(false);
  const [isRetroactiveModalOpen, setIsRetroactiveModalOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'CART'>('CATALOG');
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [quoteNotification, setQuoteNotification] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<{ id: string, val: string } | null>(null);

  const handleAddToCart = (product: Product, forceNew = false) => {
    addToCart(product, forceNew);
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 500);
  };

  const [editingPriceItem, setEditingPriceItem] = useState<CartItem | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  const [tempDiscount, setTempDiscount] = useState<string>('');

  const [customerPhotos, setCustomerPhotos] = useState<string[]>([]);
  const searchCache = useRef<Record<string, Client[]>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [historyTab, setHistoryTab] = useState<'ventas' | 'cotizaciones'>('ventas');

  const filteredPausedSales = useMemo(() => {
    return historyTab === 'ventas' 
        ? pausedSales.filter(s => !s.es_cotizacion)
        : pausedSales.filter(s => s.es_cotizacion);
  }, [pausedSales, historyTab]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const currency = company?.currencySymbol || 'S/';
  const primaryColor = document.documentElement.style.getPropertyValue('--primary-color') || '#0054A6';

  const normalizeStr = (str: string) => 
    (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

  useEffect(() => {
    if (!company.cobranza || !bannerCobro) return;
    setNagVisible(true);
    const interval = setInterval(() => setNagVisible(true), 15000); 
    return () => clearInterval(interval);
  }, [company.cobranza, bannerCobro]);

  const activeClientData = useMemo(() => {
    if (!selectedClient) return null;
    return clients.find(c => c.id === selectedClient.id) || selectedClient;
  }, [selectedClient, clients]);

  useEffect(() => {
    if (isCameraModalOpen) {
        startCamera();
    } else {
        stopCamera();
    }
    return () => stopCamera();
  }, [isCameraModalOpen]);

  useEffect(() => {
    if (cameraActive && cameraStream && videoRef.current) {
        videoRef.current.srcObject = cameraStream;
    }
  }, [cameraActive, cameraStream]);

  useEffect(() => {
    if (selectedClient) setClientError(false);
  }, [selectedClient]);

  useEffect(() => {
    if (initialPickupRequest && company) {
      let existing = clients.find(c => c.id === initialPickupRequest.cliente_id);
      if (!existing) {
          existing = clients.find(c => 
            (c.phone && c.phone === initialPickupRequest.phone) || 
            normalizeStr(c.name) === normalizeStr(initialPickupRequest.clientName)
          );
      }

      if (existing) {
          setSelectedClient(existing);
          if (existing.alertMessage) setIsAlertModalOpen(true);
      } else {
          setSelectedClient({
            id: 'temp-' + initialPickupRequest.id,
            sucursal_id: company.id,
            name: (initialPickupRequest.clientName || '').toUpperCase(),
            phone: initialPickupRequest.phone,
            address: (initialPickupRequest.address || '').toUpperCase(),
            docType: '-',
            docNumber: '00000000',
            points: 0
          });
      }
    }
  }, [initialPickupRequest, clients, company?.id]);

  const startCamera = async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      setCameraActive(true);
    } catch (err) {
      setCameraError(true);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  const captureCustomerPhoto = async () => {
    if (videoRef.current && canvasRef.current && customerPhotos.length < 3) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        
        setCustomerPhotos(prev => [...prev, dataUrl]);

        setIsUploading(true);
        try {
            const holdingPath = normalizeStr(company.holding_name || 'holding_default');
            const sucursalPath = normalizeStr(company.razonSocial || 'sucursal');
            const storagePath = `global/empresas/${holdingPath}/${sucursalPath}/imagen_venta/proof_${Date.now()}.jpg`;
            const url = await dbUploadImage('laundry-assets', dataUrl, storagePath);
            
            setCustomerPhotos(prev => prev.map(img => img === dataUrl ? url : img));
        } catch (e) {
            alert("Error al subir foto.");
            setCustomerPhotos(prev => prev.filter(img => img !== dataUrl));
        } finally {
            setIsUploading(false);
        }
      }
    }
  };

  const removeCustomerPhoto = (idx: number) => setCustomerPhotos(prev => prev.filter((_, i) => i !== idx));

  const [popularityData, setPopularityData] = useState<{ topCategories: string[], topProducts: string[] }>({ topCategories: [], topProducts: [] });

  useEffect(() => {
    dbGetPopularityData().then(setPopularityData);
  }, []);

  const sortedCategories = useMemo(() => {
    const active = categories.filter(c => c.isActive);
    const top = popularityData.topCategories;
    
    return [...active].sort((a, b) => {
      const aIndex = top.indexOf(a.name);
      const bIndex = top.indexOf(b.name);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      return a.name.localeCompare(b.name);
    });
  }, [categories, popularityData.topCategories]);

  const sortedProducts = useMemo(() => {
    const top = popularityData.topProducts;
    
    return [...products].sort((a, b) => {
      const aIndex = top.indexOf(a.id);
      const bIndex = top.indexOf(b.id);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      return a.name.localeCompare(b.name);
    });
  }, [products, popularityData.topProducts]);

  const activeCategoryNamesNormalized = new Set(sortedCategories.map(c => normalizeStr(c.name)));

  const filteredProducts = useMemo(() => {
    const searchNormalized = normalizeStr(searchTerm);
    const searchTerms = searchNormalized.split(' ').filter(t => t.trim() !== '');
    const isSearching = searchTerms.length > 0;

    const filtered = sortedProducts.filter(p => {
      const isActiveStatus = p.estado === 'a' || p.estado === '1' || p.activo === true;
      if (!isActiveStatus) return false;
      const pCatNormalized = normalizeStr(p.category);
      // Solo ocultar si la categoría existe en el sistema y está inactiva. 
      // Si es 'GENERAL' o la categoría no se encuentra, lo mostramos igual para evitar que se pierdan productos.
      if (pCatNormalized && pCatNormalized !== 'GENERAL' && activeCategoryNamesNormalized.size > 0 && !activeCategoryNamesNormalized.has(pCatNormalized)) return false;
      
      const nameNormalized = normalizeStr(p.name);
      const priceStr = p.price.toString();
      const priceFixed = p.price.toFixed(2);
      
      const matchesSearch = !isSearching || searchTerms.every(term => 
        nameNormalized.includes(term) || 
        priceStr.includes(term) || 
        priceFixed.includes(term)
      );

      const matchesCategory = selectedCategoryId === 'ALL' || normalizeStr(selectedCategoryId) === pCatNormalized;
      return matchesSearch && matchesCategory;
    });

    // Si el usuario está buscando, ordenamos por precio de mayor a menor
    if (isSearching) {
        return [...filtered].sort((a, b) => b.price - a.price);
    }

    return filtered;
  }, [sortedProducts, searchTerm, selectedCategoryId, activeCategoryNamesNormalized]);

  const totals = calculateTotals(cart, company.porcentajeIgv);
  const totalPointsNeeded = cart.reduce((sum, item) => sum + (item.pointsPrice || 0) * item.quantity, 0);
  const hasInsufficientPoints = activeClientData && (activeClientData.points || 0) < totalPointsNeeded;

  // Búsqueda híbrida (Local + Servidor) OPTIMIZADA para economía y velocidad
  useEffect(() => {
    const query = clientSearch.trim();
    if (!query) {
        setLocalClientSuggestions([]);
        setIsSearchingClients(false);
        return;
    }

    const searchNormalized = normalizeStr(query);
    const searchWords = searchNormalized.split(/\s+/).filter(w => w.length > 0);

    // 1. Búsqueda Local Instantánea
    const localMatches = clients.filter(c => {
        const fullName = normalizeStr(`${c.name} ${c.razon_social || ''} ${c.docNumber || ''} ${c.phone || ''}`);
        return searchWords.every(word => fullName.includes(word));
    }).slice(0, 10);

    // 2. Verificar Caché para ahorrar consultas al servidor
    if (searchCache.current[searchNormalized]) {
        const cachedResults = searchCache.current[searchNormalized];
        setLocalClientSuggestions(prev => {
            const combined = [...localMatches];
            cachedResults.forEach(r => {
                if (!combined.some(l => l.id === r.id)) combined.push(r);
            });
            return combined.slice(0, 15);
        });
        setIsSearchingClients(false);
        return;
    }

    // 3. Decidir si necesitamos ir al servidor
    // No vamos al servidor si:
    // - El texto es muy corto (menos de 3 caracteres para nombres rápidos)
    // - Ya tenemos un match EXACTO por documento (DNI/RUC)
    const hasExactDocMatch = localMatches.some(c => {
        const stored = (c.docNumber || '').replace(/\D/g, '');
        const current = query.replace(/\D/g, '');
        return current.length >= 8 && stored === current;
    });
    
    if (query.length < 3 || hasExactDocMatch) {
        setLocalClientSuggestions(localMatches);
        setIsSearchingClients(false);
        return;
    }

    // Mientras esperamos, mostramos lo local
    setLocalClientSuggestions(localMatches);

    const handler = setTimeout(async () => {
        // Si ya tenemos un match local exacto por documento, no gastar tokens/recursos en búsqueda de nube
        const exactLocalMatch = localMatches.find(c => {
            const stored = (c.docNumber || '').replace(/\D/g, '');
            const current = searchNormalized.replace(/\D/g, '');
            return current.length >= 8 && stored === current;
        });
        if (exactLocalMatch) {
             return;
        }

        setIsSearchingClients(true);
        try {
            if (onSearchClients) {
                const results = await onSearchClients(query);
                
                // Guardar en caché
                searchCache.current[searchNormalized] = results;

                setLocalClientSuggestions(prev => {
                    const combined = [...localMatches];
                    results.forEach(remote => {
                        if (!combined.some(l => l.id === remote.id)) {
                            combined.push(remote);
                        }
                    });
                    return combined.slice(0, 15);
                });
            }
        } catch (error) {
            console.error("Error searching clients:", error);
        } finally {
            setIsSearchingClients(false);
        }
    }, 500); 

    return () => clearTimeout(handler);
  }, [clientSearch, onSearchClients, clients]);

  const handleCheckoutClick = () => {
    if (cart.length === 0) return alert("El carrito está vacío.");
    if (!selectedClient) {
        setShowNoClientAlert(true);
        setTimeout(() => setShowNoClientAlert(false), 1250);
        
        setClientError(true);
        const clientArea = document.getElementById('client-selector-area');
        if (clientArea) clientArea.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    if (selectedDocType === InvoiceType.FACTURA) {
        if (selectedClient.docType !== 'RUC') {
            setShowFacturaRestriction(true);
            return;
        }
        
        // Bloqueo por estado SUNAT para Facturas
        const status = (activeClientData?.sunatStatus || '').toUpperCase();
        const condition = (activeClientData?.sunatCondition || '').toUpperCase();
        
        if (status && status !== 'ACTIVO') {
            alert(`⚠️ BLOQUEO DE SEGURIDAD SUNAT:\n\nEl RUC del cliente se encuentra en estado "${status}".\n\nNo se puede emitir una Factura a un cliente que no esté ACTIVO. Por favor, cambie a Boleta o Nota de Venta.`);
            return;
        }
        
        if (condition && condition !== 'HABIDO') {
            const proceed = confirm(`⚠️ ADVERTENCIA DE SEGURIDAD:\n\nEl RUC del cliente tiene la condición de "${condition}".\n\nEmitir una Factura a un cliente NO HABIDO puede generar problemas con SUNAT.\n\n¿Desea continuar de todos modos?`);
            if (!proceed) return;
        }
    }

    // Candado legal Sunat (Nuevo Pedido del Usuario)
    const isEnforceMode = company?.sunatEnvironment === 'PRODUCTION' || company?.sunatEnvironment === 'BETA';
    if (company?.doc_enforce_enabled && isEnforceMode) {
        const threshold = company.doc_enforce_threshold || 700;
        const totalAmount = totals.total;
        
        if (totalAmount >= threshold) {
            // Validar que el cliente tenga DNI o RUC (Documento real)
            const hasRealDoc = selectedClient && 
                             selectedClient.docNumber && 
                             selectedClient.docNumber !== '00000000' && 
                             selectedClient.docNumber.trim() !== '' &&
                             ['DNI', 'RUC', 'CE', 'PASAPORTE', '1', '6'].includes(normalizeStr(selectedClient.docType));

            if (!hasRealDoc) {
                setShowSunatThresholdModal(true);
                setClientError(true);
                const clientArea = document.getElementById('client-selector-area');
                if (clientArea) clientArea.scrollIntoView({ behavior: 'smooth' });
                return;
            }
        }
    }

    if (hasInsufficientPoints) {
        alert("El cliente no tiene suficientes puntos.");
        return;
    }
    setIsPreCheckoutOpen(true);
  };

  const handleFinalCheckout = async (data: { deliveryDate: string | undefined, notes: string, prePaymentAmount: number, discountAmount: number, paymentDetailsStr: string, paymentsList?: { methodName: string, amount: number }[], issueDate?: string }) => {
      const clientToProcess = activeClientData;
      const photosToProcess = [...customerPhotos];

      // RECALCULO INTERNO PARA SUNAT (Ajuste de Cantidad para cuadrar Redondeo)
      // Solo aplica cuando la cantidad es decimal, para forzar que (cant * precio) sea igual al total redondeado
      const adjustedCart = cart.map(item => {
          const isDecimal = item.quantity % 1 !== 0;
          if (isDecimal && item.price > 0) {
              const rawTotal = item.price * item.quantity;
              const roundedTotal = roundToOneDecimal(rawTotal);
              const adjustedQty = roundedTotal / item.price;
              
              return {
                  ...item,
                  quantity: adjustedQty,
                  subtotal: roundedTotal
              };
          }
          return item;
      });

      setIsPreCheckoutOpen(false);
      setIsProcessing(true);
      setClientSearch('');
      setCustomerPhotos([]); 
      setSelectedClient(null);
      try {
          if (isEditing && onUpdateOrder) {
              await onUpdateOrder(data.notes, data.deliveryDate);
          } else if (clientToProcess) {
              await onCheckout(
                  selectedDocType, 
                  clientToProcess, 
                  data.paymentDetailsStr, 
                  data.deliveryDate, 
                  data.notes, 
                  data.prePaymentAmount, 
                  data.discountAmount,
                  photosToProcess, 
                  data.paymentsList,
                  adjustedCart, // ENVIAMOS EL CARRITO CON CANTIDADES AJUSTADAS INTERNAMENTE
                  undefined, // pickupOverride
                  data.issueDate // ENVIAMOS FECHA DE EMISIÓN DE COMPROBANTE SELECTIVA (SUNAT)
              );
          }
          if (initialPickupRequest) onClearPickupRequest();
          // Reset UI states for next sale
          setSearchTerm('');
          setSelectedCategoryId('ALL');
          setActiveTab('CATALOG');
      } catch (e) { 
          console.error("Error en checkout:", e); 
      } finally { 
          setIsProcessing(false); 
      }
  };

  const handleNewClientSave = async (c: Client) => {
    setIsProcessing(true);
    try {
        const saved = await onAddClient(c);
        setSelectedClient(saved);
        setIsClientModalOpen(false);
        setEditingClientForModal(null);
        if (saved.alertMessage) setIsAlertModalOpen(true);
    } catch (e) { alert("Error al guardar cliente"); }
    finally { setIsProcessing(false); }
  };

  const handlePause = () => {
    if (cart.length === 0) return alert("Agregue servicios antes de pausar.");
    if (onPauseSale) {
        onPauseSale({ sucursal_id: company.id, client: activeClientData, cart: cart, docType: selectedDocType });
        setSelectedClient(null);
        setSelectedDocType(InvoiceType.NOTA_VENTA);
    }
  };

  const handleQuote = async () => {
    if (cart.length === 0) {
        setQuoteNotification("Agregue servicios para cotizar.");
        setTimeout(() => setQuoteNotification(null), 1500);
        return;
    }
    if (!activeClientData) {
        setClientError(true);
        setQuoteNotification("Para generar una cotización, debe seleccionar un cliente.");
        setTimeout(() => setQuoteNotification(null), 1500);
        // Hacer scroll al buscador de clientes
        document.getElementById('client-selector-area')?.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    if (onPauseSale) {
        const clientName = activeClientData.name;
        const quoteData = { 
            sucursal_id: company.id, 
            client: activeClientData, 
            cart: cart, 
            docType: selectedDocType,
            es_cotizacion: true,
            cliente_nombre: clientName
        };
        
        const savedQuote = await onPauseSale(quoteData);
        
        if (savedQuote) {
            await printQuoteDirectly(savedQuote, company, ticketConfig);
        } else {
            // Fallback en caso de que no retorne (ej: por compatibilidad)
            await printQuoteDirectly({
                id: 'temp-quote',
                date: new Date().toISOString(),
                client: activeClientData,
                cart: cart,
                docType: selectedDocType,
                es_cotizacion: true,
                cliente_nombre: clientName,
                numero_cotizacion: undefined,
                sucursal_id: company.id
            } as PausedSale, company, ticketConfig);
        }

        setSelectedClient(null);
        setSelectedDocType(InvoiceType.NOTA_VENTA);
    }
  };

  const handleResume = (sale: PausedSale) => {
    if (onResumeSale) {
        setSelectedClient(sale.client);
        setSelectedDocType(sale.docType);
        onResumeSale(sale);
        setIsResumeModalOpen(false);
        if (sale.client?.alertMessage) setIsAlertModalOpen(true);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const getInitialClientDocType = () => {
    if (selectedDocType === InvoiceType.FACTURA) return 'RUC';
    return 'DNI';
  };

  const handleStartEditPrice = (item: CartItem) => {
    setEditingPriceItem(item);
    setTempPrice(item.price.toString());
    setTempDiscount((item.descuento_unitario || 0).toString());
  };

  const handleSavePrice = () => {
    if (!editingPriceItem) return;
    const priceVal = parseFloat(tempPrice);
    const discountVal = parseFloat(tempDiscount) || 0;
    if (!isNaN(priceVal) && priceVal >= 0) {
        updatePrice(editingPriceItem.id, priceVal, discountVal);
    }
    setEditingPriceItem(null);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full bg-gray-100 overflow-hidden relative">
      {/* NOTIFICACIÓN FLOTANTE GLOBAL */}
      {quoteNotification && (
          <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[600] animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="bg-slate-900/90 backdrop-blur-md text-white px-8 py-4 rounded-[2rem] shadow-2xl border border-white/10 flex items-center gap-4">
                  <div className="bg-amber-500 p-2 rounded-xl text-white shadow-lg animate-pulse">
                      <AlertTriangle size={20} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest">{quoteNotification}</span>
              </div>
          </div>
      )}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>

      <div className={`flex-1 flex flex-col p-4 lg:p-6 overflow-hidden relative ${activeTab === 'CART' ? 'hidden lg:flex' : 'flex'}`}>
        {nagVisible && bannerCobro && company.cobranza && (
          <div className="fixed inset-0 z-[500] animate-in slide-in-from-top duration-700 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
            <div className="w-full max-w-2xl bg-white rounded-[3.5rem] shadow-2xl border-[10px] border-red-600 overflow-hidden relative group">
              <img src={bannerCobro} className="w-full h-auto object-contain max-h-[70vh]" alt="Cobranza" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-10 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold text-3xl uppercase tracking-tight leading-none mb-1">Servicio Suspendido</h3>
                  <p className="text-red-400 text-xs font-bold uppercase tracking-widest">Regularice su situación de pago para continuar</p>
                </div>
                <button 
                  onClick={() => setNagVisible(false)}
                  className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                >
                  CERRAR AVISO
                </button>
              </div>
              <button 
                onClick={() => setNagVisible(false)}
                className="absolute top-6 right-6 bg-red-600 text-white p-3 rounded-full shadow-2xl hover:bg-red-700 transition-all border-2 border-white"
              >
                <X size={24} strokeWidth={4} />
              </button>
            </div>
          </div>
        )}

        <div className="mb-2">
            <div 
              ref={scrollRef} 
              onMouseDown={handleMouseDown} 
              onMouseLeave={() => setIsDragging(false)} 
              onMouseUp={() => setIsDragging(false)} 
              onMouseMove={(e) => {
                if (!isDragging || !scrollRef.current) return;
                const x = e.pageX - scrollRef.current.offsetLeft;
                scrollRef.current.scrollLeft = scrollLeft - (x - startX) * 2;
              }}
              className="flex items-center gap-2 lg:gap-3 mb-2 overflow-x-auto no-scrollbar pb-2 pr-4 cursor-grab active:cursor-grabbing select-none"
            >
                <button onClick={() => setSelectedCategoryId('ALL')} className={`flex flex-col w-20 lg:w-24 h-28 lg:h-36 rounded-2xl overflow-hidden border-2 shrink-0 transition-all group ${selectedCategoryId === 'ALL' ? 'border-indigo-600 shadow-lg scale-105' : 'border-slate-200 hover:border-indigo-300'}`}>
                    <div className="flex-1 bg-white w-full flex items-center justify-center"><Layers size={24} className={selectedCategoryId === 'ALL' ? 'text-indigo-600' : 'text-slate-300'} /></div>
                    <div style={selectedCategoryId === 'ALL' ? { backgroundColor: primaryColor } : { backgroundColor: '#475569' }} className="w-full py-1.5 lg:py-2 text-center text-white font-bold text-[9px] lg:text-[10px] uppercase px-1">TODAS</div>
                </button>
                {sortedCategories.map(cat => (
                    <button key={cat.id} onClick={() => setSelectedCategoryId(cat.name)} className={`flex flex-col w-20 lg:w-24 h-28 lg:h-36 rounded-2xl overflow-hidden border-2 shrink-0 transition-all group ${selectedCategoryId === cat.name ? 'border-indigo-600 shadow-lg scale-105' : 'border-slate-200 hover:border-indigo-300'}`}>
                        <div className="flex-1 bg-white w-full flex items-center justify-center">{cat.imageUrl ? <img src={cat.imageUrl} className="w-full h-full object-cover" alt={cat.name} draggable="false" /> : <Layers size={24} className="text-slate-300" />}</div>
                        <div style={selectedCategoryId === cat.name ? { backgroundColor: primaryColor } : { backgroundColor: '#475569' }} className="w-full py-1.5 lg:py-2 text-center text-white font-bold text-[9px] lg:text-[10px] uppercase truncate px-1">{cat.name}</div>
                    </button>
                ))}
            </div>
        </div>

        <div className="mb-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex gap-3 items-center w-full md:max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder="Buscar prenda o servicio..." className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-indigo-50 outline-none text-sm transition-all text-slate-900" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={onOpenInventoryModal} style={{ color: primaryColor, borderColor: `${primaryColor}20` }} className="bg-white border-2 px-3 lg:px-4 py-2.5 rounded-xl hover:bg-indigo-50 transition-all shadow-sm flex items-center gap-2 group shrink-0"><PlusCircle size={20}/><span className="font-bold text-[9px] lg:text-[10px] uppercase tracking-widest">NUEVO</span></button>
          </div>
          <div className="lg:hidden flex w-full gap-2">
              <button 
                onClick={() => setActiveTab('CART')}
                style={{ backgroundColor: primaryColor }}
                className="flex-1 py-3 rounded-xl text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg"
              >
                <ShoppingBasket size={18} /> VER MI CESTO ({cart.length})
              </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-10">
                {filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-20"><Shirt size={64}/><p className="font-bold uppercase tracking-widest text-xs mt-4">Sin productos en este filtro</p></div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
                      {filteredProducts.map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => handleAddToCart(p)} 
                        className="bg-white p-3 lg:p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-400 cursor-pointer group transition-all transform hover:-translate-y-1 flex flex-col h-full relative overflow-hidden"
                      >
                          {/* Feedback de Agregado Flotante */}
                          {addedProductId === p.id && (
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="bg-green-500 text-white px-3 py-1 rounded-full shadow-lg border border-green-400 flex items-center gap-1">
                                    <Check size={10} strokeWidth={4} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">AGREGADO</span>
                                </div>
                            </div>
                          )}
                          {/* Background Accent */}
                          <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50/50 rounded-bl-full -mr-8 -mt-8 group-hover:bg-indigo-100/50 transition-colors" />
                          
                          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                              {p.pointsPrice && (
                                <div className="bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full text-[8px] font-bold border border-amber-200 flex items-center gap-1 shadow-sm">
                                  <Crown size={8} /> {p.pointsPrice}
                                </div>
                              )}
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleAddToCart(p, true); }}
                                    style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                                    className="rounded-lg p-2 hover:bg-white hover:shadow-md transition-all"
                                    title="Agregar como nueva línea"
                                  >
                                    <ListPlus size={18} strokeWidth={2.5} />
                                  </button>
                                  <div 
                                    style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                                    className="rounded-lg p-2"
                                  >
                                    <Plus size={18} strokeWidth={2.5} />
                                  </div>
                              </div>
                          </div>

                          <div className="flex-1 flex flex-col">
                            <div className="text-[8px] lg:text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{p.category}</div>
                            <h3 className="font-bold text-slate-800 text-xs lg:text-sm leading-tight mb-3 uppercase">{p.name}</h3>
                          </div>

                          <div className="mt-auto pt-2 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex flex-col">
                              <div className="text-sm lg:text-base font-black text-slate-900">{currency} {p.price.toFixed(2)}</div>
                            </div>
                            <div 
                              style={{ backgroundColor: primaryColor }}
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200/50 group-active:scale-90 transition-transform"
                            >
                              <WashingMachine size={16} />
                            </div>
                          </div>
                      </div>
                      ))}
                  </div>
                )}
            </div>
        </div>
      </div>

      <div className={`w-full lg:w-[420px] bg-white border-l border-gray-200 shadow-2xl flex flex-col overflow-hidden ${activeTab === 'CATALOG' ? 'hidden lg:flex' : 'flex'}`}>
        <div className="lg:hidden p-4 border-b bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
                <ShoppingCart size={20} className="text-indigo-400" />
                <h3 className="text-[11px] font-bold uppercase tracking-widest">Carrito de Compras</h3>
            </div>
            <button onClick={() => setActiveTab('CATALOG')} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                <X size={20} />
            </button>
        </div>
        
        {/* Mobile Client Photos Section Removed to save space */}

        <div className="p-4 border-b flex bg-gray-50 gap-2 shrink-0 overflow-x-auto no-scrollbar">
            {[
                { type: InvoiceType.NOTA_VENTA, label: 'N. VENTA' },
                ...(company?.sunatEnvironment === 'PRODUCTION' || company?.sunatEnvironment === 'BETA' ? [
                    { type: InvoiceType.BOLETA, label: 'BOLETA' },
                    { type: InvoiceType.FACTURA, label: 'FACTURA' }
                ] : [])
            ].map(doc => {
                const isBetaDoc = company?.sunatEnvironment === 'BETA' && (doc.type === InvoiceType.BOLETA || doc.type === InvoiceType.FACTURA);
                const isActive = selectedDocType === doc.type;
                
                return (
                    <button 
                        key={doc.type} 
                        onClick={() => setSelectedDocType(doc.type)} 
                        style={isActive ? { backgroundColor: isBetaDoc ? '#f97316' : primaryColor, borderColor: isBetaDoc ? '#f97316' : primaryColor } : {}} 
                        className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all border-2 ${isActive ? 'text-white shadow-lg' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'} ${isBetaDoc && isActive ? '' : (isBetaDoc ? 'border-orange-200 text-orange-600' : '')}`}
                    >
                        {doc.label}
                    </button>
                );
            })}
        </div>

        <div id="client-selector-area" className="p-3 border-b space-y-2 shrink-0 bg-slate-50/50">
            <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase tracking-widest"><span>Cliente Emisor</span><div className="flex items-center gap-1.5"><button onClick={handleQuote} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all" title="Generar Cotización"><FileText size={24} strokeWidth={3} /></button><button onClick={() => setIsCameraModalOpen(true)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all" title="Tomar Fotos"><Camera size={24} strokeWidth={3} /></button><button onClick={handlePause} className="p-2 text-orange-500 hover:bg-orange-50 rounded-xl transition-all" title="Pausar Pedido"><Pause size={24} strokeWidth={3} /></button><button onClick={() => setIsResumeModalOpen(true)} style={{ color: primaryColor }} className="p-2 hover:bg-indigo-50 rounded-xl transition-all relative" title="Retomar Pedido"><History size={24} strokeWidth={3} />{pausedSales.length > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[7px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-sm">{pausedSales.length}</span>}</button></div></div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2 text-slate-300" size={14} />
                <input type="text" value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setClientError(false); }} placeholder="Nombre, Telefono  RUC..." className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs outline-none transition-all text-slate-900 ${clientError ? 'bg-red-50 border-2 border-red-500 ring-4 ring-red-100 animate-shake' : 'bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-50'}`} />
                {clientSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white shadow-2xl border rounded-xl z-50 overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                        {localClientSuggestions.length === 0 && isSearchingClients ? (
                            <div className="p-4 flex items-center justify-center gap-3">
                                <Loader2 size={16} className="animate-spin text-indigo-500" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Buscando...</span>
                            </div>
                        ) : (
                            <>
                                {localClientSuggestions.length > 0 ? (
                                    <>
                                        {localClientSuggestions.map(c => (
                                            <div 
                                                key={c.id} 
                                                onClick={() => { setSelectedClient(c); setClientSearch(''); if (c.alertMessage) setIsAlertModalOpen(true); }} 
                                                className="p-2.5 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0 flex flex-col group transition-colors"
                                            >
                                                <span className="font-bold text-xs text-gray-800 uppercase group-hover:text-indigo-600 transition-colors">{c.name}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] text-gray-400 font-mono uppercase bg-slate-100 px-1 rounded">{c.docType}: {c.docNumber}</span>
                                                    {c.points > 0 && <span className="text-[8px] text-amber-500 font-bold flex items-center gap-0.5"><Crown size={8} /> {c.points} pts</span>}
                                                </div>
                                            </div>
                                        ))}
                                        {isSearchingClients && (
                                            <div className="px-4 py-2 bg-slate-50/50 flex items-center justify-center gap-2 border-t border-slate-100">
                                                <Loader2 size={12} className="animate-spin text-indigo-400" />
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Buscando más resultados en la nube...</span>
                                            </div>
                                        )}
                                    </>
                                ) : !isSearchingClients && (
                                    <div className="p-4 text-center">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-tight">No se encontraron resultados</p>
                                        <p className="text-[8px] text-slate-300 uppercase mt-1">Garantice que el cliente esté registrado</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
              </div>
              {canManage && (
                <button onClick={() => { setEditingClientForModal(null); setIsClientModalOpen(true); }} style={{ backgroundColor: primaryColor }} className="text-white px-2 rounded-xl font-bold text-[9px] uppercase shadow-md active:scale-95 transition-all flex items-center gap-1 shrink-0"><Plus size={12} strokeWidth={3}/> NUEVO</button>
              )}
            </div>
            {activeClientData && (
                <div className={`border p-2 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2 transition-colors ${hasInsufficientPoints && totalPointsNeeded > 0 ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm border ${hasInsufficientPoints && totalPointsNeeded > 0 ? 'bg-white text-red-500 border-red-100' : 'bg-white border-indigo-100'}`} style={!(hasInsufficientPoints && totalPointsNeeded > 0) ? { color: primaryColor } : {}}><User size={16}/></div>
                    <div className="flex-1 min-0 overflow-hidden">
                        <div className={`font-bold text-[10px] truncate uppercase ${hasInsufficientPoints && totalPointsNeeded > 0 ? 'text-red-900' : 'text-indigo-900'}`}>{activeClientData.name}</div>
                        <div className="flex items-center gap-2"><div className="text-[9px] font-bold" style={{ color: primaryColor }}>{activeClientData.docType}: {activeClientData.docNumber}</div><div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${hasInsufficientPoints && totalPointsNeeded > 0 ? 'bg-red-600 text-white border-red-700' : 'bg-amber-100 text-amber-700 border-amber-200'}`}><Crown size={8} fill="currentColor" /> {activeClientData.points || 0} PTS</div></div>
                    </div>
                    <button type="button" onClick={() => { setEditingClientForModal(activeClientData); setIsClientModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 transition-colors mr-1 p-1 hover:bg-white rounded-lg shadow-sm" title="Editar datos del cliente"><Edit2 size={13}/></button>
                    <button onClick={() => { setSelectedClient(null); setEditingClientForModal(null); }} className="text-slate-400 hover:text-red-500 transition-colors p-1 hover:bg-white rounded-lg shadow-sm" title="Quitar cliente"><X size={13}/></button>
                </div>
            )}

            {/* Desktop Compact Photos Section Removed to save space */}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50"><ShoppingCart size={64} strokeWidth={1} /><p className="font-bold uppercase tracking-widest text-[10px] mt-4">Carrito Vacío</p></div>
            ) : (
                cart.map(item => (
                    <div key={item.id} className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all flex flex-col gap-0.5">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-[13px] text-slate-800 uppercase leading-none truncate flex-1 pr-2">{item.name}</h4>
                            <div className="text-right shrink-0">
                                <span className="font-bold text-slate-900 text-xs tabular-nums">S/ {item.subtotal.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                                <div className="flex items-center bg-slate-50 rounded-lg p-0.5 gap-0.5 border border-slate-100 shadow-inner">
                                    <button onClick={() => updateQuantity(item.id, Math.max(0.1, item.quantity - 1))} className="w-6 h-6 bg-white rounded flex items-center justify-center text-slate-600 shadow-sm active:scale-90"><Minus size={12} /></button>
                                    <input 
                                        type="number" 
                                        value={editingQuantity?.id === item.id ? editingQuantity.val : item.quantity} 
                                        onFocus={() => setEditingQuantity({ id: item.id, val: '' })}
                                        onBlur={() => {
                                            if (editingQuantity?.id === item.id) {
                                                if (editingQuantity.val !== '') {
                                                    const val = parseFloat(editingQuantity.val);
                                                    const isDecimalAllowed = [UmSaas.KILO, UmSaas.METROS, UmSaas.LITRO].includes(item.um_saas as UmSaas);
                                                    if (!isNaN(val)) {
                                                        const finalVal = isDecimalAllowed ? val : Math.floor(val);
                                                        updateQuantity(item.id, finalVal);
                                                    }
                                                }
                                                setEditingQuantity(null);
                                            }
                                        }}
                                        onChange={(e) => {
                                            setEditingQuantity({ id: item.id, val: e.target.value });
                                        }}
                                        step={ [UmSaas.KILO, UmSaas.METROS, UmSaas.LITRO].includes(item.um_saas as UmSaas) ? "0.01" : "1" }
                                        className="w-16 text-center font-bold text-xs text-slate-800 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 bg-white rounded flex items-center justify-center text-slate-600 shadow-sm active:scale-90"><Plus size={12} /></button>
                                </div>
                                <button 
                                    onClick={() => canManage && handleStartEditPrice(item)}
                                    className={`text-[10px] font-bold text-indigo-600 tabular-nums flex items-center gap-1 hover:bg-indigo-50 px-1.5 py-1 rounded-lg transition-colors border border-slate-100 bg-slate-50 shadow-inner ${!canManage && 'opacity-50 cursor-not-allowed'}`}
                                    title="Editar Precio"
                                >
                                    <span className="text-xs">
                                        {currency} {item.price.toFixed(2)}
                                    </span>
                                    {canManage && <Edit2 size={10}/>}
                                </button>
                                <button 
                                    onClick={() => {
                                        const isBulkUnit = [UnitCode.KGM, UnitCode.MTK, UnitCode.LTR].includes(item.unitCode);
                                        // Si requiere cálculo de área, usamos obligatoriamente el MultiItemDetailModal (que ahora maneja área)
                                        if (item.requiresAreaCalc) {
                                            setSelectedCartItemForMultiDetail(item);
                                        } else if (isBulkUnit) {
                                            setSelectedCartItemForSingleDetail(item);
                                        } else {
                                            setSelectedCartItemForMultiDetail(item);
                                        }
                                    }} 
                                    className={`p-1 rounded-lg transition-all border ${item.details || (item.images && item.images.length > 0) ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-sm' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}
                                    title="Auditoría de Prenda"
                                >
                                    <ClipboardEdit size={14}/>
                                </button>
                            </div>
                            <button onClick={() => removeFromCart(item.id)} className="bg-rose-50 text-rose-500 border border-rose-100 p-1.5 rounded-lg hover:bg-rose-100 transition-all active:scale-90"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))
            )}
        </div>

        <div className="p-3 md:p-4 bg-white border-t border-slate-100 shadow-[0_-15px_40px_rgba(0,0,0,0.05)] shrink-0 z-20 pb-8 lg:pb-4">
            <div className="flex justify-between items-end mb-3 md:mb-4">
                <div className="flex flex-col">
                    <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Monto Total</span>
                    <span className="text-2xl md:text-3xl font-bold text-slate-950 tracking-tight tabular-nums leading-none">S/ {totals.total.toFixed(2)}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-tight mb-1">Items: {cart.length}</span>
                    <div className="bg-indigo-50 text-indigo-600 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg text-[8px] md:text-[9px] font-bold border border-indigo-100 uppercase tracking-widest">Puntos: +{Math.floor(totals.total / (company.pointsEquivalency || 10))}</div>
                </div>
            </div>
            <div className="flex gap-2 items-stretch w-full">
                <button 
                    onClick={() => setIsRetroactiveModalOpen(true)}
                    className={`px-3.5 rounded-xl md:rounded-[1.8rem] border-2 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm relative shrink-0 ${
                        isRetroactiveActive 
                            ? 'bg-amber-50 border-amber-400 text-amber-700 shadow-amber-200/40' 
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                    title="Configurar Fecha Retroactiva (SUNAT)"
                    type="button"
                >
                    <Clock size={16} className={`${isRetroactiveActive ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
                    <img 
                        src="https://i.ibb.co/twcHbM44/Anotaci-n-2026-05-27-231150.png" 
                        alt="Retroactivo" 
                        referrerPolicy="no-referrer"
                        className="h-6 w-auto min-w-[24px] object-contain rounded-md"
                    />
                    {isRetroactiveActive && (
                        <span className="absolute -top-1.5 -right-1 flex h-4 w-4 items-center justify-center bg-amber-500 rounded-full text-[8px] font-bold text-white uppercase border border-white animate-bounce">
                            ✓
                        </span>
                    )}
                </button>
                <button 
                    onClick={handleCheckoutClick} 
                    disabled={cart.length === 0 || isProcessing || !canManage}
                    style={{ backgroundColor: primaryColor }}
                    className="flex-1 py-3.5 md:py-4 rounded-xl md:rounded-[1.8rem] text-white font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50 disabled:grayscale group shadow-indigo-600/30"
                >
                    {isProcessing ? <Loader2 className="animate-spin" /> : (
                        !canManage ? "ACCESO RESTRINGIDO" : <><CheckCircle2 strokeWidth={3} className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" /> PROCESAR VENTA</>
                    )}
                </button>
            </div>
        </div>
      </div>

      {/* MINI MODAL DE EDICIÓN DE PRECIO */}
      {editingPriceItem && (
          <div className="fixed inset-0 bg-slate-950/70 z-[400] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-[0_20px_70px_rgba(0,0,0,0.4)] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-3">
                          <div style={{ backgroundColor: primaryColor }} className="p-2 rounded-xl text-white shadow-lg"><Edit2 size={16} /></div>
                          <h3 className="font-bold text-xs uppercase tracking-widest text-slate-800">Modificar Precio</h3>
                      </div>
                      <button onClick={() => setEditingPriceItem(null)} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="text-center">
                          <p className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-1">{editingPriceItem.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Precio Catálogo: {currency} {editingPriceItem.originalPrice?.toFixed(2) || editingPriceItem.price.toFixed(2)}</p>
                      </div>
                      <div className="space-y-4">
                          <div>
                              <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Precio Unitario (S/)</label>
                              <input 
                                type="number"
                                step="0.01"
                                value={tempPrice}
                                onChange={e => setTempPrice(e.target.value)}
                                style={{ borderColor: '#f1f5f9' }} 
                                className="w-full bg-slate-100 border-2 rounded-2xl py-3 px-4 text-2xl font-bold text-slate-900 outline-none focus:bg-white transition-all text-center shadow-inner"
                                autoFocus
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSavePrice();
                                    if (e.key === 'Escape') setEditingPriceItem(null);
                                }}
                              />
                          </div>

                          <div>
                              <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Descuento por Unidad (S/)</label>
                              <input 
                                type="number"
                                step="0.01"
                                value={tempDiscount}
                                onChange={e => {
                                    const val = parseFloat(e.target.value);
                                    if (isNaN(val)) setTempDiscount('');
                                    else if (val > parseFloat(tempPrice)) setTempDiscount(tempPrice);
                                    else setTempDiscount(e.target.value);
                                }}
                                style={{ borderColor: '#f1f5f9' }} 
                                className="w-full bg-slate-100 border-2 rounded-2xl py-3 px-4 text-2xl font-bold text-indigo-600 outline-none focus:bg-white transition-all text-center shadow-inner"
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSavePrice();
                                    if (e.key === 'Escape') setEditingPriceItem(null);
                                }}
                                placeholder="0.00"
                              />
                          </div>
                      </div>
                      <button 
                        onClick={handleSavePrice}
                        style={{ backgroundColor: primaryColor, boxShadow: `0 10px 20px -5px ${primaryColor}40` }}
                        className="w-full py-4 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                          <Check size={18} strokeWidth={3} /> APLICAR CAMBIO
                      </button>
                  </div>
              </div>
          </div>
      )}

      <ClientModal 
        isOpen={isClientModalOpen} 
        onClose={() => {
            setIsClientModalOpen(false);
            setEditingClientForModal(null);
        }} 
        onSave={handleNewClientSave} 
        apiToken={apiToken} 
        initialData={editingClientForModal}
        initialDocType={getInitialClientDocType()} 
        clientsList={clients} 
        onSearchDatabase={onSearchClients}
      />
      
      {isPreCheckoutOpen && (
        <PreCheckoutModal 
            isOpen={isPreCheckoutOpen} 
            onClose={() => setIsPreCheckoutOpen(false)} 
            onConfirm={handleFinalCheckout} 
            totalAmount={totals.total} 
            paymentMethods={paymentMethods} 
            company={company}
            isDelivery={initialPickupRequest !== null} 
            cart={cart}
            initialIssueDate={isRetroactiveActive ? getRetroactivePeruDate() : undefined}
        />
      )}

      {/* MODAL CONFIGURACIÓN FACTURACIÓN RETROACTIVA */}
      {isRetroactiveModalOpen && (
          <div className="fixed inset-0 bg-slate-950/75 z-[400] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                  <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center bg-white">
                      <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
                              <CalendarCheck size={18} />
                          </div>
                          <div>
                              <h3 className="font-bold text-xs uppercase tracking-widest text-slate-800">Fecha de Emisión</h3>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Configuración SUNAT</p>
                          </div>
                      </div>
                      <button 
                          onClick={() => setIsRetroactiveModalOpen(false)} 
                          className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                      >
                          <X size={18}/>
                      </button>
                  </div>

                  <div className="p-6 space-y-5">
                      {/* Imagen de referencia */}
                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center flex flex-col items-center justify-center gap-2">
                          <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest block">Ubicación de Guía de Pago</span>
                          <img 
                              src="https://i.ibb.co/twcHbM44/Anotaci-n-2026-05-27-231150.png" 
                              alt="Referencia SUNAT" 
                              referrerPolicy="no-referrer"
                              className="max-h-20 rounded-md shadow-sm border border-slate-200/50"
                          />
                      </div>

                      {/* Opciones de Emisión */}
                      <div className="grid grid-cols-2 gap-3">
                          <button
                              type="button"
                              onClick={() => {
                                  setIsRetroactiveActive(false);
                              }}
                              className={`p-3 rounded-2xl border-2 transition-all text-left flex flex-col gap-1.5 ${
                                  !isRetroactiveActive 
                                      ? 'border-indigo-600 bg-indigo-50/30' 
                                      : 'border-slate-100 bg-white hover:bg-slate-50'
                              }`}
                          >
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${!isRetroactiveActive ? 'text-indigo-600' : 'text-slate-500'}`}>Emisión Hoy</span>
                              <span className="text-[8px] text-slate-400 leading-normal font-sans">Fecha automática al procesar venta actual.</span>
                          </button>
                          
                          <button
                              type="button"
                              onClick={() => {
                                  setIsRetroactiveActive(true);
                              }}
                              className={`p-3 rounded-2xl border-2 transition-all text-left flex flex-col gap-1.5 ${
                                  isRetroactiveActive 
                                      ? 'border-amber-500 bg-amber-50/30' 
                                      : 'border-slate-100 bg-white hover:bg-slate-50'
                              }`}
                          >
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${isRetroactiveActive ? 'text-amber-600' : 'text-slate-500'}`}>Retroactivo</span>
                              <span className="text-[8px] text-slate-400 leading-normal font-sans">Emitir con fecha anterior (Permitido hasta 2 días).</span>
                          </button>
                      </div>

                      {/* Explicación Dinámica */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              <span>Emisión en tiempo real</span>
                              <span className={isRetroactiveActive ? "text-amber-600 animate-pulse font-sans" : "text-indigo-600 font-sans"}>
                                  {isRetroactiveActive ? "● RETROACTIVO" : "● NORMAL"}
                              </span>
                          </div>
                          
                          <div className="space-y-2">
                              <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                  <span className="text-slate-400 font-bold uppercase text-[9px] font-sans">Fecha Local (Hoy):</span>
                                  <span className="font-bold text-slate-700 font-mono text-xs">{formatDateSafe(getPeruDateTime().date)}</span>
                              </div>
                              
                              <div className={`flex justify-between items-center p-2.5 rounded-xl border transition-all shadow-sm ${
                                  isRetroactiveActive 
                                      ? "bg-amber-50/50 border-amber-200" 
                                      : "bg-white border-slate-100 opacity-60"
                              }`}>
                                  <span className="text-slate-400 font-bold uppercase text-[9px] flex items-center gap-1 font-sans">
                                      <Clock size={10} className={isRetroactiveActive ? "text-amber-500" : ""} /> Fecha Comprobantes:
                                  </span>
                                  <span className={`font-black font-mono text-xs ${isRetroactiveActive ? "text-amber-700" : "text-slate-600"}`}>
                                      {isRetroactiveActive ? formatDateSafe(getRetroactivePeruDate()) : formatDateSafe(getPeruDateTime().date)}
                                  </span>
                              </div>
                          </div>

                          {isRetroactiveActive ? (
                              <p className="text-[9px] text-amber-600 font-bold leading-normal uppercase tracking-wide bg-amber-50 border border-amber-200/50 p-3 rounded-xl font-sans text-center">
                                  ⚠️ Los comprobantes se emitirán dos días atrás de forma dinámica (ej. si es medianoche se recalcula automáticamente). Es la modalidad admitida por SUNAT.
                              </p>
                          ) : (
                              <p className="text-[9px] text-indigo-600 font-bold leading-normal uppercase tracking-wide bg-indigo-50 border border-indigo-200/50 p-3 rounded-xl font-sans text-center">
                                  ✓ Recomendado para transacciones en tiempo real. El sistema usará la hora y fecha fiscal actual de Perú.
                              </p>
                          )}
                      </div>
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                      <button 
                          onClick={() => setIsRetroactiveModalOpen(false)}
                          className="flex-1 py-3 border border-slate-200 hover:bg-slate-200 transition-colors bg-white rounded-xl font-bold text-[10px] uppercase tracking-widest text-slate-500"
                      >
                          Cerrar
                      </button>
                      <button 
                          onClick={() => {
                              setIsRetroactiveModalOpen(false);
                          }}
                          style={{ backgroundColor: isRetroactiveActive ? '#D97706' : primaryColor }}
                          className="flex-1 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest text-white shadow-md active:scale-95 transition-all"
                      >
                          Confirmar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {selectedCartItemForMultiDetail && (
          <MultiItemDetailModal 
            isOpen={!!selectedCartItemForMultiDetail} 
            onClose={() => setSelectedCartItemForMultiDetail(null)} 
            item={selectedCartItemForMultiDetail} 
            company={company}
            onSave={(detalles, newQty) => updateDetails(selectedCartItemForMultiDetail.id, JSON.stringify(detalles), undefined, undefined, undefined, newQty)} 
          />
      )}

      {selectedCartItemForSingleDetail && (
          <CartItemDetailModal 
            isOpen={!!selectedCartItemForSingleDetail} 
            onClose={() => setSelectedCartItemForSingleDetail(null)} 
            itemName={selectedCartItemForSingleDetail.name}
            initialDetails={selectedCartItemForSingleDetail.details || ''} 
            initialImages={selectedCartItemForSingleDetail.images || []}
            initialAudio={selectedCartItemForSingleDetail.audioNote}
            initialDate={selectedCartItemForSingleDetail.itemDeliveryDate}
            onSave={(details, images, audio, date) => updateDetails(selectedCartItemForSingleDetail.id, details, images, audio, date)} 
          />
      )}

      {isResumeModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 border border-white/20">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-white/5">
                      <div className="flex items-center gap-3">
                        <History size={24} style={{ color: primaryColor }} />
                        <h3 className="font-bold text-xl uppercase tracking-tight">Historial</h3>
                      </div>
                      <button onClick={() => setIsResumeModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full"><X size={24}/></button>
                  </div>
                  
                  <div className="flex bg-slate-800 p-1 m-4 rounded-2xl shrink-0">
                    <button 
                        onClick={() => setHistoryTab('ventas')}
                        style={historyTab === 'ventas' ? { backgroundColor: primaryColor } : {}}
                        className={`flex-1 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${historyTab === 'ventas' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Ventas Pausadas
                    </button>
                    <button 
                        onClick={() => setHistoryTab('cotizaciones')}
                        style={historyTab === 'cotizaciones' ? { backgroundColor: primaryColor } : {}}
                        className={`flex-1 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${historyTab === 'cotizaciones' ? 'text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Cotizaciones
                    </button>
                  </div>

                  <div className="p-6 pt-2 flex-1 overflow-y-auto bg-slate-50 space-y-3 custom-scrollbar min-h-[300px]">
                      {filteredPausedSales.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                            {historyTab === 'ventas' ? <History size={64}/> : <FileText size={64}/>}
                            <p className="font-bold uppercase tracking-widest text-xs mt-4">Sin {historyTab === 'ventas' ? 'ventas' : 'cotizaciones'} en espera</p>
                          </div>
                      ) : filteredPausedSales.map(sale => (
                          <div 
                            key={sale.id} 
                            style={{ borderColor: historyTab === 'ventas' ? '#f1f5f9' : `${primaryColor}30` }}
                            className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between group transition-all bg-white hover:shadow-md animate-in slide-in-from-bottom-2`}
                          >
                              <div className="flex items-center gap-4">
                                  <div 
                                    style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-white`}
                                  >
                                    {sale.es_cotizacion ? <FileText size={24}/> : <User size={24}/>}
                                  </div>
                                  <div>
                                      <div className="flex flex-col gap-0.5">
                                          <div 
                                            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                                            className={`text-[8px] font-black px-2 py-0.5 rounded-lg w-max mb-1`}
                                          >
                                              {sale.es_cotizacion ? `COTIZACIÓN #${String(sale.numero_cotizacion || 0).padStart(5, '0')}` : 'PAUSA TEMPORAL'}
                                          </div>
                                          <h4 className="font-bold text-slate-900 text-sm tracking-tight leading-none uppercase">{sale.cliente_nombre?.toUpperCase()}</h4>
                                      </div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{sale.cart.length} Items • {new Date(sale.date).toLocaleTimeString()}</p>
                                  </div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                  <button onClick={() => onDeletePausedSale?.(sale.id)} className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"><Trash2 size={18}/></button>
                                  <button 
                                    onClick={() => handleResume(sale)} 
                                    style={{ backgroundColor: primaryColor }}
                                    className={`text-white px-6 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2 active:scale-95 transition-all shadow-indigo-600/20`}
                                  >
                                    <Play size={14} fill="currentColor" /> {sale.es_cotizacion ? 'GENERAR VENTA' : 'RETOMAR'}
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {isCameraModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 z-[500] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in">
              <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 border border-white/20">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-white/5">
                      <div className="flex items-center gap-3"><Camera size={24} className="text-indigo-400" /><h3 className="font-bold text-xl uppercase tracking-tight">Cámara de Cliente</h3></div>
                      <button onClick={() => setIsCameraModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full"><X size={24}/></button>
                  </div>
                  <div className="p-8 flex flex-col items-center gap-6 bg-slate-50">
                      <div className="relative w-full aspect-video bg-slate-900 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl">
                          {cameraActive ? (
                              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                                  {cameraError ? <ShieldAlert size={48} className="text-rose-500" /> : <Loader2 size={48} className="animate-spin text-indigo-500" />}
                                  <p className="text-xs font-bold uppercase tracking-widest">{cameraError ? 'Error de Permisos' : 'Iniciando Cámara...'}</p>
                              </div>
                          )}
                          <canvas ref={canvasRef} className="hidden" />
                          {cameraActive && <div className="absolute top-6 right-6 w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,1)]"></div>}
                      </div>

                      <div className="flex flex-col gap-4 w-full">
                          <button 
                            onClick={captureCustomerPhoto} 
                            disabled={!cameraActive || customerPhotos.length >= 3 || isUploading}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                          >
                              {isUploading ? <Loader2 className="animate-spin" /> : <><Camera size={20} strokeWidth={3} /> CAPTURAR FOTO ({customerPhotos.length}/3)</>}
                          </button>

                          <div className="flex gap-3 w-full overflow-x-auto no-scrollbar py-2 justify-center min-h-[80px]">
                              {customerPhotos.map((photo, idx) => (
                                  <div key={idx} className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-lg shrink-0 group animate-in zoom-in">
                                      <img src={photo} className="w-full h-full object-cover" />
                                      <button onClick={() => removeCustomerPhoto(idx)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow-md active:scale-90"><X size={12} /></button>
                                  </div>
                              ))}
                              {customerPhotos.length === 0 && (
                                  <div className="flex flex-col items-center justify-center text-slate-300 opacity-50 py-4">
                                      <ImageIcon size={32} strokeWidth={1} />
                                      <p className="text-[8px] font-bold uppercase tracking-widest mt-1">Sin fotos capturadas</p>
                                  </div>
                              )}
                          </div>
                      </div>

                      <button onClick={() => setIsCameraModalOpen(false)} className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase hover:text-slate-600 transition-colors">FINALIZAR Y CERRAR</button>
                  </div>
              </div>
          </div>
      )}

      {isAlertModalOpen && activeClientData && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-red-950/80 backdrop-blur-md animate-in fade-in">
              <div className={`bg-white rounded-[3rem] w-full max-w-md shadow-2xl p-10 text-center border-t-[10px] border-b-[10px] ${alertColorMap[activeClientData.alertColor as keyof typeof alertColorMap]?.border || 'border-blue-100'}`}>
                  <div className={`w-20 h-20 rounded-3xl mx-auto mb-8 flex items-center justify-center text-white shadow-xl ${alertColorMap[activeClientData.alertColor as keyof typeof alertColorMap]?.bg || 'bg-blue-600'} animate-bounce`}>
                      <AlertTriangle size={40} />
                  </div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em] mb-4">¡ALERTA DE SEGURIDAD!</h4>
                  <p className={`text-2xl font-bold uppercase tracking-tight leading-none mb-6 ${alertColorMap[activeClientData.alertColor as keyof typeof alertColorMap]?.text || 'text-blue-600'}`}>
                      {activeClientData.alertMessage}
                  </p>
                  <button onClick={() => setIsAlertModalOpen(false)} className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-3xl font-bold text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95">ENTENDIDO, CONTINUAR</button>
              </div>
          </div>
      )}

      {showFacturaRestriction && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
              <div className="bg-white rounded-[3rem] w-full max-sm p-10 text-center shadow-2xl">
                  <div className="bg-rose-100 text-rose-600 p-6 rounded-3xl mb-8 inline-block shadow-inner"><ShieldAlert size={48} strokeWidth={3} /></div>
                  <h4 className="text-2xl font-bold text-slate-900 uppercase tracking-tight mb-4 leading-none">Restricción Fiscal</h4>
                  <p className="text-slate-500 font-bold text-xs uppercase leading-relaxed mb-10 tracking-wide">Para emitir una <b>Factura</b> electrónica, es obligatorio seleccionar un cliente con número de <b>RUC</b> válido.</p>
                  <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => { setShowFacturaRestriction(false); setIsClientModalOpen(true); }} 
                        className="w-full py-4 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                        style={{ backgroundColor: primaryColor }}
                      >
                        EDITAR O CREAR CLIENTE
                      </button>
                      <button onClick={() => setShowFacturaRestriction(false)} className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase hover:text-slate-600 transition-colors">CANCELAR</button>
                  </div>
              </div>
          </div>
      )}

      {showSunatThresholdModal && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
              <div className="bg-white rounded-[3rem] w-full max-w-md p-10 text-center shadow-2xl">
                  <div className="bg-amber-100 text-amber-600 p-6 rounded-3xl mb-8 inline-block shadow-inner"><AlertTriangle size={48} strokeWidth={3} /></div>
                  <h4 className="text-2xl font-bold text-slate-900 uppercase tracking-tight mb-4 leading-none text-center">Restricción de Sunat</h4>
                  <p className="text-slate-500 font-bold text-sm uppercase leading-relaxed mb-10 tracking-wide">
                      No puede generar boletas mayores a {company.doc_enforce_threshold || 700} sin DNI
                  </p>
                  <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => { setShowSunatThresholdModal(false); setIsClientModalOpen(true); }} 
                        className="w-full py-4 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                        style={{ backgroundColor: primaryColor }}
                      >
                        EDITAR O CREAR CLIENTE
                      </button>
                      <button onClick={() => setShowSunatThresholdModal(false)} className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase hover:text-slate-600 transition-colors">CANCELAR</button>
                  </div>
              </div>
          </div>
      )}

      <AnimatePresence>
        {showNoClientAlert && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-none p-4">
             <motion.div 
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                className="bg-white border-2 border-slate-200 shadow-2xl rounded-[2rem] px-10 py-6 flex flex-col items-center gap-4"
             >
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 animate-pulse">
                   <ShieldAlert size={32} />
                </div>
                <div className="text-center">
                  <h3 className="font-black text-slate-900 uppercase tracking-tighter text-2xl leading-none">Falta Cliente</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 italic">Seleccione un cliente para continuar</p>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PointOfSale;
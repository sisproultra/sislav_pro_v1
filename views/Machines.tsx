import React, { useState, useEffect } from 'react';
import { Machine, MachineImage, Invoice } from '../types';
import { WashingMachine, Plus, Timer, Wrench, Ticket, History, Scale, Wind, X, CheckCircle2, BarChart3, Activity, User, Layers, Upload, Trash2, Image as ImageIcon, ArrowRight, Shirt, Unlock, Edit2, AlertCircle, Loader2, RotateCcw, Settings2, ShieldAlert, Trash, Calendar, ImagePlus, Check, Camera } from 'lucide-react';
import { dbGetMachineImages, dbAddMachineImage, dbDeleteMachineImage, dbUpdateMachineImage, dbGetMachines, dbUploadImage, getActiveBranchId } from '../services/dbService';
import ConfirmationModal from '../components/ConfirmationModal';

interface MachinesProps {
  machines: Machine[];
  invoices: Invoice[]; 
  activeItems?: any[];
  onAddMachine: (machine: Omit<Machine, 'id' | 'totalOrders' | 'totalKg' | 'totalMinutes' | 'totalCycles'>) => Promise<void>;
  onUpdateMachineStatus: (id: string, updates: Partial<Machine>) => Promise<void>;
  onSyncMachines: () => Promise<void>;
  globalMachineImages?: MachineImage[];
  canManage?: boolean;
}

const Machines: React.FC<MachinesProps> = ({ machines: propMachines, invoices, activeItems = [], onAddMachine, onUpdateMachineStatus, onSyncMachines, globalMachineImages = [], canManage = true }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null); 
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  const [machineToAnul, setMachineToAnul] = useState<Machine | null>(null);
  const [isReleaseConfirmOpen, setIsReleaseConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<'LAVADORA' | 'SECADORA'>('LAVADORA');
  const [capacity, setCapacity] = useState('');
  const [selectedImage, setSelectedImage] = useState('');

  const handleUpdateThresholds = async () => {
    if (!selectedMachine) return;
    setIsSaving(true);
    try {
        const updates = {
            maintenanceIntervalHours: parseFloat(maintHours) || 1000,
            maintenanceIntervalKg: parseFloat(maintKg) || 5000,
            maintenanceIntervalCycles: parseFloat(maintCycles) || 500
        };
        await onUpdateMachineStatus(selectedMachine.id, updates);
        setLocalMachines(prev => prev.map(m => m.id === selectedMachine.id ? { ...m, ...updates } : m));
        setIsConfigOpen(false);
    } catch (e) {
        alert("Error al guardar cambios");
    } finally {
        setIsSaving(false);
    }
  };

  const handleSync = async () => {
      setIsSyncing(true);
      try {
          await onSyncMachines();
      } catch (e) {
          console.error(e);
      } finally {
          setIsSyncing(false);
      }
  };
  
  const [maintHours, setMaintHours] = useState('1000'); 
  const [maintKg, setMaintKg] = useState('5000'); 
  const [maintCycles, setMaintCycles] = useState('500');

  const [imageLibrary, setIsLibrary] = useState<MachineImage[]>([]);
  const [newCatalogImageName, setNewCatalogImageName] = useState('');
  const [newCatalogImageType, setNewCatalogImageType] = useState<'LAVADORA' | 'SECADORA'>('LAVADORA');
  const [newCatalogImageUrl, setNewCatalogImageUrl] = useState('');
  const [editingCatalogImage, setEditingCatalogImage] = useState<MachineImage | null>(null);

  const [localMachines, setLocalMachines] = useState<Machine[]>(propMachines);

  useEffect(() => {
    if (isConfigOpen && selectedMachine) {
        setMaintHours((selectedMachine.maintenanceIntervalHours ?? 1000).toString());
        setMaintKg((selectedMachine.maintenanceIntervalKg ?? 5000).toString());
        setMaintCycles((selectedMachine.maintenanceIntervalCycles ?? 500).toString());
    }
  }, [isConfigOpen, selectedMachine]);

  useEffect(() => {
      setLocalMachines(propMachines);
  }, [propMachines]);

  useEffect(() => {
      loadLibrary();
  }, [globalMachineImages]);

  const loadLibrary = async () => {
      const data = await dbGetMachineImages();
      const combined = [...data, ...globalMachineImages];
      const uniqueItems = Array.from(new Map(combined.map(item => [item.url, item])).values());
      setIsLibrary(uniqueItems);
  };

  const handleSaveCatalogImage = async () => {
      if (!newCatalogImageName || !newCatalogImageUrl || isUploading) return;
      
      if (editingCatalogImage) {
          await dbUpdateMachineImage(editingCatalogImage.id, {
              name: newCatalogImageName,
              type: newCatalogImageType,
              url: newCatalogImageUrl
          });
          setEditingCatalogImage(null);
      } else {
          await dbAddMachineImage({
              name: newCatalogImageName,
              type: newCatalogImageType,
              url: newCatalogImageUrl
          });
      }
      
      setNewCatalogImageName('');
      setNewCatalogImageUrl('');
      await loadLibrary();
  };

  const handleEditCatalogItem = (img: MachineImage) => {
      setEditingCatalogImage(img);
      setNewCatalogImageName(img.name);
      setNewCatalogImageType(img.type);
      setNewCatalogImageUrl(img.url);
  };

  const cancelCatalogEdit = () => {
      setEditingCatalogImage(null);
      setNewCatalogImageName('');
      setNewCatalogImageUrl('');
  };

  const confirmDeleteImage = async () => {
      if (imageToDelete) {
          await dbDeleteMachineImage(imageToDelete);
          setImageToDelete(null);
          await loadLibrary();
      }
  };

  const handleAnulMachine = async () => {
      if (!machineToAnul) return;
      setIsSaving(true);
      try {
          await onUpdateMachineStatus(machineToAnul.id, { activo: false });
          setLocalMachines(prev => prev.filter(m => m.id !== machineToAnul.id));
          setSelectedMachine(null);
          setIsConfigOpen(false);
          setMachineToAnul(null);
      } catch (e) {
          alert("Error al anular equipo");
      } finally {
          setIsSaving(false);
      }
  };

  const handleCatalogImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsUploading(true);
          try {
              const fileName = `machine_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
              const publicUrl = await dbUploadImage('laundry-assets', file, fileName);
              setNewCatalogImageUrl(publicUrl);
          } catch (err) {
              alert("Error al subir imagen al storage.");
          } finally {
              setIsUploading(false);
          }
      }
  };

  const handleSelectFromCatalog = async (img: MachineImage) => {
      if (isConfigOpen && selectedMachine) {
          try {
              await onUpdateMachineStatus(selectedMachine.id, { imageUrl: img.url });
              setSelectedMachine({ ...selectedMachine, imageUrl: img.url });
              setLocalMachines(prev => prev.map(m => m.id === selectedMachine.id ? { ...m, imageUrl: img.url } : m));
          } catch (e) {
              alert("Error al actualizar imagen");
          }
      } else {
          setSelectedImage(img.url);
      }
      setIsCatalogModalOpen(false);
  };

  const handleDirectImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditing = false) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsUploading(true);
          try {
              const fileName = `machine_custom_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
              const publicUrl = await dbUploadImage('laundry-assets', file, fileName);
              
              if (isEditing && selectedMachine) {
                  await onUpdateMachineStatus(selectedMachine.id, { imageUrl: publicUrl });
                  setSelectedMachine({ ...selectedMachine, imageUrl: publicUrl });
                  setLocalMachines(prev => prev.map(m => m.id === selectedMachine.id ? { ...m, imageUrl: publicUrl } : m));
              } else {
                  setSelectedImage(publicUrl);
              }
          } catch (err) {
              alert("Error al subir imagen al storage.");
          } finally {
              setIsUploading(false);
          }
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSaving || isUploading) return;

      setIsSaving(true);
      try {
          const defaultImg = type === 'LAVADORA' 
            ? 'https://png.pngtree.com/png-clipart/20230928/ourmid/pngtree-washing-machine-isolated-on-background-png-image_10149539.png'
            : 'https://png.pngtree.com/png-clipart/20231001/original/pngtree-3d-modern-washing-machine-isolated-png-image_13222338.png';

          await onAddMachine({
              sucursal_id: getActiveBranchId() || '',
              name: name.toUpperCase(),
              type,
              capacityKg: parseFloat(capacity) || 0,
              estado_operativo: 'DISPONIBLE',
              imageUrl: selectedImage || defaultImg,
              maintenanceIntervalHours: parseFloat(maintHours) || 1000,
              maintenanceIntervalKg: parseFloat(maintKg) || 5000,
              maintenanceIntervalCycles: parseFloat(maintCycles) || 500,
              activo: true,
              estado: 'OPERATIVO'
          });
          
          setIsAddModalOpen(false);
          resetForm();
      } catch (error: any) {
          const detailedError = error.message || (error.error ? error.error.message : JSON.stringify(error));
          console.error("Error al registrar equipo:", detailedError);
          alert(`ERROR AL REGISTRAR: ${detailedError}`);
      } finally {
          setIsSaving(false);
      }
  };

  const resetForm = () => {
      setName('');
      setCapacity('');
      setSelectedImage('');
      setType('LAVADORA');
      setMaintHours('1000');
      setMaintKg('5000');
      setMaintCycles('500');
  };

  const handleForceRelease = async () => {
      if (!selectedMachine || !onUpdateMachineStatus) return;
      
      setIsSaving(true);
      try {
          const updates = {
              estado_operativo: 'DISPONIBLE' as const,
              currentOrderId: null,
              startTime: null,
              estimatedDuration: null
          };
          await onUpdateMachineStatus(selectedMachine.id, updates);
          setLocalMachines(prev => prev.map(m => m.id === selectedMachine.id ? { ...m, ...updates } : m));
          
          setIsReleaseConfirmOpen(false);
          setSelectedMachine(null);
      } catch (e) {
          alert("Error al liberar la máquina. Intente de nuevo.");
      } finally {
          setIsSaving(false);
      }
  };

  const calculateHealth = (machine: Machine) => {
      if (!machine.maintenanceIntervalHours) return 100;
      const hoursUsed = machine.totalMinutes / 60;
      const percentUsed = (hoursUsed / machine.maintenanceIntervalHours) * 100;
      return Math.max(0, 100 - percentUsed);
  };

  const getActiveOrder = (machine: Machine) => {
      if (!machine.currentOrderId) return null;
      const primaryOrderId = machine.currentOrderId.split(',')[0];
      return invoices.find(inv => inv.id === primaryOrderId);
  };

  const washers = localMachines.filter(m => m.type === 'LAVADORA');
  const dryers = localMachines.filter(m => m.type === 'SECADORA');

  const renderMachineGrid = (machineList: Machine[], title: string, icon: React.ReactNode, titleColor: string) => {
      if (machineList.length === 0) return null;

      return (
        <div className="mb-6">
            <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 uppercase tracking-wider ${titleColor} ml-1`}>
                {icon} {title} <span className="text-slate-600 ml-2 text-[10px] bg-slate-900 px-2 py-0.5 rounded-full">{machineList.length}</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4 justify-items-center sm:justify-start">
                {machineList.map(machine => {
                    const targetStatus = machine.type === 'LAVADORA' ? 'EN_LAVADO' : 'EN_SECADO';
                    const assignedOrderIds = machine.currentOrderId?.split(',').map(id => id.trim()).filter(id => !!id) || [];
                    
                    // Verificamos si hay items activos en la base de datos para esta máquina
                    const hasActiveItems = activeItems.some(item => 
                        assignedOrderIds.includes(item.venta_id) && 
                        item.estado === targetStatus
                    );
                    
                    const isBusy = machine.estado_operativo === 'OCUPADO' && hasActiveItems;
                    const currentOrder = getActiveOrder(machine);
                    const percentDone = isBusy && machine.startTime && machine.estimatedDuration 
                        ? Math.min(100, ((new Date().getTime() - new Date(machine.startTime).getTime()) / (machine.estimatedDuration * 60000)) * 100) 
                        : 0;
                    
                    let timeLeft = 0;
                    if(isBusy && machine.estimatedDuration && machine.startTime) {
                        const elapsed = (new Date().getTime() - new Date(machine.startTime).getTime()) / 60000;
                        timeLeft = Math.max(0, Math.round(machine.estimatedDuration - elapsed));
                    }
                    const health = calculateHealth(machine);
                    
                    return (
                        <div 
                            key={machine.id} 
                            onClick={() => { setSelectedMachine(machine); setIsConfigOpen(false); }}
                            className={`relative group rounded-2xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] bg-slate-900 border cursor-pointer ${isBusy ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-slate-800 hover:border-cyan-500/50'} w-full aspect-[2/3] sm:w-[230px] sm:h-[345px] lg:w-[4.2cm] lg:h-[6.18cm] flex-shrink-0`}
                        >
                            <div className="absolute inset-0 z-0 bg-slate-900 p-4 pb-16 flex items-center justify-center">
                                <img 
                                    src={machine.imageUrl} 
                                    alt={machine.name} 
                                    className="w-full h-full object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-110"
                                />
                            </div>
                            <div className="absolute top-2 left-2 z-20">
                                <div className={`px-2 py-0.5 rounded-full backdrop-blur-md border border-white/10 flex items-center gap-1 shadow-lg ${isBusy ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${isBusy ? 'bg-white animate-pulse' : 'bg-white'}`}></div>
                                    <span className="text-[9px] font-bold uppercase tracking-wide leading-none">
                                        {isBusy ? 'OCUPADO' : 'DISPONIBLE'}
                                    </span>
                                </div>
                            </div>
                            <div className="absolute top-2 right-2 z-20">
                                <span className="text-[9px] font-bold text-white bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-700 backdrop-blur-md">
                                    {machine.capacityKg}Kg
                                </span>
                            </div>
                            <div className="absolute inset-0 z-30 flex flex-col justify-center items-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-[1px]">
                                {isBusy ? (
                                    <div className="text-center animate-in zoom-in-95 w-full px-4">
                                        <div className="mb-2">
                                            <span className="text-4xl font-bold text-white">{timeLeft}</span>
                                            <span className="text-xs text-slate-300 font-bold ml-1">min</span>
                                        </div>
                                        <div className="bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-700 w-full shadow-lg">
                                            <div className="flex items-center justify-center gap-1 text-yellow-400 font-bold text-xs border-b border-white/10 pb-1 mb-1">
                                                <Ticket size={12}/> #{currentOrder?.ordenNumber || '--'}
                                            </div>
                                            <div className="flex items-center justify-center gap-1 text-white font-medium text-[10px] truncate">
                                                <User size={10} className="text-cyan-400" />
                                                {currentOrder?.client.name || 'Cliente'}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center animate-in zoom-in-95">
                                        <div className="bg-cyan-500 text-white p-3 rounded-full mb-2 mx-auto w-fit shadow-lg shadow-cyan-500/30">
                                            <BarChart3 size={24} />
                                        </div>
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Ver Detalles</span>
                                    </div>
                                )}
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 z-20 bg-slate-950/95 border-t border-slate-800 px-3 py-2">
                                <div className="flex justify-between items-center mb-1">
                                    <h3 className="text-white font-bold text-[10px] uppercase truncate leading-none w-full">
                                        {machine.name}
                                    </h3>
                                    <div className={`h-1.5 h-1.5 rounded-full shrink-0 ml-2 ${health > 70 ? 'bg-emerald-50' : (health > 30 ? 'bg-yellow-500' : 'bg-red-500')}`} title="Estado Salud"></div>
                                </div>
                                {isBusy ? (
                                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                                        <div 
                                            className="h-full bg-gradient-to-r from-red-600 to-red-400 animate-pulse"
                                            style={{ width: `${percentDone}%` }}
                                        ></div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-end">
                                        <div className="text-center w-1/3 border-r border-slate-800 pr-1">
                                            <div className="text-[14px] font-bold text-amber-400 leading-none">
                                                {machine.totalCycles}
                                            </div>
                                            <div className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">Ciclos</div>
                                        </div>
                                        <div className="text-center w-1/3 border-r border-slate-800 px-1">
                                            <div className="text-[14px] font-bold text-cyan-400 leading-none">
                                                {machine.totalKg.toFixed(0)}
                                            </div>
                                            <div className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">Kilos</div>
                                        </div>
                                        <div className="text-center w-1/3 pl-1">
                                            <div className="text-[14px] font-bold text-fuchsia-400 leading-none">
                                                {(machine.totalMinutes / 60).toFixed(0)}
                                            </div>
                                            <div className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">Horas</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      );
  };

  return (
    <div className="p-4 h-full overflow-y-auto bg-slate-950 relative no-scrollbar">
      <div className="max-w-[1920px] mx-auto space-y-4">
        
        <div className="flex items-center justify-between mb-2 px-1">
           <div className="flex items-center gap-2">
              <WashingMachine size={18} className="text-cyan-400" />
              <h2 className="text-sm font-bold text-white tracking-widest uppercase">Mis Máquinas</h2>
           </div>
           <div className="flex items-center gap-2">
              {canManage && (
                <button 
                   onClick={handleSync}
                   disabled={isSyncing}
                   className={`p-2 text-slate-400 hover:text-emerald-400 bg-slate-900 border border-slate-800 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 ${isSyncing ? 'animate-pulse cursor-not-allowed' : ''}`}
                   title="Sincronizar Estados"
                >
                   <RotateCcw size={20} className={isSyncing ? 'animate-spin' : ''} />
                </button>
              )}
              {canManage && (
                <button 
                   onClick={() => setIsCatalogModalOpen(true)}
                   className="p-2 text-slate-400 hover:text-cyan-400 bg-slate-900 border border-slate-800 rounded-xl transition-all shadow-lg hover:shadow-cyan-500/20"
                   title="Catálogo de Máquinas"
                >
                   <Layers size={20} />
                </button>
              )}
           </div>
        </div>

        <div className="pb-24">
            {renderMachineGrid(washers, 'LAVADO', <WashingMachine size={16} className="text-blue-400"/>, 'text-blue-400')}
            {washers.length > 0 && dryers.length > 0 && <div className="h-px bg-slate-800/30 my-4 w-full"></div>}
            {renderMachineGrid(dryers, 'SECADORA', <Wind size={16} className="text-orange-400"/>, 'text-orange-400')}
        </div>

        {canManage && (
          <button
              onClick={() => { resetForm(); setIsAddModalOpen(true); }}
              className="fixed bottom-8 right-8 z-40 bg-indigo-600 hover:bg-indigo-50 text-white p-4 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:scale-110 active:scale-95 transition-all duration-300 border-4 border-slate-900"
              title="Agregar Equipo"
          >
              <Plus size={32} strokeWidth={3} />
          </button>
        )}

      </div>

      {isCatalogModalOpen && (
          <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                      <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Layers size={20}/></div>
                          <div>
                              <h3 className="font-bold text-gray-900 text-lg">Catálogo Visual de Máquinas</h3>
                              <p className="text-xs text-gray-500">
                                {isAddModalOpen ? 'Haga clic en una imagen para seleccionarla para su nuevo equipo.' : 'Gestiona las imágenes de los modelos de lavadoras y secadoras.'}
                              </p>
                          </div>
                      </div>
                      <button onClick={() => setIsCatalogModalOpen(false)} className="bg-white p-1 rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 space-y-8">
                      {!isAddModalOpen && (
                        <div className={`p-6 rounded-xl border shadow-sm transition-colors ${editingCatalogImage ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    {editingCatalogImage ? <Edit2 size={18} className="text-indigo-600" /> : <Plus size={18} />} 
                                    {editingCatalogImage ? 'Editar Modelo del Catálogo' : 'Agregar Nuevo Modelo al Catálogo'}
                                </h3>
                                {editingCatalogImage && (
                                    <button onClick={cancelCatalogEdit} className="text-xs font-bold text-red-500 hover:underline">Cancelar Edición</button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Tipo</label>
                                    <select 
                                      value={newCatalogImageType} 
                                      onChange={e => setNewCatalogImageType(e.target.value as any)}
                                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                                    >
                                        <option value="LAVADORA">LAVADORA</option>
                                        <option value="SECADORA">SECADORA</option>
                                    </select>
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Nombre Descriptivo</label>
                                    <input 
                                      value={newCatalogImageName} 
                                      onChange={e => setNewCatalogImageName(e.target.value)}
                                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                                      placeholder="Ej: LG Frontal 20kg"
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Imagen</label>
                                    <div className="flex gap-2">
                                        {newCatalogImageUrl ? (
                                            <div className="relative w-10 h-10 border rounded bg-gray-100 flex-shrink-0">
                                                {isUploading ? <Loader2 className="animate-spin" size={14} /> : <img src={newCatalogImageUrl} className="w-full h-full object-contain"/>}
                                                <button type="button" onClick={() => setNewCatalogImageUrl('')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X size={10}/></button>
                                            </div>
                                        ) : (
                                            <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg flex items-center justify-center h-10 w-full text-xs font-bold text-gray-600 transition-colors">
                                                {isUploading ? <Loader2 className="animate-spin mr-1"/> : <Upload size={14} className="mr-1"/>} 
                                                {isUploading ? 'Subiendo' : 'Subir'}
                                                <input type="file" accept="image/*" className="hidden" onChange={handleCatalogImageUpload} disabled={isUploading} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                                <div className="md:col-span-1">
                                    <button 
                                      onClick={handleSaveCatalogImage}
                                      disabled={!newCatalogImageName || !newCatalogImageUrl || isUploading}
                                      className={`w-full text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${editingCatalogImage ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        {editingCatalogImage ? 'Actualizar Modelo' : 'Guardar Modelo'}
                                    </button>
                                </div>
                            </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {imageLibrary.map(img => (
                              <div 
                                key={img.id} 
                                onClick={() => isAddModalOpen ? handleSelectFromCatalog(img) : null}
                                className={`group relative bg-white border rounded-xl overflow-hidden transition-all ${isAddModalOpen ? 'cursor-pointer hover:border-indigo-500 hover:shadow-xl' : 'hover:shadow-md'} ${editingCatalogImage?.id === img.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'}`}
                              >
                                  <div className="aspect-square bg-gray-50 p-4 flex items-center justify-center">
                                      <img src={img.url} alt={img.name} className="max-w-full max-h-full object-contain" />
                                  </div>
                                  <div className="p-3 border-t border-gray-100 bg-white">
                                      <p className="font-bold text-xs text-gray-800 truncate">{img.name}</p>
                                      <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block uppercase">
                                          {img.type}
                                      </span>
                                  </div>
                                  
                                  {!isAddModalOpen && (
                                    <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                          onClick={() => handleEditCatalogItem(img)}
                                          className="bg-white/95 text-indigo-600 p-1.5 rounded-full hover:bg-indigo-50 shadow-md border border-gray-100"
                                          title="Editar"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button 
                                          onClick={() => setImageToDelete(img.id)}
                                          className="bg-white/95 text-red-500 p-1.5 rounded-full hover:bg-red-50 shadow-md border border-gray-100"
                                          title="Eliminar"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                  )}
                                  
                                  {isAddModalOpen && (
                                      <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <div className="bg-indigo-600 text-white p-3 rounded-full shadow-2xl">
                                              <CheckCircle2 size={32} />
                                          </div>
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      <ConfirmationModal 
          isOpen={!!imageToDelete} 
          onClose={() => setImageToDelete(null)} 
          onConfirm={confirmDeleteImage} 
          title="¿Eliminar del Catálogo?" 
          message="Esta imagen ya no estará disponible para seleccionar en nuevos equipos." 
          isDangerous={true} 
      />

      <ConfirmationModal 
          isOpen={!!machineToAnul} 
          onClose={() => setMachineToAnul(null)} 
          onConfirm={handleAnulMachine} 
          title="¿Anular Máquina?" 
          message="El equipo dejará de aparecer en el panel operativo inmediatamente." 
          isDangerous={true} 
      />

      <ConfirmationModal 
          isOpen={isReleaseConfirmOpen} 
          onClose={() => setIsReleaseConfirmOpen(false)} 
          onConfirm={handleForceRelease} 
          title="¿Liberar Máquina Manualmente?" 
          message={`¿Estás seguro de liberar la máquina "${selectedMachine?.name}"? Esta acción borrará la orden activa y reiniciará el contador de tiempo inmediatamente.`} 
          isDangerous={true} 
          confirmText="SÍ, LIBERAR"
      />

      {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/90 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh] animate-in zoom-in-95">
                  <div className="p-8 border-b border-white/5 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-3">
                          <Plus className="text-indigo-500" size={24} />
                          <h3 className="font-bold text-2xl text-white uppercase tracking-tight">Registrar Equipo</h3>
                      </div>
                      <button onClick={() => setIsAddModalOpen(false)} className="text-white/40 hover:text-white p-2 rounded-full transition-colors"><X size={28}/></button>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="p-10 space-y-6 overflow-y-auto flex-1 no-scrollbar">
                      <div className="flex justify-center gap-6 mb-8">
                          {selectedImage ? (
                              <div className="relative group w-32 h-32">
                                  <div className="w-full h-full bg-black/40 rounded-[2.5rem] border-2 border-indigo-500/30 flex items-center justify-center overflow-hidden shadow-inner">
                                      <img src={selectedImage} className="w-full h-full object-contain p-4 transition-transform group-hover:scale-110" />
                                  </div>
                                  <button 
                                      type="button" 
                                      onClick={() => setSelectedImage('')}
                                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-all z-10"
                                  >
                                      <X size={14} />
                                  </button>
                              </div>
                          ) : (
                              <>
                                  <div 
                                      onClick={() => setIsCatalogModalOpen(true)}
                                      className="w-32 h-32 bg-black/40 rounded-[2.5rem] border-2 border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-all group overflow-hidden relative shadow-inner"
                                  >
                                      <Layers size={32} className="text-slate-600 mb-2 group-hover:text-indigo-400" />
                                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Catálogo</span>
                                  </div>

                                  <label className="w-32 h-32 bg-black/40 rounded-[2.5rem] border-2 border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-all group overflow-hidden relative shadow-inner">
                                      {isUploading ? (
                                          <Loader2 size={32} className="text-emerald-400 animate-spin" />
                                      ) : (
                                          <Camera size={32} className="text-slate-600 mb-2 group-hover:text-emerald-400" />
                                      )}
                                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                          {isUploading ? 'Subiendo' : 'Tomar Foto'}
                                      </span>
                                      <input 
                                          type="file" 
                                          accept="image/*" 
                                          className="hidden" 
                                          onChange={(e) => handleDirectImageUpload(e, false)}
                                          disabled={isUploading}
                                          capture="environment"
                                      />
                                  </label>
                              </>
                          )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2 space-y-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre Identificador</label>
                              <input required value={name} onChange={e => setName(e.target.value.toUpperCase())} className="w-full bg-slate-800 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold outline-none focus:ring-4 focus:ring-indigo-600/20 uppercase" placeholder="EJ: L01 - SAMSUNG" />
                          </div>
                          <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo de Máquina</label>
                              <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-slate-800 border border-white/5 rounded-2xl px-4 py-4 text-white font-bold outline-none appearance-none cursor-pointer">
                                  <option value="LAVADORA">LAVADORA</option>
                                  <option value="SECADORA">SECADORA</option>
                              </select>
                          </div>
                          <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Capacidad (Kg)</label>
                              <div className="relative">
                                  <Scale size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                  <input required type="number" step="0.1" value={capacity} onChange={e => setCapacity(e.target.value)} className="w-full bg-slate-800 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white font-bold outline-none" placeholder="20.0" />
                              </div>
                          </div>
                      </div>

                      <button type="submit" disabled={isSaving || !selectedImage} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-3xl font-bold text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3">
                          {isSaving ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} strokeWidth={3} />} GUARDAR EQUIPO EN SISTEMA
                      </button>
                  </form>
              </div>
          </div>
      )}

      {selectedMachine && !isConfigOpen && (
          <div className="fixed inset-0 bg-black/90 z-[150] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-slate-900 rounded-[3rem] w-full max-w-lg shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                  <div className="p-8 border-b border-white/5 bg-slate-900/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-800 p-2.5 rounded-xl border border-white/5 shadow-inner">
                            {selectedMachine.type === 'LAVADORA' ? <WashingMachine size={20} className="text-blue-400" /> : <Wind size={20} className="text-orange-400" />}
                        </div>
                        <h3 className="font-bold text-xl text-white uppercase tracking-tight">{selectedMachine.name}</h3>
                    </div>
                    <button onClick={() => setSelectedMachine(null)} className="text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
                  </div>

                  <div className="p-10 space-y-8 overflow-y-auto flex-1 no-scrollbar">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/5 p-4 rounded-3xl text-center border border-white/5">
                            <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">TOTAL KILOS</p>
                            <p className="text-2xl font-bold text-cyan-400 tabular-nums">{selectedMachine.totalKg.toFixed(1)}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-3xl text-center border border-white/5">
                            <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">TOTAL CICLOS</p>
                            <p className="text-2xl font-bold text-amber-400 tabular-nums">{selectedMachine.totalCycles}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-3xl text-center border border-white/5">
                            <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">TOTAL HORAS</p>
                            <p className="text-2xl font-bold text-fuchsia-400 tabular-nums">{(selectedMachine.totalMinutes / 60).toFixed(0)}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <div className="flex items-center gap-2"><Activity size={14} className="text-indigo-400" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Salud del Motor</span></div>
                            <span className="text-[10px] font-bold text-white">{calculateHealth(selectedMachine).toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-black/40 h-3 rounded-full border border-white/5 overflow-hidden p-0.5">
                            <div className={`h-full rounded-full transition-all duration-1000 ${calculateHealth(selectedMachine) > 70 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : (calculateHealth(selectedMachine) > 30 ? 'bg-yellow-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]')}`} style={{ width: `${calculateHealth(selectedMachine)}%` }} />
                        </div>
                    </div>

                    {selectedMachine.estado_operativo === 'OCUPADO' && (
                        <div className="bg-indigo-600/10 border border-indigo-500/20 p-6 rounded-[2rem] flex flex-col gap-4 animate-in slide-in-from-bottom-2">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3 text-indigo-400 font-bold text-xs uppercase tracking-widest"><Timer size={18} /> Ciclo en curso</div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Orden Activa</p>
                                    <p className="text-sm font-bold text-white">#{getActiveOrder(selectedMachine)?.ordenNumber || '--'}</p>
                                </div>
                            </div>
                             {canManage && (
                               <button 
                                 onClick={() => setIsReleaseConfirmOpen(true)}
                                 className="w-full py-4 bg-white/5 border border-white/10 hover:bg-red-600 text-slate-400 hover:text-white rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group"
                               >
                                   <Unlock size={14} /> LIBERAR MANUALMENTE
                               </button>
                             )}
                        </div>
                    )}

                    <div className="flex gap-4">
                        {canManage && (
                            <button 
                                onClick={() => setIsConfigOpen(true)}
                                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <Settings2 size={16} /> CONFIGURAR
                            </button>
                        )}
                        <button 
                            className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            <History size={16} /> BITÁCORA
                        </button>
                    </div>
                  </div>
              </div>
          </div>
      )}

      {selectedMachine && isConfigOpen && (
          <div className="fixed inset-0 bg-black/90 z-[160] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="p-8 border-b border-white/5 bg-slate-900/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 p-2.5 rounded-xl"><Settings2 size={20} className="text-white" /></div>
                        <h3 className="font-bold text-xl text-white uppercase tracking-tight">Ajustes Técnicos</h3>
                    </div>
                    <button onClick={() => setIsConfigOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
                </div>
                <div className="p-10 space-y-8 overflow-y-auto flex-1 no-scrollbar">
                    <div className="flex flex-col items-center gap-4 bg-slate-800/50 p-6 rounded-3xl border border-white/5">
                        <div className="relative group w-24 h-24">
                            <div className="w-full h-full bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden">
                                <img src={selectedMachine.imageUrl} className="w-full h-full object-contain p-2" />
                            </div>
                        </div>
                        <div className="flex gap-2 w-full">
                            <button 
                                type="button"
                                onClick={() => setIsCatalogModalOpen(true)}
                                className="flex-1 py-3 bg-slate-900 hover:bg-slate-700 text-white rounded-xl font-bold text-[9px] uppercase tracking-widest border border-white/5 flex items-center justify-center gap-2 transition-all"
                            >
                                <Layers size={14} /> CATÁLOGO
                            </button>
                            <label className="flex-1 py-3 bg-slate-900 hover:bg-slate-700 text-white rounded-xl font-bold text-[9px] uppercase tracking-widest border border-white/5 flex items-center justify-center gap-2 cursor-pointer transition-all">
                                {isUploading ? <Loader2 size={14} className="animate-spin text-emerald-400" /> : <Camera size={14} className="text-emerald-400" />}
                                <span className="truncate">{isUploading ? 'SUBIENDO...' : 'TOMAR FOTO'}</span>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => handleDirectImageUpload(e, true)}
                                    disabled={isUploading}
                                    capture="environment"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 space-y-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Umbrales de Mantenimiento</h4>
                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Horas Máximas de Vida</label><input type="number" value={maintHours} onChange={e => setMaintHours(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl py-3 px-4 text-white font-bold outline-none focus:border-indigo-500" /></div>
                            <div className="space-y-1"><label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Kilos Máximos</label><input type="number" value={maintKg} onChange={e => setMaintKg(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-2xl py-3 px-4 text-white font-bold outline-none focus:border-indigo-500" /></div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setMachineToAnul(selectedMachine)}
                        className="w-full py-4 bg-red-600/10 border border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                        <Trash size={16}/> ANULAR / RETIRAR EQUIPO
                    </button>

                    <button 
                        onClick={handleUpdateThresholds}
                        disabled={isSaving}
                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-3xl font-bold text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex justify-center items-center gap-3"
                    >
                        {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} strokeWidth={3} />} GUARDAR CAMBIOS
                    </button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default Machines;
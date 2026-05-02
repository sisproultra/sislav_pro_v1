import React, { useState, useEffect } from 'react';
import { Building, Upload, Image as ImageIcon, Save, CheckCircle2, Settings as SettingsIcon, X, Clock, Loader2, FileText, Layout, Sparkles, ShieldCheck, DollarSign, Cpu } from 'lucide-react';
import { Company, Sucursal, UserRole } from '../types';
import { dbUploadImage, dbGetTicketConfig, dbSaveTicketConfig, getActiveHoldingId, dbUpdateSucursalConfig, supabase } from '../services/dbService';
import { APP_VERSION } from '../components/VersionGuard';

interface SettingsProps {
  company: Sucursal;
  setCompany: (c: Sucursal) => void;
  user?: any;
}

const Settings: React.FC<SettingsProps> = ({ company, setCompany, user }) => {
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingVersion, setIsUpdatingVersion] = useState(false);
  
  const [primaryColor, setPrimaryColor] = useState(company.primaryColor || '#0054A6');
  const [secondaryColor, setSecondaryColor] = useState(company.secondaryColor || '#10B981');

  const [minVersionInput, setMinVersionInput] = useState(APP_VERSION);

  // Estado para la configuración de ticket
  const [ticketConfig, setTicketConfig] = useState({
      politicas: '',
      url_imagen_promocional: '',
      horario_atencion: '',
      url_logo_ticket: '',
      logo_ticket_size: 100,
      mostrar_codigo_barras: true
  });

  const normalizeStr = (str: string) => 
    (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  useEffect(() => {
      const p = (company as any).color_primario || company.primaryColor || '#0054A6';
      const s = (company as any).color_secundario || company.secondaryColor || '#10B981';
      setPrimaryColor(p);
      setSecondaryColor(s);

      // Cargar configuración de ticket
      const fetchTicket = async () => {
          try {
              const data = await dbGetTicketConfig(company.id);
              if (data) {
                  setTicketConfig({
                      politicas: data.politicas || '',
                      url_imagen_promocional: data.url_imagen_promocional || '',
                      horario_atencion: data.horario_atencion || '',
                      url_logo_ticket: data.url_logo_ticket || '',
                      logo_ticket_size: data.logo_ticket_size || 100,
                      mostrar_codigo_barras: data.mostrar_codigo_barras !== false
                  });
              }
          } catch (err) {
              console.error("Error al cargar configuración de ticket:", err);
          }
      };
      fetchTicket();
  }, [company]);

  const handleAssetUpload = async (field: 'url_logo_ticket' | 'url_imagen_promocional', e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsUploading(field);
          try {
              // Limpieza de nombres para rutas de storage (mismo que saasService)
              const cleanHolding = (company.holding_name || 'holding_default').trim().toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const branchSlug = (company.slug || company.razonSocial || 'sucursal').trim().toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              
              const fileExt = file.name.split('.').pop();
              const fileName = `${field}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
              
              // Usar la misma estructura que uploadBranchAsset para consistencia y permisos
              const storagePath = `global/empresa/${cleanHolding}/${branchSlug}/tickets/${fileName}`;
              
              console.log(`Uploading ${field} to bucket 'laundry-assets' at path: ${storagePath}`);
              const publicUrl = await dbUploadImage('laundry-assets', file, storagePath);
              console.log(`Upload successful: ${publicUrl}`);
              
              setTicketConfig(prev => ({ ...prev, [field]: publicUrl }));
          } catch (err: any) {
              console.error("Error detallado al subir imagen:", err);
              alert(`Error al subir la imagen: ${err.message || 'Error desconocido'}. Asegúrese de que el bucket 'laundry-assets' existe y es público.`);
          } finally {
              setIsUploading(null);
          }
      }
  };

  const handleSaveConfig = async () => {
      setIsSaving(true);
      try {
          const holdingId = company.empresa_holding_id || (company as any).empresa_id || getActiveHoldingId();
          if (!holdingId) {
              console.error("No se pudo determinar el ID del Holding. Company object:", company);
              throw new Error("No se pudo determinar el ID del Holding.");
          }

          console.log("Guardando configuración de ticket:", ticketConfig);
          await dbSaveTicketConfig(company.id, holdingId, ticketConfig);
          
          setIsSuccessModalOpen(true);
      } catch (e: any) {
          console.error("Error al guardar configuración:", e);
          alert(`Error al guardar la configuración: ${e.message || 'Error desconocido'}`);
      } finally {
          setIsSaving(false);
      }
  };

  const handleUpdateAppVersion = async () => {
      if (!minVersionInput) return;
      setIsUpdatingVersion(true);
      try {
          const { error } = await supabase
              .from('app_config')
              .upsert({ key: 'min_required_version', value: minVersionInput }, { onConflict: 'key' });

          if (error) throw error;
          alert(`Versión mínima requerida actualizada a: ${minVersionInput}`);
      } catch (err: any) {
          console.error("Error updating version:", err);
          alert("Error al actualizar versión: " + err.message);
      } finally {
          setIsUpdatingVersion(false);
      }
  };

  return (
    <div className="p-4 h-full overflow-y-auto bg-slate-50 no-scrollbar">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6 px-4">
            <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-3">
                <SettingsIcon size={32} className="text-indigo-600" />
                Ajustes de Tienda
            </h2>
            <p className="text-slate-500 text-sm font-medium">Personalice los parámetros de impresión y ticket de su sucursal.</p>
        </div>
        
        <div className="space-y-8 animate-in fade-in duration-500 pb-32">
            <div className="space-y-8">
              {/* TICKET CONFIG CARD */}
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-6 md:p-10">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                      
                      {/* FORMULARIO DE TICKET */}
                      <div className="lg:col-span-7 space-y-8">
                          <h3 className="text-xl font-bold text-slate-900 pb-3 border-b flex items-center gap-4 uppercase tracking-tight">
                              <Layout size={24} className="text-indigo-600"/> Configuración de Ticket
                          </h3>

                          {/* CONTROL DE VERSIÓN (Solo SAAS_MASTER) */}
                          {user?.role === UserRole.SAAS_MASTER && (
                            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden relative group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Cpu size={80} className="text-white" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="bg-indigo-500 p-2 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <h4 className="text-white font-black text-sm uppercase tracking-widest">Control de Distribución</h4>
                                    </div>
                                    <p className="text-slate-400 text-[10px] font-bold uppercase mb-4 leading-tight">
                                        Establezca la versión mínima requerida para forzar actualización en todos los clientes.
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 block ml-1">Próxima Versión Requerida</label>
                                            <input 
                                                value={minVersionInput}
                                                onChange={(e) => setMinVersionInput(e.target.value)}
                                                placeholder="Ej: 1.2.1"
                                                className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                            />
                                        </div>
                                        <button 
                                            onClick={handleUpdateAppVersion}
                                            disabled={isUpdatingVersion}
                                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all mt-4.5 self-end flex items-center gap-2"
                                        >
                                            {isUpdatingVersion ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>}
                                            Publicar
                                        </button>
                                    </div>
                                    <div className="mt-4 flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Versión Actual del Código:</span>
                                        <span className="bg-slate-800 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-mono font-bold border border-slate-700">{APP_VERSION}</span>
                                    </div>
                                </div>
                            </div>
                          )}
                          
                          <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Logo Impresión</label>
                                      <div className="relative group w-fit">
                                          <div className="w-32 h-32 rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 p-2 shadow-inner">
                                              {isUploading === 'url_logo_ticket' ? <Loader2 className="animate-spin text-indigo-600" /> : ticketConfig.url_logo_ticket ? <img src={ticketConfig.url_logo_ticket} className="w-full h-full object-contain" /> : <ImageIcon size={32} className="text-slate-300" />}
                                          </div>
                                          <label className="absolute -bottom-2 -right-2 cursor-pointer bg-white border border-slate-200 rounded-xl p-2 shadow-xl hover:bg-indigo-600 hover:text-white transition-all">
                                              <Upload size={14} />
                                              <input type="file" className="hidden" onChange={(e) => handleAssetUpload('url_logo_ticket', e)} />
                                          </label>
                                      </div>
                                  </div>

                                  <div className="space-y-4">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tamaño del Logo (%)</label>
                                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                          <input 
                                              type="range" 
                                              min="20" 
                                              max="100" 
                                              value={ticketConfig.logo_ticket_size} 
                                              onChange={e => setTicketConfig({...ticketConfig, logo_ticket_size: parseInt(e.target.value)})}
                                              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                                          />
                                          <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400 uppercase">
                                              <span>Pequeño</span>
                                              <span className="text-indigo-600">{ticketConfig.logo_ticket_size}%</span>
                                              <span>Original</span>
                                          </div>
                                      </div>
                                  </div>
                              </div>

                              <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Clock size={12}/> Horario de Atención (Cabecera)</label>
                                  <input 
                                      value={ticketConfig.horario_atencion} 
                                      onChange={e => setTicketConfig({...ticketConfig, horario_atencion: e.target.value.toUpperCase()})}
                                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm uppercase outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all"
                                      placeholder="LUN-SAB: 8AM - 8PM / DOM: 9AM - 2PM"
                                  />
                              </div>

                              <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><FileText size={12}/> Políticas del Ticket (Pie de Página)</label>
                                  <textarea 
                                      rows={4}
                                      value={ticketConfig.politicas} 
                                      onChange={e => setTicketConfig({...ticketConfig, politicas: e.target.value.toUpperCase()})}
                                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs uppercase outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all resize-none shadow-inner"
                                      placeholder="REVISAR SUS PRENDAS AL MOMENTO DE LA ENTREGA. NO HAY RECLAMOS POSTERIORES..."
                                  />
                              </div>

                              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                          Mostrar Código de Barras
                                      </label>
                                      <p className="text-[9px] text-slate-400 font-medium italic">Incluye un código de barras con el número de orden interna en el ticket.</p>
                                  </div>
                                  <button 
                                      onClick={() => setTicketConfig({...ticketConfig, mostrar_codigo_barras: !ticketConfig.mostrar_codigo_barras})}
                                      className={`w-14 h-7 rounded-full transition-all relative ${ticketConfig.mostrar_codigo_barras ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                  >
                                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${ticketConfig.mostrar_codigo_barras ? 'left-8' : 'left-1'}`} />
                                  </button>
                              </div>

                              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                  <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                          <DollarSign size={12} className="text-amber-600"/> Gestión de Caja
                                      </label>
                                      <p className="text-[9px] text-slate-400 font-medium italic">DIARIO: El saldo inicial es manual. ACUMULATIVO: El saldo se arrastra del turno anterior automáticamente.</p>
                                  </div>
                                  <select 
                                      value={(company as any).cash_management_type || 'DAILY'}
                                      onChange={async (e) => {
                                          const newType = e.target.value;
                                          try {
                                              await dbUpdateSucursalConfig(company.id, { cash_management_type: newType });
                                              setCompany({ ...company, cash_management_type: newType } as any);
                                          } catch (err) {
                                              console.error("Error al actualizar tipo de caja:", err);
                                              alert("No se pudo actualizar el tipo de caja.");
                                          }
                                      }}
                                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-tight outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                                  >
                                      <option value="DAILY">DIARIO</option>
                                      <option value="ACCUMULATIVE">ACUMULATIVO</option>
                                  </select>
                              </div>

                              <div className="space-y-3">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Sparkles size={12} className="text-amber-500"/> Imagen Promocional Especial (Final)</label>
                                  <div className="flex items-center gap-4">
                                      <div className="w-32 h-20 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-200 shadow-inner">
                                          {isUploading === 'url_imagen_promocional' ? <Loader2 className="animate-spin text-indigo-600" /> : ticketConfig.url_imagen_promocional ? <img src={ticketConfig.url_imagen_promocional} className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-slate-300" />}
                                      </div>
                                      <label className="bg-indigo-50 text-indigo-600 px-6 py-3 rounded-xl font-bold text-[10px] uppercase cursor-pointer hover:bg-indigo-100 transition-all border border-indigo-100">
                                          {ticketConfig.url_imagen_promocional ? 'Cambiar Imagen' : 'Subir Promo'}
                                          <input type="file" className="hidden" onChange={(e) => handleAssetUpload('url_imagen_promocional', e)} />
                                      </label>
                                      {ticketConfig.url_imagen_promocional && (
                                          <button onClick={() => setTicketConfig({...ticketConfig, url_imagen_promocional: ''})} className="text-rose-500 hover:text-rose-700 transition-colors p-2 rounded-full hover:bg-rose-50"><X size={20}/></button>
                                      )}
                                  </div>
                                  <p className="text-[9px] text-slate-400 font-medium italic">* Esta imagen se imprimirá al final de todo el documento.</p>
                              </div>
                          </div>
                      </div>

                      {/* VISTA PREVIA DEL TICKET */}
                      <div className="lg:col-span-5 flex flex-col items-center">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-6">Vista Previa Impresión</h4>
                          <div className="w-full max-w-[280px] bg-white border border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-4 font-mono text-[9px] text-slate-950 flex flex-col gap-2 relative">
                              {/* Header Preview */}
                              <div className="flex flex-col items-center text-center">
                                  <div className="mb-2 transition-all duration-300" style={{ width: `${ticketConfig.logo_ticket_size}%` }}>
                                      {ticketConfig.url_logo_ticket ? (
                                          <img src={ticketConfig.url_logo_ticket} className="w-full h-auto" alt="Logo Ticket" />
                                      ) : (
                                          <div className="w-full aspect-video bg-slate-100 flex items-center justify-center rounded border border-dashed border-slate-300 text-slate-300">LOGO</div>
                                      )}
                                  </div>
                                  <p className="font-bold text-[11px] mb-0.5">{company.razonSocial.toUpperCase()}</p>
                                  <p className="mb-0.5">RUC: {company.ruc}</p>
                                  <p className="mb-0.5">{company.address.toUpperCase()}</p>
                                  <p className="mb-2 font-bold italic text-indigo-600">{ticketConfig.horario_atencion || 'HORARIO DE ATENCIÓN'}</p>
                                  <p className="w-full border-b border-dashed border-slate-300 mb-2"></p>
                              </div>

                              {/* Content Mock */}
                              <div className="space-y-1">
                                  <div className="flex justify-between font-bold"><span>BOLETA ELECTRONICA</span><span>B001-000452</span></div>
                                  <div className="flex justify-between text-slate-400"><span>FECHA:</span><span>{new Date().toLocaleDateString()}</span></div>
                                  <p className="w-full border-b border-dashed border-slate-100 my-1"></p>
                                  <div className="flex justify-between"><span>2.00 LAVADO X KILO</span><span>13.00</span></div>
                                  <div className="flex justify-between"><span>1.00 EDREDÓN PLUMA</span><span>25.00</span></div>
                                  <p className="w-full border-b border-dashed border-slate-300 my-1"></p>
                                  <div className="flex justify-between font-bold text-[10px]"><span>TOTAL A PAGAR:</span><span>S/ 38.00</span></div>
                              </div>

                              {/* Footer Preview */}
                              <div className="mt-4 flex flex-col items-center text-center gap-3">
                                  <p className="w-full border-t border-dashed border-slate-300 pt-2"></p>
                                  <div className="whitespace-pre-line leading-tight text-slate-700 italic text-[8px] text-left text-justify w-full px-1">
                                      {ticketConfig.politicas || 'SUS POLÍTICAS CONFIGURADAS APARECERÁN AQUÍ.'}
                                  </div>
                                  
                                  {ticketConfig.url_imagen_promocional && (
                                      <div className="w-full mt-2 animate-in zoom-in-95 border-t border-slate-100 pt-2">
                                          <img src={ticketConfig.url_imagen_promocional} className="w-full h-auto rounded border border-slate-100" alt="Promo" />
                                          <p className="text-[7px] text-slate-300 uppercase mt-1 tracking-widest">Imagen Publicitaria</p>
                                      </div>
                                  )}
                                  
                                  <div className="mt-6 opacity-30 text-[7px] font-bold uppercase tracking-widest">SISTEMA SISLAV</div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
            </div>
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-40 flex items-center gap-4">
          <button 
            onClick={handleSaveConfig} 
            disabled={isSaving}
            style={{ backgroundColor: primaryColor }}
            className="text-white px-12 py-4 rounded-[1.8rem] font-bold text-xs uppercase tracking-[0.2em] shadow-xl hover:brightness-110 transition-all flex items-center gap-4 active:scale-95 disabled:opacity-50"
          >
              {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />} GUARDAR CONFIGURACIÓN
          </button>
      </div>

      {isSuccessModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
              <div className="bg-white rounded-[3.5rem] w-full max-w-sm shadow-2xl p-12 text-center animate-in zoom-in-95">
                  <div className="bg-emerald-100 text-emerald-600 p-8 rounded-full mb-10 inline-block"><CheckCircle2 size={72} strokeWidth={2.5} className="animate-bounce" /></div>
                  <h4 className="text-3xl font-bold text-slate-900 mb-4 uppercase tracking-tight">¡Actualizado!</h4>
                  <p className="text-slate-500 font-bold mb-12 uppercase text-[10px] tracking-widest">La configuración de ticket ha sido procesada correctamente.</p>
                  <button onClick={() => setIsSuccessModalOpen(false)} className="w-full bg-slate-900 hover:bg-black text-white font-bold py-5 rounded-3xl transition-all uppercase tracking-[0.25em] text-[10px]">CONTINUAR</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;
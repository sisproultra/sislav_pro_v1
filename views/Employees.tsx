
import React, { useState, useEffect, useRef } from 'react';
import { Employee, UserRole, SYSTEM_PERMISSIONS, PermissionMap } from '../types';
import { dbUploadImage, getActiveBranchId } from '../services/dbService';
import { User, Shield, Phone, Plus, Save, X, Camera, Lock, Upload, Trash2, Loader2, Check, AlertCircle, RotateCw, ShieldAlert, Copy, Edit2, Ban } from 'lucide-react';

interface EmployeesProps {
  employees: Employee[];
  onSave: (emp: Omit<Employee, 'id'>, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onHardDelete: (id: string) => Promise<void>;
  onReactivate: (id: string) => Promise<void>;
  currentUserRole?: UserRole;
  company?: any;
  canManage?: boolean;
}

const ROLE_TEMPLATES: Record<string, PermissionMap> = {
    [UserRole.ADMIN]: SYSTEM_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
    [UserRole.CAJERO]: SYSTEM_PERMISSIONS.reduce((acc, p) => {
        const enabled = ['view:dashboard', 'view:pos', 'view:orders', 'view:clients', 'view:history', 'view:yape'].includes(p.id);
        return { ...acc, [p.id]: enabled };
    }, {}),
    [UserRole.OPERARIO]: SYSTEM_PERMISSIONS.reduce((acc, p) => {
        const enabled = ['view:dashboard', 'view:operations', 'view:machines', 'view:clients'].includes(p.id);
        return { ...acc, [p.id]: enabled };
    }, {}),
    [UserRole.DELIVERY]: SYSTEM_PERMISSIONS.reduce((acc, p) => {
        const enabled = ['view:delivery', 'view:orders'].includes(p.id);
        return { ...acc, [p.id]: enabled };
    }, {}),
    [UserRole.CONTABILIDAD]: SYSTEM_PERMISSIONS.reduce((acc, p) => {
        const enabled = ['view:dashboard', 'view:history', 'view:reports'].includes(p.id);
        return { ...acc, [p.id]: enabled };
    }, {})
};

const Employees: React.FC<EmployeesProps> = ({ employees, onSave, onDelete, onHardDelete, onReactivate, currentUserRole, company, canManage = true }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.OPERARIO);
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  
  const [customPermissions, setCustomPermissions] = useState<PermissionMap>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      if (isModalOpen && !name) { 
          setCustomPermissions(ROLE_TEMPLATES[role] || {});
      }
  }, [role, isModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isUploading) return;
    
    setIsSubmitting(true);
    try {
        // Llamamos al guardado (que en el padre es optimista y no bloquea)
        await onSave({
          sucursal_id: getActiveBranchId() || '',
          name: name.toUpperCase(),
          username,
          password,
          role,
          phone,
          photoUrl,
          isActive: true,
          permissions: customPermissions
        }, editingEmployee?.id);
        
        // Respuesta instantánea: Cerramos modal y reseteamos formulario al momento
        setIsModalOpen(false);
        resetForm();
    } catch (error) {
        // Este catch capturaría errores de validación previa si existieran
        console.error("Error en flujo de empleados:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setUsername('');
    setPassword('');
    setRole(UserRole.OPERARIO);
    setPhone('');
    setPhotoUrl('');
    setCustomPermissions({});
    setEditingEmployee(null);
    stopCamera();
  };

  const handleEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name);
    setUsername(emp.username);
    setPassword(emp.password || '');
    setRole(emp.role as UserRole);
    setPhone(emp.phone || '');
    setPhotoUrl(emp.photoUrl || '');
    setCustomPermissions(emp.permissions || ROLE_TEMPLATES[emp.role] || {});
    setIsModalOpen(true);
  };

  const handleCopyLoginLink = () => {
    if (!company?.slug) {
      alert("No se pudo generar el link: Slug de sucursal no disponible.");
      return;
    }
    const link = `${window.location.origin}/?s=${company.slug}`;
    navigator.clipboard.writeText(link).then(() => {
        alert("URL de acceso directo copiada al portapapeles:\n" + link);
    }).catch(() => {
        alert("No se pudo copiar automáticamente. URL:\n" + link);
    });
  };

  const canViewLoginLink = [UserRole.SAAS_MASTER, UserRole.OWNER].includes(currentUserRole as any);
  const canManageUsers = canManage;

  const handleTogglePermission = (permId: string) => {
      setCustomPermissions(prev => ({
          ...prev,
          [permId]: !prev[permId]
      }));
  };

  const handleRoleChange = (newRole: UserRole) => {
      setRole(newRole);
      setCustomPermissions(ROLE_TEMPLATES[newRole] || {});
  };

  const startCamera = async () => {
    setCameraError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setIsCameraActive(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Error access camera:", err);
      setCameraError(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        setIsUploading(true);
        try {
            const url = await dbUploadImage('perfiles', dataUrl, `emp_cam_${Date.now()}.jpg`);
            setPhotoUrl(url);
            stopCamera();
        } catch (e) {
            alert("Error al guardar foto en el storage.");
        } finally {
            setIsUploading(false);
        }
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setIsUploading(true);
        try {
            const url = await dbUploadImage('perfiles', file, `emp_${Date.now()}_${file.name.replace(/\s+/g, '_')}`);
            setPhotoUrl(url);
        } catch (err) {
            alert("Error al subir imagen.");
        } finally {
            setIsUploading(false);
        }
    }
  };

  return (
    <div className="p-6 lg:p-8 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Personal</h2>
            <p className="text-sm text-gray-500">Gestión de empleados y permisos ultra-personalizados</p>
          </div>
          <div className="flex gap-3">
            {canViewLoginLink && (
              <button 
                onClick={handleCopyLoginLink}
                className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                title="Copiar Link de Acceso para esta Sucursal"
              >
                <Copy size={16} /> Link Acceso
              </button>
            )}
            <button 
              onClick={() => setShowInactive(!showInactive)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${showInactive ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {showInactive ? 'Ocultar Inactivos' : 'Ver Inactivos'}
            </button>
            {canManageUsers && (
              <button 
                onClick={() => { resetForm(); setIsModalOpen(true); }}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
              >
                <Plus size={18} /> Nuevo Empleado
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.filter(e => showInactive ? true : e.isActive).map((emp, i) => (
            <div key={emp.id || i} className={`bg-white rounded-[2rem] shadow-sm border p-6 flex flex-col items-center text-center relative overflow-hidden group hover:shadow-xl transition-all animate-in fade-in ${!emp.isActive ? 'opacity-60 grayscale bg-slate-50 border-dashed border-slate-300' : 'border-gray-200'}`}>
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4 border-4 border-white shadow-md overflow-hidden shrink-0">
                 {emp.photoUrl ? (
                   <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                 ) : (
                   <User size={32} className="text-gray-400" />
                 )}
              </div>
              <h3 className="font-bold text-slate-800 text-lg uppercase tracking-tight">{emp.name}</h3>
              {emp.nombreEmpresa && (
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                  {emp.nombreEmpresa}
                </p>
              )}
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 uppercase tracking-widest border border-indigo-100">{emp.role}</span>
                {!emp.isActive && <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-600 uppercase tracking-widest border border-rose-100">INACTIVO</span>}
              </div>
              
              {emp.isActive ? (
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  {canManageUsers && (
                    <>
                      <button 
                        onClick={() => handleEdit(emp)}
                        className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar Empleado"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          if(confirm(`¿Estás seguro de anular a ${emp.name}? Perderá el acceso al sistema.`)) {
                            onDelete(emp.id);
                          }
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Anular Empleado"
                      >
                        <Ban size={18} />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  {canManageUsers && (
                    <>
                      <button 
                        onClick={() => onReactivate(emp.id)}
                        className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Reactivar Empleado"
                      >
                        <RotateCw size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          if(confirm(`¿ELIMINAR PERMANENTEMENTE A ${emp.name}? Esta acción liberará el nombre de usuario "${emp.username}" pero es irreversible.`)) {
                            onHardDelete(emp.id);
                          }
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Eliminar Permanente"
                      >
                        <ShieldAlert size={18} />
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="mt-6 w-full text-sm text-gray-500 space-y-3 bg-slate-50 p-4 rounded-2xl">
                 <div className="flex justify-between border-b border-white pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-tight">Usuario</span>
                    <span className="font-bold text-slate-900">{emp.username}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-tight">Teléfono</span>
                    <span className="font-bold text-slate-900">{emp.phone || '-'}</span>
                 </div>
              </div>
              
              <div className="mt-4 flex flex-wrap gap-1 justify-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 py-0.5 bg-white rounded border border-slate-100">
                      {Object.values(emp.permissions || {}).filter(Boolean).length} MÓDULOS ACTIVOS
                  </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20">
             <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><User size={20}/></div>
                    <h3 className="font-bold text-xl uppercase text-slate-900 tracking-tight">
                        {editingEmployee ? 'Editar Empleado' : 'Ficha de Nuevo Empleado'}
                    </h3>
                </div>
                <button onClick={() => { setIsModalOpen(false); stopCamera(); }} className="bg-white p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors shadow-sm"><X size={24}/></button>
             </div>
             
             <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                 <div className="w-full md:w-[35%] p-8 border-b md:border-b-0 md:border-r border-slate-100 overflow-y-auto custom-scrollbar bg-white">
                     <div className="flex flex-col items-center mb-8">
                        <div className="relative group">
                            <div 
                                onClick={startCamera}
                                className="w-32 h-32 bg-slate-50 rounded-[2.5rem] flex items-center justify-center cursor-pointer hover:bg-slate-100 border-4 border-white shadow-xl overflow-hidden transition-all group-hover:scale-105 active:scale-95"
                            >
                                {isUploading ? (
                                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                                ) : photoUrl ? (
                                    <img src={photoUrl} className="w-full h-full object-cover" alt="Perfil"/>
                                ) : (
                                    <div className="text-center">
                                        <Camera className="mx-auto text-slate-300 mb-2" size={40} />
                                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Tomar Foto</span>
                                    </div>
                                )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 flex gap-1">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-100 p-2.5 rounded-xl shadow-lg hover:bg-indigo-50 text-indigo-600 transition-all active:scale-90" title="Subir Imagen"><Upload size={18} strokeWidth={3} /></button>
                                {photoUrl && <button type="button" onClick={() => setPhotoUrl('')} className="bg-white border border-slate-100 p-2.5 rounded-xl shadow-lg hover:bg-red-50 text-red-500 transition-all active:scale-90"><Trash2 size={18} strokeWidth={3} /></button>}
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                        </div>
                     </div>

                     <form id="employeeForm" onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1">
                           <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                           <input required value={name} onChange={e => setName(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold uppercase outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" placeholder="EJ: JUAN PEREZ" />
                        </div>
                        <div className="space-y-1">
                           <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Rol Operativo</label>
                           <select value={role} onChange={e => handleRoleChange(e.target.value as UserRole)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold bg-white outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner appearance-none">
                              {[UserRole.ADMIN, UserRole.CAJERO, UserRole.OPERARIO, UserRole.DELIVERY, UserRole.CONTABILIDAD].map(r => <option key={r} value={r}>{r}</option>)}
                           </select>
                        </div>
                        <div className="space-y-1">
                           <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Usuario</label>
                           <input required value={username} onChange={e => setUsername(e.target.value.toLowerCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" placeholder="usuario_pos" />
                        </div>
                        <div className="space-y-1">
                           <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Pin de Acceso</label>
                           <div className="relative">
                               <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                               <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" placeholder="••••••" />
                           </div>
                        </div>
                        <div className="space-y-1">
                           <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                           <div className="relative">
                               <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                               <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" placeholder="999888777" />
                           </div>
                        </div>
                     </form>
                 </div>

                 <div className="flex-1 p-8 bg-slate-50/50 overflow-y-auto custom-scrollbar">
                     <h4 className="font-bold text-xs text-indigo-600 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                         <Shield size={20} /> Matriz de Permisos Personalizada
                     </h4>
                     
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">
                         {['PRINCIPAL', 'GESTION', 'LOGISTICA', 'MARKETING', 'ADMIN'].map(group => {
                             const perms = SYSTEM_PERMISSIONS.filter(p => p.group === group);
                             if (perms.length === 0) return null;
                             return (
                                 <div key={group} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                                     <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 pb-2 border-b border-slate-50">{group}</h5>
                                     <div className="space-y-4">
                                         {perms.map(p => (
                                             <div key={p.id} className="flex items-center justify-between group">
                                                 <div className="flex-1 pr-4">
                                                     <p className={`text-[11px] font-bold uppercase tracking-tight transition-colors ${customPermissions[p.id] ? 'text-slate-800' : 'text-slate-300'}`}>{p.label}</p>
                                                 </div>
                                                 <button 
                                                    type="button"
                                                    onClick={() => handleTogglePermission(p.id)}
                                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 flex items-center ${customPermissions[p.id] ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-200'}`}
                                                 >
                                                     <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${customPermissions[p.id] ? 'translate-x-7' : 'translate-x-1'}`} />
                                                 </button>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                 </div>
             </div>

             <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0 shadow-2xl z-20">
                <button 
                    type="button"
                    onClick={() => { setIsModalOpen(false); stopCamera(); }}
                    className="px-8 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors"
                >
                    Cancelar
                </button>
                <button 
                    disabled={isSubmitting || isUploading}
                    onClick={() => document.getElementById('employeeForm')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-14 rounded-2xl shadow-2xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 uppercase text-[10px] tracking-widest"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} strokeWidth={3} />}
                    {isSubmitting ? 'Guardando...' : 'Confirmar Guardado'}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* CÁMARA FULLSCREEN */}
      {isCameraActive && (
          <div className="fixed inset-0 bg-slate-950 z-[200] flex flex-col animate-in fade-in duration-300">
              <div className="h-20 bg-slate-900 px-8 flex justify-between items-center border-b border-white/5">
                  <div className="flex items-center gap-4">
                      <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-xl"><Camera size={24} /></div>
                      <div>
                          <h4 className="text-white font-bold text-xl uppercase tracking-tight">Capturador Biométrico</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Asegure iluminación en el rostro</p>
                      </div>
                  </div>
                  <button onClick={stopCamera} className="bg-white/10 text-white p-3 hover:bg-rose-600 rounded-full transition-all border border-white/10 shadow-2xl"><X size={32}/></button>
              </div>

              <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover max-w-2xl max-h-[70vh] rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] border-8 border-slate-900" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                      <div className="w-full max-w-sm aspect-square border-[3px] border-white/20 rounded-full border-dashed animate-pulse"></div>
                  </div>
                  {isUploading && (
                      <div className="absolute inset-0 bg-slate-950/60 z-30 flex flex-col items-center justify-center gap-4">
                          <Loader2 className="animate-spin text-white" size={64} />
                          <p className="text-white font-bold uppercase tracking-widest">Subiendo al servidor...</p>
                      </div>
                  )}
              </div>

              <div className="p-10 bg-slate-900 border-t border-white/5 flex flex-col items-center gap-6">
                  <button 
                      onClick={capturePhoto}
                      disabled={isUploading}
                      className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.2)] active:scale-90 transition-transform group disabled:opacity-50"
                  >
                      <div className="w-20 h-20 rounded-full border-4 border-slate-900 bg-white group-active:scale-95 transition-all"></div>
                  </button>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.4em]">Presione para capturar</p>
              </div>
          </div>
      )}
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }`}</style>
    </div>
  );
};

export default Employees;

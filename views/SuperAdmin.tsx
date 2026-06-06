
import React, { useState, useEffect, useRef } from 'react';
import { 
    getSaasCompanies, 
    getSaasBranches, 
    getSaasGlobalConfig,
    createSaasCompany,
    createInitialHoldingUser,
    updateSaasCompany,
    deleteSaasCompany,
    createSaasBranch,
    updateSaasBranch,
    createInitialBranchUser,
    addGlobalCatalogItem,
    softDeleteGlobalItem,
    updateGlobalCatalogItem,
    uploadGlobalAsset,
    uploadBranchAsset,
    uploadCompanyAsset,
    updateSaasGlobalConfig,
    adminCreateSystemUser,
    adminResetUserPassword,
    saasGetWaTemplates,
    saasSaveWaTemplate,
    saasDeleteWaTemplate,
    saasToggleWaTemplate
} from '../services/saasService';
import { searchClient } from '../services/clientService';
import { 
    SaasCompany, 
    SaasBranch, 
    SaasGlobalConfig,
    UserRole,
    InvoiceType,
    SucursalType,
    CashManagementType,
    SYSTEM_MODULES,
    DEFAULT_BRANCH_MODULES,
    WaTemplate,
    WaTemplateCategory
} from '../types';
import { 
    Building, Globe, Loader2, X, Save, Palette, 
    LogIn, LogOut, Video, Trash2, Upload, LayoutGrid, Plus, ShieldCheck, PlayCircle, ImageIcon, Check, ChevronDown, ChevronUp, CreditCard, WashingMachine, Tag, Layers, Key, ShieldAlert, Store, ArrowRight, AlertTriangle, Building2, MapPin, Hash, Sparkles,
    Phone, FileText, Smartphone, MessageCircle, Settings2, Info, Printer, Youtube, Play, Edit, Zap, Search, Percent, CircleDollarSign, Copy, RefreshCcw, RotateCcw, Settings, Menu, Bot, Droplets, Link, Database, Code, Shield, KeyRound, Clock, UserPlus, Camera,
    Terminal, CheckCircle2, Users, FileCheck, Cpu
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { APP_VERSION } from '../components/VersionGuard';

const LATAM_CODES = [
  { code: '+51', name: 'Perú', iso: 'pe' },
  { code: '+52', name: 'México', iso: 'mx' },
  { code: '+54', name: 'Argentina', iso: 'ar' },
  { code: '+56', name: 'Chile', iso: 'cl' },
  { code: '+57', name: 'Colombia', iso: 'co' },
  { code: '+591', name: 'Bolivia', iso: 'bo' },
  { code: '+593', name: 'Ecuador', iso: 'ec' },
  { code: '+506', name: 'Costa Rica', iso: 'cr' },
  { code: '+507', name: 'Panamá', iso: 'pa' },
  { code: '+58', name: 'Venezuela', iso: 've' },
  { code: '+502', name: 'Guatemala', iso: 'gt' },
  { code: '+504', name: 'Honduras', iso: 'hn' },
  { code: '+505', name: 'Nicaragua', iso: 'ni' },
  { code: '+503', name: 'El Salvador', iso: 'sv' },
  { code: '+595', name: 'Paraguay', iso: 'py' },
  { code: '+598', name: 'Uruguay', iso: 'uy' },
  { code: '+1', name: 'Rep. Dominicana', iso: 'do' }
].sort((a, b) => a.name.localeCompare(b.name));

const AccordionItem: React.FC<{ 
    id: string; 
    title: string; 
    icon: React.ReactNode; 
    isOpen: boolean; 
    onToggle: () => void; 
    children: React.ReactNode 
}> = ({ title, icon, isOpen, onToggle, children }) => {
    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-[2rem] overflow-hidden transition-all text-slate-200">
            <button 
                onClick={onToggle}
                className="w-full px-8 py-6 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="text-indigo-400">{icon}</div>
                    <span className="font-bold text-sm uppercase tracking-widest">{title}</span>
                </div>
                {isOpen ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
            </button>
            {isOpen && (
                <div className="px-8 pb-8 animate-in slide-in-from-top-2 duration-300">
                    {children}
                </div>
            )}
        </div>
    );
};

const SystemLogsView: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('logs_sistema')
                .select('*, sucursales(nombre_sucursal)')
                .order('fecha', { ascending: false })
                .limit(100);
            if (error) throw error;
            setLogs(data || []);
        } catch (e) {
            console.error("Error fetching logs:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-tight text-white">Logs del Sistema</h2>
                    <p className="text-slate-500 text-sm font-medium mt-1 uppercase">Monitoreo de errores y actividad crítica.</p>
                </div>
                <button 
                    onClick={fetchLogs}
                    className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
                >
                    <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
                </button>
            </div>

            <div className="bg-slate-900/50 border border-white/5 rounded-[2.5rem] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5">
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Fecha</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Sucursal</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Mensaje</th>
                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Detalles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading && logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-indigo-500 mb-4" size={32} />
                                        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Cargando bitácora...</p>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center">
                                        <CheckCircle2 size={32} className="mx-auto text-slate-700 mb-4" />
                                        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">No hay logs registrados</p>
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-[10px] font-mono text-indigo-400">{new Date(log.fecha).toLocaleString()}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-[10px] font-bold uppercase text-white">{log.sucursales?.nombre_sucursal || 'SISTEMA'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[10px] text-slate-300 max-w-md truncate" title={log.mensaje}>{log.mensaje}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {log.detalles ? (
                                                <button 
                                                    onClick={() => alert(JSON.stringify(log.detalles, null, 2))}
                                                    className="text-[9px] font-bold uppercase bg-indigo-600/20 text-indigo-400 px-2 py-1 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                                                >
                                                    Ver JSON
                                                </button>
                                            ) : (
                                                <span className="text-[9px] text-slate-600">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const UsersListView: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [syncData, setSyncData] = useState({ uid: '', name: '', username: '', role: UserRole.OWNER, holdingId: '', companyName: '' });
    const [isSyncing, setIsSyncing] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [updateLoading, setUpdateLoading] = useState(false);

    // Nuevos estados para creación y password
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createData, setCreateData] = useState({ 
        username: '', 
        password: '', 
        fullName: '', 
        role: UserRole.OWNER, 
        holdingId: '', 
        sucursalId: '',
        companyName: '' 
    });
    const [allCompanies, setAllCompanies] = useState<any[]>([]);
    const [allBranches, setAllBranches] = useState<any[]>([]);
    const [filteredBranches, setFilteredBranches] = useState<any[]>([]);
    const [isCreating, setIsCreating] = useState(false);

    const loadCreationCatalogs = async () => {
        try {
            const { companies } = await getSaasCompanies(1, 1000);
            const { branches } = await getSaasBranches(undefined, 1, 3000);
            setAllCompanies(companies);
            setAllBranches(branches);
        } catch (err) {
            console.error("Error cargando catálogos para creación:", err);
        }
    };

    useEffect(() => {
        if (isCreateModalOpen) {
            loadCreationCatalogs();
        }
    }, [isCreateModalOpen]);

    useEffect(() => {
        if (createData.holdingId) {
            const related = allBranches.filter(b => b.empresaId === createData.holdingId);
            setFilteredBranches(related);
            
            // Si el rol es de sucursal, pero la sucursal actual no pertenece al nuevo holding, resetearla
            if (createData.sucursalId && !related.find(b => b.id === createData.sucursalId)) {
                setCreateData(prev => ({ ...prev, sucursalId: '' }));
            }

            // Autorrellenar nombre de empresa si está vacío
            const comp = allCompanies.find(c => c.id === createData.holdingId);
            if (comp && !createData.companyName) {
                setCreateData(prev => ({ ...prev, companyName: comp.name }));
            }
        } else {
            setFilteredBranches([]);
        }
    }, [createData.holdingId, allBranches, allCompanies]);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordData, setPasswordData] = useState({ userId: '', username: '', newPassword: '' });
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('usuarios_login')
                .select('*')
                .order('fecha_registro', { ascending: false });
            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error("Error al obtener usuarios:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            await adminCreateSystemUser({
                username: createData.username,
                password: createData.password,
                fullName: createData.fullName,
                role: createData.role,
                holdingId: createData.holdingId,
                sucursalId: createData.sucursalId,
                companyName: createData.companyName
            });
            alert("Usuario creado correctamente");
            setIsCreateModalOpen(false);
            setCreateData({ 
                username: '', 
                password: '', 
                fullName: '', 
                role: UserRole.OWNER, 
                holdingId: '', 
                sucursalId: '',
                companyName: '' 
            });
            fetchUsers();
        } catch (err: any) {
            console.error("Error al crear usuario:", err);
            alert("Error: " + (err.message || "Error desconocido"));
        } finally {
            setIsCreating(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsResettingPassword(true);
        try {
            await adminResetUserPassword(passwordData.userId, passwordData.newPassword);
            alert("Contraseña actualizada correctamente");
            setIsPasswordModalOpen(false);
            setPasswordData({ userId: '', username: '', newPassword: '' });
            fetchUsers();
        } catch (err: any) {
            console.error("Error al resetear password:", err);
            alert("Error: " + (err.message || "Error desconocido"));
        } finally {
            setIsResettingPassword(false);
        }
    };

    const handleSyncUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSyncing(true);
        try {
            const { error } = await supabase.rpc('crear_usuario_sucursal', {
                p_auth_user_id: syncData.uid,
                p_empresa_holding_id: syncData.holdingId || null,
                p_sucursal_id: null,
                p_username: syncData.username,
                p_nombre_completo: syncData.name,
                p_rol: syncData.role,
                p_password_hash: 'SYNCED_USER',
                p_nombre_empresa: syncData.companyName
            });

            if (error) throw error;
            
            alert("Usuario sincronizado correctamente en usuarios_login");
            setIsSyncModalOpen(false);
            setSyncData({ uid: '', name: '', username: '', role: UserRole.OWNER, holdingId: '', companyName: '' });
            fetchUsers();
        } catch (err: any) {
            console.error("Error al sincronizar:", err);
            alert("Error: " + (err.message || "Error desconocido"));
        } finally {
            setIsSyncing(false);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setUpdateLoading(true);
        try {
            const { error } = await supabase
                .from('usuarios_login')
                .update({
                    nombre_completo: editingUser.nombre_completo,
                    rol: editingUser.rol,
                    activo: editingUser.activo,
                    nombre_empresa: editingUser.nombre_empresa,
                    empresa_holding_id: editingUser.empresa_holding_id || null
                })
                .eq('id', editingUser.id);

            if (error) throw error;
            
            alert("Usuario actualizado correctamente");
            setIsEditModalOpen(false);
            setEditingUser(null);
            fetchUsers();
        } catch (err: any) {
            console.error("Error al actualizar:", err);
            alert("Error: " + (err.message || "Error desconocido"));
        } finally {
            setUpdateLoading(false);
        }
    };

    const handleDeleteUser = async (id: string, username: string) => {
        if (!confirm(`¿Está seguro de eliminar el acceso de '${username}'? (Solo se eliminará de usuarios_pos, no de Auth)`)) return;
        try {
            const { error } = await supabase
                .from('usuarios_login')
                .delete()
                .eq('id', id);
            if (error) throw error;
            fetchUsers();
        } catch (err) {
            console.error("Error al eliminar:", err);
        }
    };

    const filteredUsers = users.filter(u => 
        u.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.nombre_empresa?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="text-indigo-400" />
                        Accesos al Sistema
                    </h3>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Todos los usuarios registrados (Login + Role)</p>
                </div>
                <div className="flex flex-wrap gap-4 w-full md:w-auto">
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase transition-all shadow-lg shadow-emerald-600/20"
                    >
                        <UserPlus size={16} />
                        Crear Nuevo Usuario
                    </button>
                    <button 
                        onClick={() => setIsSyncModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold uppercase transition-all shadow-lg shadow-indigo-600/20"
                    >
                        <RefreshCcw size={16} />
                        Sincronizar Auth
                    </button>
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar por nombre, usuario o empresa..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white outline-none focus:border-indigo-500 transition-all"
                        />
                    </div>
                    <button 
                        onClick={fetchUsers}
                        className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
                        title="Actualizar lista"
                    >
                        <RefreshCcw size={18} />
                    </button>
                </div>
            </div>

            {/* Modal de Sincronización */}
            {isSyncModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in scale-in duration-300">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-indigo-900/10">
                            <h3 className="text-xl font-bold uppercase tracking-tight text-white flex items-center gap-3">
                                <RefreshCcw className="text-indigo-400" /> Sincronizar Usuario
                            </h3>
                            <button onClick={() => setIsSyncModalOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSyncUser} className="p-8 space-y-4">
                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider leading-relaxed">
                                    Utilice esta opción si el usuario ya existe en Supabase Auth pero no tiene su perfil en usuarios_login.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">UID de Auth</label>
                                <input required value={syncData.uid} onChange={e => setSyncData({...syncData, uid: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs font-mono outline-none focus:border-indigo-500" placeholder="00000000-0... (Copie de la tabla)" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                                    <input required value={syncData.name} onChange={e => setSyncData({...syncData, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500" placeholder="Ej: Juan Pérez" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de Usuario</label>
                                    <input required value={syncData.username} onChange={e => setSyncData({...syncData, username: e.target.value.toLowerCase()})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500" placeholder="juanp" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Empresa</label>
                                <input required value={syncData.companyName} onChange={e => setSyncData({...syncData, companyName: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500" placeholder="Nombre Comercial" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Rol</label>
                                <select 
                                    value={syncData.role} 
                                    onChange={e => setSyncData({...syncData, role: e.target.value as any})}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-[10px] font-bold uppercase outline-none focus:border-indigo-500 appearance-none"
                                >
                                    {Object.values(UserRole).map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                                </select>
                            </div>
                            <div className="pt-4">
                                <button 
                                    disabled={isSyncing}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                                >
                                    {isSyncing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                    Sincronizar ahora
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Creación Total */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in scale-in duration-300">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-emerald-900/10">
                            <h3 className="text-xl font-bold uppercase tracking-tight text-white flex items-center gap-3">
                                <UserPlus className="text-emerald-400" /> Nuevo Usuario
                            </h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCreateUser} className="p-8 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de Usuario (Login)</label>
                                <input required value={createData.username} onChange={e => setCreateData({...createData, username: e.target.value.toLowerCase()})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs outline-none focus:border-emerald-500" placeholder="vendedor_central" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Contraseña Inicial</label>
                                <input required type="text" value={createData.password} onChange={e => setCreateData({...createData, password: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs outline-none focus:border-emerald-500 font-mono" placeholder="••••••••" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                                <input required value={createData.fullName} onChange={e => setCreateData({...createData, fullName: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs outline-none focus:border-emerald-500" placeholder="Nombre y Apellido" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Rol</label>
                                <select 
                                    value={createData.role} 
                                    onChange={e => setCreateData({...createData, role: e.target.value as any})}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-[10px] font-bold uppercase outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                                >
                                    {Object.values(UserRole).map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Empresa / Holding</label>
                                    <select 
                                        required
                                        value={createData.holdingId} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            const comp = allCompanies.find(c => c.id === val);
                                            setCreateData({...createData, holdingId: val, companyName: comp?.name || ''})
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-[10px] font-bold uppercase outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                                    >
                                        <option value="">Seleccione Empresa...</option>
                                        {allCompanies.map(c => (
                                            <option key={c.id} value={c.id} className="bg-slate-900">
                                                {c.name} ({allBranches.filter(b => b.empresaId === c.id).length} sedes)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Sucursal / Sede</label>
                                    <select 
                                        disabled={!createData.holdingId}
                                        value={createData.sucursalId} 
                                        onChange={e => setCreateData({...createData, sucursalId: e.target.value})}
                                        className={`w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-[10px] font-bold uppercase outline-none focus:border-emerald-500 appearance-none cursor-pointer ${!createData.holdingId && 'opacity-30 cursor-not-allowed'}`}
                                    >
                                        <option value="">{createData.holdingId ? "Seleccione Sede..." : "<- Elija Empresa"}</option>
                                        {filteredBranches.map(b => (
                                            <option key={b.id} value={b.id} className="bg-slate-900">
                                                {b.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre Empresa (Label Visual)</label>
                                <input value={createData.companyName} onChange={e => setCreateData({...createData, companyName: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs outline-none focus:border-emerald-500" placeholder="Ej: SISLAV SUCURSAL" />
                            </div>
                            <div className="pt-4">
                                <button 
                                    disabled={isCreating}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                                >
                                    {isCreating ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                                    Crear Usuario Ahora
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Cambio de Password */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-indigo-900/10">
                            <h3 className="text-lg font-bold uppercase tracking-tight text-white flex items-center gap-3">
                                <KeyRound className="text-amber-400" /> Reset Password
                            </h3>
                            <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleResetPassword} className="p-8 space-y-6">
                            <div className="text-center space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cambiando contraseña para:</p>
                                <p className="text-sm font-bold text-indigo-400 font-mono bg-indigo-500/10 py-2 rounded-xl border border-indigo-500/20">{passwordData.username}</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                                <input 
                                    required 
                                    autoFocus
                                    type="text" 
                                    value={passwordData.newPassword} 
                                    onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} 
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm font-mono text-center outline-none focus:border-amber-500 transition-all shadow-inner" 
                                    placeholder="Nuev@Pass123"
                                />
                            </div>
                            <div className="pt-2">
                                <button 
                                    disabled={isResettingPassword}
                                    className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
                                >
                                    {isResettingPassword ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                                    Actualizar Contraseña
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Edición */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                            <h3 className="text-xl font-bold uppercase tracking-tight text-white flex items-center gap-3">
                                <Edit className="text-indigo-400" /> Editar Acceso
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleUpdateUser} className="p-8 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                                <input required value={editingUser.nombre_completo} onChange={e => setEditingUser({...editingUser, nombre_completo: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Rol del Sistema</label>
                                <select 
                                    value={editingUser.rol} 
                                    onChange={e => setEditingUser({...editingUser, rol: e.target.value as any})}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                                >
                                    {Object.values(UserRole).map(r => <option key={r} value={r} className="bg-slate-900 text-white uppercase">{r}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de la Empresa</label>
                                <input value={editingUser.nombre_empresa || ''} onChange={e => setEditingUser({...editingUser, nombre_empresa: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">ID del Holding</label>
                                <input value={editingUser.empresa_holding_id || ''} onChange={e => setEditingUser({...editingUser, empresa_holding_id: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 font-mono" />
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <button 
                                    type="button"
                                    onClick={() => setEditingUser({...editingUser, activo: !editingUser.activo})}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${editingUser.activo ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'}`}
                                >
                                    {editingUser.activo ? 'Usuario Activo' : 'Usuario Inactivo'}
                                </button>
                            </div>
                            <div className="pt-4">
                                <button 
                                    disabled={updateLoading}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    {updateLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto border border-white/5 rounded-3xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/5">
                            <th className="p-4 text-[10px] font-bold text-slate-500 uppercase">Usuario / Nombre</th>
                            <th className="p-4 text-[10px] font-bold text-slate-500 uppercase">Rol</th>
                            <th className="p-4 text-[10px] font-bold text-slate-500 uppercase">Empresa / Holding</th>
                            <th className="p-4 text-[10px] font-bold text-slate-500 uppercase">Registro</th>
                            <th className="p-4 text-[10px] font-bold text-slate-500 uppercase">Estado</th>
                            <th className="p-4 text-[10px] font-bold text-slate-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center">
                                    <Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} />
                                    <p className="text-xs text-slate-500 mt-4 font-bold uppercase">Cargando usuarios...</p>
                                </td>
                            </tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-slate-500 text-xs font-bold uppercase italic">
                                    No se encontraron usuarios
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                                                {user.nombre_completo?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-white">{user.nombre_completo}</p>
                                                <p className="text-[10px] text-slate-500 font-mono">{user.username}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-tight ${
                                            user.rol === UserRole.SAAS_MASTER ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                                            user.rol === UserRole.OWNER ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                            'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                        }`}>
                                            {user.rol || 'USUARIO'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-xs text-white font-medium">{user.nombre_empresa || '---'}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">ID: {user.empresa_holding_id?.substring(0,8) || 'GLOBAL'}</p>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col text-[10px] text-slate-500">
                                            <span className="font-bold flex items-center gap-1"><Clock size={10} /> {new Date(user.fecha_registro).toLocaleDateString()}</span>
                                            <span>{new Date(user.fecha_registro).toLocaleTimeString()}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`w-2 h-2 rounded-full inline-block ${user.activo ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-rose-500 opacity-50'}`} title={user.activo ? 'Activo' : 'Inactivo'} />
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => { setPasswordData({ userId: user.id, username: user.username, newPassword: '' }); setIsPasswordModalOpen(true); }}
                                                className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all"
                                                title="Cambiar Contraseña"
                                            >
                                                <KeyRound size={16} />
                                            </button>
                                            <button 
                                                onClick={() => { setEditingUser(user); setIsEditModalOpen(true); }}
                                                className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteUser(user.id, user.username)}
                                                className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-lg transition-all"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const SuperAdmin: React.FC<{ 
    onLogout: () => void; 
    onSelectTenant: (t: SaasBranch, isMasterBypass: boolean) => void;
    onSelectOwner: (company: SaasCompany) => void;
}> = ({ onLogout, onSelectTenant, onSelectOwner }) => {
    const [view, setView] = useState<'ACCOUNTS' | 'GLOBAL' | 'SETTINGS' | 'LOGS' | 'USERS' | 'BULK_MODULOS'>('ACCOUNTS');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeAccordion, setActiveAccordion] = useState<string | null>('APIS_MAESTRAS');
    const [companies, setCompanies] = useState<SaasCompany[]>([]);
    const [companiesTotal, setCompaniesTotal] = useState(0);
    const [companiesPage, setCompaniesPage] = useState(1);
    const [branches, setBranches] = useState<SaasBranch[]>([]);
    const [branchesTotal, setBranchesTotal] = useState(0);
    const [branchesPage, setBranchesPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingAsset, setIsUploadingAsset] = useState(false);
    const [isSearchingRuc, setIsSearchingRuc] = useState(false);

    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [isEditingCompany, setIsEditingCompany] = useState(false);
    const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [isEditingBranch, setIsEditingBranch] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [companyToDelete, setCompanyToDelete] = useState<{ id: string, name: string } | null>(null);
    const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
    const [selectedCompany, setSelectedCompany] = useState<SaasCompany | null>(null);
    const [branchModalTab, setBranchModalTab] = useState<'GENERAL' | 'SUNAT' | 'WHATSAPP' | 'PRINT' | 'MODULOS' | 'USUARIO' | 'FISCAL'>('GENERAL');
    
    // Initial User State
    const [brUserFullname, setBrUserFullname] = useState('');
    const [brUsername, setBrUsername] = useState('');
    const [brUserPassword, setBrUserPassword] = useState('');
    const [brDocEnforceEnabled, setBrDocEnforceEnabled] = useState(false);
    const [brDocEnforceThreshold, setBrDocEnforceThreshold] = useState('700');
    const [globalConfig, setGlobalConfig] = useState<SaasGlobalConfig | null>(null);
    const [globalIdentityToken, setGlobalIdentityToken] = useState('');
    const [globalBannerCobro, setGlobalBannerCobro] = useState('');
    const [globalWaSaas, setGlobalWaSaas] = useState('');
    const [globalWaCodPais, setGlobalWaCodPais] = useState('+51');
    const [globalUrlBot, setGlobalUrlBot] = useState('');
    const [globalInstanciaBot, setGlobalInstanciaBot] = useState('');
    const [globalApiKeyBot, setGlobalApiKeyBot] = useState('');

    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
    const countryDropdownRef = useRef<HTMLDivElement>(null);
    const templateImageRef = useRef<HTMLInputElement>(null);

    const [catalogItem, setCatalogItem] = useState<{ nombre: string; url: string; hex: string; tipo: string; modulo_id?: string }>({ nombre: '', url: '', hex: '#FFFFFF', tipo: 'LAVADORA', modulo_id: '' });
    const [newVideo, setNewVideo] = useState({ title: '', url: '' });
    const [compName, setCompName] = useState('');
    const [compNombreComercial, setCompNombreComercial] = useState('');
    const [compRuc, setCompRuc] = useState('');
    const [compOwner, setCompOwner] = useState('');
    const [compPhone, setCompPhone] = useState('');
    const [compPhoneCode, setCompPhoneCode] = useState('+51');
    const [compPhoneBody, setCompPhoneBody] = useState('');
    const [isCompPhoneCountryDropdownOpen, setIsCompPhoneCountryDropdownOpen] = useState(false);
    const compPhoneCountryDropdownRef = useRef<HTMLDivElement>(null);
    const [compEmail, setCompEmail] = useState('');
    const [compPassword, setCompPassword] = useState('');
    const [compLogoUrl, setCompLogoUrl] = useState('');
    const [compFaviconUrl, setCompFaviconUrl] = useState('');
    const [compFaviconLogisticaUrl, setCompFaviconLogisticaUrl] = useState('');
    const [compPrimaryColor, setCompPrimaryColor] = useState('#4f46e5');
    const [compSecondaryColor, setCompSecondaryColor] = useState('#0f172a');
    const [compIsActive, setCompIsActive] = useState(true);

    const [brName, setBrName] = useState('');
    const [brRazonSocial, setBrRazonSocial] = useState('');
    const [brRuc, setBrRuc] = useState('');
    const [brAddress, setBrAddress] = useState('');
    const [brPhone, setBrPhone] = useState('');
    const [brSlug, setBrSlug] = useState('');
    const [brModoSunat, setBrModoSunat] = useState('0'); 
    const [brSunatUrl, setBrSunatUrl] = useState('https://apisu.sysventa.com/API_SUNAT/post.php');
    const [brSolUser, setBrSolUser] = useState('MODDATOS');
    const [brSolPass, setBrSolPass] = useState('moddatos');
    const [brFirmaPass, setBrFirmaPass] = useState('');
    const [brSerieBoleta, setBrSerieBoleta] = useState('B001');
    const [brSerieFactura, setBrSerieFactura] = useState('F001');
    const [brSerieNv, setBrSerieNv] = useState('NV01');
    const [brSerieNcF, setBrSerieNcF] = useState('FC01');
    const [brSerieNcB, setBrSerieNcB] = useState('BC01');
    const [brCustomNvName, setBrCustomNvName] = useState('NOTA DE VENTA');
    const [brCorrelativos, setBrCorrelativos] = useState<{tipo_documento: string, serie: string, ultimo_numero: number}[]>([]);
    const [brNombreComercial, setBrNombreComercial] = useState('');
    const [brUbigeo, setBrUbigeo] = useState('');
    const [brUrbanizacion, setBrUrbanizacion] = useState('');
    const [brDistrito, setBrDistrito] = useState('');
    const [brProvincia, setBrProvincia] = useState('');
    const [brDepartamento, setBrDepartamento] = useState('');
    const [brWaInstance, setBrWaInstance] = useState('');
    const [brWaToken, setBrWaToken] = useState('');
    const [brWaName, setBrWaName] = useState('');
    const [brYapeId, setBrYapeId] = useState('');
    const [brOrderZeros, setBrOrderZeros] = useState('7');
    const [brUseSuffix, setBrUseSuffix] = useState(false);
    const [brSuffixChar, setBrSuffixChar] = useState('A');
    const [brSuffixPos, setBrSuffixPos] = useState('AFTER');
    const [brPuntosEq, setBrPuntosEq] = useState('10');
    const [brCobranza, setBrCobranza] = useState(false);
    const [brColorPrimary, setBrColorPrimary] = useState('#0054A6');
    const [brColorSecondary, setBrColorSecondary] = useState('#10B981');
    const [brLogoUrl, setBrLogoUrl] = useState('');
    const [brFaviconUrl, setBrFaviconUrl] = useState('');
    const [brIsActive, setBrIsActive] = useState(true);
    const [brType, setBrType] = useState<SucursalType>(SucursalType.ESTANDAR);
    const [brCashManagementType, setBrCashManagementType] = useState<CashManagementType>(CashManagementType.DAILY);
    const [brPorcentajeIgv, setBrPorcentajeIgv] = useState('18.00');
    const [brMonedaSimbolo, setBrMonedaSimbolo] = useState('S/');
    const [brUseOrderReset, setBrUseOrderReset] = useState(false);
    const [brLimiteReconteo, setBrLimiteReconteo] = useState('10000');
    const [brModulosConfig, setBrModulosConfig] = useState<Record<string, any>>({});
    const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
    const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
    const [isCatalogDeleteModalOpen, setIsCatalogDeleteModalOpen] = useState(false);
    const [catalogItemToDelete, setCatalogItemToDelete] = useState<any>(null);
    const [currentCatalogModule, setCurrentCatalogModule] = useState<string>('');
    const [companySearch, setCompanySearch] = useState('');

    const DEFAULT_MODULES_CONFIG = SYSTEM_MODULES.reduce((acc, current) => {
        acc[current.id] = {
            isActive: !!DEFAULT_BRANCH_MODULES[current.id],
            isNew: false,
            allowedRoles: ['OWNER', 'ADMIN', 'CAJERO']
        };
        return acc;
    }, {} as Record<string, any>);

    const [waMasterTemplates, setWaMasterTemplates] = useState<WaTemplate[]>([]);
    const [isWaTemplateModalOpen, setIsWaTemplateModalOpen] = useState(false);
    const [editingWaTemplate, setEditingWaTemplate] = useState<Partial<WaTemplate> | null>(null);
    const [isUploadingWaImage, setIsUploadingWaImage] = useState(false);

    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [sessionInfo, setSessionInfo] = useState<any>(null);

    useEffect(() => {
        try {
            const sess = localStorage.getItem('sislav_session');
            if (sess) {
                setSessionInfo(JSON.parse(sess));
            }
        } catch (e) {
            console.error("Error loading session diagnostics", e);
        }
    }, [showDiagnostics]);

    useEffect(() => {
        loadData();
    }, [companiesPage, branchesPage]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
                setIsCountryDropdownOpen(false);
            }
            if (compPhoneCountryDropdownRef.current && !compPhoneCountryDropdownRef.current.contains(event.target as Node)) {
                setIsCompPhoneCountryDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (editingBranchId) {
            supabase
                .from('dispensador_correlativos')
                .select('*')
                .eq('sucursal_id', editingBranchId)
                .then(({ data, error }) => {
                    if (!error && data) {
                        setBrCorrelativos(data);
                    } else {
                        setBrCorrelativos([]);
                    }
                });
        } else {
            setBrCorrelativos([]);
        }
    }, [editingBranchId]);

    const loadData = async (isRetry = false) => {
        // Solo mostramos el loader de pantalla completa si no tenemos datos previos
        if (!isRetry && companies.length === 0) setLoading(true);
        
        const timeoutId = setTimeout(() => {
            if (loading) {
                console.warn("⚠️ loadData en SuperAdmin tardando demasiado (60s)...");
                setLoading(false);
            }
        }, 60000);

        try {
            console.log(`⏳ [SuperAdmin] Cargando datos (Intento: ${isRetry ? 'Auto-Reintento' : 'Inicial'})...`);
            const [cRes, bRes, g, waTemplates] = await Promise.all([
                getSaasCompanies(companiesPage), 
                getSaasBranches(undefined, branchesPage), 
                getSaasGlobalConfig(),
                saasGetWaTemplates()
            ]);
            
            setCompanies(cRes.companies || []);
            setCompaniesTotal(cRes.total || 0);
            setBranches(bRes.branches || []);
            setBranchesTotal(bRes.total || 0);
            setGlobalConfig(g);
            setWaMasterTemplates(waTemplates || []);
            
            // Eliminamos el auto-reintento agresivo que causaba bucles infinitos si la DB estaba lenta
            if (cRes.companies.length === 0 && view === 'ACCOUNTS') {
                console.log("ℹ️ No se encontraron empresas en la consulta inicial.");
            }

            if (g) {
                localStorage.setItem('sislav_global_config', JSON.stringify(g));
                setGlobalIdentityToken(g.apiToken || '');
                setGlobalBannerCobro(g.bannerCobro || '');
                setGlobalWaSaas(g.whatsapp_saas?.toString() || '');
                setGlobalWaCodPais(g.whatsapp_cod_pais || '+51');
                setGlobalUrlBot(g.url_bot || '');
                setGlobalInstanciaBot(g.instancia_bot || '');
                setGlobalApiKeyBot(g.apikey_bot || '');
            }
        } catch (e) { 
            console.error("❌ Error cargando datos en SuperAdmin:", e); 
        } finally { 
            clearTimeout(timeoutId);
            setLoading(false); 
        }
    };

    const handleSaveWaMasterTemplate = async () => {
        if (!editingWaTemplate?.content || !editingWaTemplate?.category) return;
        setIsSaving(true);
        try {
            await saasSaveWaTemplate({
                ...editingWaTemplate,
                sucursal_id: null // Asegurar que es global
            });
            const waTemplates = await saasGetWaTemplates();
            setWaMasterTemplates(waTemplates);
            setIsWaTemplateModalOpen(false);
            setEditingWaTemplate(null);
        } catch (e) {
            alert("Error al guardar mensaje maestro");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUploadWaMasterImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingWaImage(true);
        try {
            const url = await uploadGlobalAsset(file, `wa_master_assets/${Date.now()}_${file.name}`);
            setEditingWaTemplate(prev => prev ? { ...prev, image_url: url } : null);
        } catch (err) {
            alert("Error al subir imagen");
        } finally {
            setIsUploadingWaImage(false);
        }
    };
    const resetBranchForm = () => {
        setBrName(''); setBrRazonSocial(''); setBrRuc(''); setBrAddress(''); setBrPhone('');
        setBrSlug(''); setBrModoSunat('0'); setBrSunatUrl('https://apisu.sysventa.com/API_SUNAT/post.php');
        setBrSolUser('MODDATOS'); setBrSolPass('moddatos'); setBrFirmaPass('');
        setBrSerieBoleta('B001'); setBrSerieFactura('F001'); setBrSerieNv('NV01');
        setBrSerieNcF('FC01'); setBrSerieNcB('BC01');
        setBrNombreComercial(''); setBrUbigeo(''); setBrUrbanizacion('');
        setBrDistrito(''); setBrProvincia(''); setBrDepartamento('');
        setBrWaInstance(''); setBrWaToken(''); setBrWaName('');
        setBrYapeId(''); setBrOrderZeros('7'); setBrUseSuffix(false);
        setBrSuffixChar('A'); setBrSuffixPos('AFTER'); setBrPuntosEq('10');
        setBrCobranza(false); setBrColorPrimary('#0054A6'); setBrColorSecondary('#10B981');
        setBrLogoUrl(''); setBrFaviconUrl(''); setBrIsActive(true);
        setBrType(SucursalType.ESTANDAR);
        setBrCashManagementType(CashManagementType.DAILY);
        setBrPorcentajeIgv('18.00'); setBrMonedaSimbolo('S/');
        setBrUseOrderReset(false); setBrLimiteReconteo('10000');
        setBrModulosConfig(DEFAULT_MODULES_CONFIG);
        setBrCustomNvName('NOTA DE VENTA');
        setBrCorrelativos([]);
        setBrDocEnforceEnabled(false);
        setBrDocEnforceThreshold('700');
        setIsEditingBranch(false);
        setEditingBranchId(null);
        setBrUserFullname(''); setBrUsername(''); setBrUserPassword('');
    };

    const handleEditBranch = (branch: SaasBranch) => {
        setBrName(branch.name);
        setBrRazonSocial(branch.razonSocial || '');
        setBrRuc(branch.ruc);
        setBrAddress(branch.address);
        setBrPhone(branch.phone || '');
        setBrSlug(branch.slug);
        setBrIsActive(branch.isActive);
        setBrType(branch.sucursal_tipo || SucursalType.ESTANDAR);
        setBrCashManagementType(branch.cash_management_type || CashManagementType.DAILY);
        setBrCobranza(branch.cobranza || false);
        setBrColorPrimary(branch.primaryColor);
        setBrColorSecondary(branch.secondaryColor);
        setBrLogoUrl(branch.logoUrl || '');
        setBrFaviconUrl(branch.faviconUrl || '');
        setBrPorcentajeIgv(String(branch.porcentajeIgv ?? 18.00));
        setBrMonedaSimbolo(branch.moneda_simbolo ?? 'S/');
        setBrUseOrderReset(branch.use_order_reset || false);
        setBrLimiteReconteo(String(branch.limite_reconteo || 10000));
        setBrModulosConfig((branch as any).modulos_config || {});
        setBrCustomNvName((branch as any).modulos_config?.custom_nv_name || 'NOTA DE VENTA');
        setBrDocEnforceEnabled((branch as any).doc_enforce_enabled || false);
        setBrDocEnforceThreshold(String((branch as any).doc_enforce_threshold || 700));
        
        const rawBranch = branches.find(b => b.id === branch.id) as any;
        if (rawBranch) {
            setBrModoSunat(rawBranch.modo_sunat || '0');
            setBrSunatUrl(rawBranch.sunat_url || 'https://apisu.sysventa.com/API_SUNAT/post.php');
            setBrSolUser(rawBranch.sol_user || 'MODDATOS');
            setBrSolPass(rawBranch.sol_pass || 'moddatos');
            setBrFirmaPass(rawBranch.firma_pass || rawBranch.firmaPass || '');
            setBrSerieBoleta(rawBranch.serie_boleta || 'B001');
            setBrSerieFactura(rawBranch.serie_factura || 'F001');
            setBrSerieNv(rawBranch.serie_nv || 'NV01');
            setBrSerieNcF(rawBranch.serie_nc_factura || 'FC01');
            setBrSerieNcB(rawBranch.serie_nc_boleta || 'BC01');
            setBrNombreComercial(rawBranch.nombre_comercial || '');
            setBrUbigeo(rawBranch.ubigeo || '');
            setBrUrbanizacion(rawBranch.urbanizacion || '');
            setBrDistrito(rawBranch.distrito || '');
            setBrProvincia(rawBranch.provincia || '');
            setBrDepartamento(rawBranch.departamento || '');
            setBrWaInstance(rawBranch.whatsapp_instance || '');
            setBrWaToken(rawBranch.whatsapp_token || '');
            setBrWaName(rawBranch.whatsapp_instance_name || '');
            setBrYapeId(rawBranch.yape_tenant_id || '');
            setBrOrderZeros(String(rawBranch.order_zeros_count || 7));
            setBrUseSuffix(rawBranch.use_order_suffix || false);
            setBrSuffixChar(rawBranch.prefijo_sufijo || rawBranch.order_current_suffix || 'A');
            setBrSuffixPos(rawBranch.order_suffix_position || 'AFTER');
            setBrPuntosEq(String(rawBranch.puntos_equivalencia || 10));
            setBrCobranza(rawBranch.cobranza || false);
        }

        setIsEditingBranch(true);
        setEditingBranchId(branch.id);
        setBranchModalTab('GENERAL');
        setIsBranchModalOpen(true);
    };


    const handleCopyUrl = (slug: string) => {
        const url = `${window.location.origin}/?s=${slug}`;
        navigator.clipboard.writeText(url).then(() => {
            alert("URL de acceso directo copiada al portapapeles:\n" + url);
        }).catch(() => {
            alert("No se pudo copiar automáticamente. URL:\n" + url);
        });
    };

    const handleCopyOwnerUrl = (companyId: string) => {
        const url = `${window.location.origin}/?o=${companyId}`;
        navigator.clipboard.writeText(url).then(() => {
            alert("URL de acceso para Dueño copiada (Formato Seguro):\n" + url);
        }).catch(() => {
            alert("No se pudo copiar automáticamente. URL:\n" + url);
        });
    };

    const handleCopyId = (id: string, label: string) => {
        navigator.clipboard.writeText(id).then(() => {
            alert(`${label} copiado al portapapeles:\n${id}`);
        }).catch(() => {
            alert(`No se pudo copiar automáticamente. ${label}:\n${id}`);
        });
    };

    const handleSearchBranchRuc = async () => {
        if (!brRuc || isSearchingRuc || !globalIdentityToken) return;
        setIsSearchingRuc(true);
        try {
            const docType = brRuc.length === 11 ? 'RUC' : 'DNI';
            const result = await searchClient(docType, brRuc, globalIdentityToken);
            if (result) {
                if (result.name) {
                    const nameUpper = result.name.toUpperCase();
                    setBrRazonSocial(nameUpper);
                    setBrName(nameUpper);
                    setBrNombreComercial(nameUpper);
                }
                if (result.address) setBrAddress(result.address.toUpperCase());
                if (result.ubigeo) setBrUbigeo(result.ubigeo);
                if (result.urbanizacion) setBrUrbanizacion(result.urbanizacion.toUpperCase());
                if (result.distrito) setBrDistrito(result.distrito.toUpperCase());
                if (result.provincia) setBrProvincia(result.provincia.toUpperCase());
                if (result.departamento) setBrDepartamento(result.departamento.toUpperCase());
            }
        } catch (e) {
            console.error("Error al consultar API de identidad:", e);
        } finally {
            setIsSearchingRuc(false);
        }
    };

    const handleSearchCompanyRuc = async () => {
        if (!compRuc || isSearchingRuc || !globalIdentityToken) return;
        setIsSearchingRuc(true);
        try {
            const docType = compRuc.length === 11 ? 'RUC' : 'DNI';
            const result = await searchClient(docType, compRuc, globalIdentityToken);
            if (result) {
                if (result.name) setCompName(result.name.toUpperCase());
            }
        } catch (e) {
            console.error("Error al consultar API de identidad:", e);
        } finally {
            setIsSearchingRuc(false);
        }
    };

    const handleBranchAssetUpload = async (field: 'LOGO' | 'FAVICON', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && selectedCompany && brSlug) {
            setIsSaving(true);
            try {
                const url = await uploadBranchAsset(file, selectedCompany.name, brSlug, field);
                if (field === 'LOGO') setBrLogoUrl(url);
                else setBrFaviconUrl(url);
            } catch (err) {
                alert("Error subiendo imagen de la sede.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleCompanyAssetUpload = async (field: 'LOGO' | 'FAVICON' | 'LOGISTICA_FAVICON', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Si no hay nombre, usamos el RUC o un identificador temporal para la carpeta
        const identifier = compName.trim() || compRuc.trim() || 'nueva_empresa';
        
        setIsUploadingAsset(true);
        try {
            const url = await uploadCompanyAsset(file, identifier, field === 'LOGISTICA_FAVICON' ? 'FAVICON' : field);
            if (field === 'LOGO') setCompLogoUrl(url);
            else if (field === 'FAVICON') setCompFaviconUrl(url);
            else setCompFaviconLogisticaUrl(url);
        } catch (err: any) {
            console.error(`Error subiendo ${field}:`, err);
            alert(`Error subiendo ${field.toLowerCase()} de la empresa: ${err.message || 'Error desconocido'}`);
        } finally {
            setIsUploadingAsset(false);
        }
    };

    const handleEditCompany = (company: SaasCompany) => {
        setIsEditingCompany(true);
        setEditingCompanyId(company.id);
        setCompName(company.name);
        setCompNombreComercial(company.nombre_comercial || '');
        setCompRuc(company.ruc);
        setCompOwner(company.ownerName);
        
        // Parsear el código de país del teléfono
        const rawPhone = company.phone || '';
        let matchedCode = '+51';
        let matchedBody = rawPhone;
        const sortedCodes = [...LATAM_CODES].sort((a, b) => b.code.length - a.code.length);
        for (const item of sortedCodes) {
            if (rawPhone.startsWith(item.code)) {
                matchedCode = item.code;
                matchedBody = rawPhone.substring(item.code.length).trim();
                break;
            }
        }
        setCompPhoneCode(matchedCode);
        setCompPhoneBody(matchedBody);
        setCompPhone(rawPhone);

        setCompEmail(company.email || '');
        setCompLogoUrl(company.logoUrl || '');
        setCompFaviconUrl(company.faviconUrl || '');
        setCompFaviconLogisticaUrl(company.faviconLogisticaUrl || '');
        setCompPrimaryColor(company.primaryColor || '#4f46e5');
        setCompSecondaryColor(company.secondaryColor || '#0f172a');
        setCompIsActive(company.isActive);
        setCompPassword(''); // No mostramos la contraseña actual por seguridad
        setIsCompanyModalOpen(true);
    };

    const resetCompanyForm = () => {
        setIsEditingCompany(false);
        setEditingCompanyId(null);
        setCompName(''); 
        setCompNombreComercial('');
        setCompRuc(''); 
        setCompOwner(''); 
        setCompPhone(''); 
        setCompPhoneCode('+51');
        setCompPhoneBody('');
        setCompEmail(''); 
        setCompPassword('');
        setCompLogoUrl('');
        setCompFaviconUrl('');
        setCompFaviconLogisticaUrl('');
        setCompPrimaryColor('#4f46e5');
        setCompSecondaryColor('#0f172a');
        setCompIsActive(true);
    };

    const handleSaveCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!compRuc || !compName || !compEmail) {
            alert("Por favor complete los campos obligatorios (RUC, Nombre, Correo).");
            return;
        }

        if (!isEditingCompany && !compPassword) {
            alert("Debe asignar una contraseña para la nueva empresa.");
            return;
        }

        setIsSaving(true);
        try {
            const companyData = { 
                name: compName, 
                nombre_comercial: compNombreComercial,
                ruc: compRuc, 
                ownerName: compOwner, 
                phone: (compPhoneCode + compPhoneBody).trim(), 
                email: compEmail, 
                password: compPassword,
                logoUrl: compLogoUrl,
                faviconUrl: compFaviconUrl,
                faviconLogisticaUrl: compFaviconLogisticaUrl,
                primaryColor: compPrimaryColor,
                secondaryColor: compSecondaryColor,
                isActive: compIsActive
            };
            
            if (isEditingCompany && editingCompanyId) {
                await updateSaasCompany(editingCompanyId, companyData);
            } else {
                // 1. Crear la empresa en la tabla
                const newCompany = await createSaasCompany(companyData);
                
                // 2. Intentar crear el usuario en Auth (opcional si falla no bloquea la creación de la empresa)
                if (compEmail && compPassword) {
                    try {
                        console.log("👤 Creando usuario administrador inicial...");
                        await createInitialHoldingUser({
                            email: compEmail,
                            password: compPassword,
                            username: compEmail.split('@')[0], // Usamos la parte antes del @ como username
                            name: compOwner,
                            empresaHoldingId: newCompany.id,
                            holdingName: compName
                        });
                        console.log("✅ Usuario administrador creado con éxito.");
                    } catch (authErr: any) {
                        console.error("❌ Error en Auth al crear usuario inicial:", authErr);
                        const errorDetail = authErr.message || JSON.stringify(authErr);
                        if (errorDetail.includes('already registered') || authErr.code === 'email_exists') {
                            alert("La empresa se creó correctamente, pero el correo ya existe en el sistema. El dueño deberá usar sus credenciales existentes.");
                        } else if (errorDetail.includes('rate limit')) {
                            alert("Error: Límite de correos alcanzado. Por favor, desactive 'Confirm Email' en Supabase -> Authentication -> Providers -> Email.");
                        } else {
                            alert(`Empresa creada, pero hubo un problema al registrar el acceso: ${errorDetail}`);
                        }
                    }
                }
            }
            
            setIsCompanyModalOpen(false);
            resetCompanyForm();
            await loadData();
            alert(isEditingCompany ? "Empresa actualizada con éxito." : "Empresa creada con éxito.");
        } catch (e: any) { 
            console.error("Error detallado al guardar empresa:", e);
            let msg = e.message || 'Error desconocido';
            if (e.code === '23505') { // Postgres Unique Violation
                if (msg.includes('ruc')) msg = "El RUC ya está registrado para otra empresa.";
                else if (msg.includes('correo_login')) msg = "El correo ya está registrado para otra empresa.";
                else msg = "Ya existe un registro con estos datos únicos.";
            }
            alert(isEditingCompany ? `Error al actualizar empresa: ${msg}` : `Error al crear empresa: ${msg}`); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleDeleteCompany = (id: string, name: string) => {
        setCompanyToDelete({ id, name });
        setIsDeleteModalOpen(true);
    };

    const confirmDeleteCompany = async () => {
        if (!companyToDelete) return;
        
        setIsSaving(true);
        try {
            await deleteSaasCompany(companyToDelete.id);
            await loadData();
            setIsDeleteModalOpen(false);
            setCompanyToDelete(null);
            // Usamos un alert simple para confirmar éxito, o podríamos hacer un toast
            alert("Empresa eliminada correctamente.");
        } catch (e: any) {
            console.error("Error al eliminar empresa:", e);
            alert(`Error al eliminar: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const generateUniqueSlug = (name: string) => {
        const cleanName = name.toLowerCase()
            .trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
        const randomStr = Math.random().toString(36).substring(2, 7);
        return `${cleanName}_${randomStr}`;
    };

    const handleSaveBranch = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const branchData: any = { 
            empresaId: selectedCompany?.id,
            name: brName,
            razonSocial: brRazonSocial,
            slug: isEditingBranch ? brSlug : generateUniqueSlug(brName),
            ruc: brRuc,
            address: brAddress || '-',
            phone: brPhone || null,
            modo_sunat: brModoSunat,
            sunat_url: brSunatUrl,
            sol_user: brSolUser,
            sol_pass: brSolPass,
            firma_pass: brFirmaPass,
            serie_boleta: brSerieBoleta,
            serie_factura: brSerieFactura,
            serie_nv: brSerieNv,
            serie_nc_factura: brSerieNcF,
            serie_nc_boleta: brSerieNcB,
            nombre_comercial: brNombreComercial,
            ubigeo: brUbigeo,
            urbanizacion: brUrbanizacion,
            distrito: brDistrito,
            provincia: brProvincia,
            departamento: brDepartamento,
            whatsapp_instance: brWaInstance,
            whatsapp_token: brWaToken,
            whatsapp_instance_name: brWaName,
            yape_tenant_id: brYapeId,
            order_zeros_count: brOrderZeros,
            use_order_suffix: brUseSuffix,
            order_current_suffix: brSuffixChar,
            prefijo_sufijo: brSuffixChar,
            order_suffix_position: brSuffixPos,
            use_order_reset: brUseOrderReset,
            limite_reconteo: brLimiteReconteo,
            doc_enforce_enabled: brDocEnforceEnabled,
            doc_enforce_threshold: brDocEnforceThreshold,
            sucursal_tipo: brType,
            cash_management_type: brCashManagementType,
            puntos_equivalencia: parseFloat(brPuntosEq),
            cobranza: brCobranza,
            color_primario: brColorPrimary,
            color_secundario: brColorSecondary,
            url_logo: brLogoUrl,
            url_favicon: brFaviconUrl,
            isActive: brIsActive,
            porcentaje_igv: parseFloat(brPorcentajeIgv),
            moneda_simbolo: brMonedaSimbolo,
            modulos_config: {
                ...brModulosConfig,
                custom_nv_name: brCustomNvName || 'NOTA DE VENTA'
            }
        };

        const saveCorrelativos = async (sucursalId: string) => {
            try {
                for (const item of brCorrelativos) {
                    await supabase.from('dispensador_correlativos').upsert({
                        sucursal_id: sucursalId,
                        tipo_documento: item.tipo_documento,
                        serie: item.serie.toUpperCase(),
                        ultimo_numero: item.ultimo_numero
                    }, {
                        onConflict: 'sucursal_id,tipo_documento,serie'
                    });
                }
            } catch (err) {
                console.error("Error al guardar correlativos dispensador:", err);
            }
        };

        try {
            if (isEditingBranch && editingBranchId) {
                const originalBranch = branches.find(b => b.id === editingBranchId);
                const wasCobranza = originalBranch?.cobranza || false;
                
                if (brCobranza && !wasCobranza) {
                    branchData.cobranza_activada_at = new Date().toISOString().replace('Z', '-05:00');
                } else if (!brCobranza) {
                    branchData.cobranza_activada_at = null;
                } else {
                    branchData.cobranza_activada_at = originalBranch?.cobranza_activada_at;
                }
                
                await updateSaasBranch(editingBranchId, branchData);
                await saveCorrelativos(editingBranchId);
            } else {
                if (brCobranza) {
                    branchData.cobranza_activada_at = new Date().toISOString().replace('Z', '-05:00');
                }
                const newBranch = await createSaasBranch(branchData);
                if (newBranch && newBranch.id) {
                    await saveCorrelativos(newBranch.id);
                }
                
                // Si se llenaron los datos del usuario inicial, crearlo
                if (brUsername && brUserPassword && brUserFullname && newBranch) {
                    await createInitialBranchUser({
                        username: brUsername,
                        password: brUserPassword,
                        name: brUserFullname,
                        sucursalId: newBranch.id,
                        empresaId: selectedCompany?.id,
                        holdingName: selectedCompany?.name
                    });
                }
            }
            setIsBranchModalOpen(false);
            resetBranchForm();
            await loadData();
        } catch (e: any) { 
            console.error("Save Error:", e);
            alert("Error al guardar sucursal."); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleAddItem = async () => {
        const modulo = currentCatalogModule;
        if (!catalogItem.nombre) { alert("Ingrese el nombre del recurso."); return; }
        setIsSaving(true);
        try {
            if (editingCatalogId) {
                await updateGlobalCatalogItem(editingCatalogId, modulo, catalogItem);
                setEditingCatalogId(null);
                alert("Recurso actualizado correctamente.");
            } else {
                await addGlobalCatalogItem({ ...catalogItem, modulo });
            }
            setCatalogItem({ nombre: '', url: '', hex: '#FFFFFF', tipo: 'LAVADORA', modulo_id: '' });
            setIsCatalogModalOpen(false);
            await loadData();
        } catch (e: any) { 
            console.error("Error saving catalog item:", e);
            alert("Error al guardar: " + (e?.message || JSON.stringify(e) || String(e))); 
        } finally { setIsSaving(false); }
    };

    const confirmDeleteCatalogItem = async () => {
        if (!catalogItemToDelete) return;
        setIsSaving(true);
        try {
            await softDeleteGlobalItem(catalogItemToDelete.id, currentCatalogModule);
            setIsCatalogDeleteModalOpen(false);
            setCatalogItemToDelete(null);
            await loadData();
        } catch (e) { 
            alert("Error al eliminar."); 
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteCatalogItem = (item: any, modulo: string) => {
        setCatalogItemToDelete(item);
        setCurrentCatalogModule(modulo);
        setIsCatalogDeleteModalOpen(true);
    };

    const startEditingCatalogItem = (item: any, modulo: string) => {
        setEditingCatalogId(item.id);
        setCurrentCatalogModule(modulo);
        setCatalogItem({
            nombre: modulo === 'VIDEO' ? item.title : item.nombre,
            url: modulo === 'COLOR' ? item.url_imagen : (modulo === 'VIDEO' ? item.youtubeUrl : item.url),
            hex: item.hex || '#FFFFFF',
            tipo: item.tipo || 'LAVADORA',
            modulo_id: item.modulo_id || ''
        });
        setIsCatalogModalOpen(true);
    };

    const startAddingCatalogItem = (modulo: string) => {
        setEditingCatalogId(null);
        setCurrentCatalogModule(modulo);
        setCatalogItem({ nombre: '', url: '', hex: '#FFFFFF', tipo: 'LAVADORA', modulo_id: '' });
        setIsCatalogModalOpen(true);
    };

    const handleUpload = async (modulo: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Límite de 2MB
            const MAX_SIZE = 2 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                alert("El archivo es demasiado grande (Máximo 2MB).");
                return;
            }

            setIsSaving(true);
            try {
                const url = await uploadGlobalAsset(file, modulo);
                if (modulo === 'BANNER_COBRO') {
                    setGlobalBannerCobro(url);
                    await updateSaasGlobalConfig({ banner_cobro: url });
                } else {
                    setCatalogItem(prev => ({ ...prev, url }));
                }
            } catch (err) { 
                console.error("Upload error:", err);
                alert("Error subiendo archivo al storage."); 
            } finally { setIsSaving(false); }
        }
    };

    const handleSaveGlobalAPIs = async () => {
        setIsSaving(true);
        try {
            await updateSaasGlobalConfig({ 
                token_maestro_identidad: globalIdentityToken.trim(),
                url_bot: globalUrlBot.trim(),
                instancia_bot: globalInstanciaBot.trim(),
                apikey_bot: globalApiKeyBot.trim()
            });
            alert("Configuraciones globales actualizadas.");
            await loadData();
        } catch (e) { alert("Error al guardar configuraciones."); } finally { setIsSaving(false); }
    };

    const handleSaveSettings = async () => {
        if (!globalWaSaas) { alert("El número de WhatsApp es obligatorio."); return; }
        setIsSaving(true);
        try {
            await updateSaasGlobalConfig({
                whatsapp_saas: parseFloat(globalWaSaas),
                whatsapp_cod_pais: globalWaCodPais
            });
            alert("Ajustes de contacto maestro guardados.");
            await loadData();
        } catch (e) { alert("Error al guardar ajustes."); } finally { setIsSaving(false); }
    };

    const [isUpdatingVersion, setIsUpdatingVersion] = useState(false);
    const [minVersionInput, setMinVersionInput] = useState(APP_VERSION);

    useEffect(() => {
        const fetchCurrentMinVersion = async () => {
            try {
                const { data } = await supabase
                    .from('app_config')
                    .select('value')
                    .eq('key', 'min_required_version')
                    .single();
                if (data?.value) setMinVersionInput(data.value);
            } catch (e) { console.error("Error fetching min version:", e); }
        };
        fetchCurrentMinVersion();
    }, []);

    const handleUpdateAppVersion = async () => {
        if (!minVersionInput) return;
        setIsUpdatingVersion(true);
        try {
            const { error } = await supabase
                .from('app_config')
                .upsert({ key: 'min_required_version', value: minVersionInput }, { onConflict: 'key' });

            if (error) throw error;
            alert(`Versión mínima requerida actualizada a: ${minVersionInput}. El cambio es inmediato para todos los usuarios.`);
        } catch (err: any) {
            console.error("Error updating version:", err);
            alert("Error al actualizar versión: " + err.message);
        } finally {
            setIsUpdatingVersion(false);
        }
    };

    const toggleAccordion = (id: string) => {
        setActiveAccordion(activeAccordion === id ? null : id);
        setCatalogItem({ nombre: '', url: '', hex: '#FFFFFF', tipo: 'LAVADORA' });
    };

    const getYouTubeId = (url: string) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const selectedCountry = LATAM_CODES.find(c => c.code === globalWaCodPais) || LATAM_CODES[0];
    const selectedCompPhoneCountry = LATAM_CODES.find(c => c.code === compPhoneCode) || LATAM_CODES[0];

    if (loading) return <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-indigo-500 gap-4">
        <Loader2 className="animate-spin" size={48} />
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Accediendo al Núcleo...</p>
        
        {/* Botón de emergencia para entrar si la DB tarda demasiado */}
        <button 
            onClick={() => setLoading(false)}
            className="mt-8 px-6 py-2 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/60 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all border border-white/5"
        >
            Forzar Entrada (Modo Emergencia)
        </button>
    </div>;

    return (
        <div className="h-screen flex flex-col md:flex-row bg-slate-950 text-slate-200 font-sans overflow-hidden">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-white/5 z-30">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-xl"><ShieldCheck size={20} className="text-white" /></div>
                    <span className="font-bold uppercase tracking-tight text-white">Sislav SaaS</span>
                </div>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-white">
                    {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`fixed md:relative inset-y-0 left-0 w-72 bg-slate-900 border-r border-white/5 flex flex-col shrink-0 z-50 shadow-2xl transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-8 mb-4 hidden md:block">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg"><ShieldCheck size={24} className="text-white" /></div>
                        <div>
                            <h1 className="text-lg font-bold uppercase tracking-tight text-white">Sislav <span className="text-indigo-400">SaaS</span></h1>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em]">Master Panel</p>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 px-4 space-y-2 mt-4 md:mt-0">
                    <button onClick={() => { setView('ACCOUNTS'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${view === 'ACCOUNTS' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}><Building size={18} /> Cuentas & Sedes</button>
                    <button onClick={() => { setView('BULK_MODULOS'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${view === 'BULK_MODULOS' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}><LayoutGrid size={18} /> Módulos</button>
                    <button onClick={() => { setView('USERS'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${view === 'USERS' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}><Users size={18} /> Accesos</button>
                    <button onClick={() => { setView('GLOBAL'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${view === 'GLOBAL' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}><Globe size={18} /> Config. Global</button>
                    <button onClick={() => { setView('LOGS'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${view === 'LOGS' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}><Terminal size={18} /> Logs Sistema</button>
                    <button onClick={() => { setView('SETTINGS'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${view === 'SETTINGS' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}><Settings size={18} /> Ajustes</button>
                    <a 
                        href="/sislav.md" 
                        download="sislav.md"
                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all text-slate-500 hover:text-white hover:bg-white/5"
                    >
                        <FileText size={18} /> Descargar .md
                    </a>
                </nav>
                <div className="p-6 mt-auto space-y-2">
                    <button 
                        onClick={() => setShowDiagnostics(!showDiagnostics)}
                        className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-white/5 text-slate-500 hover:text-indigo-400 font-bold text-[9px] uppercase tracking-widest transition-all"
                    >
                        <Shield size={14} /> Diagnóstico
                    </button>
                    <button 
                        onClick={() => {
                            console.log("Botón Cerrar Sesión clickeado en SuperAdmin");
                            onLogout();
                        }} 
                        className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white/5 text-slate-400 hover:text-rose-400 font-bold text-[10px] uppercase tracking-widest transition-all"
                    >
                        <LogOut size={16} /> Cerrar Sesión
                    </button>
                </div>
            </aside>

            {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

            {/* Diagnostics Modal */}
            {showDiagnostics && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Shield className="text-indigo-400" size={24} />
                                <h3 className="text-xl font-bold uppercase tracking-tight text-white">Diagnóstico de Sesión</h3>
                            </div>
                            <button onClick={() => setShowDiagnostics(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">ID de Usuario (Auth)</p>
                                    <p className="text-sm font-mono text-indigo-300 break-all">{sessionInfo?.user?.id || 'No disponible'}</p>
                                </div>
                                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Rol en Sesión</p>
                                    <p className="text-sm font-bold text-white uppercase tracking-widest">{sessionInfo?.user?.role || 'No disponible'}</p>
                                </div>
                                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Nombre de Usuario</p>
                                    <p className="text-sm text-slate-300">{sessionInfo?.user?.username || 'No disponible'}</p>
                                </div>
                            </div>
                            
                            <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-2xl">
                                <div className="flex gap-3 mb-3">
                                    <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                                    <p className="text-xs font-bold text-amber-200 uppercase tracking-widest">Estado de RLS</p>
                                </div>
                                <p className="text-[11px] text-amber-200/70 leading-relaxed">
                                    Si el ID de usuario no existe en la tabla <code className="text-amber-400">usuarios_login</code> con el rol <code className="text-amber-400">SAAS_MASTER</code>, las políticas de seguridad (RLS) bloquearán todos los datos, resultando en una pantalla vacía.
                                </p>
                            </div>
                        </div>
                        <div className="p-8 bg-black/20 flex gap-4">
                            <button 
                                onClick={() => { setShowDiagnostics(false); onLogout(); }}
                                className="flex-1 py-4 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                            >
                                Forzar Logout
                            </button>
                            <button 
                                onClick={() => setShowDiagnostics(false)}
                                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="flex-1 overflow-y-auto relative bg-[#0a0f1d] custom-scrollbar">
                <div className="p-6 md:p-10 max-w-[1400px] mx-auto relative z-10">
                    {view === 'ACCOUNTS' && (
                        <div className="space-y-10 animate-in fade-in duration-500">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                                <div><h2 className="text-3xl md:text-4xl font-bold uppercase tracking-tight text-white leading-none">CUENTAS SAAS</h2><p className="text-slate-500 text-sm font-medium mt-1 uppercase">Supervisión de empresas registradas ({companiesTotal}).</p></div>
                                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                                    <div className="relative w-full md:w-80">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input 
                                            type="text" 
                                            placeholder="Buscar empresa..." 
                                            value={companySearch}
                                            className="w-full bg-slate-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium focus:border-indigo-500 transition-all outline-none"
                                            onChange={(e) => setCompanySearch(e.target.value)}
                                        />
                                    </div>
                                    <button onClick={() => { resetCompanyForm(); setIsCompanyModalOpen(true); }} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-[0.15em] shadow-xl flex items-center justify-center gap-3 text-white"><Plus size={20} strokeWidth={3} /> Nueva Empresa</button>
                                </div>
                            </div>

                            {/* Pagination Controls */}
                            {companiesTotal > 0 && (
                                <div className="flex items-center justify-between bg-slate-900/30 p-4 rounded-3xl border border-white/5">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        Mostrando {companies.length} de {companiesTotal} empresas
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            disabled={companiesPage === 1}
                                            onClick={() => setCompaniesPage(p => Math.max(1, p - 1))}
                                            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 transition-all"
                                        >
                                            <ChevronDown className="rotate-90" size={20} />
                                        </button>
                                        <span className="text-xs font-bold px-4 py-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/20">
                                            Página {companiesPage}
                                        </span>
                                        <button 
                                            disabled={companies.length < 50 || (companiesPage * 50) >= companiesTotal}
                                            onClick={() => setCompaniesPage(p => p + 1)}
                                            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 transition-all"
                                        >
                                            <ChevronDown className="-rotate-90" size={20} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                {companies.filter(c => c.isActive && (c.name.toLowerCase().includes(companySearch.toLowerCase()) || c.ruc.includes(companySearch))).map(company => {
                                    const companyBranches = branches.filter(b => b.empresaId === company.id);
                                    return (
                                        <div key={company.id} className="bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] md:rounded-[3rem] border border-white/5 p-6 md:p-8 shadow-2xl group hover:border-indigo-500/30 transition-all flex flex-col h-full">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-3xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                                                        {company.logoUrl ? <img src={company.logoUrl} className="w-full h-full object-contain p-2" /> : <Building size={32} />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                            <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight text-white">{company.name}</h3>
                                                            <div className="flex items-center gap-2">
                                                                <button 
                                                                    onClick={() => handleCopyOwnerUrl(company.id)}
                                                                    className="text-slate-500 hover:text-indigo-400 transition-colors"
                                                                    title="Copiar URL de Login de Dueño"
                                                                >
                                                                    <Link size={16} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => {
                                                                        // Bypass para entrar como OWNER de esta empresa usando el nuevo controlador centralizado
                                                                        onSelectOwner(company);
                                                                    }}
                                                                    className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all border border-emerald-500/20 flex items-center gap-1"
                                                                    title="Acceso Directo como Propietario"
                                                                >
                                                                    <ShieldCheck size={10} /> Acceso Directo
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold uppercase ${company.paymentStatus === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                {company.paymentStatus}
                                                            </span>
                                                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{company.ruc}</span>
                                                            <span 
                                                                onClick={() => handleCopyId(company.id, 'Holding ID')}
                                                                className="text-[9px] font-mono font-bold text-indigo-400/50 uppercase tracking-tighter bg-indigo-400/5 px-2 py-0.5 rounded-md border border-indigo-400/10 cursor-pointer hover:bg-indigo-400/10 hover:text-indigo-400 transition-all flex items-center gap-1.5" 
                                                                title="Clic para copiar Holding ID (UUID)"
                                                            >
                                                                HID: {company.id} <Copy size={10} />
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 self-end md:self-auto">
                                                    <button 
                                                        onClick={() => handleEditCompany(company)}
                                                        className="bg-white/5 hover:bg-white/20 text-slate-400 hover:text-white p-3 rounded-2xl transition-all border border-white/5"
                                                        title="Editar Empresa"
                                                    >
                                                        <Edit size={20} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteCompany(company.id, company.name)}
                                                        className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white p-3 rounded-2xl transition-all border border-red-500/20"
                                                        title="Eliminar Empresa"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                    <button 
                                                        onClick={() => { resetBranchForm(); setSelectedCompany(company); setIsBranchModalOpen(true); }}
                                                        className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white p-3 rounded-2xl transition-all border border-indigo-500/20"
                                                        title="Añadir Sucursal"
                                                    >
                                                        <Plus size={20} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex-1 space-y-3">
                                                {companyBranches.map(branch => (
                                                    <div key={branch.id} className="bg-black/40 border border-white/5 rounded-[1.8rem] p-4 md:p-5 flex flex-col md:flex-row items-center justify-between group/item hover:bg-indigo-900/20 transition-all gap-4">
                                                        <div className="flex items-center gap-5 text-slate-200 w-full md:w-auto">
                                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center p-2 shadow-lg transform group-hover/item:scale-110 transition-transform shrink-0">
                                                                {branch.logoUrl ? <img src={branch.logoUrl} className="max-w-full h-auto object-contain" /> : <Store size={24} className="text-slate-300" />}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <span className="font-bold text-sm uppercase text-white block leading-none mb-1 truncate">{branch.name}</span>
                                                                <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight italic">slug: {branch.slug}</span>
                                                                    <span 
                                                                        onClick={() => handleCopyId(branch.id, 'Sucursal ID')}
                                                                        className="text-[9px] font-mono font-bold text-indigo-400/40 uppercase tracking-tighter bg-white/5 px-1.5 py-0.5 rounded-md cursor-pointer hover:bg-white/10 hover:text-indigo-400/60 transition-all flex items-center gap-1.5" 
                                                                        title="Clic para copiar Sucursal ID (UUID)"
                                                                    >
                                                                        SID: {branch.id} <Copy size={10} />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 w-full md:w-auto justify-end">
                                                            <button 
                                                                onClick={() => onSelectTenant(branch, true)}
                                                                className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white p-2.5 md:p-3 rounded-2xl transition-all border border-indigo-500/20 shadow-lg shadow-indigo-500/10 group/enter"
                                                                title="Ingresar a Sucursal"
                                                            >
                                                                <LogIn size={16} className="group-hover/enter:translate-x-0.5 transition-transform" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleCopyUrl(branch.slug)}
                                                                className="bg-white/5 hover:bg-white/20 text-slate-400 hover:text-white p-2.5 md:p-3 rounded-2xl transition-all border border-white/5"
                                                                title="Copiar URL de Acceso"
                                                            >
                                                                <Copy size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => { setSelectedCompany(company); handleEditBranch(branch); }}
                                                                className="bg-white/5 hover:bg-white/20 text-slate-400 hover:text-white p-2.5 md:p-3 rounded-2xl transition-all border border-white/5"
                                                                title="Editar Sucursal"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {companies.length === 0 && !loading && (
                                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500 gap-6 border-2 border-dashed border-white/5 rounded-[3rem] bg-slate-900/20">
                                        <div className="bg-amber-500/10 p-6 rounded-full">
                                            <AlertTriangle size={48} className="text-amber-500/50" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold uppercase tracking-[0.2em] text-white text-lg">Sin Datos Disponibles</p>
                                            <p className="text-xs mt-2 opacity-60 max-w-md mx-auto leading-relaxed">
                                                No se han podido recuperar las empresas. Esto puede deberse a una sesión expirada, falta de permisos de SAAS_MASTER o un problema de red.
                                            </p>
                                        </div>
                                        <div className="flex gap-4">
                                            <button 
                                                onClick={() => loadData()} 
                                                className="flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                                            >
                                                <RefreshCcw size={18} /> Reintentar Carga
                                            </button>
                                            <button 
                                                onClick={onLogout} 
                                                className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all"
                                            >
                                                <LogOut size={18} /> Cerrar y Reingresar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {view === 'LOGS' && <SystemLogsView />}
                    {view === 'USERS' && <UsersListView />}
                    {view === 'BULK_MODULOS' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-tight text-white leading-none">Gestión Masiva de Módulos</h2>
                                <p className="text-slate-500 text-sm font-medium mt-1 uppercase">Configure la visibilidad de módulos para todas las sedes del sistema.</p>
                            </div>

                            <div className="bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-8 shadow-2xl">
                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {['PRINCIPAL', 'GESTIÓN', 'LOGÍSTICA', 'MARKETING', 'ADMINISTRACIÓN', 'SISTEMA'].map(category => (
                                        <div key={category} className="space-y-4">
                                            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                                                    <LayoutGrid size={16} />
                                                </div>
                                                <h5 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">{category}</h5>
                                            </div>
                                            <div className="space-y-3">
                                                {SYSTEM_MODULES.filter(m => m.category === category).map(module => (
                                                    <div key={module.id} className="flex flex-col gap-3 p-5 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-all group">
                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[11px] font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors truncate">{module.label}</span>
                                                                <span className="text-[9px] font-bold text-slate-500 font-mono truncate">{module.id}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 shrink-0">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">NUEVO</span>
                                                                    <button 
                                                                        onClick={async () => {
                                                                            try {
                                                                                const currentConfig = globalConfig?.globalModules || {};
                                                                                const moduleCfg = typeof currentConfig[module.id] === 'object' 
                                                                                    ? currentConfig[module.id] 
                                                                                    : { isActive: true };
                                                                                
                                                                                const isNew = !moduleCfg.isNew;
                                                                                const newModules = {
                                                                                    ...currentConfig,
                                                                                    [module.id]: {
                                                                                        ...moduleCfg,
                                                                                        isNew
                                                                                    }
                                                                                };
                                                                                await updateSaasGlobalConfig({ modulos_globales: newModules });
                                                                                await loadData();
                                                                            } catch (err: any) {
                                                                                console.error("Error updating badge:", err);
                                                                                alert(`Error actualizando badge NUEVO: ${err.message || 'Error desconocido'}`);
                                                                            }
                                                                        }}
                                                                        className={`relative w-10 h-5 rounded-full transition-all ${globalConfig?.globalModules?.[module.id]?.isNew ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                                                    >
                                                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${globalConfig?.globalModules?.[module.id]?.isNew ? 'left-6' : 'left-1'}`} />
                                                                    </button>
                                                                </div>
                                                                <div className="h-8 w-px bg-white/10" />
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">ACTIVO</span>
                                                                    <button 
                                                                        onClick={async () => {
                                                                            const currentConfig = globalConfig?.globalModules || {};
                                                                            const moduleCfg = typeof currentConfig[module.id] === 'object' 
                                                                                ? currentConfig[module.id] 
                                                                                : { isNew: false };
                                                                            
                                                                            const isActive = !(moduleCfg.isActive !== false);
                                                                            
                                                                            if (confirm(`¿Está seguro de ${isActive ? 'ACTIVAR' : 'DESACTIVAR'} el módulo "${module.label}" para TODAS las sedes?`)) {
                                                                                try {
                                                                                    const newModules = {
                                                                                        ...currentConfig,
                                                                                        [module.id]: {
                                                                                            ...moduleCfg,
                                                                                            isActive
                                                                                        }
                                                                                    };
                                                                                    await updateSaasGlobalConfig({ modulos_globales: newModules });
                                                                                    await loadData();
                                                                                } catch (err: any) {
                                                                                    console.error("Error updating active status:", err);
                                                                                    alert(`Error actualizando estado global: ${err.message || 'Error desconocido'}`);
                                                                                }
                                                                            }
                                                                        }}
                                                                        className={`relative w-10 h-5 rounded-full transition-all ${globalConfig?.globalModules?.[module.id]?.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                                    >
                                                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${globalConfig?.globalModules?.[module.id]?.isActive !== false ? 'left-6' : 'left-1'}`} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/5">
                                                            {['OWNER', 'ADMIN', 'CAJERO', 'OPERARIO', 'DELIVERY', 'CONTABILIDAD'].map(role => {
                                                                const isAllowed = globalConfig?.globalModules?.[module.id]?.allowedRoles?.includes(role);
                                                                return (
                                                                    <button
                                                                        key={role}
                                                                        onClick={async () => {
                                                                            try {
                                                                                const currentConfig = globalConfig?.globalModules || {};
                                                                                const moduleCfg = typeof currentConfig[module.id] === 'object' 
                                                                                    ? currentConfig[module.id] 
                                                                                    : { isActive: true, isNew: false };
                                                                                
                                                                                const currentRoles = Array.isArray(moduleCfg.allowedRoles) ? moduleCfg.allowedRoles : [];
                                                                                const newRoles = currentRoles.includes(role)
                                                                                    ? currentRoles.filter((r: string) => r !== role)
                                                                                    : [...currentRoles, role];
                                                                                
                                                                                const newModules = {
                                                                                    ...currentConfig,
                                                                                    [module.id]: {
                                                                                        ...moduleCfg,
                                                                                        allowedRoles: newRoles
                                                                                    }
                                                                                };
                                                                                await updateSaasGlobalConfig({ modulos_globales: newModules });
                                                                                await loadData();
                                                                            } catch (err: any) {
                                                                                console.error("Error updating roles:", err);
                                                                                alert(`Error actualizando roles: ${err.message || 'Error desconocido'}`);
                                                                            }
                                                                        }}
                                                                        className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all border ${
                                                                            isAllowed 
                                                                            ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400' 
                                                                            : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/20'
                                                                        }`}
                                                                    >
                                                                        {role}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'GLOBAL' && (
                        <div className="space-y-8 animate-in fade-in duration-500 text-slate-200">
                            <div><h2 className="text-3xl md:text-4xl font-bold uppercase tracking-tight text-white">Configuración Global</h2><p className="text-slate-500 text-sm font-medium mt-1 uppercase">Gestión de recursos centrales.</p></div>
                            <div className="space-y-4">
                                <AccordionItem id="APIS_MAESTRAS" title="APIs Maestras & Bots" icon={<Key size={20} />} isOpen={activeAccordion === 'APIS_MAESTRAS'} onToggle={() => toggleAccordion('APIS_MAESTRAS')}>
                                    <div className="space-y-8 max-w-4xl">
                                        <div className="bg-indigo-900/20 border border-indigo-500/30 p-6 rounded-[2rem] flex items-start gap-4 shadow-inner"><ShieldAlert className="text-indigo-400 shrink-0" size={24} /><div><h4 className="text-[11px] font-bold text-white uppercase tracking-widest mb-1">Centralización de Servicios</h4><p className="text-[10px] text-indigo-300 font-bold uppercase leading-tight">Endpoints maestros para identidad y monitoreo.</p></div></div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <h4 className="text-[11px] font-bold text-white uppercase tracking-widest border-b border-white/10 pb-2">Identidad & Banners</h4>
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Token Maestro Identidad</label>
                                                        <input type="password" value={globalIdentityToken} onChange={e => setGlobalIdentityToken(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 font-mono text-sm text-indigo-400 outline-none focus:border-indigo-500 transition-all" placeholder="Bearer token..." />
                                                    </div>
                                                    <div className="pt-2">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Banner Global de Cobranza</label>
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-32 aspect-video rounded-2xl bg-black/40 border-2 border-dashed border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                                                {globalBannerCobro ? <img src={globalBannerCobro} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-slate-700" />}
                                                            </div>
                                                            <label className="bg-white/5 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-[9px] uppercase cursor-pointer transition-all border border-white/5">
                                                                SUBIR <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUpload('BANNER_COBRO', e)} />
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <h4 className="text-[11px] font-bold text-white uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2"><Bot size={14} className="text-indigo-400" /> Bot de Actividad</h4>
                                                <div className="space-y-4">
                                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">URL Base Evolution</label><input value={globalUrlBot} onChange={e => setGlobalUrlBot(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 font-mono text-xs text-slate-300 outline-none" /></div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Instancia</label><input value={globalInstanciaBot} onChange={e => setGlobalInstanciaBot(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 font-bold text-xs" /></div>
                                                        <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">API Key</label><input type="password" value={globalApiKeyBot} onChange={e => setGlobalApiKeyBot(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 font-mono text-xs" /></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={handleSaveGlobalAPIs} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95">{isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />} GUARDAR CONFIGURACIÓN</button>
                                    </div>
                                </AccordionItem>

                                <AccordionItem id="CATEGORIAS" title="Iconos de Categoría" icon={<Layers size={20} />} isOpen={activeAccordion === 'CATEGORIAS'} onToggle={() => toggleAccordion('CATEGORIAS')}>
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-black/20 p-6 rounded-3xl border border-white/5">
                                            <div>
                                                <h4 className="text-[11px] font-bold text-white uppercase tracking-widest">Listado de Categorías</h4>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase">Predefinidas para nuevas sedes.</p>
                                            </div>
                                            <button 
                                                onClick={() => startAddingCatalogItem('CATEGORIA')}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold text-[10px] uppercase shadow-lg transition-all active:scale-95 flex items-center gap-2"
                                            >
                                                <Plus size={16} /> NUEVA CATEGORÍA
                                            </button>
                                        </div>
                                                <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-10 gap-4">
                                                    {globalConfig?.defaultCategoryImages.map(img => (
                                                        <div key={img.id} className="bg-black/40 border border-white/5 p-3 rounded-2xl relative group">
                                                            <div className="aspect-square flex items-center justify-center"><img src={img.url} className="max-w-full max-h-full object-contain" /></div>
                                                            <p className="text-[7px] font-bold text-center text-slate-500 mt-1 uppercase truncate">{img.nombre}</p>
                                                            <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                                <button onClick={() => startEditingCatalogItem(img, 'CATEGORIA')} className="p-1 bg-amber-500 text-white rounded-lg shadow-lg hover:scale-110 transition-transform"><Edit size={10}/></button>
                                                                <button onClick={() => handleDeleteCatalogItem(img, 'CATEGORIA')} className="p-1 bg-rose-600 text-white rounded-lg shadow-lg hover:scale-110 transition-transform"><Trash2 size={10}/></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                    </div>
                                </AccordionItem>

                                <AccordionItem id="VIDEOS_AYUDA" title="Tutoriales de Ayuda" icon={<Video size={20} />} isOpen={activeAccordion === 'VIDEOS_AYUDA'} onToggle={() => toggleAccordion('VIDEOS_AYUDA')}>
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-black/20 p-6 rounded-3xl border border-white/5">
                                            <div>
                                                <h4 className="text-[11px] font-bold text-white uppercase tracking-widest">Tutoriales Maestro</h4>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase">Videos de entrenamiento globales.</p>
                                            </div>
                                            <button 
                                                onClick={() => startAddingCatalogItem('VIDEO')}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold text-[10px] uppercase shadow-lg transition-all active:scale-95 flex items-center gap-2"
                                            >
                                                <Plus size={16} /> NUEVO TUTORIAL
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {globalConfig?.defaultHelpVideos.map(video => {
                                                const ytId = getYouTubeId(video.youtubeUrl);
                                                return (
                                                    <div key={video.id} className="bg-black/40 border border-white/5 rounded-3xl overflow-hidden group">
                                                        <div className="aspect-video relative">
                                                            <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} className="w-full h-full object-cover opacity-60" />
                                                            <div className="absolute inset-0 flex items-center justify-center text-white/40 pointer-events-none"><PlayCircle size={48}/></div>
                                                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); startEditingCatalogItem(video, 'VIDEO'); }} 
                                                                    className="p-2 bg-amber-500 text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all"
                                                                >
                                                                    <Edit size={14}/>
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteCatalogItem(video, 'VIDEO'); }} 
                                                                    className="p-2 bg-rose-600 text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all"
                                                                >
                                                                    <Trash2 size={14}/>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="p-4">
                                                            <p className="text-[10px] font-bold text-slate-200 uppercase tracking-tight truncate">{video.title}</p>
                                                            {video.modulo_id && (
                                                                <span className="inline-block mt-1 text-[8px] font-extrabold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                                    Promo: {SYSTEM_MODULES.find(m => m.id === video.modulo_id)?.label || video.modulo_id}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </AccordionItem>

                                <AccordionItem id="METODOS_PAGO" title="Iconos Métodos de Pago" icon={<CreditCard size={20} />} isOpen={activeAccordion === 'METODOS_PAGO'} onToggle={() => toggleAccordion('METODOS_PAGO')}>
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-black/20 p-6 rounded-3xl border border-white/5">
                                            <div>
                                                <h4 className="text-[11px] font-bold text-white uppercase tracking-widest">Métodos de Pago Globales</h4>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase">Predefinidos para nuevas sedes.</p>
                                            </div>
                                            <button 
                                                onClick={() => startAddingCatalogItem('METODO_PAGO')}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold text-[10px] uppercase shadow-lg transition-all active:scale-95 flex items-center gap-2"
                                            >
                                                <Plus size={16} /> NUEVO MÉTODO
                                            </button>
                                        </div>
                                                <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-10 gap-4">
                                                    {globalConfig?.defaultPaymentImages.map(img => (
                                                        <div key={img.id} className="bg-black/40 border border-white/5 p-3 rounded-2xl relative group">
                                                            <div className="aspect-square flex items-center justify-center"><img src={img.url} className="max-w-full max-h-full object-contain" /></div>
                                                            <p className="text-[7px] font-bold text-center text-slate-500 mt-1 uppercase truncate">{img.nombre}</p>
                                                            <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                                <button onClick={() => startEditingCatalogItem(img, 'METODO_PAGO')} className="p-1 bg-amber-500 text-white rounded-lg shadow-lg hover:scale-110 transition-transform"><Edit size={10}/></button>
                                                                <button onClick={() => handleDeleteCatalogItem(img, 'METODO_PAGO')} className="p-1 bg-rose-600 text-white rounded-lg shadow-lg hover:scale-110 transition-transform"><Trash2 size={10}/></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                    </div>
                                </AccordionItem>

                                <AccordionItem id="MAQUINAS" title="Modelos de Máquina" icon={<WashingMachine size={20} />} isOpen={activeAccordion === 'MAQUINAS'} onToggle={() => toggleAccordion('MAQUINAS')}>
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-black/20 p-6 rounded-3xl border border-white/5">
                                            <div>
                                                <h4 className="text-[11px] font-bold text-white uppercase tracking-widest">Modelos de Máquinas 3D</h4>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase">Base de datos de modelos oficiales.</p>
                                            </div>
                                            <button 
                                                onClick={() => startAddingCatalogItem('MAQUINA')}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold text-[10px] uppercase shadow-lg transition-all active:scale-95 flex items-center gap-2"
                                            >
                                                <Plus size={16} /> NUEVA MÁQUINA
                                            </button>
                                        </div>
                                                <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-10 gap-4">
                                                    {globalConfig?.defaultMachineImages.map(img => (
                                                        <div key={img.id} className="bg-black/40 border border-white/5 p-3 rounded-2xl relative group">
                                                            <div className="aspect-square flex items-center justify-center"><img src={img.url} className="max-w-full max-h-full object-contain" /></div>
                                                            <p className="text-[7px] font-bold text-center text-slate-500 mt-1 uppercase truncate">{img.nombre}</p>
                                                            <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                                <button onClick={() => startEditingCatalogItem(img, 'MAQUINA')} className="p-1 bg-amber-500 text-white rounded-lg shadow-lg hover:scale-110 transition-transform"><Edit size={10}/></button>
                                                                <button onClick={() => handleDeleteCatalogItem(img, 'MAQUINA')} className="p-1 bg-rose-600 text-white rounded-lg shadow-lg hover:scale-110 transition-transform"><Trash2 size={10}/></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                    </div>
                                </AccordionItem>

                                 <AccordionItem id="WA_TEMPLATES" title="Mensajes WhatsApp (Anti-Bloqueo)" icon={<MessageCircle size={20} />} isOpen={activeAccordion === 'WA_TEMPLATES'} onToggle={() => toggleAccordion('WA_TEMPLATES')}>
                                     <div className="space-y-6">
                                         <div className="flex justify-between items-center bg-black/20 p-6 rounded-3xl border border-white/5">
                                             <div>
                                                 <h4 className="text-[11px] font-bold text-white uppercase tracking-widest">Plantillas Maestras de Mensaje</h4>
                                                 <p className="text-[9px] text-slate-500 font-bold uppercase">Mensajes que rotarán para evitar baneos.</p>
                                             </div>
                                             <button 
                                                 onClick={() => { setEditingWaTemplate({ category: 'PROMOCION', is_active: true, content: '' }); setIsWaTemplateModalOpen(true); }}
                                                 className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-bold text-[10px] uppercase shadow-lg transition-all active:scale-95 flex items-center gap-2"
                                             >
                                                 <Plus size={16} /> NUEVO MENSAJE
                                             </button>
                                         </div>
                                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                             {waMasterTemplates.map(t => (
                                                 <div key={t.id} className={`bg-slate-900 border ${t.is_active ? 'border-white/10 shadow-lg shadow-indigo-500/10' : 'border-white/5 opacity-40'} p-6 rounded-3xl relative group transition-all`}>
                                                     <div className="flex items-center justify-between mb-4">
                                                         <div className="flex items-center gap-2">
                                                             <span className="bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">{t.category}</span>
                                                             {t.image_url && <ImageIcon size={14} className="text-emerald-400" />}
                                                         </div>
                                                         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                             <button onClick={() => { setEditingWaTemplate(t); setIsWaTemplateModalOpen(true); }} className="p-1.5 bg-white/5 hover:bg-indigo-600 text-white rounded-xl transition-all"><Edit size={12}/></button>
                                                             <button onClick={() => { 
                                                                 if(confirm('¿Eliminar mensaje maestro?')) {
                                                                     saasDeleteWaTemplate(t.id).then(() => saasGetWaTemplates().then(setWaMasterTemplates));
                                                                 }
                                                             }} className="p-1.5 bg-white/5 hover:bg-red-600 text-white rounded-xl transition-all"><Trash2 size={12}/></button>
                                                         </div>
                                                     </div>
                                                     <p className="text-[11px] font-medium text-slate-300 leading-relaxed italic line-clamp-3">"{t.content}"</p>
                                                     <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                                         <span className={`text-[8px] font-bold uppercase ${t.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>{t.is_active ? 'ACTIVO' : 'INACTIVO'}</span>
                                                         <button 
                                                             onClick={() => {
                                                                 saasToggleWaTemplate(t.id, !t.is_active).then(() => setWaMasterTemplates((prev: WaTemplate[]) => prev.map(old => old.id === t.id ? {...old, is_active: !old.is_active} : old)));
                                                             }}
                                                             className={`w-8 h-4 rounded-full relative transition-colors ${t.is_active ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                                         >
                                                             <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${t.is_active ? 'right-0.5' : 'left-0.5'}`} />
                                                         </button>
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 </AccordionItem>

                                 <AccordionItem id="COLORES" title="Paleta de Colores/Texturas" icon={<Palette size={20} />} isOpen={activeAccordion === 'COLORES'} onToggle={() => toggleAccordion('COLORES')}>
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-black/20 p-6 rounded-3xl border border-white/5">
                                            <div>
                                                <h4 className="text-[11px] font-bold text-white uppercase tracking-widest">Paleta de Tonalidades</h4>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase">Colores y texturas de interfaz.</p>
                                            </div>
                                            <button 
                                                onClick={() => startAddingCatalogItem('COLOR')}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-bold text-[10px] uppercase shadow-lg transition-all active:scale-95 flex items-center gap-2"
                                            >
                                                <Plus size={16} /> NUEVO COLOR/TEXTURA
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-4">
                                            {globalConfig?.defaultColors.map(color => (
                                                <div key={color.id} className="flex flex-col items-center gap-2 group relative">
                                                    <div className="w-12 h-12 rounded-full border-2 border-white/10 shadow-lg flex items-center justify-center overflow-hidden bg-cover bg-center" style={{ backgroundColor: color.url_imagen ? 'transparent' : color.hex, backgroundImage: color.url_imagen ? `url(${color.url_imagen})` : 'none' }}></div>
                                                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tight text-center line-clamp-1">{color.nombre}</span>
                                                    <div className="absolute -top-1 -right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all scale-75">
                                                        <button onClick={() => startEditingCatalogItem(color, 'COLOR')} className="p-1 bg-amber-500 text-white rounded-lg shadow-lg hover:scale-110 transition-transform"><Edit size={10}/></button>
                                                        <button onClick={() => handleDeleteCatalogItem(color, 'COLOR')} className="p-1 bg-rose-600 text-white rounded-lg shadow-lg hover:scale-110 transition-transform"><Trash2 size={10}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </AccordionItem>
                            </div>
                        </div>
                    )}

                    {view === 'SETTINGS' && (
                        <div className="space-y-10 animate-in fade-in duration-500 text-slate-200">
                            <div><h2 className="text-3xl md:text-4xl font-bold uppercase tracking-tight text-white leading-none">Ajustes Maestro</h2><p className="text-slate-500 text-sm font-medium mt-1 uppercase">Configuración de contacto oficial del sistema.</p></div>
                            <div className="max-w-3xl bg-slate-900/50 backdrop-blur-xl rounded-[3rem] border border-white/5 p-8 md:p-10 shadow-2xl space-y-10">
                                <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                                    <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-600/20"><Smartphone size={24} className="text-white"/></div>
                                    <div>
                                        <h4 className="font-bold text-xl uppercase tracking-tight text-white">Contacto WhatsApp SaaS</h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Número oficial del dueño para soporte master</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Código de País</label>
                                        <div className="relative" ref={countryDropdownRef}>
                                            <button type="button" onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)} className="w-full bg-black/40 border-2 border-white/10 rounded-2xl p-4 font-bold text-sm text-white flex items-center justify-between outline-none focus:border-indigo-50 transition-all group"><div className="flex items-center gap-3"><img src={`https://flagcdn.com/w20/${selectedCountry.iso}.png`} className="w-5 h-auto rounded-sm shadow-sm" alt="flag" /><span>{selectedCountry.code}</span></div><ChevronDown size={18} className={`text-slate-500 transition-transform ${isCountryDropdownOpen ? 'rotate-180' : ''}`} /></button>
                                            {isCountryDropdownOpen && (<div className="absolute bottom-full mb-3 left-0 right-0 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in slide-in-from-bottom-2"><div className="max-h-60 overflow-y-auto custom-scrollbar">{LATAM_CODES.map(c => (<button key={c.code} type="button" onClick={() => { setGlobalWaCodPais(c.code); setIsCountryDropdownOpen(false); }} className="w-full px-5 py-3 hover:bg-white/5 flex items-center justify-between text-left transition-colors border-b border-white/5 last:border-0 group"><div className="flex items-center gap-3"><img src={`https://flagcdn.com/w20/${c.iso}.png`} className="w-5 h-auto rounded-sm shadow-sm" alt="flag" /><span className="font-bold text-xs text-white">{c.name}</span></div><span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-400">{c.code}</span></button>))}</div></div>)}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-3">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Número de WhatsApp Principal</label>
                                        <div className="relative group"><Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} /><input type="number" value={globalWaSaas} onChange={e => setGlobalWaSaas(e.target.value)} className="w-full bg-black/40 border-2 border-white/10 rounded-2xl p-4 pl-14 font-bold text-lg text-white outline-none focus:border-indigo-500 focus:bg-black/60 transition-all placeholder:text-slate-700" placeholder="931200353" /></div>
                                    </div>
                                </div>
                                <button onClick={handleSaveSettings} disabled={isSaving} className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-bold text-sm uppercase tracking-[0.25em] shadow-xl shadow-emerald-900/40 transition-all active:scale-95 flex justify-center items-center gap-4 disabled:opacity-50">{isSaving ? <Loader2 className="animate-spin" /> : <Save size={24} strokeWidth={3}/>} GUARDAR AJUSTES DE CONTACTO</button>
                                
                                {/* CONTROL DE DISTRIBUCIÓN / VERSIÓN */}
                                <div className="p-8 bg-slate-900/80 rounded-[2.5rem] border border-white/5 shadow-inner relative overflow-hidden group mt-6">
                                    <div className="absolute -right-10 -bottom-10 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Shield size={160} className="text-white" />
                                    </div>
                                    
                                    <div className="relative z-10 space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-600/20">
                                                <Cpu size={24} className="text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-xl uppercase tracking-tight text-white flex items-center gap-2">
                                                    Gestión de Despliegue
                                                    <span className="bg-indigo-500/20 text-indigo-400 text-[8px] px-2 py-0.5 rounded-full border border-indigo-500/30 font-black">SISTEMA VIVO</span>
                                                </h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Forzar actualización de clientes en tiempo real</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-2">Versión Mínima Requerida</label>
                                                <input 
                                                    value={minVersionInput}
                                                    onChange={e => setMinVersionInput(e.target.value)}
                                                    className="w-full bg-black/40 border-2 border-white/10 rounded-2xl p-4 font-mono font-black text-lg text-white text-center outline-none focus:border-indigo-500 transition-all"
                                                    placeholder="1.2.0"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <button 
                                                    onClick={handleUpdateAppVersion}
                                                    disabled={isUpdatingVersion}
                                                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-bold text-sm uppercase tracking-[0.25em] shadow-xl shadow-indigo-900/40 transition-all active:scale-95 flex justify-center items-center gap-4 disabled:opacity-50"
                                                >
                                                    {isUpdatingVersion ? <Loader2 className="animate-spin" /> : <RefreshCcw size={24} strokeWidth={3}/>} 
                                                    DISTRIBUIR ACTUALIZACIÓN
                                                </button>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-white/5 flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                                            <span>Estado del Sistema: <span className="text-emerald-400">Sincronizado</span></span>
                                            <span>Versión Actual: <span className="text-indigo-400 font-mono tracking-normal">{APP_VERSION}</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modales Crud */}
            {isCompanyModalOpen && (
                <div className="fixed inset-0 bg-slate-950/90 z-[100] flex items-center justify-center p-2 md:p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-slate-900 rounded-3xl md:rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col animate-in zoom-in-95 max-h-[98vh] md:max-h-[95vh]">
                        <div className="p-5 md:p-8 border-b border-white/5 flex justify-between items-center bg-slate-900 shrink-0">
                            <div className="flex items-center gap-3 md:gap-4">
                                <div className="bg-indigo-600 p-2 md:p-2.5 rounded-xl md:rounded-2xl shadow-lg">
                                    <Building size={20} className="text-white md:w-6 md:h-6" />
                                </div>
                                <h3 className="font-bold text-lg md:text-2xl text-white uppercase tracking-tight">
                                    {isEditingCompany ? 'Editar Holding' : 'Nuevo Holding'}
                                </h3>
                            </div>
                            <button onClick={() => setIsCompanyModalOpen(false)} className="text-white/40 hover:text-white p-2 rounded-full transition-colors">
                                <X size={24} className="md:w-7 md:h-7"/>
                            </button>
                        </div>
                        <form onSubmit={handleSaveCompany} className="p-5 md:p-10 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">RUC Fiscal / DNI</label>
                                    <div className="flex gap-2">
                                        <input required value={compRuc} onChange={e => setCompRuc(e.target.value)} className="flex-1 bg-slate-800 border border-white/5 rounded-xl md:rounded-2xl px-4 md:px-5 py-3 md:py-4 text-white font-bold outline-none focus:ring-4 focus:ring-indigo-600/20" placeholder="10XXXXXXXXX" />
                                        <button type="button" onClick={handleSearchCompanyRuc} disabled={isSearchingRuc} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 md:px-5 rounded-xl md:rounded-2xl shadow-xl transition-all active:scale-90 flex items-center justify-center disabled:opacity-50">
                                            {isSearchingRuc ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Razón Social</label><input required value={compName} onChange={e => setCompName(e.target.value.toUpperCase())} className="w-full bg-slate-800 border border-white/5 rounded-xl md:rounded-2xl px-4 md:px-5 py-3 md:py-4 text-white font-bold outline-none focus:ring-4 focus:ring-indigo-600/20 uppercase" placeholder="LAVANDERIA SAC" /></div>
                                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 text-indigo-400">Nombre Comercial (PWA)</label><input value={compNombreComercial} onChange={e => setCompNombreComercial(e.target.value.toUpperCase())} className="w-full bg-slate-800 border-2 border-indigo-500/30 rounded-xl md:rounded-2xl px-4 md:px-5 py-3 md:py-4 text-white font-black outline-none focus:ring-4 focus:ring-indigo-600/20 uppercase shadow-[0_0_15px_rgba(79,70,229,0.1)]" placeholder="BRIGTH & CLEAN" /></div>
                                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Representante</label><input required value={compOwner} onChange={e => setCompOwner(e.target.value.toUpperCase())} className="w-full bg-slate-800 border border-white/5 rounded-xl md:rounded-2xl px-4 md:px-5 py-3 md:py-4 text-white font-bold outline-none focus:ring-4 focus:ring-indigo-600/20 uppercase" placeholder="JUAN PEREZ" /></div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Teléfono</label>
                                    <div className="flex gap-2 relative">
                                        {/* Selector de Prefijo de País */}
                                        <div className="relative w-36 shrink-0" ref={compPhoneCountryDropdownRef}>
                                            <button 
                                                type="button" 
                                                onClick={() => setIsCompPhoneCountryDropdownOpen(!isCompPhoneCountryDropdownOpen)} 
                                                className="h-full w-full bg-slate-800 border border-white/5 rounded-xl md:rounded-2xl px-3 py-3 md:py-4 font-bold text-xs md:text-sm text-white flex items-center justify-between outline-none focus:ring-4 focus:ring-indigo-600/20 transition-all select-none"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <img 
                                                        src={`https://flagcdn.com/w20/${selectedCompPhoneCountry.iso}.png`} 
                                                        className="w-5 h-auto rounded-sm shadow-sm shrink-0" 
                                                        alt="flag" 
                                                    />
                                                    <span className="text-white font-bold">{compPhoneCode}</span>
                                                </div>
                                                <ChevronDown size={16} className={`text-slate-400 transition-transform shrink-0 ${isCompPhoneCountryDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {isCompPhoneCountryDropdownOpen && (
                                                <div className="absolute top-full mt-2 left-0 w-64 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl z-[110] overflow-hidden animate-in slide-in-from-top-2">
                                                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                                        {LATAM_CODES.map(c => (
                                                            <button 
                                                                key={c.code} 
                                                                type="button" 
                                                                onClick={() => { 
                                                                    setCompPhoneCode(c.code); 
                                                                    setIsCompPhoneCountryDropdownOpen(false); 
                                                                }} 
                                                                className="w-full px-4 py-2.5 hover:bg-white/5 flex items-center justify-between text-left transition-colors border-b border-white/5 last:border-0 group select-none"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <img src={`https://flagcdn.com/w20/${c.iso}.png`} className="w-5 h-auto rounded-sm shadow-sm" alt="flag" />
                                                                    <span className="font-bold text-xs text-white">{c.name}</span>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-400">{c.code}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {/* Input del Número de Teléfono */}
                                        <input 
                                            required 
                                            value={compPhoneBody} 
                                            onChange={e => setCompPhoneBody(e.target.value.replace(/\D/g, ''))} 
                                            className="flex-1 bg-slate-800 border border-white/5 rounded-xl md:rounded-2xl px-4 md:px-5 py-3 md:py-4 text-white font-bold outline-none focus:ring-4 focus:ring-indigo-600/20" 
                                            placeholder="999888777" 
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Correo Admin</label><input required type="email" value={compEmail} onChange={e => setCompEmail(e.target.value.toLowerCase())} className="w-full bg-slate-800 border border-white/5 rounded-xl md:rounded-2xl px-4 md:px-5 py-3 md:py-4 text-white font-bold outline-none focus:ring-4 focus:ring-indigo-600/20 lowercase" placeholder="admin@empresa.com" /></div>
                                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Pin Acceso Maestro</label><input required={!isEditingCompany} type="password" value={compPassword} onChange={e => setCompPassword(e.target.value)} className="w-full bg-slate-800 border border-white/5 rounded-xl md:rounded-2xl px-4 md:px-5 py-3 md:py-4 text-white font-bold outline-none focus:ring-4 focus:ring-indigo-600/20" placeholder={isEditingCompany ? "Dejar en blanco para mantener" : "••••••"} /></div>
                            </div>

                            <div className="pt-6 border-t border-white/5 space-y-6 md:space-y-8">
                                <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em]">Personalización de Marca</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                    {/* LOGO SECTION */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Logotipo Corporativo</label>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center gap-4 bg-black/20 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/5">
                                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-slate-800 flex items-center justify-center p-2 border border-white/10 shrink-0 overflow-hidden">
                                                    {isUploadingAsset ? <Loader2 className="animate-spin text-indigo-500" /> : compLogoUrl ? <img src={compLogoUrl} className="w-full h-full object-contain" /> : <ImageIcon size={20} className="text-slate-600 md:w-6 md:h-6" />}
                                                </div>
                                                <label className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 md:py-3 rounded-xl font-bold text-[9px] md:text-[10px] uppercase tracking-widest cursor-pointer text-center transition-all shadow-lg active:scale-95">
                                                    SUBIR LOGO
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleCompanyAssetUpload('LOGO', e)} />
                                                </label>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-2">O pegar URL del Logo</label>
                                                <input 
                                                    value={compLogoUrl} 
                                                    onChange={e => setCompLogoUrl(e.target.value)} 
                                                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-2 text-[10px] text-indigo-300 font-mono outline-none focus:border-indigo-500/50" 
                                                    placeholder="https://..." 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* FAVICON SECTION */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Favicon / Icono</label>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center gap-4 bg-black/20 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/5">
                                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-slate-800 flex items-center justify-center p-2 border border-white/10 shrink-0 overflow-hidden">
                                                    {isUploadingAsset ? <Loader2 className="animate-spin text-indigo-500" /> : compFaviconUrl ? <img src={compFaviconUrl} className="w-full h-full object-contain" /> : <Camera size={20} className="text-slate-600 md:w-6 md:h-6" />}
                                                </div>
                                                <label className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 md:py-3 rounded-xl font-bold text-[9px] md:text-[10px] uppercase tracking-widest cursor-pointer text-center transition-all shadow-lg active:scale-95">
                                                    SUBIR FAVICON
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleCompanyAssetUpload('FAVICON', e)} />
                                                </label>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-2">O pegar URL del Favicon</label>
                                                <input 
                                                    value={compFaviconUrl} 
                                                    onChange={e => setCompFaviconUrl(e.target.value)} 
                                                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-2 text-[10px] text-indigo-300 font-mono outline-none focus:border-indigo-500/50" 
                                                    placeholder="https://..." 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* LOGISTICA FAVICON SECTION */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Favicon Logística (Login Choferes)</label>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center gap-4 bg-black/20 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/5">
                                                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-slate-800 flex items-center justify-center p-2 border border-white/10 shrink-0 overflow-hidden">
                                                    {isUploadingAsset ? <Loader2 className="animate-spin text-indigo-500" /> : compFaviconLogisticaUrl ? <img src={compFaviconLogisticaUrl} className="w-full h-full object-contain" /> : <ShieldCheck size={20} className="text-slate-600 md:w-6 md:h-6" />}
                                                </div>
                                                <label className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 md:py-3 rounded-xl font-bold text-[9px] md:text-[10px] uppercase tracking-widest cursor-pointer text-center transition-all shadow-lg active:scale-95">
                                                    SUBIR FAVICON LOGÍSTICA
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleCompanyAssetUpload('LOGISTICA_FAVICON', e)} />
                                                </label>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-2">O pegar URL del Favicon Logística</label>
                                                <input 
                                                    value={compFaviconLogisticaUrl} 
                                                    onChange={e => setCompFaviconLogisticaUrl(e.target.value)} 
                                                    className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-2 text-[10px] text-indigo-300 font-mono outline-none focus:border-indigo-500/50" 
                                                    placeholder="https://..." 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 md:gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Color Primario</label>
                                        <div className="flex gap-3 items-center bg-black/20 p-3 rounded-2xl border border-white/5">
                                            <input type="color" value={compPrimaryColor} onChange={e => setCompPrimaryColor(e.target.value)} className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl cursor-pointer border-2 border-white/10 shadow-md bg-transparent" />
                                            <span className="font-mono text-[10px] md:text-xs font-bold text-slate-400 uppercase">{compPrimaryColor}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Color Secundario</label>
                                        <div className="flex gap-3 items-center bg-black/20 p-3 rounded-2xl border border-white/5">
                                            <input type="color" value={compSecondaryColor} onChange={e => setCompSecondaryColor(e.target.value)} className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl cursor-pointer border-2 border-white/10 shadow-md bg-transparent" />
                                            <span className="font-mono text-[10px] md:text-xs font-bold text-slate-400 uppercase">{compSecondaryColor}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" disabled={isSaving || isUploadingAsset} className="w-full py-4 md:py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl md:rounded-3xl font-bold text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />} 
                                {isEditingCompany ? 'ACTUALIZAR HOLDING' : 'CREAR HOLDING'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isBranchModalOpen && selectedCompany && (
                <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-0 md:p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white md:rounded-[3rem] w-full md:max-w-6xl h-full md:h-auto md:max-h-[95vh] shadow-2xl overflow-hidden border border-white/10 flex flex-col animate-in zoom-in-95">
                        <div className="p-6 md:p-10 border-b border-slate-100 bg-white flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 shadow-sm relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-600/20">
                                    <Store size={24} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-xl md:text-2xl text-slate-900 uppercase tracking-tight">
                                        {isEditingBranch ? 'Configurar Sede' : 'Registrar Nueva Sede'}
                                    </h3>
                                    <div className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                        Holding: {selectedCompany.name}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsBranchModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-500 p-3 rounded-2xl transition-all active:scale-90 absolute top-6 right-6 md:relative md:top-auto md:right-auto">
                                <X size={24}/>
                            </button>
                        </div>
                        <div className="flex bg-slate-100 border-b border-slate-200 p-2 gap-2 overflow-x-auto no-scrollbar shrink-0">
                            {[
                                { id: 'GENERAL', label: 'General', icon: Building2 }, 
                                { id: 'FISCAL', label: 'Fiscal', icon: FileCheck },
                                { id: 'SUNAT', label: 'SUNAT', icon: Globe }, 
                                { id: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle }, 
                                { id: 'PRINT', label: 'Ticket', icon: Printer },
                                { id: 'MODULOS', label: 'Módulos', icon: LayoutGrid },
                                { id: 'USUARIO', label: 'Dueño Sede', icon: UserPlus }
                            ].map(tab => (
                                <button 
                                    key={tab.id} 
                                    type="button"
                                    onClick={() => setBranchModalTab(tab.id as any)} 
                                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${branchModalTab === tab.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'}`}
                                >
                                    <tab.icon size={14} /> {tab.label}
                                </button>
                            ))}
                        </div>
                        <form onSubmit={handleSaveBranch} className="p-6 md:p-10 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                            {branchModalTab === 'GENERAL' && (
                                <div className="space-y-10 animate-in slide-in-from-right-4 duration-300">
                                    {/* SECCIÓN FISCAL */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                                <FileCheck size={18} />
                                            </div>
                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Configuración Fiscal</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">RUC Sucursal</label>
                                                <div className="flex gap-2">
                                                    <input required value={brRuc} onChange={e => setBrRuc(e.target.value)} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:border-indigo-500 transition-all shadow-inner" placeholder="20XXXXXXXXX" />
                                                    <button type="button" onClick={handleSearchBranchRuc} disabled={isSearchingRuc} className="bg-slate-900 text-white px-5 rounded-2xl shadow-xl transition-all active:scale-90">{isSearchingRuc ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}</button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Razón Social (SUNAT)</label>
                                                <input required value={brRazonSocial} onChange={e => setBrRazonSocial(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:border-indigo-500 uppercase shadow-inner" placeholder="LAVANDERIA SAC" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-6">
                                                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Dirección Física</label><div className="relative"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input required value={brAddress} onChange={e => setBrAddress(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-slate-900 font-bold outline-none focus:border-indigo-500 uppercase shadow-inner" placeholder="AV. LIMA 123..." /></div></div>
                                                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Teléfono Público</label><div className="relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={brPhone} onChange={e => setBrPhone(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-slate-900 font-bold outline-none focus:border-indigo-500 shadow-inner" placeholder="999888777" /></div></div>
                                            </div>
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Ubicación</label>
                                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                                        <div className="space-y-2"><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Ubigeo</label><input value={brUbigeo} onChange={e => setBrUbigeo(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:border-indigo-500 shadow-inner" maxLength={6} placeholder="150114" /></div>
                                                        <div className="space-y-2"><label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Urbanización</label><input value={brUrbanizacion} onChange={e => setBrUrbanizacion(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-slate-900 font-bold outline-none focus:border-indigo-500 shadow-inner" placeholder="PUEBLO LIBRE" /></div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-3 mt-3">
                                                        <div className="space-y-1"><label className="text-[8px] font-bold text-slate-400 uppercase">Distrito</label><input value={brDistrito} onChange={e => setBrDistrito(e.target.value.toUpperCase())} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[9px] font-bold text-slate-900 outline-none" /></div>
                                                        <div className="space-y-1"><label className="text-[8px] font-bold text-slate-400 uppercase">Provincia</label><input value={brProvincia} onChange={e => setBrProvincia(e.target.value.toUpperCase())} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[9px] font-bold text-slate-900 outline-none" /></div>
                                                        <div className="space-y-1"><label className="text-[8px] font-bold text-slate-400 uppercase">Dpto.</label><input value={brDepartamento} onChange={e => setBrDepartamento(e.target.value.toUpperCase())} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[9px] font-bold text-slate-900 outline-none" /></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECCIÓN BRANDING */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                                <Palette size={18} />
                                            </div>
                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Configuración Branding</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre Comercial</label>
                                                    <input required value={brName} onChange={e => setBrName(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:border-indigo-500 uppercase shadow-inner" placeholder="LAUNDRY SEDE NORTE" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Color Primario</label><div className="flex gap-3 items-center bg-slate-100 p-3 rounded-2xl border border-slate-200"><input type="color" value={brColorPrimary} onChange={e => setBrColorPrimary(e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border-2 border-white shadow-md" /><span className="font-mono text-xs font-bold text-slate-400 uppercase">{brColorPrimary}</span></div></div>
                                                    <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Color Secundario</label><div className="flex gap-3 items-center bg-slate-100 p-3 rounded-2xl border border-slate-200"><input type="color" value={brColorSecondary} onChange={e => setBrColorSecondary(e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border-2 border-white shadow-md" /><span className="font-mono text-xs font-bold text-slate-400 uppercase">{brColorSecondary}</span></div></div>
                                                </div>
                                            </div>
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-2 gap-6">
                                                     <div className="space-y-2">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Logotipo Principal</label>
                                                        <div className="flex flex-col gap-3">
                                                            <div className="w-full h-24 rounded-2xl bg-slate-50 flex items-center justify-center p-3 shadow-inner border-2 border-dashed border-slate-200">
                                                                {isSaving ? <Loader2 className="animate-spin text-indigo-600" /> : brLogoUrl ? <img src={brLogoUrl} className="w-full h-full object-contain" /> : <ImageIcon size={24} className="text-slate-300" />}
                                                            </div>
                                                            <label className="w-full py-2 bg-slate-900 hover:bg-black text-white text-center rounded-xl font-bold text-[8px] uppercase tracking-widest cursor-pointer transition-all">
                                                                SUBIR LOGO
                                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleBranchAssetUpload('LOGO', e)} />
                                                            </label>
                                                        </div>
                                                     </div>
                                                     <div className="space-y-2">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Favicon / Icono</label>
                                                        <div className="flex flex-col gap-3">
                                                            <div className="w-full h-24 rounded-2xl bg-slate-50 flex items-center justify-center p-2 shadow-inner border-2 border-dashed border-slate-200">
                                                                {isSaving ? <Loader2 className="animate-spin text-indigo-600" /> : brFaviconUrl ? <img src={brFaviconUrl} className="w-full h-full object-contain" /> : <Layers size={21} className="text-slate-300" />}
                                                            </div>
                                                            <label className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-center rounded-xl font-bold text-[8px] uppercase tracking-widest cursor-pointer border border-slate-200 transition-all">
                                                                SUBIR ICONO
                                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleBranchAssetUpload('FAVICON', e)} />
                                                            </label>
                                                        </div>
                                                     </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECCIÓN NEGOCIO */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                                <Store size={18} />
                                            </div>
                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Configuración Negocio</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Tipo de Sucursal</label>
                                                        <select value={brType} onChange={e => setBrType(e.target.value as SucursalType)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:border-indigo-500 shadow-inner appearance-none cursor-pointer">
                                                            {Object.values(SucursalType).map(type => <option key={type} value={type}>{type}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest ml-1">Tipo de Caja</label>
                                                        <select value={brCashManagementType} onChange={e => setBrCashManagementType(e.target.value as CashManagementType)} className="w-full bg-indigo-50 border-2 border-indigo-100 rounded-2xl px-5 py-4 text-indigo-900 font-black outline-none focus:border-indigo-500 shadow-inner appearance-none cursor-pointer">
                                                            <option value={CashManagementType.DAILY}>DIARIO (ESTÁNDAR)</option>
                                                            <option value={CashManagementType.ACCUMULATIVE}>ACUMULATIVO</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Identificador Slug (URL)</label><input disabled={isEditingBranch} value={brSlug} onChange={e => setBrSlug(e.target.value.toLowerCase().replace(/\s+/g, '_'))} className="w-full bg-slate-100 border-2 border-slate-100 rounded-2xl px-5 py-4 text-indigo-600 font-mono text-sm outline-none" placeholder="sede_norte" /></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {branchModalTab === 'FISCAL' && (
                                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                    <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[2.5rem] flex items-start gap-5">
                                        <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-600/20 text-white">
                                            <ShieldCheck size={28} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest">Configuración Fiscal y Legal por Sucursal</h4>
                                            <p className="text-[11px] text-indigo-600 font-bold uppercase leading-relaxed max-w-2xl">Gestione los parámetros tributarios específicos de esta sede y active las validaciones legales requeridas por las normativas regionales.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                                                <div className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 pb-4 border-b border-slate-50">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                                        <Percent size={16} />
                                                    </div>
                                                    Impuestos Generales
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Porcentaje de IGV / IVA (%)</label>
                                                    <div className="relative group">
                                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-300 group-focus-within:text-indigo-600">%</div>
                                                        <input 
                                                            type="number" 
                                                            step="0.01"
                                                            value={brPorcentajeIgv} 
                                                            onChange={e => setBrPorcentajeIgv(e.target.value)} 
                                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-5 text-slate-900 font-black outline-none focus:border-indigo-500 focus:bg-white transition-all text-2xl shadow-inner group-focus-within:shadow-indigo-100" 
                                                            placeholder="18.00" 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Símbolo de Moneda</label>
                                                    <input 
                                                        value={brMonedaSimbolo} 
                                                        onChange={e => setBrMonedaSimbolo(e.target.value)} 
                                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-6 py-5 text-slate-900 font-black outline-none focus:border-indigo-500 focus:bg-white transition-all text-2xl shadow-inner" 
                                                        placeholder="S/" 
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                                                <div className="flex items-center justify-between pb-4 border-b border-slate-50">
                                                    <div className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                                            <ShieldAlert size={16} />
                                                        </div>
                                                        Candado Legal (SUNAT)
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setBrDocEnforceEnabled(!brDocEnforceEnabled)}
                                                        className={`relative w-14 h-7 rounded-full transition-all duration-300 shadow-inner ${brDocEnforceEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                                    >
                                                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-md ${brDocEnforceEnabled ? 'left-8' : 'left-1'}`} />
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed">
                                                    Si el total supera el umbral, se exigirá DNI/RUC al cliente (Solo en modos TEST/PROD).
                                                </p>
                                                
                                                <div className={`space-y-3 transition-all duration-500 ${!brDocEnforceEnabled ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
                                                    <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest ml-1">Monto Umbral (DNI/RUC)</label>
                                                    <div className="relative group">
                                                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl group-focus-within:text-emerald-600 transition-colors">{brMonedaSimbolo}</span>
                                                        <input 
                                                            type="number" 
                                                            value={brDocEnforceThreshold} 
                                                            disabled={!brDocEnforceEnabled}
                                                            onChange={e => setBrDocEnforceThreshold(e.target.value)} 
                                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl pl-16 pr-6 py-5 text-slate-900 font-black outline-none focus:border-emerald-500 focus:bg-white transition-all text-2xl shadow-inner group-focus-within:shadow-emerald-100" 
                                                            placeholder="700.00" 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {branchModalTab === 'SUNAT' && (
                                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                    <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] flex items-start gap-4">
                                        <ShieldCheck className="text-indigo-600 shrink-0" size={24} />
                                        <div>
                                            <h4 className="text-[11px] font-bold text-indigo-900 uppercase tracking-widest mb-1">Entorno de Facturación</h4>
                                            <p className="text-[10px] text-indigo-700 font-bold uppercase leading-tight">Configuración crítica de enlace con OSE/SUNAT.</p>
                                        </div>
                                    </div>

                                    {/* SECCIÓN 1: CONFIGURACIÓN SUNAT Y CREDENCIALES */}
                                    <div className="bg-white border border-slate-100 p-8 rounded-[2rem] shadow-sm space-y-6">
                                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                                <Settings size={16} />
                                            </div>
                                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Credenciales & Entorno</h3>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Modo de Operación</label>
                                                <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                                    <button type="button" onClick={() => setBrModoSunat('2')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${brModoSunat === '2' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>INT</button>
                                                    <button type="button" onClick={() => setBrModoSunat('0')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${brModoSunat === '0' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400'}`}>BETA</button>
                                                    <button type="button" onClick={() => setBrModoSunat('1')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${brModoSunat === '1' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400'}`}>PROD</button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">SOL User</label>
                                                <input value={brSolUser} onChange={e => setBrSolUser(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 text-slate-900 font-bold outline-none focus:border-indigo-500 shadow-inner" placeholder="MODDATOS" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">SOL Pass</label>
                                                <input type="password" value={brSolPass} onChange={e => setBrSolPass(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 text-slate-900 font-bold outline-none focus:border-indigo-500 shadow-inner" placeholder="moddatos" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">Clave Firma <span className="text-[8px] text-slate-400 capitalize font-medium">(Opcional)</span></label>
                                                <input type="password" value={brFirmaPass} onChange={e => setBrFirmaPass(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 text-slate-900 font-bold outline-none focus:border-indigo-500 shadow-inner" placeholder="Usa Clave SOL si vacío" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre Comercial</label>
                                                <input value={brNombreComercial} onChange={e => setBrNombreComercial(e.target.value.toUpperCase())} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 text-slate-900 font-bold outline-none focus:border-indigo-500 shadow-inner" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">URL de Integración</label>
                                                <div className="relative group">
                                                    <Link className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                                                    <input value={brSunatUrl} onChange={e => setBrSunatUrl(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-slate-700 font-mono text-xs outline-none focus:border-indigo-500 transition-all shadow-inner" placeholder="https://..." />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* SECCIÓN 2: SERIES Y CORRELATIVOS REALMENTE ESPACIOSOS */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-1">
                                            <Code size={16} className="text-slate-400" />
                                            <h4 className="text-[11px] font-extrabold text-slate-450 uppercase tracking-[0.2em]">Series y Correlativos de Documentos</h4>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {/* BOLETA */}
                                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-all group space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-bold bg-indigo-50 text-indigo-700 uppercase tracking-widest">BOLETA ELECTRÓNICA</span>
                                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Serie</h5>
                                                    </div>
                                                    <input value={brSerieBoleta} onChange={e => setBrSerieBoleta(e.target.value.toUpperCase())} className="w-24 px-3 py-2 text-center bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 rounded-xl font-black text-slate-800 uppercase text-lg transition-all outline-none" maxLength={4} />
                                                </div>
                                                {isEditingBranch && (
                                                    <div className="space-y-1.5 pt-3 border-t border-slate-50 flex justify-between items-center">
                                                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-sans">Sgte. Correlativo</span>
                                                        <input type="number" min="0" value={(brCorrelativos.find(c => c.tipo_documento === '03' && c.serie.toUpperCase() === brSerieBoleta.toUpperCase())?.ultimo_numero ?? 0) + 1} onChange={e => {
                                                            const val = Math.max(0, (parseInt(e.target.value) || 1) - 1);
                                                            setBrCorrelativos(prev => {
                                                                const idx = prev.findIndex(c => c.tipo_documento === '03' && c.serie.toUpperCase() === brSerieBoleta.toUpperCase());
                                                                if (idx > -1) {
                                                                    const copy = [...prev];
                                                                    copy[idx] = { ...copy[idx], ultimo_numero: val };
                                                                    return copy;
                                                                } else {
                                                                    return [...prev, { tipo_documento: '03', serie: brSerieBoleta.toUpperCase(), ultimo_numero: val }];
                                                                }
                                                            });
                                                        }} className="w-24 px-3 py-2 text-center bg-slate-50 border-2 border-slate-150 rounded-xl text-sm font-mono font-bold text-indigo-600 focus:bg-white transition-all outline-none" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* FACTURA */}
                                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-all group space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-bold bg-indigo-50 text-indigo-700 uppercase tracking-widest">FACTURA ELECTRÓNICA</span>
                                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Serie</h5>
                                                    </div>
                                                    <input value={brSerieFactura} onChange={e => setBrSerieFactura(e.target.value.toUpperCase())} className="w-24 px-3 py-2 text-center bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 rounded-xl font-black text-slate-800 uppercase text-lg transition-all outline-none" maxLength={4} />
                                                </div>
                                                {isEditingBranch && (
                                                    <div className="space-y-1.5 pt-3 border-t border-slate-50 flex justify-between items-center">
                                                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-sans">Sgte. Correlativo</span>
                                                        <input type="number" min="0" value={(brCorrelativos.find(c => c.tipo_documento === '01' && c.serie.toUpperCase() === brSerieFactura.toUpperCase())?.ultimo_numero ?? 0) + 1} onChange={e => {
                                                            const val = Math.max(0, (parseInt(e.target.value) || 1) - 1);
                                                            setBrCorrelativos(prev => {
                                                                const idx = prev.findIndex(c => c.tipo_documento === '01' && c.serie.toUpperCase() === brSerieFactura.toUpperCase());
                                                                if (idx > -1) {
                                                                    const copy = [...prev];
                                                                    copy[idx] = { ...copy[idx], ultimo_numero: val };
                                                                    return copy;
                                                                } else {
                                                                    return [...prev, { tipo_documento: '01', serie: brSerieFactura.toUpperCase(), ultimo_numero: val }];
                                                                }
                                                            });
                                                        }} className="w-24 px-3 py-2 text-center bg-slate-50 border-2 border-slate-150 rounded-xl text-sm font-mono font-bold text-indigo-600 focus:bg-white transition-all outline-none" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* NOTA DE VENTA */}
                                            <div className="bg-amber-50/40 p-6 rounded-3xl border border-amber-100 shadow-sm flex flex-col justify-between hover:border-amber-200 transition-all group space-y-4">
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-1 flex-1 pr-2">
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-bold bg-amber-100/70 text-amber-800 uppercase tracking-widest mb-1 truncate max-w-full">{brCustomNvName}</span>
                                                            <h5 className="text-[10px] font-black text-amber-700/60 uppercase tracking-wider block">Serie</h5>
                                                        </div>
                                                        <input value={brSerieNv} onChange={e => setBrSerieNv(e.target.value.toUpperCase())} className="w-24 px-3 py-2 text-center bg-white border-2 border-amber-100 focus:border-amber-500 rounded-xl font-black text-amber-800 uppercase text-lg transition-all outline-none shadow-sm" maxLength={4} />
                                                    </div>
                                                    <div className="flex justify-between items-center gap-2 pt-1 font-bold">
                                                        <span className="text-[9px] font-extrabold text-amber-800/80 uppercase tracking-wider shrink-0">Nombre Personalizado</span>
                                                        <input value={brCustomNvName} onChange={e => setBrCustomNvName(e.target.value.toUpperCase())} className="w-32 px-2 py-1 bg-white border border-amber-200 rounded-lg text-[10px] font-black text-amber-900 uppercase shadow-inner text-right" placeholder="NOTA DE VENTA" />
                                                    </div>
                                                </div>
                                                {isEditingBranch && (
                                                    <div className="space-y-1.5 pt-3 border-t border-amber-100 flex justify-between items-center">
                                                        <span className="text-[9px] font-extrabold text-amber-800/85 uppercase tracking-wider font-sans">Sgte. Correlativo</span>
                                                        <input type="number" min="0" value={(brCorrelativos.find(c => c.tipo_documento === '80' && c.serie.toUpperCase() === brSerieNv.toUpperCase())?.ultimo_numero ?? 0) + 1} onChange={e => {
                                                            const val = Math.max(0, (parseInt(e.target.value) || 1) - 1);
                                                            setBrCorrelativos(prev => {
                                                                const idx = prev.findIndex(c => c.tipo_documento === '80' && c.serie.toUpperCase() === brSerieNv.toUpperCase());
                                                                if (idx > -1) {
                                                                    const copy = [...prev];
                                                                    copy[idx] = { ...copy[idx], ultimo_numero: val };
                                                                    return copy;
                                                                } else {
                                                                    return [...prev, { tipo_documento: '80', serie: brSerieNv.toUpperCase(), ultimo_numero: val }];
                                                                }
                                                            });
                                                        }} className="w-24 px-3 py-2 text-center bg-white border-2 border-amber-200 rounded-xl text-sm font-mono font-bold text-amber-900 focus:bg-white transition-all outline-none shadow-sm" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* CORRELATIVO INTERNO (ORDEN INTERNA) */}
                                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all group space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-bold bg-slate-200 text-slate-800 uppercase tracking-widest">TICKET INTERNO (SERVICIOS)</span>
                                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">ID de Ticket</h5>
                                                    </div>
                                                    <div className="px-3 py-1.5 bg-slate-200/50 rounded-xl text-slate-500 font-bold font-mono text-[10px] uppercase tracking-wider self-center text-center">
                                                        Nº Orden
                                                    </div>
                                                </div>
                                                {isEditingBranch && (
                                                    <div className="space-y-1.5 pt-3 border-t border-slate-200 flex justify-between items-center">
                                                        <span className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wider font-sans">Sgte. Nro. de Ticket</span>
                                                        <input type="number" min="0" value={(brCorrelativos.find(c => c.tipo_documento === 'ORDEN_INTERNA' && c.serie === '')?.ultimo_numero ?? 0) + 1} onChange={e => {
                                                            const val = Math.max(0, (parseInt(e.target.value) || 1) - 1);
                                                            setBrCorrelativos(prev => {
                                                                const idx = prev.findIndex(c => c.tipo_documento === 'ORDEN_INTERNA' && c.serie === '');
                                                                if (idx > -1) {
                                                                    const copy = [...prev];
                                                                    copy[idx] = { ...copy[idx], ultimo_numero: val };
                                                                    return copy;
                                                                } else {
                                                                    return [...prev, { tipo_documento: 'ORDEN_INTERNA', serie: '', ultimo_numero: val }];
                                                                }
                                                            });
                                                        }} className="w-24 px-3 py-2 text-center bg-white border-2 border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-700 focus:bg-white transition-all outline-none shadow-sm" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* NOTAS DE CREDITO FACTURA */}
                                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-rose-100 transition-all group space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-bold bg-rose-50 text-rose-700 uppercase tracking-widest">N. CRÉDITO FACTURA</span>
                                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Serie</h5>
                                                    </div>
                                                    <input value={brSerieNcF} onChange={e => setBrSerieNcF(e.target.value.toUpperCase())} className="w-24 px-3 py-2 text-center bg-slate-50 border-2 border-slate-100 focus:border-rose-500 rounded-xl font-black text-slate-800 uppercase text-lg transition-all outline-none" maxLength={4} />
                                                </div>
                                                {isEditingBranch && (
                                                    <div className="space-y-1.5 pt-3 border-t border-slate-50 flex justify-between items-center">
                                                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-sans">Sgte. Correlativo</span>
                                                        <input type="number" min="0" value={(brCorrelativos.find(c => c.tipo_documento === '07' && c.serie.toUpperCase() === brSerieNcF.toUpperCase())?.ultimo_numero ?? 0) + 1} onChange={e => {
                                                            const val = Math.max(0, (parseInt(e.target.value) || 1) - 1);
                                                            setBrCorrelativos(prev => {
                                                                const idx = prev.findIndex(c => c.tipo_documento === '07' && c.serie.toUpperCase() === brSerieNcF.toUpperCase());
                                                                if (idx > -1) {
                                                                    const copy = [...prev];
                                                                    copy[idx] = { ...copy[idx], ultimo_numero: val };
                                                                    return copy;
                                                                } else {
                                                                    return [...prev, { tipo_documento: '07', serie: brSerieNcF.toUpperCase(), ultimo_numero: val }];
                                                                }
                                                            });
                                                        }} className="w-24 px-3 py-2 text-center bg-slate-50 border-2 border-slate-155 rounded-xl text-sm font-mono font-bold text-rose-650 focus:bg-white transition-all outline-none" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* NOTAS DE CREDITO BOLETA */}
                                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-rose-100 transition-all group space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-bold bg-rose-50 text-rose-700 uppercase tracking-widest">N. CRÉDITO BOLETA</span>
                                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Serie</h5>
                                                    </div>
                                                    <input value={brSerieNcB} onChange={e => setBrSerieNcB(e.target.value.toUpperCase())} className="w-24 px-3 py-2 text-center bg-slate-50 border-2 border-slate-100 focus:border-rose-500 rounded-xl font-black text-slate-800 uppercase text-lg transition-all outline-none" maxLength={4} />
                                                </div>
                                                {isEditingBranch && (
                                                    <div className="space-y-1.5 pt-3 border-t border-slate-50 flex justify-between items-center">
                                                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-sans">Sgte. Correlativo</span>
                                                        <input type="number" min="0" value={(brCorrelativos.find(c => c.tipo_documento === '07' && c.serie.toUpperCase() === brSerieNcB.toUpperCase())?.ultimo_numero ?? 0) + 1} onChange={e => {
                                                            const val = Math.max(0, (parseInt(e.target.value) || 1) - 1);
                                                            setBrCorrelativos(prev => {
                                                                const idx = prev.findIndex(c => c.tipo_documento === '07' && c.serie.toUpperCase() === brSerieNcB.toUpperCase());
                                                                if (idx > -1) {
                                                                    const copy = [...prev];
                                                                    copy[idx] = { ...copy[idx], ultimo_numero: val };
                                                                    return copy;
                                                                } else {
                                                                    return [...prev, { tipo_documento: '07', serie: brSerieNcB.toUpperCase(), ultimo_numero: val }];
                                                                }
                                                            });
                                                        }} className="w-24 px-3 py-2 text-center bg-slate-50 border-2 border-slate-155 rounded-xl text-sm font-mono font-bold text-rose-650 focus:bg-white transition-all outline-none" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {branchModalTab === 'WHATSAPP' && (
                                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] flex items-start gap-4 shadow-inner">
                                        <div className="bg-white p-2.5 rounded-xl shadow-lg shadow-emerald-600/10 text-emerald-600"><Smartphone size={24} /></div>
                                        <div>
                                            <h4 className="text-[11px] font-bold text-emerald-900 uppercase tracking-widest mb-1">Evolution API Connect</h4>
                                            <p className="text-[10px] text-emerald-700 font-bold uppercase leading-tight">Configuración de mensajería instantánea del local.</p>
                                        </div>
                                    </div>
                                    <div className="max-w-2xl mx-auto space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Base URL (Evolution)</label>
                                            <div className="relative group">
                                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                                                <input value={brWaInstance} onChange={e => setBrWaInstance(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-slate-700 font-mono text-xs outline-none focus:border-emerald-500 transition-all shadow-inner" placeholder="https://api-wa.mi-instancia.com" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">API Key (Token de Seguridad)</label>
                                            <div className="relative group">
                                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                                                <input type="password" value={brWaToken} onChange={e => setBrWaToken(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-slate-700 font-mono text-xs outline-none focus:border-emerald-500 transition-all shadow-inner" placeholder="Token global..." />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre de la Instancia</label>
                                            <div className="relative group">
                                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                                                <input value={brWaName} onChange={e => setBrWaName(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-slate-900 font-bold outline-none focus:border-emerald-500 transition-all shadow-inner" placeholder="instancia_local" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {branchModalTab === 'PRINT' && (
                                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                    <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform"><Printer size={120} /></div>
                                        <div className="relative z-10">
                                            <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em] mb-4">Lógica de Correlativos</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                                <div className="space-y-6">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Cantidad de Ceros</label>
                                                        <input type="number" value={brOrderZeros} onChange={e => setBrOrderZeros(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold text-xl text-center" />
                                                    </div>
                                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">¿Usar Sufijo (Letra)?</span>
                                                        <button type="button" onClick={() => setBrUseSuffix(!brUseSuffix)} className={`relative w-12 h-6 rounded-full transition-all ${brUseSuffix ? 'bg-indigo-600' : 'bg-slate-700'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-all ${brUseSuffix ? 'translate-x-7' : 'translate-x-1'}`} /></button>
                                                    </div>
                                                    {brUseSuffix && (
                                                        <div className="grid grid-cols-2 gap-4 animate-in zoom-in-95">
                                                            <div className="space-y-2"><label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Letra Actual</label><input value={brSuffixChar} onChange={e => setBrSuffixChar(e.target.value.toUpperCase())} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-center font-bold text-indigo-400" maxLength={1} /></div>
                                                            <div className="space-y-2"><label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Posición</label><select value={brSuffixPos} onChange={e => setBrSuffixPos(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] font-bold appearance-none"><option value="BEFORE">ANTES</option><option value="AFTER">DESPUÉS</option></select></div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-6">
                                                    <div className="bg-black/40 p-6 rounded-[2rem] border border-white/5 text-center">
                                                        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-3">Previsualización del Código</p>
                                                        <div className="font-mono text-4xl font-bold text-indigo-500 tracking-tight">
                                                            {brSuffixPos === 'BEFORE' && brUseSuffix ? `${brSuffixChar}-` : ''}{'1'.padStart(parseInt(brOrderZeros), '0')}{brSuffixPos === 'AFTER' && brUseSuffix ? `-${brSuffixChar}` : ''}
                                                        </div>
                                                    </div>
                                                    <div className="p-5 border-t border-white/5 space-y-4">
                                                        <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-slate-500 uppercase">Equiv. Puntos (S/)</span><input type="number" value={brPuntosEq} onChange={e => setBrPuntosEq(e.target.value)} className="w-20 p-2 bg-white/5 border border-white/10 rounded-lg text-center font-bold text-emerald-400" /></div>
                                                        <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-rose-400 uppercase flex items-center gap-2 animate-pulse"><AlertTriangle size={14}/> Bloqueo Cobranza</span><button type="button" onClick={() => setBrCobranza(!brCobranza)} className={`relative w-12 h-6 rounded-full transition-all ${brCobranza ? 'bg-rose-600' : 'bg-slate-700'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-all ${brCobranza ? 'translate-x-7' : 'translate-x-1'}`} /></button></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-6">
                                            <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2"><RotateCcw size={14}/> Reinicio de Contador</h4>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-slate-500 uppercase">Habilitar Reinicio</span><button type="button" onClick={() => setBrUseOrderReset(!brUseOrderReset)} className={`relative w-12 h-6 rounded-full transition-all ${brUseOrderReset ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-all ${brUseOrderReset ? 'translate-x-7' : 'translate-x-1'}`} /></button></div>
                                                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Límite para Reiniciar</label><input type="number" disabled={!brUseOrderReset} value={brLimiteReconteo} onChange={e => setBrLimiteReconteo(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 font-bold text-sm text-slate-700 disabled:opacity-30" /></div>
                                            </div>
                                        </div>
                                        <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 flex flex-col justify-center gap-4">
                                            <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-indigo-600 shadow-sm"><Percent size={24}/></div><div><p className="text-[10px] font-bold text-slate-400 uppercase">Impuesto Nacional</p><h5 className="font-bold text-lg text-slate-900">Configuración IGV</h5></div></div>
                                            <div className="flex items-center gap-3"><input type="number" step="0.01" value={brPorcentajeIgv} onChange={e => setBrPorcentajeIgv(e.target.value)} className="w-24 p-3 bg-white border-2 border-indigo-100 rounded-xl font-bold text-center text-indigo-600 outline-none focus:border-indigo-500" /><span className="text-xl font-bold text-slate-400">%</span></div>
                                            <div className="pt-2"><label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Símbolo Moneda</label><input value={brMonedaSimbolo} onChange={e => setBrMonedaSimbolo(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs mt-1" /></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {branchModalTab === 'MODULOS' && (
                                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                    <div className="bg-[#0f172a] text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group border border-white/5">
                                        <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform"><LayoutGrid size={120} /></div>
                                        <div className="relative z-10">
                                            <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.3em] mb-2">Activación de Módulos</h4>
                                            <p className="text-slate-500 text-xs font-bold uppercase mb-8">Habilite o deshabilite funciones específicas para esta sucursal.</p>
                                            
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {['PRINCIPAL', 'GESTIÓN', 'LOGÍSTICA', 'MARKETING', 'ADMINISTRACIÓN', 'SISTEMA'].map(category => (
                                                    <div key={category} className="space-y-4">
                                                        <div className="flex items-center gap-3 pb-2 border-b border-white/10">
                                                            <div className="w-6 h-6 rounded bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                                                                <LayoutGrid size={12} />
                                                            </div>
                                                            <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{category}</h5>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {SYSTEM_MODULES.filter(m => m.category === category && m.id !== 'DEV_CONFIG').map(module => {
                                                                const config = brModulosConfig[module.id];
                                                                const isObject = typeof config === 'object';
                                                                const isActive = isObject ? config.isActive : !!config;
                                                                const isNew = isObject ? config.isNew : false;
                                                                const onlyPromoVideo = isObject ? !!config.onlyPromoVideo : false;
                                                                const allowedRoles = isObject && Array.isArray(config.allowedRoles) ? config.allowedRoles : [];

                                                                return (
                                                                    <div key={module.id} className="flex flex-col gap-3 p-4 bg-white/[0.03] rounded-[2rem] border border-white/5 hover:bg-white/[0.05] transition-all group">
                                                                        <div className="flex items-center justify-between gap-4">
                                                                            <div className="flex flex-col min-w-0">
                                                                                <span className="text-[10px] font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors truncate">{module.label}</span>
                                                                                <span className="text-[8px] font-bold text-slate-500 font-mono truncate">{module.id}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-3 shrink-0">
                                                                                <div className="flex flex-col items-center gap-1">
                                                                                    <span className="text-[6px] font-bold text-slate-500 uppercase tracking-widest">NUEVO</span>
                                                                                    <button 
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setBrModulosConfig(prev => ({
                                                                                                ...prev,
                                                                                                [module.id]: {
                                                                                                    isActive: isObject ? prev[module.id].isActive : !!prev[module.id],
                                                                                                    allowedRoles: isObject ? prev[module.id].allowedRoles : [],
                                                                                                    onlyPromoVideo: isObject ? prev[module.id].onlyPromoVideo : false,
                                                                                                    isNew: !isNew
                                                                                                }
                                                                                            }));
                                                                                        }}
                                                                                        className={`relative w-8 h-4 rounded-full transition-all ${isNew ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                                                                    >
                                                                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isNew ? 'left-4.5' : 'left-0.5'}`} />
                                                                                    </button>
                                                                                </div>
                                                                                <div className="h-6 w-px bg-white/10" />
                                                                                <div className="flex flex-col items-center gap-1">
                                                                                    <span className="text-[6px] font-bold text-slate-500 uppercase tracking-widest">VER VIDEO</span>
                                                                                    <button 
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setBrModulosConfig(prev => ({
                                                                                                ...prev,
                                                                                                [module.id]: {
                                                                                                    isActive: isObject ? prev[module.id].isActive : !!prev[module.id],
                                                                                                    allowedRoles: isObject ? prev[module.id].allowedRoles : [],
                                                                                                    isNew: isObject ? prev[module.id].isNew : false,
                                                                                                    onlyPromoVideo: !onlyPromoVideo
                                                                                                }
                                                                                            }));
                                                                                        }}
                                                                                        className={`relative w-8 h-4 rounded-full transition-all ${onlyPromoVideo ? 'bg-amber-500' : 'bg-slate-700'}`}
                                                                                    >
                                                                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${onlyPromoVideo ? 'left-4.5' : 'left-0.5'}`} />
                                                                                    </button>
                                                                                </div>
                                                                                <div className="h-6 w-px bg-white/10" />
                                                                                <div className="flex flex-col items-center gap-1">
                                                                                    <span className="text-[6px] font-bold text-slate-500 uppercase tracking-widest">ACTIVO</span>
                                                                                    <button 
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setBrModulosConfig(prev => ({
                                                                                                ...prev,
                                                                                                [module.id]: {
                                                                                                    isNew: isObject ? prev[module.id].isNew : false,
                                                                                                    allowedRoles: isObject ? prev[module.id].allowedRoles : [],
                                                                                                    onlyPromoVideo: isObject ? prev[module.id].onlyPromoVideo : false,
                                                                                                    isActive: !isActive
                                                                                                }
                                                                                            }));
                                                                                        }}
                                                                                        className={`relative w-8 h-4 rounded-full transition-all ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                                                    >
                                                                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isActive ? 'left-4.5' : 'left-0.5'}`} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className="flex flex-wrap gap-1 pt-2 border-t border-white/5">
                                                                            {['OWNER', 'ADMIN', 'CAJERO', 'OPERARIO', 'DELIVERY', 'CONTABILIDAD'].map(role => {
                                                                                const isRoleAllowed = allowedRoles.includes(role);
                                                                                return (
                                                                                    <button
                                                                                        key={role}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            const nextRoles = isRoleAllowed 
                                                                                                ? allowedRoles.filter((r: string) => r !== role)
                                                                                                : [...allowedRoles, role];
                                                                                            
                                                                                            setBrModulosConfig(prev => ({
                                                                                                ...prev,
                                                                                                [module.id]: {
                                                                                                    isActive: isObject ? prev[module.id].isActive : !!prev[module.id],
                                                                                                    isNew: isObject ? prev[module.id].isNew : false,
                                                                                                    onlyPromoVideo: isObject ? prev[module.id].onlyPromoVideo : false,
                                                                                                    allowedRoles: nextRoles
                                                                                                }
                                                                                            }));
                                                                                        }}
                                                                                        className={`px-1.5 py-0.5 rounded-lg text-[6px] font-black uppercase tracking-tighter transition-all border ${
                                                                                            isRoleAllowed 
                                                                                            ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400' 
                                                                                            : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/20'
                                                                                        }`}
                                                                                    >
                                                                                        {role}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {branchModalTab === 'USUARIO' && (
                                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex items-start gap-4">
                                        <UserPlus className="text-amber-600 shrink-0" size={24} />
                                        <div>
                                            <h4 className="text-[11px] font-bold text-amber-900 uppercase tracking-widest mb-1">Primer Usuario Administrador</h4>
                                            <p className="text-[10px] text-amber-700 font-bold uppercase leading-tight">Este usuario será el dueño de la sede y podrá crear otros usuarios.</p>
                                        </div>
                                    </div>
                                    
                                    {isEditingBranch ? (
                                        <div className="p-10 text-center space-y-4">
                                            <ShieldAlert size={48} className="mx-auto text-slate-300" />
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">La creación de usuario inicial solo está disponible para sedes nuevas.</p>
                                        </div>
                                    ) : (
                                        <div className="max-w-xl mx-auto space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre Completo del Dueño</label>
                                                <input 
                                                    value={brUserFullname} 
                                                    onChange={e => setBrUserFullname(e.target.value.toUpperCase())} 
                                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:border-amber-500 transition-all shadow-inner" 
                                                    placeholder="JUAN PEREZ" 
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Usuario de Acceso</label>
                                                    <input 
                                                        value={brUsername} 
                                                        onChange={e => setBrUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))} 
                                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:border-amber-500 transition-all shadow-inner" 
                                                        placeholder="admin_norte" 
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Contraseña Inicial</label>
                                                    <input 
                                                        type="password"
                                                        value={brUserPassword} 
                                                        onChange={e => setBrUserPassword(e.target.value)} 
                                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold outline-none focus:border-amber-500 transition-all shadow-inner" 
                                                        placeholder="********" 
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase text-center italic">
                                                * El correo de acceso será: {brUsername || 'usuario'}@sislav.com
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row gap-4 shrink-0">
                                <button type="button" onClick={() => setIsBranchModalOpen(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-widest rounded-2xl transition-all">Cancelar</button>
                                <button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-[0.25em] rounded-2xl shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-3 active:scale-95">{isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />} {isEditingBranch ? 'ACTUALIZAR SEDE' : 'REGISTRAR SEDE'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE ELIMINACIÓN LÓGICA */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-[#050810]/95 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 md:p-10 text-center">
                            <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center text-red-500 mx-auto mb-6 shadow-inner">
                                <AlertTriangle size={40} strokeWidth={2.5} />
                            </div>
                            
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-3">
                                ¿Eliminar Empresa?
                            </h3>
                            
                            <div className="text-slate-400 text-sm font-bold uppercase leading-relaxed mb-8">
                                Estás a punto de ocultar la empresa <span className="text-white">"{companyToDelete?.name}"</span>. 
                                <br />
                                <span className="text-red-400/80 text-[10px] mt-2 block italic">Esta acción es irreversible desde este panel.</span>
                            </div>
                            
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={confirmDeleteCompany}
                                    disabled={isSaving}
                                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-red-900/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" /> : <Trash2 size={18} />}
                                    SÍ, ELIMINAR AHORA
                                </button>
                                
                                <button 
                                    onClick={() => { setIsDeleteModalOpen(false); setCompanyToDelete(null); }}
                                    disabled={isSaving}
                                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 disabled:opacity-50"
                                >
                                    CANCELAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE ITEM DE CATÁLOGO (CREAR/EDITAR) */}
            {isCatalogModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-[#050810]/95 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 space-y-6">
                            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-600/20">
                                        <Plus className="text-white" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight">
                                            {editingCatalogId ? 'Editar Recurso' : 'Nuevo Recurso'}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{currentCatalogModule?.replace('_', ' ')}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsCatalogModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nombre / Título</label>
                                    <input 
                                        value={catalogItem.nombre} 
                                        onChange={e => setCatalogItem({...catalogItem, nombre: e.target.value})} 
                                        className="w-full bg-black/40 border-2 border-white/10 rounded-2xl p-4 font-bold text-sm text-white outline-none focus:border-indigo-500 transition-all font-mono"
                                        placeholder="EJ: EDREDONES / YAPE / SAMSUNG"
                                    />
                                </div>

                                {currentCatalogModule === 'MAQUINA' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Tipo de Máquina</label>
                                        <div className="relative">
                                            <select 
                                                value={catalogItem.tipo} 
                                                onChange={e => setCatalogItem({...catalogItem, tipo: e.target.value})} 
                                                className="w-full bg-black/40 border-2 border-white/10 rounded-2xl p-4 font-bold text-sm text-white outline-none focus:border-indigo-500 transition-all appearance-none"
                                            >
                                                <option value="LAVADORA">LAVADORA</option>
                                                <option value="SECADORA">SECADORA</option>
                                            </select>
                                            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                        </div>
                                    </div>
                                )}

                                {currentCatalogModule === 'COLOR' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Color HEX</label>
                                        <div className="flex gap-4 items-center bg-black/40 border-2 border-white/10 rounded-2xl p-2.5">
                                            <input 
                                                type="color" 
                                                value={catalogItem.hex} 
                                                onChange={e => setCatalogItem({...catalogItem, hex: e.target.value})} 
                                                className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border-none shadow-lg"
                                            />
                                            <span className="text-sm font-mono font-bold text-slate-300 uppercase">{catalogItem.hex}</span>
                                        </div>
                                    </div>
                                )}

                                 <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                        {currentCatalogModule === 'VIDEO' ? 'URL de Youtube' : 'Subir Archivo (IMG/SVG/PNG)'}
                                    </label>
                                    {currentCatalogModule === 'VIDEO' ? (
                                        <div className="space-y-4">
                                            <input 
                                                value={catalogItem.url} 
                                                onChange={e => setCatalogItem({...catalogItem, url: e.target.value})} 
                                                className="w-full bg-black/40 border-2 border-white/10 rounded-2xl p-4 font-bold text-sm text-white outline-none focus:border-indigo-500 transition-all font-mono"
                                                placeholder="https://www.youtube.com/watch?v=..."
                                            />
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Asignar Video Promocional a Módulo (Opcional)</label>
                                                <div className="relative">
                                                    <select 
                                                        value={catalogItem.modulo_id || ''} 
                                                        onChange={e => setCatalogItem({...catalogItem, modulo_id: e.target.value})} 
                                                        className="w-full bg-black/40 border-2 border-white/10 rounded-2xl p-4 font-bold text-sm text-white outline-none focus:border-indigo-500 transition-all appearance-none"
                                                    >
                                                        <option value="">-- Sin Módulo Asignado --</option>
                                                        {SYSTEM_MODULES.map(mod => (
                                                            <option key={mod.id} value={mod.id}>
                                                                {mod.label} ({mod.id})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <label className="flex items-center justify-center gap-4 w-full bg-slate-800/50 border-2 border-dashed border-white/10 rounded-2xl p-6 text-sm font-bold uppercase cursor-pointer hover:bg-slate-800 transition-colors text-white group">
                                            {isSaving ? (
                                                <Loader2 className="animate-spin text-indigo-400" size={24}/>
                                            ) : catalogItem.url ? (
                                                <div className="flex items-center gap-3 text-emerald-400">
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Check size={20} /></div>
                                                    <span>IMAGEN CARGADA</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-white">
                                                    <Upload size={32} strokeWidth={1.5} />
                                                    <span className="text-[10px]">CLIC PARA SUBIR (MÁX 2MB)</span>
                                                </div>
                                            )}
                                            <input type="file" className="hidden" onChange={(e) => handleUpload(currentCatalogModule, e)} />
                                        </label>
                                    )}
                                    {catalogItem.url && currentCatalogModule !== 'VIDEO' && (
                                        <div className="mt-4 flex justify-center">
                                            <div className="w-32 h-32 rounded-2xl bg-black/40 border border-white/10 p-4 flex items-center justify-center overflow-hidden shadow-xl">
                                                <img src={catalogItem.url} className="max-w-full max-h-full object-contain" />
                                            </div>
                                        </div>
                                    )}
                                    {catalogItem.url && currentCatalogModule === 'VIDEO' && (
                                        <div className="mt-4 flex justify-center">
                                            <div className="w-full max-w-[200px] aspect-video rounded-2xl bg-black/40 border border-white/10 overflow-hidden shadow-xl relative">
                                                <img src={`https://img.youtube.com/vi/${getYouTubeId(catalogItem.url)}/mqdefault.jpg`} className="w-full h-full object-cover opacity-60" />
                                                <div className="absolute inset-0 flex items-center justify-center text-white/50"><PlayCircle size={32}/></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button 
                                onClick={handleAddItem} 
                                disabled={isSaving || (currentCatalogModule !== 'COLOR' && !catalogItem.url)} 
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                                {editingCatalogId ? 'ACTUALIZAR CAMBIOS' : 'GUARDAR EN CATÁLOGO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE CATÁLOGO */}
            {isCatalogDeleteModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6 bg-[#050810]/98 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 text-center md:p-10">
                            <div className="w-20 h-20 bg-rose-500/20 rounded-3xl flex items-center justify-center text-rose-500 mx-auto mb-6 shadow-inner">
                                <AlertTriangle size={40} />
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">¿Eliminar Recurso?</h3>
                            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-relaxed mb-8">
                                Estás a punto de ocultar <span className="text-white">"{currentCatalogModule === 'VIDEO' ? catalogItemToDelete?.title : catalogItemToDelete?.nombre}"</span> del catálogo central.
                                <br />
                                <span className="text-rose-400/80 mt-2 block italic italic">Esta acción afectará a todas las sucursales.</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={confirmDeleteCatalogItem} 
                                    disabled={isSaving} 
                                    className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-900/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" /> : <Trash2 size={16} />}
                                    SÍ, ELIMINAR AHORA
                                </button>
                                <button 
                                    onClick={() => { setIsCatalogDeleteModalOpen(false); setCatalogItemToDelete(null); }} 
                                    disabled={isSaving} 
                                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
                                >
                                    CANCELAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL GESTIÓN DE PLANTILLAS WA MASTER */}
            {isWaTemplateModalOpen && editingWaTemplate && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6 bg-[#050810]/98 backdrop-blur-2xl animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-white/10 rounded-[3rem] w-full max-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-indigo-900/10">
                            <div>
                                <h3 className="text-xl font-bold uppercase tracking-tight text-white flex items-center gap-3">
                                    <MessageCircle className="text-indigo-400" /> {editingWaTemplate.id ? 'Editar Plantilla WA' : 'Nueva Plantilla WA Master'}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">Configuración Global (SAAS MASTER)</p>
                            </div>
                            <button onClick={() => setIsWaTemplateModalOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Categoría del Mensaje</label>
                                    <select 
                                        value={editingWaTemplate.category} 
                                        onChange={e => setEditingWaTemplate({ ...editingWaTemplate, category: e.target.value as WaTemplateCategory })}
                                        className="w-full bg-black/40 border-2 border-white/10 rounded-2xl p-4 font-bold text-xs text-white outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="RECOJO">🔔 RECOJO DE ROPA</option>
                                        <option value="PROMOCION">🎁 PROMOCIONES</option>
                                        <option value="CUMPLEANOS">🎂 CUMPLEAÑOS</option>
                                        <option value="RECORDATORIO">📢 RECORDATORIOS</option>
                                        <option value="BIENVENIDA">👋 BIENVENIDA</option>
                                        <option value="PAGO">💰 COBRANZA</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Estado</label>
                                    <select 
                                        value={editingWaTemplate.is_active ? '1' : '0'} 
                                        onChange={e => setEditingWaTemplate({ ...editingWaTemplate, is_active: e.target.value === '1' })}
                                        className="w-full bg-black/40 border-2 border-white/10 rounded-2xl p-4 font-bold text-xs text-white outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="1">ACTIVO</option>
                                        <option value="0">INACTIVO</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Imagen Multimedia (Opcional)</label>
                                <div className="flex gap-4">
                                    <div className="flex-1 bg-black/40 border-2 border-dashed border-white/10 rounded-2xl p-1 relative min-h-[140px] flex items-center justify-center overflow-hidden group">
                                        {isUploadingWaImage ? (
                                            <Loader2 className="animate-spin text-indigo-400" size={32} />
                                        ) : editingWaTemplate.image_url ? (
                                            <>
                                                <img src={editingWaTemplate.image_url} className="w-full h-full object-contain" />
                                                <button onClick={() => setEditingWaTemplate({...editingWaTemplate, image_url: ''})} className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-xl shadow-lg hover:scale-110 transition-transform"><Trash2 size={12}/></button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 text-slate-600">
                                                <ImageIcon size={40} strokeWidth={1} />
                                                <span className="text-[8px] font-bold uppercase">Sin Imagen</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-48 flex flex-col gap-3">
                                        <button onClick={() => templateImageRef.current?.click()} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all">Subir Imagen</button>
                                        <input type="file" ref={templateImageRef} className="hidden" accept="image/*" onChange={handleUploadWaMasterImage} />
                                        <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed text-center px-2">Las imágenes se enviarán con el texto.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Contenido del Mensaje</label>
                                <textarea 
                                    value={editingWaTemplate.content}
                                    onChange={e => setEditingWaTemplate({ ...editingWaTemplate, content: e.target.value })}
                                    className="w-full bg-black/40 border-2 border-white/10 rounded-[2rem] p-6 text-sm font-medium text-white outline-none focus:border-indigo-500 transition-all h-40 resize-none font-mono"
                                    placeholder="Use -nombre- para personalizar..."
                                />
                                <div className="flex gap-2">
                                    <span className="bg-white/5 text-slate-500 text-[8px] font-bold px-2 py-0.5 rounded-lg border border-white/5 tracking-widest">-NOMBRE-</span>
                                    <span className="bg-white/5 text-slate-500 text-[8px] font-bold px-2 py-0.5 rounded-lg border border-white/5 tracking-widest">-EMPRESA-</span>
                                </div>
                            </div>

                            <button 
                                onClick={handleSaveWaMasterTemplate}
                                disabled={isSaving || !editingWaTemplate.content}
                                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-900/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                                GUARDAR PLANTILLA MAESTRA
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

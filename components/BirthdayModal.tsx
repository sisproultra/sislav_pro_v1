import React, { useState, useEffect } from 'react';
import { X, Cake, MessageCircle, Crown, Calendar, Bell, Send, Loader2, RefreshCcw } from 'lucide-react';
import { Client, Company, WaTemplate } from '../types';
import { EvolutionService } from '../services/evolutionService';
import { getFriendlyName } from '../utils/nameUtils';
import { dbGetWaTemplates } from '../services/dbService';

interface BirthdayModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  company: Company;
}

interface BirthdayItemProps {
  client: Client;
  isToday: boolean;
  onWish: (client: Client, isToday: boolean) => void;
}

const BirthdayItem: React.FC<BirthdayItemProps> = ({ client, isToday, onWish }) => (
  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-green-300 transition-all">
      <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${isToday ? 'bg-green-600 animate-bounce' : 'bg-green-200 text-green-700'}`}>
              <Cake size={24} />
          </div>
          <div>
              <h4 className="font-bold text-gray-800 text-sm uppercase leading-tight">{client.name}</h4>
              <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-100 text-[10px] font-bold">
                      <Crown size={10} fill="currentColor" />
                      {client.points || 0} PTS
                  </div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
                      <Calendar size={10} /> {isToday ? '¡Hoy es su día!' : 'Cumple mañana'}
                  </span>
              </div>
          </div>
      </div>
      <button 
          onClick={() => onWish(client, isToday)}
          className="p-0 rounded-xl border border-emerald-100 bg-white hover:bg-emerald-50 shadow-sm transition-all flex items-center justify-center w-11 h-11 overflow-hidden shrink-0 active:scale-95"
          title="Saludar por WhatsApp"
      >
          <img src="https://iili.io/fXXft0Q.png" className="w-11 h-11 object-contain" alt="WA" />
      </button>
  </div>
);

const BirthdayModal: React.FC<BirthdayModalProps> = ({ isOpen, onClose, clients, company }) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [message, setMessage] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [birthdayTemplates, setBirthdayTemplates] = useState<WaTemplate[]>([]);

  useEffect(() => {
    if (isOpen) {
        dbGetWaTemplates('CUMPLEANOS').then(setBirthdayTemplates);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);

  const todayM = now.getMonth() + 1;
  const todayD = now.getDate();
  const tomorrowM = tomorrow.getMonth() + 1;
  const tomorrowD = tomorrow.getDate();

  const isBirthday = (bday: string, m: number, d: number) => {
      const mStr = String(m).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const clean = bday.replace(/\//g, '-');
      return clean.includes(`${mStr}-${dStr}`) || clean.includes(`${dStr}-${mStr}`);
  };

  const todayBirthdays = clients.filter(c => c.birthday && isBirthday(c.birthday, todayM, todayD));
  const tomorrowBirthdays = clients.filter(c => c.birthday && isBirthday(c.birthday, tomorrowM, tomorrowD));

  const handleWhatsApp = (client: Client, isToday: boolean) => {
    const friendlyName = getFriendlyName(client.name, client.docType);
    
    let baseMessage = '';
    let imageUrl = null;
    const activeTemplates = birthdayTemplates.filter(t => t.is_active);
    
    if (activeTemplates.length > 0) {
        // Rotación aleatoria
        const randomTpl = activeTemplates[Math.floor(Math.random() * activeTemplates.length)];
        baseMessage = randomTpl.content;
        imageUrl = randomTpl.image_url || null;
    } else {
        baseMessage = isToday 
            ? `¡Hola -nombre-! 🎉 De parte de -empresa- te deseamos un muy Feliz Cumpleaños. ¡Pasa un día increíble! 🎂✨`
            : `¡Hola -nombre-! 👋 En -empresa- sabemos que mañana es tu cumpleaños y queremos ser los primeros en saludarte. ¡Que tengas un gran día! 🎉🎂`;
    }
    
    const finalMessage = baseMessage
        .replace(/-nombre-/g, friendlyName)
        .replace(/-empresa-/g, company.razonSocial || 'la lavandería');
    
    setSelectedClient(client);
    setMessage(finalMessage);
    setSelectedImageUrl(imageUrl);
    setShowEditor(true);
  };

  const handleSendMessage = async () => {
    if (!selectedClient) return;
    setIsSending(true);

    const phone = selectedClient.phone?.replace(/\D/g, '') || '';
    
    // Evolution API Config
    const evolutionConfig = {
      baseUrl: company.whatsapp_instance || '', 
      apiKey: company.whatsapp_token || '',
      instanceName: company.whatsapp_instance_name || ''
    };

    // Try to use Evolution API if configured
    if (evolutionConfig.baseUrl && evolutionConfig.apiKey && evolutionConfig.instanceName) {
      try {
        const evolution = new EvolutionService(evolutionConfig);
        const isActive = await evolution.checkInstance();
        
        if (isActive) {
          if (selectedImageUrl) {
            await evolution.sendMedia(phone, selectedImageUrl, message);
          } else {
            await evolution.sendText(phone, message);
          }
          alert('Mensaje enviado con éxito');
          setShowEditor(false);
          setIsSending(false);
          onClose(); // Cerrar el modal principal
          return;
        }
      } catch (error) {
        console.error('Error sending via Evolution API:', error);
      }
    }

    // Fallback to WA.me link
    const link = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(link, '_blank');
    setShowEditor(false);
    setIsSending(false);
    onClose(); // Cerrar el modal principal
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-50 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 border border-white/20">
        
        <div className="bg-slate-900 p-8 text-white relative shrink-0">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
            <X size={24} />
          </button>
          <div className="flex items-center gap-4">
            <div className="bg-green-500 p-3 rounded-2xl shadow-lg shadow-green-500/20">
              <Cake size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-tight">Cumpleañeros</h2>
              <p className="text-slate-400 text-sm font-medium">Fideliza a tus clientes en su día especial.</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <div>
                <h3 className="text-[10px] font-bold text-green-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> HOY ({todayBirthdays.length})
                </h3>
                {todayBirthdays.length > 0 ? (
                    <div className="space-y-2">
                        {todayBirthdays.map(c => <BirthdayItem key={c.id} client={c} isToday={true} onWish={handleWhatsApp} />)}
                    </div>
                ) : (
                    <p className="text-xs text-gray-400 italic px-2">No hay cumpleaños registrados para hoy.</p>
                )}
            </div>

            <div>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                   MAÑANA ({tomorrowBirthdays.length})
                </h3>
                {tomorrowBirthdays.length > 0 ? (
                    <div className="space-y-2">
                        {tomorrowBirthdays.map(c => <BirthdayItem key={c.id} client={c} isToday={false} onWish={handleWhatsApp} />)}
                    </div>
                ) : (
                    <p className="text-xs text-gray-400 italic px-2">Sin cumpleaños para mañana.</p>
                )}
            </div>

            {todayBirthdays.length === 0 && tomorrowBirthdays.length === 0 && (
                <div className="py-12 text-center flex flex-col items-center gap-4 text-gray-300">
                    <Bell size={48} className="opacity-20" />
                    <p className="text-sm font-bold uppercase tracking-widest">Todo tranquilo por aquí</p>
                </div>
            )}
        </div>

        {showEditor && selectedClient && (
          <div className="fixed inset-0 bg-black/50 z-[210] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 border border-slate-200">
              <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-tight">Enviar Saludo</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personaliza tu mensaje para {getFriendlyName(selectedClient.name, selectedClient.docType)}</p>
                </div>
                <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <textarea 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium text-slate-700 focus:bg-white focus:border-green-500 outline-none transition-all resize-none"
                  placeholder="Escribe tu mensaje aquí..."
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={isSending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-green-100 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Enviar Mensaje
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t bg-white flex justify-center shrink-0">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 italic">
                Un pequeño gesto hace la diferencia
             </p>
        </div>
      </div>
    </div>
  );
};

export default BirthdayModal;
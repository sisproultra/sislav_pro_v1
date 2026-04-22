
import { EvolutionConfig } from '../types';

export class EvolutionService {
    private config: EvolutionConfig;

    constructor(config: EvolutionConfig) {
        this.config = config;
    }

    private getCleanBaseUrl(): string {
        let base = this.config.baseUrl.trim();
        if (base.includes('/message/')) base = base.split('/message/')[0];
        if (base.includes('/instance/')) base = base.split('/instance/')[0];
        return base.endsWith('/') ? base.slice(0, -1) : base;
    }

    private getUrl(endpoint: string) {
        const base = this.getCleanBaseUrl();
        const instance = this.config.instanceName.trim();
        return `${base}/message/${endpoint}/${instance}`;
    }

    public static getPayload(type: 'text' | 'image', phone: string, content: string, mediaData?: string) {
        const cleanPhone = phone.replace(/\D/g, '');

        if (type === 'image' && mediaData) {
            let mimetype = 'image/png';

            if (mediaData.startsWith('data:')) {
                // Es un Base64 (imagen cargada localmente)
                const detectedMime = mediaData.match(/data:([^;]+);/);
                if (detectedMime) mimetype = detectedMime[1];
            } else {
                // Es una URL externa, inferimos el mimetype
                const urlWithoutQuery = mediaData.split('?')[0];
                const ext = urlWithoutQuery.split('.').pop()?.toLowerCase() || 'png';
                if (['jpg', 'jpeg'].includes(ext)) mimetype = 'image/jpeg';
                if (ext === 'webp') mimetype = 'image/webp';
                if (ext === 'gif') mimetype = 'image/gif';
            }

            return {
                number: cleanPhone,
                mediatype: "image",
                mimetype: mimetype,
                caption: content,
                media: mediaData.trim(),
                fileName: "Imagen.png",
                delay: 1200,
                mentionsEveryOne: false,
                mentioned: [cleanPhone]
            };
        }

        return {
            number: cleanPhone,
            text: content,
            delay: 1200,
            linkPreview: false
        };
    }

    async sendText(phone: string, text: string) {
        const url = this.getUrl('sendText');
        const payload = EvolutionService.getPayload('text', phone, text);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': this.config.apiKey.trim()
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || `Error ${response.status}`);
        }
        return response.json();
    }

    async sendMedia(phone: string, imageUrl: string, caption?: string) {
        const url = this.getUrl('sendMedia');
        const payload = EvolutionService.getPayload('image', phone, caption || "", imageUrl);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': this.config.apiKey.trim()
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            let errorMessage = "Error desconocido";
            if (errorData.message) {
                errorMessage = Array.isArray(errorData.message)
                    ? JSON.stringify(errorData.message)
                    : errorData.message;
            }
            throw new Error(errorMessage);
        }
        return response.json();
    }

    async checkInstance() {
        try {
            const base = this.getCleanBaseUrl();
            const instance = this.config.instanceName.trim();
            const url = `${base}/instance/connectionState/${instance}`;
            const response = await fetch(url, {
                headers: { 'apikey': this.config.apiKey.trim() }
            });
            const data = await response.json();
            return response.ok && (
                data.instance?.state === 'open' ||
                data.state === 'open' ||
                data.status === 'open' ||
                data.connectionState === 'open'
            );
        } catch (error) {
            return false;
        }
    }
}

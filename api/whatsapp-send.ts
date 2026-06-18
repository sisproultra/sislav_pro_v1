import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { baseUrl, apiKey, instance, phoneNumber, text } = req.body;

    if (!baseUrl || !apiKey || !instance || !phoneNumber || !text) {
        return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos' });
    }

    try {
        let cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.length === 9) {
            cleanNumber = `51${cleanNumber}`;
        }
        const payload = {
            "number": cleanNumber,
            "text": text,
            "delay": 1200
        };

        let finalBaseUrl = baseUrl.trim();
        if (!finalBaseUrl.startsWith('http')) finalBaseUrl = `https://${finalBaseUrl}`;
        const finalEndpoint = `${finalBaseUrl}/message/sendText/${instance}`;

        console.log(`🚀 [Vercel API WA] Enviando a ${cleanNumber} via ${instance}`);

        const response = await fetch(finalEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            responseData = { raw: responseText };
        }

        if (response.ok) {
            return res.status(200).json({ success: true, data: responseData });
        } else {
            console.error(`❌ [Vercel API WA Error]:`, responseData);
            return res.status(response.status).json({ success: false, message: `Error Evolution API: ${response.status}`, details: responseData });
        }
    } catch (error: any) {
        console.error(`❌ [Vercel API WA Exception]: ${error.message}`);
        return res.status(500).json({ success: false, message: 'Error interno al enviar WhatsApp', details: error.message });
    }
}

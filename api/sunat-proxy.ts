import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const targetUrl = req.query.url as string;

  if (!targetUrl || !targetUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'URL destino inválida o faltante' });
  }

  const allowedHosts = ['visioner7-api.com', 'visioner7.com'];
  const isAllowed = allowedHosts.some(host => targetUrl.includes(host));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Dominio no autorizado' });
  }

  const token = process.env.VISIONER7_API_TOKEN;
  if (!token || token.trim() === '') {
    console.error('❌ VISIONER7_API_TOKEN no configurado en Vercel');
    return res.status(500).json({ 
      error: 'Token de facturación no configurado en el servidor'
    });
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token.trim()}`,
      },
      body: JSON.stringify(req.body),
    });

    const contentType = response.headers.get('content-type') || 'application/json';
    const data = await response.text();
    res.status(response.status).setHeader('Content-Type', contentType).send(data);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al conectar con Visioner7', details: error.message });
  }
}

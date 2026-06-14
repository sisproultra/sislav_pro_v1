import * as dotenv from 'dotenv';
dotenv.config();

const rawUrl = process.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co';
const rawKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const cleanUrl = (url: string) => {
  let u = url.trim().replace(/['"]/g, '');
  if (u.endsWith('/rest/v1')) {
    u = u.slice(0, -8);
  }
  if (u.endsWith('/rest/v1/')) {
    u = u.slice(0, -9);
  }
  return u;
};

const supabaseUrl = cleanUrl(rawUrl);
const apiKey = rawKey.trim().replace(/['"]/g, '');

async function run() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/historico_pagos_consolizados`, {
      method: 'OPTIONS',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    });
    console.log("Response status:", res.status, res.statusText);
    const text = await res.text();
    console.log("Response text length:", text.length);
    if (text.length > 0) {
      try {
        const parsed = JSON.parse(text);
        console.log(JSON.stringify(parsed, null, 2));
      } catch (err) {
        console.log("Raw text output:", text.substring(0, 1000));
      }
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

run();

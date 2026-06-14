import * as dotenv from 'dotenv';
dotenv.config();

const rawUrl = process.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co';
const rawKey = process.env.VITE_SUPABASE_ANON_KEY || '';

// Clean URL
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
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    });
    if (!res.ok) {
      console.error("HTTP error:", res.status, res.statusText);
      return;
    }
    const data = await res.json();
    console.log("Exposed Tables/Endpoints in OpenAPI spec:");
    if (data.definitions) {
      const keys = Object.keys(data.definitions);
      console.log(keys);
    } else if (data.paths) {
      const paths = Object.keys(data.paths);
      console.log(paths);
    } else {
      console.log("Response keys:", Object.keys(data));
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

run();

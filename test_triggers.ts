
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const cleanUrl = (urlStr: string) => {
    if (!urlStr) return '';
    try {
        let trimmed = urlStr.trim().replace(/['"]/g, '');
        if (!trimmed.toLowerCase().startsWith('http')) {
            trimmed = `https://${trimmed}`;
        }
        const parsed = new URL(trimmed);
        let cleanPath = parsed.pathname.replace(/\/rest\/v1\/?$/, '');
        if (cleanPath === '/') cleanPath = '';
        return `${parsed.origin}${cleanPath}`;
    } catch (e) {
        return urlStr.trim().replace(/\/$/, '').split('/rest/v1')[0];
    }
};

const rawUrl = process.env.VITE_SUPABASE_URL || 'https://yvgshdypqanlcgxdyvls.supabase.co';
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const url = cleanUrl(rawUrl);
const key = rawKey.replace(/['"]/g, '').trim();

const supabase = createClient(url, key);

async function checkColumns() {
  console.log("Checking columns of table 'ventas'...");
  const { data, error } = await supabase.from('ventas').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
  } else if (data && data.length > 0) {
    console.log("Keys of row in ventas:", Object.keys(data[0]));
    console.log("Values of row in ventas:", data[0]);
  } else {
    console.log("No rows in ventas");
  }
}

checkColumns();

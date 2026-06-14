import { createClient } from '@supabase/supabase-js';
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
const supabaseKey = rawKey.trim().replace(/['"]/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNames() {
  const candidateNames = [
    'historico_pagos_consolizados',   // With 'z'
    'historico_pagos_consolizadas',  // Feminine with 'z'?
    'hisorico_pagos_consolizados',   // Typo + 'z'
    'historico_pago_consolizados',   // Singular 'pago' with 'z'
  ];

  for (const name of candidateNames) {
    const { data, error } = await supabase.from(name).select('*').limit(3);
    if (error) {
      if (error.message.includes("Could not find the table")) {
        // Table doesn't exist
      } else {
        console.log(`⚠️ Table '${name}' exists but query failed:`, error.message);
      }
    } else {
      console.log(`✅ Table '${name}' exists! Row count retrieved:`, data?.length);
      console.log(`Columns of '${name}':`, data && data.length > 0 ? Object.keys(data[0]) : "Empty table");
      if (data && data.length > 0) {
         console.log(`Sample row:`, data);
      }
    }
  }
}

checkNames();

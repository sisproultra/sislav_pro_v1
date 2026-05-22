
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = 'https://yvgshdypqanlcgxdyvls.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2Z3NoZHlwcWFubGNneGR5dmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjYyODIsImV4cCI6MjA4NTE0MjI4Mn0.B65RRA4u5-a_6E-blMvQXMKf39521esSif4XODdzfNE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('global_cat_videos_ayuda')
    .select('*');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Stored videos in DB:', data);
}

checkColumns();

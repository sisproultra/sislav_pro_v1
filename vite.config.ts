
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Inyección de variables para evitar errores de 'process is not defined'
  define: {
    'process.env': {
      API_KEY: JSON.stringify(process.env.API_KEY || "")
    },
    'global': 'window'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'query-vendor': ['@tanstack/react-query'],
          'recharts-vendor': ['recharts'],
          'maps-vendor': ['leaflet', 'react-leaflet'],
          'xlsx-vendor': ['xlsx'],
          'pdf-vendor': ['jspdf', 'jspdf-autotable'],
          'motion-vendor': ['motion'],
          'bwip-vendor': ['bwip-js'],
          'genai-vendor': ['@google/genai']
        }
      }
    }
  },
  server: {
    hmr: false,
    historyApiFallback: true,
    proxy: {
      '/api-proxy/decolecta': {
        target: 'https://api.decolecta.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy\/decolecta/, '')
      },
      '/api-proxy/sunat': {
        target: 'https://apisu.sysventa.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-proxy\/sunat/, '/API_SUNAT/post.php')
      }
    }
  }
});

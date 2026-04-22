
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
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['lucide-react', 'recharts', 'leaflet', 'react-leaflet'],
          'utils-vendor': ['xlsx', 'jspdf', 'jspdf-autotable']
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

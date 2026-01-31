
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  server: {
    port: 3000,
    // Menambahkan proxy agar /api tidak mengembalikan index.html (404 SPA)
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Sesuaikan jika menggunakan vercel dev di port lain
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static production build -> /tv_display/v2/ (isolated Preview, zero impact on production /tv_display/index.html)
export default defineConfig({
  plugins: [react()],
  base: '/tv_display/v2/',
  build: {
    outDir: '../tv_display/v2',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2019', // Broad compatibility with Samsung Tizen TV browsers
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand', 'motion'],
          supabase: ['@supabase/supabase-js', '@tanstack/react-query']
        }
      }
    }
  }
});

import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    port: 9000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['jquery', 'underscore', 'ace-builds']
        }
      }
    }
  },
  publicDir: 'app/assets',
  optimizeDeps: {
    include: ['ace-builds']
  }
}) 
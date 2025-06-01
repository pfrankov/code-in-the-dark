import { defineConfig } from 'vite'

export default defineConfig({
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
          vendor: ['jquery', 'underscore', 'brace']
        }
      }
    }
  },
  publicDir: 'app/assets'
}) 
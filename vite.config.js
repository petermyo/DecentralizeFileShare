// --- vite.config.js ---
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // FIX: Explicitly set publicDir to false to avoid the build warning.
  // This tells Vite that we are not using a separate public assets folder.
  publicDir: false,
  build: {
    outDir: 'public',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
      '/s': 'http://localhost:8788',
      '/l': 'http://localhost:8788',
      '/': 'http://localhost:8788',
    },
  },
})

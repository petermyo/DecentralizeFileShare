import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'public',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
      '/s': 'http://localhost:8788',
      '/l': 'http://localhost:8788',
    },
  },
})
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // This line tells Vite to create a 'public' folder for the build output,
    // matching your Cloudflare Pages project settings.
    outDir: 'public',
  },
  server: {
    // This proxy is for local development and does not affect the build.
    proxy: {
      '/api': 'http://localhost:8788',
      '/s': 'http://localhost:8788',
      '/l': 'http://localhost:8788',
    },
  },
})

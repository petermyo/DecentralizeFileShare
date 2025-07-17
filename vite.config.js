// --- vite.config.js ---
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // UPDATE: Change the output directory from 'dist' to 'public'
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

// --- tailwind.config.js (no changes) ---
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'theme-primary': 'var(--color-primary)',
        'theme-secondary': 'var(--color-secondary)',
        'theme-accent': 'var(--color-accent)',
      }
    },
  },
  plugins: [],
}

// --- postcss.config.js (no changes) ---
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

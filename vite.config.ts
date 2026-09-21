import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build works on GitHub Pages, Vercel, Netlify
// or any static host without extra configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
})

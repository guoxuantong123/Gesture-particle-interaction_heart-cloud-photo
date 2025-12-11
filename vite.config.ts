import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // This is critical for GitHub Pages. 
  // It ensures assets are linked relatively (e.g., "./assets/...") 
  // instead of absolutely (e.g., "/assets/..."), preventing 404 errors in subdirectories.
  base: './', 
})
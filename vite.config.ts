import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('https://izabellaleahz-15749--phipseq-visualizer-sqlite-serve.us-east.modal.run'),
  },
})

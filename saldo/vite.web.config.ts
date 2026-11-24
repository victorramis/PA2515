// Kör bara gränssnittet i en vanlig webbläsare (utan Electron), t.ex. för snabb design-QA.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: { alias: { '@': resolve(__dirname, 'src/renderer/src') } },
  plugins: [react()],
  server: { port: 5199 }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001',
      '/bookings': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001',
      '/fltstatus': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001',
    },
  },
})

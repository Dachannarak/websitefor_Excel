import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4000,
    strictPort: true,
    allowedHosts: ["slot-posing-occupier.ngrok-free.dev"],
    proxy: {
  "/events" : {
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
    rewrite: (path) => path,
  },
  "/events/" : {
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
  },
  "/api" : {
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
  },
  "/uploads" : {
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
  },
  "/report" : {
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
  },
}
  }
})
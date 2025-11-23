import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";
// https://vitejs.dev/config/
export default defineConfig({

  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,          // equals 0.0.0.0
    port: 5173,
    strictPort: true,
    hmr: { clientPort: 5173 },
  },
  define: {
    'process.env': {},                 // minimal browser-safe shim
    'process.platform': JSON.stringify('browser'),
  }
})

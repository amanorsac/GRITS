import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, /api goes to `wrangler dev` (npm run worker:dev at the repo root, port 8787).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
})

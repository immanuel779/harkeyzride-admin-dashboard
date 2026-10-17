import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget =
    env.VITE_PROXY_TARGET || 'https://harkings-ride-2.onrender.com'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api-backend': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api-backend/, ''),
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) return 'react'
              if (id.includes('@tanstack/react-query')) return 'query'
              if (id.includes('recharts')) return 'charts'
              if (id.includes('leaflet')) return 'map'
              if (id.includes('cmdk')) return 'cmdk'
              if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) return 'forms'
            }
            return undefined
          },
        },
      },
      chunkSizeWarningLimit: 800,
    },
  }
})
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Por defecto el proxy /api apunta a Render; para probar la Fase 1 contra el
  // backend local se setea VITE_API_PROXY_TARGET=http://127.0.0.1:8000 en .env.local.
  const apiTarget = env.VITE_API_PROXY_TARGET || 'https://sistema-de-gestion-de-programa-de.onrender.com'

  return {
    plugins: [
      vue(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        }
      }
    },
    test: {
      environment: 'jsdom',
      globals: true,
      // No escanear worktrees de agentes ni checkouts anidados.
      exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**', '**/.git/**'],
    }
  }
})

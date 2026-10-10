import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

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
      // PWA instalable (ícono en el celular). El service worker solo precachea
      // el "cascarón" de la app (JS/CSS/HTML/íconos); los datos (Supabase) van
      // siempre a la red: nunca se muestran asistencias o listas viejas.
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Sistema de Confirmación',
          short_name: 'SCJ',
          description: 'Gestión del programa de confirmación parroquial: confirmandos, grupos, asistencias, cronograma y sacramentos.',
          lang: 'es',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Exportar a Excel/PDF es ocasional: esas librerías (~1.5 MB) se bajan
          // al usarlas, no al instalar la app (ahorra datos móviles).
          globIgnores: ['**/pwa-source.png', '**/exceljs*.js', '**/jspdf*.js', '**/html2canvas*.js'],
          // SPA: cualquier ruta abierta desde el ícono carga index.html.
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
        },
      }),
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

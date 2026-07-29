import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: 'Kopirex POS',
        short_name: 'KopirexPOS',
        description: 'Aplikasi Kasir Kopirex Offline Ready',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Langsung aktif tanpa menunggu tab lain ditutup
        skipWaiting: true,
        clientsClaim: true,

        // Pre-cache semua aset utama aplikasi
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2,ttf,eot}'],

        // Navigasi ke URL apapun (termasuk /pos, /shift/open, dll) akan fallback ke index.html
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],  // Jangan intercept API call

        runtimeCaching: [
          // API: Network first (pakai cache jika offline)
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'kopirex-api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // Aset gambar produk (termasuk dari server API): Cache first
          {
            urlPattern: ({ url }) => {
              return /\.(png|jpg|jpeg|webp|svg|gif|ico)$/i.test(url.pathname)
            },
            handler: 'CacheFirst',
            options: {
              cacheName: 'kopirex-images-cache',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
})

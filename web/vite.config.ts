/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

const API_TARGET = process.env.VITE_API_PROXY ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'RailwayOne Pro (Demo)',
        short_name: 'RailwayOne',
        description: 'An original railway booking prototype with simulated tickets. Demo only — not valid for travel.',
        theme_color: '#0B3A8C',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en-IN',
        categories: ['travel', 'productivity'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Unreserved ticket (demo)', url: '/unreserved', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'My tickets', url: '/tickets', icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/stations') || url.pathname === '/api/fares/table',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'rw1-reference-data', expiration: { maxEntries: 200, maxAgeSeconds: 86400 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } },
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true, proxy: { '/api': { target: API_TARGET } } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});

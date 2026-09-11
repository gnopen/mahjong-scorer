import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

/**
 * `ARTIFACT=1` builds a copy for sharing as a hosted preview: assets are
 * referenced relatively because the host does not serve root-relative paths,
 * and the service worker is left out so a republish is never masked by a
 * cached older version.
 */
const forArtifact = process.env.ARTIFACT === '1'

export default defineConfig({
  base: forArtifact ? './' : '/',
  plugins: [
    react(),
    ...(forArtifact ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Mahjong Scorer',
        short_name: 'Mahjong',
        description: 'Photo-to-score Mahjong scoring, payments and ledger',
        theme_color: '#0f5132',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    })]),
  ],
  // `host: true` binds every interface, so phones on the same wifi can open the
  // app at http://<laptop-ip>:5180 instead of only localhost.
  server: { host: true, port: 5180, strictPort: false },
  preview: { host: true },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any)

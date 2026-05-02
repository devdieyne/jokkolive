import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // `autoUpdate` : le SW met l'app à jour silencieusement à chaque visite.
      // Pas de prompt "nouvelle version dispo", juste un refresh propre.
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon-32.png',
        'favicon-192.png',
        'favicon-512.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'JokkoLive — Vendez sur WhatsApp',
        short_name: 'JokkoLive',
        description:
          'Prenez les commandes de vos lives directement sur WhatsApp et encaissez en mobile money.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f8fafc',
        theme_color: '#059669',
        categories: ['business', 'shopping', 'finance'],
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/favicon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/favicon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          // Maskable : Android adapte la forme (rond, carré arrondi…) au lanceur.
          {
            src: '/favicon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/favicon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Raccourcis exposés par un long-press sur l'icône (Android, iOS 17+).
        shortcuts: [
          {
            name: 'Mes commandes',
            short_name: 'Commandes',
            url: '/orders',
            icons: [{ src: '/favicon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Mes produits',
            short_name: 'Produits',
            url: '/',
            icons: [{ src: '/favicon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Portefeuille',
            short_name: 'Wallet',
            url: '/wallet',
            icons: [{ src: '/favicon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Pré-cache les assets de build. Le HTML est servi via navigateFallback.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // SPA fallback : toute requête de navigation qui rate le réseau retombe
        // sur index.html (mode hors-ligne, le client gère la suite).
        navigateFallback: '/index.html',
        // N'intercepte pas /api ni /shop (contenu dynamique).
        navigateFallbackDenylist: [/^\/api\//, /^\/shop\//],
        runtimeCaching: [
          {
            // Images (Cloudinary, /shop, etc.) : cache 7 jours.
            urlPattern: /\.(?:png|jpg|jpeg|webp|svg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
      // SW désactivé en dev pour ne pas pourrir le HMR.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});

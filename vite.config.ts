import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Sudoku/',
  server: {
    port: 5179,
    strictPort: true,
  },
  preview: {
    port: 5179,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,woff,woff2,ttf,otf}'],
        navigateFallback: 'index.html',
      },
      manifest: {
        name: 'Sudoku PWA',
        short_name: 'Sudoku',
        description:
          'An offline-capable, mobile-friendly Sudoku game with multiple grid variants and difficulty levels.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/Sudoku/',
        start_url: '/Sudoku/',
        icons: [
          {
            src: 'icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-512-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // KUNCI ADVANCED 1: Masukkan ekstensi .json dan .bin agar model AI ikut di-cache
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,json,bin}'
        ],
        // KUNCI ADVANCED 2: Naikkan batas ukuran file menjadi 50MB
        // agar file weights.bin yang besar tidak ditolak oleh Service Worker
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true
      },
      manifest: {
        name: 'RootFacts - AI Plant Recognition',
        short_name: 'RootFacts',
        description: 'Aplikasi AI untuk mengenali sayuran dan memberikan fakta unik',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
        // Anda bisa menambahkan array screenshots di sini nanti jika diperlukan
      }
    })
  ],
  // Pemecahan modul (Chunking) sangat disarankan agar loading awal aplikasi lebih ringan
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'tensorflow': ['@tensorflow/tfjs', '@tensorflow/tfjs-backend-webgpu'],
          'transformers': ['@huggingface/transformers']
        }
      }
    }
  },
  server: {
    port: 3001,
    host: true
  }
});
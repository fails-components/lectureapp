import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { VitePWA } from 'vite-plugin-pwa'

const ENV_PREFIX = 'REACT_APP_'

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build'
    },
    plugins: [
      react(),
      eslint(),
      wasm(),
      topLevelAwait(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          sourcemap: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        }
      })
    ],
    worker: {
      format: 'module'
    },
    server: {
      port: 3000,
      hmr: {
        protocol: 'ws',
        port: 3000,
        host: 'localhost'
      }
    },
    base: process?.env?.PUBLIC_URL
      ? process.env.PUBLIC_URL
      : '/static/lecture/',
    optimizeDeps: {
      include: ['pdfjs-dist']
    },
    envPrefix: ENV_PREFIX
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { VitePWA } from 'vite-plugin-pwa'
import dynamicImport from 'vite-plugin-dynamic-import'

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
      }),
      dynamicImport({
        filter(id) {
          // `node_modules` is exclude by default, so we need to include it explicitly
          // https://github.com/vite-plugin/vite-plugin-dynamic-import/blob/v1.3.0/src/index.ts#L133-L135
          if (id.includes('/node_modules/libav.js')) {
            return true
          }
          if (id.includes('/node_modules/libavjs-webcodecs-polyfill')) {
            return true
          }
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

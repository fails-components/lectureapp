import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import eslint from 'vite-plugin-eslint'
import envCompatible from 'vite-plugin-env-compatible'

const ENV_PREFIX = 'REACT_APP_'

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build'
    },
    plugins: [react(), eslint(), envCompatible({ prefix: ENV_PREFIX })],
    server: {
      port: 3000,
      hmr: {
        protocol: 'ws',
        port: 3000,
        host: 'localhost'
      }
    },
    base: '/static/lecture/',
    optimizeDeps: {
      include: ['pdfjs-dist']
    }
  }
})

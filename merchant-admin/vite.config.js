import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('echarts/core')) return 'echarts-core'
            if (id.includes('echarts/lib/chart/bar')) return 'echarts-bar'
            if (id.includes('echarts/lib/component/tooltip')) return 'echarts-tooltip'
            if (id.includes('echarts/lib/component/grid')) return 'echarts-grid'
            if (id.includes('echarts/renderers')) return 'echarts-renderers'
            if (id.includes('element-plus')) {
              const match = id.match(/element-plus\/(?:es\/)?components\/([^/]+)/)
              if (match) {
                return `ep-${match[1]}`
              }
              return 'element-plus-base'
            }
            if (id.includes('@element-plus/icons-vue')) return 'icons'
            if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia')) return 'vue-core'
          }
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    }
  }
})

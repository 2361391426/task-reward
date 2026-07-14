import { defineConfig } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const uni = uniPlugin.default || uniPlugin

export default defineConfig({
  plugins: [
    uni(),
    {
      name: 'copy-tabbar-icons',
      closeBundle() {
        const targetDirs = [
          resolve(__dirname, 'dist/dev/mp-weixin/static/tabbar'),
          resolve(__dirname, 'dist/build/mp-weixin/static/tabbar')
        ]
        const icons = ['task.png', 'task-active.png', 'my.png', 'my-active.png']

        targetDirs.forEach((targetDir) => {
          if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true })
          }

          icons.forEach((icon) => {
            const src = resolve(__dirname, 'static/tabbar', icon)
            const dest = resolve(targetDir, icon)
            if (existsSync(src)) {
              copyFileSync(src, dest)
              console.log(`✅ 复制图标: ${icon} -> ${targetDir}`)
            }
          })
        })
      }
    }
  ],
  build: {
    outDir: 'dist/dev/mp-weixin'
  },
  server: {
    port: 3000,
    open: false
  }
})

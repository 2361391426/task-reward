import { defineConfig } from 'vite'
import uniPlugin from '@dcloudio/vite-plugin-uni'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { dirname, relative, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const uni = uniPlugin.default || uniPlugin

const copyDirectory = (sourceDir, targetDir) => {
  if (!existsSync(sourceDir)) {
    return
  }

  mkdirSync(targetDir, { recursive: true })

  readdirSync(sourceDir, { withFileTypes: true }).forEach((entry) => {
    const sourcePath = resolve(sourceDir, entry.name)
    const targetPath = resolve(targetDir, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath)
      return
    }

    if (entry.isFile()) {
      copyFileSync(sourcePath, targetPath)
    }
  })
}

const countFiles = (dir) => {
  if (!existsSync(dir)) {
    return 0
  }

  return readdirSync(dir, { withFileTypes: true }).reduce((count, entry) => {
    const fullPath = resolve(dir, entry.name)
    return count + (entry.isDirectory() ? countFiles(fullPath) : entry.isFile() ? 1 : 0)
  }, 0)
}

const resolveMiniappStaticDir = () => {
  if (process.env.UNI_PLATFORM !== 'mp-weixin') {
    return ''
  }

  if (process.env.UNI_OUTPUT_DIR) {
    return resolve(__dirname, process.env.UNI_OUTPUT_DIR, 'static')
  }

  return process.env.NODE_ENV === 'production'
    ? resolve(__dirname, 'dist/build/mp-weixin/static')
    : resolve(__dirname, 'dist/dev/mp-weixin/static')
}

const resolveMiniappOutputDir = () => {
  if (process.env.UNI_PLATFORM !== 'mp-weixin') {
    return ''
  }

  if (process.env.UNI_OUTPUT_DIR) {
    return resolve(__dirname, process.env.UNI_OUTPUT_DIR)
  }

  return process.env.NODE_ENV === 'production'
    ? resolve(__dirname, 'dist/build/mp-weixin')
    : resolve(__dirname, 'dist/dev/mp-weixin')
}

const normalizeMiniappProjectConfig = (outputDir) => {
  const configPath = resolve(outputDir, 'project.config.json')
  if (!existsSync(configPath)) {
    return
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  delete config.miniprogramRoot
  delete config.srcMiniprogramRoot
  config.description = '诺斯马丁小程序构建产物'
  config.libVersion = '3.14.3'
  config.setting = {
    ...(config.setting || {}),
    useIsolateContext: true,
    useCompilerModule: false
  }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  console.log(`已修正构建产物项目配置: ${relative(__dirname, configPath)}`)
}

export default defineConfig({
  plugins: [
    uni(),
    {
      name: 'copy-miniapp-static-assets',
      closeBundle() {
        const outputDir = resolveMiniappOutputDir()
        if (!outputDir) {
          return
        }

        normalizeMiniappProjectConfig(outputDir)

        const targetDir = resolve(outputDir, 'static')
        const assetDirs = ['tabbar', 'images']
        assetDirs.forEach((assetDir) => {
          const sourceDir = resolve(__dirname, 'static', assetDir)
          const outputDir = resolve(targetDir, assetDir)
          copyDirectory(sourceDir, outputDir)

          console.log(
            `已同步小程序静态资源: ${assetDir} -> ${relative(__dirname, outputDir)} (${countFiles(outputDir)} 个文件)`
          )
        })
      }
    }
  ],
  server: {
    port: 3000,
    open: false
  }
})

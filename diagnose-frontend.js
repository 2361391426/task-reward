#!/usr/bin/env node

console.log('🔍 诊断前端问题...\n')

const fs = require('fs')
const path = require('path')

// 检查商家端
console.log('📦 检查商家端 (merchant-admin)...')

const merchantPath = path.join(__dirname, 'merchant-admin')

// 1. 检查目录
if (!fs.existsSync(merchantPath)) {
  console.log('❌ merchant-admin 目录不存在')
  process.exit(1)
}
console.log('✅ merchant-admin 目录存在')

// 2. 检查 package.json
const packagePath = path.join(merchantPath, 'package.json')
if (!fs.existsSync(packagePath)) {
  console.log('❌ package.json 不存在')
  process.exit(1)
}
console.log('✅ package.json 存在')

// 3. 检查 node_modules
const nodeModulesPath = path.join(merchantPath, 'node_modules')
if (!fs.existsSync(nodeModulesPath)) {
  console.log('❌ node_modules 不存在，需要运行: npm install')
  process.exit(1)
}
console.log('✅ node_modules 存在')

// 4. 检查源码目录
const srcPath = path.join(merchantPath, 'src')
if (!fs.existsSync(srcPath)) {
  console.log('❌ src 目录不存在')
  process.exit(1)
}
console.log('✅ src 目录存在')

// 5. 检查关键文件
const keyFiles = [
  'src/main.js',
  'src/App.vue',
  'src/router/index.js',
  'src/views/Login.vue',
  'src/views/Dashboard.vue',
  'src/views/Tasks.vue',
  'src/views/Submissions.vue',
  'index.html',
  'vite.config.js'
]

let allFilesExist = true
keyFiles.forEach(file => {
  const filePath = path.join(merchantPath, file)
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`)
  } else {
    console.log(`❌ ${file} 不存在`)
    allFilesExist = false
  }
})

if (!allFilesExist) {
  console.log('\n❌ 有文件缺失')
  process.exit(1)
}

// 6. 检查 vite.config.js
console.log('\n📝 检查 vite.config.js...')
const viteConfigPath = path.join(merchantPath, 'vite.config.js')
const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8')
console.log(viteConfig)

// 7. 检查 .env
console.log('\n📝 检查 .env...')
const envPath = path.join(merchantPath, '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  console.log(envContent)
} else {
  console.log('⚠️  .env 文件不存在')
}

console.log('\n✅ 所有检查通过！')
console.log('\n🚀 启动命令:')
console.log('cd merchant-admin')
console.log('npm run dev')
console.log('\n然后访问: http://localhost:3000')

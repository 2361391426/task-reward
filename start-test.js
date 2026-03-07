#!/usr/bin/env node

console.log('🚀 开始安装和测试项目...\n')

const { execSync } = require('child_process')
const path = require('path')

// 1. 安装后端依赖
console.log('📦 安装后端依赖...')
try {
  execSync('npm install', {
    cwd: path.join(__dirname, 'task-reward-backend'),
    stdio: 'inherit'
  })
  console.log('✅ 后端依赖安装完成\n')
} catch (error) {
  console.error('❌ 后端依赖安装失败')
  process.exit(1)
}

// 2. 启动测试服务器
console.log('🌐 启动测试服务器...')
console.log('访问: http://localhost:3001\n')

require('./task-reward-backend/server-local.js')

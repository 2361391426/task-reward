const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..')

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return

  fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) return

    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  })
}

loadEnvFile(path.join(rootDir, '.env.production'))

const manifestPath = path.join(rootDir, 'manifest.json')
const projectConfigPath = path.join(rootDir, 'project.config.json')

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const manifest = readJson(manifestPath)
const projectConfig = readJson(projectConfigPath)

const errors = []

const addError = (message) => {
  errors.push(message)
}

const appidCandidates = [
  { label: 'manifest.appid', value: manifest.appid },
  { label: 'manifest.mp-weixin.appid', value: manifest['mp-weixin'] && manifest['mp-weixin'].appid },
  { label: 'project.config.appid', value: projectConfig.appid }
]

appidCandidates.forEach(({ label, value }) => {
  if (!value || value === 'touristappid') {
    addError(`${label} must be set to a real WeChat AppID`)
  }
})

const apiBaseUrl = process.env.VITE_API_BASE_URL || ''
const uploadUrl = process.env.VITE_UPLOAD_URL || ''

if (!apiBaseUrl) {
  addError('VITE_API_BASE_URL is required for release builds')
} else if (!/^https:\/\//i.test(apiBaseUrl)) {
  addError('VITE_API_BASE_URL must use https in release builds')
}

if (uploadUrl && !/^https:\/\//i.test(uploadUrl)) {
  addError('VITE_UPLOAD_URL must use https in release builds')
}

if (errors.length > 0) {
  console.error('Release configuration check failed:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('Release configuration check passed.')

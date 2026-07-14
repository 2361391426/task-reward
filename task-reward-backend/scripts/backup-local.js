const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..')
const dataFile = path.join(rootDir, 'data.json')
const uploadsDir = path.join(rootDir, 'uploads')
const backupsDir = path.join(rootDir, 'backups')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const targetDir = path.join(backupsDir, stamp)

if (!fs.existsSync(dataFile)) {
  console.error('data.json not found. Nothing to back up.')
  process.exit(1)
}

fs.mkdirSync(targetDir, { recursive: true })
fs.copyFileSync(dataFile, path.join(targetDir, 'data.json'))

if (fs.existsSync(uploadsDir)) {
  fs.cpSync(uploadsDir, path.join(targetDir, 'uploads'), { recursive: true })
}

const manifest = {
  created_at: new Date().toISOString(),
  source: rootDir,
  includes: {
    data_json: true,
    uploads: fs.existsSync(uploadsDir)
  }
}

fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

console.log(`Backup created at ${targetDir}`)

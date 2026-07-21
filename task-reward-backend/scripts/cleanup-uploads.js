require('dotenv').config({ path: '.env.scf' })
require('dotenv').config({ path: '.env' })

const path = require('path')
const { cleanupUploads } = require('../lib/upload-cleanup')

const parseArgs = (argv) => {
  const result = {
    orphanRetentionHours: 12,
    uploadDir: path.join(__dirname, '../uploads')
  }

  argv.forEach((arg) => {
    if (arg === '--weekly') {
      result.orphanRetentionHours = 7 * 24
      return
    }

    const [key, value] = String(arg).split('=')
    if (key === '--orphan-retention-hours' && value) {
      const parsed = Number(value)
      if (Number.isFinite(parsed) && parsed > 0) {
        result.orphanRetentionHours = parsed
      }
      return
    }

    if (key === '--upload-dir' && value) {
      result.uploadDir = path.resolve(value)
    }
  })

  return result
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const result = await cleanupUploads({
    uploadDir: options.uploadDir,
    now: new Date(),
    orphanRetentionHours: options.orphanRetentionHours
  })

  console.log(
    `清理完成。本地删除 ${result.local.removed} 个，保护 ${result.local.protected} 个，扫描 ${result.local.scanned} 个；` +
    `R2 删除 ${result.r2.removed} 个，保护 ${result.r2.protected} 个，扫描 ${result.r2.scanned} 个。`
  )

  if (result.r2.skipped) {
    console.log('R2 未配置，已跳过远程对象清理。')
  }
}

main().catch((error) => {
  console.error('上传文件清理失败:', error)
  process.exit(1)
})

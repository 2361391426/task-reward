const path = require('path')
const { cleanupUploadDirectory } = require('../lib/upload-cleanup')

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
  const result = await cleanupUploadDirectory({
    uploadDir: options.uploadDir,
    now: new Date(),
    orphanRetentionHours: options.orphanRetentionHours
  })

  console.log(
    `Cleanup complete. Removed ${result.removed} upload files, protected ${result.protected} files, scanned ${result.scanned}.`
  )
}

main().catch((error) => {
  console.error('Cleanup failed:', error)
  process.exit(1)
})

const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..')
const sourceDir = path.join(rootDir, 'dist', 'build', 'mp-weixin')
const targetDir = path.join(rootDir, 'dist', 'dev', 'mp-weixin')
const staticImagesDir = path.join(rootDir, 'static', 'images')
const assetsDirName = 'assets'

const copyImageAssetsFromManifest = (outputDir) => {
  const assetsManifest = path.join(outputDir, 'common', 'assets.js')
  if (!fs.existsSync(assetsManifest) || !fs.existsSync(staticImagesDir)) {
    return
  }

  const manifestText = fs.readFileSync(assetsManifest, 'utf8')
  const assetMatches = [...manifestText.matchAll(/\/assets\/([^/"]+)\.png/g)]
  if (!assetMatches.length) {
    return
  }

  const outputAssetsDir = path.join(outputDir, assetsDirName)
  fs.mkdirSync(outputAssetsDir, { recursive: true })

  for (const match of assetMatches) {
    const assetFileName = `${match[1]}.png`
    const baseName = assetFileName.replace(/\.[^.]+\.png$/, '.png')
    const sourceCandidates = [
      path.join(staticImagesDir, baseName),
      path.join(staticImagesDir, baseName.replace(/\.[^.]+\.png$/, '.png'))
    ]

    const sourceFile = sourceCandidates.find(candidate => fs.existsSync(candidate))
    if (!sourceFile) {
      continue
    }

    const targetFile = path.join(outputAssetsDir, assetFileName)
    fs.copyFileSync(sourceFile, targetFile)
  }
}

const copyRecursive = (source, target) => {
  const stat = fs.statSync(source)

  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true })
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry))
    }
    return
  }

  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(source, target)
}

if (!fs.existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`)
  process.exit(1)
}

copyRecursive(sourceDir, targetDir)
copyImageAssetsFromManifest(sourceDir)
copyRecursive(sourceDir, targetDir)
console.log(`Synced miniapp output: ${sourceDir} -> ${targetDir}`)

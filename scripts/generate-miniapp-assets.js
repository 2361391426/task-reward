const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const root = path.resolve(__dirname, '..')
const staticRoot = path.join(root, 'static')
const imagesRoot = path.join(staticRoot, 'images')
const tabbarRoot = path.join(staticRoot, 'tabbar')

fs.mkdirSync(imagesRoot, { recursive: true })
fs.mkdirSync(tabbarRoot, { recursive: true })

function rgba(hex, alpha = 255) {
  if (hex && typeof hex === 'object') {
    return {
      r: hex.r,
      g: hex.g,
      b: hex.b,
      a: hex.a === undefined ? alpha : hex.a
    }
  }
  const value = hex.replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
    a: alpha
  }
}

function createPng(width, height) {
  return new PNG({ width, height })
}

function blend(dst, src) {
  const sa = src.a / 255
  const da = dst[3] / 255
  const outA = sa + da * (1 - sa)
  if (outA === 0) return [0, 0, 0, 0]
  const outR = Math.round((src.r * sa + dst[0] * da * (1 - sa)) / outA)
  const outG = Math.round((src.g * sa + dst[1] * da * (1 - sa)) / outA)
  const outB = Math.round((src.b * sa + dst[2] * da * (1 - sa)) / outA)
  return [outR, outG, outB, Math.round(outA * 255)]
}

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return
  const idx = (png.width * y + x) << 2
  const dst = [
    png.data[idx],
    png.data[idx + 1],
    png.data[idx + 2],
    png.data[idx + 3]
  ]
  const out = blend(dst, color)
  png.data[idx] = out[0]
  png.data[idx + 1] = out[1]
  png.data[idx + 2] = out[2]
  png.data[idx + 3] = out[3]
}

function fillSolid(png, color) {
  const px = rgba(color)
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      setPixel(png, x, y, px)
    }
  }
}

function fillGradient(png, topColor, bottomColor) {
  const top = rgba(topColor)
  const bottom = rgba(bottomColor)
  for (let y = 0; y < png.height; y++) {
    const t = png.height === 1 ? 0 : y / (png.height - 1)
    const color = {
      r: Math.round(top.r + (bottom.r - top.r) * t),
      g: Math.round(top.g + (bottom.g - top.g) * t),
      b: Math.round(top.b + (bottom.b - top.b) * t),
      a: Math.round(top.a + (bottom.a - top.a) * t)
    }
    for (let x = 0; x < png.width; x++) {
      setPixel(png, x, y, color)
    }
  }
}

function fillRadialGradient(png, centerX, centerY, radius, innerColor, outerColor) {
  const inner = rgba(innerColor)
  const outer = rgba(outerColor)
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const dx = x - centerX
      const dy = y - centerY
      const t = Math.min(Math.sqrt(dx * dx + dy * dy) / radius, 1)
      const color = {
        r: Math.round(inner.r + (outer.r - inner.r) * t),
        g: Math.round(inner.g + (outer.g - inner.g) * t),
        b: Math.round(inner.b + (outer.b - inner.b) * t),
        a: Math.round(inner.a + (outer.a - inner.a) * t)
      }
      setPixel(png, x, y, color)
    }
  }
}

function fillCircle(png, cx, cy, radius, color) {
  const px = rgba(color)
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(png, x, y, px)
      }
    }
  }
}

function strokeCircle(png, cx, cy, radius, thickness, color) {
  const px = rgba(color)
  const inner = (radius - thickness) * (radius - thickness)
  const outer = radius * radius
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = dx * dx + dy * dy
      if (dist <= outer && dist >= inner) {
        setPixel(png, x, y, px)
      }
    }
  }
}

function fillRoundRect(png, x, y, w, h, r, color) {
  const px = rgba(color)
  for (let yy = Math.floor(y); yy < Math.ceil(y + h); yy++) {
    for (let xx = Math.floor(x); xx < Math.ceil(x + w); xx++) {
      const dx = xx - x
      const dy = yy - y
      const withinX = dx >= r && dx < w - r
      const withinY = dy >= r && dy < h - r
      const cornerDx = dx < r ? r - dx : dx - (w - r - 1)
      const cornerDy = dy < r ? r - dy : dy - (h - r - 1)
      const inCorner = cornerDx * cornerDx + cornerDy * cornerDy <= r * r
      if (withinX || withinY || inCorner) {
        setPixel(png, xx, yy, px)
      }
    }
  }
}

function strokeRoundRect(png, x, y, w, h, r, thickness, color) {
  const px = rgba(color)
  for (let yy = Math.floor(y); yy < Math.ceil(y + h); yy++) {
    for (let xx = Math.floor(x); xx < Math.ceil(x + w); xx++) {
      const dx = xx - x
      const dy = yy - y
      const withinOuterX = dx >= 0 && dx < w
      const withinOuterY = dy >= 0 && dy < h
      if (!withinOuterX || !withinOuterY) continue
      const innerX = dx >= thickness && dx < w - thickness
      const innerY = dy >= thickness && dy < h - thickness
      const cornerDx = dx < r ? r - dx : dx - (w - r - 1)
      const cornerDy = dy < r ? r - dy : dy - (h - r - 1)
      const dist = cornerDx * cornerDx + cornerDy * cornerDy
      const outer = r * r
      const inner = (r - thickness) * (r - thickness)
      if ((innerX && innerY) || (dist <= outer && dist >= inner)) {
        setPixel(png, xx, yy, px)
      }
    }
  }
}

function drawLine(png, x0, y0, x1, y1, thickness, color) {
  const px = rgba(color)
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  let x = x0
  let y = y0
  while (true) {
    fillCircle(png, x, y, thickness / 2, color)
    if (x === x1 && y === y1) break
    const e2 = err * 2
    if (e2 > -dy) {
      err -= dy
      x += sx
    }
    if (e2 < dx) {
      err += dx
      y += sy
    }
  }
}

function exportPng(png, filePath) {
  fs.writeFileSync(filePath, PNG.sync.write(png))
}

function makeTaskIcon(active = false) {
  const png = createPng(72, 72)
  png.data.fill(0)
  if (active) {
    fillRoundRect(png, 8, 8, 56, 56, 18, '#667EEA')
    fillRoundRect(png, 11, 11, 50, 50, 15, '#7C5CFF')
    fillRoundRect(png, 17, 17, 38, 38, 11, '#FFFFFF')
    strokeRoundRect(png, 17, 17, 38, 38, 11, 2, '#EDEBFF')
    drawLine(png, 24, 29, 31, 36, 4, '#667EEA')
    drawLine(png, 31, 36, 47, 22, 4, '#667EEA')
    drawLine(png, 24, 22, 47, 22, 3, '#D8DDFD')
    drawLine(png, 24, 40, 47, 40, 3, '#D8DDFD')
  } else {
    strokeRoundRect(png, 16, 14, 40, 44, 11, 3, '#9AA3AF')
    drawLine(png, 24, 26, 40, 26, 3, '#9AA3AF')
    drawLine(png, 24, 35, 40, 35, 3, '#9AA3AF')
    drawLine(png, 24, 44, 36, 44, 3, '#9AA3AF')
    drawLine(png, 27, 27, 31, 31, 4, '#9AA3AF')
    drawLine(png, 31, 31, 38, 22, 4, '#9AA3AF')
  }
  return png
}

function makeUserIcon(active = false) {
  const png = createPng(72, 72)
  png.data.fill(0)
  if (active) {
    fillRoundRect(png, 8, 8, 56, 56, 18, '#667EEA')
    fillRoundRect(png, 11, 11, 50, 50, 15, '#7C5CFF')
    fillCircle(png, 36, 27, 10, '#FFFFFF')
    fillRoundRect(png, 21, 38, 30, 16, 8, '#FFFFFF')
  } else {
    strokeCircle(png, 36, 24, 10, 3, '#9AA3AF')
    strokeRoundRect(png, 20, 38, 32, 18, 8, 3, '#9AA3AF')
  }
  return png
}

function makeAvatar() {
  const png = createPng(160, 160)
  fillRadialGradient(png, 54, 48, 130, '#E0E7FF', '#667EEA')
  fillCircle(png, 80, 80, 72, rgba('#FFFFFF', 26))
  fillCircle(png, 80, 80, 66, rgba('#7C5CFF', 38))
  fillCircle(png, 80, 66, 26, '#FFFFFF')
  fillRoundRect(png, 48, 94, 64, 36, 18, '#FFFFFF')
  fillCircle(png, 80, 80, 4, '#E0E7FF')
  return png
}

function makeHeroTask() {
  const png = createPng(320, 220)
  fillGradient(png, '#EEF2FF', '#DDE7FF')
  fillCircle(png, 260, 42, 40, rgba('#A5B4FC', 120))
  fillCircle(png, 248, 50, 18, rgba('#FFFFFF', 180))
  fillRoundRect(png, 58, 54, 178, 116, 20, '#FFFFFF')
  strokeRoundRect(png, 58, 54, 178, 116, 20, 3, '#D9E2FF')
  fillRoundRect(png, 76, 76, 120, 16, 8, '#C7D2FE')
  fillRoundRect(png, 76, 106, 104, 14, 7, '#DDE4FF')
  fillRoundRect(png, 76, 134, 88, 14, 7, '#E9EDFF')
  fillRoundRect(png, 206, 84, 58, 76, 16, '#667EEA')
  drawLine(png, 220, 118, 232, 130, 5, '#FFFFFF')
  drawLine(png, 232, 130, 248, 106, 5, '#FFFFFF')
  fillCircle(png, 252, 52, 5, '#7C5CFF')
  fillCircle(png, 36, 44, 4, '#7C5CFF')
  fillCircle(png, 276, 160, 6, '#A5B4FC')
  return png
}

function makeHeroWallet() {
  const png = createPng(320, 220)
  fillGradient(png, '#F5F3FF', '#E9E7FF')
  fillCircle(png, 58, 50, 30, rgba('#C4B5FD', 160))
  fillCircle(png, 276, 54, 42, rgba('#93C5FD', 120))
  fillRoundRect(png, 58, 70, 184, 96, 24, '#FFFFFF')
  strokeRoundRect(png, 58, 70, 184, 96, 24, 3, '#E0D9FF')
  fillRoundRect(png, 82, 95, 92, 22, 11, '#C7D2FE')
  fillRoundRect(png, 82, 126, 124, 18, 9, '#E9E4FF')
  fillRoundRect(png, 210, 94, 54, 68, 18, '#7C5CFF')
  fillCircle(png, 237, 128, 10, '#FFFFFF')
  fillCircle(png, 95, 28, 4, '#7C5CFF')
  fillCircle(png, 268, 170, 5, '#667EEA')
  return png
}

function makeEmptyTask() {
  const png = createPng(320, 220)
  fillGradient(png, '#F8FAFF', '#EEF2FF')
  fillCircle(png, 272, 48, 34, rgba('#C7D2FE', 120))
  fillRoundRect(png, 54, 58, 174, 104, 22, '#FFFFFF')
  strokeRoundRect(png, 54, 58, 174, 104, 22, 3, '#DCE4FF')
  fillRoundRect(png, 72, 78, 90, 14, 7, '#C7D2FE')
  fillRoundRect(png, 72, 104, 128, 14, 7, '#E2E8FF')
  fillRoundRect(png, 72, 130, 110, 14, 7, '#EEF2FF')
  fillRoundRect(png, 206, 92, 58, 74, 18, '#667EEA')
  drawLine(png, 220, 125, 232, 137, 5, '#FFFFFF')
  drawLine(png, 232, 137, 248, 113, 5, '#FFFFFF')
  fillCircle(png, 28, 46, 4, '#7C5CFF')
  fillCircle(png, 34, 156, 5, '#A5B4FC')
  return png
}

function makeEmptySubmission() {
  const png = createPng(320, 220)
  fillGradient(png, '#FFF8F3', '#FFF0E3')
  fillCircle(png, 54, 50, 28, rgba('#FDBA74', 140))
  fillRoundRect(png, 68, 52, 160, 118, 22, '#FFFFFF')
  strokeRoundRect(png, 68, 52, 160, 118, 22, 3, '#F5D0B4')
  fillRoundRect(png, 90, 74, 116, 16, 8, '#FED7AA')
  fillRoundRect(png, 90, 102, 88, 16, 8, '#FFE4C7')
  fillRoundRect(png, 90, 130, 104, 16, 8, '#FFF1E2')
  fillCircle(png, 222, 106, 28, '#F97316')
  drawLine(png, 213, 106, 221, 114, 5, '#FFFFFF')
  drawLine(png, 221, 114, 233, 98, 5, '#FFFFFF')
  fillCircle(png, 266, 54, 4, '#F97316')
  fillCircle(png, 38, 156, 5, '#FDBA74')
  return png
}

function makeEmptyUpload() {
  const png = createPng(320, 220)
  fillGradient(png, '#F7FBFF', '#EAF4FF')
  fillCircle(png, 52, 54, 26, rgba('#93C5FD', 150))
  fillRoundRect(png, 76, 60, 136, 96, 22, '#FFFFFF')
  strokeRoundRect(png, 76, 60, 136, 96, 22, 3, '#CFE3FF')
  fillRoundRect(png, 96, 78, 96, 62, 14, '#DBEAFE')
  fillCircle(png, 122, 102, 10, '#60A5FA')
  fillCircle(png, 156, 92, 8, '#3B82F6')
  drawLine(png, 122, 102, 156, 92, 5, '#FFFFFF')
  fillRoundRect(png, 214, 82, 46, 60, 16, '#7C5CFF')
  fillCircle(png, 237, 112, 10, '#FFFFFF')
  drawLine(png, 229, 112, 245, 112, 4, '#7C5CFF')
  drawLine(png, 237, 104, 237, 120, 4, '#7C5CFF')
  return png
}

exportPng(makeTaskIcon(false), path.join(tabbarRoot, 'task.png'))
exportPng(makeTaskIcon(true), path.join(tabbarRoot, 'task-active.png'))
exportPng(makeUserIcon(false), path.join(tabbarRoot, 'my.png'))
exportPng(makeUserIcon(true), path.join(tabbarRoot, 'my-active.png'))

exportPng(makeAvatar(), path.join(imagesRoot, 'default-avatar.png'))
exportPng(makeHeroTask(), path.join(imagesRoot, 'hero-task.png'))
exportPng(makeHeroWallet(), path.join(imagesRoot, 'hero-wallet.png'))
exportPng(makeEmptyTask(), path.join(imagesRoot, 'empty-task.png'))
exportPng(makeEmptySubmission(), path.join(imagesRoot, 'empty-submission.png'))
exportPng(makeEmptyUpload(), path.join(imagesRoot, 'empty-upload.png'))

console.log('miniapp assets generated')

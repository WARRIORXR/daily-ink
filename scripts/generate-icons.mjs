// Generates PWA icons as real PNGs using only Node built-ins (zlib).
// Usage: node scripts/generate-icons.mjs

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')

// --- Minimal PNG encoder ----------------------------------------------------

const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0 // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * stride + 1)
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// --- Drawing helpers --------------------------------------------------------

function setPixel(px, size, x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= size || y >= size) return
  const i = (y * size + x) * 4
  px[i] = r
  px[i + 1] = g
  px[i + 2] = b
  px[i + 3] = a
}

function inRoundRect(x, y, rx, ry, w, h, r) {
  if (x < rx || x > rx + w || y < ry || y > ry + h) return false
  const cx = Math.max(rx + r, Math.min(x, rx + w - r))
  const cy = Math.max(ry + r, Math.min(y, ry + h - r))
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

function fillRoundRect(px, size, rx, ry, w, h, r, color) {
  for (let y = Math.floor(ry); y < ry + h; y++) {
    for (let x = Math.floor(rx); x < rx + w; x++) {
      if (inRoundRect(x + 0.5, y + 0.5, rx, ry, w, h, r)) setPixel(px, size, x, y, color)
    }
  }
}

function fillRect(px, size, rx, ry, w, h, color) {
  fillRoundRect(px, size, rx, ry, w, h, 0, color)
}

// --- Icon art ---------------------------------------------------------------

const BG = [28, 25, 23, 255] // stone-900
const PAPER = [250, 246, 239, 255] // paper
const LINE = [214, 205, 192, 255] // stone-300
const ACCENT = [180, 83, 9, 255] // amber-700

function drawIcon(size, { maskable = false } = {}) {
  const px = new Uint8Array(size * size * 4)
  for (let i = 0; i < px.length; i += 4) {
    px[i] = BG[0]
    px[i + 1] = BG[1]
    px[i + 2] = BG[2]
    px[i + 3] = BG[3]
  }

  // Maskable icons need a safe zone (motif inside the center ~66%).
  const m = maskable ? 0.64 : 0.82
  const pw = size * 0.6 * m
  const ph = size * 0.74 * m
  const r = size * 0.07 * m
  const px0 = (size - pw) / 2
  const py0 = (size - ph) / 2 - size * 0.015 * m

  fillRoundRect(px, size, px0, py0, pw, ph, r, PAPER)

  const lineH = Math.max(2, size * 0.05 * m)
  const gap = size * 0.03 * m
  const widths = [0.46, 0.32, 0.4].map((w) => w * size * m)
  let ly = py0 + ph * 0.18
  for (const w of widths) {
    fillRect(px, size, px0 + pw * 0.14, ly, w, lineH, LINE)
    ly += lineH + gap
  }

  fillRect(px, size, px0 + pw * 0.14, py0 + ph * 0.86, size * 0.24 * m, size * 0.055 * m, ACCENT)

  return encodePNG(size, size, px)
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'icon-192.png'), drawIcon(192))
writeFileSync(join(outDir, 'icon-512.png'), drawIcon(512))
writeFileSync(join(outDir, 'maskable-192.png'), drawIcon(192, { maskable: true }))
writeFileSync(join(outDir, 'maskable-512.png'), drawIcon(512, { maskable: true }))
writeFileSync(join(outDir, 'apple-touch-icon.png'), drawIcon(180))

console.log('Icons written to public/icons/')
// Generates the app icon (build/icon.png) from the same pixel templates the
// game uses, so the icon is original art too. Run: npm run icon
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { BODIES, HEADS, LEGS } from '../src/renderer/src/game/art/characterTemplates.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SIZE = 32 // logical pixels
const SCALE = 32 // 32 × 32 = 1024 px

const hex = (value) => {
  const n = parseInt(value.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
}
const shade = (value, f) => {
  const [r, g, b] = hex(value)
  return `#${[r, g, b].map((c) => Math.round(c * f).toString(16).padStart(2, '0')).join('')}`
}

const pixels = Array.from({ length: SIZE * SIZE }, () => [0, 0, 0, 0])
const set = (x, y, color) => {
  if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) pixels[y * SIZE + x] = typeof color === 'string' ? hex(color) : color
}
const paint = (rows, palette, ox, oy) =>
  rows.forEach((row, y) => [...row].forEach((ch, x) => palette[ch] && set(ox + x, oy + y, palette[ch])))

// Rounded square with a sky and a strip of grass.
const RADIUS = 6
const inside = (x, y) => {
  const cx = Math.min(Math.max(x + 0.5, RADIUS), SIZE - RADIUS)
  const cy = Math.min(Math.max(y + 0.5, RADIUS), SIZE - RADIUS)
  return (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= RADIUS * RADIUS
}
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    if (!inside(x, y)) continue
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
    if (edge) set(x, y, '#2a1f2d')
    else if (y < 22) set(x, y, y < 8 ? '#ffd27f' : y < 15 ? '#ffc061' : '#ffb454')
    else set(x, y, (x * 7 + y * 3) % 5 === 0 ? '#58a94b' : '#6cbf59')
  }
}

// The player character (front view, with the cap).
const look = { skin: '#f3c391', cap: '#e2574c', shirt: '#4f8fe0', pants: '#2b2f3a', shoes: '#e9e9ee' }
const palette = {
  k: '#2a1f2d',
  e: '#2a1f2d',
  h: '#4a3326',
  H: shade('#4a3326', 0.72),
  s: look.skin,
  S: shade(look.skin, 0.84),
  c: '#f3a08a',
  t: look.shirt,
  T: shade(look.shirt, 0.78),
  p: look.pants,
  P: shade(look.pants, 0.78),
  b: look.shoes,
  a: look.cap,
  A: shade(look.cap, 0.72)
}
const cx = 4
const cy = 6
paint(BODIES.down, palette, cx, cy + 13)
paint(LEGS.frontIdle, palette, cx, cy + 20)
paint(HEADS[3].down, palette, cx, cy)

// Speech bubble with three dots.
const bubble = [
  '..kkkkkkkkkk..',
  '.kwwwwwwwwwwk.',
  'kwwwwwwwwwwwwk',
  'kwwdwwdwwdwwwk',
  'kwwdwwdwwdwwwk',
  'kwwwwwwwwwwwwk',
  '.kwwwwwwwwwwk.',
  '..kkkkwwkkkk..',
  '.....kwk......',
  '......k.......'
]
paint(bubble, { k: '#2a1f2d', w: '#ffffff', d: '#2a1f2d' }, 16, 3)

// Encode as PNG (RGBA, no filtering).
const width = SIZE * SCALE
const raw = Buffer.alloc((width * 4 + 1) * width)
for (let y = 0; y < width; y++) {
  const rowStart = y * (width * 4 + 1)
  for (let x = 0; x < width; x++) {
    const [r, g, b, a] = pixels[Math.floor(y / SCALE) * SIZE + Math.floor(x / SCALE)]
    raw.set([r, g, b, a], rowStart + 1 + x * 4)
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buffer) => {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}
const header = Buffer.alloc(13)
header.writeUInt32BE(width, 0)
header.writeUInt32BE(width, 4)
header.set([8, 6, 0, 0, 0], 8)
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

for (const target of ['build/icon.png', 'resources/icon.png']) {
  const file = resolve(root, target)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, png)
  console.info(`wrote ${target} (${width}×${width})`)
}

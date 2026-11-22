/**
 * Tiny pixel-painting toolkit. All of AgentVille's art is drawn with these
 * helpers at boot time, so the repository ships no third-party images.
 */

export type Ctx = CanvasRenderingContext2D

export function makeCanvas(width: number, height: number): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: false })
  if (!ctx) throw new Error('2D canvas not available')
  ctx.imageSmoothingEnabled = false
  return [canvas, ctx]
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

export function px(ctx: Ctx, x: number, y: number, color: string): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}

/** 1px border around a rectangle (inside its bounds). */
export function frame(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  rect(ctx, x, y, w, 1, color)
  rect(ctx, x, y + h - 1, w, 1, color)
  rect(ctx, x, y, 1, h, color)
  rect(ctx, x + w - 1, y, 1, h, color)
}

/** Pixel-perfect filled ellipse centered at (cx, cy). */
export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx
      const dy = (y + 0.5 - cy) / ry
      if (dx * dx + dy * dy <= 1) ctx.fillRect(x, y, 1, 1)
    }
  }
}

export type Palette = Record<string, string | undefined>

/**
 * Paints a string template: one string per row, one character per pixel.
 * `.` and space are transparent; other characters are looked up in the palette.
 */
export function paintTemplate(
  ctx: Ctx,
  rows: readonly string[],
  palette: Palette,
  ox = 0,
  oy = 0,
  flipX = false
): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y] ?? ''
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === undefined || ch === '.' || ch === ' ') continue
      const color = palette[ch]
      if (!color) continue
      const dx = flipX ? row.length - 1 - x : x
      ctx.fillStyle = color
      ctx.fillRect(ox + dx, oy + y, 1, 1)
    }
  }
}

/** Deterministic PRNG so the generated world looks the same on every launch. */
export function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

/* ---------------------------------------------------------------- color -- */

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const n = parseInt(value.length === 3 ? value.replace(/./g, '$&$&') : value, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)))
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`
}

/** Multiplies a color's channels (0.8 = 20% darker, 1.2 = lighter). */
export function shade(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex)
  if (factor <= 1) return rgbToHex(r * factor, g * factor, b * factor)
  const t = factor - 1
  return rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t)
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

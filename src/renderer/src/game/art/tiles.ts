import { type Ctx, makeCanvas, px, rect, rng, randInt, shade } from './canvas'
import { C } from './palette'

export const TILE = 16

/** Tile indices inside the generated tileset. */
export const T = {
  GRASS0: 0,
  GRASS1: 1,
  GRASS2: 2,
  FLOWER_PINK: 3,
  FLOWER_YELLOW: 4,
  FLOWER_BLUE: 5,
  FOREST: 6,
  PATH0: 7,
  PATH1: 8,
  FLOOR0: 9,
  FLOOR1: 10,
  CAP: 11,
  WALL_UP: 12,
  WALL_LOW: 13,
  WIN_UP: 14,
  WIN_LOW: 15,
  EXT: 16,
  MAT: 17,
  /** 16 variants follow: WATER + mask, where the mask marks land neighbors. */
  WATER: 18
} as const

export const WATER_N = 1
export const WATER_E = 2
export const WATER_S = 4
export const WATER_W = 8

export const TILE_COUNT = T.WATER + 16
const COLUMNS = 16

export const SOLID_TILES: number[] = [
  T.FOREST,
  T.CAP,
  T.WALL_UP,
  T.WALL_LOW,
  T.WIN_UP,
  T.WIN_LOW,
  T.EXT,
  ...Array.from({ length: 16 }, (_, i) => T.WATER + i)
]

/* ---------------------------------------------------------------- tiles -- */

function grass(ctx: Ctx, ox: number, oy: number, seed: number, variant: number): void {
  const r = rng(seed)
  rect(ctx, ox, oy, TILE, TILE, C.grass)
  for (let i = 0; i < 9; i++) {
    px(ctx, ox + randInt(r, 0, 15), oy + randInt(r, 0, 15), r() < 0.55 ? C.grassDark : C.grassLight)
  }
  const tufts = variant === 0 ? 1 : variant === 1 ? 2 : 3
  for (let i = 0; i < tufts; i++) {
    const x = ox + randInt(r, 1, 12)
    const y = oy + randInt(r, 3, 14)
    px(ctx, x, y, C.grassDark)
    px(ctx, x + 1, y - 1, C.grassDark)
    px(ctx, x + 2, y, C.grassDark)
    if (variant === 2) px(ctx, x + 1, y - 2, C.grassLight)
  }
}

function flowers(ctx: Ctx, ox: number, oy: number, seed: number, petal: string): void {
  grass(ctx, ox, oy, seed, 0)
  const r = rng(seed + 7)
  const spots: Array<[number, number]> = [
    [randInt(r, 2, 5), randInt(r, 2, 5)],
    [randInt(r, 9, 13), randInt(r, 3, 6)],
    [randInt(r, 4, 8), randInt(r, 9, 13)],
    [randInt(r, 11, 13), randInt(r, 11, 13)]
  ]
  for (const [x, y] of spots) {
    px(ctx, ox + x - 1, oy + y + 1, C.leafDark)
    px(ctx, ox + x, oy + y - 1, petal)
    px(ctx, ox + x - 1, oy + y, petal)
    px(ctx, ox + x + 1, oy + y, petal)
    px(ctx, ox + x, oy + y + 1, petal)
    px(ctx, ox + x, oy + y, '#fff3a8')
  }
}

function forest(ctx: Ctx, ox: number, oy: number, seed: number): void {
  const r = rng(seed)
  rect(ctx, ox, oy, TILE, TILE, C.forest)
  for (let i = 0; i < 18; i++) {
    px(ctx, ox + randInt(r, 0, 15), oy + randInt(r, 0, 15), r() < 0.6 ? C.forestDark : C.forestLight)
  }
}

/** Cobblestones laid out so the pattern repeats seamlessly every 16px. */
function path(ctx: Ctx, ox: number, oy: number, seed: number): void {
  const r = rng(seed)
  rect(ctx, ox, oy, TILE, TILE, C.path)
  const rows: Array<{ y: number; h: number; gaps: number[] }> = [
    { y: 0, h: 5, gaps: [0, 6, 11] },
    { y: 5, h: 5, gaps: [3, 9, 14] },
    { y: 10, h: 6, gaps: [0, 5, 11] }
  ]
  for (const row of rows) {
    rect(ctx, ox, oy + row.y + row.h - 1, TILE, 1, C.pathGap)
    rect(ctx, ox, oy + row.y, TILE, 1, C.pathLight)
    for (const gx of row.gaps) {
      rect(ctx, ox + gx, oy + row.y, 1, row.h, C.pathGap)
      if (gx > 0) px(ctx, ox + gx - 1, oy + row.y + row.h - 2, C.pathDark)
    }
  }
  for (let i = 0; i < 6; i++) {
    px(ctx, ox + randInt(r, 0, 15), oy + randInt(r, 0, 15), r() < 0.5 ? C.pathDark : C.pathLight)
  }
}

function floor(ctx: Ctx, ox: number, oy: number, seed: number, seams: number[]): void {
  const r = rng(seed)
  rect(ctx, ox, oy, TILE, TILE, C.floor)
  for (let plank = 0; plank < 4; plank++) {
    const y = oy + plank * 4
    rect(ctx, ox, y, TILE, 1, C.floorLight)
    rect(ctx, ox, y + 3, TILE, 1, C.floorGap)
    const seam = seams[plank] ?? -1
    if (seam >= 0) rect(ctx, ox + seam, y, 1, 3, C.floorGap)
    for (let i = 0; i < 3; i++) px(ctx, ox + randInt(r, 0, 15), y + randInt(r, 1, 2), C.floorDark)
  }
}

function wallCap(ctx: Ctx, ox: number, oy: number): void {
  rect(ctx, ox, oy, TILE, TILE, C.wallCap)
  for (let y = 0; y < TILE; y += 4) {
    for (let x = (y / 4) % 2 === 0 ? 1 : 3; x < TILE; x += 4) px(ctx, ox + x, oy + y + 1, C.wallCapLight)
  }
}

function wallpaper(ctx: Ctx, ox: number, oy: number, y0: number, h: number): void {
  rect(ctx, ox, oy + y0, TILE, h, C.wallpaper)
  for (let x = 1; x < TILE; x += 4) rect(ctx, ox + x, oy + y0, 1, h, C.wallpaperStripe)
}

function wallUpper(ctx: Ctx, ox: number, oy: number): void {
  wallpaper(ctx, ox, oy, 0, TILE)
  rect(ctx, ox, oy, TILE, 2, C.crown)
  rect(ctx, ox, oy + 2, TILE, 1, C.crownDark)
}

function wallLower(ctx: Ctx, ox: number, oy: number): void {
  wallpaper(ctx, ox, oy, 0, 6)
  rect(ctx, ox, oy + 6, TILE, 1, C.wainscotLight)
  rect(ctx, ox, oy + 7, TILE, 1, C.wainscotDark)
  rect(ctx, ox, oy + 8, TILE, 5, C.wainscot)
  for (const x of [0, 8]) {
    rect(ctx, ox + x, oy + 8, 1, 5, C.wainscotDark)
    rect(ctx, ox + x + 1, oy + 8, 1, 5, C.wainscotLight)
  }
  rect(ctx, ox, oy + 13, TILE, 3, C.baseboard)
  rect(ctx, ox, oy + 13, TILE, 1, shade(C.baseboard, 1.25))
}

function windowUpper(ctx: Ctx, ox: number, oy: number): void {
  wallUpper(ctx, ox, oy)
  rect(ctx, ox + 2, oy + 4, 12, 12, C.frame)
  rect(ctx, ox + 3, oy + 5, 10, 11, C.glass)
  rect(ctx, ox + 3, oy + 5, 10, 2, C.glassDark)
  rect(ctx, ox + 7, oy + 5, 2, 11, C.frame)
  for (let i = 0; i < 4; i++) px(ctx, ox + 4 + i, oy + 11 - i, C.glassLight)
  px(ctx, ox + 10, oy + 9, C.glassLight)
  px(ctx, ox + 11, oy + 8, C.glassLight)
}

function windowLower(ctx: Ctx, ox: number, oy: number): void {
  wallLower(ctx, ox, oy)
  rect(ctx, ox + 2, oy, 12, 4, C.frame)
  rect(ctx, ox + 3, oy, 10, 3, C.glass)
  rect(ctx, ox + 7, oy, 2, 3, C.frame)
  px(ctx, ox + 4, oy + 1, C.glassLight)
  rect(ctx, ox + 1, oy + 4, 14, 2, C.frame)
  rect(ctx, ox + 1, oy + 6, 14, 1, C.frameShadow)
}

function extWall(ctx: Ctx, ox: number, oy: number, seed: number): void {
  const r = rng(seed)
  rect(ctx, ox, oy, TILE, TILE, C.mortar)
  for (let row = 0; row < 4; row++) {
    const y = oy + row * 4
    const offset = row % 2 === 0 ? 0 : 4
    for (let bx = -8; bx < TILE; bx += 8) {
      const x0 = Math.max(ox, ox + bx + offset)
      const x1 = Math.min(ox + TILE, ox + bx + offset + 7)
      if (x1 <= x0) continue
      const tone = r() < 0.2 ? C.brickDark : C.brick
      rect(ctx, x0, y, x1 - x0, 3, tone)
      rect(ctx, x0, y, x1 - x0, 1, C.brickLight)
    }
  }
}

function doormat(ctx: Ctx, ox: number, oy: number): void {
  path(ctx, ox, oy, 99)
  rect(ctx, ox + 1, oy + 2, 14, 12, C.mat)
  for (let y = 4; y < 13; y += 3) rect(ctx, ox + 2, oy + y, 12, 1, C.matLight)
}

function water(ctx: Ctx, ox: number, oy: number, mask: number): void {
  const r = rng(500 + mask)
  rect(ctx, ox, oy, TILE, TILE, C.water)
  for (let i = 0; i < 5; i++) {
    rect(ctx, ox + randInt(r, 2, 11), oy + randInt(r, 3, 12), randInt(r, 2, 3), 1, C.waterLight)
  }
  for (let i = 0; i < 6; i++) px(ctx, ox + randInt(r, 1, 14), oy + randInt(r, 1, 14), C.waterDeep)

  const n = (mask & WATER_N) !== 0
  const e = (mask & WATER_E) !== 0
  const s = (mask & WATER_S) !== 0
  const w = (mask & WATER_W) !== 0
  if (n) {
    rect(ctx, ox, oy + 2, TILE, 1, C.foam)
    rect(ctx, ox, oy, TILE, 2, C.sand)
  }
  if (s) {
    rect(ctx, ox, oy + 13, TILE, 1, C.foam)
    rect(ctx, ox, oy + 14, TILE, 2, C.sandDark)
  }
  if (w) {
    rect(ctx, ox + 2, oy, 1, TILE, C.foam)
    rect(ctx, ox, oy, 2, TILE, C.sand)
  }
  if (e) {
    rect(ctx, ox + 13, oy, 1, TILE, C.foam)
    rect(ctx, ox + 14, oy, 2, TILE, C.sand)
  }
  // Round off outer corners a little.
  const corner = (cx: number, cy: number, dx: number, dy: number): void => {
    px(ctx, ox + cx, oy + cy, C.sand)
    px(ctx, ox + cx + dx, oy + cy, C.sand)
    px(ctx, ox + cx, oy + cy + dy, C.sand)
  }
  if (n && w) corner(2, 2, 1, 1)
  if (n && e) corner(13, 2, -1, 1)
  if (s && w) corner(2, 13, 1, -1)
  if (s && e) corner(13, 13, -1, -1)
}

/** Draws the whole tileset onto one canvas (16 tiles per row). */
export function buildTileset(): HTMLCanvasElement {
  const rows = Math.ceil(TILE_COUNT / COLUMNS)
  const [canvas, ctx] = makeCanvas(COLUMNS * TILE, rows * TILE)
  const at = (index: number): [number, number] => [(index % COLUMNS) * TILE, Math.floor(index / COLUMNS) * TILE]

  const draw = (index: number, painter: (ox: number, oy: number) => void): void => {
    const [ox, oy] = at(index)
    painter(ox, oy)
  }

  draw(T.GRASS0, (x, y) => grass(ctx, x, y, 11, 0))
  draw(T.GRASS1, (x, y) => grass(ctx, x, y, 23, 1))
  draw(T.GRASS2, (x, y) => grass(ctx, x, y, 37, 2))
  draw(T.FLOWER_PINK, (x, y) => flowers(ctx, x, y, 41, C.pink))
  draw(T.FLOWER_YELLOW, (x, y) => flowers(ctx, x, y, 53, C.yellow))
  draw(T.FLOWER_BLUE, (x, y) => flowers(ctx, x, y, 67, C.blue))
  draw(T.FOREST, (x, y) => forest(ctx, x, y, 71))
  draw(T.PATH0, (x, y) => path(ctx, x, y, 83))
  draw(T.PATH1, (x, y) => path(ctx, x, y, 97))
  draw(T.FLOOR0, (x, y) => floor(ctx, x, y, 101, [5, -1, 12, -1]))
  draw(T.FLOOR1, (x, y) => floor(ctx, x, y, 113, [-1, 9, -1, 2]))
  draw(T.CAP, (x, y) => wallCap(ctx, x, y))
  draw(T.WALL_UP, (x, y) => wallUpper(ctx, x, y))
  draw(T.WALL_LOW, (x, y) => wallLower(ctx, x, y))
  draw(T.WIN_UP, (x, y) => windowUpper(ctx, x, y))
  draw(T.WIN_LOW, (x, y) => windowLower(ctx, x, y))
  draw(T.EXT, (x, y) => extWall(ctx, x, y, 127))
  draw(T.MAT, (x, y) => doormat(ctx, x, y))
  for (let mask = 0; mask < 16; mask++) draw(T.WATER + mask, (x, y) => water(ctx, x, y, mask))

  return canvas
}

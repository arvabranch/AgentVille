import { DESK_COUNT } from '@shared/constants'
import { rng } from './art/canvas'
import { T, TILE, WATER_E, WATER_N, WATER_S, WATER_W } from './art/tiles'

/**
 * Layout of the town: a small office (10 desks) surrounded by a garden.
 * Everything here is in tile coordinates unless a name says otherwise.
 */
export const MAP_W = 44
export const MAP_H = 30

export const BUILDING = {
  left: 10,
  right: 33,
  capTop: 4,
  floorTop: 7,
  floorBottom: 16,
  capBottom: 17,
  facade: 18,
  door: [21, 22] as const
}

const WINDOW_COLUMNS = new Set([14, 15, 23, 24, 28, 29])

/** Desk footprints (left tile). The agent stands on the row below. */
export const DESK_SLOTS: ReadonlyArray<{ x: number; y: number }> = (() => {
  const columns = [13, 17, 21, 25, 29]
  const slots = [...columns.map((x) => ({ x, y: 8 })), ...columns.map((x) => ({ x, y: 12 }))]
  return slots.slice(0, DESK_COUNT)
})()

/** Pixel position (feet) where the agent of a desk stands. */
export function agentSpot(deskIndex: number): { x: number; y: number } {
  const slot = DESK_SLOTS[deskIndex] ?? DESK_SLOTS[0] ?? { x: 13, y: 8 }
  return { x: (slot.x + 1) * TILE, y: (slot.y + 2) * TILE - 2 }
}

export const PLAYER_SPAWN = { x: 22 * TILE, y: 22 * TILE }

const POND: ReadonlyArray<readonly [row: number, from: number, to: number]> = [
  [21, 4, 7],
  [22, 3, 8],
  [23, 3, 8],
  [24, 4, 7]
]

const isPond = (x: number, y: number): boolean => POND.some(([row, from, to]) => row === y && x >= from && x <= to)

const isPath = (x: number, y: number): boolean => {
  const [d0, d1] = BUILDING.door
  if (y >= 19 && y <= 27 && (x === d0 || x === d1)) return true
  if (y >= 21 && y <= 24 && x >= 17 && x <= 26) return true // plaza
  return false
}

const FLOWER_BEDS: ReadonlyArray<readonly [x: number, y: number, tile: number]> = [
  ...[11, 12, 13, 14, 15, 16, 17, 18, 19].map((x) => [x, 19, x % 3 === 0 ? T.FLOWER_YELLOW : T.FLOWER_PINK] as const),
  ...[24, 25, 26, 27, 28, 29, 30, 31, 32].map((x) => [x, 19, x % 3 === 0 ? T.FLOWER_BLUE : T.FLOWER_PINK] as const),
  [4, 9, T.FLOWER_BLUE],
  [5, 9, T.FLOWER_PINK],
  [5, 10, T.FLOWER_YELLOW],
  [37, 18, T.FLOWER_YELLOW],
  [38, 18, T.FLOWER_PINK],
  [38, 19, T.FLOWER_BLUE],
  [9, 26, T.FLOWER_PINK],
  [10, 26, T.FLOWER_YELLOW],
  [33, 25, T.FLOWER_BLUE],
  [34, 25, T.FLOWER_PINK]
]

/** Builds the ground layer as a grid of tile indices. */
export function buildGround(): number[][] {
  const random = rng(2024)
  const grid: number[][] = []
  for (let y = 0; y < MAP_H; y++) {
    const row: number[] = []
    for (let x = 0; x < MAP_W; x++) {
      const roll = random()
      row.push(roll < 0.62 ? T.GRASS0 : roll < 0.88 ? T.GRASS1 : T.GRASS2)
    }
    grid.push(row)
  }
  const set = (x: number, y: number, tile: number): void => {
    const row = grid[y]
    if (row && x >= 0 && x < MAP_W) row[x] = tile
  }

  // Forest border.
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (y < BUILDING.capTop || y >= MAP_H - 2 || x < 2 || x >= MAP_W - 2) set(x, y, T.FOREST)
    }
  }

  // Paths and plaza.
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) if (isPath(x, y)) set(x, y, (x + y) % 3 === 0 ? T.PATH1 : T.PATH0)
  }

  for (const [x, y, tile] of FLOWER_BEDS) set(x, y, tile)

  // Pond with shore edges.
  for (const [row, from, to] of POND) {
    for (let x = from; x <= to; x++) {
      let mask = 0
      if (!isPond(x, row - 1)) mask |= WATER_N
      if (!isPond(x + 1, row)) mask |= WATER_E
      if (!isPond(x, row + 1)) mask |= WATER_S
      if (!isPond(x - 1, row)) mask |= WATER_W
      set(x, row, T.WATER + mask)
    }
  }

  // The office.
  const { left, right, capTop, floorTop, floorBottom, capBottom, facade, door } = BUILDING
  for (let x = left; x <= right; x++) {
    set(x, capTop, T.CAP)
    set(x, capBottom, door.includes(x as 21 | 22) ? T.FLOOR0 : T.CAP)
    set(x, facade, door.includes(x as 21 | 22) ? T.MAT : T.EXT)
  }
  for (let y = capTop + 1; y < capBottom; y++) {
    set(left, y, T.CAP)
    set(right, y, T.CAP)
  }
  for (let x = left + 1; x < right; x++) {
    const win = WINDOW_COLUMNS.has(x)
    set(x, capTop + 1, win ? T.WIN_UP : T.WALL_UP)
    set(x, capTop + 2, win ? T.WIN_LOW : T.WALL_LOW)
    for (let y = floorTop; y <= floorBottom; y++) set(x, y, (x + y) % 2 === 0 ? T.FLOOR0 : T.FLOOR1)
  }

  return grid
}

export interface Decoration {
  key: string
  /** Pixel position of the sprite's bottom-center. */
  x: number
  y: number
  /** Optional collision box (pixels, relative to the bottom-center). */
  block?: { w: number; h: number }
  /** Flat things like rugs lie under everything else. */
  flat?: boolean
}

const at = (tx: number, ty: number, dx = 0.5): { x: number; y: number } => ({ x: (tx + dx) * TILE, y: (ty + 1) * TILE })

/** Trees, furniture and other props. Positions are tile-based. */
export function buildDecorations(): Decoration[] {
  const random = rng(77)
  const list: Decoration[] = []
  const add = (key: string, tx: number, ty: number, block?: { w: number; h: number }, dx = 0.5): void => {
    list.push({ key, ...at(tx, ty, dx), block })
  }

  // Forest border: two staggered rows along the top, columns on the sides, a row at the bottom.
  const treeKey = (): string => {
    const roll = random()
    if (roll < 0.45) return `tree-pine-${roll < 0.25 ? 0 : 1}`
    return `tree-round-${roll < 0.8 ? 0 : roll < 0.93 ? 1 : 2}`
  }
  for (let x = 0; x < MAP_W; x += 2) {
    add(treeKey(), x, 1, undefined, 0.5 + (random() - 0.5) * 0.6)
    add(treeKey(), x + 1, 3, undefined, 0.5 + (random() - 0.5) * 0.6)
    add(treeKey(), x, MAP_H - 1, undefined, 0.5 + (random() - 0.5) * 0.6)
  }
  for (let y = 5; y < MAP_H - 1; y += 2) {
    add(treeKey(), 0, y, undefined, 1)
    add(treeKey(), MAP_W - 2, y, undefined, 1)
  }

  // Garden trees and bushes.
  const trunk = { w: 10, h: 6 }
  for (const [tx, ty] of [[4, 6], [7, 13], [3, 17], [6, 27], [38, 7], [36, 13], [40, 16], [37, 23], [31, 27], [13, 26]] as const) {
    add(treeKey(), tx, ty, trunk)
  }
  for (const [tx, ty, v] of [[12, 20, 0], [16, 20, 1], [27, 20, 2], [31, 20, 0], [9, 21, 1], [34, 21, 2], [39, 11, 0], [3, 12, 2], [27, 26, 1], [15, 23, 0]] as const) {
    add(`bush-${v}`, tx, ty, { w: 12, h: 7 })
  }
  for (const [tx, ty] of [[5, 22], [7, 23]] as const) add('lily', tx, ty)

  // Plaza.
  add('lamp', 17, 21, { w: 6, h: 4 })
  add('lamp', 26, 21, { w: 6, h: 4 })
  add('bench', 18, 24, { w: 28, h: 5 }, 1)
  add('bench', 24, 24, { w: 28, h: 5 }, 1)
  add('bench', 9, 24, { w: 28, h: 5 }, 1)

  // Office interior: bookshelves, wall decor, lounge and kitchenette.
  add('bookshelf', 11, 7, { w: 32, h: 12 }, 1)
  add('bookshelf', 31, 7, { w: 32, h: 12 }, 1)
  list.push({ key: 'whiteboard', x: 19 * TILE + 16, y: 6 * TILE + 12 })
  list.push({ key: 'clock', x: 26 * TILE + 8, y: 5 * TILE + 14 })
  add('plant-0', 11, 10, { w: 10, h: 5 })
  add('plant-1', 32, 10, { w: 10, h: 5 })
  add('plant-1', 11, 16, { w: 10, h: 5 })
  add('plant-0', 32, 16, { w: 10, h: 5 })
  add('plant-0', 19, 16, { w: 10, h: 5 })
  add('plant-1', 24, 16, { w: 10, h: 5 })
  list.push({ key: 'rug', x: 14 * TILE, y: 17 * TILE - 1, flat: true })
  add('sofa', 13, 15, { w: 30, h: 10 }, 1)
  add('counter', 29, 16, { w: 32, h: 10 }, 1)
  add('cooler', 31, 16, { w: 10, h: 6 })

  return list
}

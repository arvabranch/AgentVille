import { describe, expect, it } from 'vitest'
import { DESK_COUNT } from '@shared/constants'
import { HEADS, HAIR_OVERLAYS, BODIES, LEGS, CHAR_W, TYPING_BODIES, SLEEP_BODY } from './art/characterTemplates'
import { SOLID_TILES, TILE } from './art/tiles'
import { agentSpot, BUILDING, buildGround, DESK_SLOTS, MAP_H, MAP_W, PLAYER_SPAWN } from './world'

const solid = new Set(SOLID_TILES)

describe('town layout', () => {
  const ground = buildGround()
  const tileAt = (px: number, py: number): number => ground[Math.floor(py / TILE)]?.[Math.floor(px / TILE)] ?? -1

  it('has the expected size', () => {
    expect(ground).toHaveLength(MAP_H)
    for (const row of ground) expect(row).toHaveLength(MAP_W)
  })

  it('has one desk per agent slot, inside the office', () => {
    expect(DESK_SLOTS).toHaveLength(DESK_COUNT)
    for (const slot of DESK_SLOTS) {
      expect(slot.x).toBeGreaterThan(BUILDING.left)
      expect(slot.x + 1).toBeLessThan(BUILDING.right)
      expect(slot.y).toBeGreaterThanOrEqual(BUILDING.floorTop)
      expect(slot.y + 1).toBeLessThanOrEqual(BUILDING.floorBottom)
    }
  })

  it('puts every agent and the player on walkable ground', () => {
    for (let desk = 0; desk < DESK_COUNT; desk++) {
      const spot = agentSpot(desk)
      expect(solid.has(tileAt(spot.x, spot.y - 1))).toBe(false)
    }
    expect(solid.has(tileAt(PLAYER_SPAWN.x, PLAYER_SPAWN.y - 1))).toBe(false)
  })

  it('leaves the door open', () => {
    for (const x of BUILDING.door) {
      expect(solid.has(ground[BUILDING.capBottom]?.[x] ?? -1)).toBe(false)
      expect(solid.has(ground[BUILDING.facade]?.[x] ?? -1)).toBe(false)
    }
  })
})

describe('character templates', () => {
  const rows = (list: readonly string[]): void => list.forEach((row) => expect(row).toHaveLength(CHAR_W))

  it('are all 16 pixels wide', () => {
    for (const head of HEADS) for (const dir of ['down', 'up', 'side'] as const) rows(head[dir])
    for (const overlay of HAIR_OVERLAYS) for (const list of Object.values(overlay)) rows(list.map(([, px]) => px))
    for (const body of [...Object.values(BODIES), ...TYPING_BODIES, SLEEP_BODY]) rows(body)
    for (const legs of Object.values(LEGS)) rows(legs)
  })

  it('are symmetric when facing the camera', () => {
    for (const head of HEADS) {
      for (const row of [...head.down, ...head.up]) expect([...row].reverse().join('')).toBe(row)
    }
  })
})

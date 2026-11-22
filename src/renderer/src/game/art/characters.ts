import type Phaser from 'phaser'
import type { Appearance } from '@shared/types'
import { makeCanvas, mix, type Palette, paintTemplate, shade, type Ctx } from './canvas'
import {
  BODIES,
  CHAR_FRAMES,
  CHAR_H,
  CHAR_W,
  type Dir,
  HAIR_OVERLAYS,
  HEADS,
  LEGS,
  SLEEP_BODY,
  TYPING_BODIES
} from './characterTemplates'
import { C } from './palette'

const CAP_STYLE = 3

export function characterKey(a: Appearance): string {
  return `char-${a.hairStyle}-${[a.skin, a.hair, a.shirt, a.pants, a.shoes].join('-').replace(/#/g, '')}`
}

function characterPalette(a: Appearance): Palette {
  // With a cap, `hair` is the cap color and the hair underneath is brown.
  const hair = a.hairStyle === CAP_STYLE ? '#4a3326' : a.hair
  return {
    k: C.outline,
    e: C.outline,
    h: hair,
    H: shade(hair, 0.72),
    s: a.skin,
    S: shade(a.skin, 0.84),
    c: mix(a.skin, '#ff6f7d', 0.35),
    t: a.shirt,
    T: shade(a.shirt, 0.78),
    p: a.pants,
    P: shade(a.pants, 0.78),
    b: a.shoes,
    a: a.hair,
    A: shade(a.hair, 0.72)
  }
}

interface FrameSpec {
  dir: Dir
  body: readonly string[]
  legs: readonly string[]
  headDy?: number
}

const FRAME_SPECS: Record<(typeof CHAR_FRAMES)[number], FrameSpec> = {
  'down-0': { dir: 'down', body: BODIES.down, legs: LEGS.frontIdle },
  'down-1': { dir: 'down', body: BODIES.down, legs: LEGS.frontStepA },
  'down-2': { dir: 'down', body: BODIES.down, legs: LEGS.frontStepB },
  'up-0': { dir: 'up', body: BODIES.up, legs: LEGS.frontIdle },
  'up-1': { dir: 'up', body: BODIES.up, legs: LEGS.frontStepA },
  'up-2': { dir: 'up', body: BODIES.up, legs: LEGS.frontStepB },
  'side-0': { dir: 'side', body: BODIES.side, legs: LEGS.sideIdle },
  'side-1': { dir: 'side', body: BODIES.side, legs: LEGS.sideStride },
  'type-0': { dir: 'up', body: TYPING_BODIES[0] ?? BODIES.up, legs: LEGS.frontIdle },
  'type-1': { dir: 'up', body: TYPING_BODIES[1] ?? BODIES.up, legs: LEGS.frontIdle },
  'sleep-0': { dir: 'up', body: SLEEP_BODY, legs: LEGS.frontIdle, headDy: 2 },
  'sleep-1': { dir: 'up', body: SLEEP_BODY, legs: LEGS.frontIdle, headDy: 3 }
}

function drawFrame(ctx: Ctx, ox: number, style: number, spec: FrameSpec, palette: Palette): void {
  const heads = HEADS[style] ?? HEADS[0]
  if (!heads) return
  const dy = spec.headDy ?? 0
  paintTemplate(ctx, spec.body, palette, ox, 13)
  paintTemplate(ctx, spec.legs, palette, ox, 20)
  paintTemplate(ctx, heads[spec.dir], palette, ox, dy)
  for (const [row, pixels] of HAIR_OVERLAYS[style]?.[spec.dir] ?? []) {
    paintTemplate(ctx, [pixels], palette, ox, row + dy)
  }
}

export function buildCharacterSheet(a: Appearance): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(CHAR_W * CHAR_FRAMES.length, CHAR_H)
  const palette = characterPalette(a)
  CHAR_FRAMES.forEach((name, i) => drawFrame(ctx, i * CHAR_W, a.hairStyle, FRAME_SPECS[name], palette))
  return canvas
}

/**
 * Makes sure a texture + animations exist for this appearance and returns the
 * texture key. Characters that look the same share one texture.
 */
export function ensureCharacter(scene: Phaser.Scene, a: Appearance): string {
  const key = characterKey(a)
  if (scene.textures.exists(key)) return key

  const texture = scene.textures.addCanvas(key, buildCharacterSheet(a))
  if (!texture) return key
  CHAR_FRAMES.forEach((name, i) => texture.add(name, 0, i * CHAR_W, 0, CHAR_W, CHAR_H))

  const frames = (...names: string[]): Phaser.Types.Animations.AnimationFrame[] =>
    names.map((frame) => ({ key, frame }))

  scene.anims.create({ key: `${key}:walk-down`, frames: frames('down-1', 'down-0', 'down-2', 'down-0'), frameRate: 8, repeat: -1 })
  scene.anims.create({ key: `${key}:walk-up`, frames: frames('up-1', 'up-0', 'up-2', 'up-0'), frameRate: 8, repeat: -1 })
  scene.anims.create({ key: `${key}:walk-side`, frames: frames('side-1', 'side-0'), frameRate: 7, repeat: -1 })
  scene.anims.create({ key: `${key}:type`, frames: frames('type-0', 'type-1'), frameRate: 6, repeat: -1 })
  scene.anims.create({ key: `${key}:sleep`, frames: frames('sleep-0', 'sleep-1'), frameRate: 1.4, repeat: -1 })
  return key
}

import { ellipse, frame, makeCanvas, px, rect, rng, randInt, shade } from './canvas'
import { C } from './palette'

export interface PropArt {
  key: string
  canvas: HTMLCanvasElement
  /** Optional frame grid for spritesheets: frame width/height. */
  frames?: { width: number; height: number; names: string[] }
}

const SHADOW = 'rgba(24, 40, 28, 0.28)'

/* ----------------------------------------------------------------- desk -- */

function desk(): PropArt {
  const [canvas, ctx] = makeCanvas(32, 24)
  // Top surface.
  rect(ctx, 0, 10, 32, 8, C.outline)
  rect(ctx, 1, 11, 30, 6, C.woodLight)
  rect(ctx, 1, 11, 30, 1, shade(C.woodLight, 1.15))
  // Front panel.
  rect(ctx, 0, 17, 32, 7, C.outline)
  rect(ctx, 1, 17, 30, 6, C.wood)
  rect(ctx, 1, 17, 30, 1, C.woodDark)
  rect(ctx, 3, 19, 9, 3, C.woodDark)
  rect(ctx, 4, 20, 7, 1, C.wood)
  rect(ctx, 6, 20, 3, 1, C.woodLight)
  rect(ctx, 27, 18, 2, 5, C.woodDark)
  // Monitor.
  rect(ctx, 9, 0, 14, 10, C.outline)
  rect(ctx, 10, 1, 12, 8, C.metal)
  rect(ctx, 11, 2, 10, 6, C.screenOff)
  rect(ctx, 10, 8, 12, 1, C.metalDark)
  rect(ctx, 15, 10, 2, 2, C.metalDark)
  rect(ctx, 13, 11, 6, 1, C.metal)
  // Keyboard and mouse.
  rect(ctx, 10, 13, 12, 3, C.outline)
  rect(ctx, 11, 13, 10, 2, C.lightGray)
  for (let x = 11; x < 21; x += 2) px(ctx, x, 13, C.gray)
  rect(ctx, 24, 13, 2, 2, C.lightGray)
  px(ctx, 24, 15, C.outline)
  // Mug and papers.
  rect(ctx, 26, 11, 3, 3, C.white)
  rect(ctx, 26, 11, 3, 1, '#6b3f22')
  px(ctx, 29, 12, C.white)
  rect(ctx, 2, 12, 6, 4, C.paper)
  rect(ctx, 3, 13, 4, 1, C.gray)
  rect(ctx, 3, 14, 3, 1, C.lightGray)
  return { key: 'desk', canvas }
}

/** Monitor contents, drawn on top of the desk's screen (10×6). */
function screens(): PropArt {
  const names = ['off', 'sleep-0', 'sleep-1', 'work-0', 'work-1', 'work-2', 'alert-0', 'alert-1', 'error-0', 'error-1', 'done-0', 'done-1']
  const [canvas, ctx] = makeCanvas(10 * names.length, 6)
  const at = (name: string): number => names.indexOf(name) * 10

  rect(ctx, at('off'), 0, 10, 6, C.screenOff)

  for (const [name, star] of [['sleep-0', true], ['sleep-1', false]] as const) {
    const x = at(name)
    rect(ctx, x, 0, 10, 6, '#16203a')
    rect(ctx, x + 2, 1, 2, 2, '#f5e7a1')
    px(ctx, x + 3, 1, '#16203a')
    if (star) px(ctx, x + 7, 3, '#cfe0ff')
    else px(ctx, x + 6, 2, '#cfe0ff')
  }

  const code = [
    ['#7cc4ff', 4, '#ff8fc7', 3],
    ['#5ee3a1', 6, '', 0],
    ['#ffd166', 2, '#7cc4ff', 5],
    ['#b48cff', 5, '', 0],
    ['#5ee3a1', 3, '#ff8fc7', 3],
    ['#7cc4ff', 7, '', 0]
  ] as const
  for (let f = 0; f < 3; f++) {
    const x = at(`work-${f}`)
    rect(ctx, x, 0, 10, 6, '#0f1626')
    for (let line = 0; line < 3; line++) {
      const [c1, w1, c2, w2] = code[(f * 2 + line) % code.length] ?? code[0]
      const indent = line === 1 ? 2 : 1
      rect(ctx, x + indent, line * 2 + 1, w1, 1, c1)
      if (c2) rect(ctx, x + indent + w1 + 1, line * 2 + 1, w2, 1, c2)
    }
  }

  for (const [name, bg] of [['alert-0', C.yellow], ['alert-1', C.yellowDark]] as const) {
    const x = at(name)
    rect(ctx, x, 0, 10, 6, bg)
    rect(ctx, x + 4, 1, 2, 2, C.outline)
    rect(ctx, x + 4, 4, 2, 1, C.outline)
  }

  for (const [name, bg] of [['error-0', C.red], ['error-1', C.redDark]] as const) {
    const x = at(name)
    rect(ctx, x, 0, 10, 6, bg)
    for (let i = 0; i < 4; i++) {
      px(ctx, x + 3 + i, 1 + i, C.white)
      px(ctx, x + 6 - i, 1 + i, C.white)
    }
  }

  for (const [name, tick] of [['done-0', true], ['done-1', false]] as const) {
    const x = at(name)
    rect(ctx, x, 0, 10, 6, '#173326')
    const color = tick ? C.green : shade(C.green, 0.8)
    px(ctx, x + 2, 3, color)
    px(ctx, x + 3, 4, color)
    px(ctx, x + 4, 3, color)
    px(ctx, x + 5, 2, color)
    px(ctx, x + 6, 1, color)
  }

  return { key: 'screen', canvas, frames: { width: 10, height: 6, names } }
}

/* --------------------------------------------------------------- nature -- */

function treeRound(variant: number): PropArt {
  const [canvas, ctx] = makeCanvas(32, 40)
  const r = rng(300 + variant)
  ellipse(ctx, 16, 37, 11, 3, SHADOW)
  rect(ctx, 12, 25, 8, 13, C.outline)
  rect(ctx, 13, 25, 6, 12, C.trunk)
  rect(ctx, 17, 25, 2, 12, C.trunkDark)
  px(ctx, 12, 37, C.outline)
  px(ctx, 19, 37, C.outline)
  const leafDark = variant === 1 ? '#4c9a48' : C.leafDark
  const leaf = variant === 1 ? '#6bb85a' : C.leaf
  ellipse(ctx, 16, 15, 15.5, 14.5, C.leafDeep)
  ellipse(ctx, 16, 15, 14.5, 13.5, leafDark)
  ellipse(ctx, 15, 13, 12.5, 11.5, leaf)
  ellipse(ctx, 12, 9, 6, 5, C.leafLight)
  ellipse(ctx, 21, 12, 4, 3, C.leafLight)
  for (let i = 0; i < 14; i++) px(ctx, randInt(r, 5, 26), randInt(r, 4, 24), r() < 0.5 ? C.leafDeep : C.leafLight)
  if (variant === 2) {
    for (let i = 0; i < 6; i++) px(ctx, randInt(r, 6, 25), randInt(r, 5, 22), C.red)
  }
  return { key: `tree-round-${variant}`, canvas }
}

function treePine(variant: number): PropArt {
  const [canvas, ctx] = makeCanvas(24, 40)
  ellipse(ctx, 12, 37.5, 8, 2.5, SHADOW)
  rect(ctx, 9, 30, 6, 8, C.outline)
  rect(ctx, 10, 30, 4, 7, C.trunk)
  rect(ctx, 12, 30, 2, 7, C.trunkDark)
  const tiers = [
    { top: 0, bottom: 12, half: 6 },
    { top: 6, bottom: 21, half: 9 },
    { top: 13, bottom: 31, half: 11.5 }
  ]
  const light = variant === 1 ? '#69b67f' : C.pineLight
  for (const tier of tiers) {
    for (let y = tier.top; y <= tier.bottom; y++) {
      const t = (y - tier.top) / (tier.bottom - tier.top)
      const half = Math.max(1, Math.round(tier.half * t))
      rect(ctx, 12 - half - 1, y, half * 2 + 2, 1, C.outline)
      rect(ctx, 12 - half, y, half * 2, 1, C.pine)
      rect(ctx, 12, y, half, 1, C.pineDark)
      if (y % 3 === 0) px(ctx, 12 - Math.floor(half / 2), y, light)
    }
  }
  return { key: `tree-pine-${variant}`, canvas }
}

function bush(variant: number): PropArt {
  const [canvas, ctx] = makeCanvas(16, 16)
  const r = rng(400 + variant)
  ellipse(ctx, 8, 14, 7, 2, SHADOW)
  ellipse(ctx, 8, 9, 7.5, 6.5, C.leafDeep)
  ellipse(ctx, 8, 9, 6.5, 5.5, C.leafDark)
  ellipse(ctx, 7, 8, 5, 4, C.leaf)
  ellipse(ctx, 6, 6, 2, 1.5, C.leafLight)
  const berry = variant === 1 ? C.pink : variant === 2 ? C.yellow : C.red
  for (let i = 0; i < 4; i++) px(ctx, randInt(r, 3, 12), randInt(r, 5, 12), berry)
  return { key: `bush-${variant}`, canvas }
}

function lilyPad(): PropArt {
  const [canvas, ctx] = makeCanvas(8, 6)
  ellipse(ctx, 4, 3, 4, 3, C.leafDark)
  ellipse(ctx, 4, 3, 3, 2, C.leafLight)
  px(ctx, 4, 0, C.water)
  px(ctx, 4, 1, C.water)
  return { key: 'lily', canvas }
}

/* -------------------------------------------------------------- outdoor -- */

function bench(): PropArt {
  const [canvas, ctx] = makeCanvas(32, 16)
  ellipse(ctx, 16, 14.5, 14, 1.5, SHADOW)
  for (const x of [3, 27]) rect(ctx, x, 9, 2, 6, C.woodDeep)
  frame(ctx, 1, 1, 30, 4, C.outline)
  rect(ctx, 2, 2, 28, 2, C.wood)
  rect(ctx, 2, 2, 28, 1, C.woodLight)
  frame(ctx, 0, 7, 32, 4, C.outline)
  rect(ctx, 1, 8, 30, 2, C.wood)
  rect(ctx, 1, 8, 30, 1, C.woodLight)
  for (const x of [5, 25]) rect(ctx, x, 5, 2, 2, C.woodDark)
  return { key: 'bench', canvas }
}

function lampPost(): PropArt {
  const [canvas, ctx] = makeCanvas(16, 32)
  ellipse(ctx, 8, 30.5, 5, 1.5, SHADOW)
  rect(ctx, 5, 28, 6, 3, C.metalDark)
  rect(ctx, 7, 9, 2, 20, C.metal)
  px(ctx, 7, 9, C.metalLight)
  rect(ctx, 4, 1, 8, 8, C.outline)
  rect(ctx, 5, 2, 6, 6, C.lamp)
  rect(ctx, 5, 2, 6, 1, C.lampGlow)
  rect(ctx, 5, 0, 6, 1, C.metalDark)
  rect(ctx, 7, 2, 2, 6, shade(C.lamp, 0.9))
  return { key: 'lamp', canvas }
}

/* --------------------------------------------------------------- indoor -- */

function plant(variant: number): PropArt {
  const [canvas, ctx] = makeCanvas(16, 24)
  const r = rng(600 + variant)
  ellipse(ctx, 8, 22.5, 5, 1.5, SHADOW)
  // Pot.
  rect(ctx, 3, 15, 10, 3, C.outline)
  rect(ctx, 4, 16, 8, 1, C.potLight)
  rect(ctx, 4, 18, 8, 5, C.outline)
  rect(ctx, 5, 18, 6, 4, C.pot)
  rect(ctx, 9, 18, 2, 4, C.potDark)
  // Leaves.
  if (variant === 0) {
    ellipse(ctx, 8, 9, 7, 7, C.leafDeep)
    ellipse(ctx, 8, 9, 6, 6, C.leafDark)
    ellipse(ctx, 7, 8, 4.5, 4.5, C.leaf)
    ellipse(ctx, 6, 6, 2, 2, C.leafLight)
  } else {
    for (let i = 0; i < 5; i++) {
      const x = 3 + i * 2.5
      ellipse(ctx, x, 9 - (i % 2) * 3, 2, 6, C.leafDeep)
      ellipse(ctx, x, 9 - (i % 2) * 3, 1.2, 5, i % 2 ? C.leafLight : C.leaf)
    }
  }
  for (let i = 0; i < 4; i++) px(ctx, randInt(r, 3, 12), randInt(r, 4, 13), C.leafDeep)
  return { key: `plant-${variant}`, canvas }
}

function bookshelf(): PropArt {
  const [canvas, ctx] = makeCanvas(32, 32)
  const r = rng(700)
  rect(ctx, 0, 0, 32, 32, C.outline)
  rect(ctx, 1, 1, 30, 30, C.woodDark)
  rect(ctx, 3, 3, 26, 26, C.woodDeep)
  const bookColors = ['#e25d4d', '#4f8fe0', '#f2c84b', '#5fbf6b', '#7a64d8', '#ef8f4a', '#3fa7a0', '#eeeeee']
  for (const shelfY of [3, 12, 21]) {
    let x = 3
    while (x < 28) {
      const w = randInt(r, 2, 3)
      const h = randInt(r, 5, 7)
      const color = bookColors[randInt(r, 0, bookColors.length - 1)] ?? C.red
      rect(ctx, x, shelfY + (8 - h), w, h, color)
      px(ctx, x, shelfY + (8 - h), shade(color, 1.25))
      x += w + (r() < 0.2 ? 1 : 0)
    }
    rect(ctx, 1, shelfY + 8, 30, 1, C.wood)
  }
  rect(ctx, 1, 1, 30, 1, C.wood)
  return { key: 'bookshelf', canvas }
}

function sofa(): PropArt {
  const [canvas, ctx] = makeCanvas(32, 22)
  ellipse(ctx, 16, 20.5, 15, 1.5, SHADOW)
  rect(ctx, 1, 1, 30, 11, C.outline)
  rect(ctx, 2, 2, 28, 9, C.sofaDark)
  rect(ctx, 2, 2, 28, 1, C.sofa)
  rect(ctx, 0, 8, 32, 12, C.outline)
  rect(ctx, 1, 9, 4, 10, C.sofaDark)
  rect(ctx, 27, 9, 4, 10, C.sofaDark)
  rect(ctx, 5, 10, 11, 8, C.sofa)
  rect(ctx, 16, 10, 11, 8, C.sofa)
  rect(ctx, 15, 10, 1, 8, C.sofaDark)
  rect(ctx, 5, 10, 22, 1, C.sofaLight)
  rect(ctx, 1, 9, 4, 1, C.sofa)
  rect(ctx, 27, 9, 4, 1, C.sofa)
  rect(ctx, 7, 4, 6, 4, '#f2c84b')
  rect(ctx, 7, 4, 6, 1, '#ffe28a')
  return { key: 'sofa', canvas }
}

function rug(): PropArt {
  const [canvas, ctx] = makeCanvas(64, 32)
  rect(ctx, 0, 0, 64, 32, C.rugDark)
  rect(ctx, 2, 2, 60, 28, C.rug)
  frame(ctx, 4, 4, 56, 24, C.rugGold)
  for (let x = 8; x < 58; x += 6) {
    px(ctx, x, 15, C.rugGold)
    px(ctx, x + 1, 16, C.rugGold)
    px(ctx, x, 17, C.rugGold)
  }
  rect(ctx, 26, 12, 12, 8, C.rugLight)
  frame(ctx, 26, 12, 12, 8, C.rugGold)
  return { key: 'rug', canvas }
}

function waterCooler(): PropArt {
  const [canvas, ctx] = makeCanvas(16, 28)
  ellipse(ctx, 8, 26.5, 5, 1.5, SHADOW)
  rect(ctx, 4, 0, 8, 11, C.outline)
  rect(ctx, 5, 1, 6, 9, C.glassDark)
  rect(ctx, 5, 1, 6, 3, C.glass)
  px(ctx, 6, 2, C.glassLight)
  rect(ctx, 3, 10, 10, 16, C.outline)
  rect(ctx, 4, 11, 8, 14, C.white)
  rect(ctx, 10, 11, 2, 14, C.lightGray)
  rect(ctx, 6, 14, 2, 2, C.blue)
  rect(ctx, 8, 14, 2, 2, C.red)
  return { key: 'cooler', canvas }
}

function coffeeCounter(): PropArt {
  const [canvas, ctx] = makeCanvas(32, 26)
  rect(ctx, 0, 10, 32, 16, C.outline)
  rect(ctx, 1, 11, 30, 3, C.lightGray)
  rect(ctx, 1, 11, 30, 1, C.white)
  rect(ctx, 1, 14, 30, 11, C.woodDark)
  for (const x of [2, 17]) {
    rect(ctx, x, 15, 13, 9, C.wood)
    rect(ctx, x + 11, 19, 1, 2, C.woodLight)
  }
  // Coffee machine.
  rect(ctx, 4, 0, 10, 12, C.outline)
  rect(ctx, 5, 1, 8, 10, C.metal)
  rect(ctx, 6, 2, 6, 3, C.metalDark)
  px(ctx, 11, 3, C.red)
  rect(ctx, 7, 7, 4, 3, C.metalDark)
  rect(ctx, 8, 8, 2, 2, C.white)
  // Cups.
  for (const x of [18, 23]) {
    rect(ctx, x, 7, 4, 4, C.outline)
    rect(ctx, x + 1, 8, 2, 2, C.white)
  }
  return { key: 'counter', canvas }
}

function whiteboard(): PropArt {
  const [canvas, ctx] = makeCanvas(32, 18)
  rect(ctx, 0, 0, 32, 15, C.darkGray)
  rect(ctx, 1, 1, 30, 13, C.white)
  rect(ctx, 3, 3, 12, 1, C.blue)
  rect(ctx, 3, 5, 8, 1, C.blue)
  rect(ctx, 3, 8, 10, 1, C.red)
  rect(ctx, 18, 3, 9, 6, C.lightGray)
  frame(ctx, 18, 3, 9, 6, C.green)
  rect(ctx, 20, 10, 8, 1, C.green)
  rect(ctx, 4, 15, 24, 2, C.gray)
  rect(ctx, 8, 14, 3, 1, C.red)
  rect(ctx, 13, 14, 3, 1, C.blue)
  return { key: 'whiteboard', canvas }
}

function clock(): PropArt {
  const [canvas, ctx] = makeCanvas(12, 12)
  ellipse(ctx, 6, 6, 6, 6, C.outline)
  ellipse(ctx, 6, 6, 5, 5, C.white)
  rect(ctx, 6, 2, 1, 4, C.outline)
  rect(ctx, 6, 6, 3, 1, C.outline)
  px(ctx, 6, 6, C.red)
  return { key: 'clock', canvas }
}

function shadow(): PropArt {
  const [canvas, ctx] = makeCanvas(14, 5)
  ellipse(ctx, 7, 2.5, 7, 2.5, 'rgba(20, 24, 30, 0.28)')
  return { key: 'shadow', canvas }
}

export function buildProps(): PropArt[] {
  return [
    desk(),
    screens(),
    treeRound(0),
    treeRound(1),
    treeRound(2),
    treePine(0),
    treePine(1),
    bush(0),
    bush(1),
    bush(2),
    lilyPad(),
    bench(),
    lampPost(),
    plant(0),
    plant(1),
    bookshelf(),
    sofa(),
    rug(),
    waterCooler(),
    coffeeCounter(),
    whiteboard(),
    clock(),
    shadow()
  ]
}


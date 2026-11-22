import { makeCanvas, paintTemplate } from './canvas'
import { C } from './palette'
import type { PropArt } from './props'

/** Speech bubble shell (14×11). `w` is the fill color. */
const BUBBLE = [
  '..kkkkkkkkkk..',
  '.kwwwwwwwwwwk.',
  'kwwwwwwwwwwwwk',
  'kwwwwwwwwwwwwk',
  'kwwwwwwwwwwwwk',
  'kwwwwwwwwwwwwk',
  'kwwwwwwwwwwwwk',
  '.kwwwwwwwwwwk.',
  '..kkkkwwkkkk..',
  '.....kwk......',
  '......k.......'
]

const DOTS: ReadonlyArray<readonly string[]> = [0, 1, 2].map((active) =>
  [0, 1, 2].map((i) => (i === active ? 'D' : 'd'))
)

function bubble(key: string, fill: string, glyph: (ctx: CanvasRenderingContext2D) => void): PropArt {
  const [canvas, ctx] = makeCanvas(14, 11)
  paintTemplate(ctx, BUBBLE, { k: C.outline, w: fill })
  glyph(ctx)
  return { key, canvas }
}

const Z_SMALL = ['zzz', '.z.', 'zzz']
const Z_BIG = ['zzzz', '..z.', '.z..', 'zzzz']

const KEY_E = [
  '.kkkkkkkkk.',
  'kwwwwwwwwwk',
  'kwwkkkkwwwk',
  'kwwkwwwwwwk',
  'kwwkkkwwwwk',
  'kwwkwwwwwwk',
  'kwwkkkkwwwk',
  'kwwwwwwwwwk',
  'kgggggggggk',
  '.kkkkkkkkk.'
]

export function buildIcons(): PropArt[] {
  const icons: PropArt[] = []

  DOTS.forEach((pattern, frame) => {
    icons.push(
      bubble(`bubble-dots-${frame}`, C.white, (ctx) => {
        pattern.forEach((state, i) => {
          ctx.fillStyle = state === 'D' ? C.outline : C.gray
          ctx.fillRect(3 + i * 3, 4, 2, 2)
        })
      })
    )
  })

  icons.push(
    bubble('bubble-alert', C.yellow, (ctx) => {
      ctx.fillStyle = C.outline
      ctx.fillRect(6, 2, 2, 3)
      ctx.fillRect(6, 6, 2, 1)
    })
  )

  icons.push(
    bubble('bubble-error', C.red, (ctx) => {
      ctx.fillStyle = C.white
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(5 + i, 2 + i, 1, 1)
        ctx.fillRect(8 - i, 2 + i, 1, 1)
      }
    })
  )

  icons.push(
    bubble('bubble-mail', C.white, (ctx) => {
      ctx.fillStyle = C.green
      ctx.fillRect(3, 3, 8, 1)
      ctx.fillStyle = C.gray
      ctx.fillRect(3, 5, 6, 1)
    })
  )

  for (const [key, rows] of [['z-small', Z_SMALL], ['z-big', Z_BIG]] as const) {
    const width = rows[0]?.length ?? 3
    const [canvas, ctx] = makeCanvas(width + 1, rows.length + 1)
    paintTemplate(ctx, rows, { z: C.outline }, 1, 1)
    paintTemplate(ctx, rows, { z: '#e3eeff' }, 0, 0)
    icons.push({ key, canvas })
  }

  const [keyCanvas, keyCtx] = makeCanvas(11, 10)
  paintTemplate(keyCtx, KEY_E, { k: C.outline, w: C.white, g: C.gray })
  icons.push({ key: 'key-e', canvas: keyCanvas })

  return icons
}

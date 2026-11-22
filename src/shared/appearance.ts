import type { Appearance } from './types'

/** Color choices for generated characters. Hand-picked to read well at 16px. */
export const SKIN_TONES = ['#ffdbb5', '#f3c391', '#d99e6a', '#b0764a', '#8a5636', '#5f3a24']
export const HAIR_COLORS = ['#2b2230', '#4a3326', '#7a4a2a', '#c27a3a', '#e8c46a', '#d4d4dc', '#b4475a', '#4f6fbf', '#3f8f6a']
export const SHIRT_COLORS = ['#e25d4d', '#f08c3a', '#f2c84b', '#5fbf6b', '#3fa7a0', '#4f8fe0', '#7a64d8', '#c95fb0', '#eeeeee', '#3d4458']
export const PANTS_COLORS = ['#34405e', '#2b2f3a', '#5a4632', '#3f5a48', '#6b6f80', '#2f4a7a']
export const SHOE_COLORS = ['#2a2230', '#5a3a2a', '#e9e9ee', '#7a2f3a']

/** Number of hair styles for agents (the player uses a cap instead). */
export const AGENT_HAIR_STYLES = 3
export const PLAYER_CAP_STYLE = 3

function pick<T>(list: readonly T[], random: () => number): T {
  return list[Math.floor(random() * list.length)] as T
}

/** Small deterministic PRNG so an agent id always maps to the same look. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let state = h >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomAppearance(seed: string): Appearance {
  const random = seededRandom(seed)
  return {
    skin: pick(SKIN_TONES, random),
    hair: pick(HAIR_COLORS, random),
    hairStyle: Math.floor(random() * AGENT_HAIR_STYLES),
    shirt: pick(SHIRT_COLORS, random),
    pants: pick(PANTS_COLORS, random),
    shoes: pick(SHOE_COLORS, random)
  }
}

export const PLAYER_APPEARANCE: Appearance = {
  skin: '#f3c391',
  hair: '#e2574c',
  hairStyle: PLAYER_CAP_STYLE,
  shirt: '#4f8fe0',
  pants: '#2b2f3a',
  shoes: '#e9e9ee'
}

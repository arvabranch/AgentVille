import type { PlayerState } from '@shared/types'

/**
 * Small hand-off point between React and the Phaser scenes for things that
 * are not part of the shared store (start position, persistence callbacks).
 */
export const gameBridge: {
  initialPlayer: PlayerState | null
  onPlayerMoved: ((player: PlayerState) => void) | null
} = {
  initialPlayer: null,
  onPlayerMoved: null
}

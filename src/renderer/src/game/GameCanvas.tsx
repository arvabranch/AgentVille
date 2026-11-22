import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'
import { createGame } from './createGame'

/** Hosts the Phaser game behind the React UI. */
export function GameCanvas(): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let game: Phaser.Game | null = null
    let cancelled = false
    // Name tags use the pixel font, so wait for it before drawing any text.
    void document.fonts
      .load('8px "Pixelify Sans"')
      .catch(() => undefined)
      .then(() => {
        if (!cancelled && hostRef.current) game = createGame(hostRef.current)
      })
    return () => {
      cancelled = true
      game?.destroy(true)
    }
  }, [])

  const releaseFocus = (): void => {
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  }

  return <div ref={hostRef} className="game-canvas" onMouseDown={releaseFocus} />
}

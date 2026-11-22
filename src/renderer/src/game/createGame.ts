import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { TownScene } from './scenes/TownScene'

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#12131a',
    pixelArt: true,
    roundPixels: true,
    banner: false,
    audio: { noAudio: true },
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth || 800,
      height: parent.clientHeight || 600
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false }
    },
    scene: [BootScene, TownScene]
  })
}

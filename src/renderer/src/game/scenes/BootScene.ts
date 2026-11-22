import Phaser from 'phaser'
import { buildIcons } from '../art/icons'
import { buildProps } from '../art/props'
import { buildTileset } from '../art/tiles'

/** Generates every texture and shared animation, then starts the town. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  create(): void {
    this.textures.addCanvas('tiles', buildTileset())

    for (const art of [...buildProps(), ...buildIcons()]) {
      const texture = this.textures.addCanvas(art.key, art.canvas)
      const grid = art.frames
      if (texture && grid) {
        grid.names.forEach((name, i) => texture.add(name, 0, i * grid.width, 0, grid.width, grid.height))
      }
    }

    const screen = (...names: string[]): Phaser.Types.Animations.AnimationFrame[] =>
      names.map((frame) => ({ key: 'screen', frame }))
    this.anims.create({ key: 'screen-work', frames: screen('work-0', 'work-1', 'work-2'), frameRate: 5, repeat: -1 })
    this.anims.create({ key: 'screen-sleep', frames: screen('sleep-0', 'sleep-1'), frameRate: 1, repeat: -1 })
    this.anims.create({ key: 'screen-alert', frames: screen('alert-0', 'alert-1'), frameRate: 3, repeat: -1 })
    this.anims.create({ key: 'screen-error', frames: screen('error-0', 'error-1'), frameRate: 2, repeat: -1 })
    this.anims.create({ key: 'screen-done', frames: screen('done-0', 'done-1'), frameRate: 1.5, repeat: -1 })
    this.anims.create({
      key: 'bubble-dots',
      frames: [{ key: 'bubble-dots-0' }, { key: 'bubble-dots-1' }, { key: 'bubble-dots-2' }],
      frameRate: 4,
      repeat: -1
    })

    this.scene.start('town')
  }
}

import type Phaser from 'phaser'
import { PLAYER_APPEARANCE } from '@shared/appearance'
import type { Facing } from '@shared/types'
import { ensureCharacter } from '../art/characters'

const SPEED = 82

/** The user's own character, moved with WASD / arrow keys. */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite
  private readonly shadow: Phaser.GameObjects.Image
  private readonly key: string
  facing: Facing

  constructor(scene: Phaser.Scene, x: number, y: number, facing: Facing = 'up') {
    this.key = ensureCharacter(scene, PLAYER_APPEARANCE)
    this.facing = facing
    this.shadow = scene.add.image(x, y - 1, 'shadow')
    this.sprite = scene.physics.add.sprite(x, y, this.key, 'up-0').setOrigin(0.5, 1)
    const body = this.sprite.body as Phaser.Physics.Arcade.Body
    body.setSize(10, 6, false)
    body.setOffset(3, 18)
    this.sprite.setCollideWorldBounds(true)
    this.idle()
    this.sync()
  }

  get x(): number {
    return this.sprite.x
  }

  get y(): number {
    return this.sprite.y
  }

  /** dx/dy are -1, 0 or 1. */
  move(dx: number, dy: number): void {
    const moving = dx !== 0 || dy !== 0
    const scale = dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1
    this.sprite.setVelocity(dx * SPEED * scale, dy * SPEED * scale)

    if (moving) {
      this.facing = this.pickFacing(dx, dy)
      const anim = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing
      this.sprite.setFlipX(this.facing === 'right')
      this.sprite.anims.play(`${this.key}:walk-${anim}`, true)
    } else {
      this.idle()
    }
    this.sync()
  }

  private pickFacing(dx: number, dy: number): Facing {
    const horizontal: Facing = dx < 0 ? 'left' : 'right'
    const vertical: Facing = dy < 0 ? 'up' : 'down'
    if (dx !== 0 && dy !== 0) {
      return this.facing === horizontal || this.facing === vertical ? this.facing : horizontal
    }
    return dx !== 0 ? horizontal : vertical
  }

  private idle(): void {
    this.sprite.anims.stop()
    const frame = this.facing === 'left' || this.facing === 'right' ? 'side-0' : `${this.facing}-0`
    this.sprite.setFlipX(this.facing === 'right')
    this.sprite.setFrame(frame)
  }

  private sync(): void {
    this.sprite.setDepth(this.sprite.y)
    this.shadow.setPosition(this.sprite.x, this.sprite.y - 1).setDepth(this.sprite.y - 1)
  }
}

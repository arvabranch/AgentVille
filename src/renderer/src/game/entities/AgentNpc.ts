import type Phaser from 'phaser'
import type { AgentView } from '@shared/types'
import { ensureCharacter } from '../art/characters'
import { agentSpot } from '../world'

const UI_DEPTH = 100_000
export const LABEL_FONT = '"Pixelify Sans", sans-serif'

/**
 * An agent standing at its desk. Shows its status through animation, the
 * monitor contents and a little bubble above its head.
 */
export class AgentNpc {
  readonly id: string
  readonly x: number
  readonly y: number
  private agent: AgentView
  private near = false
  private textureKey: string
  private readonly sprite: Phaser.GameObjects.Sprite
  private readonly shadow: Phaser.GameObjects.Image
  private readonly label: Phaser.GameObjects.Text
  private readonly bubble: Phaser.GameObjects.Sprite
  private readonly prompt: Phaser.GameObjects.Image
  private readonly blocker: Phaser.GameObjects.Zone
  private bubbleTween: Phaser.Tweens.Tween | null = null
  private promptTween: Phaser.Tweens.Tween | null = null
  private zTimer: Phaser.Time.TimerEvent | null = null
  private visualKey = ''

  constructor(
    private readonly scene: Phaser.Scene,
    agent: AgentView,
    private readonly screen: Phaser.GameObjects.Sprite,
    blockers: Phaser.Physics.Arcade.StaticGroup,
    onClick: (agentId: string) => void
  ) {
    this.id = agent.id
    this.agent = agent
    const spot = agentSpot(agent.deskIndex)
    this.x = spot.x
    this.y = spot.y
    this.textureKey = ensureCharacter(scene, agent.appearance)

    this.shadow = scene.add.image(this.x, this.y - 1, 'shadow').setDepth(this.y - 1)
    this.sprite = scene.add
      .sprite(this.x, this.y, this.textureKey, 'up-0')
      .setOrigin(0.5, 1)
      .setDepth(this.y)
      .setInteractive({ useHandCursor: true })
    this.sprite.on('pointerdown', () => onClick(this.id))

    this.label = scene.add
      .text(this.x, this.y - 40, agent.name, {
        fontFamily: LABEL_FONT,
        fontSize: '8px',
        color: '#ffffff',
        backgroundColor: 'rgba(18, 19, 26, 0.72)',
        padding: { x: 3, y: 1 },
        resolution: 8
      })
      .setOrigin(0.5, 1)
      .setDepth(UI_DEPTH)

    this.bubble = scene.add.sprite(this.x + 12, this.y - 18, 'bubble-dots-0').setOrigin(0.5, 1).setDepth(UI_DEPTH + 1)
    this.prompt = scene.add.image(this.x, this.y - 40, 'key-e').setOrigin(1, 1).setDepth(UI_DEPTH + 2).setVisible(false)

    this.blocker = scene.add.zone(this.x, this.y - 3, 10, 6)
    scene.physics.add.existing(this.blocker, true)
    blockers.add(this.blocker)

    this.refresh()
  }

  setAgent(agent: AgentView): void {
    this.agent = agent
    if (this.label.text !== agent.name) this.label.setText(agent.name)
    const key = ensureCharacter(this.scene, agent.appearance)
    if (key !== this.textureKey) {
      this.textureKey = key
      this.visualKey = ''
    }
    this.refresh()
  }

  setNear(near: boolean): void {
    if (this.near === near) return
    this.near = near
    this.refresh()
  }

  private refresh(): void {
    const { status, unread } = this.agent
    const key = `${status}|${unread}|${this.near}|${this.textureKey}|${this.agent.name}`
    if (key === this.visualKey) return
    this.visualKey = key

    const facesPlayer = this.near || status === 'attention' || status === 'error'
    const tex = this.textureKey
    this.sprite.setTexture(tex)
    if (status === 'working') this.sprite.anims.play(`${tex}:type`, true)
    else if (facesPlayer) this.still('down-0')
    else if (status === 'sleeping' && !unread) this.sprite.anims.play(`${tex}:sleep`, true)
    else this.still('up-0')

    const screenAnim =
      status === 'working'
        ? 'screen-work'
        : status === 'attention'
          ? 'screen-alert'
          : status === 'error'
            ? 'screen-error'
            : unread
              ? 'screen-done'
              : 'screen-sleep'
    this.screen.anims.play(screenAnim, true)

    this.bubbleTween?.remove()
    this.bubbleTween = null
    this.bubble.setPosition(this.x + 12, this.y - 18).setAngle(0)
    if (status === 'working') {
      this.bubble.setVisible(true).play('bubble-dots')
    } else if (status === 'attention' || status === 'error' || unread) {
      const texture = status === 'attention' ? 'bubble-alert' : status === 'error' ? 'bubble-error' : 'bubble-mail'
      this.bubble.stop()
      this.bubble.setVisible(true).setTexture(texture)
      this.bubbleTween = this.scene.tweens.add({
        targets: this.bubble,
        y: this.y - (status === 'attention' ? 22 : 20),
        duration: status === 'attention' ? 320 : 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    } else {
      this.bubble.stop()
      this.bubble.setVisible(false)
    }

    const dozing = status === 'sleeping' && !unread && !this.near
    if (dozing && !this.zTimer) {
      this.zTimer = this.scene.time.addEvent({ delay: 1300, loop: true, callback: () => this.puffZ() })
    } else if (!dozing && this.zTimer) {
      this.zTimer.remove()
      this.zTimer = null
    }

    // Highlight the name tag and show the E key right next to it.
    this.label.setBackgroundColor(this.near ? '#ffb454' : 'rgba(18, 19, 26, 0.72)').setColor(this.near ? '#251500' : '#ffffff')
    this.prompt.setPosition(this.x - this.label.width / 2 - 2, this.y - 40).setVisible(this.near)
    this.promptTween?.remove()
    this.promptTween = this.near
      ? this.scene.tweens.add({ targets: this.prompt, y: this.y - 42, duration: 420, yoyo: true, repeat: -1 })
      : null
  }

  private still(frame: string): void {
    this.sprite.anims.stop()
    this.sprite.setFrame(frame)
  }

  private puffZ(): void {
    const big = Math.random() < 0.4
    const z = this.scene.add
      .image(this.x + 4, this.y - 20, big ? 'z-big' : 'z-small')
      .setDepth(UI_DEPTH)
      .setAlpha(0.95)
    this.scene.tweens.add({
      targets: z,
      x: z.x + 7,
      y: z.y - 13,
      alpha: 0,
      duration: 1900,
      ease: 'Sine.easeOut',
      onComplete: () => z.destroy()
    })
  }

  destroy(): void {
    this.zTimer?.remove()
    this.bubbleTween?.remove()
    this.promptTween?.remove()
    this.screen.anims.stop()
    this.screen.setFrame('off')
    for (const obj of [this.sprite, this.shadow, this.label, this.bubble, this.prompt, this.blocker]) obj.destroy()
  }
}

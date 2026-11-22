import Phaser from 'phaser'
import type { AgentView, PlayerState } from '@shared/types'
import { isTypingInUi, useAppStore } from '../../state/store'
import { CHAT_PANEL_WIDTH } from '../../ui/layout'
import { SOLID_TILES, TILE } from '../art/tiles'
import { AgentNpc } from '../entities/AgentNpc'
import { Player } from '../entities/Player'
import { gameBridge } from '../bridge'
import { buildDecorations, buildGround, DESK_SLOTS, MAP_H, MAP_W, PLAYER_SPAWN } from '../world'

const TALK_DISTANCE = 24
const MIN_ZOOM = 2
const MAX_ZOOM = 5

type KeyName = 'w' | 'a' | 's' | 'd' | 'up' | 'down' | 'left' | 'right' | 'e'

export class TownScene extends Phaser.Scene {
  private player!: Player
  private blockers!: Phaser.Physics.Arcade.StaticGroup
  private screens: Phaser.GameObjects.Sprite[] = []
  private readonly npcs = new Map<string, AgentNpc>()
  private keys!: Record<KeyName, Phaser.Input.Keyboard.Key>
  private nearId: string | null = null
  private zoomBias = 0
  private unsubscribe: (() => void) | null = null
  private lastSaved = ''
  private collideWithGround: Phaser.Tilemaps.TilemapLayer | null = null

  constructor() {
    super('town')
  }

  create(): void {
    this.buildWorld()

    const start: PlayerState = gameBridge.initialPlayer ?? { ...PLAYER_SPAWN, facing: 'up' }
    this.player = new Player(this, start.x, start.y, start.facing)
    this.physics.add.collider(this.player.sprite, this.blockers)

    this.setupCamera()
    this.setupInput()

    this.syncAgents(useAppStore.getState().agents)
    this.unsubscribe = useAppStore.subscribe((state, prev) => {
      if (state.agents !== prev.agents) this.syncAgents(state.agents)
      if (state.openAgentId !== prev.openAgentId) this.updateFollowOffset()
    })
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this)
    this.time.addEvent({ delay: 1500, loop: true, callback: () => this.reportPlayer() })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.()
      this.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this)
    })
  }

  private buildWorld(): void {
    const width = MAP_W * TILE
    const height = MAP_H * TILE
    this.physics.world.setBounds(0, 0, width, height)

    const map = this.make.tilemap({ data: buildGround(), tileWidth: TILE, tileHeight: TILE })
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)
    const ground = tileset ? map.createLayer(0, tileset, 0, 0) : null
    ground?.setDepth(0)
    ground?.setCollision(SOLID_TILES)

    this.blockers = this.physics.add.staticGroup()
    const block = (cx: number, bottom: number, w: number, h: number): void => {
      const zone = this.add.zone(cx, bottom - h / 2, w, h)
      this.physics.add.existing(zone, true)
      this.blockers.add(zone)
    }

    for (const deco of buildDecorations()) {
      this.add
        .image(deco.x, deco.y, deco.key)
        .setOrigin(0.5, 1)
        .setDepth(deco.flat ? 1 : deco.y)
      if (deco.block) block(deco.x, deco.y, deco.block.w, deco.block.h)
    }

    // Desks are always there; agents claim them.
    this.screens = DESK_SLOTS.map((slot) => {
      const left = slot.x * TILE
      const bottom = (slot.y + 1) * TILE
      this.add.image(left + TILE, bottom, 'desk').setOrigin(0.5, 1).setDepth(bottom)
      block(left + TILE, bottom, 30, 13)
      return this.add
        .sprite(left + 11, bottom - 24 + 2, 'screen', 'off')
        .setOrigin(0, 0)
        .setDepth(bottom + 0.1)
    })

    if (ground) this.collideWithGround = ground
  }

  private setupCamera(): void {
    const camera = this.cameras.main
    camera.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE)
    camera.setRoundPixels(true)
    camera.startFollow(this.player.sprite, true, 0.14, 0.14)
    camera.setBackgroundColor('#2f6338')
    if (this.collideWithGround) this.physics.add.collider(this.player.sprite, this.collideWithGround)
    this.applyZoom()
  }

  private baseZoom(): number {
    const { width, height } = this.scale.gameSize
    return Phaser.Math.Clamp(Math.floor(Math.min(width / 420, height / 260)), MIN_ZOOM, MAX_ZOOM)
  }

  private applyZoom(): void {
    const zoom = Phaser.Math.Clamp(this.baseZoom() + this.zoomBias, MIN_ZOOM, MAX_ZOOM)
    this.cameras.main.setZoom(zoom)
    this.updateFollowOffset()
  }

  private updateFollowOffset(): void {
    const camera = this.cameras.main
    const open = useAppStore.getState().openAgentId !== null
    camera.setFollowOffset(open ? -CHAT_PANEL_WIDTH / 2 / camera.zoom : 0, 0)
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard
    if (!keyboard) throw new Error('Keyboard input unavailable')
    // Never capture keys: the chat composer must receive arrows and letters.
    keyboard.disableGlobalCapture()
    this.keys = keyboard.addKeys(
      { w: 'W', a: 'A', s: 'S', d: 'D', up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', e: 'E' },
      false
    ) as Record<KeyName, Phaser.Input.Keyboard.Key>

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.zoomBias = Phaser.Math.Clamp(this.zoomBias + (dy > 0 ? -1 : 1), MIN_ZOOM - MAX_ZOOM, MAX_ZOOM - MIN_ZOOM)
      this.applyZoom()
    })
  }

  private syncAgents(agents: AgentView[]): void {
    const seen = new Set<string>()
    for (const agent of agents) {
      seen.add(agent.id)
      const existing = this.npcs.get(agent.id)
      if (existing) {
        existing.setAgent(agent)
        continue
      }
      const screen = this.screens[agent.deskIndex]
      if (!screen) continue
      const npc = new AgentNpc(this, agent, screen, this.blockers, (id) => useAppStore.getState().openChat(id))
      this.npcs.set(agent.id, npc)
    }
    for (const [id, npc] of this.npcs) {
      if (!seen.has(id)) {
        npc.destroy()
        this.npcs.delete(id)
      }
    }
  }

  override update(): void {
    const state = useAppStore.getState()
    const blocked = state.modal !== null || state.onboarding || isTypingInUi()
    const k = this.keys
    const interact = Phaser.Input.Keyboard.JustDown(k.e)

    let dx = 0
    let dy = 0
    if (!blocked) {
      if (k.a.isDown || k.left.isDown) dx -= 1
      if (k.d.isDown || k.right.isDown) dx += 1
      if (k.w.isDown || k.up.isDown) dy -= 1
      if (k.s.isDown || k.down.isDown) dy += 1
    }
    this.player.move(dx, dy)

    let nearest: AgentNpc | null = null
    let best = TALK_DISTANCE
    for (const npc of this.npcs.values()) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y)
      if (distance < best) {
        best = distance
        nearest = npc
      }
    }
    const nearId = nearest?.id ?? null
    if (nearId !== this.nearId) {
      if (this.nearId) this.npcs.get(this.nearId)?.setNear(false)
      nearest?.setNear(true)
      this.nearId = nearId
      state.setNearAgent(nearId)
    }

    if (interact && !blocked && nearId) state.openChat(nearId)
  }

  private reportPlayer(): void {
    const snapshot: PlayerState = {
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facing: this.player.facing
    }
    const key = `${snapshot.x},${snapshot.y},${snapshot.facing}`
    if (key === this.lastSaved) return
    this.lastSaved = key
    gameBridge.onPlayerMoved?.(snapshot)
  }
}

import type { PermissionResponse } from '@shared/types'
import { devFlags } from '../env'
import { log } from '../log'
import { AgentContext, type SessionDeps } from './AgentContext'
import { MockSession } from './MockSession'
import { type PermissionHandler, SdkSession } from './SdkSession'
import type { AgentSession } from './types'

export interface PermissionGate {
  request: PermissionHandler
  respond: (agentId: string, response: PermissionResponse) => void
  cancel: (agentId: string) => void
}

/** Creates one session per agent on demand and routes chat commands to it. */
export class SessionManager {
  private readonly sessions = new Map<string, AgentSession>()

  constructor(
    private readonly deps: SessionDeps,
    private readonly permissions: PermissionGate
  ) {}

  private session(agentId: string): AgentSession {
    let session = this.sessions.get(agentId)
    if (!session) {
      const ctx = new AgentContext(agentId, this.deps)
      session = devFlags.mock
        ? new MockSession(ctx, this.permissions)
        : new SdkSession(ctx, this.deps.keys, this.permissions)
      this.sessions.set(agentId, session)
    }
    return session
  }

  isBusy(agentId: string): boolean {
    return this.sessions.get(agentId)?.busy ?? false
  }

  async send(agentId: string, text: string): Promise<void> {
    if (!this.deps.agents.has(agentId)) return
    const session = this.session(agentId)
    if (session.busy) return
    await session.send(text)
  }

  async stop(agentId: string): Promise<void> {
    await this.sessions.get(agentId)?.stop()
  }

  respond(agentId: string, response: PermissionResponse): void {
    this.sessions.get(agentId)?.respond(response)
  }

  /** Ends an agent's process, e.g. before removing it. */
  async forget(agentId: string): Promise<void> {
    const session = this.sessions.get(agentId)
    this.sessions.delete(agentId)
    await session?.close()
  }

  /** Puts every agent to sleep (key changed, app quitting...). */
  async closeAll(): Promise<void> {
    const all = [...this.sessions.entries()]
    this.sessions.clear()
    await Promise.all(
      all.map(async ([agentId, session]) => {
        try {
          await session.close()
        } catch (error) {
          log.warn(`Could not close agent ${agentId}`, error)
        }
      })
    )
  }
}

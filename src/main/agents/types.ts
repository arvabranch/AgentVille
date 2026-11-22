import type { PermissionResponse } from '@shared/types'

/** One agent's conversation backend: the real Agent SDK or the dev mock. */
export interface AgentSession {
  /** True while a reply is being produced. */
  readonly busy: boolean
  send(text: string): Promise<void>
  /** Cuts the reply in progress; the conversation itself continues. */
  stop(): Promise<void>
  respond(response: PermissionResponse): void
  /** Ends the underlying process (the agent "falls asleep"). */
  close(): Promise<void>
}

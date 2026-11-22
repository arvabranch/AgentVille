import type { ChatItem, PermissionResponse } from '@shared/types'
import type { AgentContext } from './AgentContext'
import type { PermissionHandler } from './SdkSession'
import { summarizeTool } from './toolSummary'
import type { AgentSession } from './types'

type ToolItem = Extract<ChatItem, { kind: 'tool' }>

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    })
  })

const reply = (name: string, prompt: string): string => `¡Hola! Soy **${name}** y esto es una respuesta *simulada* (modo de desarrollo, sin llamadas a la API).

Esto es lo que entendí de tu mensaje:

> ${prompt.split('\n')[0]?.slice(0, 140) ?? ''}

Un ejemplo de bloque de código con resaltado:

\`\`\`ts
export function greet(name: string): string {
  return \`Hola, \${name} 👋\`
}
\`\`\`

| Paso | Estado |
| --- | --- |
| Leer el proyecto | ✅ |
| Ejecutar pruebas | ⏳ |

Escribe un mensaje con la palabra **test** para que pida permiso antes de ejecutar un comando, o con **pregunta** para que te haga preguntas.`

/**
 * Dev-only stand-in for the Agent SDK: streams a canned Markdown reply, shows
 * tool activity and permission prompts, and reports fake usage. Lets the UI be
 * developed and tested without an API key or token spend.
 */
export class MockSession implements AgentSession {
  private abort: AbortController | null = null
  private turn = 0

  constructor(
    private readonly ctx: AgentContext,
    private readonly permissions: {
      request: PermissionHandler
      respond: (agentId: string, response: PermissionResponse) => void
      cancel: (agentId: string) => void
    }
  ) {}

  get busy(): boolean {
    return this.abort !== null
  }

  async send(text: string): Promise<void> {
    this.ctx.append({ kind: 'user', text })
    this.ctx.status('working')
    const abort = new AbortController()
    this.abort = abort
    const turn = ++this.turn
    const started = Date.now()
    try {
      await sleep(500, abort.signal)
      await this.tool('Read', { file_path: `${this.ctx.agent.folder}/package.json` }, abort.signal)

      if (/\btest/i.test(text)) {
        const command = 'npm test'
        const decision = await this.permissions.request(this.ctx, 'Bash', { command, description: 'Run the test suite' }, {
          signal: abort.signal,
          suggestions: [
            { type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'npm test:*' }], behavior: 'allow', destination: 'localSettings' }
          ],
          toolUseID: `mock-${turn}`,
          requestId: `mock-${turn}`
        })
        if (decision?.behavior === 'allow') {
          await this.tool('Bash', { command }, abort.signal, '> agentville@0.1.0 test\n\n  ✓ 12 tests passed (340ms)')
        } else {
          this.ctx.notice('stopped', 'Bash')
        }
      }

      let answers = ''
      if (/pregunta|question/i.test(text)) {
        const decision = await this.permissions.request(
          this.ctx,
          'AskUserQuestion',
          {
            questions: [
              {
                question: '¿Qué framework de pruebas prefieres?',
                header: 'Pruebas',
                multiSelect: false,
                options: [
                  { label: 'Vitest', description: 'Rápido y compatible con Vite' },
                  { label: 'Jest', description: 'El clásico' }
                ]
              },
              {
                question: '¿Qué quieres que cubra primero?',
                header: 'Alcance',
                multiSelect: true,
                options: [
                  { label: 'Unitarias', description: 'Funciones puras' },
                  { label: 'Integración', description: 'IPC y almacenamiento' }
                ]
              }
            ]
          },
          { signal: abort.signal, toolUseID: `mock-q-${turn}`, requestId: `mock-q-${turn}` }
        )
        const given = decision?.behavior === 'allow' ? (decision.updatedInput?.['answers'] as Record<string, string> | undefined) : undefined
        answers = given ? Object.entries(given).map(([q, a]) => `- ${q} → **${a}**`).join('\n') : ''
      }

      const id = `mock-${turn}-reply`
      this.ctx.append({ id, kind: 'assistant', text: '', streaming: true })
      const body = answers ? `Gracias, anoto tus respuestas:\n\n${answers}\n\n` + reply(this.ctx.agent.name, text) : reply(this.ctx.agent.name, text)
      for (const word of body.split(/(?<=\s)/)) {
        await sleep(12, abort.signal)
        this.ctx.delta(id, word)
      }
      const item = this.ctx.find(id)
      if (item?.kind === 'assistant') this.ctx.update({ ...item, streaming: false })

      const usage = {
        costUsd: 0.0042 + text.length * 0.00001,
        inputTokens: 1800 + text.length,
        outputTokens: 240,
        cacheReadTokens: 12_400,
        cacheWriteTokens: 900,
        durationMs: Date.now() - started
      }
      this.ctx.finishTurn(usage, this.ctx.agent.sessionCostUsd + usage.costUsd, { isError: false })
      if (!this.ctx.agent.sessionId) this.ctx.setSession(`mock-session-${this.ctx.agentId.slice(0, 8)}`)
    } catch {
      if (abort.signal.aborted) {
        this.ctx.endStreaming()
        this.ctx.notice('stopped')
        this.ctx.status('sleeping')
      }
    } finally {
      if (this.abort === abort) this.abort = null
    }
  }

  private async tool(name: string, input: Record<string, unknown>, signal: AbortSignal, output = 'ok'): Promise<void> {
    const item = this.ctx.append({
      kind: 'tool',
      toolName: name,
      summary: summarizeTool(name, input, this.ctx.agent.folder),
      status: 'running'
    }) as ToolItem
    await sleep(700, signal)
    this.ctx.update({ ...item, status: 'done', output })
  }

  async stop(): Promise<void> {
    this.permissions.cancel(this.ctx.agentId)
    this.abort?.abort()
  }

  respond(response: PermissionResponse): void {
    this.permissions.respond(this.ctx.agentId, response)
  }

  async close(): Promise<void> {
    await this.stop()
  }
}

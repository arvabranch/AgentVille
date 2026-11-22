import type { AgentView, ChatItem, Language } from '@shared/types'

const LABELS = {
  en: {
    title: 'Chat with {name}',
    folder: 'Project folder',
    session: 'Session',
    exported: 'Exported',
    spend: 'Estimated spend',
    replies: 'replies',
    you: 'You',
    permission: 'Permission',
    question: 'Question',
    answer: 'Answer',
    output: 'Output',
    error: 'Error',
    status: {
      pending: 'pending',
      allowed: 'allowed',
      allowedAlways: 'always allowed',
      denied: 'denied',
      cancelled: 'cancelled',
      answered: 'answered',
      dismissed: 'not answered'
    },
    footer: 'Exported from AgentVille. Costs are estimates reported by the Claude Agent SDK.'
  },
  es: {
    title: 'Chat con {name}',
    folder: 'Carpeta del proyecto',
    session: 'Sesión',
    exported: 'Exportado',
    spend: 'Gasto estimado',
    replies: 'respuestas',
    you: 'Tú',
    permission: 'Permiso',
    question: 'Pregunta',
    answer: 'Respuesta',
    output: 'Salida',
    error: 'Error',
    status: {
      pending: 'pendiente',
      allowed: 'permitido',
      allowedAlways: 'permitido siempre',
      denied: 'denegado',
      cancelled: 'cancelado',
      answered: 'respondida',
      dismissed: 'sin respuesta'
    },
    footer: 'Exportado desde AgentVille. Los costos son estimaciones del Claude Agent SDK.'
  }
} as const

/** A code fence longer than any run of backticks inside the content. */
function fence(content: string, lang = ''): string {
  const longest = Math.max(0, ...[...content.matchAll(/`+/g)].map((m) => m[0].length))
  const ticks = '`'.repeat(Math.max(3, longest + 1))
  return `${ticks}${lang}\n${content}\n${ticks}`
}

const time = (ts: number): string => new Date(ts).toLocaleString()
/** Same rounding as the chat UI (more decimals for small amounts). */
const usd = (value: number): string => {
  if (value === 0) return '$0.00'
  if (value < 0.01) return `$${value.toFixed(4)}`
  if (value < 1) return `$${value.toFixed(3)}`
  return `$${value.toFixed(2)}`
}

export function chatToMarkdown(agent: AgentView, items: ChatItem[], language: Language): string {
  const L = LABELS[language]
  const out: string[] = []
  out.push(`# ${L.title.replace('{name}', agent.name)}`, '')
  out.push(`- **${L.folder}:** \`${agent.folder}\``)
  if (agent.sessionId) out.push(`- **${L.session}:** \`${agent.sessionId}\``)
  out.push(`- **${L.exported}:** ${new Date().toLocaleString()}`)
  out.push(
    `- **${L.spend}:** ${usd(agent.usage.costUsd)} (${agent.usage.turns} ${L.replies}, ${agent.usage.inputTokens} in / ${agent.usage.outputTokens} out tokens)`
  )
  out.push('', '---', '')

  for (const item of items) {
    switch (item.kind) {
      case 'user':
        out.push(`### ${L.you} · ${time(item.ts)}`, '', item.text, '')
        break
      case 'assistant':
        out.push(`### ${agent.name} · ${time(item.ts)}`, '', item.text, '')
        break
      case 'tool': {
        const mark = item.status === 'done' ? '✓' : item.status === 'error' ? '✗' : '…'
        out.push(`> 🔧 **${item.toolName}** ${item.summary ? `\`${item.summary.replace(/`/g, "'")}\`` : ''} ${mark}`)
        if (item.output?.trim()) {
          out.push('', `<details><summary>${L.output}</summary>`, '', fence(item.output), '', '</details>')
        }
        out.push('')
        break
      }
      case 'permission': {
        const target =
          item.detail.kind === 'command'
            ? item.detail.command
            : item.detail.kind === 'file'
              ? item.detail.path
              : item.detail.kind === 'fetch'
                ? item.detail.url
                : item.toolName
        out.push(`> 🔐 **${L.permission}** · ${item.toolName}: \`${target.replace(/`/g, "'")}\` → ${L.status[item.status]}`, '')
        break
      }
      case 'question':
        for (const q of item.questions) {
          out.push(`> ❓ **${L.question}:** ${q.question}`)
          const answer = item.answers?.[q.question]
          out.push(`> **${L.answer}:** ${answer ?? L.status[item.status]}`)
        }
        out.push('')
        break
      case 'result':
        out.push(
          `_${usd(item.usage.costUsd)} · ${item.usage.inputTokens} in · ${item.usage.outputTokens} out · ${(item.usage.durationMs / 1000).toFixed(1)}s_`,
          ''
        )
        break
      case 'error':
        out.push(`> ⚠️ **${L.error}:** ${item.text}`, '')
        break
      case 'notice':
        out.push(`_— ${item.code}${item.detail ? `: ${item.detail}` : ''} —_`, '')
        break
    }
  }

  out.push('---', '', `_${L.footer}_`, '')
  return out.join('\n')
}

export function exportFileName(agent: AgentView): string {
  const safe = agent.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'agent'
  const date = new Date().toISOString().slice(0, 10)
  return `${safe}-chat-${date}.md`
}

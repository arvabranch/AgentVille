import path from 'node:path'

const str = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value))

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Path relative to the agent's folder when it lives inside it. */
export function displayPath(filePath: unknown, cwd: string): string {
  const value = str(filePath)
  if (!value) return ''
  const relative = path.relative(cwd, value)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : value
}

/** One-line description of a tool call for the chat timeline. */
export function summarizeTool(name: string, input: Record<string, unknown>, cwd: string): string {
  switch (name) {
    case 'Bash':
      return truncate(str(input['command']), 300)
    case 'Read':
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return displayPath(input['file_path'] ?? input['notebook_path'], cwd)
    case 'Glob':
      return str(input['pattern'])
    case 'Grep':
      return truncate(`${str(input['pattern'])}${input['path'] ? ` · ${displayPath(input['path'], cwd)}` : ''}`, 200)
    case 'WebFetch':
      return str(input['url'])
    case 'WebSearch':
      return str(input['query'])
    case 'Agent':
    case 'Task':
      return str(input['description'])
    case 'TodoWrite':
      return 'todo list'
    default: {
      const json = JSON.stringify(input)
      return truncate(json === '{}' ? '' : json, 200)
    }
  }
}

/** Extracts readable text from a tool_result content payload. */
export function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block: unknown) => {
        if (block && typeof block === 'object' && 'type' in block) {
          const typed = block as { type: string; text?: unknown }
          if (typed.type === 'text') return str(typed.text)
          return `[${typed.type}]`
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

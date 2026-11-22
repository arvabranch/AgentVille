/**
 * Minimal logger for the main process. Every message passes through `redact`
 * so an Anthropic API key can never end up in the terminal or a log file, even
 * if some library error message happens to echo it back.
 */

const KEY_PATTERN = /sk-ant-[A-Za-z0-9_-]{4,}/g
const ENV_KEY_PATTERN = /(ANTHROPIC_API_KEY["'\s:=]+)[^\s"',}]+/g

export function redact(input: string): string {
  return input.replace(KEY_PATTERN, 'sk-ant-***').replace(ENV_KEY_PATTERN, '$1***')
}

function format(args: unknown[]): string {
  return redact(
    args
      .map((arg) => {
        if (arg instanceof Error) return arg.stack ?? arg.message
        if (typeof arg === 'string') return arg
        try {
          return JSON.stringify(arg)
        } catch {
          return String(arg)
        }
      })
      .join(' ')
  )
}

const debugEnabled = process.env['AGENTVILLE_DEBUG'] === '1'

export const log = {
  info: (...args: unknown[]): void => console.info(`[agentville] ${format(args)}`),
  warn: (...args: unknown[]): void => console.warn(`[agentville] ${format(args)}`),
  error: (...args: unknown[]): void => console.error(`[agentville] ${format(args)}`),
  debug: (...args: unknown[]): void => {
    if (debugEnabled) console.info(`[agentville:debug] ${format(args)}`)
  }
}

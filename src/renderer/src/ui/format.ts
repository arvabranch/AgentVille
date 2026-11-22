/** Formats an estimated cost in US dollars, keeping small amounts readable. */
export function formatUsd(value: number): string {
  if (value === 0) return '$0.00'
  if (value < 0.01) return `$${value.toFixed(4)}`
  if (value < 1) return `$${value.toFixed(3)}`
  return `$${value.toFixed(2)}`
}

export function formatTokens(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`
  return `${(value / 1_000_000).toFixed(2)}M`
}

/** Extracts the `[code]` prefix the main process puts in error messages. */
export function errorCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error)
  return /\[(\w+)\]/.exec(message)?.[1] ?? null
}

export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '').replace(/^\[\w+\]\s*/, '')
}

/** Last part of a path, for short folder labels. */
export function baseName(folder: string): string {
  const parts = folder.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? folder
}

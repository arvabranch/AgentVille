import { app } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { log } from '../log'

/**
 * Environment for agent processes. Every Anthropic / Claude Code variable from
 * the parent environment is dropped so an agent can only authenticate with the
 * user's API key — never with a claude.ai subscription, a gateway token or a
 * cloud provider inherited from wherever AgentVille was launched.
 */
const DROP = /^(ANTHROPIC_|CLAUDE|npm_)/i
const KEEP = new Set(['CLAUDE_CONFIG_DIR'])

let shellPath: string | null = null

export function buildAgentEnv(apiKey: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined) continue
    if (DROP.test(name) && !KEEP.has(name)) continue
    if (name.startsWith('ELECTRON_') || name === 'NODE_OPTIONS') continue
    env[name] = value
  }
  if (shellPath) env['PATH'] = shellPath
  env['ANTHROPIC_API_KEY'] = apiKey
  env['CLAUDE_AGENT_SDK_CLIENT_APP'] = `agentville/${app.getVersion()}`
  return env
}

/**
 * Apps opened from the Dock/Finder get a minimal PATH, so agents could not find
 * node, git or brew. Ask the user's login shell for its PATH once at startup.
 */
export function resolveShellPath(): Promise<void> {
  if (!app.isPackaged || process.platform === 'win32') return Promise.resolve()
  const shell = process.env['SHELL'] || '/bin/zsh'
  return new Promise((resolve) => {
    execFile(
      shell,
      ['-ilc', 'printf "__AGENTVILLE__%s__AGENTVILLE__" "$PATH"'],
      { timeout: 5000, env: { ...process.env, DISABLE_AUTO_UPDATE: 'true' } },
      (error, stdout) => {
        const match = /__AGENTVILLE__(.*?)__AGENTVILLE__/s.exec(stdout ?? '')
        if (match?.[1]) shellPath = match[1]
        else if (error) log.warn('Could not read PATH from the login shell')
        resolve()
      }
    )
  })
}

/**
 * The SDK finds its native Claude Code binary through `require.resolve`, which
 * points inside `app.asar` in packaged builds. Binaries must run from the
 * unpacked copy, so pass that path explicitly.
 */
export function claudeExecutablePath(): string | undefined {
  if (!app.isPackaged) return undefined
  const require = createRequire(import.meta.url)
  const ext = process.platform === 'win32' ? '.exe' : ''
  const base = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`
  const candidates = process.platform === 'linux' ? [`${base}-musl`, base] : [base]
  for (const pkg of candidates) {
    try {
      const resolved = require.resolve(`${pkg}/claude${ext}`)
      const unpacked = resolved.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)
      if (existsSync(unpacked)) return unpacked
    } catch {
      // try the next candidate
    }
  }
  return undefined
}

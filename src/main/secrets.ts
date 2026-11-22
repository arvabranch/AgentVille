import Anthropic, { APIConnectionError, AuthenticationError, PermissionDeniedError } from '@anthropic-ai/sdk'
import { app, safeStorage } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { KeyStatus, SaveKeyResult } from '@shared/types'
import { isDev } from './env'
import { log } from './log'

/**
 * Dev-only escape hatch for contributors and automated tests: a key given in
 * AGENTVILLE_DEV_API_KEY is used without storing it. Ignored in packaged builds.
 */
const devKey = (): string | null => (isDev ? process.env['AGENTVILLE_DEV_API_KEY'] || null : null)

const KEY_FORMAT = /^sk-ant-[A-Za-z0-9_-]{20,}$/

/**
 * Stores the user's Anthropic API key encrypted with the OS keychain
 * (Electron `safeStorage`). The key is never written in plain text, never sent
 * to the renderer and never logged; only the main process can read it.
 */
export class KeyStore {
  private cached: string | null | undefined

  private get file(): string {
    return path.join(app.getPath('userData'), 'secrets.bin')
  }

  status(): KeyStatus {
    const encryption = encryptionState()
    return {
      hasKey: devKey() !== null || existsSync(this.file),
      encryptionAvailable: encryption.ok,
      encryptionIssue: encryption.issue
    }
  }

  async get(): Promise<string | null> {
    const fromEnv = devKey()
    if (fromEnv) return fromEnv
    if (this.cached !== undefined) return this.cached
    if (!existsSync(this.file) || !encryptionState().ok) return (this.cached = null)
    try {
      const encrypted = await readFile(this.file)
      this.cached = safeStorage.decryptString(encrypted)
    } catch (error) {
      log.error('Could not decrypt the stored API key', error)
      this.cached = null
    }
    return this.cached
  }

  async save(rawKey: string): Promise<SaveKeyResult> {
    const key = rawKey.trim()
    if (!KEY_FORMAT.test(key) || key.startsWith('sk-ant-admin')) return { ok: false, error: 'format' }
    if (!encryptionState().ok) return { ok: false, error: 'encryption' }

    const check = await verifyKey(key)
    if (check === 'invalid') return { ok: false, error: 'invalid' }

    try {
      await writeFile(this.file, safeStorage.encryptString(key), { mode: 0o600 })
      this.cached = key
    } catch (error) {
      log.error('Could not store the API key', error)
      return { ok: false, error: 'unknown' }
    }
    return { ok: true, status: this.status(), warning: check === 'unverified' ? 'offline' : undefined }
  }

  async clear(): Promise<KeyStatus> {
    await rm(this.file, { force: true })
    this.cached = null
    return this.status()
  }
}

function encryptionState(): { ok: boolean; issue?: string } {
  if (!app.isReady()) return { ok: false, issue: 'not-ready' }
  if (!safeStorage.isEncryptionAvailable()) return { ok: false, issue: 'unavailable' }
  if (process.platform === 'linux') {
    // Without a keyring Electron falls back to a hard-coded password: not safe.
    const backend = safeStorage.getSelectedStorageBackend()
    if (backend === 'basic_text' || backend === 'unknown') return { ok: false, issue: 'no-keyring' }
  }
  return { ok: true }
}

/** Checks the key with a cheap, free call (list models). */
async function verifyKey(key: string): Promise<'valid' | 'invalid' | 'unverified'> {
  const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 12_000 })
  try {
    await client.models.list({ limit: 1 })
    return 'valid'
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) return 'invalid'
    if (error instanceof APIConnectionError) return 'unverified'
    log.warn('Unexpected error while checking the API key', error instanceof Error ? error.message : error)
    return 'unverified'
  }
}

import { app } from 'electron'
import type { Language, SettingsView } from '@shared/types'

export interface StoredSettings {
  language: SettingsView['language']
}

export const defaultSettings = (): StoredSettings => ({ language: 'system' })

/** User preferences (language for now). Persisted by the app store. */
export class Settings {
  private value: StoredSettings = defaultSettings()
  private readonly listeners = new Set<() => void>()

  load(value: Partial<StoredSettings> | undefined): void {
    this.value = { ...defaultSettings(), ...value }
  }

  get raw(): StoredSettings {
    return { ...this.value }
  }

  /** The language actually in use (resolves "system"). */
  resolvedLanguage(): Language {
    if (this.value.language !== 'system') return this.value.language
    return app.getLocale().toLowerCase().startsWith('es') ? 'es' : 'en'
  }

  view(): SettingsView {
    return { language: this.value.language, dataDir: app.getPath('userData') }
  }

  setLanguage(language: StoredSettings['language']): SettingsView {
    this.value = { ...this.value, language }
    for (const listener of this.listeners) listener()
    return this.view()
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

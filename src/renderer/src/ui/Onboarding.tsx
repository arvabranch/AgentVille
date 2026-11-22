import { useState } from 'react'
import { api } from '../api'
import { type MessageKey, useT } from '../i18n'
import { useAppStore } from '../state/store'
import { Icon } from './Icon'

const SAVE_ERRORS: Record<string, MessageKey> = {
  format: 'key.format',
  invalid: 'key.invalid',
  encryption: 'key.encryption',
  unknown: 'key.unknown'
}

/** Key entry used by the first-run screen and by Settings. */
export function KeyForm({ onSaved, submitLabel }: { onSaved?: () => void; submitLabel: string }): React.JSX.Element {
  const t = useT()
  const setKeyStatus = useAppStore((s) => s.setKeyStatus)
  const toast = useAppStore((s) => s.toast)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (): Promise<void> => {
    if (!key.trim()) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.invoke('key:save', key.trim())
      if (result.ok) {
        setKey('')
        setKeyStatus(result.status)
        toast(result.warning === 'offline' ? t('key.offline') : t('key.saved'), 'success')
        onSaved?.()
      } else {
        setError(t(SAVE_ERRORS[result.error] ?? 'key.unknown'))
      }
    } catch {
      setError(t('key.unknown'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <label className="field">
        <span>{t('onboarding.keyLabel')}</span>
        <input
          type="password"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={key}
          placeholder={t('onboarding.keyPlaceholder')}
          onChange={(event) => setKey(event.target.value)}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="key-form-actions">
        <button type="button" className="btn-link" onClick={() => void api.invoke('app:openExternal', 'apiKeys')}>
          {t('onboarding.getKey')} <Icon name="external" size={12} />
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || !key.trim()}>
          {busy ? t('onboarding.saving') : submitLabel}
        </button>
      </div>
    </form>
  )
}

/** First-run screen: bring your own Anthropic API key. */
export function Onboarding(): React.JSX.Element {
  const t = useT()
  const keyStatus = useAppStore((s) => s.keyStatus)
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-logo" aria-hidden="true" />
        <h1 className="brand">{t('onboarding.title')}</h1>
        <p className="muted">{t('onboarding.subtitle')}</p>
        <div className="onboarding-section">
          <h3>
            <Icon name="key" /> {t('onboarding.byok')}
          </h3>
          <p>{t('onboarding.byokBody')}</p>
        </div>
        {keyStatus && !keyStatus.encryptionAvailable ? (
          <p className="form-error">{t('key.encryption')}</p>
        ) : (
          <KeyForm submitLabel={t('onboarding.save')} />
        )}
        <p className="onboarding-disclaimer">{t('onboarding.disclaimer')}</p>
      </div>
    </div>
  )
}

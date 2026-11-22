import { useEffect, useState } from 'react'
import type { SettingsView, UsageTotals } from '@shared/types'
import { api } from '../api'
import { useT } from '../i18n'
import { useAppStore } from '../state/store'
import { formatTokens, formatUsd } from './format'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { KeyForm } from './Onboarding'

export function SettingsDialog(): React.JSX.Element {
  const t = useT()
  const closeModal = useAppStore((s) => s.closeModal)
  const keyStatus = useAppStore((s) => s.keyStatus)
  const setKeyStatus = useAppStore((s) => s.setKeyStatus)
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const agents = useAppStore((s) => s.agents)
  const info = useAppStore((s) => s.info)
  const toast = useAppStore((s) => s.toast)
  const [editingKey, setEditingKey] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [totals, setTotals] = useState<UsageTotals | null>(null)

  useEffect(() => {
    void api.invoke('usage:totals').then(setTotals)
  }, [agents])

  const deleteKey = async (): Promise<void> => {
    const status = await api.invoke('key:clear')
    setKeyStatus(status)
    setConfirmDelete(false)
    toast(t('key.cleared'))
  }

  const setLanguage = async (language: SettingsView['language']): Promise<void> => {
    setSettings(await api.invoke('settings:setLanguage', language))
  }

  return (
    <Modal title={t('settings.title')} onClose={closeModal} width={620}>
      <section className="settings-section">
        <h3>{t('settings.apiKey')}</h3>
        <div className="settings-row">
          <span className={keyStatus?.hasKey ? 'key-state key-ok' : 'key-state'}>
            <Icon name={keyStatus?.hasKey ? 'check' : 'key'} size={14} />
            {keyStatus?.hasKey ? t('settings.keyStored') : t('settings.keyMissing')}
          </span>
          <div className="settings-actions">
            {!editingKey && (
              <button className="btn btn-small" onClick={() => setEditingKey(true)}>
                {keyStatus?.hasKey ? t('settings.changeKey') : t('settings.addKey')}
              </button>
            )}
            {keyStatus?.hasKey && !confirmDelete && (
              <button className="btn btn-small btn-danger" onClick={() => setConfirmDelete(true)}>
                {t('settings.deleteKey')}
              </button>
            )}
          </div>
        </div>
        {confirmDelete && (
          <div className="confirm">
            <p>{t('settings.deleteKeyConfirm')}</p>
            <div className="settings-actions">
              <button className="btn btn-small btn-ghost" onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn-small btn-danger" onClick={() => void deleteKey()}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        )}
        {editingKey && <KeyForm submitLabel={t('common.save')} onSaved={() => setEditingKey(false)} />}
      </section>

      <section className="settings-section">
        <h3>{t('settings.console')}</h3>
        <div className="settings-actions">
          <button className="btn btn-small" onClick={() => void api.invoke('app:openExternal', 'billing')}>
            {t('settings.billing')} <Icon name="external" size={12} />
          </button>
          <button className="btn btn-small" onClick={() => void api.invoke('app:openExternal', 'usage')}>
            {t('settings.usage')} <Icon name="external" size={12} />
          </button>
          <button className="btn btn-small" onClick={() => void api.invoke('app:openExternal', 'apiKeys')}>
            {t('settings.keys')} <Icon name="external" size={12} />
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.costs')}</h3>
        <table className="usage-table">
          <thead>
            <tr>
              <th>{t('settings.agent')}</th>
              <th>{t('settings.turns')}</th>
              <th>{t('settings.tokens')}</th>
              <th>{t('settings.cost')}</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td>{agent.name}</td>
                <td>{agent.usage.turns}</td>
                <td>{formatTokens(agent.usage.inputTokens + agent.usage.outputTokens)}</td>
                <td>{formatUsd(agent.usage.costUsd)}</td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr>
                <td>{t('settings.total')}</td>
                <td>{totals.turns}</td>
                <td>{formatTokens(totals.inputTokens + totals.outputTokens)}</td>
                <td>{formatUsd(totals.costUsd)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        <p className="settings-note">{t('settings.costsNote')}</p>
      </section>

      <section className="settings-section settings-grid">
        <label className="field">
          <span>{t('settings.language')}</span>
          <select
            className="input"
            value={settings?.language ?? 'system'}
            onChange={(event) => void setLanguage(event.target.value as SettingsView['language'])}
          >
            <option value="system">{t('settings.languageSystem')}</option>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
        <div className="field">
          <span>{t('settings.dataDir')}</span>
          <code className="data-dir" title={settings?.dataDir}>
            {settings?.dataDir}
          </code>
        </div>
      </section>

      <section className="settings-section settings-about">
        <h3>{t('settings.about')}</h3>
        <p>
          AgentVille v{info?.version} · {t('settings.disclaimer')}
        </p>
        <button className="btn-link" onClick={() => void api.invoke('app:openExternal', 'repo')}>
          {t('settings.repo')} <Icon name="external" size={12} />
        </button>
      </section>
    </Modal>
  )
}

import { useMemo, useState } from 'react'
import { MAX_AGENT_NAME } from '@shared/constants'
import { api } from '../api'
import { type MessageKey, useT } from '../i18n'
import { useAppStore } from '../state/store'
import { errorCode, errorMessage } from './format'
import { Icon } from './Icon'
import { Modal } from './Modal'

const NAME_IDEAS = ['Ada', 'Grace', 'Linus', 'Alan', 'Margaret', 'Hedy', 'Dennis', 'Barbara', 'Ken', 'Katherine', 'Guido', 'Frances']

const ERROR_KEYS: Record<string, MessageKey> = {
  noDesk: 'newAgent.full',
  badFolder: 'newAgent.badFolder',
  badName: 'newAgent.badName'
}

export function NewAgentDialog(): React.JSX.Element {
  const t = useT()
  const closeModal = useAppStore((s) => s.closeModal)
  const toast = useAppStore((s) => s.toast)
  const agents = useAppStore((s) => s.agents)
  const suggestion = useMemo(() => {
    const used = new Set(agents.map((agent) => agent.name))
    return NAME_IDEAS.find((name) => !used.has(name)) ?? 'Agent'
  }, [agents])

  const [name, setName] = useState(suggestion)
  const [folder, setFolder] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickFolder = async (): Promise<void> => {
    const chosen = await api.invoke('agents:pickFolder')
    if (chosen) {
      setFolder(chosen)
      setError(null)
    }
  }

  const create = async (): Promise<void> => {
    if (!folder || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const agent = await api.invoke('agents:create', { name: name.trim(), folder })
      toast(t('newAgent.created', { name: agent.name }), 'success')
      closeModal()
    } catch (err) {
      const code = errorCode(err)
      const key = code ? ERROR_KEYS[code] : undefined
      setError(key ? t(key) : t('common.error', { message: errorMessage(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('newAgent.title')}
      subtitle={t('newAgent.subtitle')}
      onClose={closeModal}
      footer={
        <>
          <button className="btn btn-ghost" onClick={closeModal}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={() => void create()} disabled={busy || !folder || !name.trim()}>
            {busy ? t('newAgent.creating') : t('newAgent.create')}
          </button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault()
          void create()
        }}
      >
        <label className="field">
          <span>{t('newAgent.name')}</span>
          <input
            autoFocus
            value={name}
            maxLength={MAX_AGENT_NAME}
            placeholder={t('newAgent.namePlaceholder')}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="field">
          <span>{t('newAgent.folder')}</span>
          <div className="folder-picker">
            <Icon name="folder" />
            <span className={folder ? 'folder-path' : 'folder-path muted'} title={folder ?? undefined}>
              {folder ?? t('newAgent.noFolder')}
            </span>
            <button type="button" className="btn btn-small" onClick={() => void pickFolder()}>
              {folder ? t('newAgent.changeFolder') : t('newAgent.pickFolder')}
            </button>
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

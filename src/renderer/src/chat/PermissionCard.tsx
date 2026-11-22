import type { AgentView, ChatItem, PermissionDetail } from '@shared/types'
import { api } from '../api'
import { type MessageKey, useT } from '../i18n'
import { Icon } from '../ui/Icon'

type PermissionItem = Extract<ChatItem, { kind: 'permission' }>

function actionKey(detail: PermissionDetail): MessageKey {
  switch (detail.kind) {
    case 'command':
      return 'perm.command'
    case 'fetch':
      return 'perm.fetch'
    case 'file':
      return detail.action === 'write' ? 'perm.write' : detail.action === 'read' ? 'perm.read' : 'perm.edit'
    default:
      return 'perm.generic'
  }
}

function Detail({ detail }: { detail: PermissionDetail }): React.JSX.Element {
  switch (detail.kind) {
    case 'command':
      return (
        <>
          {detail.description && <p className="perm-description">{detail.description}</p>}
          <pre className="perm-code">
            <span className="perm-prompt">$ </span>
            {detail.command}
          </pre>
        </>
      )
    case 'file':
      return (
        <>
          <code className="perm-path">{detail.path}</code>
          {detail.preview && (
            <pre className="perm-code perm-diff">
              {detail.preview.split('\n').map((line, i) => (
                <span key={i} className={line.startsWith('+ ') ? 'diff-add' : line.startsWith('- ') ? 'diff-del' : undefined}>
                  {line}
                  {'\n'}
                </span>
              ))}
            </pre>
          )}
        </>
      )
    case 'fetch':
      return <code className="perm-path">{detail.url}</code>
    case 'generic':
      return <pre className="perm-code">{detail.input}</pre>
  }
}

/** Approval card shown when an agent wants to run a command, edit a file, etc. */
export function PermissionCard({ item, agent }: { item: PermissionItem; agent: AgentView }): React.JSX.Element {
  const t = useT()
  const respond = (decision: 'allow' | 'allowAlways' | 'deny'): void => {
    void api.invoke('chat:respondPermission', agent.id, { requestId: item.requestId, decision })
  }
  const pending = item.status === 'pending'

  return (
    <div className={`perm-card perm-${item.status}`}>
      <div className="perm-head">
        <Icon name={item.detail.kind === 'command' ? 'terminal' : 'alert'} size={15} />
        <span>{t('perm.title', { name: agent.name })}</span>
      </div>
      <div className="perm-action">{t(actionKey(item.detail), { tool: item.toolName })}</div>
      <Detail detail={item.detail} />
      {item.reason && <p className="perm-reason">{t('perm.reason', { reason: item.reason })}</p>}

      {pending ? (
        <div className="perm-buttons">
          <button className="btn btn-ok" data-action="perm-allow" onClick={() => respond('allow')}>
            {t('perm.allow')}
          </button>
          {item.alwaysRule && (
            <button className="btn" data-action="perm-always" title={item.alwaysRule} onClick={() => respond('allowAlways')}>
              {t('perm.allowAlways')}
            </button>
          )}
          <button className="btn btn-danger" data-action="perm-deny" onClick={() => respond('deny')}>
            {t('perm.deny')}
          </button>
        </div>
      ) : (
        <div className="perm-status">
          {item.status === 'allowed' && t('perm.allowed')}
          {item.status === 'allowedAlways' && t('perm.allowedAlways', { rule: item.alwaysRule ?? item.toolName })}
          {item.status === 'denied' && t('perm.denied')}
          {item.status === 'cancelled' && t('perm.cancelled')}
        </div>
      )}
    </div>
  )
}

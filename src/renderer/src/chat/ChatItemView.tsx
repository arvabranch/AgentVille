import { memo, useState } from 'react'
import type { AgentView, ChatErrorCode, ChatItem, NoticeCode } from '@shared/types'
import { api } from '../api'
import { type MessageKey, useT } from '../i18n'
import { formatTokens, formatUsd } from '../ui/format'
import { Icon } from '../ui/Icon'
import { Markdown } from './Markdown'
import { PermissionCard } from './PermissionCard'
import { QuestionCard } from './QuestionCard'

const NOTICE_KEYS: Record<NoticeCode, MessageKey> = {
  stopped: 'chat.stopped',
  resumed: 'chat.resumed',
  resumeFailed: 'chat.resumeFailed',
  compacted: 'chat.compacted',
  retrying: 'chat.retrying',
  permissionUnavailable: 'chat.permissionUnavailable'
}

const ERROR_KEYS: Partial<Record<ChatErrorCode, MessageKey>> = {
  authentication_failed: 'error.auth',
  billing_error: 'error.billing',
  rate_limit: 'error.rateLimit',
  overloaded: 'error.overloaded',
  model_not_found: 'error.model',
  max_output_tokens: 'error.maxTokens',
  noKey: 'error.noKey',
  subscriptionBlocked: 'error.subscription',
  crash: 'error.crash'
}

function ToolRow({ item }: { item: Extract<ChatItem, { kind: 'tool' }> }): React.JSX.Element {
  const t = useT()
  const [open, setOpen] = useState(false)
  const hasOutput = Boolean(item.output?.trim())
  return (
    <div className={`tool-row tool-${item.status}`}>
      <button className="tool-line" onClick={() => hasOutput && setOpen(!open)} disabled={!hasOutput}>
        <span className="tool-state">{item.status === 'running' ? <span className="spinner" /> : item.status === 'done' ? '✓' : '✕'}</span>
        <span className="tool-name">{item.toolName}</span>
        <span className="tool-summary">{item.summary}</span>
        {hasOutput && <Icon name="chevron" size={12} className={open ? 'chevron open' : 'chevron'} />}
      </button>
      {open && hasOutput && (
        <div className="tool-output" aria-label={t('chat.toolOutput')}>
          <pre>{item.output}</pre>
        </div>
      )}
    </div>
  )
}

function ResultLine({ item }: { item: Extract<ChatItem, { kind: 'result' }> }): React.JSX.Element {
  const t = useT()
  const { usage } = item
  const tokens = t('chat.tokens', { input: formatTokens(usage.inputTokens), output: formatTokens(usage.outputTokens) })
  const cache = t('chat.cache', { read: formatTokens(usage.cacheReadTokens), write: formatTokens(usage.cacheWriteTokens) })
  return (
    <div className="result-line" title={`${tokens} · ${cache}`}>
      <span className="result-cost">{formatUsd(usage.costUsd)}</span>
      <span>{tokens}</span>
      {usage.cacheReadTokens + usage.cacheWriteTokens > 0 && <span className="result-cache">{cache}</span>}
      <span>{t('chat.duration', { seconds: (usage.durationMs / 1000).toFixed(1) })}</span>
    </div>
  )
}

function ErrorBox({ item }: { item: Extract<ChatItem, { kind: 'error' }> }): React.JSX.Element {
  const t = useT()
  const key = item.code ? ERROR_KEYS[item.code] : undefined
  return (
    <div className="chat-error">
      <Icon name="alert" size={15} />
      <div>
        {key && <p className="chat-error-title">{t(key)}</p>}
        {item.text && <p className="chat-error-detail">{item.text}</p>}
        {item.code === 'billing_error' && (
          <button className="btn-link" onClick={() => void api.invoke('app:openExternal', 'billing')}>
            {t('settings.billing')} <Icon name="external" size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

export const ChatItemView = memo(function ChatItemView({ item, agent }: { item: ChatItem; agent: AgentView }) {
  const t = useT()
  switch (item.kind) {
    case 'user':
      return (
        <div className="msg msg-user">
          <div className="bubble">{item.text}</div>
        </div>
      )
    case 'assistant':
      return (
        <div className="msg msg-agent">
          <Markdown text={item.text} streaming={item.streaming} />
          {item.streaming && <span className="caret" />}
        </div>
      )
    case 'tool':
      return <ToolRow item={item} />
    case 'permission':
      return <PermissionCard item={item} agent={agent} />
    case 'question':
      return <QuestionCard item={item} agent={agent} />
    case 'result':
      return <ResultLine item={item} />
    case 'error':
      return <ErrorBox item={item} />
    case 'notice':
      return <div className="notice">{t(NOTICE_KEYS[item.code], { detail: item.detail ?? '' })}</div>
  }
})

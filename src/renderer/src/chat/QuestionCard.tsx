import { useState } from 'react'
import type { AgentView, ChatItem } from '@shared/types'
import { api } from '../api'
import { useT } from '../i18n'
import { Icon } from '../ui/Icon'

type QuestionItem = Extract<ChatItem, { kind: 'question' }>

/** Multiple-choice questions the agent asks through `AskUserQuestion`. */
export function QuestionCard({ item, agent }: { item: QuestionItem; agent: AgentView }): React.JSX.Element {
  const t = useT()
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [other, setOther] = useState<Record<string, string>>({})
  const pending = item.status === 'pending'

  const toggle = (question: string, label: string, multi: boolean): void => {
    setSelected((current) => {
      const now = current[question] ?? []
      const next = multi ? (now.includes(label) ? now.filter((l) => l !== label) : [...now, label]) : [label]
      return { ...current, [question]: next }
    })
    if (!multi) setOther((current) => ({ ...current, [question]: '' }))
  }

  const answerFor = (question: string): string => {
    const typed = other[question]?.trim()
    if (typed) return typed
    return (selected[question] ?? []).join(', ')
  }

  const complete = item.questions.every((q) => answerFor(q.question))

  const submit = (): void => {
    const answers = Object.fromEntries(item.questions.map((q) => [q.question, answerFor(q.question)]))
    void api.invoke('chat:respondPermission', agent.id, { requestId: item.requestId, decision: 'answer', answers })
  }

  const dismiss = (): void => {
    void api.invoke('chat:respondPermission', agent.id, { requestId: item.requestId, decision: 'dismiss' })
  }

  return (
    <div className={`perm-card question-card question-${item.status}`}>
      <div className="perm-head">
        <Icon name="alert" size={15} />
        <span>{t('question.title', { name: agent.name })}</span>
      </div>
      {item.questions.map((q) => (
        <fieldset key={q.question} className="question" disabled={!pending}>
          <legend>
            {q.header && <span className="question-chip">{q.header}</span>}
            {q.question}
          </legend>
          <div className="question-options">
            {q.options.map((option) => {
              const active = (selected[q.question] ?? []).includes(option.label) || item.answers?.[q.question]?.split(', ').includes(option.label)
              return (
                <button
                  key={option.label}
                  type="button"
                  className={`question-option${active ? ' active' : ''}`}
                  onClick={() => toggle(q.question, option.label, q.multiSelect)}
                >
                  <span className={q.multiSelect ? 'check-box' : 'radio'} />
                  <span>
                    <strong>{option.label}</strong>
                    {option.description && <small>{option.description}</small>}
                  </span>
                </button>
              )
            })}
          </div>
          {pending && (
            <input
              className="input question-other"
              placeholder={t('question.other')}
              value={other[q.question] ?? ''}
              onChange={(event) => setOther((current) => ({ ...current, [q.question]: event.target.value }))}
            />
          )}
        </fieldset>
      ))}
      {pending ? (
        <div className="perm-buttons">
          <button className="btn btn-primary" data-action="question-submit" onClick={submit} disabled={!complete}>
            {t('question.submit')}
          </button>
          <button className="btn btn-ghost" onClick={dismiss}>
            {t('question.dismiss')}
          </button>
        </div>
      ) : (
        <div className="perm-status">
          {item.status === 'answered' ? t('question.answered') : item.status === 'cancelled' ? t('perm.cancelled') : t('question.dismissed')}
        </div>
      )}
    </div>
  )
}

import type { AgentView, ChatItem } from '@shared/types'

/** Clarifying-question card (filled in with the permissions step). */
export function QuestionCard(_props: { item: Extract<ChatItem, { kind: 'question' }>; agent: AgentView }): null {
  return null
}

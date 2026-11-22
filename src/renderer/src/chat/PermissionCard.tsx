import type { AgentView, ChatItem } from '@shared/types'

/** Tool approval card (filled in with the permissions step). */
export function PermissionCard(_props: { item: Extract<ChatItem, { kind: 'permission' }>; agent: AgentView }): null {
  return null
}

import { app, type BrowserWindow, Notification } from 'electron'
import type { AgentStatus } from '@shared/types'
import type { AgentManager } from './agents/AgentManager'
import { emit } from './ipc'
import type { Settings } from './settings'

const TEXT = {
  es: {
    attention: '{name} necesita tu permiso para continuar.',
    finished: '{name} terminó de responder.',
    error: '{name} tuvo un problema.'
  },
  en: {
    attention: '{name} needs your approval to continue.',
    finished: '{name} finished replying.',
    error: '{name} ran into a problem.'
  }
} as const

/**
 * While the window is in the background, tell the user when an agent needs
 * approval, finishes a reply or fails. Clicking the notification opens its chat.
 */
export function watchAgentsForNotifications(
  agents: AgentManager,
  settings: Settings,
  getWindow: () => BrowserWindow | null
): void {
  let previous = new Map<string, { status: AgentStatus; unread: boolean }>()
  const snapshot = (): void => {
    previous = new Map(agents.list().map((agent) => [agent.id, { status: agent.status, unread: agent.unread }]))
  }
  snapshot()

  agents.onChange(() => {
    const win = getWindow()
    const quiet = !win || win.isDestroyed() || win.isFocused() || !Notification.isSupported()
    if (!quiet) {
      const setting = settings.raw.language
      const language = setting === 'system' ? (app.getLocale().startsWith('es') ? 'es' : 'en') : setting
      for (const agent of agents.list()) {
        const before = previous.get(agent.id)
        if (!before) continue
        let kind: keyof (typeof TEXT)['en'] | null = null
        if (agent.status === 'attention' && before.status !== 'attention') kind = 'attention'
        else if (agent.status === 'error' && before.status !== 'error') kind = 'error'
        else if (agent.unread && !before.unread && agent.status === 'sleeping') kind = 'finished'
        if (!kind) continue
        const notification = new Notification({ title: agent.name, body: TEXT[language][kind].replace('{name}', agent.name) })
        notification.on('click', () => {
          win.show()
          win.focus()
          emit('ui:openAgent', agent.id)
        })
        notification.show()
      }
    }
    snapshot()
  })
}

import { create } from 'zustand'
import type {
  AgentView,
  AppInfo,
  ChatEvent,
  ChatItem,
  KeyStatus,
  Language,
  SettingsView
} from '@shared/types'

export type Modal = 'newAgent' | 'settings' | null

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'success' | 'error'
}

interface AppState {
  info: AppInfo | null
  keyStatus: KeyStatus | null
  settings: SettingsView | null
  language: Language
  agents: AgentView[]
  chats: Record<string, ChatItem[]>
  openAgentId: string | null
  nearAgentId: string | null
  modal: Modal
  toasts: Toast[]

  setInfo: (info: AppInfo) => void
  setKeyStatus: (status: KeyStatus) => void
  setSettings: (settings: SettingsView) => void
  setAgents: (agents: AgentView[]) => void
  setChat: (agentId: string, items: ChatItem[]) => void
  applyChatEvent: (event: ChatEvent) => void
  openChat: (agentId: string) => void
  closeChat: () => void
  setNearAgent: (agentId: string | null) => void
  openModal: (modal: Exclude<Modal, null>) => void
  closeModal: () => void
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
}

let toastId = 0

export function systemLanguage(): Language {
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function resolveLanguage(setting: SettingsView['language'] | undefined): Language {
  return !setting || setting === 'system' ? systemLanguage() : setting
}

export const useAppStore = create<AppState>()((set, get) => ({
  info: null,
  keyStatus: null,
  settings: null,
  language: systemLanguage(),
  agents: [],
  chats: {},
  openAgentId: null,
  nearAgentId: null,
  modal: null,
  toasts: [],

  setInfo: (info) => set({ info }),
  setKeyStatus: (keyStatus) => set({ keyStatus }),
  setSettings: (settings) => set({ settings, language: resolveLanguage(settings.language) }),
  setAgents: (agents) => {
    const { openAgentId } = get()
    const stillOpen = openAgentId && agents.some((agent) => agent.id === openAgentId)
    set({ agents, openAgentId: stillOpen ? openAgentId : null })
  },
  setChat: (agentId, items) => set((state) => ({ chats: { ...state.chats, [agentId]: items } })),

  applyChatEvent: (event) =>
    set((state) => {
      const current = state.chats[event.agentId]
      if (event.type === 'reset') return { chats: { ...state.chats, [event.agentId]: event.items } }
      if (!current) return {}
      let next: ChatItem[] = current
      if (event.type === 'append') {
        next = [...current, event.item]
      } else if (event.type === 'update') {
        const index = current.findIndex((item) => item.id === event.item.id)
        next = index === -1 ? [...current, event.item] : current.map((item, i) => (i === index ? event.item : item))
      } else if (event.type === 'delta') {
        next = current.map((item) =>
          item.id === event.itemId && item.kind === 'assistant' ? { ...item, text: item.text + event.text } : item
        )
      }
      return { chats: { ...state.chats, [event.agentId]: next } }
    }),

  openChat: (agentId) => set({ openAgentId: agentId, modal: null }),
  closeChat: () => set({ openAgentId: null }),
  setNearAgent: (nearAgentId) => {
    if (get().nearAgentId !== nearAgentId) set({ nearAgentId })
  },
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),

  toast: (text, tone = 'info') => {
    const id = ++toastId
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, text, tone }] }))
    window.setTimeout(() => get().dismissToast(id), tone === 'error' ? 6000 : 3500)
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
}))

/** True while the user is typing somewhere, so game keys must be ignored. */
export function isTypingInUi(): boolean {
  const el = document.activeElement
  if (!el || el === document.body) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable
}

import { useCallback } from 'react'
import type { Language } from '@shared/types'
import { useAppStore } from '../state/store'
import { en } from './en'
import { es, type Messages } from './es'

export type MessageKey = keyof Messages

const dictionaries: Record<Language, Messages> = { es, en }

export function translate(language: Language, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[language][key] ?? dictionaries.en[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

export function useT(): Translate {
  const language = useAppStore((state) => state.language)
  return useCallback((key, vars) => translate(language, key, vars), [language])
}

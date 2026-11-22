import { app, session, shell } from 'electron'
import { APP_ORIGIN } from './protocol'
import { rendererDevUrl } from './env'
import { log } from './log'

/** True for pages that belong to the app itself (bundled UI or dev server). */
export function isTrustedUrl(url: string): boolean {
  if (url.startsWith(`${APP_ORIGIN}/`)) return true
  if (rendererDevUrl && url.startsWith(rendererDevUrl)) return true
  return false
}

/** Opens a link in the user's browser. Only plain https links are allowed. */
export function openExternalSafe(rawUrl: string): void {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return
  }
  if (url.protocol !== 'https:') {
    log.warn(`Refused to open non-https link: ${url.protocol}`)
    return
  }
  void shell.openExternal(url.toString())
}

/**
 * Applies Electron's security checklist to every web contents the app creates:
 * no new windows, no navigation away from the app, no <webview>, and no
 * browser permissions (camera, mic, notifications...) except clipboard writes.
 */
export function hardenApp(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      openExternalSafe(url)
      return { action: 'deny' }
    })
    const blockNavigation = (event: { preventDefault: () => void }, url: string): void => {
      if (!isTrustedUrl(url)) {
        event.preventDefault()
        openExternalSafe(url)
      }
    }
    contents.on('will-navigate', blockNavigation)
    contents.on('will-redirect', blockNavigation)
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })

  const allowed = new Set(['clipboard-sanitized-write'])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowed.has(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission))
}

import { net, protocol } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Production builds load the UI from `app://agentville/` instead of `file://`,
 * as recommended by Electron's security checklist. The handler only serves
 * files that live inside the bundled renderer folder.
 */
export const APP_SCHEME = 'app'
export const APP_HOST = 'agentville'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

/** Must run before the `ready` event. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true }
    }
  ])
}

export function handleAppProtocol(rendererRoot: string): void {
  const root = path.resolve(rendererRoot)
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.host !== APP_HOST) return new Response('Not found', { status: 404 })

    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/' || pathname === '') pathname = '/index.html'

    const filePath = path.resolve(root, `.${pathname}`)
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      return new Response('Forbidden', { status: 403 })
    }
    try {
      return await net.fetch(pathToFileURL(filePath).toString())
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

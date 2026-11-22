import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))

const alias = {
  '@shared': resolve(root, 'src/shared')
}

/**
 * Content Security Policy for the renderer.
 *
 * Production is strict: only our own bundled files, no inline scripts, no
 * remote origins. Development relaxes `script-src` / `connect-src` just enough
 * for Vite's dev server, HMR websocket and React Fast Refresh preamble.
 */
const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws://localhost:* http://localhost:*",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

function cspPlugin(): Plugin {
  return {
    name: 'agentville:csp',
    transformIndexHtml(html, ctx) {
      return html.replace('%AGENTVILLE_CSP%', ctx.server ? DEV_CSP : PROD_CSP)
    }
  }
}

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      externalizeDeps: true
    }
  },
  preload: {
    resolve: { alias },
    build: {
      externalizeDeps: true,
      rolldownOptions: {
        // Sandboxed preload scripts must be CommonJS.
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        ...alias,
        '@renderer': resolve(root, 'src/renderer/src')
      }
    },
    plugins: [react(), cspPlugin()],
    build: {
      // Phaser alone is ~1 MB minified; this is a desktop app, not a website.
      chunkSizeWarningLimit: 2500,
      // Never inline assets as data: URIs; the production CSP only allows 'self'.
      assetsInlineLimit: 0
    }
  }
})

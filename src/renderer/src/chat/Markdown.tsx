import 'highlight.js/styles/github-dark.css'
import { memo, type ReactNode, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { api } from '../api'
import { useT } from '../i18n'
import { Icon } from '../ui/Icon'

function CodeBlock({ children }: { children?: ReactNode }): React.JSX.Element {
  const t = useT()
  const ref = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const copy = (): void => {
    const text = ref.current?.innerText ?? ''
    void api.invoke('app:copyText', text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    })
  }
  return (
    <div className="code-block">
      <button className="code-copy" onClick={copy} title={t('common.copy')}>
        <Icon name={copied ? 'check' : 'copy'} size={13} />
        {copied ? t('common.copied') : t('common.copy')}
      </button>
      <pre ref={ref}>{children}</pre>
    </div>
  )
}

const components: Components = {
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  a: ({ href, children }) => (
    <a
      href={href}
      title={href}
      onClick={(event) => {
        event.preventDefault()
        if (href && /^https?:\/\//i.test(href)) void api.invoke('app:openUrl', href)
      }}
    >
      {children}
    </a>
  )
}

const plugins = [remarkGfm]
const highlighting = [rehypeHighlight]
const noHighlighting: [] = []

/**
 * Renders agent replies. Raw HTML is never rendered (react-markdown default)
 * and links open in the system browser. Syntax highlighting is skipped while a
 * message is still streaming to keep typing smooth.
 */
export const Markdown = memo(function Markdown({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={plugins}
        rehypePlugins={streaming ? noHighlighting : highlighting}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})

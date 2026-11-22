import { useEffect, type ReactNode } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'

interface ModalProps {
  title: string
  subtitle?: string
  onClose?: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}

export function Modal({ title, subtitle, onClose, children, footer, width = 460 }: ModalProps): React.JSX.Element {
  const t = useT()

  useEffect(() => {
    if (!onClose) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className="modal" style={{ width }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          {onClose && (
            <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label={t('common.close')}>
              <Icon name="close" />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

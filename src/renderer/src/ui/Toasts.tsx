import { useAppStore } from '../state/store'

export function Toasts(): React.JSX.Element {
  const toasts = useAppStore((s) => s.toasts)
  const dismiss = useAppStore((s) => s.dismissToast)
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} className={`toast toast-${toast.tone}`} onClick={() => dismiss(toast.id)}>
          {toast.text}
        </button>
      ))}
    </div>
  )
}

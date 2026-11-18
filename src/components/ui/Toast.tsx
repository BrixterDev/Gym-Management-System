import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

interface ToastApi {
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastApi | undefined>(undefined)

const toneStyles: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-emerald-400' },
  error: { icon: XCircle, className: 'text-rose-400' },
  info: { icon: Info, className: 'text-brand-400' },
  warning: { icon: TriangleAlert, className: 'text-amber-400' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = ++counter.current
      setItems((current) => [...current.slice(-3), { id, tone, title, description }])
      window.setTimeout(() => dismiss(id), 5000)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      info: (title, description) => push('info', title, description),
      warning: (title, description) => push('warning', title, description),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:right-6 lg:left-auto lg:items-end"
      >
        {items.map((item) => {
          const { icon: Icon, className } = toneStyles[item.tone]
          return (
            <div
              key={item.id}
              className="glass-panel pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl p-3.5"
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', className)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-100">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{item.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="flex size-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
                aria-label="Dismiss notification"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

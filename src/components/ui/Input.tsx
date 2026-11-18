import { type InputHTMLAttributes, forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leadingIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leadingIcon, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="w-full min-w-0">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-300">
          {label}
          {props.required && <span className="ml-0.5 text-rose-400">*</span>}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            'h-11 w-full min-w-0 max-w-full rounded-xl border bg-white/[0.045] px-3 text-base text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors placeholder:text-slate-500 sm:text-sm',
            'focus:border-brand-400 focus:bg-white/[0.06] focus:ring-2 focus:ring-brand-400/25 focus:outline-none',
            error
              ? 'border-rose-400/60 focus:border-rose-400 focus:ring-rose-400/25'
              : 'border-white/10 hover:border-white/20',
            leadingIcon && 'pl-9',
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-rose-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="w-full min-w-0">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        aria-invalid={Boolean(error)}
        className={cn(
          'min-h-[88px] w-full min-w-0 max-w-full resize-none rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-base text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-500 sm:text-sm',
          'hover:border-white/20 focus:border-brand-400 focus:bg-white/[0.06] focus:ring-2 focus:ring-brand-400/25 focus:outline-none',
          error && 'border-rose-400/60',
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-rose-300">{error}</p>}
    </div>
  )
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export function Select({ label, error, className, id, children, ...props }: SelectProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className="w-full min-w-0">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <select
        id={inputId}
        aria-invalid={Boolean(error)}
        className={cn(
          'h-11 w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-white/[0.045] px-3 text-base text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:text-sm',
          'hover:border-white/20 focus:border-brand-400 focus:bg-white/[0.06] focus:ring-2 focus:ring-brand-400/25 focus:outline-none',
          error && 'border-rose-400/60',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1.5 text-xs text-rose-300">{error}</p>}
    </div>
  )
}

import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'border border-brand-400/30 bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_24px_-14px_rgba(47,129,255,0.9)] hover:from-brand-400 hover:to-brand-500 focus-visible:outline-brand-400 disabled:from-brand-600/40 disabled:to-brand-600/40 disabled:text-white/60',
  secondary:
    'border border-white/10 bg-white/10 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/15 focus-visible:outline-slate-300 disabled:bg-white/5 disabled:text-slate-500',
  outline:
    'border border-white/15 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10 focus-visible:outline-slate-300 disabled:bg-transparent disabled:text-slate-600',
  ghost:
    'text-slate-300 hover:bg-white/[0.08] hover:text-white focus-visible:outline-slate-300 disabled:text-slate-600',
  danger:
    'border border-rose-400/30 bg-rose-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_-14px_rgba(225,29,72,0.85)] hover:bg-rose-500 focus-visible:outline-rose-400 disabled:bg-rose-600/40 disabled:text-white/60',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-[color,background-color,border-color,box-shadow,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
})

import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-ink hover:brightness-110',
  secondary: 'bg-surface-2 text-text border border-line hover:bg-line/60',
  ghost: 'text-muted hover:text-text',
  danger: 'bg-transparent text-red-300 border border-red-400/40 hover:bg-red-400/10',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition ' +
        'disabled:cursor-not-allowed disabled:opacity-40 ' +
        VARIANTS[variant] +
        ' ' +
        className
      }
    />
  )
}

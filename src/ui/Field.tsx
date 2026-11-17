import type { ReactNode } from 'react'

const inputClass =
  'w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted/60 focus:border-accent'

interface BaseProps {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: ReactNode
  placeholder?: string
  maxLength?: number
}

function Counter({ value, maxLength }: { value: string; maxLength?: number }) {
  if (!maxLength) return null
  const over = value.length > maxLength
  return (
    <span className={'text-xs ' + (over ? 'text-red-300' : 'text-muted')}>
      {value.length}/{maxLength}
    </span>
  )
}

export function TextField({ label, value, onChange, hint, placeholder, maxLength }: BaseProps) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Counter value={value} maxLength={maxLength} />
      </span>
      {hint && <span className="mb-2 block text-xs text-muted">{hint}</span>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass + ' min-h-11'}
      />
    </label>
  )
}

export function TextArea({ label, value, onChange, hint, placeholder, maxLength, rows = 4 }: BaseProps & { rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Counter value={value} maxLength={maxLength} />
      </span>
      {hint && <span className="mb-2 block text-xs text-muted">{hint}</span>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={inputClass + ' resize-y'}
      />
    </label>
  )
}

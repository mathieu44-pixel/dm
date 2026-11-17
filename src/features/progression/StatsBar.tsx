import { useState } from 'react'
import { statLevel } from '../../engine/progression/rules'
import type { StatDef } from '../../engine/progression/types'

/** Jauges affichées en haut de l'écran de jeu, repliables. */
export function StatsBar({ defs, values }: { defs: StatDef[]; values: Record<string, number> }) {
  const [open, setOpen] = useState(true)
  if (!defs.length) return null

  return (
    <div className="border-b border-line bg-ink/95 px-4 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs text-muted"
        aria-expanded={open}
      >
        <span>Jauges</span>
        <span>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
          {defs.map((d) => {
            const value = values[d.id] ?? d.initial
            const ratio = (value - d.min) / (d.max - d.min || 1)
            const label = d.levels[statLevel(d, value)]
            return (
              <li key={d.id} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate">
                    {d.icon && <span className="mr-1">{d.icon}</span>}
                    {d.name}
                  </span>
                  <span className="shrink-0 text-muted">{label || value}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round(ratio * 100)}%`, background: d.color }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

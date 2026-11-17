import { useState } from 'react'
import { statLevel } from '../../engine/progression/rules'
import type { StatDef } from '../../engine/progression/types'

/**
 * Jauges toujours visibles sous l'en-tête du jeu.
 * Repliées : une ligne compacte (icône + mini-barre). Dépliées : nom, niveau et barre.
 */
export function StatsBar({ defs, values }: { defs: StatDef[]; values: Record<string, number> }) {
  const [open, setOpen] = useState(false)
  if (!defs.length) return null

  return (
    <div className="border-b border-line px-4 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-xs text-muted"
        aria-expanded={open}
        aria-label={open ? 'Replier les jauges' : 'Afficher le détail des jauges'}
      >
        {open ? (
          <span className="flex-1 text-left">Jauges</span>
        ) : (
          <span className="flex flex-1 items-center gap-3 overflow-hidden">
            {defs.map((d) => {
              const value = values[d.id] ?? d.initial
              const ratio = (value - d.min) / (d.max - d.min || 1)
              return (
                <span key={d.id} className="flex min-w-0 flex-1 items-center gap-1.5" title={`${d.name} : ${value}`}>
                  <span className="shrink-0">{d.icon || '•'}</span>
                  <span className="h-1.5 min-w-6 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full transition-all duration-700" style={{ width: `${Math.round(ratio * 100)}%`, background: d.color }} />
                  </span>
                </span>
              )
            })}
          </span>
        )}
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
                <div className="text-xs leading-snug">
                  <span className="break-words">
                    {d.icon && <span className="mr-1">{d.icon}</span>}
                    {d.name}
                  </span>
                  <span className="block text-muted">
                    {label ? `${label} · ` : ''}
                    {value}
                  </span>
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

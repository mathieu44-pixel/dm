import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { resetCostLedger, useCostLedger } from '../../data/costs'
import { db } from '../../data/db'
import { monthKey, monthLabel, totalOf } from '../../engine/llm/costs'
import { formatUsd } from '../../engine/llm/models'
import { CostDetails } from '../../ui/CostDetails'

/** Dépenses (v0.9) : par mois et par catégorie, puis par histoire. */
export function SpendingPanel() {
  const ledger = useCostLedger()
  const byStory = useLiveQuery(async () => {
    const [sessions, stories] = await Promise.all([db.sessions.toArray(), db.stories.toArray()])
    const titles = new Map(stories.map((s) => [s.id, s.title]))
    const sums = new Map<string, { usd: number; tokens: number }>()
    for (const s of sessions) {
      const prev = sums.get(s.storyId) ?? { usd: 0, tokens: 0 }
      const t = totalOf(s.costs)
      sums.set(s.storyId, { usd: prev.usd + s.costUsd, tokens: prev.tokens + t.inputTokens + t.outputTokens })
    }
    return [...sums]
      .map(([id, v]) => ({ id, title: titles.get(id) ?? 'Histoire supprimée', ...v }))
      .filter((r) => r.usd > 0 || r.tokens > 0)
      .sort((a, b) => b.usd - a.usd || b.tokens - a.tokens)
      .slice(0, 8)
  }, [])
  const months = Object.keys(ledger ?? {}).sort().reverse()
  const [selected, setSelected] = useState<string | null>(null)
  const month = selected ?? months[0] ?? monthKey(Date.now())

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <div>
        <h2 className="text-base font-semibold">Dépenses</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Estimations calculées par l'application à partir des jetons et des tarifs publics. La facture fait foi sur la console
          du fournisseur.
        </p>
      </div>

      {months.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {months.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelected(m)}
              className={'shrink-0 rounded-full border px-3 py-1 text-xs ' + (m === month ? 'border-accent text-accent' : 'border-line text-muted')}
            >
              {monthLabel(m)}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-xl bg-surface-2 p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted">{monthLabel(month)}</p>
        <CostDetails breakdown={ledger?.[month]} />
      </div>

      {byStory && byStory.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted">Par histoire (parties existantes)</p>
          <ul className="space-y-1 text-sm">
            {byStory.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span className="truncate">{r.title}</span>
                <span className="shrink-0 tabular-nums">{formatUsd(r.usd)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {months.length > 0 && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Effacer l’historique des dépenses mensuelles ? Le coût de chaque partie est conservé.')) void resetCostLedger()
          }}
          className="text-xs text-muted underline"
        >
          Effacer l'historique mensuel
        </button>
      )}
    </section>
  )
}

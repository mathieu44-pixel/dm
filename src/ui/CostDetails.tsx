import { COST_KINDS, formatTokens, totalOf, type CostBreakdown } from '../engine/llm/costs'
import { formatUsd } from '../engine/llm/models'

/**
 * Détail des coûts par catégorie (dollars, appels, jetons).
 * `knownTotalUsd` : coût total connu par ailleurs ; l'écart avec le détail correspond aux appels d'avant la v0.9.
 */
export function CostDetails({ breakdown, knownTotalUsd }: { breakdown: CostBreakdown | undefined; knownTotalUsd?: number }) {
  const total = totalOf(breakdown)
  const legacy = knownTotalUsd !== undefined ? knownTotalUsd - total.usd : 0
  const rows = COST_KINDS.filter((k) => breakdown?.[k.id]?.calls)
  if (!rows.length && legacy < 0.0001)
    return <p className="text-xs text-muted">Aucun appel enregistré pour l'instant.</p>
  return (
    <div className="space-y-2 text-sm">
      {rows.map((k) => {
        const t = breakdown![k.id]!
        return (
          <div key={k.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              {k.label}
              <span className="block text-xs text-muted">
                {t.calls} appel{t.calls > 1 ? 's' : ''} · {formatTokens(t.inputTokens)} jetons lus · {formatTokens(t.outputTokens)} écrits
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{formatUsd(t.usd)}</span>
          </div>
        )
      })}
      {legacy >= 0.0001 && (
        <div className="flex items-baseline justify-between gap-3 text-muted">
          <span>Non détaillé (avant la v0.9)</span>
          <span className="shrink-0 tabular-nums">{formatUsd(legacy)}</span>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2 font-medium">
        <span>Total</span>
        <span className="tabular-nums">{formatUsd(total.usd + Math.max(0, legacy))}</span>
      </div>
      {total.calls > 0 && total.usd === 0 && (
        <p className="text-xs text-muted">Offre gratuite : rien n'est facturé, mais les jetons sont comptés pour estimer le coût avec Claude.</p>
      )}
    </div>
  )
}

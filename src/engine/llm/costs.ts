import type { LlmUsage } from './types'

/**
 * Suivi détaillé des coûts (v0.9) : par catégorie d'appel, en dollars et en jetons.
 * Les jetons sont comptés même avec une offre gratuite (Gemini), pour estimer le coût futur.
 */

export type CostKind = 'story' | 'analysis' | 'summary' | 'command' | 'creation'

export interface CostTotals {
  usd: number
  calls: number
  inputTokens: number
  outputTokens: number
}

export type CostBreakdown = Partial<Record<CostKind, CostTotals>>

/** Dépenses par mois (« 2026-11 »). */
export type CostLedger = Record<string, CostBreakdown>

export const COST_KINDS: { id: CostKind; label: string; hint: string }[] = [
  { id: 'story', label: 'Narration', hint: 'Réponses, régénérations, suites' },
  { id: 'analysis', label: 'Analyse des tours', hint: 'Suggestions, mémoire, jauges, images' },
  { id: 'summary', label: 'Résumés', hint: 'Résumé glissant des longues parties' },
  { id: 'command', label: 'Commandes', hint: '/GrantAlias…' },
  { id: 'creation', label: 'Assistant de création', hint: 'Histoires générées' },
]

export const EMPTY_TOTALS: CostTotals = { usd: 0, calls: 0, inputTokens: 0, outputTokens: 0 }

/** Ajoute un appel à un bilan (sans modifier l'original). */
export function addCost(breakdown: CostBreakdown | undefined, kind: CostKind, costUsd: number, usage?: Partial<LlmUsage>): CostBreakdown {
  const prev = breakdown?.[kind] ?? EMPTY_TOTALS
  const input = (usage?.inputTokens ?? 0) + (usage?.cacheReadTokens ?? 0) + (usage?.cacheWriteTokens ?? 0)
  return {
    ...breakdown,
    [kind]: {
      usd: prev.usd + (Number.isFinite(costUsd) ? costUsd : 0),
      calls: prev.calls + 1,
      inputTokens: prev.inputTokens + input,
      outputTokens: prev.outputTokens + (usage?.outputTokens ?? 0),
    },
  }
}

export function totalOf(breakdown: CostBreakdown | undefined): CostTotals {
  return Object.values(breakdown ?? {}).reduce<CostTotals>(
    (acc, t) => ({
      usd: acc.usd + t.usd,
      calls: acc.calls + t.calls,
      inputTokens: acc.inputTokens + t.inputTokens,
      outputTokens: acc.outputTokens + t.outputTokens,
    }),
    EMPTY_TOTALS,
  )
}

export function mergeBreakdowns(...list: (CostBreakdown | undefined)[]): CostBreakdown {
  const out: CostBreakdown = {}
  for (const b of list)
    for (const [kind, t] of Object.entries(b ?? {}) as [CostKind, CostTotals][]) {
      const prev = out[kind] ?? EMPTY_TOTALS
      out[kind] = {
        usd: prev.usd + t.usd,
        calls: prev.calls + t.calls,
        inputTokens: prev.inputTokens + t.inputTokens,
        outputTokens: prev.outputTokens + t.outputTokens,
      }
    }
  return out
}

export function monthKey(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** « 2026-11 » → « novembre 2026 ». */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

/** Ajoute un appel au registre mensuel. */
export function addToLedger(ledger: CostLedger | undefined, timestamp: number, kind: CostKind, costUsd: number, usage?: Partial<LlmUsage>): CostLedger {
  const key = monthKey(timestamp)
  return { ...ledger, [key]: addCost(ledger?.[key], kind, costUsd, usage) }
}

/** 950 → « 950 », 12 345 → « 12,3 k », 2 400 000 → « 2,4 M ». */
export function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n))
  const fmt = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
  return n < 1_000_000 ? `${fmt(n / 1000)} k` : `${fmt(n / 1_000_000)} M`
}

import type { Comparator, Condition, ConditionItem, EndingDef, ReachedEnding, StatDef } from './types'

/**
 * Règles déterministes : l'IA propose des variations, l'application décide
 * (bornes des jauges, conditions de fin). Aucune décision n'est laissée au hasard du modèle.
 */

export type StatValues = Record<string, number>

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Valeurs de départ ; une valeur existante (partie en cours) est conservée et bornée. */
export function initStats(defs: StatDef[], current: StatValues = {}): StatValues {
  const values: StatValues = {}
  for (const d of defs) {
    const v = current[d.id]
    values[d.id] = clamp(typeof v === 'number' && Number.isFinite(v) ? v : d.initial, d.min, d.max)
  }
  return values
}

/**
 * Applique des variations proposées par l'IA. Chaque variation est limitée
 * à la moitié de l'amplitude de la jauge, puis la valeur est bornée.
 */
export function applyDeltas(defs: StatDef[], values: StatValues, deltas: { statId: string; delta: number }[]): StatValues {
  const next = initStats(defs, values)
  for (const { statId, delta } of deltas) {
    const def = defs.find((d) => d.id === statId)
    if (!def || !Number.isFinite(delta) || delta === 0) continue
    const maxStep = Math.max(1, Math.round((def.max - def.min) / 2))
    next[statId] = clamp(next[statId] + clamp(Math.round(delta), -maxStep, maxStep), def.min, def.max)
  }
  return next
}

/** Niveau (bas / moyen / haut) d'une jauge, par tiers. */
export function statLevel(def: StatDef, value: number): 'low' | 'mid' | 'high' {
  const span = def.max - def.min || 1
  const ratio = (value - def.min) / span
  return ratio < 1 / 3 ? 'low' : ratio < 2 / 3 ? 'mid' : 'high'
}

export function describeStat(def: StatDef, value: number): string {
  const label = def.levels[statLevel(def, value)].trim()
  return `${def.name} : ${value}/${def.max}${label ? ` (${label})` : ''}`
}

function compare(a: number, cmp: Comparator, b: number): boolean {
  switch (cmp) {
    case '>=':
      return a >= b
    case '<=':
      return a <= b
    case '>':
      return a > b
    case '<':
      return a < b
    case '==':
      return a === b
  }
}

function isCondition(item: ConditionItem): item is Condition {
  return 'op' in item
}

export interface ConditionContext {
  turn: number
  stats: StatValues
  /** Affinités des personnages rencontrés (v1.4). */
  affinities?: Record<string, number>
}

export function evaluateCondition(condition: Condition, ctx: ConditionContext): boolean {
  if (condition.items.length === 0) return false
  const test = (item: ConditionItem): boolean => {
    if (isCondition(item)) return evaluateCondition(item, ctx)
    if (item.type === 'turn') return ctx.turn >= item.gte
    if (item.type === 'affinity') {
      const affinity = ctx.affinities?.[item.characterId]
      return typeof affinity === 'number' && compare(affinity, item.cmp, item.value)
    }
    const value = ctx.stats[item.statId]
    return typeof value === 'number' && compare(value, item.cmp, item.value)
  }
  return condition.op === 'AND' ? condition.items.every(test) : condition.items.some(test)
}

/** Première fin (dans l'ordre défini) dont la condition est remplie et qui n'a pas encore été atteinte. */
export function findTriggeredEnding(
  endings: EndingDef[],
  ctx: ConditionContext,
  reached: ReachedEnding[] = [],
): EndingDef | undefined {
  const done = new Set(reached.map((r) => r.endingId))
  return endings.find((e) => !done.has(e.id) && evaluateCondition(e.condition, ctx))
}

/** Description lisible d'une condition (pour l'éditeur et la carte de fin). */
export function describeCondition(condition: Condition, defs: StatDef[], characters: { id: string; name: string }[] = []): string {
  const cmp = (c: Comparator) => (c === '==' ? '=' : c.replace('>=', '≥').replace('<=', '≤'))
  const parts = condition.items.map((item): string => {
    if (isCondition(item)) return `(${describeCondition(item, defs, characters)})`
    if (item.type === 'turn') return `tour ≥ ${item.gte}`
    if (item.type === 'affinity') {
      const who = characters.find((c) => c.id === item.characterId)?.name || 'personnage retiré'
      return `affinité ${who} ${cmp(item.cmp)} ${item.value}`
    }
    const name = defs.find((d) => d.id === item.statId)?.name ?? 'jauge supprimée'
    return `${name} ${cmp(item.cmp)} ${item.value}`
  })
  return parts.join(condition.op === 'AND' ? ' ET ' : ' OU ')
}

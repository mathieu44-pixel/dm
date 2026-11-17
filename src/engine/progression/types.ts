/**
 * Stats (jauges) et fins d'une histoire, comme dans OOC :
 * jusqu'à 7 jauges et 10 fins par point de départ.
 */

export interface StatDef {
  id: string
  name: string
  /** Emoji affiché devant la jauge. */
  icon: string
  /** Couleur de la jauge (#rrggbb). */
  color: string
  min: number
  max: number
  initial: number
  /** Libellés facultatifs pour le tiers bas, moyen et haut de la jauge. */
  levels: { low: string; mid: string; high: string }
  /** Quand la jauge monte ou baisse, en langage courant (lu par l'IA). */
  rulesText: string
}

export type Comparator = '>=' | '<=' | '>' | '<' | '=='

export type ConditionItem =
  | { type: 'turn'; gte: number }
  | { type: 'stat'; statId: string; cmp: Comparator; value: number }
  | Condition

export interface Condition {
  op: 'AND' | 'OR'
  items: ConditionItem[]
}

export type Rarity = 'N' | 'R' | 'SR' | 'SSR'

export interface EndingDef {
  id: string
  name: string
  rarity: Rarity
  /** Texte court affiché sur la carte de fin. */
  cardText: string
  /** Épilogue révélé quand on retourne la carte. */
  epilogue: string
  condition: Condition
}

export interface ReachedEnding {
  endingId: string
  turn: number
  reachedAt: number
}

export const PROGRESSION_LIMITS = { stats: 7, endings: 10 } as const

export const RARITIES: { id: Rarity; label: string; color: string }[] = [
  { id: 'N', label: 'Commune', color: '#9a93ab' },
  { id: 'R', label: 'Rare', color: '#5fa8e8' },
  { id: 'SR', label: 'Super rare', color: '#c27be8' },
  { id: 'SSR', label: 'Légendaire', color: '#e8b04b' },
]

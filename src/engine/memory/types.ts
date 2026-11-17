/**
 * Mémoire d'une partie (équivalent des « Memories » d'OOC).
 * - long     : souvenirs à long terme, écrits ou validés par le joueur (100 max)
 * - fact     : faits importants relevés automatiquement par l'IA
 * - relation : état des relations entre le joueur et les personnages
 * - goal     : objectifs en cours
 */
export type MemoryKind = 'long' | 'fact' | 'relation' | 'goal'

export interface MemoryEntry {
  id: string
  sessionId: string
  kind: MemoryKind
  text: string
  source: 'user' | 'ai'
  createdAt: number
  updatedAt: number
}

/** Résumé glissant des échanges anciens, retirés du contexte envoyé à l'IA. */
export interface SessionSummary {
  text: string
  /** Dernier message couvert par le résumé (sur le fil actif). */
  coversUntilId: string
  updatedAt: number
}

export const MEMORY_LIMITS = {
  long: 100,
  /** Mémoire automatique (faits + relations + objectifs) : au-delà, les plus anciens faits sont oubliés. */
  auto: 40,
  sessionNotes: 4000,
  globalNotes: 2000,
  entryText: 300,
} as const

export const MEMORY_LABELS: Record<MemoryKind, string> = {
  long: 'Souvenir',
  fact: 'Fait',
  relation: 'Relation',
  goal: 'Objectif',
}

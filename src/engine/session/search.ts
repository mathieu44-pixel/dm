import type { ThreadEntry } from './types'

/** Recherche dans une partie (v0.9) : sans tenir compte de la casse ni des accents. */

export interface SearchHit {
  id: string
  role: 'user' | 'ai'
  /** Position du message dans le fil (0 = prologue). */
  index: number
  /** Nombre d'occurrences dans le message. */
  count: number
  before: string
  match: string
  after: string
}

/** Texte normalisé et, pour chaque caractère normalisé, sa position dans l'original. */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = ''
  const map: number[] = []
  let i = 0
  for (const ch of text) {
    const n = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    for (let k = 0; k < n.length; k++) map.push(i)
    norm += n
    i += ch.length
  }
  return { norm, map }
}

export function normalizeQuery(query: string): string {
  return normalizeWithMap(query.trim().replace(/\s+/g, ' ')).norm
}

/** Retire les marques de mise en forme pour l'aperçu. */
function clean(text: string): string {
  return text.replace(/[「」*]/g, '').replace(/\s+/g, ' ')
}

export function searchEntries(entries: ThreadEntry[], query: string, options: { context?: number; max?: number } = {}): SearchHit[] {
  const context = options.context ?? 40
  const max = options.max ?? 100
  const q = normalizeQuery(query)
  if (q.length < 2) return []
  const hits: SearchHit[] = []
  entries.forEach((entry, index) => {
    if (hits.length >= max) return
    const text = clean(entry.content)
    const { norm, map } = normalizeWithMap(text)
    const first = norm.indexOf(q)
    if (first < 0) return
    let count = 0
    for (let at = first; at >= 0; at = norm.indexOf(q, at + q.length)) count++
    const start = map[first]
    const endNorm = first + q.length - 1
    const end = endNorm < map.length ? map[endNorm] + 1 : text.length
    const from = Math.max(0, start - context)
    const to = Math.min(text.length, end + context)
    hits.push({
      id: entry.id,
      role: entry.role,
      index,
      count,
      before: (from > 0 ? '…' : '') + text.slice(from, start),
      match: text.slice(start, end),
      after: text.slice(end, to) + (to < text.length ? '…' : ''),
    })
  })
  return hits
}

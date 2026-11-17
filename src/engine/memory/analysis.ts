import type { LlmRequest } from '../llm/types'
import { parseSuggestions } from '../prompt/suggestions'
import type { ThreadEntry } from '../session/types'
import { MEMORY_LIMITS, type MemoryEntry, type MemoryKind } from './types'

/**
 * Analyse de fin de tour (modèle « tâches internes ») : en un seul appel,
 * l'IA propose 3 actions au joueur et met à jour la mémoire automatique.
 */

const RECENT_ENTRIES = 6
const AUTO_KINDS: MemoryKind[] = ['fact', 'relation', 'goal']

export interface TurnAnalysis {
  suggestions: string[]
  add: { kind: MemoryKind; text: string }[]
  removeIds: string[]
}

/** Alias courts (m1, m2…) : plus fiables pour l'IA que des identifiants longs. */
export function aliasMemories(memories: MemoryEntry[]): Map<string, MemoryEntry> {
  return new Map(memories.map((m, i) => [`m${i + 1}`, m]))
}

export function buildTurnAnalysisRequest(
  model: string,
  playerName: string,
  entries: ThreadEntry[],
  autoMemories: MemoryEntry[],
): LlmRequest {
  const transcript = entries
    .filter((e) => !e.ooc)
    .slice(-RECENT_ENTRIES)
    .map((e) => `${e.role === 'user' ? `JOUEUR (${playerName})` : 'NARRATRICE'} :\n${e.content}`)
    .join('\n\n')

  const memoryList = [...aliasMemories(autoMemories)]
    .map(([alias, m]) => `${alias} [${m.kind}] ${m.text}`)
    .join('\n')

  return {
    model,
    maxTokens: 1500,
    temperature: 0.7,
    system:
      "Tu es l'assistante d'une histoire interactive. Tu proposes des actions au joueur et tu tiens à jour la mémoire de la partie. " +
      'Réponds uniquement avec un objet JSON valide, sans aucun autre texte.',
    messages: [
      {
        role: 'user',
        content: [
          `Mémoire actuelle de la partie :\n${memoryList || '(vide)'}`,
          '',
          `Fin de l'histoire en cours :\n\n${transcript}`,
          '',
          'Réponds avec ce JSON :',
          '{',
          `  "suggestions": ["…", "…", "…"],`,
          '  "add": [{ "type": "fact" | "relation" | "goal", "text": "…" }],',
          '  "remove": ["m2"]',
          '}',
          '',
          `- suggestions : 3 actions courtes et variées que ${playerName} pourrait faire maintenant, à la première personne (une prudente, une audacieuse, une qui fait parler un personnage), 15 mots maximum chacune.`,
          '- add : 0 à 3 informations NOUVELLES et durables apparues dans les derniers échanges (fact = fait important découvert ; relation = changement dans la relation entre le joueur et un personnage ; goal = objectif en cours). Une phrase de 20 mots maximum, à la troisième personne. N\'ajoute rien de déjà présent dans la mémoire.',
          '- remove : alias des éléments de mémoire devenus faux, obsolètes ou des objectifs accomplis.',
        ].join('\n'),
      },
    ],
  }
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

/** Lecture tolérante de la réponse. En cas de JSON illisible : suggestions seules, mémoire inchangée. */
export function parseTurnAnalysis(text: string, autoMemories: MemoryEntry[]): TurnAnalysis {
  const data = extractJsonObject(text) as { suggestions?: unknown; add?: unknown; remove?: unknown } | null
  if (!data || typeof data !== 'object') return { suggestions: parseSuggestions(text), add: [], removeIds: [] }

  const suggestions = Array.isArray(data.suggestions) ? parseSuggestions(JSON.stringify(data.suggestions)) : []

  const add: TurnAnalysis['add'] = []
  if (Array.isArray(data.add)) {
    for (const item of data.add) {
      if (typeof item !== 'object' || item === null) continue
      const { type, text: itemText } = item as { type?: unknown; text?: unknown }
      if (typeof itemText !== 'string' || !itemText.trim()) continue
      const kind = AUTO_KINDS.includes(type as MemoryKind) ? (type as MemoryKind) : 'fact'
      add.push({ kind, text: itemText.trim().slice(0, MEMORY_LIMITS.entryText) })
      if (add.length >= 3) break
    }
  }

  const aliases = aliasMemories(autoMemories)
  const removeIds = Array.isArray(data.remove)
    ? data.remove.filter((a): a is string => typeof a === 'string').flatMap((a) => {
        const m = aliases.get(a.trim())
        return m ? [m.id] : []
      })
    : []

  return { suggestions, add, removeIds }
}

/** Retire les ajouts déjà connus (même texte, sans tenir compte de la casse ni de la ponctuation finale). */
export function dedupeAdditions(additions: TurnAnalysis['add'], existing: MemoryEntry[]): TurnAnalysis['add'] {
  const norm = (s: string) => s.toLowerCase().replace(/[.!…\s]+$/u, '').replace(/\s+/g, ' ').trim()
  const known = new Set(existing.map((m) => norm(m.text)))
  return additions.filter((a) => {
    const key = norm(a.text)
    if (known.has(key)) return false
    known.add(key)
    return true
  })
}

/**
 * Identifiants à oublier pour rester sous la limite de la mémoire automatique :
 * d'abord les faits les plus anciens, puis les plus anciens éléments restants.
 */
export function overflowIds(autoMemories: MemoryEntry[], limit: number = MEMORY_LIMITS.auto): string[] {
  const excess = autoMemories.length - limit
  if (excess <= 0) return []
  const byAge = [...autoMemories].sort((a, b) => a.createdAt - b.createdAt)
  const facts = byAge.filter((m) => m.kind === 'fact')
  const others = byAge.filter((m) => m.kind !== 'fact')
  return [...facts, ...others].slice(0, excess).map((m) => m.id)
}

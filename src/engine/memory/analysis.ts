import type { LlmRequest } from '../llm/types'
import { describeStat, type StatValues } from '../progression/rules'
import type { StatDef } from '../progression/types'
import type { ImageAsset } from '../images/types'
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
  statDeltas: { statId: string; delta: number }[]
  /** Image de scène choisie pour illustrer le dernier passage (v0.5). */
  imageId?: string
}

/** Image proposée à l'IA : seules ses métadonnées sont envoyées (jamais l'image elle-même). */
export type SceneImageInput = Pick<ImageAsset, 'id' | 'tags' | 'description'>

export interface StatsInput {
  defs: StatDef[]
  values: StatValues
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
  stats?: StatsInput,
  sceneImages: SceneImageInput[] = [],
): LlmRequest {
  const transcript = entries
    .filter((e) => !e.ooc)
    .slice(-RECENT_ENTRIES)
    .map((e) => `${e.role === 'user' ? `JOUEUR (${playerName})` : 'NARRATRICE'} :\n${e.content}`)
    .join('\n\n')

  const memoryList = [...aliasMemories(autoMemories)]
    .map(([alias, m]) => `${alias} [${m.kind}] ${m.text}`)
    .join('\n')

  const statList =
    stats && stats.defs.length
      ? stats.defs
          .map((d, i) => `s${i + 1} — ${describeStat(d, stats.values[d.id] ?? d.initial)} (entre ${d.min} et ${d.max}). Règle : ${d.rulesText || 'à ton jugement.'}`)
          .join('\n')
      : ''

  const imageList = sceneImages
    .map((img, i) => `i${i + 1} — ${[img.tags.join(', '), img.description].filter(Boolean).join(' : ') || 'sans description'}`)
    .join('\n')
  const extraFields = [
    ...(statList ? ['  "stats": [{ "id": "s1", "delta": 5 }]'] : []),
    ...(imageList ? ['  "image": "i2"'] : []),
  ]

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
          ...(statList ? [`Jauges de la partie :\n${statList}`, ''] : []),
          ...(imageList ? [`Images de scène disponibles :\n${imageList}`, ''] : []),
          `Fin de l'histoire en cours :\n\n${transcript}`,
          '',
          'Réponds avec ce JSON :',
          '{',
          `  "suggestions": ["…", "…", "…"],`,
          '  "add": [{ "type": "fact" | "relation" | "goal", "text": "…" }],',
          '  "remove": ["m2"]' + (extraFields.length ? ',' : ''),
          ...extraFields.map((f, i) => (i < extraFields.length - 1 ? `${f},` : f)),
          '}',
          '',
          `- suggestions : 3 actions courtes et variées que ${playerName} pourrait faire maintenant, à la première personne (une prudente, une audacieuse, une qui fait parler un personnage), 15 mots maximum chacune.`,
          '- add : 0 à 3 informations NOUVELLES et durables apparues dans les derniers échanges. Une phrase de 20 mots maximum, à la troisième personne. N\'ajoute rien de déjà présent dans la mémoire.',
          `    • relation = ce qu'un personnage pense, ressent ou fait envers ${playerName} (confiance, méfiance, dette, attirance, colère…) ;`,
          `    • goal = un objectif en cours de ${playerName} ou une promesse à tenir ;`,
          '    • fact = un fait objectif sur le monde ou l\'intrigue (découverte, objet, lieu, secret révélé).',
          '- remove : alias des éléments de mémoire devenus faux, obsolètes ou des objectifs accomplis.',
          ...(statList
            ? ['- stats : variations des jauges dues aux derniers échanges, selon leurs règles (entier positif ou négatif, petites variations ; omets les jauges inchangées).']
            : []),
          ...(imageList
            ? ["- image : l'alias de l'image qui illustre le mieux la DERNIÈRE réponse de la narratrice (lieu, personnage présent, moment), ou null si aucune ne correspond vraiment."]
            : []),
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
export function parseTurnAnalysis(
  text: string,
  autoMemories: MemoryEntry[],
  statDefs: StatDef[] = [],
  sceneImages: SceneImageInput[] = [],
): TurnAnalysis {
  const data = extractJsonObject(text) as { suggestions?: unknown; add?: unknown; remove?: unknown; stats?: unknown; image?: unknown } | null
  if (!data || typeof data !== 'object') return { suggestions: parseSuggestions(text), add: [], removeIds: [], statDeltas: [] }

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

  const statDeltas: TurnAnalysis['statDeltas'] = []
  if (Array.isArray(data.stats)) {
    for (const item of data.stats) {
      if (typeof item !== 'object' || item === null) continue
      const { id, delta } = item as { id?: unknown; delta?: unknown }
      const match = typeof id === 'string' ? /^s(\d+)$/.exec(id.trim()) : null
      const def = match ? statDefs[Number(match[1]) - 1] : undefined
      const value = typeof delta === 'number' ? delta : typeof delta === 'string' ? Number(delta) : Number.NaN
      if (def && Number.isFinite(value) && value !== 0) statDeltas.push({ statId: def.id, delta: Math.round(value) })
    }
  }

  const imageMatch = typeof data.image === 'string' ? /^i(\d+)$/.exec(data.image.trim()) : null
  const imageId = imageMatch ? sceneImages[Number(imageMatch[1]) - 1]?.id : undefined

  return { suggestions, add, removeIds, statDeltas, ...(imageId ? { imageId } : {}) }
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

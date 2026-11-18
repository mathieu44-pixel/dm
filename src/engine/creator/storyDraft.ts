import type { LlmRequest } from '../llm/types'
import type { Comparator, ConditionItem, Rarity } from '../progression/types'

/**
 * Assistant de création (v0.8) : à partir d'une idée en une phrase, l'IA propose
 * une histoire complète (univers, personnages, prologue, jauges, fins) au format JSON.
 * Ce module ne fait que construire la requête et lire la réponse de façon tolérante ;
 * la conversion en objets de l'application se fait dans src/data/creator.ts.
 */

export type DraftMode = 'story' | 'character'

export interface CreationOptions {
  idea: string
  mode: DraftMode
  language: 'fr' | 'en'
  /** Jauges et fins (mode Histoire uniquement). */
  withProgression: boolean
  /** Documentation déjà rassemblée (import d'univers, v1.1), non tronquée à la limite de l'idée. */
  context?: string
  /** Les personnages sont déjà fournis : l'IA n'en crée pas. */
  presetCharacters?: boolean
  /** Introduction écrite par le joueur, à mettre en forme sans la changer. */
  introduction?: string
}

export interface DraftCharacter {
  name: string
  title: string
  appearance: string
  personality: string
  speech: string
  background: string
}

export interface DraftStat {
  /** Alias s1, s2… utilisé par les conditions de fin. */
  alias: string
  name: string
  icon: string
  min: number
  max: number
  initial: number
  levels: { low: string; mid: string; high: string }
  rulesText: string
}

export interface DraftEnding {
  name: string
  rarity: Rarity
  cardText: string
  epilogue: string
  minTurn: number
  conditions: { alias: string; cmp: Comparator; value: number }[]
}

export interface StoryDraft {
  title: string
  subtitle: string
  tags: string[]
  worldLore: string
  systemPrompt: string
  writingRules: string
  characters: DraftCharacter[]
  prologue: string
  suggestions: string[]
  stats: DraftStat[]
  endings: DraftEnding[]
}

export const CREATION_LIMITS = { idea: 4000, characters: 5, stats: 4, endings: 5 } as const

const COMPARATORS: Comparator[] = ['>=', '<=', '>', '<', '==']
const RARITY_IDS: Rarity[] = ['N', 'R', 'SR', 'SSR']

export function buildCreationRequest(model: string, options: CreationOptions): LlmRequest {
  const en = options.language === 'en'
  const isCharacter = options.mode === 'character'
  const progression = !isCharacter && options.withProgression

  const schema = [
    '{',
    '  "title": "…",',
    '  "subtitle": "accroche d\'une phrase",',
    '  "tags": ["…", "…"],',
    '  "worldLore": "univers, lieux, factions, règles du monde, secrets (150 à 300 mots)",',
    '  "systemPrompt": "consignes pour la narratrice : son rôle, le déroulement prévu, les rebondissements possibles, les limites",',
    '  "writingRules": "ton et style d\'écriture (2 à 4 phrases)",',
    '  "characters": [{ "name": "…", "title": "rôle court", "appearance": "…", "personality": "…", "speech": "façon de parler", "background": "passé, secrets, motivations" }],',
    '  "prologue": "…",',
    '  "suggestions": ["…", "…", "…"]' + (progression ? ',' : ''),
    ...(progression
      ? [
          '  "stats": [{ "id": "s1", "name": "…", "icon": "un emoji", "min": 0, "max": 100, "initial": 50, "low": "libellé bas", "mid": "libellé moyen", "high": "libellé haut", "rules": "quand la jauge monte ou baisse" }],',
          '  "endings": [{ "name": "…", "rarity": "N" | "R" | "SR" | "SSR", "card": "texte court de la carte", "epilogue": "épilogue de 80 à 150 mots", "minTurn": 15, "conditions": [{ "stat": "s1", "cmp": ">=", "value": 70 }] }]',
        ]
      : []),
    '}',
  ]

  const rules = [
    `- Langue : ${en ? 'écris TOUT le contenu (textes, noms de jauges, prologue, suggestions) EN ANGLAIS' : 'écris tout le contenu en français'}.`,
    options.presetCharacters
      ? '- Les personnages sont déjà définis (voir la documentation) : renvoie "characters": [] et fais-les intervenir par leur nom dans le prologue.'
      : isCharacter
      ? '- Mode personnage : UN seul personnage, très détaillé, pour une conversation libre avec le joueur. Le prologue est son premier message d\'accueil.'
      : `- 2 à ${CREATION_LIMITS.characters} personnages marquants, aux personnalités contrastées, qui ont chacun une raison d'interagir avec le joueur.`,
    '- Le joueur incarne son propre personnage (son avatar) : ne le décris pas, ne lui donne pas de nom, adresse-toi à lui à la deuxième personne dans le prologue.',
    '- Prologue de 120 à 250 mots qui pose la scène et se termine sur une situation qui appelle une réaction du joueur.',
    '- Format du prologue, une ligne par élément : narration entre 「 et 」 ; réplique sous la forme Nom | "réplique" avec des guillemets droits " (jamais « »), sans action à l\'intérieur ; action brève d\'un personnage sur sa propre ligne, entre *astérisques*.',
    '- suggestions : 3 premières actions possibles pour le joueur, à la première personne du présent (« Je… »), 15 mots maximum.',
    '- tags : 2 à 5 mots-clés (genre, ambiance).',
    ...(progression
      ? [
          `- stats : 2 à ${CREATION_LIMITS.stats} jauges qui mesurent ce qui compte dans cette histoire (relation, danger, ressource, réputation…). Entre 0 et 100 de préférence. « rules » explique en langage courant ce qui les fait monter ou baisser.`,
          `- endings : 3 à ${CREATION_LIMITS.endings} fins variées (bonne, tragique, secrète…). Rareté : N pour les fins courantes, R, SR, puis SSR pour la fin la plus difficile à obtenir. Chaque fin exige un tour minimum (minTurn, entre 10 et 40) et des conditions sur les jauges (toutes doivent être vraies). Les fins doivent pouvoir s'exclure les unes les autres.`,
        ]
      : []),
    "- Œuvres existantes : si l'idée cite un univers, une œuvre ou des personnages existants (fan-fiction), respecte-les fidèlement (noms, lieux, caractères, règles du monde). Sinon, crée un contenu entièrement original sans emprunter d'éléments à des œuvres existantes.",
  ]

  return {
    model,
    maxTokens: 8192,
    temperature: 0.9,
    system:
      "Tu es une autrice experte en histoires interactives. Tu conçois des histoires prêtes à jouer, riches, cohérentes et pleines d'enjeux. " +
      'Réponds uniquement avec un objet JSON valide, sans aucun autre texte ni balise de code.',
    messages: [
      {
        role: 'user',
        content: [
          `Idée ou inspiration du joueur :\n${options.idea.trim().slice(0, CREATION_LIMITS.idea) || '(aucune : pars de la documentation)'}`,
          '',
          ...(options.context ? [options.context, ''] : []),
          ...(options.introduction?.trim()
            ? [
                "Introduction écrite par le joueur : utilise-la comme prologue. Garde son contenu et son ton, traduis-la si besoin, et mets-la seulement au format narratif demandé :",
                options.introduction.trim().slice(0, 4000),
                '',
              ]
            : []),
          `Conçois ${isCharacter ? 'un personnage pour une conversation libre' : 'une histoire interactive'} à partir de ce texte. S'il est détaillé (personnages, lieux, intrigue, ton), reprends fidèlement ce qu'il décrit et complète seulement ce qui manque. Réponds avec ce JSON :`,
          ...schema,
          '',
          'Règles :',
          ...rules,
        ].join('\n'),
      },
    ],
  }
}

/* ---------- Lecture tolérante ---------- */

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

const str = (v: unknown, max = 6000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
  return Number.isFinite(n) ? Math.round(n) : fallback
}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})

export class DraftParseError extends Error {}

/** Convertit la réponse de l'IA en brouillon. Lève DraftParseError si l'essentiel manque. */
export function parseStoryDraft(text: string, options: Pick<CreationOptions, 'mode' | 'withProgression'>): StoryDraft {
  const data = obj(extractJsonObject(text))
  const title = str(data.title, 80)
  const prologue = str(data.prologue)
  if (!title || !prologue)
    throw new DraftParseError("La réponse de l'IA est incomplète ou illisible (titre ou prologue manquant). Relance la génération.")

  const characters: DraftCharacter[] = []
  const seen = new Set<string>()
  for (const raw of arr(data.characters)) {
    const c = obj(raw)
    const name = str(c.name, 60)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    characters.push({
      name,
      title: str(c.title, 80),
      appearance: str(c.appearance),
      personality: str(c.personality),
      speech: str(c.speech),
      background: str(c.background),
    })
    if (characters.length >= (options.mode === 'character' ? 1 : CREATION_LIMITS.characters)) break
  }
  if (options.mode === 'character' && characters.length === 0)
    throw new DraftParseError("L'IA n'a pas décrit de personnage. Relance la génération.")

  const progression = options.mode === 'story' && options.withProgression
  const stats: DraftStat[] = []
  if (progression) {
    arr(data.stats).forEach((raw, i) => {
      if (stats.length >= CREATION_LIMITS.stats) return
      const s = obj(raw)
      const name = str(s.name, 40)
      if (!name) return
      let min = num(s.min, 0)
      let max = num(s.max, 100)
      if (!(min < max)) [min, max] = [0, 100]
      const initial = Math.min(max, Math.max(min, num(s.initial, Math.round((min + max) / 2))))
      stats.push({
        alias: str(s.id, 10) || `s${i + 1}`,
        name,
        icon: str(s.icon, 8),
        min,
        max,
        initial,
        levels: { low: str(s.low, 40), mid: str(s.mid, 40), high: str(s.high, 40) },
        rulesText: str(s.rules, 600),
      })
    })
  }
  const aliases = new Set(stats.map((s) => s.alias))

  const endings: DraftEnding[] = []
  if (progression) {
    for (const raw of arr(data.endings)) {
      if (endings.length >= CREATION_LIMITS.endings) break
      const e = obj(raw)
      const name = str(e.name, 60)
      if (!name) continue
      const rarity = RARITY_IDS.includes(e.rarity as Rarity) ? (e.rarity as Rarity) : 'N'
      const conditions = arr(e.conditions).flatMap((c) => {
        const item = obj(c)
        const alias = str(item.stat, 10)
        const cmp = COMPARATORS.includes(item.cmp as Comparator) ? (item.cmp as Comparator) : '>='
        return aliases.has(alias) ? [{ alias, cmp, value: num(item.value, 50) }] : []
      })
      endings.push({
        name,
        rarity,
        cardText: str(e.card, 300),
        epilogue: str(e.epilogue),
        minTurn: Math.min(200, Math.max(1, num(e.minTurn, 20))),
        conditions,
      })
    }
  }

  return {
    title,
    subtitle: str(data.subtitle, 200),
    tags: arr(data.tags).map((t) => str(t, 30)).filter(Boolean).slice(0, 5),
    worldLore: str(data.worldLore),
    systemPrompt: str(data.systemPrompt),
    writingRules: str(data.writingRules, 2000),
    characters,
    prologue,
    suggestions: arr(data.suggestions).map((s) => str(s, 150)).filter(Boolean).slice(0, 3),
    stats,
    endings,
  }
}

/** Conditions d'une fin : tour minimum ET conditions de jauges (alias → identifiants). */
export function endingConditionItems(ending: DraftEnding, statIdByAlias: Map<string, string>): ConditionItem[] {
  return [
    { type: 'turn', gte: ending.minTurn },
    ...ending.conditions.flatMap((c) => {
      const statId = statIdByAlias.get(c.alias)
      return statId ? [{ type: 'stat' as const, statId, cmp: c.cmp, value: c.value }] : []
    }),
  ]
}

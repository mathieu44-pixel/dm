import type { LlmRequest } from '../llm/types'
import type { DraftCharacter } from '../creator/storyDraft'

/**
 * Importer un univers (v1.1) : chaque page de wiki choisie est lue par l'IA et rangée
 * en personnage ou en fiche de lorebook, dans la langue de l'histoire.
 */

export const UNIVERSE_LIMITS = {
  pages: 25,
  /** Texte d'une page envoyé à l'IA (caractères). */
  pageChars: 12000,
  /** Texte de la page de départ utilisé comme description de l'univers. */
  worldChars: 8000,
} as const

export type PageExtraction =
  | { kind: 'character'; character: DraftCharacter; keys: string[] }
  | { kind: 'lore'; name: string; keys: string[]; content: string }

export function buildPageExtractionRequest(
  model: string,
  page: { title: string; text: string },
  language: 'fr' | 'en',
  universe: string,
  retryLanguage = false,
): LlmRequest {
  const en = language === 'en'
  const languageRule = en
    ? 'LANGUE : écris toutes les valeurs du JSON EN ANGLAIS.'
    : "LANGUE : écris toutes les valeurs du JSON EN FRANÇAIS, même si la page est en anglais : traduis. Seuls les noms propres restent tels quels."
  return {
    model,
    maxTokens: 2048,
    temperature: 0.3,
    system: `Tu prépares des fiches pour une histoire interactive à partir d'une page de wiki. ${languageRule} Réponds uniquement avec un objet JSON valide, sans autre texte.`,
    messages: [
      {
        role: 'user',
        content: [
          `Univers : ${universe || 'inconnu'}`,
          `Page du wiki : « ${page.title} »`,
          '---',
          page.text.slice(0, UNIVERSE_LIMITS.pageChars),
          '---',
          "Si la page décrit UN personnage, réponds :",
          '{ "kind": "character", "name": "…", "title": "rôle court", "appearance": "…", "personality": "…", "speech": "façon de parler, tics de langage", "background": "passé, relations avec les autres personnages, objectifs", "keys": ["noms et surnoms"] }',
          "Sinon (lieu, groupe, objet, notion, événement…), réponds :",
          '{ "kind": "lore", "name": "…", "keys": ["mots-clés qui évoquent ce sujet"], "content": "fiche de 80 à 200 mots, l\'essentiel pour jouer" }',
          'Règles :',
          `- ${languageRule}`,
          ...(retryLanguage ? ["- ATTENTION : ta réponse précédente n'était pas dans la bonne langue. Recommence en respectant la langue demandée."] : []),
          "- Reste fidèle à la page : n'invente rien, résume ce qui sert à incarner ou décrire le sujet. Ignore les statistiques de jeu, listes de compétences, dates de sortie et anecdotes de production.",
          '- Champs du personnage : 1 à 4 phrases chacun.',
          '- keys : 1 à 6 mots-clés courts.',
        ].join('\n'),
      },
    ],
  }
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const v = JSON.parse(text.slice(start, end + 1))
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const str = (v: unknown, max = 3000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const keyList = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.map((k) => str(k, 40)).filter(Boolean))].slice(0, 6) : []

/** Lit la réponse de l'IA ; `fallbackName` = titre de la page si l'IA n'a pas donné de nom. */
export function parsePageExtraction(text: string, fallbackName: string): PageExtraction | null {
  const data = extractJsonObject(text)
  if (!data) return null
  const name = str(data.name, 60) || fallbackName
  const keys = keyList(data.keys)
  if (data.kind === 'character')
    return {
      kind: 'character',
      character: {
        name,
        title: str(data.title, 80),
        appearance: str(data.appearance),
        personality: str(data.personality),
        speech: str(data.speech),
        background: str(data.background),
      },
      keys: keys.length ? keys : [name],
    }
  const content = str(data.content)
  return content ? { kind: 'lore', name, keys: keys.length ? keys : [name], content } : null
}

/** Contexte donné à l'assistant de création pour écrire l'univers, le prologue, les jauges et les fins. */
export function universeContext(input: { sourceTitle: string; worldText: string; characters: DraftCharacter[]; lore: { name: string; content: string }[] }): string {
  return [
    `Documentation importée du wiki (page « ${input.sourceTitle} ») :`,
    input.worldText.slice(0, UNIVERSE_LIMITS.worldChars),
    input.characters.length ? `\nPersonnages déjà définis (ne pas en créer d'autres) :\n${input.characters.map((c) => `- ${c.name}${c.title ? ` (${c.title})` : ''}`).join('\n')}` : '',
    input.lore.length ? `\nFiches de lorebook déjà définies :\n${input.lore.map((l) => `- ${l.name} : ${l.content.slice(0, 200)}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

const ENGLISH_WORDS = /\b(the|and|she|he|her|his|is|was|with|who|of|to|in|has|her)\b/gi
const FRENCH_WORDS = /\b(le|la|les|et|elle|il|est|une|des|du|qui|avec|dans|son|sa|ses)\b/gi

/** Le texte semble-t-il anglais plutôt que français ? (heuristique sur les mots courants) */
export function looksEnglish(text: string): boolean {
  const en = text.match(ENGLISH_WORDS)?.length ?? 0
  const fr = text.match(FRENCH_WORDS)?.length ?? 0
  return en >= 4 && en > fr * 1.5
}

/** Langue d'un texte (français ou anglais), ou indéterminée s'il est trop court ou mélangé. */
export function textLanguage(text: string): 'fr' | 'en' | undefined {
  const en = text.match(ENGLISH_WORDS)?.length ?? 0
  const fr = text.match(FRENCH_WORDS)?.length ?? 0
  if (en >= 4 && en > fr * 1.5) return 'en'
  if (fr >= 4 && fr > en * 1.5) return 'fr'
  return undefined
}

/** Texte d'une fiche extraite, pour vérifier sa langue. */
export function extractionText(e: PageExtraction): string {
  return e.kind === 'character'
    ? [e.character.title, e.character.appearance, e.character.personality, e.character.speech, e.character.background].join(' ')
    : e.content
}

import type { LlmRequest } from '../llm/types'
import type { ThreadEntry } from '../session/types'

/**
 * Génère les 3 actions proposées au joueur après chaque réponse (modèle « tâches internes »).
 */

const RECENT_ENTRIES = 6

export function buildSuggestionsRequest(model: string, playerName: string, entries: ThreadEntry[]): LlmRequest {
  const transcript = entries
    .filter((e) => !e.ooc)
    .slice(-RECENT_ENTRIES)
    .map((e) => `${e.role === 'user' ? `JOUEUR (${playerName})` : 'NARRATRICE'} :\n${e.content}`)
    .join('\n\n')

  return {
    model,
    maxTokens: 1024,
    temperature: 0.9,
    system:
      "Tu aides un joueur dans une histoire interactive. Tu proposes ce qu'il pourrait faire ensuite. " +
      'Réponds uniquement par un tableau JSON de 3 chaînes, sans aucun autre texte.',
    messages: [
      {
        role: 'user',
        content: [
          `Voici la fin de l'histoire en cours :\n\n${transcript}`,
          '',
          `Propose 3 actions courtes et variées que ${playerName} pourrait faire maintenant, écrites à la première personne`,
          '(une prudente, une audacieuse, une qui fait parler un personnage). Une phrase chacune, 15 mots maximum.',
          'Format : ["…", "…", "…"]',
        ].join('\n'),
      },
    ],
  }
}

/** Lit les suggestions de façon tolérante (JSON entouré de texte, ou liste à puces). */
export function parseSuggestions(text: string): string[] {
  const clean = (items: unknown[]) =>
    items
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3)

  const match = /\[[\s\S]*\]/.exec(text)
  if (match) {
    try {
      const parsed: unknown = JSON.parse(match[0])
      if (Array.isArray(parsed)) {
        const items = clean(parsed)
        if (items.length) return items
      }
    } catch {
      /* on tente la lecture ligne à ligne */
    }
  }

  return clean(
    text
      .split('\n')
      .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["«“]|["»”],?$/g, ''))
      .filter((line) => line.length > 3 && !/^```/.test(line) && !/^[[\]]$/.test(line.trim())),
  )
}

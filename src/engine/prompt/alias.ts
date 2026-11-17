import type { LlmRequest } from '../llm/types'
import type { Language } from '../session/options'
import type { ThreadEntry } from '../session/types'

/** Commande /GrantAlias : un surnom inspiré des actions du joueur (modèle « tâches internes »). */
export function buildAliasRequest(
  model: string,
  playerName: string,
  entries: ThreadEntry[],
  existing: string[],
  language: Language = 'fr',
): LlmRequest {
  const transcript = entries
    .filter((e) => !e.ooc)
    .slice(-12)
    .map((e) => `${e.role === 'user' ? `JOUEUR (${playerName})` : 'NARRATRICE'} :\n${e.content}`)
    .join('\n\n')
  return {
    model,
    maxTokens: 600,
    temperature: 1,
    system: "Tu attribues des surnoms marquants aux héros d'histoires interactives. Réponds uniquement en JSON.",
    messages: [
      {
        role: 'user',
        content: [
          `Histoire récente :\n\n${transcript}`,
          '',
          existing.length ? `Surnoms déjà reçus : ${existing.join(', ')} (n'en répète aucun).` : '',
          `Invente UN surnom court et évocateur pour ${playerName}, inspiré de ses actes ou de son comportement${language === 'en' ? ' (en anglais)' : ' (en français)'}.`,
          'Format : {"alias": "…", "reason": "une phrase expliquant pourquoi"}',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  }
}

export function parseAlias(text: string): { alias: string; reason: string } | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const data = JSON.parse(text.slice(start, end + 1)) as { alias?: unknown; reason?: unknown }
    if (typeof data.alias !== 'string' || !data.alias.trim()) return null
    return {
      alias: data.alias.trim().replace(/^["«“]|["»”]$/g, '').slice(0, 60),
      reason: typeof data.reason === 'string' ? data.reason.trim() : '',
    }
  } catch {
    return null
  }
}

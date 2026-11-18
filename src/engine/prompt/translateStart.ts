import type { LlmRequest } from '../llm/types'
import type { Language } from '../session/options'

/** Traduction du prologue et des suggestions de départ quand la langue de jeu diffère de celle de l'histoire (v1.2.1). */
export function buildStartTranslationRequest(model: string, prologue: string, suggestions: string[], language: Language): LlmRequest {
  const target = language === 'en' ? 'anglais' : 'français'
  return {
    model,
    maxTokens: 4000,
    temperature: 0.3,
    system: 'Tu es traductrice littéraire. Réponds uniquement en JSON.',
    messages: [
      {
        role: 'user',
        content: [
          `Traduis en ${target} le prologue et les suggestions ci-dessous.`,
          'Garde exactement la mise en forme : les crochets 「 」, les *astérisques*, les sauts de ligne, les noms propres et les variables entre accolades comme {{user}}.',
          'Format : {"prologue": "…", "suggestions": ["…"]} (même nombre de suggestions, même ordre).',
          '',
          `PROLOGUE :\n${prologue}`,
          '',
          `SUGGESTIONS :\n${JSON.stringify(suggestions)}`,
        ].join('\n'),
      },
    ],
  }
}

export function parseStartTranslation(text: string, count: number): { prologue: string; suggestions: string[] } | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const data = JSON.parse(text.slice(start, end + 1)) as { prologue?: unknown; suggestions?: unknown }
    if (typeof data.prologue !== 'string' || !data.prologue.trim()) return null
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions.filter((s): s is string => typeof s === 'string' && !!s.trim()) : []
    return { prologue: data.prologue.trim(), suggestions: suggestions.length === count ? suggestions : [] }
  } catch {
    return null
  }
}

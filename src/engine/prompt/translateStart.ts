import type { LlmRequest } from '../llm/types'
import type { Language } from '../session/options'

const PROLOGUE_MARK = '===PROLOGUE==='
const SUGGESTIONS_MARK = '===SUGGESTIONS==='

/**
 * Traduction du prologue et des suggestions de départ quand la langue de jeu diffère de celle de l'histoire.
 * Réponse en texte balisé (pas en JSON : les guillemets et sauts de ligne du prologue cassent souvent le JSON).
 */
export function buildStartTranslationRequest(model: string, prologue: string, suggestions: string[], language: Language): LlmRequest {
  const target = language === 'en' ? 'anglais' : 'français'
  return {
    model,
    maxTokens: 8000,
    temperature: 0.3,
    system: 'Tu es traductrice littéraire. Tu renvoies uniquement la traduction, sans commentaire.',
    messages: [
      {
        role: 'user',
        content: [
          `Traduis en ${target} le prologue et les suggestions ci-dessous.`,
          'Garde exactement la mise en forme : les crochets 「 」, les *astérisques*, les sauts de ligne, les noms propres et les variables entre accolades comme {{user}}.',
          `Réponds exactement sous cette forme (une suggestion par ligne, même nombre et même ordre) :`,
          PROLOGUE_MARK,
          '(prologue traduit)',
          SUGGESTIONS_MARK,
          '(suggestion 1 traduite)',
          '',
          'Texte à traduire :',
          PROLOGUE_MARK,
          prologue,
          SUGGESTIONS_MARK,
          ...suggestions,
        ].join('\n'),
      },
    ],
  }
}

export function parseStartTranslation(text: string, count: number): { prologue: string; suggestions: string[] } | null {
  const cleaned = text.replace(/^```\w*\n?|```\s*$/g, '')
  const p = cleaned.indexOf(PROLOGUE_MARK)
  if (p < 0) return null
  const rest = cleaned.slice(p + PROLOGUE_MARK.length)
  const s = rest.indexOf(SUGGESTIONS_MARK)
  const prologue = (s >= 0 ? rest.slice(0, s) : rest).trim()
  if (!prologue) return null
  const suggestions =
    s >= 0
      ? rest
          .slice(s + SUGGESTIONS_MARK.length)
          .split('\n')
          .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim())
          .filter(Boolean)
      : []
  return { prologue, suggestions: suggestions.length === count ? suggestions : [] }
}

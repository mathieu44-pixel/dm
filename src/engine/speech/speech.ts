import { parseNarrative } from '../parser/narrative'

/** Lecture à voix haute (v0.9.6) : préparation du texte et choix de la voix, sans dépendre du navigateur. */

export type SpeechRate = 'slow' | 'normal' | 'fast'
export const SPEECH_RATES: { id: SpeechRate; label: string; value: number }[] = [
  { id: 'slow', label: 'Lente', value: 0.85 },
  { id: 'normal', label: 'Normale', value: 1 },
  { id: 'fast', label: 'Rapide', value: 1.2 },
]

export function rateValue(rate: SpeechRate | undefined): number {
  return SPEECH_RATES.find((r) => r.id === rate)?.value ?? 1
}

function clean(text: string): string {
  return text.replace(/[「」*_#`~]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Découpe un passage en morceaux lisibles : narration, puis « Nom. Réplique » quand l'interlocuteur change.
 * Les morceaux restent courts (≤ maxChars) car certains téléphones coupent les longues lectures.
 */
export function speechChunks(content: string, maxChars = 220): string[] {
  const parts: string[] = []
  let lastSpeaker = ''
  for (const seg of parseNarrative(content)) {
    if (seg.type === 'dialogue') {
      const line = clean(seg.text)
      if (!line) continue
      parts.push(seg.speaker !== lastSpeaker ? `${clean(seg.speaker)}. ${line}` : line)
      lastSpeaker = seg.speaker
    } else {
      const line = clean(seg.text)
      if (line) parts.push(line)
    }
  }
  const chunks: string[] = []
  for (const part of parts) {
    if (part.length <= maxChars) {
      chunks.push(part)
      continue
    }
    let current = ''
    for (const sentence of part.match(/[^.!?…]+[.!?…]+["»”]?\s*|[^.!?…]+$/g) ?? [part]) {
      if ((current + sentence).length > maxChars && current) {
        chunks.push(current.trim())
        current = ''
      }
      if (sentence.length > maxChars) {
        for (let i = 0; i < sentence.length; i += maxChars) chunks.push(sentence.slice(i, i + maxChars).trim())
      } else current += sentence
    }
    if (current.trim()) chunks.push(current.trim())
  }
  return chunks.filter(Boolean)
}

export interface VoiceLike {
  lang: string
  name: string
  localService?: boolean
  default?: boolean
}

/** Meilleure voix pour la langue : région exacte, puis même langue ; voix locales d'abord (hors ligne, sans délai). */
export function pickVoice<V extends VoiceLike>(voices: V[], language: 'fr' | 'en'): V | undefined {
  const preferred = language === 'fr' ? 'fr-fr' : 'en-us'
  const norm = (l: string) => l.toLowerCase().replace('_', '-')
  const score = (v: V) =>
    (norm(v.lang) === preferred ? 4 : norm(v.lang).startsWith(language) ? 2 : -100) + (v.localService ? 1 : 0) + (v.default ? 0.5 : 0)
  const best = [...voices].sort((a, b) => score(b) - score(a))[0]
  return best && score(best) > 0 ? best : undefined
}

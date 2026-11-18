import type { LlmRequest } from '../llm/types'
import { normalizeQuery } from '../session/search'
import { MOODS, type ImageAsset, type Mood } from './types'

/** Mots (FR/EN, sans accents) qui trahissent une humeur dans le nom, les mots-clés ou la description d'une image. */
const MOOD_WORDS: Record<Exclude<Mood, 'neutral'>, string[]> = {
  happy: ['joyeux', 'joyeuse', 'heureux', 'heureuse', 'sourire', 'souriant', 'souriante', 'rire', 'rit', 'happy', 'smile', 'smiling', 'laugh', 'laughing', 'joy', 'cheerful', 'grin'],
  angry: ['colere', 'fache', 'fachee', 'furieux', 'furieuse', 'rage', 'enerve', 'enervee', 'angry', 'anger', 'mad', 'furious', 'annoyed', 'irritated'],
  sad: ['triste', 'pleure', 'pleurs', 'larmes', 'chagrin', 'sad', 'cry', 'crying', 'tears', 'upset', 'sorrow'],
  embarrassed: ['gene', 'genee', 'rougit', 'rougissant', 'rougissante', 'timide', 'honte', 'embarrassed', 'blush', 'blushing', 'shy', 'flustered'],
  surprised: ['surpris', 'surprise', 'etonne', 'etonnee', 'choque', 'choquee', 'surprised', 'shocked', 'shock', 'astonished'],
  worried: ['inquiet', 'inquiete', 'peur', 'anxieux', 'anxieuse', 'effraye', 'effrayee', 'worried', 'worry', 'scared', 'afraid', 'anxious', 'nervous', 'fear'],
  determined: ['determine', 'determinee', 'resolu', 'resolue', 'serieux', 'serieuse', 'determined', 'serious', 'resolute', 'confident'],
  tender: ['tendre', 'tendresse', 'doux', 'douce', 'affectueux', 'affectueuse', 'amoureux', 'amoureuse', 'tender', 'gentle', 'loving', 'affectionate', 'warm'],
  combat: ['combat', 'bataille', 'duel', 'attaque', 'arme', 'epee', 'battle', 'fight', 'fighting', 'combat', 'attack', 'sword', 'action', 'war'],
}
const NEUTRAL_WORDS = ['neutre', 'portrait', 'calme', 'neutral', 'default', 'idle', 'calm', 'base']

/** Humeur devinée d'après les mots ; `undefined` si rien n'est clair (aucun mot, ou plusieurs humeurs à égalité). */
export function guessMoodFromWords(text: string): Mood | undefined {
  const words = new Set(normalizeQuery(text).split(/[^a-z0-9]+/).filter(Boolean))
  const scores = Object.entries(MOOD_WORDS)
    .map(([mood, list]) => ({ mood: mood as Mood, n: list.filter((w) => words.has(w)).length }))
    .filter((s) => s.n > 0)
    .sort((a, b) => b.n - a.n)
  if (scores.length && (scores.length === 1 || scores[0].n > scores[1].n)) return scores[0].mood
  if (!scores.length && NEUTRAL_WORDS.some((w) => words.has(w))) return 'neutral'
  return undefined
}

/** Texte d'une image servant à deviner son humeur. */
export function imageText(image: Pick<ImageAsset, 'tags' | 'description'>): string {
  return [image.description, ...image.tags].join(' ')
}

/**
 * Personnage représenté : rattachement explicite, sinon portrait principal, sinon nom complet
 * (ou un mot de nom propre à un seul personnage) dans les mots-clés ou la description.
 */
export function guessOwner(
  image: Pick<ImageAsset, 'id' | 'characterId' | 'tags' | 'description'>,
  characters: { id: string; name: string; portraitImageId?: string }[],
): string | undefined {
  if (image.characterId && characters.some((c) => c.id === image.characterId)) return image.characterId
  const portrait = characters.find((c) => c.portraitImageId === image.id)
  if (portrait) return portrait.id
  const words = new Set(normalizeQuery(imageText(image)).split(/[^a-z0-9]+/).filter(Boolean))
  const text = ` ${normalizeQuery(imageText(image)).replace(/[^a-z0-9]+/g, ' ')} `
  const full = characters.filter((c) => c.name.trim() && text.includes(` ${normalizeQuery(c.name).replace(/[^a-z0-9]+/g, ' ').trim()} `))
  if (full.length === 1) return full[0].id
  if (full.length > 1) return undefined
  const parts = (name: string) => normalizeQuery(name).split(/[^a-z0-9]+/).filter((p) => p.length >= 3)
  const counts = new Map<string, number>()
  for (const c of characters) for (const p of new Set(parts(c.name))) counts.set(p, (counts.get(p) ?? 0) + 1)
  const byPart = characters.filter((c) => parts(c.name).some((p) => counts.get(p) === 1 && words.has(p)))
  return byPart.length === 1 ? byPart[0].id : undefined
}

/** Demande à un modèle qui voit les images l'humeur de chaque personnage (images numérotées dans l'ordre). */
export function buildMoodVisionRequest(model: string, items: { name: string; image: { mime: string; data: string } }[]): LlmRequest {
  const codes = MOODS.map((m) => `${m.id} (${m.label})`).join(', ')
  return {
    model,
    maxTokens: 600,
    temperature: 0.2,
    system: "Tu classes des illustrations de personnages d'histoires interactives selon l'expression ou la situation.",
    messages: [
      {
        role: 'user',
        images: items.map((i) => i.image),
        content: [
          `Voici ${items.length} image(s), dans l'ordre : ${items.map((i, n) => `${n + 1} = ${i.name || 'personnage'}`).join(' ; ')}.`,
          `Pour chacune, choisis l'humeur ou la situation la plus visible parmi : ${codes}.`,
          "« combat » si le personnage se bat ou brandit une arme en action ; « neutral » pour un portrait calme ou sans émotion marquée.",
          'Réponds uniquement par une ligne par image, au format « numéro: code », par exemple « 1: happy ».',
        ].join('\n'),
      },
    ],
  }
}

/** Lit « 1: happy » ligne par ligne ; ignore les codes inconnus. */
export function parseMoodVision(text: string, count: number): (Mood | undefined)[] {
  const out: (Mood | undefined)[] = Array.from({ length: count }, () => undefined)
  for (const m of text.matchAll(/(\d+)\s*[:=.)-]\s*([a-z]+)/gi)) {
    const i = Number(m[1]) - 1
    const mood = m[2].toLowerCase() as Mood
    if (i >= 0 && i < count && MOODS.some((x) => x.id === mood)) out[i] = mood
  }
  return out
}

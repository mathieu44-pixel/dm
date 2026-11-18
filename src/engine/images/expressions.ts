import { normalizeQuery } from '../session/search'
import type { ImageAsset, Mood } from './types'

/**
 * Expressions (v1.2) : un personnage peut avoir plusieurs images, chacune avec une humeur.
 * L'analyse de fin de tour choisit l'humeur de chaque personnage présent ; l'écran affiche l'image qui va avec.
 */

export interface ExpressionSet {
  characterId: string
  name: string
  byMood: Partial<Record<Mood, string[]>>
}

type CharacterLike = { id: string; name: string; portraitImageId?: string }
type ImageLike = Pick<ImageAsset, 'id' | 'category' | 'tags' | 'characterId' | 'mood'>

/** Images de chaque personnage, rangées par humeur (le portrait principal compte comme neutre s'il n'a pas d'humeur). */
export function expressionSets(characters: CharacterLike[], images: ImageLike[]): ExpressionSet[] {
  return characters.map((c) => {
    const name = normalizeQuery(c.name)
    const mine = images.filter(
      (img) =>
        img.characterId === c.id ||
        img.id === c.portraitImageId ||
        (!img.characterId && img.category === 'character' && img.tags.some((t) => normalizeQuery(t) === name)),
    )
    const byMood: ExpressionSet['byMood'] = {}
    // Le portrait principal passe en premier dans son humeur.
    mine.sort((a, b) => Number(b.id === c.portraitImageId) - Number(a.id === c.portraitImageId))
    for (const img of mine) (byMood[img.mood ?? 'neutral'] ??= []).push(img.id)
    return { characterId: c.id, name: c.name, byMood }
  })
}

/** Personnages qui ont au moins deux humeurs différentes : les seuls pour qui choisir une humeur a un sens. */
export function expressive(sets: ExpressionSet[]): ExpressionSet[] {
  return sets.filter((s) => Object.keys(s.byMood).length >= 2)
}

/**
 * Image pour une humeur ; à défaut, l'humeur neutre. Quand plusieurs images partagent l'humeur,
 * `seed` fait varier le choix d'un passage à l'autre.
 */
export function pickExpression(set: ExpressionSet, mood: Mood, seed = 0): string | undefined {
  const list = set.byMood[mood] ?? set.byMood.neutral
  return list?.length ? list[Math.abs(seed) % list.length] : undefined
}

/** Petit nombre stable tiré d'un identifiant (pour varier les images sans hasard à l'affichage). */
export function seedOf(id: string): number {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

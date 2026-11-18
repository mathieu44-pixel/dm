import { findPortrait } from '../parser/portraits'
import { parseNarrative } from '../parser/narrative'
import { meetCharacters } from '../relations/affinity'
import type { ThreadEntry } from '../session/types'
import { expressionSets, expressive, pickExpression, seedOf, type ExpressionSet } from './expressions'
import { MOODS, type ImageAsset, type Mood } from './types'

/**
 * Préparation des images pour l'analyse de fin de tour (v1.2, extraite de useGame en v1.6) :
 * ensembles d'humeurs, images annotées pour l'IA, personnages dont l'humeur est à choisir.
 */
export function prepareTurnImages(
  characters: { id: string; name: string; portraitImageId?: string }[],
  storyImages: ImageAsset[],
  lastEntry: ThreadEntry | undefined,
): { sets: ExpressionSet[]; sceneImages: ImageAsset[]; expressionInput: { name: string; moods: Mood[] }[] } {
  const sets = expressionSets(characters, storyImages)
  // Les images de personnage portent le nom du personnage et leur humeur, pour que l'IA les choisisse à bon escient.
  const sceneImages = storyImages.map((img) => {
    const owners = sets.filter((s) => Object.values(s.byMood).some((ids) => ids?.includes(img.id))).map((s) => s.name)
    const mood = img.mood && img.mood !== 'neutral' ? [MOODS.find((m) => m.id === img.mood)?.label ?? img.mood] : []
    return owners.length || mood.length ? { ...img, tags: [...owners, ...mood, ...img.tags] } : img
  })
  // Personnages présents dans la dernière réponse et illustrés dans plusieurs humeurs.
  const expressiveSets = expressive(sets)
  const present =
    lastEntry?.role === 'ai' ? meetCharacters({}, expressiveSets.map((s) => ({ id: s.characterId, name: s.name })), lastEntry.content) : {}
  const expressionInput = expressiveSets
    .filter((s) => s.characterId in present)
    .map((s) => ({ name: s.name, moods: Object.keys(s.byMood) as Mood[] }))
  return { sets, sceneImages, expressionInput }
}

/** Image retenue pour chaque humeur choisie par l'analyse : nom du personnage → image. */
export function resolveExpressions(sets: ExpressionSet[], expressions: { name: string; mood: Mood }[], seedId: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const e of expressions) {
    const set = sets.find((s) => s.name === e.name)
    const imageId = set ? pickExpression(set, e.mood, seedOf(seedId)) : undefined
    if (imageId) map[e.name] = imageId
  }
  return map
}

/**
 * Grande image du passage : le choix de l'IA (remplacé par l'image d'humeur s'il montre un personnage dont
 * l'humeur est connue), sinon l'image du premier personnage qui parle (son humeur, sinon son portrait).
 */
export function chooseSceneImage(
  narration: string,
  chosenImageId: string | undefined,
  sets: ExpressionSet[],
  expressionMap: Record<string, string>,
  portraits: Record<string, string>,
): string | undefined {
  if (chosenImageId) {
    const owner = sets.find((s) => s.name in expressionMap && Object.values(s.byMood).some((ids) => ids?.includes(chosenImageId)))
    return (owner && expressionMap[owner.name]) || chosenImageId
  }
  return parseNarrative(narration)
    .flatMap((seg) => (seg.type === 'dialogue' ? [findPortrait(seg.speaker, { ...portraits, ...expressionMap })] : []))
    .find((id): id is string => !!id)
}

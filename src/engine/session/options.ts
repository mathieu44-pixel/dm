/**
 * Réglages d'une partie (équivalents de « Length & Depth », « Writing Style » d'OOC, et langue de jeu).
 */

export type Language = 'fr' | 'en'
export type ResponseLength = 'short' | 'normal' | 'long'

export const LANGUAGES: { id: Language; label: string; flag: string }[] = [
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
]

export const LENGTHS: { id: ResponseLength; label: string; hint: string; instruction: string; maxTokens: number }[] = [
  {
    id: 'short',
    label: 'Courte',
    hint: 'Réponses rapides, rythme soutenu',
    instruction: 'Réponses courtes : 80 à 180 mots, va droit à l\'essentiel.',
    maxTokens: 1536,
  },
  {
    id: 'normal',
    label: 'Normale',
    hint: 'Équilibre entre action et description',
    instruction: 'Réponses de 200 à 400 mots.',
    maxTokens: 3072,
  },
  {
    id: 'long',
    label: 'Longue',
    hint: 'Descriptions riches, scènes développées',
    instruction: 'Réponses longues et détaillées : 450 à 800 mots, scènes développées, descriptions sensorielles.',
    maxTokens: 4096,
  },
]

export const STYLES: { id: string; label: string; instruction: string }[] = [
  { id: 'story', label: "Celui de l'histoire", instruction: '' },
  { id: 'dark', label: 'Sombre', instruction: 'Ton sombre et tendu, conséquences graves, descriptions sans fard.' },
  { id: 'light', label: 'Léger', instruction: 'Ton léger et plein d\'humour, rythme vif, situations cocasses.' },
  { id: 'poetic', label: 'Poétique', instruction: 'Prose poétique : images sensorielles, métaphores, phrases musicales.' },
  { id: 'cinematic', label: 'Cinématographique', instruction: 'Style cinématographique : découpage en plans, action nette, dialogues percutants.' },
  {
    id: 'webtoon',
    label: 'Webtoon',
    instruction: 'Style webtoon / light novel : narration ironique et complice, réactions expressives, rebondissements.',
  },
  { id: 'custom', label: 'Personnalisé', instruction: '' },
]

export const DEFAULT_LENGTH: ResponseLength = 'normal'
export const DEFAULT_LANGUAGE: Language = 'fr'

export function lengthOption(id: ResponseLength | undefined) {
  return LENGTHS.find((l) => l.id === id) ?? LENGTHS.find((l) => l.id === DEFAULT_LENGTH)!
}

/** Consigne de style effective (vide = style défini par l'histoire). */
export function styleInstruction(styleId: string | undefined, customStyle: string | undefined): string {
  if (styleId === 'custom') return (customStyle ?? '').trim()
  return STYLES.find((s) => s.id === styleId)?.instruction ?? ''
}

export function languageInstruction(language: Language | undefined): string {
  return language === 'en'
    ? 'Langue de jeu : écris TOUTE l\'histoire en anglais (narration et dialogues), même si les consignes sont en français. Le joueur peut écrire en anglais ou en français.'
    : ''
}

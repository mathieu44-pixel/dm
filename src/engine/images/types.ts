/** Image de la banque d'une histoire (stockée sur l'appareil, compressée à l'import). */
export interface ImageAsset {
  id: string
  storyId: string
  /** Fichier stocké sur l'appareil. Absent pour une image liée. */
  blob?: Blob
  /** Image liée (v1.1) : affichée depuis son adresse d'origine (wiki), il faut internet pour la voir. */
  url?: string
  mime: string
  width: number
  height: number
  category: ImageCategory
  /** Mots-clés lus par l'IA pour choisir l'image (« salle commune », « Maëlle », « nuit »…). */
  tags: string[]
  /** Ce que montre l'image, en une phrase. */
  description: string
  /** Personnage représenté (v1.2). À défaut, le personnage dont le nom figure dans les mots-clés. */
  characterId?: string
  /** Humeur du personnage sur cette image (v1.2) ; absente = neutre. */
  mood?: Mood
  createdAt: number
}

/** Humeurs possibles d'une image de personnage (v1.2). */
export type Mood = 'neutral' | 'happy' | 'angry' | 'sad' | 'embarrassed' | 'surprised' | 'worried' | 'determined' | 'combat' | 'tender'

export const MOODS: { id: Mood; label: string; emoji: string }[] = [
  { id: 'neutral', label: 'Neutre', emoji: '😐' },
  { id: 'happy', label: 'Joyeux', emoji: '😄' },
  { id: 'angry', label: 'En colère', emoji: '😠' },
  { id: 'sad', label: 'Triste', emoji: '😢' },
  { id: 'embarrassed', label: 'Gêné', emoji: '😳' },
  { id: 'surprised', label: 'Surpris', emoji: '😲' },
  { id: 'worried', label: 'Inquiet', emoji: '😟' },
  { id: 'determined', label: 'Déterminé', emoji: '😤' },
  { id: 'tender', label: 'Tendre', emoji: '🥰' },
  { id: 'combat', label: 'Au combat', emoji: '⚔️' },
]

export type ImageCategory = 'scene' | 'character' | 'cover' | 'ending' | 'other'

export const IMAGE_CATEGORIES: { id: ImageCategory; label: string; hint: string }[] = [
  { id: 'scene', label: 'Scène', hint: "Proposée par l'IA pendant la partie, puis débloquée dans la galerie" },
  { id: 'character', label: 'Personnage', hint: 'Portrait à côté des répliques, et image affichée quand le personnage parle' },
  { id: 'cover', label: 'Couverture', hint: "Image de présentation de l'histoire" },
  { id: 'ending', label: 'Fin', hint: 'Illustration d\'une carte de fin' },
  { id: 'other', label: 'Autre', hint: 'Simplement rangée dans la banque' },
]

export const IMAGE_LIMITS = {
  perStory: 200,
  /** Plus grand côté après compression (pixels). */
  maxDimension: 1280,
  quality: 0.82,
} as const

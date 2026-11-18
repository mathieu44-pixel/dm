import { normalizeQuery } from '../session/search'

/**
 * Affinités (v1.1) : de 0 à 100 avec chaque personnage de l'histoire, à partir de 50 (neutre)
 * dès qu'il apparaît dans la partie. L'IA d'analyse propose les variations ; l'application les borne.
 */

export const AFFINITY = { start: 50, min: 0, max: 100, maxDelta: 10 } as const

/** Valeurs par identifiant de personnage. Un personnage absent n'a pas encore été rencontré. */
export type AffinityValues = Record<string, number>

export const AFFINITY_LEVELS: { min: number; label: string; color: string }[] = [
  { min: 80, label: 'Complice', color: '#e86aa6' },
  { min: 60, label: 'Amical', color: '#4ab38a' },
  { min: 40, label: 'Neutre', color: '#8a8aa0' },
  { min: 20, label: 'Méfiant', color: '#e0a040' },
  { min: 0, label: 'Hostile', color: '#d9534f' },
]

export function affinityLevel(value: number): { label: string; color: string } {
  return AFFINITY_LEVELS.find((l) => value >= l.min) ?? AFFINITY_LEVELS[AFFINITY_LEVELS.length - 1]
}

const clamp = (v: number) => Math.max(AFFINITY.min, Math.min(AFFINITY.max, Math.round(v)))

/** Morceaux du nom (prénom, nom de famille) en minuscules sans accents, d'au moins 3 lettres. */
function nameParts(name: string): string[] {
  return normalizeQuery(name)
    .split(/[\s-]+/)
    .filter((p) => p.length >= 3)
}

function mentions(text: string, form: string): boolean {
  const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'u').test(text)
}

/**
 * Ajoute à 50 les personnages cités pour la première fois dans `text` : par leur nom complet,
 * ou par un morceau de nom qui n'appartient qu'à eux (« Hwaryeon », mais pas « Han » partagé par deux personnages).
 */
export function meetCharacters(values: AffinityValues | undefined, characters: { id: string; name: string }[], text: string): AffinityValues {
  const next: AffinityValues = { ...values }
  const normalized = normalizeQuery(text)
  const counts = new Map<string, number>()
  for (const c of characters) for (const p of new Set(nameParts(c.name))) counts.set(p, (counts.get(p) ?? 0) + 1)
  for (const c of characters) {
    if (c.id in next || !c.name.trim()) continue
    const forms = [normalizeQuery(c.name), ...nameParts(c.name).filter((p) => counts.get(p) === 1)]
    if (forms.some((f) => f && mentions(normalized, f))) next[c.id] = AFFINITY.start
  }
  return next
}

/** Applique les variations, bornées à ±10 par tour et à 0–100 ; ignore les personnages non rencontrés. */
export function applyAffinityDeltas(values: AffinityValues, deltas: { characterId: string; delta: number }[]): AffinityValues {
  const next: AffinityValues = { ...values }
  for (const { characterId, delta } of deltas) {
    if (!(characterId in next) || !Number.isFinite(delta)) continue
    const bounded = Math.max(-AFFINITY.maxDelta, Math.min(AFFINITY.maxDelta, delta))
    next[characterId] = clamp(next[characterId] + bounded)
  }
  return next
}

/** Lignes pour la narratrice : « Han Yuri : 72/100 (Amical) ». */
export function affinityLines(values: AffinityValues | undefined, characters: { id: string; name: string }[]): string[] {
  if (!values) return []
  return characters.filter((c) => c.id in values).map((c) => `${c.name} : ${values[c.id]}/100 (${affinityLevel(values[c.id]).label})`)
}

import { normalizeQuery } from '../session/search'

/**
 * Lorebook (v0.9.6), sur le principe du « World Info » de SillyTavern : chaque entrée n'est
 * envoyée à l'IA que lorsqu'un de ses mots-clés apparaît dans les derniers messages.
 * Économise des jetons et garde la narratrice concentrée sur ce qui compte maintenant.
 */

export interface LoreEntry {
  id: string
  /** Mots-clés déclencheurs (casse et accents ignorés). */
  keys: string[]
  content: string
  /** Toujours envoyée, sans mot-clé. */
  alwaysOn?: boolean
  /** Désactivée : jamais envoyée. */
  disabled?: boolean
}

export const LORE_LIMITS = {
  /** Nombre de messages récents où l'on cherche les mots-clés. */
  scanDepth: 4,
  /** Taille maximale du lore envoyé à chaque tour (caractères). */
  maxChars: 6000,
  entries: 200,
} as const

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Le mot-clé apparaît-il comme mot entier (ou expression) dans le texte normalisé ? */
function matches(normalizedText: string, key: string): boolean {
  const k = normalizeQuery(key)
  if (k.length < 2) return false
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(k)}(?=$|[^\\p{L}\\p{N}])`, 'u').test(normalizedText)
}

/** Entrées à envoyer, d'après les derniers messages ; « toujours actives » d'abord, puis par ordre d'apparition. */
export function selectLore(entries: LoreEntry[] | undefined, recentTexts: string[], maxChars: number = LORE_LIMITS.maxChars): LoreEntry[] {
  if (!entries?.length) return []
  const text = normalizeQuery(recentTexts.slice(-LORE_LIMITS.scanDepth).join('\n'))
  const active = entries.filter((e) => !e.disabled && e.content.trim() && (e.alwaysOn || e.keys.some((k) => matches(text, k))))
  active.sort((a, b) => Number(!!b.alwaysOn) - Number(!!a.alwaysOn))
  const out: LoreEntry[] = []
  let used = 0
  for (const e of active) {
    const size = e.content.length
    if (used + size > maxChars && out.length) continue
    out.push(e)
    used += size
  }
  return out
}

/** Texte de la section du prompt. */
export function formatLore(entries: LoreEntry[]): string {
  return entries.map((e) => `- ${e.keys.length ? `[${e.keys.join(', ')}] ` : ''}${e.content.trim()}`).join('\n')
}

/** « dragon, Ignis ;  wyrm » → ['dragon', 'Ignis', 'wyrm'] */
export function parseKeys(text: string): string[] {
  return [...new Set(text.split(/[,;\n]/).map((k) => k.trim()).filter(Boolean))].slice(0, 20)
}

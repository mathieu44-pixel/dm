/**
 * Nettoie une réponse narrative : certains modèles imitent les marqueurs internes
 * (« [Hors-jeu] », « [Commande …] ») ou commentent les consignes au lieu de raconter.
 */

const META_LINE = /^\s*「?\s*\[(?:hors-jeu|ooc|commande)[^\]]*\]/i
const MARKER = /\[(?:hors-jeu|ooc)\]\s*/gi

export function sanitizeNarration(text: string): string {
  const blocks = text.split(/\n+/)
  const kept = blocks.filter((b) => !META_LINE.test(b))
  // Si tout le texte était « méta », on le garde mais sans les marqueurs.
  const result = kept.some((b) => b.trim()) ? kept.join('\n') : text
  return result.replace(MARKER, '').replace(/「\s+/g, '「').trim()
}

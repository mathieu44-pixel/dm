import { parseNarrative } from '../parser/narrative'
import type { ThreadEntry } from './types'

/** Texte brut d'une partie, pour l'export depuis le mode relecture (v0.9). */
export function threadToText(entries: ThreadEntry[], options: { title: string; playerName: string; includeOoc?: boolean }): string {
  const blocks: string[] = [options.title, '='.repeat(Math.min(60, Math.max(3, options.title.length)))]
  for (const entry of entries) {
    if (entry.ooc && !options.includeOoc) continue
    if (entry.role === 'user') {
      blocks.push(`▸ ${options.playerName} : ${entry.content.trim()}`)
      continue
    }
    if (entry.ooc) {
      blocks.push(`[Hors-jeu] ${entry.content.trim()}`)
      continue
    }
    const lines = parseNarrative(entry.content).map((s) =>
      s.type === 'dialogue' ? `${s.speaker} : « ${s.text} »` : s.type === 'action' ? `(${s.text})` : s.text,
    )
    blocks.push(lines.join('\n\n'))
  }
  return blocks.join('\n\n') + '\n'
}

/** Nom de fichier sûr : « L'Ombre Grise » → « l-ombre-grise ». */
export function fileSlug(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'partie'
  )
}

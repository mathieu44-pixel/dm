/**
 * Découpe un texte narratif au format DM (repris d'OOC) en segments affichables :
 *   「Il pleut sur le gué.」           → narration
 *   Maëlle | "Entre, tu es trempé."    → dialogue (avec le nom du personnage)
 *   *Je pousse la porte.*               → action (texte du joueur)
 * Tolérant : guillemets français ou typographiques, emoji en tête, texte sans balises.
 */

export type Segment =
  | { type: 'narration'; text: string }
  | { type: 'dialogue'; speaker: string; text: string }
  | { type: 'action'; text: string }

// Nom (≤ 40 caractères, sans « | ») puis « | » puis la réplique entre guillemets.
const DIALOGUE = /^(?:[\p{Extended_Pictographic}️‍\s]*)([^|「」"«»“”]{1,40}?)\s*\|\s*(["«“])([\s\S]*)$/u
const CLOSING: Record<string, RegExp> = { '"': /"\s*$/, '«': /\s*»\s*$/, '“': /”\s*$/ }

function parseDialogue(line: string): Segment | null {
  const m = DIALOGUE.exec(line)
  if (!m) return null
  const [, speaker, open, rest] = m
  const text = rest.replace(CLOSING[open], '').trim()
  return { type: 'dialogue', speaker: speaker.trim(), text }
}

export function parseNarrative(source: string): Segment[] {
  const segments: Segment[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let pendingNarration: string[] | null = null

  const pushNarration = (text: string) => {
    const clean = text.trim()
    if (clean) segments.push({ type: 'narration', text: clean })
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // Bloc de narration 「… sur plusieurs lignes …」
    if (pendingNarration) {
      const end = line.indexOf('」')
      if (end === -1) {
        pendingNarration.push(line)
        continue
      }
      pendingNarration.push(line.slice(0, end))
      pushNarration(pendingNarration.join('\n'))
      pendingNarration = null
      const after = line.slice(end + 1).trim()
      if (after) segments.push(...parseNarrative(after))
      continue
    }

    if (!line) continue

    if (line.startsWith('「')) {
      const end = line.indexOf('」')
      if (end === -1) {
        pendingNarration = [line.slice(1)]
        continue
      }
      pushNarration(line.slice(1, end))
      const after = line.slice(end + 1).trim()
      if (after) segments.push(...parseNarrative(after))
      continue
    }

    const dialogue = parseDialogue(line)
    if (dialogue) {
      segments.push(dialogue)
      continue
    }

    const action = /^\*(.+)\*$/.exec(line)
    if (action) {
      segments.push({ type: 'action', text: action[1].trim() })
      continue
    }

    pushNarration(line)
  }

  // Narration jamais refermée (réponse coupée) : on l'affiche quand même.
  if (pendingNarration) pushNarration(pendingNarration.join('\n'))
  return segments
}

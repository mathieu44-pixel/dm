import { activeContent, type Message, type ThreadEntry } from './types'

/** Remonte de la feuille active jusqu'à la racine : messages dans l'ordre de lecture. */
export function getThread(messages: Message[], leafId: string | null): Message[] {
  if (!leafId) return []
  const byId = new Map(messages.map((m) => [m.id, m]))
  const thread: Message[] = []
  const seen = new Set<string>()
  let current = byId.get(leafId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    thread.push(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return thread.reverse()
}

export function toEntries(thread: Message[]): ThreadEntry[] {
  return thread.map((m) => ({ id: m.id, role: m.role, ooc: !!m.ooc, content: activeContent(m) }))
}

/** Identifiants d'un message et de toute sa descendance (pour supprimer une suite). */
export function descendantIds(messages: Message[], rootId: string): string[] {
  const children = new Map<string, string[]>()
  for (const m of messages) {
    if (!m.parentId) continue
    const list = children.get(m.parentId) ?? []
    list.push(m.id)
    children.set(m.parentId, list)
  }
  const result: string[] = []
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    result.push(id)
    stack.push(...(children.get(id) ?? []))
  }
  return result
}

/** Détecte la commande hors-jeu « /OOC … » (insensible à la casse). */
export function parseOocCommand(input: string): { ooc: boolean; text: string } {
  const match = /^\/ooc\b\s*([\s\S]*)$/i.exec(input.trim())
  return match ? { ooc: true, text: match[1].trim() } : { ooc: false, text: input.trim() }
}

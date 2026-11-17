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

/** Messages qui partagent le même parent (branches), du plus ancien au plus récent. */
export function siblingsOf(messages: Message[], message: Message): Message[] {
  return messages.filter((m) => m.parentId === message.parentId && m.sessionId === message.sessionId).sort((a, b) => a.createdAt - b.createdAt)
}

/** Dernier message d'une branche : on suit à chaque fois l'enfant le plus récent. */
export function deepestLeaf(messages: Message[], fromId: string): string {
  const children = new Map<string, Message[]>()
  for (const m of messages) {
    if (!m.parentId) continue
    const list = children.get(m.parentId) ?? []
    list.push(m)
    children.set(m.parentId, list)
  }
  let current = fromId
  const seen = new Set<string>()
  while (!seen.has(current)) {
    seen.add(current)
    const next = (children.get(current) ?? []).sort((a, b) => b.createdAt - a.createdAt)[0]
    if (!next) break
    current = next.id
  }
  return current
}

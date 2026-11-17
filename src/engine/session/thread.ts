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

/**
 * Recolle la suite d'une réponse : directement si la réponse s'était arrêtée
 * au milieu d'un mot ou d'une phrase, sinon sur une nouvelle ligne.
 */
export function joinContinuation(before: string, addition: string): string {
  const add = addition.replace(/^\s+/, '')
  if (!add) return before
  const tail = before.replace(/\s+$/, '')
  // Mot coupé : « s'immobil » + « isa » → « s'immobilisa ».
  if (/\p{L}$/u.test(tail) && /^\p{Ll}/u.test(add)) {
    const firstWord = /^\p{L}+/u.exec(add)?.[0] ?? ''
    // Le modèle répète parfois le mot entier : « s'immobil » + « s'immobilisa » ou « immobilisa ».
    const lastWord = /\p{L}+$/u.exec(tail)?.[0] ?? ''
    if (lastWord && firstWord.toLowerCase().startsWith(lastWord.toLowerCase()) && firstWord.length > lastWord.length)
      return tail.slice(0, tail.length - lastWord.length) + add
    return tail + add
  }
  // Phrase coupée (pas de ponctuation finale) : on continue sur la même ligne.
  if (/[\p{L}\p{N},;:]$/u.test(tail)) return `${tail} ${add}`
  return `${tail}\n${add}`
}

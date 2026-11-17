import { describe, expect, it } from 'vitest'
import { descendantIds, getThread, parseOocCommand, toEntries } from './thread'
import type { Message } from './types'

function msg(id: string, parentId: string | null, role: 'user' | 'ai' = 'ai', content = id): Message {
  return { id, sessionId: 's', parentId, role, variants: [{ content, createdAt: 0 }], activeVariant: 0, createdAt: 0 }
}

describe('getThread', () => {
  const messages = [msg('a', null), msg('b', 'a', 'user'), msg('c', 'b'), msg('c2', 'b'), msg('d', 'c', 'user')]

  it('suit la branche de la feuille active jusqu\'à la racine', () => {
    expect(getThread(messages, 'd').map((m) => m.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(getThread(messages, 'c2').map((m) => m.id)).toEqual(['a', 'b', 'c2'])
  })

  it('renvoie un fil vide sans feuille', () => {
    expect(getThread(messages, null)).toEqual([])
  })

  it('résiste à une boucle accidentelle', () => {
    const loop = [msg('x', 'y'), msg('y', 'x')]
    expect(getThread(loop, 'x')).toHaveLength(2)
  })
})

describe('toEntries', () => {
  it('lit la variante active', () => {
    const m = msg('a', null)
    m.variants.push({ content: 'deuxième', createdAt: 1 })
    m.activeVariant = 1
    expect(toEntries([m])[0]).toEqual({ id: 'a', role: 'ai', ooc: false, content: 'deuxième' })
  })
})

describe('descendantIds', () => {
  it('inclut le message et toute sa descendance', () => {
    const messages = [msg('a', null), msg('b', 'a'), msg('c', 'b'), msg('d', 'a')]
    expect(descendantIds(messages, 'b').sort()).toEqual(['b', 'c'])
    expect(descendantIds(messages, 'a').sort()).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('parseOocCommand', () => {
  it('reconnaît /OOC quelle que soit la casse', () => {
    expect(parseOocCommand('/ooc résume la situation')).toEqual({ ooc: true, text: 'résume la situation' })
    expect(parseOocCommand('  /OOC   passe à demain matin ')).toEqual({ ooc: true, text: 'passe à demain matin' })
  })
  it('laisse passer un message normal', () => {
    expect(parseOocCommand('Je frappe à la porte')).toEqual({ ooc: false, text: 'Je frappe à la porte' })
    expect(parseOocCommand('/oocasion')).toEqual({ ooc: false, text: '/oocasion' })
  })
})

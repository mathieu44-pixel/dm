import { describe, expect, it } from 'vitest'
import type { ThreadEntry } from '../session/types'
import { buildHistory, buildSystemPrompt, OOC_PREFIX } from './storyPrompt'

const entry = (role: 'user' | 'ai', content: string, ooc = false): ThreadEntry => ({ id: content, role, ooc, content })

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt({
    title: 'Le Gué',
    worldLore: 'Un royaume pluvieux.',
    systemPrompt: '',
    writingRules: 'Sombre.',
    characters: [{ name: 'Maëlle', title: 'Aubergiste', appearance: '', personality: 'Bourrue', speech: '', background: 'Ancienne mercenaire' }],
    avatar: { name: 'Annaelle', details: 'Voyageuse', gift: '' },
  })

  it('contient les règles de format et le nom du joueur', () => {
    expect(prompt).toContain('「')
    expect(prompt).toContain('Nom | "réplique"')
    expect(prompt).toContain("N'écris jamais les paroles, les pensées ou les décisions de Annaelle")
  })

  it('inclut univers, style, personnages et avatar, mais pas les sections vides', () => {
    expect(prompt).toContain('## Univers\nUn royaume pluvieux.')
    expect(prompt).toContain("## Style d'écriture\nSombre.")
    expect(prompt).toContain('### Maëlle — Aubergiste')
    expect(prompt).toContain('Personnalité : Bourrue')
    expect(prompt).toContain('Nom : Annaelle')
    expect(prompt).not.toContain("## Consignes de l'autrice")
  })

  it('fonctionne sans avatar', () => {
    const p = buildSystemPrompt({ title: 'T', worldLore: 'M', systemPrompt: '', writingRules: '', characters: [], avatar: null })
    expect(p).toContain('le personnage du joueur')
  })
})

describe('buildHistory', () => {
  it('commence par un message utilisateur puis le prologue, et alterne les rôles', () => {
    const history = buildHistory([entry('ai', 'Prologue'), entry('user', 'Bonjour'), entry('ai', 'Réponse')])
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(history[1].content).toBe('Prologue')
  })

  it('marque les échanges hors-jeu', () => {
    const history = buildHistory([entry('ai', 'Prologue'), entry('user', 'résume', true)])
    expect(history[2].content).toBe(`${OOC_PREFIX} résume`)
  })

  it('fusionne deux messages consécutifs du même rôle', () => {
    const history = buildHistory([entry('ai', 'Prologue'), entry('user', 'A'), entry('user', 'B')])
    expect(history).toHaveLength(3)
    expect(history[2].content).toBe('A\n\nB')
  })

  it('omet les messages les plus anciens au-delà du budget, mais garde le prologue', () => {
    const long = 'x'.repeat(100)
    const entries = [entry('ai', 'Prologue'), ...Array.from({ length: 10 }, (_, i) => entry(i % 2 ? 'ai' : 'user', `${i}${long}`))]
    const history = buildHistory(entries, 450)
    expect(history[1].content).toBe('Prologue')
    expect(history.some((m) => /messages plus anciens ont été omis/.test(m.content))).toBe(true)
    expect(history[history.length - 1].content.startsWith('9')).toBe(true)
  })
})

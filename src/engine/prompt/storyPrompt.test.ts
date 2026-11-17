import { describe, expect, it } from 'vitest'
import type { ThreadEntry } from '../session/types'
import { buildHistory, buildMemoryPrompt, buildSystemPrompt, OOC_PREFIX } from './storyPrompt'

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

describe('buildHistory avec résumé', () => {
  it('saute les messages résumés mais garde le prologue et la suite', () => {
    const entries = [entry('ai', 'Prologue'), entry('user', 'U1'), entry('ai', 'A1'), entry('user', 'U2'), entry('ai', 'A2')]
    const history = buildHistory(entries, 60_000, 2)
    const contents = history.map((m) => m.content).join(' | ')
    expect(contents).toContain('Prologue')
    expect(contents).not.toContain('U1')
    expect(contents).not.toContain('A1')
    expect(contents).toContain('U2')
    expect(history[history.length - 1].content).toBe('A2')
    // Les rôles alternent toujours.
    history.forEach((m, i) => i > 0 && expect(m.role).not.toBe(history[i - 1].role))
  })
})

describe('buildMemoryPrompt', () => {
  const m = (kind: 'long' | 'fact' | 'relation' | 'goal', text: string) => ({ id: text, sessionId: 's', kind, text, source: 'ai' as const, createdAt: 0, updatedAt: 0 })

  it('assemble notes, souvenirs, mémoire automatique et résumé', () => {
    const prompt = buildMemoryPrompt({
      globalNotes: 'Pas de gore.',
      sessionNotes: 'Annaelle a 25 ans.',
      memories: [m('fact', 'Il pleut'), m('long', 'La lettre est scellée'), m('relation', 'Maëlle se méfie')],
      summary: 'Annaelle est arrivée.',
    })
    expect(prompt).toContain('Pas de gore.\n\nAnnaelle a 25 ans.')
    expect(prompt).toContain('## Souvenirs importants\n- La lettre est scellée')
    expect(prompt.indexOf('Relation : Maëlle se méfie')).toBeLessThan(prompt.indexOf('Fait : Il pleut'))
    expect(prompt).toContain("## Résumé de l'histoire jusqu'ici\nAnnaelle est arrivée.")
  })

  it('est vide sans mémoire', () => {
    expect(buildMemoryPrompt({ globalNotes: '', sessionNotes: '', memories: [], summary: '' })).toBe('')
  })
})

describe('réglages de partie et commandes', () => {
  it('ajoute langue, longueur, style et surnoms aux consignes dynamiques', () => {
    const prompt = buildMemoryPrompt({
      globalNotes: '',
      sessionNotes: '',
      memories: [],
      summary: '',
      language: 'Écris en anglais.',
      length: 'Réponses courtes.',
      style: 'Ton léger.',
      aliases: ['La Dague Muette'],
    })
    expect(prompt).toContain('Écris en anglais.')
    expect(prompt).toContain('Longueur : Réponses courtes.')
    expect(prompt).toContain("Style d'écriture : Ton léger.")
    expect(prompt).toContain('La Dague Muette')
  })

  it('développe les commandes personnalisées dans l\'historique', () => {
    const commands = [{ name: 'Flashback', description: '', instruction: 'Raconte un souvenir.' }]
    const history = buildHistory([entry('ai', 'Prologue'), entry('user', '/flashback enfance')], 60_000, -1, commands)
    expect(history[2].content).toBe('[Commande /Flashback : Raconte un souvenir.]\nenfance')
  })
})

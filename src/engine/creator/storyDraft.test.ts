import { describe, expect, it } from 'vitest'
import { draftToStory } from '../../data/creator'
import { validateStory } from '../../data/storyModel'
import { buildCreationRequest, DraftParseError, parseStoryDraft, type CreationOptions } from './storyDraft'

const options: CreationOptions = { idea: 'Un huis clos dans un manoir hanté', mode: 'story', language: 'fr', withProgression: true }

const reply = {
  title: 'Le Manoir des Veilleurs',
  subtitle: 'Une nuit, six invités, une porte qui ne s’ouvre plus.',
  tags: ['horreur', 'huis clos'],
  worldLore: 'Le manoir Ashcombe…',
  systemPrompt: 'Tu mènes un huis clos…',
  writingRules: 'Ton gothique.',
  characters: [
    { name: 'Edmond', title: 'Majordome', appearance: 'Grand', personality: 'Froid', speech: 'Formel', background: 'Secret' },
    { name: 'edmond', title: 'Doublon' },
    { name: 'Lise', title: 'Médium' },
  ],
  prologue: '「La porte claque.」\nEdmond | "Bienvenue."',
  suggestions: ['J’examine la porte', 'Je parle à Lise', 'Je fouille le salon', 'en trop'],
  stats: [
    { id: 's1', name: 'Santé mentale', icon: '🧠', min: 0, max: 100, initial: 80, low: 'Brisé', mid: 'Tendu', high: 'Lucide', rules: 'Baisse face au surnaturel' },
    { id: 's2', name: 'Confiance de Lise', icon: '🕯️', min: 10, max: 5, initial: 999 },
  ],
  endings: [
    { name: 'L’aube', rarity: 'N', card: 'Tu survis.', epilogue: '…', minTurn: 15, conditions: [{ stat: 's1', cmp: '>=', value: 50 }] },
    { name: 'Le Veilleur', rarity: 'XXL', minTurn: 'abc', conditions: [{ stat: 's9', cmp: '<', value: 1 }, { stat: 's2', cmp: '??', value: 70 }] },
  ],
}

describe('buildCreationRequest', () => {
  it('inclut l’idée, la langue et le schéma des jauges', () => {
    const req = buildCreationRequest('m', { ...options, language: 'en' })
    const text = req.messages[0].content
    expect(text).toContain('manoir hanté')
    expect(text).toContain('EN ANGLAIS')
    expect(text).toContain('"stats"')
  })
  it('omet jauges et fins en mode personnage', () => {
    const text = buildCreationRequest('m', { ...options, mode: 'character' }).messages[0].content
    expect(text).not.toContain('"stats"')
    expect(text).toContain('UN seul personnage')
  })
})

describe('parseStoryDraft', () => {
  it('lit une réponse entourée de texte et de balises de code', () => {
    const draft = parseStoryDraft('Voici :\n```json\n' + JSON.stringify(reply) + '\n```', options)
    expect(draft.title).toBe('Le Manoir des Veilleurs')
    expect(draft.characters.map((c) => c.name)).toEqual(['Edmond', 'Lise'])
    expect(draft.suggestions).toHaveLength(3)
    expect(draft.stats[1]).toMatchObject({ min: 0, max: 100, initial: 100 })
    expect(draft.endings[1]).toMatchObject({ rarity: 'N', minTurn: 20, conditions: [{ alias: 's2', cmp: '>=', value: 70 }] })
  })
  it('ignore les jauges sans progression demandée', () => {
    const draft = parseStoryDraft(JSON.stringify(reply), { mode: 'story', withProgression: false })
    expect(draft.stats).toEqual([])
    expect(draft.endings).toEqual([])
  })
  it('ne garde qu’un personnage en mode personnage', () => {
    expect(parseStoryDraft(JSON.stringify(reply), { mode: 'character', withProgression: true }).characters).toHaveLength(1)
  })
  it('signale une réponse inutilisable', () => {
    expect(() => parseStoryDraft('désolée', options)).toThrow(DraftParseError)
    expect(() => parseStoryDraft(JSON.stringify({ title: 'x' }), options)).toThrow(DraftParseError)
  })
})

describe('draftToStory', () => {
  it('produit une histoire valide avec jauges et fins reliées', () => {
    const { story, characters } = draftToStory(parseStoryDraft(JSON.stringify(reply), options), options)
    expect(validateStory(story, characters)).toEqual([])
    const start = story.startSettings[0]
    const mental = start.stats![0]
    expect(start.endings![0].condition.items).toEqual([
      { type: 'turn', gte: 15 },
      { type: 'stat', statId: mental.id, cmp: '>=', value: 50 },
    ])
    expect(story.characterIds).toEqual(characters.map((c) => c.id))
    expect(story.defaultLanguage).toBe('fr')
  })
  it('garde l’idée comme univers si l’IA n’en a pas donné', () => {
    const minimal = parseStoryDraft(JSON.stringify({ title: 'T', prologue: '「…」' }), options)
    const { story, characters } = draftToStory(minimal, options)
    expect(story.worldLore).toContain('manoir hanté')
    expect(validateStory(story, characters)).toEqual([])
  })
})

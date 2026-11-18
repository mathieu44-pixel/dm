import { describe, expect, it } from 'vitest'
import type { Character, Story } from '../../data/types'
import type { ImageAsset } from '../images/types'
import { applyTranslations, buildChunkRequest, chunkItems, collectTexts, parseChunk, remapCopy } from './storyTranslation'

const story: Story = {
  id: 's1',
  title: 'Le Gué',
  subtitle: 'Une auberge',
  tags: ['fantasy', 'mystère'],
  mode: 'story',
  worldLore: 'Un village.',
  systemPrompt: '',
  writingRules: '',
  characterIds: ['c1'],
  startSettings: [
    {
      id: 'st',
      name: 'Départ',
      prologue: '「Il pleut.」',
      initialSuggestions: ['Entrer'],
      stats: [{ id: 'x', name: 'Or', icon: '🪙', color: '#fff', min: 0, max: 10, initial: 1, levels: { low: '', mid: '', high: '' }, rulesText: 'monte' }],
      endings: [{ id: 'e', name: 'Fin', rarity: 'N', cardText: 'Carte', epilogue: 'Épilogue', condition: { op: 'AND', items: [] }, imageId: 'i1' }],
    },
  ],
  coverImageId: 'i1',
  lore: [{ id: 'l', keys: ['auberge'], content: 'Une auberge.' }],
  defaultLanguage: 'fr',
  createdAt: 0,
  updatedAt: 0,
}
const chars: Character[] = [
  { id: 'c1', name: 'Maëlle', title: 'Aubergiste', appearance: 'Rousse', personality: '', speech: '', background: '', portraitImageId: 'i1', createdAt: 0, updatedAt: 0 },
]
const imgs: ImageAsset[] = [
  { id: 'i1', storyId: 's1', mime: '', width: 0, height: 0, category: 'character', tags: ['Maëlle'], description: 'Portrait', characterId: 'c1', createdAt: 0 },
]

describe('traduction d’une histoire', () => {
  it('collecte les textes non vides et les regroupe en lots', () => {
    const items = collectTexts(story, chars, imgs)
    expect(items.map((i) => i.key)).toContain('st.0.prologue')
    expect(items.map((i) => i.key)).not.toContain('s.systemPrompt')
    expect(chunkItems(items, 20).length).toBeGreaterThan(1)
  })

  it('construit la requête et lit la réponse balisée', () => {
    const items = [
      { key: 'a', text: 'Bonjour' },
      { key: 'b', text: '「Il pleut.」\n*Vent*' },
    ]
    expect(buildChunkRequest('m', items, 'en', ['Maëlle']).messages[0].content).toContain('@@@ 2 @@@\n「Il pleut.」')
    const map = parseChunk('@@@ 1 @@@\nHello\n@@@ 2 @@@\n「It rains.」\n*Wind*', items)
    expect(map.get('a')).toBe('Hello')
    expect(map.get('b')).toBe('「It rains.」\n*Wind*')
  })

  it('applique les traductions et garde l’original quand il en manque', () => {
    const t = new Map([
      ['st.0.prologue', '「It rains.」'],
      ['lore.0.keys', 'inn'],
      ['s.tags', 'fantasy, mystery'],
    ])
    const r = applyTranslations(story, chars, imgs, t)
    expect(r.story.startSettings[0].prologue).toBe('「It rains.」')
    expect(r.story.title).toBe('Le Gué')
    expect(r.story.lore?.[0].keys).toEqual(['auberge', 'inn'])
    expect(r.story.tags).toEqual(['fantasy', 'mystery'])
  })

  it('crée une copie indépendante avec les références remises à jour', () => {
    let n = 0
    const r = remapCopy(story, chars, imgs, () => `n${++n}`, 5)
    expect(r.story.id).not.toBe('s1')
    expect(r.characters[0].id).not.toBe('c1')
    expect(r.story.characterIds).toEqual([r.characters[0].id])
    expect(r.characters[0].portraitImageId).toBe(r.images[0].id)
    expect(r.story.coverImageId).toBe(r.images[0].id)
    expect(r.story.startSettings[0].endings?.[0].imageId).toBe(r.images[0].id)
    expect(r.images[0]).toMatchObject({ storyId: r.story.id, characterId: r.characters[0].id })
  })
})

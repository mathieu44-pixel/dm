import { describe, expect, it } from 'vitest'
import { parseCharacterCard } from '../engine/import/sillytavern'
import { cardToStory } from './importCard'
import { validateStory } from './storyModel'

describe('cardToStory', () => {
  const card = parseCharacterCard({
    data: {
      name: 'Lyra',
      description: '{{char}} est une barde.',
      personality: 'Espiègle',
      scenario: 'Une taverne où {{user}} entre.',
      first_mes: '*Elle sourit.*\n"Salut, {{user}} !"',
      alternate_greetings: ['"Encore toi ?"'],
      mes_example: '{{char}}: Bonjour.',
      tags: ['fantasy', 'barde'],
      character_book: { entries: [{ keys: ['luth'], content: 'Le luth est enchanté.' }] },
    },
  })

  it('crée une histoire valide en mode Character avec un point de départ par accueil', () => {
    const { story, character } = cardToStory(card, 0)
    expect(story.mode).toBe('character')
    expect(story.startSettings.map((s) => s.prologue)).toEqual(['「Elle sourit.」\nLyra | "Salut, {{user}} !"', 'Lyra | "Encore toi ?"'])
    expect(character.background).toBe('Lyra est une barde.')
    expect(story.worldLore).toContain('Une taverne où {{user}} entre.')
    expect(story.worldLore).not.toContain('luth')
    expect(story.lore).toMatchObject([{ keys: ['luth'], content: 'Le luth est enchanté.' }])
    expect(validateStory(story, [character])).toEqual([])
  })
})

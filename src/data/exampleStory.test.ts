import { describe, expect, it } from 'vitest'
import { parseNarrative } from '../engine/parser/narrative'
import { EXAMPLE_CHARACTERS, EXAMPLE_STORY } from './exampleStory'
import { validateStory } from './storyModel'

describe("histoire d'exemple", () => {
  it('est valide', () => {
    expect(validateStory(EXAMPLE_STORY, EXAMPLE_CHARACTERS)).toEqual([])
  })

  it('référence tous ses personnages', () => {
    expect(EXAMPLE_STORY.characterIds).toEqual(EXAMPLE_CHARACTERS.map((c) => c.id))
  })

  it('a un prologue au format narratif, avec une réplique d\'un personnage connu', () => {
    const segments = parseNarrative(EXAMPLE_STORY.startSettings[0].prologue)
    const dialogue = segments.find((s) => s.type === 'dialogue')
    expect(segments.filter((s) => s.type === 'narration').length).toBeGreaterThanOrEqual(2)
    expect(dialogue && dialogue.type === 'dialogue' ? dialogue.speaker : '').toBe('Maëlle Vautrin')
  })

  it('propose 3 actions de départ', () => {
    expect(EXAMPLE_STORY.startSettings[0].initialSuggestions).toHaveLength(3)
  })
})

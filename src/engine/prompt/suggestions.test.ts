import { describe, expect, it } from 'vitest'
import { buildSuggestionsRequest, parseSuggestions } from './suggestions'

describe('parseSuggestions', () => {
  it('lit un tableau JSON, même entouré de texte ou de balises de code', () => {
    expect(parseSuggestions('```json\n["Je fuis.", "Je parle.", "J\'attends."]\n```')).toEqual(['Je fuis.', 'Je parle.', "J'attends."])
  })

  it('garde 3 suggestions au maximum et ignore les vides', () => {
    expect(parseSuggestions('["a1", "", "b2", "c3", "d4"]')).toEqual(['a1', 'b2', 'c3'])
  })

  it('se rabat sur une liste à puces ou numérotée', () => {
    expect(parseSuggestions('1. Je fouille la cave\n2) Je questionne le moine\n- Je sors sous la pluie')).toEqual([
      'Je fouille la cave',
      'Je questionne le moine',
      'Je sors sous la pluie',
    ])
  })

  it('renvoie une liste vide si rien n\'est exploitable', () => {
    expect(parseSuggestions('')).toEqual([])
  })
})

describe('buildSuggestionsRequest', () => {
  it('n\'envoie que les derniers échanges hors /OOC', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, role: (i % 2 ? 'user' : 'ai') as 'user' | 'ai', ooc: i === 9, content: `msg${i}` }))
    const req = buildSuggestionsRequest('m', 'Annaelle', entries)
    const text = req.messages[0].content
    expect(text).toContain('msg8')
    expect(text).not.toContain('msg9')
    expect(text).not.toContain('msg2')
    expect(text).toContain('JOUEUR (Annaelle)')
  })
})

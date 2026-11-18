import { describe, expect, it } from 'vitest'
import { buildMoodVisionRequest, guessMoodFromWords, guessOwner, parseMoodVision } from './autoMood'

describe('humeurs automatiques', () => {
  it('devine l’humeur d’après les mots', () => {
    expect(guessMoodFromWords('Susanoo au combat, duel divin')).toBe('combat')
    expect(guessMoodFromWords('Yuri_angry.png')).toBe('angry')
    expect(guessMoodFromWords('Maëlle sourit, joyeuse')).toBe('happy')
    expect(guessMoodFromWords('Portrait de Maëlle')).toBe('neutral')
    expect(guessMoodFromWords('Maëlle')).toBeUndefined()
    expect(guessMoodFromWords('happy sad')).toBeUndefined()
  })

  it('retrouve le personnage d’une image', () => {
    const chars = [
      { id: 'a', name: 'Han Yuri', portraitImageId: 'p' },
      { id: 'b', name: 'Han Gyeoul' },
    ]
    expect(guessOwner({ id: 'p', tags: [], description: '' }, chars)).toBe('a')
    expect(guessOwner({ id: 'x', tags: ['Gyeoul', 'angry'], description: '' }, chars)).toBe('b')
    expect(guessOwner({ id: 'x', tags: ['Han'], description: '' }, chars)).toBeUndefined()
    expect(guessOwner({ id: 'x', tags: [], description: 'Han Yuri en colère' }, chars)).toBe('a')
  })

  it('construit la demande à l’IA qui voit et lit sa réponse', () => {
    const req = buildMoodVisionRequest('m', [{ name: 'Yuri', image: { mime: 'image/webp', data: 'AAA' } }])
    expect(req.messages[0].images).toHaveLength(1)
    expect(parseMoodVision('1: Happy\n2: furious\n3 - combat', 3)).toEqual(['happy', undefined, 'combat'])
  })
})

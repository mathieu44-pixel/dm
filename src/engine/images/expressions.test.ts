import { describe, expect, it } from 'vitest'
import { expressionSets, expressive, pickExpression } from './expressions'

const chars = [
  { id: 'y', name: 'Han Yuri', portraitImageId: 'p1' },
  { id: 'h', name: 'Hong Hwaryeon' },
]
const images = [
  { id: 'p1', category: 'character' as const, tags: ['Han Yuri'] },
  { id: 'p2', category: 'character' as const, tags: ['han yuri', 'colère'], mood: 'angry' as const },
  { id: 'p3', category: 'character' as const, tags: [], characterId: 'y', mood: 'angry' as const },
  { id: 'h1', category: 'character' as const, tags: ['Hong Hwaryeon'] },
  { id: 's1', category: 'scene' as const, tags: ['Han Yuri', 'bureau'] },
]

describe('expressions', () => {
  it('regroupe les images de chaque personnage par humeur', () => {
    const [yuri, hwa] = expressionSets(chars, images)
    expect(yuri.byMood).toEqual({ neutral: ['p1'], angry: ['p2', 'p3'] })
    expect(hwa.byMood).toEqual({ neutral: ['h1'] })
  })
  it('ne garde que les personnages qui ont plusieurs humeurs', () => {
    expect(expressive(expressionSets(chars, images)).map((s) => s.name)).toEqual(['Han Yuri'])
  })
  it('choisit une image de l’humeur, sinon neutre, et varie selon la graine', () => {
    const [yuri] = expressionSets(chars, images)
    expect(pickExpression(yuri, 'angry', 0)).toBe('p2')
    expect(pickExpression(yuri, 'angry', 1)).toBe('p3')
    expect(pickExpression(yuri, 'sad')).toBe('p1')
  })
})

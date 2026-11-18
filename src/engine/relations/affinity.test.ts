import { describe, expect, it } from 'vitest'
import { affinityLevel, affinityLines, applyAffinityDeltas, meetCharacters } from './affinity'

const chars = [
  { id: 'a', name: 'Han Yuri' },
  { id: 'b', name: 'Hong Hwaryeon' },
  { id: 'c', name: 'Seraphina' },
  { id: 'd', name: 'Lee Hyeon' },
  { id: 'e', name: 'Han Gyeoul' },
]

describe('meetCharacters', () => {
  it('rencontre les personnages cités (nom complet ou prénom distinctif), à 50', () => {
    const v = meetCharacters({}, chars, 'Han Yuri | "Salut !"\n「Hwaryeon soupire.」')
    expect(v).toEqual({ a: 50, b: 50 })
  })
  it('ne remet pas à zéro un personnage déjà rencontré, ignore les morceaux de mots', () => {
    const v = meetCharacters({ a: 72 }, chars, 'Han Yuri et les seraphinas de papier. Leeway.')
    expect(v).toEqual({ a: 72 })
  })
  it('ne compte pas un nom de famille partagé', () => {
    expect(meetCharacters({}, chars, 'Han Yuri arrive.')).toEqual({ a: 50 })
    expect(meetCharacters({}, chars, 'Gyeoul arrive.')).toEqual({ e: 50 })
  })
})

describe('applyAffinityDeltas', () => {
  it('borne à ±10 par tour et entre 0 et 100, ignore les inconnus', () => {
    const v = applyAffinityDeltas({ a: 95, b: 50, c: 5 }, [
      { characterId: 'a', delta: 8 },
      { characterId: 'b', delta: 40 },
      { characterId: 'c', delta: -20 },
      { characterId: 'd', delta: 5 },
    ])
    expect(v).toEqual({ a: 100, b: 60, c: 0 })
  })
})

describe('affichage', () => {
  it('donne un niveau et des lignes pour la narratrice', () => {
    expect(affinityLevel(85).label).toBe('Complice')
    expect(affinityLevel(50).label).toBe('Neutre')
    expect(affinityLevel(10).label).toBe('Hostile')
    expect(affinityLines({ a: 72 }, chars)).toEqual(['Han Yuri : 72/100 (Amical)'])
  })
})

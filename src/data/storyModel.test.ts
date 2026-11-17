import { describe, expect, it } from 'vitest'
import { cleanSuggestions, newAvatar, newCharacter, newStory, parseTags, validateAvatar, validateStory } from './storyModel'

describe('parseTags', () => {
  it('nettoie, déduplique sans tenir compte de la casse et retire les #', () => {
    expect(parseTags(' fantasy, Mystère ,, #Fantasy, enquête')).toEqual(['fantasy', 'Mystère', 'enquête'])
  })
  it('limite le nombre de tags', () => {
    expect(parseTags('a,b,c,d,e,f,g,h,i,j')).toHaveLength(8)
  })
})

describe('cleanSuggestions', () => {
  it('retire les vides et garde 3 suggestions au maximum', () => {
    expect(cleanSuggestions([' Fuir ', '', 'Parler', 'Attendre', 'Combattre'])).toEqual(['Fuir', 'Parler', 'Attendre'])
  })
})

describe('validateStory', () => {
  const valid = () => {
    const story = newStory()
    story.title = 'Le Gué'
    story.worldLore = 'Un monde'
    story.startSettings[0].prologue = '「Il pleut.」'
    return story
  }

  it('accepte une histoire complète', () => {
    expect(validateStory(valid(), [])).toEqual([])
  })

  it('exige un titre, un univers ou des consignes, et un prologue', () => {
    const errors = validateStory(newStory(), [])
    expect(errors).toEqual(
      expect.arrayContaining([
        'Donne un titre à ton histoire.',
        "Décris au moins l'univers ou les consignes de la narratrice.",
        "Le point de départ n°1 n'a pas de prologue.",
      ]),
    )
  })

  it('refuse un personnage sans nom ou deux homonymes', () => {
    const a = { ...newCharacter(), name: 'Maëlle' }
    const b = { ...newCharacter(), name: 'maëlle ' }
    const c = newCharacter()
    const errors = validateStory(valid(), [a, b, c])
    expect(errors).toContain("Le personnage n°3 n'a pas de nom.")
    expect(errors).toContain('Deux personnages portent le même nom.')
  })
})

describe('validateAvatar', () => {
  it('impose le nom et les limites de longueur', () => {
    expect(validateAvatar(newAvatar())).toContain('Le nom est obligatoire.')
    const long = { ...newAvatar(), name: 'x'.repeat(41), details: 'y'.repeat(501) }
    expect(validateAvatar(long)).toHaveLength(2)
  })
})

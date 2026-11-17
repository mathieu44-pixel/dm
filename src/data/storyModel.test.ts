import { describe, expect, it } from 'vitest'
import { cleanSuggestions, conditionStatIds, newAvatar, newCharacter, newEnding, newStat, newStory, parseTags, validateAvatar, validateStory } from './storyModel'

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

describe('validateStory (jauges et fins)', () => {
  const base = () => {
    const story = newStory()
    story.title = 'T'
    story.worldLore = 'M'
    story.startSettings[0].prologue = 'P'
    return story
  }

  it('accepte des jauges et fins cohérentes', () => {
    const story = base()
    const stat = { ...newStat(), name: 'Confiance' }
    const ending = { ...newEnding(), name: 'Fin', condition: { op: 'AND' as const, items: [{ type: 'stat' as const, statId: stat.id, cmp: '>=' as const, value: 60 }] } }
    story.startSettings[0].stats = [stat]
    story.startSettings[0].endings = [ending]
    expect(validateStory(story, [])).toEqual([])
  })

  it('signale bornes incohérentes, fin sans condition et jauge supprimée', () => {
    const story = base()
    story.startSettings[0].stats = [{ ...newStat(), name: 'X', min: 10, max: 5 }]
    story.startSettings[0].endings = [
      { ...newEnding(), name: 'A', condition: { op: 'AND', items: [] } },
      { ...newEnding(), name: 'B', condition: { op: 'OR', items: [{ type: 'stat', statId: 'disparue', cmp: '<', value: 1 }] } },
    ]
    const errors = validateStory(story, [])
    expect(errors).toContain('Jauge X : le minimum doit être inférieur au maximum.')
    expect(errors).toContain('Fin A : ajoute au moins une condition.')
    expect(errors).toContain('Fin B : une condition utilise une jauge supprimée.')
  })

  it('trouve les jauges des conditions imbriquées', () => {
    expect(conditionStatIds({ op: 'AND', items: [{ type: 'turn', gte: 1 }, { op: 'OR', items: [{ type: 'stat', statId: 'a', cmp: '<', value: 1 }] }] })).toEqual(['a'])
  })
})

describe('validateStory (commandes)', () => {
  it('refuse les noms réservés, les doublons et les consignes vides', () => {
    const story = newStory()
    story.title = 'T'
    story.worldLore = 'M'
    story.startSettings[0].prologue = 'P'
    story.commands = [
      { name: 'OOC', description: '', instruction: 'x' },
      { name: 'Rêve', description: '', instruction: 'x' },
      { name: 'rêve', description: '', instruction: '' },
    ]
    const errors = validateStory(story, [])
    expect(errors).toContain("La commande /OOC existe déjà dans l'application.")
    expect(errors).toContain("Deux commandes s'appellent /rêve.")
    expect(errors).toContain("La commande /rêve n'a pas de consigne.")
  })
})

import { describe, expect, it } from 'vitest'
import { parseCharacterCard } from './sillytavern'
import { cardRequest, chubToCard, parseCardUrl, pygmalionToCard, splitLinks } from './cardUrl'

describe('parseCardUrl', () => {
  it('reconnaît les liens Chub', () => {
    expect(parseCardUrl('https://chub.ai/characters/Anonymous/example-character')).toEqual({ site: 'chub', id: 'Anonymous/example-character' })
    expect(parseCardUrl('https://www.characterhub.org/characters/a/b?tab=x')).toEqual({ site: 'chub', id: 'a/b' })
    expect(parseCardUrl('https://chub.ai/lorebooks/a/b')).toBeNull()
  })
  it('reconnaît RisuAI, Pygmalion et AICharacterCards', () => {
    expect(parseCardUrl('https://realm.risuai.net/character/3ca54c71-6efe-46a2-b9d0-4f62df23d712')?.site).toBe('risu')
    expect(parseCardUrl('https://pygmalion.chat/character/a7ca95a1-0c88-4e23-91b3-149db1e78ab9')).toEqual({ site: 'pygmalion', id: 'a7ca95a1-0c88-4e23-91b3-149db1e78ab9' })
    expect(parseCardUrl('https://aicharactercards.com/character-cards/fantasy/mia/')).toEqual({ site: 'aicc', id: 'fantasy/mia' })
  })
  it('refuse les autres sites et les textes qui ne sont pas des liens', () => {
    expect(parseCardUrl('https://character-tavern.com/character/x/y')).toBeNull()
    expect(parseCardUrl('pas un lien')).toBeNull()
  })
})

describe('cardRequest', () => {
  it('construit les adresses de téléchargement', () => {
    expect(cardRequest({ site: 'chub', id: 'Anonymous/example' }).url).toBe('https://api.chub.ai/api/characters/Anonymous/example?full=true')
    expect(cardRequest({ site: 'risu', id: 'abc' })).toEqual({ kind: 'png', url: 'https://realm.risuai.net/api/v1/download/png-v3/abc?non_commercial=true' })
  })
})

describe('conversion des réponses', () => {
  it('convertit une réponse Chub en carte lisible', () => {
    const { card, imageUrl } = chubToCard({
      node: {
        name: 'Aqua',
        topics: ['fantasy'],
        max_res_url: 'https://img/aqua.png',
        definition: { name: 'Aqua', personality: 'Déesse de l’eau.', tavern_personality: 'Vaniteuse', first_message: 'Salut !', description: 'Notes' },
      },
    })
    const parsed = parseCharacterCard(card)
    expect(parsed).toMatchObject({ name: 'Aqua', description: 'Déesse de l’eau.', personality: 'Vaniteuse', firstMessage: 'Salut !', creatorNotes: 'Notes', tags: ['fantasy'] })
    expect(imageUrl).toBe('https://img/aqua.png')
  })
  it('signale une réponse Chub vide', () => {
    expect(() => chubToCard({})).toThrow()
  })
  it('lit l’export Pygmalion', () => {
    const { card, imageUrl } = pygmalionToCard({ character: { spec: 'chara_card_v2', data: { name: 'Bob', avatar: 'https://img/bob.png' } } })
    expect(parseCharacterCard(card).name).toBe('Bob')
    expect(imageUrl).toBe('https://img/bob.png')
  })
})

describe('splitLinks', () => {
  it('extrait les liens uniques', () => {
    expect(splitLinks('https://a.com/x\n\n https://b.com/y https://a.com/x texte')).toEqual(['https://a.com/x', 'https://b.com/y'])
  })
})

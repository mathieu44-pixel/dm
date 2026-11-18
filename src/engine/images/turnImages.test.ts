import { describe, expect, it } from 'vitest'
import type { ImageAsset } from './types'
import { chooseSceneImage, prepareTurnImages, resolveExpressions } from './turnImages'

const img = (id: string, characterId: string, mood?: ImageAsset['mood']): ImageAsset => ({
  id,
  storyId: 's',
  mime: '',
  width: 0,
  height: 0,
  category: 'character',
  tags: [],
  description: '',
  characterId,
  ...(mood ? { mood } : {}),
  createdAt: 0,
})
const characters = [{ id: 'c1', name: 'Susanoo', portraitImageId: 'p' }]
const images = [img('p', 'c1', 'neutral'), img('f', 'c1', 'combat')]

describe('images du tour', () => {
  it('annote les images et repère les personnages présents', () => {
    const r = prepareTurnImages(characters, images, { id: 'm', role: 'ai', ooc: false, content: 'Susanoo | "En garde !"' })
    expect(r.expressionInput).toEqual([{ name: 'Susanoo', moods: ['neutral', 'combat'] }])
    expect(r.sceneImages.find((i) => i.id === 'f')?.tags).toContain('Au combat')
    expect(prepareTurnImages(characters, images, { id: 'm', role: 'ai', ooc: false, content: 'Personne ici.' }).expressionInput).toEqual([])
  })

  it('remplace le portrait choisi par l’IA par l’image d’humeur', () => {
    const { sets } = prepareTurnImages(characters, images, undefined)
    const map = resolveExpressions(sets, [{ name: 'Susanoo', mood: 'combat' }], 'm')
    expect(map).toEqual({ Susanoo: 'f' })
    expect(chooseSceneImage('', 'p', sets, map, { Susanoo: 'p' })).toBe('f')
    expect(chooseSceneImage('Susanoo | "Ha !"', undefined, sets, map, { Susanoo: 'p' })).toBe('f')
    expect(chooseSceneImage('Susanoo | "Ha !"', undefined, sets, {}, { Susanoo: 'p' })).toBe('p')
  })
})

import { describe, expect, it } from 'vitest'
import { fitWithin, parseImageTags } from './utils'

describe('fitWithin', () => {
  it('réduit en gardant les proportions', () => {
    expect(fitWithin(2560, 1440, 1280)).toEqual({ width: 1280, height: 720 })
    expect(fitWithin(1000, 3000, 1280)).toEqual({ width: 427, height: 1280 })
  })
  it("n'agrandit jamais", () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 })
  })
})

describe('parseImageTags', () => {
  it('nettoie et déduplique', () => {
    expect(parseImageTags(' salle commune, Nuit ,, nuit, Maëlle')).toEqual(['salle commune', 'Nuit', 'Maëlle'])
  })
})

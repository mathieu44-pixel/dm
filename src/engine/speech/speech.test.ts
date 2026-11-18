import { describe, expect, it } from 'vitest'
import { pickVoice, speechChunks } from './speech'

describe('speechChunks', () => {
  it('lit la narration et annonce le personnage qui parle', () => {
    const text = '「La porte grince.」\nMaëlle | "Entre."\nMaëlle | "Vite."\n*Elle sourit.*\nIsolde | "Non."'
    expect(speechChunks(text)).toEqual(['La porte grince.', 'Maëlle. Entre.', 'Vite.', 'Elle sourit.', 'Isolde. Non.'])
  })
  it('découpe les longs passages par phrases', () => {
    const long = `「${'Une phrase assez longue pour remplir. '.repeat(12)}」`
    const chunks = speechChunks(long, 100)
    expect(chunks.length).toBeGreaterThan(3)
    expect(chunks.every((c) => c.length <= 100)).toBe(true)
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toContain('Une phrase assez longue pour remplir.')
  })
})

describe('pickVoice', () => {
  const voices = [
    { name: 'US', lang: 'en-US', localService: true },
    { name: 'CA réseau', lang: 'fr-CA', localService: false },
    { name: 'FR réseau', lang: 'fr-FR', localService: false },
    { name: 'FR local', lang: 'fr_FR', localService: true },
  ]
  it('préfère la région exacte et les voix locales', () => {
    expect(pickVoice(voices, 'fr')?.name).toBe('FR local')
    expect(pickVoice(voices, 'en')?.name).toBe('US')
  })
  it('ne renvoie rien sans voix de la langue', () => {
    expect(pickVoice([{ name: 'US', lang: 'en-US' }], 'fr')).toBeUndefined()
  })
})

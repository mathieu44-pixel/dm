import { describe, expect, it } from 'vitest'
import { maskApiKey, normalizeSettings } from './settingsModel'

describe('normalizeSettings', () => {
  it('retourne les valeurs par défaut si rien n\'est stocké', () => {
    const s = normalizeSettings(undefined)
    expect(s.apiKey).toBe('')
    expect(s.storyModel).toBe('claude-opus-5-5')
    expect(s.utilityModel).toBe('claude-haiku-5-5')
  })

  it('remplace un modèle inconnu par le modèle par défaut', () => {
    // @ts-expect-error valeur volontairement invalide (ancienne donnée)
    const s = normalizeSettings({ storyModel: 'modele-disparu' })
    expect(s.storyModel).toBe('claude-opus-5-5')
  })

  it('supprime les espaces autour de la clé', () => {
    expect(normalizeSettings({ apiKey: '  sk-ant-xyz \n' }).apiKey).toBe('sk-ant-xyz')
  })
})

describe('maskApiKey', () => {
  it('masque le milieu de la clé', () => {
    expect(maskApiKey('sk-ant-api03-abcdefghijklmnop1234')).toBe('sk-ant-…1234')
  })

  it('masque entièrement une clé très courte', () => {
    expect(maskApiKey('abc')).toBe('•••')
  })

  it('renvoie une chaîne vide sans clé', () => {
    expect(maskApiKey('')).toBe('')
  })
})

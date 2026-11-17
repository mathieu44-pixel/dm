import { describe, expect, it } from 'vitest'
import { activeProvider, isReady, maskApiKey, normalizeSettings } from './settingsModel'

describe('normalizeSettings', () => {
  it('retourne les valeurs par défaut si rien n\'est stocké (Gemini actif)', () => {
    const s = normalizeSettings(undefined)
    expect(s.provider).toBe('gemini')
    expect(s.anthropic.storyModel).toBe('claude-opus-5-5')
    expect(s.anthropic.utilityModel).toBe('claude-haiku-5-5')
    expect(s.gemini).toEqual({ apiKey: '', storyModel: '', utilityModel: '' })
  })

  it('migre l\'ancien format à plat vers les réglages Anthropic', () => {
    const s = normalizeSettings({ apiKey: ' sk-ant-xyz ', storyModel: 'claude-sonnet-5-5' })
    expect(s.anthropic.apiKey).toBe('sk-ant-xyz')
    expect(s.anthropic.storyModel).toBe('claude-sonnet-5-5')
  })

  it('remplace un modèle Anthropic inconnu par le modèle par défaut', () => {
    const s = normalizeSettings({ anthropic: { storyModel: 'modele-disparu' } })
    expect(s.anthropic.storyModel).toBe('claude-opus-5-5')
  })

  it('ignore un fournisseur inconnu', () => {
    // @ts-expect-error valeur volontairement invalide
    expect(normalizeSettings({ provider: 'autre' }).provider).toBe('gemini')
  })
})

describe('activeProvider / isReady', () => {
  it('n\'est prêt qu\'avec une clé et deux modèles', () => {
    const s = normalizeSettings({ provider: 'gemini', gemini: { apiKey: 'AIza123', storyModel: 'gemini-2.5-flash' } })
    expect(isReady(s)).toBe(false)
    const ready = normalizeSettings({ ...s, gemini: { ...s.gemini, utilityModel: 'gemini-2.5-flash-lite' } })
    expect(isReady(ready)).toBe(true)
    expect(activeProvider(ready).provider).toBe('gemini')
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

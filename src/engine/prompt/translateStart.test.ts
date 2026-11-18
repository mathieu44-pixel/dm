import { describe, expect, it } from 'vitest'
import { buildStartTranslationRequest, parseStartTranslation } from './translateStart'

describe('traduction du départ', () => {
  it('demande la langue cible et lit la réponse', () => {
    const req = buildStartTranslationRequest('m', '「Bonjour」', ['Partir'], 'en')
    expect(req.messages[0].content).toContain('en anglais')
    expect(parseStartTranslation('ok {"prologue":"「Hello」","suggestions":["Leave"]}', 1)).toEqual({ prologue: '「Hello」', suggestions: ['Leave'] })
  })
  it('écarte une réponse illisible et des suggestions incomplètes', () => {
    expect(parseStartTranslation('rien', 1)).toBeNull()
    expect(parseStartTranslation('{"prologue":"Hi","suggestions":[]}', 2)).toEqual({ prologue: 'Hi', suggestions: [] })
  })
})

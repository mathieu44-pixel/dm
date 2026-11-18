import { describe, expect, it } from 'vitest'
import { buildStartTranslationRequest, parseStartTranslation } from './translateStart'

describe('traduction du départ', () => {
  it('demande la langue cible et lit la réponse balisée', () => {
    const req = buildStartTranslationRequest('m', '「Bonjour」', ['Partir'], 'en')
    expect(req.messages[0].content).toContain('en anglais')
    const text = '===PROLOGUE===\n「Hello」\n\n*He said "hi"*\n===SUGGESTIONS===\n1. Leave'
    expect(parseStartTranslation(text, 1)).toEqual({ prologue: '「Hello」\n\n*He said "hi"*', suggestions: ['Leave'] })
  })
  it('écarte une réponse sans balise et des suggestions incomplètes', () => {
    expect(parseStartTranslation('rien', 1)).toBeNull()
    expect(parseStartTranslation('```\n===PROLOGUE===\nHi\n===SUGGESTIONS===\nA\n```', 2)).toEqual({ prologue: 'Hi', suggestions: [] })
  })
})

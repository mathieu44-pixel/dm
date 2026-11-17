import { describe, expect, it } from 'vitest'
import { buildAliasRequest, parseAlias } from './alias'

describe('parseAlias', () => {
  it('lit le surnom et la raison', () => {
    expect(parseAlias('ok {"alias":"« La Dague Muette »","reason":"Elle frappe sans un mot."}')).toEqual({
      alias: 'La Dague Muette',
      reason: 'Elle frappe sans un mot.',
    })
  })
  it('renvoie null si rien d\'exploitable', () => {
    expect(parseAlias('pas de json')).toBeNull()
    expect(parseAlias('{"alias":""}')).toBeNull()
  })
})

describe('buildAliasRequest', () => {
  it('mentionne les surnoms existants et la langue', () => {
    const text = buildAliasRequest('m', 'Annaelle', [], ['La Rousse'], 'en').messages[0].content
    expect(text).toContain('La Rousse')
    expect(text).toContain('en anglais')
  })
})

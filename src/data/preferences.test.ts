import { describe, expect, it } from 'vitest'
import { isTextSize, stepTextSize, textSizeRem } from './preferences'

describe('taille du texte', () => {
  it('passe à la taille suivante ou précédente sans dépasser les bornes', () => {
    expect(stepTextSize('md', 1)).toBe('lg')
    expect(stepTextSize('xl', 1)).toBe('xl')
    expect(stepTextSize('sm', -1)).toBe('sm')
  })

  it('valide les valeurs stockées', () => {
    expect(isTextSize('lg')).toBe(true)
    expect(isTextSize('énorme')).toBe(false)
  })

  it('donne la taille en rem', () => {
    expect(textSizeRem('md')).toBe(1.05)
  })
})

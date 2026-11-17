import { describe, expect, it } from 'vitest'
import { isDelivered } from './version'

describe('isDelivered', () => {
  it('considère une étape future comme non livrée', () => {
    expect(isDelivered('0.1', '0.0.1')).toBe(false)
  })

  it('considère une étape atteinte comme livrée', () => {
    expect(isDelivered('0.1', '0.1.0')).toBe(true)
    expect(isDelivered('0.1', '0.2.3')).toBe(true)
  })

  it('compare numériquement et non alphabétiquement', () => {
    expect(isDelivered('0.10', '0.9.0')).toBe(false)
    expect(isDelivered('0.9', '0.10.0')).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { sanitizeNarration } from './sanitize'

describe('sanitizeNarration', () => {
  it('retire un paragraphe de commentaire sur les consignes', () => {
    const text = "「[Hors-jeu] J'applique la commande Flashback en anglais.」\n「You remember the damp morning.」"
    expect(sanitizeNarration(text)).toBe('「You remember the damp morning.」')
  })

  it('retire une ligne « [Commande …] » recopiée', () => {
    expect(sanitizeNarration('[Commande /Flashback : raconte]\n「Il pleut.」')).toBe('「Il pleut.」')
  })

  it("garde le contenu s'il n'y a que du hors-jeu, sans le marqueur", () => {
    expect(sanitizeNarration("「[Hors-jeu] Hello! I'm doing well.」")).toBe("「Hello! I'm doing well.」")
  })

  it('ne touche pas une réponse normale', () => {
    const text = '「La pluie tombe.」\nMaëlle | "Entre."'
    expect(sanitizeNarration(text)).toBe(text)
  })
})

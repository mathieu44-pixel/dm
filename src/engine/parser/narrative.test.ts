import { describe, expect, it } from 'vitest'
import { parseNarrative } from './narrative'

describe('parseNarrative', () => {
  it('reconnaît narration, dialogue et action', () => {
    const text = ['「La pluie bat les volets.」', 'Maëlle | "Entre, tu es trempé."', '*Je pose mon sac.*'].join('\n')
    expect(parseNarrative(text)).toEqual([
      { type: 'narration', text: 'La pluie bat les volets.' },
      { type: 'dialogue', speaker: 'Maëlle', text: 'Entre, tu es trempé.' },
      { type: 'action', text: 'Je pose mon sac.' },
    ])
  })

  it('accepte les guillemets français, typographiques et un emoji en tête', () => {
    expect(parseNarrative('👤 Frère Anselme | « Que la paix soit sur toi. »')).toEqual([
      { type: 'dialogue', speaker: 'Frère Anselme', text: 'Que la paix soit sur toi.' },
    ])
    expect(parseNarrative('Isolde | “Pas un mot.”')).toEqual([{ type: 'dialogue', speaker: 'Isolde', text: 'Pas un mot.' }])
  })

  it('regroupe une narration sur plusieurs lignes', () => {
    expect(parseNarrative('「Première ligne,\nseconde ligne.」')).toEqual([
      { type: 'narration', text: 'Première ligne,\nseconde ligne.' },
    ])
  })

  it('traite le texte après une narration fermée sur la même ligne', () => {
    expect(parseNarrative('「Silence.」 Maëlle | "Alors ?"')).toEqual([
      { type: 'narration', text: 'Silence.' },
      { type: 'dialogue', speaker: 'Maëlle', text: 'Alors ?' },
    ])
  })

  it('affiche une narration non refermée (réponse coupée)', () => {
    expect(parseNarrative('「Le vent se lève')).toEqual([{ type: 'narration', text: 'Le vent se lève' }])
  })

  it('considère le texte sans balise comme de la narration', () => {
    expect(parseNarrative('Il fait nuit.\n\nUn chien aboie.')).toEqual([
      { type: 'narration', text: 'Il fait nuit.' },
      { type: 'narration', text: 'Un chien aboie.' },
    ])
  })

  it('ne confond pas une barre verticale isolée avec un dialogue', () => {
    expect(parseNarrative('A | B')).toEqual([{ type: 'narration', text: 'A | B' }])
  })
})

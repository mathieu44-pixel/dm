import { useMemo } from 'react'
import { parseNarrative } from '../engine/parser/narrative'

/** Affiche un texte au format narratif : narration atténuée, dialogues avec le nom du personnage. */
export function NarrativeView({ text }: { text: string }) {
  const segments = useMemo(() => parseNarrative(text), [text])
  return (
    <div className="space-y-4 font-[family-name:var(--font-story)] text-[1.05rem] leading-[1.8]">
      {segments.map((segment, i) => {
        switch (segment.type) {
          case 'narration':
            return (
              <p key={i} className="whitespace-pre-line text-text/70">
                「{segment.text}」
              </p>
            )
          case 'dialogue':
            return (
              <p key={i} className="text-text">
                <span className="font-[family-name:var(--font-ui)] text-sm font-semibold text-accent">{segment.speaker}</span>
                <span className="text-muted"> | </span>« {segment.text} »
              </p>
            )
          case 'action':
            return (
              <p key={i} className="italic text-text/80">
                {segment.text}
              </p>
            )
        }
      })}
    </div>
  )
}

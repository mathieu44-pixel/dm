import { useMemo } from 'react'
import { parseNarrative } from '../engine/parser/narrative'
import { StoredImage } from './StoredImage'

/** Portrait d'un personnage : nom exact, ou premier mot du nom (« Maëlle » pour « Maëlle Vautrin »). */
export function findPortrait(speaker: string, portraits: Record<string, string>): string | undefined {
  const key = speaker.trim().toLowerCase()
  for (const [name, id] of Object.entries(portraits)) {
    const n = name.trim().toLowerCase()
    if (n === key || n.split(/\s+/)[0] === key || key.split(/\s+/)[0] === n.split(/\s+/)[0]) return id
  }
  return undefined
}

/** Affiche un texte au format narratif : narration atténuée, dialogues avec le nom du personnage. */
export function NarrativeView({ text, portraits = {} }: { text: string; portraits?: Record<string, string> }) {
  const segments = useMemo(() => parseNarrative(text), [text])
  return (
    <div className="space-y-4 font-[family-name:var(--font-story)] text-[length:var(--story-size,1.05rem)] leading-[1.8]">
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
                {findPortrait(segment.speaker, portraits) && (
                  <StoredImage
                    id={findPortrait(segment.speaker, portraits)}
                    className="mr-2 inline-block h-7 w-7 rounded-full align-middle"
                    alt=""
                  />
                )}
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

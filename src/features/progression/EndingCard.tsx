import { useState } from 'react'
import { RARITIES, type EndingDef } from '../../engine/progression/types'
import { Button } from '../../ui/Button'
import { StoredImage } from '../../ui/StoredImage'

/** Carte de fin : la carte s'affiche, on la retourne pour lire l'épilogue, ou on continue l'histoire. */
export function EndingCard({ ending, onContinue }: { ending: EndingDef; onContinue: () => void }) {
  const [flipped, setFlipped] = useState(false)
  const rarity = RARITIES.find((r) => r.id === ending.rarity) ?? RARITIES[0]

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
      <div role="dialog" aria-label={`Fin : ${ending.name}`} className="w-full max-w-sm">
        <p className="mb-3 text-center text-xs uppercase tracking-[0.3em] text-muted">Fin atteinte</p>
        <div
          className="relative overflow-hidden rounded-3xl border-2 bg-surface p-6 shadow-2xl"
          style={{ borderColor: rarity.color, boxShadow: `0 0 40px ${rarity.color}55` }}
        >
          <span
            className="absolute right-4 top-4 rounded-md px-2 py-0.5 text-xs font-bold text-ink"
            style={{ background: rarity.color }}
            title={rarity.label}
          >
            {ending.rarity}
          </span>
          {!flipped ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              {ending.imageId && <StoredImage id={ending.imageId} className="-mx-6 -mt-6 mb-5 aspect-[4/3] w-[calc(100%+3rem)]" alt="" />}
              <p className="text-xs uppercase tracking-widest" style={{ color: rarity.color }}>
                {rarity.label}
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-story)] text-3xl font-semibold">{ending.name}</h2>
              {ending.cardText && <p className="mt-4 text-sm leading-relaxed text-muted">{ending.cardText}</p>}
            </div>
          ) : (
            <div className="max-h-[55vh] min-h-64 overflow-y-auto pr-1">
              <h2 className="mb-4 font-[family-name:var(--font-story)] text-xl font-semibold">{ending.name}</h2>
              <p className="whitespace-pre-line font-[family-name:var(--font-story)] text-[length:var(--story-size,1.05rem)] leading-[1.8] text-text/85">
                {ending.epilogue || "Cette fin n'a pas d'épilogue."}
              </p>
            </div>
          )}
        </div>
        <div className="mt-5 flex gap-3">
          {!flipped && (
            <Button variant="secondary" className="flex-1" onClick={() => setFlipped(true)}>
              Voir l'épilogue
            </Button>
          )}
          <Button className="flex-1" onClick={onContinue}>
            Continuer l'histoire
          </Button>
        </div>
      </div>
    </div>
  )
}

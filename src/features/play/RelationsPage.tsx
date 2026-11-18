import { useParams } from 'react-router'
import { useSessionData } from '../../data/sessions'
import { affinityLevel } from '../../engine/relations/affinity'
import { PageHeader } from '../../ui/PageHeader'
import { StoredImage } from '../../ui/StoredImage'

/** Relations (v1.1) : affinité de 0 à 100 avec chaque personnage rencontré dans la partie. */
export default function RelationsPage() {
  const { sessionId } = useParams()
  const data = useSessionData(sessionId)
  if (data === undefined) return null
  if (data === null)
    return (
      <>
        <PageHeader title="Relations" />
        <p className="p-6 text-sm text-muted">Cette partie n'existe plus.</p>
      </>
    )

  const values = data.session.affinities ?? {}
  const met = data.characters.filter((c) => c.id in values).sort((a, b) => values[b.id] - values[a.id])
  const unmet = data.characters.length - met.length

  return (
    <>
      <PageHeader title="Relations" fallback={`/partie/${data.session.id}`} />
      <main className="space-y-3 p-5 pb-16 text-sm">
        <p className="leading-relaxed text-muted">
          Ce que chaque personnage pense de {data.session.avatar?.name || 'toi'}, de 0 (hostile) à 100 (complice). Tout
          commence à 50 à la première rencontre, puis évolue selon tes actes et tes paroles.
        </p>
        {met.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line p-4 text-center text-muted">
            Aucun personnage rencontré pour l'instant. Ils apparaîtront ici dès qu'ils entreront en scène.
          </p>
        )}
        <ul className="space-y-2">
          {met.map((c) => {
            const v = values[c.id]
            const level = affinityLevel(v)
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                <StoredImage id={c.portraitImageId} alt={c.name} className="h-14 w-14 shrink-0 rounded-xl object-[center_15%]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="shrink-0 text-xs" style={{ color: level.color }}>
                      {level.label} · {v}
                    </p>
                  </div>
                  {c.title && <p className="truncate text-xs text-muted">{c.title}</p>}
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={`Affinité avec ${c.name}`}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: level.color }} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        {unmet > 0 && met.length > 0 && (
          <p className="pt-2 text-center text-xs text-muted">
            {unmet} personnage{unmet > 1 ? 's' : ''} pas encore rencontré{unmet > 1 ? 's' : ''}.
          </p>
        )}
      </main>
    </>
  )
}

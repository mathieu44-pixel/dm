import { Link } from 'react-router'
import { useSessionSummaries } from '../../data/history'
import { PageHeader } from '../../ui/PageHeader'
import { SessionList } from '../../ui/SessionList'

/** Historique de toutes les parties. */
export default function HistoryPage() {
  const items = useSessionSummaries()
  if (!items) return null

  return (
    <>
      <PageHeader title="Mes parties" back={false} />
      <main className="px-4 py-6 pb-28">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Aucune partie pour l'instant.{' '}
            <Link to="/" className="text-accent underline">
              Choisis une histoire
            </Link>{' '}
            pour commencer.
          </p>
        ) : (
          <SessionList items={items} />
        )}
      </main>
    </>
  )
}

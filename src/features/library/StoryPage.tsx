import { Link, useNavigate, useParams } from 'react-router'
import { deleteStory, useStory } from '../../data/stories'
import { Button } from '../../ui/Button'
import { NarrativeView } from '../../ui/NarrativeView'
import { PageHeader } from '../../ui/PageHeader'
import { StoryCover } from '../../ui/StoryCover'

/** Fiche d'une histoire : présentation, personnages, aperçu du prologue. */
export default function StoryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useStory(id)

  if (data === undefined) return null
  if (data === null)
    return (
      <>
        <PageHeader title="Histoire introuvable" />
        <p className="p-6 text-sm text-muted">Cette histoire n'existe plus.</p>
      </>
    )

  const { story, characters } = data
  const start = story.startSettings[0]

  const remove = async () => {
    if (!window.confirm(`Supprimer définitivement « ${story.title} » et ses personnages ?`)) return
    await deleteStory(story.id)
    navigate('/', { replace: true })
  }

  return (
    <>
      <PageHeader title="Informations" />
      <main className="pb-32">
        <div className="px-5 pt-6">
          <StoryCover title={story.title} className="mx-auto aspect-[3/4] w-48 rounded-2xl shadow-2xl" />
          <h2 className="mt-6 text-2xl font-semibold">{story.title}</h2>
          {story.subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{story.subtitle}</p>}
          {story.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {story.tags.map((tag) => (
                <li key={tag} className="rounded-lg border border-line px-3 py-1 text-xs text-muted">
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>

        {characters.length > 0 && (
          <section className="mt-8 px-5">
            <h3 className="mb-3 text-sm font-medium text-muted">Personnages</h3>
            <ul className="space-y-2">
              {characters.map((c) => (
                <li key={c.id} className="rounded-xl border border-line bg-surface px-4 py-3">
                  <p className="text-sm font-medium">{c.name}</p>
                  {c.title && <p className="text-xs text-muted">{c.title}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {start?.prologue && (
          <section className="mt-8 border-t border-line px-5 pt-6">
            <h3 className="mb-4 text-lg font-semibold">Aperçu du prologue</h3>
            <NarrativeView text={start.prologue} />
          </section>
        )}

        <div className="mt-10 px-5">
          <Button variant="danger" onClick={remove}>
            Supprimer l'histoire
          </Button>
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 mx-auto flex max-w-xl gap-3 border-t border-line bg-ink/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <Link
          to={`/histoire/${story.id}/modifier`}
          className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm font-medium"
        >
          Modifier
        </Link>
        <button
          type="button"
          disabled
          title="Disponible dans la prochaine version"
          className="min-h-12 flex-1 rounded-xl bg-accent text-sm font-medium text-ink opacity-40"
        >
          Jouer (bientôt)
        </button>
      </footer>
    </>
  )
}

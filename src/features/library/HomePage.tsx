import { Link } from 'react-router'
import { APP_VERSION, ROADMAP, isDelivered } from '../../app/version'
import { useSettings } from '../../data/settings'
import { activeProvider, isReady } from '../../data/settingsModel'
import { useStories } from '../../data/stories'
import { PROVIDER_LABELS } from '../../engine/llm/client'
import { StoryCover } from '../../ui/StoryCover'

/** Accueil : bibliothèque d'histoires. */
export default function HomePage() {
  const settings = useSettings()
  const stories = useStories()
  const ready = settings ? isReady(settings) : false
  const active = settings ? activeProvider(settings) : undefined

  return (
    <main className="flex min-h-full flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-muted">Dungeon Mistress</p>
          <h1 className="font-[family-name:var(--font-story)] text-4xl font-semibold text-accent">DM</h1>
        </div>
        <nav className="flex gap-2">
          <Link
            to="/avatars"
            aria-label="Mes avatars"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-lg text-muted hover:text-text"
          >
            ☺
          </Link>
          <Link
            to="/reglages"
            aria-label="Réglages"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-lg text-muted hover:text-text"
          >
            ⚙
          </Link>
        </nav>
      </header>

      {settings && !ready && (
        <Link to="/reglages" className="mb-6 block rounded-2xl border border-accent/40 bg-accent-soft p-4 text-sm leading-relaxed">
          <span className="font-medium text-accent">Première étape :</span> choisis un fournisseur d'IA et ajoute ta clé API
          dans les Réglages pour pouvoir jouer. →
        </Link>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mes histoires</h2>
          <Link to="/histoire/nouvelle/modifier" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-ink">
            + Créer
          </Link>
        </div>

        {stories && stories.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Aucune histoire pour l'instant. Crée la première !
          </p>
        )}

        <ul className="grid grid-cols-2 gap-3">
          {stories?.map((story) => (
            <li key={story.id}>
              <Link to={`/histoire/${story.id}`} className="block overflow-hidden rounded-2xl border border-line bg-surface">
                <StoryCover title={story.title} className="aspect-[3/4]" />
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{story.title || 'Sans titre'}</p>
                  {story.tags.length > 0 && <p className="mt-1 truncate text-xs text-muted">{story.tags.join(' · ')}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <details className="mt-10 rounded-2xl border border-line bg-surface p-4 text-sm">
        <summary className="cursor-pointer text-muted">Feuille de route · version {APP_VERSION}</summary>
        <ol className="mt-3 space-y-2">
          {ROADMAP.map((step) => {
            const done = isDelivered(step.version)
            return (
              <li key={step.version} className="flex items-center gap-3">
                <span
                  className={
                    'w-10 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-medium ' +
                    (done ? 'bg-accent text-ink' : 'bg-surface-2 text-muted')
                  }
                >
                  v{step.version}
                </span>
                <span className={done ? 'text-text' : 'text-muted'}>{step.label}</span>
              </li>
            )
          })}
        </ol>
        {ready && active && (
          <p className="mt-3 text-xs text-muted">
            IA : {PROVIDER_LABELS[active.provider].name} · {active.storyModel}
          </p>
        )}
      </details>
    </main>
  )
}

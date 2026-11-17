import { Link } from 'react-router'
import { APP_VERSION, ROADMAP, isDelivered } from '../../app/version'
import { useSettings } from '../../data/settings'
import { MODELS } from '../../engine/llm/models'

/**
 * Accueil provisoire. Deviendra la bibliothèque d'histoires (Story | Character) en v0.1b/v0.2.
 */
export default function HomePage() {
  const settings = useSettings()
  const hasKey = !!settings?.apiKey

  return (
    <main className="flex min-h-full flex-col px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Dungeon Mistress</p>
          <h1 className="mt-2 font-[family-name:var(--font-story)] text-6xl font-semibold text-accent">DM</h1>
        </div>
        <Link
          to="/reglages"
          aria-label="Réglages"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-xl text-muted hover:text-text"
        >
          ⚙
        </Link>
      </header>

      <p className="mb-8 font-[family-name:var(--font-story)] text-lg leading-relaxed text-text/90">
        「La table est dressée, les chandelles allumées. Il ne manque plus que l'histoire.」
      </p>

      {settings && !hasKey && (
        <Link
          to="/reglages"
          className="mb-6 block rounded-2xl border border-accent/40 bg-accent-soft p-4 text-sm leading-relaxed"
        >
          <span className="font-medium text-accent">Première étape :</span> ajoute ta clé API Anthropic dans les
          Réglages pour pouvoir jouer. →
        </Link>
      )}

      {settings && hasKey && (
        <div className="mb-6 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
          Clé API enregistrée · Rédaction : <span className="text-text">{MODELS[settings.storyModel].label}</span>
        </div>
      )}

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-medium text-muted">Feuille de route</h2>
        <ol className="space-y-3">
          {ROADMAP.map((step) => {
            const done = isDelivered(step.version)
            return (
              <li key={step.version} className="flex items-center gap-3 text-sm">
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
      </section>

      <footer className="mt-auto pt-10 text-center text-xs text-muted">Version {APP_VERSION}</footer>
    </main>
  )
}

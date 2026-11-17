import { APP_VERSION, ROADMAP, isDelivered } from './version'

/**
 * Écran provisoire (étape 0) : confirme que l'application est en ligne et installable.
 * Il sera remplacé par la bibliothèque d'histoires à partir de la v0.1.
 */
export default function App() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-6 pb-10 pt-[max(3rem,env(safe-area-inset-top))]">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">Dungeon Mistress</p>
        <h1 className="mt-2 font-[family-name:var(--font-story)] text-6xl font-semibold text-accent">DM</h1>
        <p className="mt-4 font-[family-name:var(--font-story)] text-lg leading-relaxed text-text/90">
          「La table est dressée, les chandelles allumées. Il ne manque plus que l'histoire.」
        </p>
      </header>

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

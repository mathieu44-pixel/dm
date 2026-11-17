import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { importCharacterFile } from '../../data/importCard'
import type { StoryMode } from '../../data/types'
import { APP_VERSION, ROADMAP, isDelivered } from '../../app/version'
import { useSettings } from '../../data/settings'
import { activeProvider, isReady } from '../../data/settingsModel'
import { useStories } from '../../data/stories'
import { PROVIDER_LABELS } from '../../engine/llm/client'
import { StoryCover } from '../../ui/StoryCover'

/** Accueil : bibliothèque d'histoires. */
export default function HomePage() {
  const settings = useSettings()
  const allStories = useStories()
  const navigate = useNavigate()
  const [mode, setMode] = useState<StoryMode>(() => (sessionStorage.getItem('dm-home-mode') === 'character' ? 'character' : 'story'))
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const stories = allStories?.filter((s) => (s.mode ?? 'story') === mode)
  const switchMode = (m: StoryMode) => {
    setMode(m)
    sessionStorage.setItem('dm-home-mode', m)
  }
  const importFile = async (file: File) => {
    setImporting(true)
    setImportError(null)
    try {
      const id = await importCharacterFile(file)
      navigate(`/histoire/${id}`)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e))
    } finally {
      setImporting(false)
    }
  }
  const ready = settings ? isReady(settings) : false
  const active = settings ? activeProvider(settings) : undefined

  return (
    <main className="flex min-h-full flex-col px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-muted">Dungeon Mistress</p>
          <h1 className="font-[family-name:var(--font-story)] text-4xl font-semibold text-accent">DM</h1>
        </div>
      </header>

      {settings && !ready && (
        <Link to="/reglages" className="mb-6 block rounded-2xl border border-accent/40 bg-accent-soft p-4 text-sm leading-relaxed">
          <span className="font-medium text-accent">Première étape :</span> choisis un fournisseur d'IA et ajoute ta clé API
          dans les Réglages pour pouvoir jouer. →
        </Link>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="flex gap-5" role="tablist">
            {(
              [
                ['story', 'Histoires'],
                ['character', 'Personnages'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={'text-2xl font-semibold transition ' + (mode === m ? 'text-text' : 'text-muted/50')}
              >
                {label}
              </button>
            ))}
          </div>
          <Link
            to={`/histoire/nouvelle/modifier?mode=${mode}`}
            className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-ink"
          >
            + Créer
          </Link>
        </div>

        <Link
          to={`/creer?mode=${mode}`}
          className="mb-4 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm"
        >
          <span className="text-xl text-accent">✦</span>
          <span>
            <span className="font-medium text-accent">Créer avec l'IA</span>
            <span className="block text-xs text-muted">
              {mode === 'story' ? 'Une idée en une phrase, une histoire complète à modifier.' : 'Décris un personnage, l\'IA le développe.'}
            </span>
          </span>
        </Link>

        {mode === 'character' && (
          <div className="mb-4">
            <button
              type="button"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted disabled:opacity-50"
            >
              {importing ? 'Import…' : '⇪ Importer une carte SillyTavern (.png ou .json)'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,application/json,.json,.png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void importFile(file)
              }}
            />
            {importError && <p className="mt-2 text-xs text-red-300">{importError}</p>}
          </div>
        )}

        {stories && stories.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            {mode === 'story'
              ? "Aucune histoire pour l'instant. Crée la première !"
              : 'Aucun personnage : crée-en un, ou importe une carte SillyTavern, pour une conversation libre.'}
          </p>
        )}

        <ul className="grid grid-cols-2 gap-3">
          {stories?.map((story) => (
            <li key={story.id}>
              <Link to={`/histoire/${story.id}`} className="block overflow-hidden rounded-2xl border border-line bg-surface">
                <StoryCover title={story.title} imageId={story.coverImageId} className="aspect-[3/4]" />
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

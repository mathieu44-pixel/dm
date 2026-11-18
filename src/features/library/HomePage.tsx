import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { downloadBackup, snoozeBackupReminder, useBackupReminder } from '../../data/backup'
import { importCharacterFile, importCharacterFromUrl } from '../../data/importCard'
import { CARD_SITES, splitLinks } from '../../engine/import/cardUrl'
import { daysSince } from '../../engine/session/backupReminder'
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
  const backupReminder = useBackupReminder()
  const [backupDone, setBackupDone] = useState<string | null>(null)
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

      {backupReminder?.show && (
        <div className="mb-6 rounded-2xl border border-accent/40 bg-accent-soft p-4 text-sm leading-relaxed">
          <p>
            <span className="font-medium text-accent">Pense à sauvegarder.</span>{' '}
            {backupReminder.lastBackupAt
              ? `Dernière sauvegarde il y a ${daysSince(backupReminder.lastBackupAt)} jours.`
              : "Tu n'as encore jamais sauvegardé."}{' '}
            Tout est stocké sur ce téléphone uniquement.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={async () => setBackupDone(`Sauvegarde téléchargée : ${await downloadBackup()}.`)}
              className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-ink"
            >
              Sauvegarder maintenant
            </button>
            <button type="button" onClick={() => void snoozeBackupReminder()} className="px-3 py-2 text-xs text-muted">
              Plus tard
            </button>
          </div>
        </div>
      )}
      {backupDone && <p className="mb-6 text-xs text-muted">{backupDone}</p>}

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
        <Link to="/importer" className="mb-4 -mt-2 block text-center text-xs text-muted underline-offset-2 hover:underline">
          📚 Importer un univers depuis un wiki (test)
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
            <LinkImport onSingle={(id) => navigate(`/histoire/${id}`)} />
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

/** Import de cartes par lien (un lien par ligne). */
function LinkImport({ onSingle }: { onSingle: (storyId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<{ link: string; ok: boolean; message: string }[]>([])

  const run = async () => {
    const links = splitLinks(text)
    if (!links.length) {
      setResults([{ link: '', ok: false, message: 'Colle au moins un lien commençant par https://' }])
      return
    }
    setBusy(true)
    setResults([])
    const done: { link: string; ok: boolean; message: string; id?: string }[] = []
    for (const link of links) {
      try {
        const id = await importCharacterFromUrl(link)
        done.push({ link, ok: true, message: 'Importé', id })
      } catch (e) {
        done.push({ link, ok: false, message: e instanceof Error ? e.message : String(e) })
      }
      setResults([...done])
    }
    setBusy(false)
    if (done.length === 1 && done[0].ok && done[0].id) onSingle(done[0].id)
    else if (done.every((d) => d.ok)) setText('')
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 w-full rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
        🔗 Importer depuis un lien
      </button>
    )
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-line p-3">
      <p className="text-xs leading-relaxed text-muted">
        Colle le lien d'une carte (un par ligne). Sites pris en charge : {Object.values(CARD_SITES).join(', ')}.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        disabled={busy}
        placeholder="https://chub.ai/characters/auteur/personnage"
        className="w-full rounded-xl border border-line bg-surface p-3 text-sm outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <button type="button" disabled={busy || !text.trim()} onClick={() => void run()} className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-ink disabled:opacity-40">
          {busy ? 'Import…' : 'Importer'}
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="px-3 py-2 text-xs text-muted">
          Fermer
        </button>
      </div>
      {results.length > 0 && (
        <ul className="space-y-1 text-xs">
          {results.map((r, i) => (
            <li key={i} className={r.ok ? 'text-emerald-300' : 'text-red-300'}>
              {r.ok ? '✓' : '✗'} {r.link && <span className="break-all text-muted">{r.link} — </span>}
              {r.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

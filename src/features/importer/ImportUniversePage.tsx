import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useSettings } from '../../data/settings'
import { isReady } from '../../data/settingsModel'
import { importUniverse, readWikiIndex, type ImportProgress, type WikiIndex } from '../../data/wikiImport'
import { UNIVERSE_LIMITS } from '../../engine/import/universe'
import { normalizeQuery } from '../../engine/session/search'
import { LANGUAGES, type Language } from '../../engine/session/options'
import { Button } from '../../ui/Button'
import { PageHeader } from '../../ui/PageHeader'

const EXAMPLES = ['https://umamusu.wiki/List_of_Characters', 'https://umamusume.fandom.com/wiki/Umamusume_Wiki']

/**
 * Importer un univers depuis un wiki (v1.1) : on lit une page (liste de personnages, page de l'univers),
 * on coche les articles liés à importer, et l'IA construit l'histoire. L'introduction reste au joueur.
 */
export default function ImportUniversePage() {
  const settings = useSettings()
  const navigate = useNavigate()
  const [link, setLink] = useState('')
  const [index, setIndex] = useState<WikiIndex | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [idea, setIdea] = useState('')
  const [introduction, setIntroduction] = useState('')
  const [language, setLanguage] = useState<Language>('fr')
  const [withProgression, setWithProgression] = useState(true)
  const [useIndexText, setUseIndexText] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ items: ImportProgress[]; phase: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const ready = settings ? isReady(settings) : false
  const visible = useMemo(() => {
    if (!index) return []
    const q = normalizeQuery(filter)
    return q ? index.links.filter((l) => normalizeQuery(l).includes(q)) : index.links
  }, [index, filter])

  const read = async (target = link) => {
    if (!target.trim()) return
    setLink(target)
    setBusy(true)
    setError(null)
    setIndex(null)
    setSelected([])
    try {
      setIndex(await readWikiIndex(target))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (title: string) =>
    setSelected((s) => (s.includes(title) ? s.filter((t) => t !== title) : s.length < UNIVERSE_LIMITS.pages ? [...s, title] : s))

  const run = async () => {
    if (!settings || !index || !selected.length) return
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setError(null)
    try {
      const id = await importUniverse(
        settings,
        { index, titles: selected, idea, introduction, language, withProgression, useIndexText },
        (items, phase) => setProgress({ items, phase }),
        controller.signal,
      )
      navigate(`/histoire/${id}/modifier?cree=1`, { replace: true })
    } catch (e) {
      setError(controller.signal.aborted ? 'Import annulé.' : e instanceof Error ? e.message : String(e))
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Importer un univers" />
      <main className="flex flex-col gap-5 p-5 pb-16 text-sm">
        <p className="leading-relaxed text-muted">
          Colle le lien d'une page de wiki (une liste de personnages, la page d'un univers…). Tu choisis ensuite les pages à
          importer : l'IA en fait des personnages et des fiches de lorebook, puis écrit l'histoire. Fonctionne avec les wikis
          MediaWiki (umamusu.wiki, Fandom…). Pour un usage personnel.
        </p>

        {/* 1. Lien */}
        <div className="space-y-2">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={busy}
            placeholder="https://umamusu.wiki/List_of_Characters"
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent"
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} type="button" disabled={busy} onClick={() => void read(e)} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted">
                {new URL(e).hostname}
              </button>
            ))}
          </div>
          <Button variant={index ? 'secondary' : undefined} onClick={() => void read()} disabled={busy || !link.trim()}>
            {busy && !index ? 'Lecture…' : 'Lire la page'}
          </Button>
        </div>

        {error && <p className="rounded-xl border border-red-400/40 p-3 text-red-300">{error}</p>}

        {/* 2. Choix des pages */}
        {index && !progress && (
          <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <h2 className="font-semibold">
              « {index.title} » — {index.links.length} pages liées
            </h2>
            <p className="text-xs text-muted">
              Coche les personnages, lieux et notions à importer ({selected.length}/{UNIVERSE_LIMITS.pages}). Chaque page coûte un
              appel à l'IA.
            </p>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrer : Oguri, Tracen…"
              className="min-h-10 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none focus:border-accent"
            />
            <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {visible.map((title) => (
                <li key={title}>
                  <label className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                    <input type="checkbox" checked={selected.includes(title)} onChange={() => toggle(title)} className="h-4 w-4 accent-[var(--color-accent)]" />
                    <span className="truncate">{title}</span>
                  </label>
                </li>
              ))}
              {!visible.length && <li className="px-2 text-xs text-muted">Aucune page ne correspond.</li>}
            </ul>
            {selected.length > 0 && <p className="text-xs text-accent">Choisies : {selected.join(', ')}</p>}
          </section>
        )}

        {/* 3. Options */}
        {index && !progress && (
          <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
            <label className="block space-y-1">
              <span className="font-medium">Ton histoire (facultatif)</span>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={3}
                placeholder="Je suis Oguri Cap, j'arrive à Tracen pour devenir le Grey Monster…"
                className="w-full rounded-xl border border-line bg-surface-2 p-3 outline-none focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-medium">Introduction (facultatif)</span>
              <textarea
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                rows={4}
                placeholder="Colle ou écris ton introduction ; l'IA la met seulement en forme. Vide : l'IA en écrit une."
                className="w-full rounded-xl border border-line bg-surface-2 p-3 outline-none focus:border-accent"
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <span>Langue</span>
              <span className="flex gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLanguage(l.id)}
                    className={'rounded-lg border px-3 py-1 ' + (language === l.id ? 'border-accent text-accent' : 'border-line text-muted')}
                  >
                    {l.flag} {l.label}
                  </button>
                ))}
              </span>
            </div>
            <label className="flex items-center justify-between gap-3">
              <span>
                Utiliser le texte de « {index.title} »
                <span className="block text-xs text-muted">Comme description de l'univers ({index.text.length.toLocaleString('fr-FR')} caractères).</span>
              </span>
              <input type="checkbox" checked={useIndexText} onChange={(e) => setUseIndexText(e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Jauges et fins</span>
              <input type="checkbox" checked={withProgression} onChange={(e) => setWithProgression(e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
            </label>
            {!ready && settings && <p className="text-red-300">Ajoute d'abord ta clé API dans les Réglages.</p>}
            <Button className="w-full" onClick={() => void run()} disabled={busy || !ready || !selected.length}>
              ✦ Importer {selected.length} page{selected.length > 1 ? 's' : ''}
            </Button>
          </section>
        )}

        {/* 4. Progression */}
        {progress && (
          <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <p className={'font-medium ' + (busy ? 'animate-pulse text-accent' : '')}>{busy ? progress.phase + '…' : 'Import interrompu'}</p>
            <ul className="space-y-1 text-xs">
              {progress.items.map((it) => (
                <li key={it.title} className={it.status === 'error' ? 'text-red-300' : it.status === 'done' ? 'text-emerald-300' : 'text-muted'}>
                  {it.status === 'done' ? '✓' : it.status === 'error' ? '✗' : it.status === 'reading' ? '…' : '·'} {it.title}
                  {it.detail && <span className="text-muted"> — {it.detail}</span>}
                </li>
              ))}
            </ul>
            {busy ? (
              <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
                Annuler
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setProgress(null)}>
                Revenir au choix des pages
              </Button>
            )}
          </section>
        )}

        <p className="text-xs leading-relaxed text-muted">
          Les portraits sont liés depuis le wiki : ils s'affichent avec une connexion internet et ne sont pas inclus dans la
          sauvegarde (seulement leur adresse). Tu peux les remplacer par tes propres images dans l'éditeur.
        </p>
      </main>
    </>
  )
}

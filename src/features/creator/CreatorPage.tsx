import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { recordCost } from '../../data/costs'
import { draftToStory } from '../../data/creator'
import { useSettings } from '../../data/settings'
import { activeProvider, isReady } from '../../data/settingsModel'
import { saveStory } from '../../data/stories'
import { createProvider } from '../../engine/llm/client'
import { describeLlmError } from '../../engine/llm/errors'
import { formatUsd } from '../../engine/llm/models'
import { buildCreationRequest, CREATION_LIMITS, DraftParseError, parseStoryDraft, type DraftMode } from '../../engine/creator/storyDraft'
import { LANGUAGES, type Language } from '../../engine/session/options'
import { Button } from '../../ui/Button'
import { PageHeader } from '../../ui/PageHeader'

const IDEAS: Record<DraftMode, string[]> = {
  story: [
    'Un huis clos dans un manoir hanté, une nuit d’orage',
    'Une académie de magie où deux maisons rivales se livrent une guerre secrète',
    'Une enquête dans un port pirate où le gouverneur vient d’être assassiné',
    'Une station spatiale en panne, et un passager clandestin qui ment',
  ],
  character: [
    'Une vieille cartographe bourrue qui tient une boutique de cartes impossibles',
    'Un chevalier déchu devenu aubergiste, qui cache une dette envers un dragon',
    'Une IA de vaisseau, sarcastique, qui s’ennuie depuis trois siècles',
  ],
}

/** Assistant de création (v0.8) : une idée → une histoire complète, prête à modifier. */
export default function CreatorPage() {
  const settings = useSettings()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<DraftMode>(params.get('mode') === 'character' ? 'character' : 'story')
  const [idea, setIdea] = useState('')
  const [language, setLanguage] = useState<Language>('fr')
  const [withProgression, setWithProgression] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const ready = settings ? isReady(settings) : false

  const generate = async () => {
    if (!settings || !idea.trim()) return
    const active = activeProvider(settings)
    const options = { idea, mode, language, withProgression }
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setError(null)
    try {
      const result = await createProvider(active.provider, active.apiKey).complete({
        ...buildCreationRequest(active.storyModel, options),
        signal: controller.signal,
      })
      await recordCost(null, 'creation', result)
      const { story, characters } = draftToStory(parseStoryDraft(result.text, options), options)
      await saveStory(story, characters)
      if (result.costUsd > 0) sessionStorage.setItem('dm-creation-cost', formatUsd(result.costUsd))
      navigate(`/histoire/${story.id}/modifier?cree=1`, { replace: true })
    } catch (e) {
      if (controller.signal.aborted) setError('Génération annulée.')
      else setError(e instanceof DraftParseError ? e.message : describeLlmError(e))
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Créer avec l'IA" />
      <main className="flex flex-col gap-5 p-5 pb-16">
        <div className="flex gap-2" role="tablist">
          {(
            [
              ['story', 'Histoire'],
              ['character', 'Personnage'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              disabled={busy}
              onClick={() => setMode(m)}
              className={
                'flex-1 rounded-xl border px-3 py-2 text-sm transition ' +
                (mode === m ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted')
              }
            >
              {label}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Ton idée</span>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={CREATION_LIMITS.idea}
            rows={4}
            disabled={busy}
            placeholder={mode === 'story' ? 'Une phrase suffit : un lieu, une situation, un enjeu…' : 'Qui est ce personnage ? Son caractère, son métier, son secret…'}
            className="rounded-xl border border-line bg-surface p-3 text-base leading-relaxed outline-none focus:border-accent"
          />
          <span className="text-xs text-muted">Plus tu donnes de détails (ton, époque, personnages), plus le résultat te ressemblera.</span>
        </label>

        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted">Pour t'inspirer</p>
          <div className="flex flex-wrap gap-2">
            {IDEAS[mode].map((example) => (
              <button
                key={example}
                type="button"
                disabled={busy}
                onClick={() => setIdea(example)}
                className="rounded-full border border-line px-3 py-1.5 text-left text-xs text-muted hover:text-text"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-line p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Langue du contenu</span>
            <div className="flex gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setLanguage(l.id)}
                  className={'rounded-lg border px-3 py-1 text-sm ' + (language === l.id ? 'border-accent text-accent' : 'border-line text-muted')}
                >
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
          </div>
          {mode === 'story' && (
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Jauges et fins
                <span className="block text-xs text-muted">Des statistiques qui évoluent et plusieurs fins à débloquer.</span>
              </span>
              <input
                type="checkbox"
                checked={withProgression}
                disabled={busy}
                onChange={(e) => setWithProgression(e.target.checked)}
                className="h-5 w-5 accent-[var(--color-accent)]"
              />
            </label>
          )}
        </div>

        {!ready && settings && <p className="text-sm text-red-300">Ajoute d'abord ta clé API dans les Réglages.</p>}
        {error && <p className="rounded-xl border border-red-400/40 p-3 text-sm text-red-300">{error}</p>}

        {busy ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="animate-pulse text-sm text-accent">L'IA écrit ton {mode === 'story' ? 'histoire' : 'personnage'}… (jusqu'à une minute)</p>
            <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
              Annuler
            </Button>
          </div>
        ) : (
          <Button onClick={generate} disabled={!ready || !idea.trim()}>
            ✦ Générer
          </Button>
        )}
        <p className="text-center text-xs text-muted">
          Utilise ton modèle d'écriture. Tout reste modifiable ensuite dans l'éditeur.
        </p>
      </main>
    </>
  )
}

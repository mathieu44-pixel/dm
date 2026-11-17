import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useSessionSummaries } from '../../data/history'
import { createSession, useSessionsForStory } from '../../data/sessions'
import { deleteStory, useAvatars, useDefaultAvatarId, useStory } from '../../data/stories'
import type { Story } from '../../data/types'
import { LANGUAGES, type Language } from '../../engine/session/options'
import { Button } from '../../ui/Button'
import { NarrativeView } from '../../ui/NarrativeView'
import { PageHeader } from '../../ui/PageHeader'
import { SessionList } from '../../ui/SessionList'
import { StoryCover } from '../../ui/StoryCover'
import { RARITIES } from '../../engine/progression/types'

/** Fiche d'une histoire : présentation, personnages, aperçu du prologue. */
export default function StoryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useStory(id)
  const sessions = useSessionsForStory(id)
  const summaries = useSessionSummaries(id)
  const [starting, setStarting] = useState(false)

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
          <StoryCover title={story.title} imageId={story.coverImageId} className="mx-auto aspect-[3/4] w-48 rounded-2xl shadow-2xl" />
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

        {(() => {
          const endings = story.startSettings.flatMap((s) => s.endings ?? [])
          if (!endings.length) return null
          const found = new Set((summaries ?? []).flatMap((x) => (x.session.endingsReached ?? []).map((r) => r.endingId)))
          return (
            <section className="mt-8 px-5">
              <h3 className="mb-3 text-sm font-medium text-muted">
                Fins découvertes ({endings.filter((e) => found.has(e.id)).length}/{endings.length})
              </h3>
              <ul className="grid grid-cols-2 gap-2">
                {endings.map((e) => {
                  const rarity = RARITIES.find((r) => r.id === e.rarity)
                  const known = found.has(e.id)
                  return (
                    <li key={e.id} className="rounded-xl border bg-surface px-3 py-2" style={{ borderColor: known ? rarity?.color : undefined }}>
                      <span className="text-[0.65rem] font-bold" style={{ color: rarity?.color }}>
                        {e.rarity}
                      </span>
                      <p className={'text-sm ' + (known ? '' : 'text-muted')}>{known ? e.name : '???'}</p>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })()}

        {summaries && summaries.length > 0 && (
          <section className="mt-8 px-5">
            <h3 className="mb-3 text-sm font-medium text-muted">Mes parties ({summaries.length})</h3>
            <SessionList items={summaries} showStoryTitle={false} />
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
        {sessions && sessions.length > 0 ? (
          <>
            <button
              type="button"
              onClick={() => setStarting(true)}
              className="min-h-12 flex-1 rounded-xl border border-line bg-surface-2 text-sm font-medium"
            >
              Nouvelle partie
            </button>
            <Link
              to={`/partie/${sessions[0].id}`}
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-accent text-sm font-medium text-ink"
            >
              Continuer
            </Link>
          </>
        ) : (
          <button type="button" onClick={() => setStarting(true)} className="min-h-12 flex-1 rounded-xl bg-accent text-sm font-medium text-ink">
            {story.mode === 'character' ? 'Discuter' : 'Jouer'}
          </button>
        )}
      </footer>

      {starting && <StartSheet story={story} onClose={() => setStarting(false)} />}
    </>
  )
}

/** Lancement d'une partie : choix de l'avatar (et du point de départ s'il y en a plusieurs). */
function StartSheet({ story, onClose }: { story: Story; onClose: () => void }) {
  const navigate = useNavigate()
  const avatars = useAvatars()
  const defaultId = useDefaultAvatarId()
  const [avatarId, setAvatarId] = useState<string | null | undefined>(undefined)
  const [startId, setStartId] = useState(story.startSettings[0]?.id)
  const [language, setLanguage] = useState<Language>(story.defaultLanguage ?? 'fr')
  const chosenAvatar = avatarId === undefined ? (defaultId ?? null) : avatarId

  const start = async () => {
    const avatar = avatars?.find((a) => a.id === chosenAvatar) ?? null
    const sessionId = await createSession(story, startId, avatar, language)
    navigate(`/partie/${sessionId}`)
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Nouvelle partie"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-line" />
        <h2 className="text-lg font-semibold">{story.mode === 'character' ? 'Nouvelle conversation' : 'Nouvelle partie'}</h2>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Qui incarnes-tu ?</legend>
          {avatars?.map((a) => (
            <label
              key={a.id}
              className={
                'flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ' +
                (chosenAvatar === a.id ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2')
              }
            >
              <input type="radio" name="avatar" checked={chosenAvatar === a.id} onChange={() => setAvatarId(a.id)} className="mt-1" />
              <span>
                <span className="font-medium">{a.name}</span>
                {a.details && <span className="line-clamp-2 block text-xs text-muted">{a.details}</span>}
              </span>
            </label>
          ))}
          <label
            className={
              'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ' +
              (chosenAvatar === null ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2')
            }
          >
            <input type="radio" name="avatar" checked={chosenAvatar === null} onChange={() => setAvatarId(null)} />
            <span>Sans avatar (personnage anonyme)</span>
          </label>
          <Link to="/avatars" className="block text-xs text-accent underline">
            Créer ou modifier mes avatars
          </Link>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Langue de jeu</legend>
          <div className="flex gap-1 rounded-xl border border-line p-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLanguage(l.id)}
                className={'flex-1 rounded-lg px-2 py-2 text-sm ' + (language === l.id ? 'bg-accent text-ink' : 'text-muted')}
              >
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </fieldset>

        {story.startSettings.length > 1 && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{story.mode === 'character' ? "Message d'accueil" : 'Point de départ'}</legend>
            {story.startSettings.map((s) => (
              <label key={s.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
                <input type="radio" name="start" checked={startId === s.id} onChange={() => setStartId(s.id)} />
                {s.name}
              </label>
            ))}
          </fieldset>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button className="flex-1" onClick={start}>
            Commencer
          </Button>
        </div>
      </div>
    </div>
  )
}

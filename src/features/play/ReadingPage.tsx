import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useSessionData } from '../../data/sessions'
import { RARITIES } from '../../engine/progression/types'
import { getThread, toEntries } from '../../engine/session/thread'
import { fileSlug, threadToText } from '../../engine/session/transcript'
import { activeContent } from '../../engine/session/types'
import { Button } from '../../ui/Button'
import { NarrativeView } from '../../ui/NarrativeView'
import { PageHeader } from '../../ui/PageHeader'
import { StoredImage } from '../../ui/StoredImage'
import { ImageViewer } from './GamePage'

/** Mode relecture (v0.9) : la branche affichée de la partie, comme un livre, sans boutons de jeu. */
export default function ReadingPage() {
  const { sessionId } = useParams()
  const data = useSessionData(sessionId)
  const [showActions, setShowActions] = useState(true)
  const [viewing, setViewing] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const thread = useMemo(() => (data ? getThread(data.messages, data.session.activeLeafId) : []), [data])
  if (data === undefined) return null
  if (data === null)
    return (
      <>
        <PageHeader title="Relecture" />
        <p className="p-6 text-sm text-muted">Cette partie n'existe plus.</p>
      </>
    )

  const { session, story } = data
  const playerName = session.avatar?.name || 'Toi'
  const showImages = session.showImages !== false
  const portraits = Object.fromEntries(data.characters.filter((c) => c.portraitImageId).map((c) => [c.name, c.portraitImageId as string]))
  const start = story.startSettings.find((s) => s.id === session.startSettingId) ?? story.startSettings[0]
  const reached = (session.endingsReached ?? []).flatMap((r) => {
    const e = start?.endings?.find((x) => x.id === r.endingId)
    return e ? [{ ...e, turn: r.turn }] : []
  })

  const text = () => threadToText(toEntries(thread), { title: session.title || story.title, playerName })
  const download = () => {
    const url = URL.createObjectURL(new Blob([text()], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileSlug(session.title || story.title)}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text())
      setNotice('Texte copié.')
    } catch {
      setNotice("Copie impossible sur cet appareil : utilise l'export .txt.")
    }
  }

  return (
    <>
      <PageHeader title="Relecture" />
      <main className="mx-auto max-w-2xl px-5 pb-20 pt-8">
        <header className="mb-10 text-center">
          {session.title && session.title !== story.title && (
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-muted">{story.title}</p>
          )}
          <h1 className="mt-2 font-[family-name:var(--font-story)] text-3xl font-semibold text-accent">{session.title || story.title}</h1>
          <p className="mt-2 text-xs text-muted">
            {playerName} · {session.turn} tour{session.turn > 1 ? 's' : ''}
          </p>
        </header>

        <div className="space-y-8">
          {thread.map((message, index) => {
            if (message.ooc) return null
            const content = activeContent(message)
            if (message.role === 'user')
              return showActions ? (
                <p key={message.id} className="border-l-2 border-accent/40 pl-3 text-sm italic text-muted">
                  {playerName} — {content}
                </p>
              ) : null
            const image = showImages ? message.variants[message.activeVariant]?.imageId : undefined
            return (
              <section key={message.id}>
                {index > 0 && !showActions && <p className="mb-8 text-center text-muted">⁂</p>}
                {image && (
                  <button type="button" onClick={() => setViewing(image)} className="mb-5 block w-full overflow-hidden rounded-2xl" aria-label="Agrandir l'image">
                    <StoredImage id={image} className="aspect-[4/3] w-full object-[center_20%]" />
                  </button>
                )}
                <NarrativeView text={content} portraits={portraits} />
              </section>
            )
          })}
        </div>

        {reached.length > 0 && (
          <section className="mt-12 space-y-3 border-t border-line pt-8">
            <h2 className="text-center text-sm uppercase tracking-widest text-muted">Fins atteintes</h2>
            {reached.map((e) => (
              <div key={e.id} className="rounded-2xl border border-line bg-surface p-4 text-center">
                <p className="text-xs" style={{ color: RARITIES.find((r) => r.id === e.rarity)?.color }}>
                  {RARITIES.find((r) => r.id === e.rarity)?.label} · tour {e.turn}
                </p>
                <p className="mt-1 font-[family-name:var(--font-story)] text-lg">{e.name}</p>
                {e.epilogue && <p className="mt-2 whitespace-pre-line text-left font-[family-name:var(--font-story)] text-sm text-text/70">{e.epilogue}</p>}
              </div>
            ))}
          </section>
        )}

        <section className="mt-12 space-y-3 border-t border-line pt-8">
          <label className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm">
            <span>Afficher mes actions</span>
            <input type="checkbox" checked={showActions} onChange={(e) => setShowActions(e.target.checked)} className="h-5 w-5 accent-[var(--color-accent)]" />
          </label>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={download}>
              Exporter en .txt
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => void copy()}>
              Copier le texte
            </Button>
          </div>
          {notice && <p className="text-center text-xs text-muted">{notice}</p>}
          <p className="text-center text-xs text-muted">Seule la branche affichée est relue ; les échanges /OOC sont omis.</p>
        </section>
      </main>
      {viewing && <ImageViewer id={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

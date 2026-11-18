import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { setSpeechPrefs, setTextSize, stepTextSize, TEXT_SIZES, useSpeechPrefs, useTextSize } from '../../data/preferences'
import { deleteSession, patchSession } from '../../data/sessions'
import { useSettings } from '../../data/settings'
import { activeProvider } from '../../data/settingsModel'
import { formatUsd } from '../../engine/llm/models'
import { activeContent, type Message } from '../../engine/session/types'
import { Button } from '../../ui/Button'
import { IconBook, IconContinue, IconEdit, IconSearch } from '../../ui/icons'
import { useSpeech } from '../../ui/useSpeech'
import { useBack } from '../../ui/useBack'
import { SPEECH_RATES } from '../../engine/speech/speech'
import { CostDetails } from '../../ui/CostDetails'
import { scrollToMatch } from '../../ui/scrollToMatch'
import { toEntries } from '../../engine/session/thread'
import { BUILTIN_COMMANDS } from '../../engine/session/commands'
import { NarrativeView } from '../../ui/NarrativeView'
import { StoredImage } from '../../ui/StoredImage'
import { EndingCard } from '../progression/EndingCard'
import { StatsBar } from '../progression/StatsBar'
import { useGame } from './useGame'
import { UserBubble, OocText, AiActions } from './parts/MessageParts'
import { Sheet, SearchSheet, Row, SessionOptions } from './parts/GameSheets'
import { ImageViewer } from './parts/ImageViewer'

/** Écran de jeu. */
export default function GamePage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const game = useGame(sessionId)
  const textSize = useTextSize()
  const settings = useSettings()
  const { data, thread, streaming, busy } = game

  const [input, setInput] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [commandsOpen, setCommandsOpen] = useState(false)
  const [editing, setEditing] = useState<{ message: Message; text: string } | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [costsOpen, setCostsOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const goBack = useBack(data?.session ? `/histoire/${data.session.storyId}` : '/')
  const speechPrefs = useSpeechPrefs()
  const speech = useSpeech(data?.session.language === 'en' ? 'en' : 'fr', speechPrefs.rate)

  // Lecture automatique de chaque nouvelle réponse, une fois écrite.
  const wasBusy = useRef(busy)
  useEffect(() => {
    const finished = wasBusy.current && !busy
    wasBusy.current = busy
    if (!finished || !speechPrefs.auto) return
    const last = thread[thread.length - 1]
    if (last?.role === 'ai' && !last.ooc) void speech.speak(last.id, activeContent(last))
  }, [busy, thread, speechPrefs.auto, speech])

  // Suit le texte au fil de l'écriture.
  const streamLength = streaming?.text.length ?? 0
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streamLength ? 'auto' : 'smooth', block: 'end' })
  }, [thread.length, streamLength, game.error])

  if (data === undefined) return null
  if (data === null)
    return (
      <main className="p-6 text-sm text-muted">
        Partie introuvable. <Link to="/" className="text-accent underline">Retour à l'accueil</Link>
      </main>
    )

  const { session } = data
  const showImages = session.showImages !== false
  const portraits = Object.fromEntries(
    data.characters.filter((c) => c.portraitImageId).map((c) => [c.name, c.portraitImageId as string]),
  )
  const lastMessage = thread[thread.length - 1]
  const lastIsUser = lastMessage?.role === 'user'

  const submit = async (text = input) => {
    if (!text.trim() || busy) return
    setInput('')
    setCommandsOpen(false)
    speech.stop()
    await game.send(text)
  }

  const insertAction = () => {
    const el = inputRef.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end } = el
    const selected = input.slice(start, end)
    const next = `${input.slice(0, start)}*${selected}*${input.slice(end)}`
    setInput(next)
    requestAnimationFrame(() => {
      el.focus()
      const cursor = selected ? end + 2 : start + 1
      el.setSelectionRange(cursor, cursor)
    })
  }

  const removeSession = async () => {
    if (!window.confirm('Supprimer définitivement cette partie ?')) return
    await deleteSession(session.id)
    navigate(`/histoire/${session.storyId}`, { replace: true })
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* En-tête */}
      <div className="sticky top-0 z-10 bg-ink/95 backdrop-blur">
      <header className="flex items-center gap-2 border-b border-line px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Retour"
          onClick={goBack}
          className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-muted"
        >
          ‹
        </button>
        <h1 className="min-w-0 flex-1 truncate font-semibold">{data.story.title}</h1>
        <button
          type="button"
          aria-label="Rechercher dans la partie"
          onClick={() => setSearchOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted"
        >
          <IconSearch />
        </button>
        <button
          type="button"
          aria-label="Menu de la partie"
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-muted"
        >
          ☰
        </button>
      </header>
      <StatsBar defs={game.statDefs} values={game.statValues} />
      </div>

      {!game.ready && (
        <Link to="/reglages" className="m-4 rounded-xl border border-accent/40 bg-accent-soft p-3 text-sm">
          Configure un fournisseur d'IA dans les Réglages pour jouer. →
        </Link>
      )}

      {/* Fil de l'histoire */}
      <main className="flex-1 space-y-6 px-5 pb-4 pt-6">
        {thread.map((message, index) => {
          const isLast = index === thread.length - 1
          const streamingHere = streaming && streaming.mode !== 'reply' && streaming.messageId === message.id ? streaming : null
          const content = activeContent(message)

          if (message.role === 'user')
            return (
              <div key={message.id} id={`msg-${message.id}`}>
              <UserBubble
                message={message}
                canEdit={!busy}
                isLast={isLast}
                branch={game.branchInfo(message)}
                onBranch={() => game.branchFrom(message)}
                onSwitchBranch={(d) => game.switchBranch(message, d)}
                onEdit={() => setEditing({ message, text: content })}
                onDelete={() => {
                  if (window.confirm('Supprimer ce message et toute la suite ?')) void game.deleteMessage(message)
                }}
              />
              </div>
            )

          const shown =
            streamingHere?.mode === 'regenerate'
              ? streamingHere.text
              : streamingHere?.mode === 'continue'
                ? `${content}\n${streamingHere.text}`
                : content

          const sceneImage = showImages && !streamingHere ? message.variants[message.activeVariant]?.imageId : undefined
          return (
            <article key={message.id} id={`msg-${message.id}`}>
              {sceneImage && (
                <button type="button" onClick={() => setViewing(sceneImage)} className="-mx-5 mb-5 block w-[calc(100%+2.5rem)]" aria-label="Agrandir l'image">
                  <StoredImage id={sceneImage} className="aspect-[4/3] w-full object-[center_20%]" />
                </button>
              )}
              {message.ooc ? (
                <OocText text={shown} />
              ) : (
                <NarrativeView text={shown || '「…」'} portraits={{ ...portraits, ...message.variants[message.activeVariant]?.expressions }} />
              )}
              {!busy && message.variants[message.activeVariant]?.truncated && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-sm">
                  <span>Réponse coupée avant la fin.</span>
                  <button type="button" onClick={() => void game.continueMessage(message)} className="flex shrink-0 items-center gap-1 font-medium text-accent">
                    <IconContinue /> Continuer
                  </button>
                </div>
              )}
              {!busy && (
                <AiActions
                  message={message}
                  isLast={isLast}
                  branch={game.branchInfo(message)}
                  onBranch={() => game.branchFrom(message)}
                  onSwitchBranch={(d) => game.switchBranch(message, d)}
                  onRegenerate={() => game.regenerate(message)}
                  onContinue={() => game.continueMessage(message)}
                  onEdit={() => setEditing({ message, text: content })}
                  onDelete={() => {
                    if (window.confirm('Supprimer cette réponse et toute la suite ?')) void game.deleteMessage(message)
                  }}
                  onVariant={(i) => game.selectVariant(message.id, i)}
                  speaking={speech.supported ? speech.speakingId === message.id : undefined}
                  onSpeak={() => (speech.speakingId === message.id ? speech.stop() : void speech.speak(message.id, content))}
                />
              )}
            </article>
          )
        })}

        {streaming?.mode === 'reply' && (
          <article aria-live="polite">
            {lastMessage?.ooc ? (
              <OocText text={streaming.text || '…'} />
            ) : (
              <NarrativeView text={streaming.text || '「…」'} portraits={portraits} />
            )}
          </article>
        )}

        {game.error && (
          <div role="alert" className="rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200">
            <p>✗ {game.error.message}</p>
            <div className="mt-3 flex gap-2">
              {game.error.retry && <Button onClick={game.error.retry}>Réessayer</Button>}
              <Button variant="ghost" onClick={game.dismissError}>
                Fermer
              </Button>
            </div>
          </div>
        )}

        {/* La narratrice n'a pas répondu (erreur passée, application fermée…) */}
        {!busy && !game.error && lastIsUser && lastMessage && (
          <Button variant="secondary" onClick={() => game.editMessage(lastMessage, activeContent(lastMessage))}>
            Obtenir la réponse de la narratrice
          </Button>
        )}

        {!busy && !lastIsUser && (session.suggestions.length > 0 || game.suggesting) && (
          <section className="space-y-2">
            {game.suggesting && session.suggestions.length === 0 && <p className="text-xs text-muted">Suggestions en cours…</p>}
            {session.suggestions.map((s, i) => (
              <div key={i} className="flex items-stretch gap-2 rounded-xl border border-line bg-surface">
                <button
                  type="button"
                  aria-label="Modifier cette suggestion"
                  onClick={() => {
                    setInput(s)
                    inputRef.current?.focus()
                  }}
                  className="px-3 text-muted"
                >
                  <IconEdit />
                </button>
                <p className="flex-1 py-3 font-[family-name:var(--font-story)] text-sm leading-relaxed text-text/80">{s}</p>
                <button
                  type="button"
                  aria-label="Envoyer cette suggestion"
                  disabled={!game.ready}
                  onClick={() => submit(s)}
                  className="px-4 text-lg text-muted disabled:opacity-30"
                >
                  ↑
                </button>
              </div>
            ))}
          </section>
        )}
        <div ref={bottomRef} />
      </main>

      {/* Saisie */}
      <footer className="sticky bottom-0 border-t border-line bg-ink/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {commandsOpen && (
          <div className="mb-2 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-2 text-sm">
            {[...BUILTIN_COMMANDS, ...(data.story.commands ?? [])].map((c) => (
              <button
                key={c.name}
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2"
                onClick={() => {
                  setCommandsOpen(false)
                  if (c.name === 'GrantAlias') {
                    void submit('/GrantAlias')
                    return
                  }
                  setInput(`/${c.name} `)
                  inputRef.current?.focus()
                }}
              >
                <span className="font-mono text-accent">/{c.name}</span>
                {c.description && <span className="block text-xs text-muted">{c.description}</span>}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Que fais-tu ?"
            rows={Math.min(5, Math.max(1, input.split('\n').length))}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-[0.95rem] outline-none placeholder:text-muted"
          />
          <button type="button" aria-label="Écrire une action" onClick={insertAction} className="h-11 w-11 rounded-full border border-line text-lg text-muted">
            *
          </button>
          <button
            type="button"
            aria-label="Commandes"
            onClick={() => setCommandsOpen((v) => !v)}
            className="h-11 w-11 rounded-full border border-line text-lg text-muted"
          >
            /
          </button>
          {busy ? (
            <button type="button" aria-label="Arrêter" onClick={game.stop} className="h-11 w-11 rounded-xl bg-text text-ink">
              ■
            </button>
          ) : (
            <button
              type="button"
              aria-label="Envoyer"
              disabled={!input.trim() || !game.ready}
              onClick={() => submit()}
              className="h-11 w-11 rounded-xl bg-accent text-ink disabled:opacity-30"
            >
              ▶
            </button>
          )}
        </div>
      </footer>

      {/* Fin atteinte */}
      {session.pendingEndingId &&
        (() => {
          const ending = game.endings.find((e) => e.id === session.pendingEndingId)
          return ending ? <EndingCard ending={ending} onContinue={() => void game.dismissEnding()} /> : null
        })()}

      {/* Menu de la partie */}
      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} title="Partie en cours">
          <dl className="space-y-2 text-sm">
            <Row label="Avatar" value={session.avatar?.name ?? 'Aucun'} />
            <Row label="Tours joués" value={String(session.turn)} />
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Coût estimé</dt>
              <dd>
                <button type="button" onClick={() => setCostsOpen((v) => !v)} className="text-accent underline-offset-2 hover:underline">
                  {formatUsd(session.costUsd)} {costsOpen ? '▴' : '▾'}
                </button>
              </dd>
            </div>
            {costsOpen && (
              <div className="rounded-xl bg-surface-2 p-3">
                <CostDetails breakdown={session.costs} knownTotalUsd={session.costUsd} />
              </div>
            )}
            {settings && <Row label="Modèle" value={activeProvider(settings).storyModel} />}
            {(session.aliases?.length ?? 0) > 0 && <Row label="Surnoms" value={session.aliases!.join(', ')} />}
            {game.endings.length > 0 && (
              <Row label="Fins atteintes" value={`${session.endingsReached?.length ?? 0}/${game.endings.length}`} />
            )}
          </dl>
          <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-2 text-sm">
            <span className="text-muted">Taille du texte</span>
            <span className="flex items-center gap-2">
              <button type="button" aria-label="Réduire le texte" onClick={() => setTextSize(stepTextSize(textSize, -1))} className="h-10 w-10 rounded-full border border-line text-sm">
                A−
              </button>
              <span className="w-20 text-center text-xs">{TEXT_SIZES.find((t) => t.id === textSize)?.label}</span>
              <button type="button" aria-label="Agrandir le texte" onClick={() => setTextSize(stepTextSize(textSize, 1))} className="h-10 w-10 rounded-full border border-line text-lg">
                A+
              </button>
            </span>
          </div>
          {speech.supported && (
            <div className="space-y-3 rounded-xl bg-surface-2 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>
                  <span className="text-muted">Lecture à voix haute automatique</span>
                  <span className="block text-xs text-muted">Sinon, bouton 🔊 sous chaque réponse.</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={speechPrefs.auto}
                  onClick={() => void setSpeechPrefs({ auto: !speechPrefs.auto })}
                  className={'relative h-7 w-12 shrink-0 rounded-full transition ' + (speechPrefs.auto ? 'bg-accent' : 'bg-line')}
                >
                  <span className={'absolute top-1 h-5 w-5 rounded-full bg-ink transition-all ' + (speechPrefs.auto ? 'left-6' : 'left-1')} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Vitesse</span>
                <span className="flex gap-1">
                  {SPEECH_RATES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => void setSpeechPrefs({ rate: r.id })}
                      className={'rounded-lg border px-2.5 py-1 text-xs ' + (speechPrefs.rate === r.id ? 'border-accent text-accent' : 'border-line text-muted')}
                    >
                      {r.label}
                    </button>
                  ))}
                </span>
              </div>
            </div>
          )}
          <SessionOptions session={session} />
          <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm">
            <span className="text-muted">Images de scène</span>
            <button
              type="button"
              role="switch"
              aria-checked={showImages}
              onClick={() => patchSession(session.id, { showImages: !showImages })}
              className={'relative h-7 w-12 rounded-full transition ' + (showImages ? 'bg-accent' : 'bg-line')}
            >
              <span className={'absolute top-1 h-5 w-5 rounded-full bg-ink transition-all ' + (showImages ? 'left-6' : 'left-1')} />
            </button>
          </div>
          <Link
            to={`/partie/${session.id}/lecture`}
            className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm"
          >
            <span className="flex items-center gap-3">
              <IconBook />
              <span>
                Mode relecture
                <span className="block text-xs text-muted">Relire la partie comme un livre, l'exporter en texte</span>
              </span>
            </span>
            <span className="text-muted">›</span>
          </Link>
          {data.characters.length > 0 && (
            <Link
              to={`/partie/${session.id}/relations`}
              className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm"
            >
              <span>
                Relations
                <span className="block text-xs text-muted">
                  Affinité avec {Object.keys(session.affinities ?? {}).length} personnage(s) rencontré(s)
                </span>
              </span>
              <span className="text-muted">›</span>
            </Link>
          )}
          <Link
            to={`/partie/${session.id}/galerie`}
            className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm"
          >
            <span>
              Galerie
              <span className="block text-xs text-muted">{session.unlockedImageIds?.length ?? 0} image(s) débloquée(s)</span>
            </span>
            <span className="text-muted">›</span>
          </Link>
          <Link
            to={`/partie/${session.id}/memoire`}
            className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm"
          >
            <span>
              Mémoire et notes
              <span className="block text-xs text-muted">Notes de partie, souvenirs, mémoire automatique, résumé</span>
            </span>
            <span className="text-muted">›</span>
          </Link>
          <div className="space-y-2 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">
            <p className="font-medium text-text">Guide</p>
            <p>• Écris tes paroles normalement et tes actions entre *astérisques* (bouton *).</p>
            <p>• Bouton / : commandes (/OOC pour parler à l'IA hors de l'histoire, /GrantAlias pour un surnom, et celles de l'histoire).</p>
            <p>• Bouton branche sous un message passé : repartir de là sans perdre la suite ; flèches ‹ › dorées pour passer d'une branche à l'autre.</p>
            <p>• Sous chaque réponse : régénérer (flèche circulaire), continuer (double chevron), modifier (crayon), supprimer (corbeille), et flèches ‹ › pour changer de version.</p>
          </div>
          <Button variant="danger" className="w-full" onClick={removeSession}>
            Supprimer cette partie
          </Button>
        </Sheet>
      )}

      {searchOpen && (
        <SearchSheet
          entries={toEntries(thread)}
          playerName={session.avatar?.name || 'Toi'}
          onClose={() => setSearchOpen(false)}
          onPick={(id, query) => {
            setSearchOpen(false)
            requestAnimationFrame(() => {
              const el = document.getElementById(`msg-${id}`)
              if (el) scrollToMatch(el, query)
            })
          }}
        />
      )}

      {viewing && <ImageViewer id={viewing} onClose={() => setViewing(null)} />}

      {/* Modification d'un message */}
      {editing && (
        <Sheet onClose={() => setEditing(null)} title={editing.message.role === 'user' ? 'Modifier ton message' : 'Modifier la réponse'}>
          {editing.message.role === 'user' && (
            <p className="text-xs text-muted">La suite de l'histoire sera effacée et la narratrice répondra à nouveau.</p>
          )}
          <textarea
            value={editing.text}
            onChange={(e) => setEditing({ ...editing, text: e.target.value })}
            rows={10}
            className="w-full rounded-xl border border-line bg-surface-2 p-3 text-sm leading-relaxed outline-none focus:border-accent"
          />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button
              className="flex-1"
              disabled={!editing.text.trim()}
              onClick={() => {
                const { message, text } = editing
                setEditing(null)
                void game.editMessage(message, text)
              }}
            >
              Enregistrer
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

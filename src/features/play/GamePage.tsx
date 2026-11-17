import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { setTextSize, stepTextSize, TEXT_SIZES, useTextSize } from '../../data/preferences'
import { deleteSession, patchSession } from '../../data/sessions'
import { useSettings } from '../../data/settings'
import { activeProvider } from '../../data/settingsModel'
import { formatUsd } from '../../engine/llm/models'
import { activeContent, type Message, type Session } from '../../engine/session/types'
import { Button } from '../../ui/Button'
import { IconBook, IconBranch, IconContinue, IconEdit, IconNext, IconPrev, IconRegenerate, IconSearch, IconTrash } from '../../ui/icons'
import { CostDetails } from '../../ui/CostDetails'
import { searchEntries } from '../../engine/session/search'
import { toEntries } from '../../engine/session/thread'
import { BUILTIN_COMMANDS } from '../../engine/session/commands'
import { LANGUAGES, LENGTHS, STYLES, lengthOption } from '../../engine/session/options'
import { NarrativeView } from '../../ui/NarrativeView'
import { StoredImage } from '../../ui/StoredImage'
import { EndingCard } from '../progression/EndingCard'
import { StatsBar } from '../progression/StatsBar'
import { useGame } from './useGame'

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
          onClick={() => navigate(`/histoire/${session.storyId}`)}
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
              {message.ooc ? <OocText text={shown} /> : <NarrativeView text={shown || '「…」'} portraits={portraits} />}
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
          onPick={(id) => {
            setSearchOpen(false)
            requestAnimationFrame(() => {
              const el = document.getElementById(`msg-${id}`)
              if (!el) return
              el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              el.classList.remove('search-flash')
              void el.offsetWidth
              el.classList.add('search-flash')
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

function UserBubble({
  message,
  canEdit,
  isLast,
  branch,
  onBranch,
  onSwitchBranch,
  onEdit,
  onDelete,
}: {
  message: Message
  canEdit: boolean
  isLast: boolean
  branch: { index: number; count: number }
  onBranch: () => void
  onSwitchBranch: (direction: -1 | 1) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const content = activeContent(message)
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[90%] rounded-2xl rounded-br-md border border-line bg-surface-2 px-4 py-3 text-[0.95rem] leading-relaxed">
        {message.ooc && !content.startsWith('/') && <span className="mb-1 block font-mono text-xs text-accent">/OOC</span>}
        <FormattedPlayerText text={content} />
      </div>
      {canEdit && (
        <div className="mt-1 flex items-center gap-1 text-muted">
          <BranchSwitcher branch={branch} onSwitch={onSwitchBranch} />
          {!isLast && (
            <IconButton label="Repartir d'ici (nouvelle branche)" onClick={onBranch}>
              <IconBranch />
            </IconButton>
          )}
          <IconButton label="Modifier" onClick={onEdit}>
            <IconEdit />
          </IconButton>
          <IconButton label="Supprimer" onClick={onDelete}>
            <IconTrash />
          </IconButton>
        </div>
      )}
    </div>
  )
}

/** Texte du joueur : les passages *entre astérisques* (actions) en italique. */
function FormattedPlayerText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g)
  return (
    <p className="whitespace-pre-line">
      {parts.map((part, i) =>
        /^\*[^*]+\*$/.test(part) ? (
          <em key={i} className="text-text/75">
            {part.slice(1, -1)}
          </em>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  )
}

function OocText({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-3 text-sm leading-relaxed text-muted">
      <span className="mb-1 block font-mono text-xs text-accent">Hors-jeu</span>
      <p className="whitespace-pre-line">{text}</p>
    </div>
  )
}

function AiActions({
  message,
  isLast,
  branch,
  onBranch,
  onSwitchBranch,
  onRegenerate,
  onContinue,
  onEdit,
  onDelete,
  onVariant,
}: {
  message: Message
  isLast: boolean
  branch: { index: number; count: number }
  onBranch: () => void
  onSwitchBranch: (direction: -1 | 1) => void
  onRegenerate: () => void
  onContinue: () => void
  onEdit: () => void
  onDelete: () => void
  onVariant: (index: number) => void
}) {
  const isPrologue = message.parentId === null
  const count = message.variants.length
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-muted">
      <BranchSwitcher branch={branch} onSwitch={onSwitchBranch} />
      {count > 1 && (
        <span className="mr-1 flex items-center rounded-full border border-line text-xs">
          <IconButton label="Version précédente" onClick={() => onVariant(message.activeVariant - 1)} disabled={message.activeVariant === 0}>
            <IconPrev />
          </IconButton>
          <span>
            {message.activeVariant + 1}/{count}
          </span>
          <IconButton label="Version suivante" onClick={() => onVariant(message.activeVariant + 1)} disabled={message.activeVariant === count - 1}>
            <IconNext />
          </IconButton>
        </span>
      )}
      {!isPrologue && (
        <IconButton label="Régénérer" onClick={onRegenerate}>
          <IconRegenerate />
        </IconButton>
      )}
      {!isLast && (
        <IconButton label="Repartir d'ici (nouvelle branche)" onClick={onBranch}>
          <IconBranch />
        </IconButton>
      )}
      {isLast && !message.ooc && (
        <IconButton label="Continuer" onClick={onContinue}>
          <IconContinue />
        </IconButton>
      )}
      <IconButton label="Modifier" onClick={onEdit}>
        <IconEdit />
      </IconButton>
      {!isPrologue && (
        <IconButton label="Supprimer" onClick={onDelete}>
          <IconTrash />
        </IconButton>
      )}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-base hover:text-text disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-line" />
        <h2 className="text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** Recherche dans le fil affiché (v0.9). */
function SearchSheet({
  entries,
  playerName,
  onClose,
  onPick,
}: {
  entries: ReturnType<typeof toEntries>
  playerName: string
  onClose: () => void
  onPick: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const hits = searchEntries(entries, query)
  const occurrences = hits.reduce((n, h) => n + h.count, 0)
  return (
    <Sheet title="Rechercher dans la partie" onClose={onClose}>
      <input
        autoFocus
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Un nom, un lieu, un objet…"
        className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base outline-none focus:border-accent"
      />
      {query.trim().length >= 2 && (
        <p className="text-xs text-muted">
          {hits.length
            ? `${occurrences} occurrence${occurrences > 1 ? 's' : ''} dans ${hits.length} message${hits.length > 1 ? 's' : ''}`
            : 'Aucun résultat dans cette branche de la partie.'}
        </p>
      )}
      <ul className="space-y-2">
        {hits.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => onPick(h.id)}
              className="w-full rounded-xl border border-line bg-surface-2 p-3 text-left text-sm leading-relaxed"
            >
              <span className="mb-1 block text-xs text-muted">
                {h.index === 0 ? 'Prologue' : h.role === 'user' ? playerName : 'Narratrice'}
                {h.count > 1 ? ` · ${h.count} fois` : ''}
              </span>
              {h.before}
              <mark className="rounded bg-accent-soft px-0.5 text-accent">{h.match}</mark>
              {h.after}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/** Image en plein écran. */
export function ImageViewer({ id, onClose }: { id: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/95" onClick={onClose} role="dialog" aria-label="Image">
      <StoredImage id={id} className="max-h-full max-w-full object-contain" />
      <button type="button" aria-label="Fermer" className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] h-11 w-11 rounded-full bg-black/60 text-xl text-white">
        ✕
      </button>
    </div>
  )
}

/** Navigation entre branches (« Branche 2/3 ‹ › »), visible seulement s'il en existe plusieurs. */
function BranchSwitcher({ branch, onSwitch }: { branch: { index: number; count: number }; onSwitch: (direction: -1 | 1) => void }) {
  if (branch.count < 2) return null
  return (
    <span className="mr-1 flex items-center rounded-full border border-accent/50 text-xs text-accent" title="Branches">
      <IconButton label="Branche précédente" onClick={() => onSwitch(-1)} disabled={branch.index <= 0}>
        <IconPrev />
      </IconButton>
      <span className="flex items-center gap-1">
        <IconBranch />
        {branch.index + 1}/{branch.count}
      </span>
      <IconButton label="Branche suivante" onClick={() => onSwitch(1)} disabled={branch.index >= branch.count - 1}>
        <IconNext />
      </IconButton>
    </span>
  )
}

/** Réglages de la partie : longueur, style d'écriture, langue (comme « Length & Depth » et « Writing Style » d'OOC). */
function SessionOptions({ session }: { session: Session }) {
  const length = lengthOption(session.length).id
  const style = session.writingStyle ?? 'story'
  const language = session.language ?? 'fr'
  const [custom, setCustom] = useState(session.customStyle ?? '')
  const segment = (active: boolean) =>
    'flex-1 rounded-lg px-2 py-2 text-xs transition ' + (active ? 'bg-accent text-ink' : 'text-muted')

  return (
    <div className="space-y-3 rounded-xl bg-surface-2 p-4 text-sm">
      <div>
        <p className="mb-2 text-muted">Longueur des réponses</p>
        <div className="flex gap-1 rounded-xl border border-line p-1">
          {LENGTHS.map((l) => (
            <button key={l.id} type="button" className={segment(length === l.id)} onClick={() => patchSession(session.id, { length: l.id })}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="mb-2 block text-muted">Style d'écriture</span>
        <select
          value={style}
          onChange={(e) => patchSession(session.id, { writingStyle: e.target.value })}
          className="min-h-11 w-full rounded-xl border border-line bg-ink px-3 text-sm outline-none focus:border-accent"
        >
          {STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {style === 'custom' && (
        <textarea
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={() => patchSession(session.id, { customStyle: custom.trim() })}
          rows={3}
          placeholder="Décris le style voulu : ton, rythme, vocabulaire…"
          className="w-full rounded-xl border border-line bg-ink p-3 text-sm outline-none focus:border-accent"
        />
      )}
      <div>
        <p className="mb-2 text-muted">Langue de jeu</p>
        <div className="flex gap-1 rounded-xl border border-line p-1">
          {LANGUAGES.map((l) => (
            <button key={l.id} type="button" className={segment(language === l.id)} onClick={() => patchSession(session.id, { language: l.id })}>
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

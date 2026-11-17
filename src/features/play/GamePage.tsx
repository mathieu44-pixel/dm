import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { deleteSession } from '../../data/sessions'
import { formatUsd } from '../../engine/llm/models'
import { activeContent, type Message } from '../../engine/session/types'
import { Button } from '../../ui/Button'
import { IconContinue, IconEdit, IconNext, IconPrev, IconRegenerate, IconTrash } from '../../ui/icons'
import { NarrativeView } from '../../ui/NarrativeView'
import { useGame } from './useGame'

/** Écran de jeu. */
export default function GamePage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const game = useGame(sessionId)
  const { data, thread, streaming, busy } = game

  const [input, setInput] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [commandsOpen, setCommandsOpen] = useState(false)
  const [editing, setEditing] = useState<{ message: Message; text: string } | null>(null)
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
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-ink/95 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
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
          aria-label="Menu de la partie"
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-muted"
        >
          ☰
        </button>
      </header>

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
              <UserBubble
                key={message.id}
                message={message}
                canEdit={!busy}
                onEdit={() => setEditing({ message, text: content })}
                onDelete={() => {
                  if (window.confirm('Supprimer ce message et toute la suite ?')) void game.deleteMessage(message)
                }}
              />
            )

          const shown =
            streamingHere?.mode === 'regenerate'
              ? streamingHere.text
              : streamingHere?.mode === 'continue'
                ? `${content}\n${streamingHere.text}`
                : content

          return (
            <article key={message.id}>
              {message.ooc ? <OocText text={shown} /> : <NarrativeView text={shown || '「…」'} />}
              {!busy && (
                <AiActions
                  message={message}
                  isLast={isLast}
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
            {lastMessage?.ooc ? <OocText text={streaming.text || '…'} /> : <NarrativeView text={streaming.text || '「…」'} />}
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
                  ✎
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
          <div className="mb-2 rounded-xl border border-line bg-surface p-2 text-sm">
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2"
              onClick={() => {
                setInput('/OOC ')
                setCommandsOpen(false)
                inputRef.current?.focus()
              }}
            >
              <span className="font-mono text-accent">/OOC</span>
              <span className="block text-xs text-muted">Parler à l'IA hors de l'histoire : corriger, demander un résumé, orienter la suite…</span>
            </button>
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

      {/* Menu de la partie */}
      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)} title="Partie en cours">
          <dl className="space-y-2 text-sm">
            <Row label="Avatar" value={session.avatar?.name ?? 'Aucun'} />
            <Row label="Tours joués" value={String(session.turn)} />
            <Row label="Coût estimé" value={formatUsd(session.costUsd)} />
          </dl>
          <div className="space-y-2 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">
            <p className="font-medium text-text">Guide</p>
            <p>• Écris tes paroles normalement et tes actions entre *astérisques* (bouton *).</p>
            <p>• /OOC + message pour parler à l'IA hors de l'histoire.</p>
            <p>• Sous chaque réponse : régénérer (flèche circulaire), continuer (double chevron), modifier (crayon), supprimer (corbeille), et flèches ‹ › pour changer de version.</p>
          </div>
          <Button variant="danger" className="w-full" onClick={removeSession}>
            Supprimer cette partie
          </Button>
        </Sheet>
      )}

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
  onEdit,
  onDelete,
}: {
  message: Message
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const content = activeContent(message)
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[90%] rounded-2xl rounded-br-md border border-line bg-surface-2 px-4 py-3 text-[0.95rem] leading-relaxed">
        {message.ooc && <span className="mb-1 block font-mono text-xs text-accent">/OOC</span>}
        <FormattedPlayerText text={content} />
      </div>
      {canEdit && (
        <div className="mt-1 flex gap-1 text-muted">
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
  onRegenerate,
  onContinue,
  onEdit,
  onDelete,
  onVariant,
}: {
  message: Message
  isLast: boolean
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
      {isLast && (
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

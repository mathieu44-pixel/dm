import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { addMemory, deleteMemory, updateMemory, useMemories } from '../../data/memories'
import { patchSession, useSessionData } from '../../data/sessions'
import { MEMORY_LABELS, MEMORY_LIMITS, type MemoryEntry, type MemoryKind } from '../../engine/memory/types'
import { Button } from '../../ui/Button'
import { TextArea } from '../../ui/Field'
import { IconEdit, IconTrash } from '../../ui/icons'
import { PageHeader } from '../../ui/PageHeader'

/** Mémoire d'une partie : notes du joueur, souvenirs, mémoire automatique, résumé. */
export default function MemoryPage() {
  const { sessionId } = useParams()
  const data = useSessionData(sessionId)
  const memories = useMemories(sessionId)

  if (!data || !memories) return null
  const { session } = data
  const longTerm = memories.filter((m) => m.kind === 'long')
  const auto = memories.filter((m) => m.kind !== 'long')

  return (
    <>
      <PageHeader title="Mémoire et notes" />
      <main className="space-y-6 px-4 py-6 pb-16">
        <NotesPanel key={session.id} sessionId={session.id} initial={session.userNotes ?? ''} />

        <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Souvenirs</h2>
            <span className="text-xs text-muted">
              {longTerm.length}/{MEMORY_LIMITS.long}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Ce que la narratrice ne doit jamais oublier. Ajoute-les toi-même ou épingle un élément de la mémoire automatique.
          </p>
          <MemoryList items={longTerm} />
          <AddMemory sessionId={session.id} disabled={longTerm.length >= MEMORY_LIMITS.long} />
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Mémoire automatique</h2>
            <span className="text-xs text-muted">
              {auto.length}/{MEMORY_LIMITS.auto}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Tenue à jour par l'IA après chaque tour : relations, objectifs en cours, faits importants. Au-delà de la limite, les
            faits les plus anciens sont oubliés.
          </p>
          {auto.length === 0 ? (
            <p className="text-sm text-muted">Rien pour l'instant : joue quelques tours.</p>
          ) : (
            (['relation', 'goal', 'fact'] as MemoryKind[]).map((kind) => {
              const items = auto.filter((m) => m.kind === kind)
              if (!items.length) return null
              return (
                <div key={kind}>
                  <h3 className="mb-2 mt-3 text-xs uppercase tracking-wider text-accent">{MEMORY_LABELS[kind]}s</h3>
                  <MemoryList items={items} canPin={longTerm.length < MEMORY_LIMITS.long} />
                </div>
              )
            })
          )}
        </section>

        <SummaryPanel
          key={session.summary?.updatedAt ?? 0}
          text={session.summary?.text ?? ''}
          onSave={(text) =>
            patchSession(session.id, {
              summary: session.summary ? { ...session.summary, text, updatedAt: Date.now() } : undefined,
            })
          }
        />
      </main>
    </>
  )
}

function NotesPanel({ sessionId, initial }: { sessionId: string; initial: string }) {
  const [text, setText] = useState(initial)
  const [saved, setSaved] = useState(true)
  useEffect(() => setSaved(text === initial), [text, initial])

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">Notes de la partie</h2>
      <TextArea
        label="Ce que l'IA doit savoir pendant cette partie"
        value={text}
        onChange={setText}
        maxLength={MEMORY_LIMITS.sessionNotes}
        rows={6}
        hint="Rang, pouvoirs, relations, règles maison… Ces notes sont prioritaires sur tout le reste."
      />
      <Button
        disabled={saved || text.length > MEMORY_LIMITS.sessionNotes}
        onClick={async () => {
          await patchSession(sessionId, { userNotes: text.trim() })
          setSaved(true)
        }}
      >
        {saved ? 'Enregistré' : 'Enregistrer les notes'}
      </Button>
    </section>
  )
}

function MemoryList({ items, canPin = false }: { items: MemoryEntry[]; canPin?: boolean }) {
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  if (!items.length) return null
  return (
    <ul className="space-y-2">
      {items.map((m) => (
        <li key={m.id} className="rounded-xl border border-line bg-surface-2 px-3 py-2">
          {editing?.id === m.id ? (
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault()
                if (editing.text.trim()) await updateMemory(m.id, { text: editing.text })
                setEditing(null)
              }}
            >
              <textarea
                autoFocus
                value={editing.text}
                maxLength={MEMORY_LIMITS.entryText}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-line bg-ink p-2 text-sm outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <Button type="submit">OK</Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Annuler
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-start gap-2">
              <p className="flex-1 py-1 text-sm leading-relaxed">{m.text}</p>
              <div className="flex shrink-0 text-muted">
                {canPin && (
                  <button
                    type="button"
                    title="Épingler dans les souvenirs"
                    aria-label="Épingler dans les souvenirs"
                    onClick={() => updateMemory(m.id, { kind: 'long' })}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm hover:text-accent"
                  >
                    📌
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Modifier"
                  onClick={() => setEditing({ id: m.id, text: m.text })}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:text-text"
                >
                  <IconEdit />
                </button>
                <button
                  type="button"
                  aria-label="Supprimer"
                  onClick={() => deleteMemory(m.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:text-text"
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function AddMemory({ sessionId, disabled }: { sessionId: string; disabled: boolean }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault()
        try {
          await addMemory(sessionId, 'long', text)
          setText('')
          setError(null)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }}
    >
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MEMORY_LIMITS.entryText}
          disabled={disabled}
          placeholder={disabled ? 'Limite atteinte' : 'Nouveau souvenir…'}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
        />
        <Button type="submit" disabled={disabled || !text.trim()}>
          Ajouter
        </Button>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </form>
  )
}

function SummaryPanel({ text, onSave }: { text: string; onSave: (text: string) => Promise<void> }) {
  const [draft, setDraft] = useState(text)
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">Résumé de l'histoire</h2>
      {text ? (
        <>
          <p className="text-xs leading-relaxed text-muted">
            Les échanges anciens sont résumés automatiquement quand la partie devient longue. Tu peux corriger ce résumé.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            className="w-full rounded-xl border border-line bg-surface-2 p-3 text-sm leading-relaxed outline-none focus:border-accent"
          />
          <Button disabled={draft.trim() === text || !draft.trim()} onClick={() => onSave(draft.trim())}>
            Enregistrer le résumé
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted">Pas encore de résumé : il se crée automatiquement quand la partie s'allonge.</p>
      )}
    </section>
  )
}

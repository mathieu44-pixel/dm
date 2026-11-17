import { useState } from 'react'
import { Link } from 'react-router'
import { formatRelativeDate, type SessionSummary } from '../data/history'
import { deleteSession, patchSession } from '../data/sessions'
import { IconBook, IconEdit, IconTrash } from './icons'

/** Liste de parties : reprendre, renommer, supprimer. */
export function SessionList({ items, showStoryTitle = true }: { items: SessionSummary[]; showStoryTitle?: boolean }) {
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null)

  return (
    <ul className="space-y-3">
      {items.map(({ session, storyTitle, excerpt }) => (
        <li key={session.id} className="rounded-2xl border border-line bg-surface">
          {renaming?.id === session.id ? (
            <form
              className="flex gap-2 p-3"
              onSubmit={async (e) => {
                e.preventDefault()
                await patchSession(session.id, { title: renaming.title.trim() || storyTitle })
                setRenaming(null)
              }}
            >
              <input
                autoFocus
                value={renaming.title}
                onChange={(e) => setRenaming({ ...renaming, title: e.target.value })}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none focus:border-accent"
              />
              <button type="submit" className="rounded-xl bg-accent px-4 text-sm font-medium text-ink">
                OK
              </button>
            </form>
          ) : (
            <Link to={`/partie/${session.id}`} className="block p-4">
              <p className="font-medium">{session.title}</p>
              <p className="mt-0.5 text-xs text-muted">
                {[showStoryTitle && session.title !== storyTitle ? storyTitle : null, session.avatar?.name, `${session.turn} tour${session.turn > 1 ? 's' : ''}`, formatRelativeDate(session.lastPlayedAt)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {excerpt && <p className="mt-2 line-clamp-2 font-[family-name:var(--font-story)] text-sm text-text/60">{excerpt}</p>}
            </Link>
          )}
          <div className="flex justify-end gap-1 border-t border-line px-2 py-1 text-muted">
            <Link
              to={`/partie/${session.id}/lecture`}
              aria-label="Relire"
              title="Relire"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:text-text"
            >
              <IconBook />
            </Link>
            <button
              type="button"
              aria-label="Renommer"
              title="Renommer"
              onClick={() => setRenaming({ id: session.id, title: session.title })}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:text-text"
            >
              <IconEdit />
            </button>
            <button
              type="button"
              aria-label="Supprimer"
              title="Supprimer"
              onClick={() => {
                if (window.confirm(`Supprimer définitivement la partie « ${session.title} » ?`)) void deleteSession(session.id)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:text-text"
            >
              <IconTrash />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

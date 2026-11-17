import { useState } from 'react'
import { deleteAvatar, saveAvatar, setDefaultAvatar, useAvatars, useDefaultAvatarId } from '../../data/stories'
import { LIMITS, newAvatar, validateAvatar } from '../../data/storyModel'
import type { Avatar } from '../../data/types'
import { Button } from '../../ui/Button'
import { TextArea, TextField } from '../../ui/Field'
import { PageHeader } from '../../ui/PageHeader'

/** Avatars : les personnages que le joueur incarne. */
export default function AvatarsPage() {
  const avatars = useAvatars()
  const defaultId = useDefaultAvatarId()
  const [editing, setEditing] = useState<Avatar | null>(null)

  if (!avatars) return null

  return (
    <>
      <PageHeader title="Mes avatars" />
      <main className="space-y-4 px-4 py-6 pb-28">
        <p className="text-sm leading-relaxed text-muted">
          Ton avatar, c'est toi dans l'histoire : son nom et ce que les personnages savent de lui. L'avatar par défaut est
          proposé au lancement d'une partie.
        </p>

        {avatars.length === 0 && !editing && (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Aucun avatar pour l'instant.</p>
        )}

        <ul className="space-y-3">
          {avatars.map((a) => (
            <li key={a.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {a.name}
                    {a.id === defaultId && (
                      <span className="ml-2 rounded-md bg-accent px-1.5 py-0.5 text-xs font-medium text-ink">par défaut</span>
                    )}
                  </p>
                  {a.gift && <p className="mt-1 text-xs uppercase tracking-wider text-accent">Don : {a.gift}</p>}
                  {a.details && <p className="mt-1 line-clamp-2 text-sm text-muted">{a.details}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setEditing(structuredClone(a))}>
                  Modifier
                </Button>
                {a.id !== defaultId && (
                  <Button variant="ghost" onClick={() => setDefaultAvatar(a.id)}>
                    Définir par défaut
                  </Button>
                )}
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm(`Supprimer l'avatar « ${a.name} » ?`)) void deleteAvatar(a.id)
                  }}
                >
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {!editing && (
          <Button className="w-full" onClick={() => setEditing(newAvatar())}>
            + Nouvel avatar
          </Button>
        )}
      </main>

      {editing && <AvatarSheet avatar={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function AvatarSheet({ avatar, onClose }: { avatar: Avatar; onClose: () => void }) {
  const [draft, setDraft] = useState(avatar)
  const [errors, setErrors] = useState<string[]>([])
  const patch = (p: Partial<Avatar>) => setDraft({ ...draft, ...p })

  const save = async () => {
    const final = { ...draft, name: draft.name.trim(), details: draft.details.trim(), gift: draft.gift.trim() }
    const problems = validateAvatar(final)
    setErrors(problems)
    if (problems.length) return
    await saveAvatar(final)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Profil de l'avatar"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-3xl border-t border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-line" />
        <h2 className="text-lg font-semibold">Profil de l'avatar</h2>
        {errors.length > 0 && (
          <ul role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">
            {errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        )}
        <TextField label="Nom" value={draft.name} onChange={(v) => patch({ name: v })} maxLength={LIMITS.avatarName} hint="Le nom par lequel on t'appellera." />
        <TextArea
          label="Détails"
          value={draft.details}
          onChange={(v) => patch({ details: v })}
          maxLength={LIMITS.avatarDetails}
          rows={6}
          hint="Âge, apparence, caractère, passé… ce que les personnages doivent savoir de toi."
        />
        <TextArea
          label="Don (facultatif)"
          value={draft.gift}
          onChange={(v) => patch({ gift: v })}
          maxLength={LIMITS.avatarGift}
          rows={2}
          hint="Un pouvoir ou talent particulier."
        />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button className="flex-1" onClick={save}>
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  )
}

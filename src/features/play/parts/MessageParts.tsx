import { type ReactNode } from 'react'
import { activeContent, type Message } from '../../../engine/session/types'
import { IconBranch, IconContinue, IconEdit, IconNext, IconPrev, IconRegenerate, IconSpeaker, IconStop, IconTrash } from '../../../ui/icons'

export function UserBubble({
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
export function FormattedPlayerText({ text }: { text: string }) {
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
export function OocText({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-3 text-sm leading-relaxed text-muted">
      <span className="mb-1 block font-mono text-xs text-accent">Hors-jeu</span>
      <p className="whitespace-pre-line">{text}</p>
    </div>
  )
}
export function AiActions({
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
  speaking,
  onSpeak,
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
  /** undefined : synthèse vocale indisponible sur cet appareil. */
  speaking?: boolean
  onSpeak: () => void
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
      {speaking !== undefined && !message.ooc && (
        <IconButton label={speaking ? 'Arrêter la lecture' : 'Écouter'} onClick={onSpeak}>
          {speaking ? <IconStop /> : <IconSpeaker />}
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
export function IconButton({
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
/** Navigation entre branches (« Branche 2/3 ‹ › »), visible seulement s'il en existe plusieurs. */
export function BranchSwitcher({ branch, onSwitch }: { branch: { index: number; count: number }; onSwitch: (direction: -1 | 1) => void }) {
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

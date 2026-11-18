import { StoredImage } from '../../../ui/StoredImage'

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

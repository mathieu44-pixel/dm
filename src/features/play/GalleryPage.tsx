import { useState } from 'react'
import { useParams } from 'react-router'
import { useStoryImages } from '../../data/images'
import { useSessionData } from '../../data/sessions'
import { PageHeader } from '../../ui/PageHeader'
import { StoredImage } from '../../ui/StoredImage'
import { ImageViewer } from './GamePage'

/** Galerie d'une partie : les images de scène se débloquent quand elles apparaissent dans l'histoire. */
export default function GalleryPage() {
  const { sessionId } = useParams()
  const data = useSessionData(sessionId)
  const images = useStoryImages(data?.story.id)
  const [viewing, setViewing] = useState<string | null>(null)

  if (!data || !images) return null
  const scenes = images.filter((i) => i.category === 'scene')
  const unlocked = new Set(data.session.unlockedImageIds ?? [])

  return (
    <>
      <PageHeader title="Galerie" />
      <main className="px-4 py-6 pb-16">
        <p className="mb-4 text-sm text-muted">
          {unlocked.size}/{scenes.length} image(s) débloquée(s) dans cette partie.
        </p>
        {scenes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            Cette histoire n'a pas encore d'images de scène. Ajoute-les dans l'éditeur (section « Images »).
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {scenes.map((img) => {
              const open = unlocked.has(img.id)
              return (
                <li key={img.id} className="relative overflow-hidden rounded-2xl border border-line">
                  {open ? (
                    <button type="button" onClick={() => setViewing(img.id)} className="block w-full" aria-label={img.description || 'Image'}>
                      <StoredImage id={img.id} className="aspect-square w-full" alt={img.description} />
                    </button>
                  ) : (
                    <div className="relative">
                      <StoredImage id={img.id} className="aspect-square w-full scale-110 blur-xl brightness-50" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink/80 text-2xl">🔒</span>
                      </span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>
      {viewing && <ImageViewer id={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

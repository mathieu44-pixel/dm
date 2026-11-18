import { useRef, useState } from 'react'
import { addImages, deleteImage, updateImage, useStoryImages } from '../../data/images'
import { IMAGE_CATEGORIES, IMAGE_LIMITS, MOODS, type ImageAsset, type ImageCategory, type Mood } from '../../engine/images/types'
import { normalizeQuery } from '../../engine/session/search'
import { parseImageTags } from '../../engine/images/utils'
import { Button } from '../../ui/Button'
import { IconTrash } from '../../ui/icons'
import { StoredImage } from '../../ui/StoredImage'

const inputClass = 'min-h-10 w-full rounded-lg border border-line bg-ink px-3 text-sm outline-none focus:border-accent'

/**
 * Banque d'images d'une histoire. Les images sont enregistrées dès l'import
 * (compressées sur l'appareil), indépendamment du bouton « Enregistrer » de l'histoire.
 */
export function ImagesEditor({
  storyId,
  coverImageId,
  onSetCover,
  characters = [],
}: {
  storyId: string
  coverImageId?: string
  onSetCover: (id: string | undefined) => void
  /** Personnages de l'histoire, pour rattacher une image et lui donner une humeur (v1.2). */
  characters?: { id: string; name: string; portraitImageId?: string }[]
}) {
  const images = useStoryImages(storyId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<ImageCategory>('scene')

  const importFiles = async (files: File[]) => {
    setBusy(true)
    setError(null)
    try {
      await addImages(storyId, files, category)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted">
        Les images restent sur ton appareil. Pendant la partie, l'IA illustre les passages avec les images de{' '}
        <strong>scène</strong> et de <strong>personnage</strong> (choisies grâce à leur description et leurs mots-clés, et au
        portrait associé à chaque personnage), puis les débloque dans la galerie. ({images?.length ?? 0}/{IMAGE_LIMITS.perStory})
      </p>
      <p className="text-xs leading-relaxed text-muted">
        <strong>Humeurs</strong> : donne plusieurs images de <strong>personnage</strong> au même personnage (joyeux, en colère, gêné…).
        Pendant la partie, l'IA affiche celle qui correspond à son humeur du moment.
      </p>

      <div className="flex gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value as ImageCategory)} className={inputClass + ' w-auto'}>
          {IMAGE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              Importer comme : {c.label}
            </option>
          ))}
        </select>
        <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Import…' : '+ Ajouter des images'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) void importFiles(files)
          }}
        />
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}

      <ul className="space-y-3">
        {images?.map((img) => (
          <ImageCard key={img.id} image={img} isCover={img.id === coverImageId} onSetCover={onSetCover} characters={characters} />
        ))}
      </ul>
    </div>
  )
}

function ImageCard({
  image,
  isCover,
  onSetCover,
  characters,
}: {
  image: ImageAsset
  isCover: boolean
  onSetCover: (id: string | undefined) => void
  characters: { id: string; name: string; portraitImageId?: string }[]
}) {
  const [tags, setTags] = useState(image.tags.join(', '))
  // Personnage rattaché : explicite, sinon portrait principal, sinon nom dans les mots-clés.
  const owner =
    image.characterId ??
    characters.find((c) => c.portraitImageId === image.id)?.id ??
    characters.find((c) => image.tags.some((t) => normalizeQuery(t) === normalizeQuery(c.name)))?.id ??
    ''
  const [description, setDescription] = useState(image.description)

  return (
    <li className="flex gap-3 rounded-xl border border-line bg-surface-2 p-3">
      <StoredImage id={image.id} className="h-28 w-20 shrink-0 rounded-lg" alt={image.description} />
      <div className="min-w-0 flex-1 space-y-2">
        <select
          value={image.category}
          onChange={(e) => updateImage(image.id, { category: e.target.value as ImageCategory })}
          className={inputClass}
          aria-label="Catégorie"
        >
          {IMAGE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        {image.category === 'character' && characters.length > 0 && (
          <div className="flex gap-2">
            <select
              value={owner}
              onChange={(e) => updateImage(image.id, { characterId: e.target.value || undefined })}
              className={inputClass}
              aria-label="Personnage"
            >
              <option value="">Personnage…</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Sans nom'}
                </option>
              ))}
            </select>
            <select
              value={image.mood ?? 'neutral'}
              onChange={(e) => updateImage(image.id, { mood: e.target.value as Mood })}
              className={inputClass + ' w-auto'}
              aria-label="Humeur"
            >
              {MOODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.emoji} {m.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== image.description && updateImage(image.id, { description: description.trim() })}
          placeholder="Description (ce que montre l'image)"
          className={inputClass}
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onBlur={() => updateImage(image.id, { tags: parseImageTags(tags) })}
          placeholder="Mots-clés : lieu, personnage, moment…"
          className={inputClass}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSetCover(isCover ? undefined : image.id)}
            className={'rounded-lg border px-2 py-1 text-xs ' + (isCover ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted')}
          >
            {isCover ? '★ Couverture' : '☆ Couverture'}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            aria-label="Supprimer l'image"
            onClick={() => {
              if (window.confirm('Supprimer cette image ?')) {
                if (isCover) onSetCover(undefined)
                void deleteImage(image.id)
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-text"
          >
            <IconTrash />
          </button>
        </div>
      </div>
    </li>
  )
}

/** Choix d'une image de la banque (portrait, illustration de fin…). */
export function ImagePicker({
  storyId,
  value,
  onChange,
  label,
  prefer,
}: {
  storyId: string
  value: string | undefined
  onChange: (id: string | undefined) => void
  label: string
  /** Catégorie proposée en premier. */
  prefer?: ImageCategory
}) {
  const images = useStoryImages(storyId)
  const sorted = [...(images ?? [])].sort((a, b) => Number(b.category === prefer) - Number(a.category === prefer))
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted">Ajoute d'abord des images dans la section « Images ».</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className={'flex h-20 w-14 shrink-0 items-center justify-center rounded-lg border text-xs ' + (!value ? 'border-accent text-accent' : 'border-line text-muted')}
          >
            Aucune
          </button>
          {sorted.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onChange(img.id)}
              className={'shrink-0 overflow-hidden rounded-lg border-2 ' + (value === img.id ? 'border-accent' : 'border-transparent')}
              aria-label={img.description || 'Image'}
            >
              <StoredImage id={img.id} className="h-20 w-14" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

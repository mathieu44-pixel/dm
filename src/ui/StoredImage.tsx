import { useImageUrl } from '../data/images'

/** Affiche une image de la banque (stockée sur l'appareil). */
export function StoredImage({ id, alt = '', className = '' }: { id: string | undefined; alt?: string; className?: string }) {
  const url = useImageUrl(id)
  if (!url) return <div className={'bg-surface-2 ' + className} aria-hidden />
  return <img src={url} alt={alt} className={'object-cover ' + className} loading="lazy" decoding="async" />
}

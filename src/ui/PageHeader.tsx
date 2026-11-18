import { useBack } from './useBack'

/** En-tête de page avec bouton retour. */
export function PageHeader({ title, back = true, fallback = '/' }: { title: string; back?: boolean; fallback?: string }) {
  const goBack = useBack(fallback)
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-ink/95 px-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
      {back && (
        <button
          type="button"
          aria-label="Retour"
          onClick={goBack}
          className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-muted hover:text-text"
        >
          ‹
        </button>
      )}
      <h1 className={'text-lg font-semibold ' + (back ? '' : 'pl-4')}>{title}</h1>
    </header>
  )
}

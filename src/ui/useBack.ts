import { useCallback } from 'react'
import { useNavigate } from 'react-router'

/**
 * Retour en arrière fiable : revient à l'écran précédent s'il y en a un dans l'application,
 * sinon va à `fallback` sans empiler de nouvel écran (évite les allers-retours en boucle).
 */
export function useBack(fallback = '/') {
  const navigate = useNavigate()
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate, fallback])
}

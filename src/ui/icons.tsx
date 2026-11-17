/**
 * Icônes en SVG : affichage identique sur tous les téléphones
 * (certains caractères spéciaux comme ⏵ n'existent pas dans toutes les polices Android).
 */
import type { ReactNode } from 'react'

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

export const IconRegenerate = () => (
  <Svg>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </Svg>
)

export const IconContinue = () => (
  <Svg>
    <path d="M5 6l6 6-6 6" />
    <path d="M13 6l6 6-6 6" />
  </Svg>
)

export const IconEdit = () => (
  <Svg>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </Svg>
)

export const IconTrash = () => (
  <Svg>
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
  </Svg>
)

export const IconPrev = () => (
  <Svg>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)

export const IconNext = () => (
  <Svg>
    <path d="M9 6l6 6-6 6" />
  </Svg>
)

export const IconBranch = () => (
  <Svg>
    <circle cx="6" cy="5" r="2" />
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="9" r="2" />
    <path d="M6 7v10" />
    <path d="M18 11c0 4-6 3-11.5 6.5" />
  </Svg>
)

import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

const ITEMS: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: '/',
    label: 'Accueil',
    icon: (
      <Svg>
        <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />
      </Svg>
    ),
  },
  {
    to: '/parties',
    label: 'Parties',
    icon: (
      <Svg>
        <path d="M5 5h14v10H9l-4 4z" />
        <path d="M9 9h6M9 12h4" />
      </Svg>
    ),
  },
  {
    to: '/avatars',
    label: 'Avatars',
    icon: (
      <Svg>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
      </Svg>
    ),
  },
  {
    to: '/reglages',
    label: 'Réglages',
    icon: (
      <Svg>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
      </Svg>
    ),
  },
]

/** Barre de navigation principale, en bas de l'écran (comme dans OOC). */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto grid max-w-xl grid-cols-4 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] ' + (isActive ? 'text-accent' : 'text-muted')
          }
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

import { useEffect, type ReactNode } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { textSizeRem, useTextSize } from '../data/preferences'
import { ensureExampleStory } from '../data/stories'
import CreatorPage from '../features/creator/CreatorPage'
import HistoryPage from '../features/history/HistoryPage'
import { BottomNav } from '../ui/BottomNav'
import AvatarsPage from '../features/avatars/AvatarsPage'
import StoryEditorPage from '../features/editor/StoryEditorPage'
import HomePage from '../features/library/HomePage'
import StoryPage from '../features/library/StoryPage'
import GamePage from '../features/play/GamePage'
import GalleryPage from '../features/play/GalleryPage'
import MemoryPage from '../features/play/MemoryPage'
import ReadingPage from '../features/play/ReadingPage'
import SettingsPage from '../features/settings/SettingsPage'

/**
 * Routage en mode « hash » (#/reglages) : compatible avec GitHub Pages,
 * qui ne sait pas rediriger les adresses internes d'une application.
 */
export default function App() {
  useEffect(() => {
    // Histoire d'exemple au premier lancement ; on demande aussi un stockage persistant
    // pour que le navigateur n'efface pas les données en cas de manque de place.
    void ensureExampleStory()
    void navigator.storage?.persist?.()
  }, [])

  // Taille du texte de lecture, appliquée partout via une variable CSS.
  const textSize = useTextSize()
  useEffect(() => {
    document.documentElement.style.setProperty('--story-size', `${textSizeRem(textSize)}rem`)
  }, [textSize])

  return (
    <HashRouter>
      <div className="mx-auto min-h-full max-w-xl">
        <Routes>
          <Route path="/" element={<WithNav><HomePage /></WithNav>} />
          <Route path="/parties" element={<WithNav><HistoryPage /></WithNav>} />
          <Route path="/creer" element={<CreatorPage />} />
          <Route path="/histoire/:id" element={<StoryPage />} />
          <Route path="/histoire/:id/modifier" element={<StoryEditorPage />} />
          <Route path="/partie/:sessionId" element={<GamePage />} />
          <Route path="/partie/:sessionId/memoire" element={<MemoryPage />} />
          <Route path="/partie/:sessionId/galerie" element={<GalleryPage />} />
          <Route path="/partie/:sessionId/lecture" element={<ReadingPage />} />
          <Route path="/avatars" element={<WithNav><AvatarsPage /></WithNav>} />
          <Route path="/reglages" element={<WithNav><SettingsPage /></WithNav>} />
          <Route path="*" element={<WithNav><HomePage /></WithNav>} />
        </Routes>
      </div>
    </HashRouter>
  )
}

/** Pages principales : contenu + barre de navigation en bas. */
function WithNav({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="pb-20">{children}</div>
      <BottomNav />
    </>
  )
}

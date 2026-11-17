import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { ensureExampleStory } from '../data/stories'
import AvatarsPage from '../features/avatars/AvatarsPage'
import StoryEditorPage from '../features/editor/StoryEditorPage'
import HomePage from '../features/library/HomePage'
import StoryPage from '../features/library/StoryPage'
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

  return (
    <HashRouter>
      <div className="mx-auto min-h-full max-w-xl">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/histoire/:id" element={<StoryPage />} />
          <Route path="/histoire/:id/modifier" element={<StoryEditorPage />} />
          <Route path="/avatars" element={<AvatarsPage />} />
          <Route path="/reglages" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </div>
    </HashRouter>
  )
}

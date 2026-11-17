import { HashRouter, Route, Routes } from 'react-router'
import HomePage from '../features/library/HomePage'
import SettingsPage from '../features/settings/SettingsPage'

/**
 * Routage en mode « hash » (#/reglages) : compatible avec GitHub Pages,
 * qui ne sait pas rediriger les adresses internes d'une application.
 */
export default function App() {
  return (
    <HashRouter>
      <div className="mx-auto min-h-full max-w-xl">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/reglages" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </div>
    </HashRouter>
  )
}

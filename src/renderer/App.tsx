import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AppShell from './components/AppShell'
import ImportView from './views/ImportView'
import WordListView from './views/WordListView'
import CategoryView from './views/CategoryView'
import SearchView from './views/SearchView'
import DataEditorView from './views/DataEditorView'
import SettingsView from './views/SettingsView'
import DevModeView from './views/DevModeView'

export default function App() {
  const location = useLocation()
  return (
    <AppShell>
      <div key={location.pathname} className="contents">
        <Routes location={location}>
          <Route path="/" element={<Navigate to="/import" replace />} />
          <Route path="/import" element={<ImportView />} />
          <Route path="/words" element={<WordListView />} />
          <Route path="/categories" element={<CategoryView />} />
          <Route path="/search" element={<SearchView />} />
          <Route path="/editor" element={<DataEditorView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/dev" element={<DevModeView />} />
        </Routes>
      </div>
    </AppShell>
  )
}

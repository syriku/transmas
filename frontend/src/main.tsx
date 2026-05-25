import React from 'react'
import ReactDOM from 'react-dom/client'
import './i18n'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './HomePage'
import ChaptersPage from './ChaptersPage'
import EditorPage from './EditorPage'
import Login from './login'
import { AppProvider } from './AppContext'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/chapters/:projectName" element={<ChaptersPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </AppProvider>
  </React.StrictMode>,
)

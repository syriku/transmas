import React, { createContext, useContext, useState, useEffect } from 'react'
import { LogIn, LogOut } from '../bindings/github.com/syriku/transmas/service/agentservice'
import { ProjectInfo, Chapter } from '../bindings/github.com/syriku/transmas/agents/database/models'

interface AppContextType {
  username: string | null
  currentProject: ProjectInfo | null
  currentChapter: Chapter | null
  login: (username: string) => Promise<void>
  logout: () => void
  setCurrentProject: (project: ProjectInfo | null) => void
  setCurrentChapter: (chapter: Chapter | null) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [username, setUsernameState] = useState<string | null>(() =>
    localStorage.getItem('username'),
  )
  const [currentProject, setCurrentProjectState] = useState<ProjectInfo | null>(() => {
    const saved = localStorage.getItem('currentProject')
    try {
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [currentChapter, setCurrentChapterState] = useState<Chapter | null>(() => {
    const saved = localStorage.getItem('currentChapter')
    try {
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const autoLogin = async () => {
      if (username) {
        try {
          console.log(`Auto-logging in saved user: ${username}`)
          await LogIn(username)
        } catch (err) {
          console.error('Auto-login failed, clearing session:', err)
          logout()
        }
      }
      setLoading(false)
    }
    autoLogin()
  }, [])

  const login = async (user: string) => {
    await LogIn(user)
    setUsernameState(user)
    localStorage.setItem('username', user)
  }

  const logout = () => {
    LogOut().catch(console.error)
    setUsernameState(null)
    setCurrentProjectState(null)
    setCurrentChapterState(null)
    localStorage.removeItem('username')
    localStorage.removeItem('currentProject')
    localStorage.removeItem('currentChapter')
  }

  const setCurrentProject = (project: ProjectInfo | null) => {
    setCurrentProjectState(project)
    if (project) {
      localStorage.setItem('currentProject', JSON.stringify(project))
    } else {
      localStorage.removeItem('currentProject')
      setCurrentChapter(null)
    }
  }

  const setCurrentChapter = (chapter: Chapter | null) => {
    setCurrentChapterState(chapter)
    if (chapter) {
      localStorage.setItem('currentChapter', JSON.stringify(chapter))
    } else {
      localStorage.removeItem('currentChapter')
    }
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          width: '100vw',
          backgroundColor: '#f5f7fa',
          color: '#333',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '50px',
              height: '50px',
              border: '4px solid #e2e8f0',
              borderTop: '4px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px auto',
            }}
          />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
            Initializing Session...
          </h2>
        </div>
      </div>
    )
  }

  return (
    <AppContext.Provider
      value={{
        username,
        currentProject,
        currentChapter,
        login,
        logout,
        setCurrentProject,
        setCurrentChapter,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}

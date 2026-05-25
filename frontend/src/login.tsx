import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useApp } from './AppContext'

const Login: React.FC = () => {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { login } = useApp()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setError(t('pleaseEnterUsername'))
      return
    }

    setLoading(true)
    setError('')
    try {
      await login(username)
      navigate('/home')
    } catch (err: any) {
      setError(err.message || t('failedToLogin'))
    } finally {
      setLoading(false)
    }
  }

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
      }}
    >
      <div
        style={{
          padding: '40px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '400px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ marginBottom: '10px', fontSize: '2rem' }}>{t('translationMaster')}</h1>
        <p style={{ marginBottom: '30px', color: '#666' }}>{t('enterUsername')}</p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('usernamePlaceholder')}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#007bff')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#ddd')}
            />
          </div>

          {error && (
            <p style={{ color: '#dc3545', marginBottom: '20px', fontSize: '14px' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '48px',
              padding: '0',
              fontSize: '18px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              backgroundColor: '#007bff',
              color: 'white',
              borderRadius: '8px',
              border: 'none',
              margin: '0',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              transition: 'background-color 0.2s',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1',
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = '#0056b3')}
            onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = '#007bff')}
          >
            {loading ? t('loggingIn') : t('login')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login

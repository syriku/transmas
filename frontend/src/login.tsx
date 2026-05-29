import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useApp } from './AppContext'
import { DeleteUserData } from '../bindings/github.com/syriku/transmas/service/systemservice'

const Login: React.FC = () => {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { login, username: loggedInUser } = useApp()

  const [showResetModal, setShowResetModal] = useState(false)
  const [countdown, setCountdown] = useState(4)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')

  useEffect(() => {
    let timer: any
    if (showResetModal && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1)
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [showResetModal, countdown])

  const handleOpenResetModal = () => {
    setCountdown(4)
    setResetError('')
    setResetting(false)
    setShowResetModal(true)
  }

  const handleConfirmReset = async () => {
    if (countdown > 0 || resetting) return
    setResetting(true)
    setResetError('')
    try {
      await DeleteUserData()
      alert(t('resetSuccess'))
      setShowResetModal(false)
    } catch (err: any) {
      setResetError(err.message || t('failedToReset'))
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    if (loggedInUser) {
      navigate('/home', { replace: true })
    }
  }, [loggedInUser, navigate])

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

      <button
        type="button"
        onClick={handleOpenResetModal}
        style={{
          marginTop: '24px',
          padding: '8px 16px',
          fontSize: '14px',
          color: '#dc3545',
          backgroundColor: 'transparent',
          border: '1px solid #dc3545',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 'auto',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#fdf2f2'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        {t('resetData')}
      </button>

      {showResetModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
          }}
          onClick={() => !resetting && setShowResetModal(false)}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '440px',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideUp {
                from { transform: scale(0.95) translateY(10px); opacity: 0; }
                to { transform: scale(1) translateY(0); opacity: 1; }
              }
              .modal-backdrop {
                animation: fadeIn 0.2s ease-out forwards;
              }
              .modal-content {
                animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              }
            `}</style>

            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc3545"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: '16px' }}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>

            <h2
              style={{
                marginTop: 0,
                marginBottom: '12px',
                fontSize: '20px',
                fontWeight: '600',
                color: '#1a1a1a',
              }}
            >
              {t('resetDataTitle')}
            </h2>

            <p
              style={{
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#666',
                margin: '0 0 24px 0',
              }}
            >
              {t('resetDataWarning')}
            </p>

            {resetError && (
              <p style={{ color: '#dc3545', fontSize: '13px', margin: '0 0 16px 0' }}>
                {resetError}
              </p>
            )}

            <div
              style={{
                display: 'flex',
                width: '100%',
                gap: '12px',
              }}
            >
              <button
                type="button"
                disabled={resetting}
                onClick={() => setShowResetModal(false)}
                style={{
                  flex: 1,
                  height: '40px',
                  backgroundColor: '#f3f4f6',
                  color: '#4b5563',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: resetting ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => {
                  if (!resetting) e.currentTarget.style.backgroundColor = '#e5e7eb'
                }}
                onMouseOut={(e) => {
                  if (!resetting) e.currentTarget.style.backgroundColor = '#f3f4f6'
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={countdown > 0 || resetting}
                onClick={handleConfirmReset}
                style={{
                  flex: 1,
                  height: '40px',
                  backgroundColor: countdown > 0 || resetting ? '#fca5a5' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: countdown > 0 || resetting ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => {
                  if (countdown === 0 && !resetting)
                    e.currentTarget.style.backgroundColor = '#b91c1c'
                }}
                onMouseOut={(e) => {
                  if (countdown === 0 && !resetting)
                    e.currentTarget.style.backgroundColor = '#dc3545'
                }}
              >
                {resetting
                  ? t('saving')
                  : countdown > 0
                    ? t('confirmWithCountdown', { seconds: countdown })
                    : t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Login

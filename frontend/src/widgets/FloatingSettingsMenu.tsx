import React, { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GetProjectAiConfigKey,
  GetAiConfig,
} from '../../bindings/github.com/syriku/transmas/service/agentservice'
import { GetModels } from '../../bindings/github.com/syriku/transmas/service/systemservice'
import DiffViewerModal from './DiffViewerModal'

interface Props {
  projectName: string | null
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void
  handleTranslate: () => Promise<void>
  translating: boolean
  selectedModel: string
  setSelectedModel: (model: string) => void
  translated: boolean
  reviewed: boolean
  onTranslatedChange: (completed: boolean) => Promise<void>
  onReviewedChange: (completed: boolean) => Promise<void>
  onResetStatus: () => Promise<void>
  detailed: boolean
  onDetailedChange: (detailed: boolean) => void
  recordedTranslationText: string | null
  getCurrentTranslationText: () => string
}

const FloatingSettingsMenu: React.FC<Props> = ({
  projectName,
  setToast,
  handleTranslate,
  translating,
  selectedModel,
  setSelectedModel,
  translated,
  reviewed,
  onTranslatedChange,
  onReviewedChange,
  onResetStatus,
  detailed,
  onDetailedChange,
  recordedTranslationText,
  getCurrentTranslationText,
}) => {
  const { t } = useTranslation()
  const [showFloatingMenu, setShowFloatingMenu] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [modelError, setModelError] = useState<string>('')
  const [hoverTranslateDone, setHoverTranslateDone] = useState(false)
  const [hoverReviewDone, setHoverReviewDone] = useState(false)
  const [hoverReset, setHoverReset] = useState(false)
  const [showDiffModal, setShowDiffModal] = useState(false)
  const floatingMenuRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      if (finalTimeoutRef.current) clearTimeout(finalTimeoutRef.current)
    }
  }, [])

  const handleReviewHoverEnter = () => {
    setHoverReviewDone(true)
    if (recordedTranslationText !== null) {
      hoverTimeoutRef.current = setTimeout(() => {
        const currentText = getCurrentTranslationText()
        if (recordedTranslationText !== currentText) {
          finalTimeoutRef.current = setTimeout(() => {
            setShowDiffModal(true)
          }, 100)
        }
      }, 700)
    }
  }

  const handleReviewHoverLeave = () => {
    setHoverReviewDone(false)
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    if (finalTimeoutRef.current) {
      clearTimeout(finalTimeoutRef.current)
      finalTimeoutRef.current = null
    }
  }

  const fetchModels = async () => {
    if (!projectName) return
    setFetchingModels(true)
    setModelError('')
    try {
      const configKey = await GetProjectAiConfigKey(projectName)
      if (!configKey) {
        setModels([])
        setFetchingModels(false)
        return
      }
      const aiConfigs = await GetAiConfig()
      const config = aiConfigs[configKey]
      if (!config) {
        setModels([])
        setFetchingModels(false)
        return
      }
      const modelList = await GetModels(config)
      setModels(modelList || [])

      const savedModel = localStorage.getItem(`transmas_selected_model_${projectName}`) || ''
      if (modelList && modelList.length > 0) {
        if (savedModel && modelList.includes(savedModel)) {
          setSelectedModel(savedModel)
        } else {
          setSelectedModel(modelList[0])
          localStorage.setItem(`transmas_selected_model_${projectName}`, modelList[0])
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch models:', err)
      setModelError(err.message || String(err))
    } finally {
      setFetchingModels(false)
    }
  }

  useEffect(() => {
    fetchModels()
  }, [projectName])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (floatingMenuRef.current && !floatingMenuRef.current.contains(event.target as Node)) {
        setShowFloatingMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleModelChange = (model: string) => {
    setSelectedModel(model)
    if (projectName) {
      localStorage.setItem(`transmas_selected_model_${projectName}`, model)
    }
  }

  return (
    <div
      ref={floatingMenuRef}
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '12px',
      }}
    >
      {/* Floating Menu Popup */}
      {showFloatingMenu && (
        <div
          style={{
            width: '280px',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08), 0 1px 8px rgba(0, 0, 0, 0.04)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            animation: 'popup-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            transformOrigin: 'bottom right',
            color: '#333',
            boxSizing: 'border-box',
          }}
        >
          <style>{`
            @keyframes popup-in {
              from {
                opacity: 0;
                transform: scale(0.9) translateY(10px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
          `}</style>

          {/* Model Selection Part */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#555',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {t('selectModel')}
              </span>
              {projectName && !fetchingModels && models.length > 0 && (
                <button
                  type="button"
                  onClick={fetchModels}
                  title={t('refreshModels')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    transition: 'color 0.2s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = '#007bff')}
                  onMouseOut={(e) => (e.currentTarget.style.color = '#666')}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M16 3h5v5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 21H3v-5" />
                  </svg>
                </button>
              )}
            </div>

            {fetchingModels ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 0',
                  fontSize: '14px',
                  color: '#666',
                }}
              >
                <svg
                  style={{ animation: 'spin 1s linear infinite' }}
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
                <style>{`
                  @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                `}</style>
                <span>{t('loadingModels')}</span>
              </div>
            ) : modelError ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#d32f2f' }}>
                  {t('fetchModelsError') || 'Failed to fetch models: '}
                  {modelError}
                </span>
                <button
                  type="button"
                  onClick={fetchModels}
                  style={{
                    width: 'auto',
                    height: '28px',
                    lineHeight: '28px',
                    margin: 0,
                    padding: '0 12px',
                    backgroundColor: '#f5f5f5',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                >
                  {t('refreshModels')}
                </button>
              </div>
            ) : models.length === 0 ? (
              <span
                style={{ fontSize: '13px', color: '#888', fontStyle: 'italic', padding: '6px 0' }}
              >
                {t('aiConfigNotSet')}
              </span>
            ) : (
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                }}
              >
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Separator line */}
          <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.06)' }} />

          {/* Status Part */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: '700',
                color: '#555',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {t('status', { defaultValue: 'STATUS' })}
            </span>

            {!translated && !reviewed && (
              <button
                type="button"
                onMouseEnter={() => setHoverTranslateDone(true)}
                onMouseLeave={() => setHoverTranslateDone(false)}
                onClick={() => onTranslatedChange(true)}
                style={{
                  width: '100%',
                  height: '40px',
                  margin: 0,
                  padding: '0 16px',
                  boxSizing: 'border-box',
                  background: hoverTranslateDone
                    ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: hoverTranslateDone
                    ? '0 6px 16px rgba(16, 185, 129, 0.3)'
                    : '0 4px 12px rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transform: hoverTranslateDone ? 'translateY(-1px)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t('translatedCompleted')}
              </button>
            )}

            {translated && !reviewed && (
              <>
                <button
                  type="button"
                  onMouseEnter={handleReviewHoverEnter}
                  onMouseLeave={handleReviewHoverLeave}
                  onClick={() => onReviewedChange(true)}
                  style={{
                    width: '100%',
                    height: '40px',
                    margin: 0,
                    padding: '0 16px',
                    boxSizing: 'border-box',
                    background: hoverReviewDone
                      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                      : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: hoverReviewDone
                      ? '0 6px 16px rgba(59, 130, 246, 0.3)'
                      : '0 4px 12px rgba(59, 130, 246, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transform: hoverReviewDone ? 'translateY(-1px)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <polyline points="7.5 11.5 10.5 14.5 16.5 8.5" />
                  </svg>
                  {t('reviewedCompleted')}
                </button>
                <button
                  type="button"
                  onMouseEnter={() => setHoverReset(true)}
                  onMouseLeave={() => setHoverReset(false)}
                  onClick={() => onResetStatus()}
                  style={{
                    width: '100%',
                    height: '40px',
                    margin: 0,
                    padding: '0 16px',
                    boxSizing: 'border-box',
                    backgroundColor: hoverReset ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                    color: hoverReset ? '#dc2626' : '#ef4444',
                    border: hoverReset ? '2px dashed #dc2626' : '2px dashed rgba(239, 68, 68, 0.6)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transform: hoverReset ? 'translateY(-1px)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  {t('resetStatus')}
                </button>
              </>
            )}

            {reviewed && (
              <button
                type="button"
                onMouseEnter={() => setHoverReset(true)}
                onMouseLeave={() => setHoverReset(false)}
                onClick={() => onResetStatus()}
                style={{
                  width: '100%',
                  height: '40px',
                  margin: 0,
                  padding: '0 16px',
                  boxSizing: 'border-box',
                  backgroundColor: hoverReset ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                  color: hoverReset ? '#dc2626' : '#ef4444',
                  border: hoverReset ? '2px dashed #dc2626' : '2px dashed rgba(239, 68, 68, 0.6)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transform: hoverReset ? 'translateY(-1px)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                {t('resetStatus')}
              </button>
            )}

            <div
              onClick={() => onDetailedChange(!detailed)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: detailed ? 'rgba(0, 123, 255, 0.08)' : 'rgba(0, 0, 0, 0.02)',
                border: detailed
                  ? '1px solid rgba(0, 123, 255, 0.3)'
                  : '1px solid rgba(0, 0, 0, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: detailed ? '#0056b3' : '#555',
                }}
              >
                {t('detailedMode')}
              </span>
              <div
                style={{
                  width: '36px',
                  height: '20px',
                  borderRadius: '10px',
                  backgroundColor: detailed ? '#007bff' : '#ccc',
                  position: 'relative',
                  transition: 'background-color 0.2s',
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    position: 'absolute',
                    top: '2px',
                    left: detailed ? '18px' : '2px',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Separator line */}
          <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.06)' }} />

          {/* Translate Trigger Button */}
          <button
            type="button"
            disabled={translating}
            onClick={() => {
              setShowFloatingMenu(false)
              handleTranslate()
            }}
            style={{
              width: '100%',
              height: '40px',
              margin: 0,
              padding: '0 16px',
              background: translating
                ? '#a5b4fc'
                : 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: translating ? 'not-allowed' : 'pointer',
              boxShadow: translating ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseOver={(e) => {
              if (!translating) {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.35)'
              }
            }}
            onMouseOut={(e) => {
              if (!translating) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)'
              }
            }}
          >
            {translating ? (
              <>
                <svg
                  style={{ animation: 'spin 1s linear infinite' }}
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
                {t('translating')}
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 8 6 6 6-6" />
                  <path d="M4 14h16" />
                </svg>
                {t('translate')}
              </>
            )}
          </button>
        </div>
      )}

      {/* Main FAB Toggle Button */}
      <button
        type="button"
        onClick={() => setShowFloatingMenu(!showFloatingMenu)}
        style={{
          width: '56px',
          height: '56px',
          margin: 0,
          padding: 0,
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0, 123, 255, 0.3), 0 2px 8px rgba(0, 123, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s, background-color 0.2s, box-shadow 0.2s',
          transform: showFloatingMenu ? 'rotate(45deg)' : 'none',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#0056b3'
          e.currentTarget.style.transform = showFloatingMenu
            ? 'rotate(45deg) scale(1.05)'
            : 'scale(1.05)'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#007bff'
          e.currentTarget.style.transform = showFloatingMenu ? 'rotate(45deg)' : 'none'
        }}
      >
        {/* Icon: rotating '+' / 'x' to toggle settings */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: 'transform 0.2s' }}
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Diff Viewer Modal */}
      {showDiffModal && (
        <DiffViewerModal
          originalText={recordedTranslationText || ''}
          currentText={getCurrentTranslationText()}
          onClose={() => setShowDiffModal(false)}
        />
      )}
    </div>
  )
}

export default FloatingSettingsMenu

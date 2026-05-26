import React, { useEffect, useRef, useMemo } from 'react'
import * as diff from 'diff'
import { useTranslation } from 'react-i18next'

interface DiffViewerModalProps {
  originalText: string
  currentText: string
  onClose: () => void
}

const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  originalText,
  currentText,
  onClose,
}) => {
  const { t } = useTranslation()
  const modalRef = useRef<HTMLDivElement>(null)

  const renderWhitespace = (text: string) => {
    return text.replace(/ /g, '·').replace(/\t/g, '→\t').replace(/\n/g, '↵\n')
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  const diffChunks = useMemo(() => {
    return diff.diffWordsWithSpace(originalText, currentText)
  }, [originalText, currentText])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        animation: 'fade-in 0.2s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <div
        ref={modalRef}
        style={{
          width: '80%',
          maxWidth: '800px',
          height: '80vh',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8f9fa',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>{t('translationDiff')}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '4px',
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e0e0e0')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            backgroundColor: '#fff',
            // Mimic Quill editor styling
            fontSize: '15px',
            lineHeight: '1.6',
            color: '#333',
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {diffChunks.map((part, index) => {
            if (part.added) {
              return (
                <span
                  key={index}
                  style={{
                    color: '#2e7d32', // Vscode diff green
                    backgroundColor: 'rgba(46, 125, 50, 0.1)',
                  }}
                >
                  {renderWhitespace(part.value)}
                </span>
              )
            }
            if (part.removed) {
              return (
                <span
                  key={index}
                  style={{
                    color: '#d32f2f', // Vscode diff red
                    backgroundColor: 'rgba(211, 47, 47, 0.1)',
                    textDecoration: 'line-through',
                  }}
                >
                  {renderWhitespace(part.value)}
                </span>
              )
            }
            return <span key={index}>{part.value}</span>
          })}
        </div>
      </div>
    </div>
  )
}

export default DiffViewerModal

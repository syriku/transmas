import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Novel } from '../../bindings/github.com/syriku/kakuyomu-loader/models'
import { SaveNovelTxt } from '../../bindings/github.com/syriku/transmas/service/systemservice'
import { AddChapter } from '../../bindings/github.com/syriku/transmas/service/agentservice'

const renderContentWithFurigana = (
  content: string,
  vocabulary?: { [key: string]: string | undefined },
) => {
  const escaped = (content || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  if (!vocabulary || Object.keys(vocabulary).length === 0) {
    return escaped
  }

  const validVocab: Record<string, string> = {}
  for (const [word, pron] of Object.entries(vocabulary)) {
    if (word && pron) {
      validVocab[word] = pron
    }
  }

  const sortedWords = Object.keys(validVocab).sort((a, b) => b.length - a.length)

  interface Token {
    type: 'text' | 'html'
    value: string
  }

  let tokens: Token[] = [{ type: 'text', value: escaped }]

  for (const word of sortedWords) {
    const pron = validVocab[word]
    const newTokens: Token[] = []
    for (const token of tokens) {
      if (token.type === 'html') {
        newTokens.push(token)
        continue
      }

      const parts = token.value.split(word)
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          newTokens.push({ type: 'text', value: parts[i] })
        }
        if (i < parts.length - 1) {
          newTokens.push({
            type: 'html',
            value: `<ruby>${word}<rt>${pron}</rt></ruby>`,
          })
        }
      }
    }
    tokens = newTokens
  }

  return tokens.map((t) => t.value).join('')
}

interface NovelPreviewModalProps {
  novel: Novel
  projectName: string
  workDir: string
  nextOrder: number
  onClose: () => void
  onSaveSuccess: () => void
}

const NovelPreviewModal: React.FC<NovelPreviewModalProps> = ({
  novel,
  projectName,
  workDir,
  nextOrder,
  onClose,
  onSaveSuccess,
}) => {
  const { t } = useTranslation()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setIsSaving(true)
    setError('')
    try {
      const baseName = await SaveNovelTxt(workDir, novel)
      await AddChapter(projectName, nextOrder, baseName)
      onSaveSuccess()
    } catch (err: any) {
      console.error('Failed to save novel:', err)
      setError(err.message || 'Failed to save novel')
    } finally {
      setIsSaving(false)
    }
  }

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
        style={{
          width: '85%',
          maxWidth: '900px',
          height: '85vh',
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8f9fa',
          }}
        >
          <span style={{ fontSize: '1.2rem', fontWeight: '600', color: '#333' }}>
            {t('webNovelPreview')}
          </span>
          <button
            onClick={onClose}
            disabled={isSaving}
            style={{
              background: 'none',
              border: 'none',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: '6px',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              if (!isSaving) e.currentTarget.style.backgroundColor = '#e9ecef'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
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

        {/* Content Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '30px 40px',
            backgroundColor: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {error && (
            <div
              style={{
                padding: '16px 20px',
                backgroundColor: '#fff1f0',
                border: '1px solid #ffa39e',
                borderRadius: '8px',
                color: '#cf1322',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          {/* Title */}
          <h1
            style={{
              margin: 0,
              fontSize: '2rem',
              fontWeight: '700',
              color: '#1a1a1a',
              borderBottom: '2px solid #eaeaea',
              paddingBottom: '12px',
              lineHeight: '1.3',
            }}
          >
            {novel.Title}
          </h1>

          {/* Content Preview */}
          <div>
            <h3
              style={{
                margin: '0 0 12px 0',
                fontSize: '1.1rem',
                color: '#475569',
                fontWeight: '600',
              }}
            >
              {t('contentPreview')}
            </h3>
            <div
              style={{
                fontSize: '16px',
                lineHeight: '2.4',
                color: '#2d3748',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                padding: '20px',
                backgroundColor: '#fdfdfd',
                border: '1px solid #edf2f7',
                borderRadius: '8px',
              }}
              dangerouslySetInnerHTML={{
                __html: renderContentWithFurigana(novel.Content, novel.Vocabulary),
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #eee',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: '#f8f9fa',
          }}
        >
          <button
            onClick={onClose}
            disabled={isSaving}
            style={{
              height: '38px',
              padding: '0 20px',
              backgroundColor: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              color: '#475569',
              fontSize: '14px',
              fontWeight: '500',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseOver={(e) => {
              if (!isSaving) e.currentTarget.style.backgroundColor = '#f1f5f9'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'white'
            }}
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              height: '38px',
              padding: '0 24px',
              backgroundColor: '#007bff',
              border: 'none',
              borderRadius: '8px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isSaving ? 0.7 : 1,
              transition: 'background-color 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseOver={(e) => {
              if (!isSaving) e.currentTarget.style.backgroundColor = '#0056b3'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#007bff'
            }}
          >
            {isSaving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default NovelPreviewModal

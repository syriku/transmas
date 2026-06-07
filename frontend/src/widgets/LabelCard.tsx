import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TagInstance } from './ImagePreviewer'

const RAINBOW_COLORS = [
  '#fca5a5', // Pastel Red
  '#fdba74', // Pastel Orange
  '#fde047', // Pastel Yellow
  '#86efac', // Pastel Green
  '#93c5fd', // Pastel Blue
  '#c084fc', // Pastel Indigo/Purple
  '#f472b6', // Pastel Pink/Violet
]

interface LabelCardProps {
  tag: TagInstance
  index: number
  isExpanded: boolean
  onExpand: () => void
  onUpdate: (fields: Partial<TagInstance>) => Promise<void>
  tags: string[]
  translateTag: (tag: string) => string
}

export const LabelCard: React.FC<LabelCardProps> = ({
  tag,
  index,
  isExpanded,
  onExpand,
  onUpdate,
  tags,
  translateTag,
}) => {
  const { t } = useTranslation()
  const [editText, setEditText] = useState(tag.text || '')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const textRef = useRef<HTMLSpanElement>(null)
  const hoverTimeoutRef = useRef<any>(null)

  useEffect(() => {
    setEditText(tag.text || '')
  }, [tag.text])

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus()
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [isExpanded])

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  const handleSave = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSaving(true)
    try {
      await onUpdate({ text: editText })
      onExpand()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditText(tag.text || '')
    onExpand()
  }

  const handleToggleReviewed = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const fields: Partial<TagInstance> = { reviewed: !tag.reviewed }
    if (isExpanded) {
      fields.text = editText
    }
    await onUpdate(fields)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return

    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault()
        handleSave()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditText(tag.text || '')
      onExpand()
    }
  }

  const handleMouseEnterText = () => {
    if (!isExpanded && textRef.current) {
      const hasOverflow = textRef.current.scrollWidth > textRef.current.clientWidth
      if (hasOverflow && tag.text) {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = setTimeout(() => {
          setShowTooltip(true)
        }, 300) // 0.3s delay
      }
    }
  }

  const handleMouseLeaveText = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setShowTooltip(false)
  }

  const badgeColor = RAINBOW_COLORS[tag.tagIndex % RAINBOW_COLORS.length]
  const tagName = tags[tag.tagIndex] ? translateTag(tags[tag.tagIndex]) : `Tag ${tag.tagIndex + 1}`

  const textColor = tag.reviewed ? '#0f172a' : '#64748b'
  const textWeight = tag.reviewed ? '600' : '400'

  return (
    <div
      id={`label-card-${tag.id}`}
      onClick={onExpand}
      style={{
        backgroundColor: '#ffffff',
        border: isExpanded ? '1px solid #3b82f6' : '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '12px 16px',
        cursor: 'pointer',
        boxShadow: isExpanded
          ? '0 4px 12px rgba(59, 130, 246, 0.15)'
          : '0 2px 4px rgba(0, 0, 0, 0.02)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: isExpanded ? '12px' : '0',
        position: 'relative',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isExpanded) {
          e.currentTarget.style.borderColor = '#cbd5e1'
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.04)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isExpanded) {
          e.currentTarget.style.borderColor = '#e2e8f0'
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.02)'
        }
      }}
    >
      {showTooltip && tag.text && (
        <div
          style={{
            position: 'absolute',
            ...(index === 0
              ? {
                  top: '100%',
                  bottom: 'auto',
                  transform: 'translateX(-50%) translateY(6px)',
                }
              : {
                  bottom: '100%',
                  top: 'auto',
                  transform: 'translateX(-50%) translateY(-6px)',
                }),
            left: '50%',
            backgroundColor: '#1e293b',
            color: '#ffffff',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            whiteSpace: 'normal',
            wordBreak: 'break-all',
            maxWidth: '220px',
            zIndex: 100,
            pointerEvents: 'none',
            lineHeight: '1.4',
            textAlign: 'left',
          }}
        >
          {tag.text}
          <div
            style={{
              position: 'absolute',
              ...(index === 0
                ? {
                    bottom: '100%',
                    top: 'auto',
                    borderTop: 'none',
                    borderBottom: '5px solid #1e293b',
                  }
                : {
                    top: '100%',
                    bottom: 'auto',
                    borderBottom: 'none',
                    borderTop: '5px solid #1e293b',
                  }),
              left: '50%',
              transform: 'translateX(-50%)',
              width: '0',
              height: '0',
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
            }}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: badgeColor,
              color: '#1b2636',
              fontSize: '11px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #ffffff',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              flexShrink: 0,
            }}
          >
            {index + 1}
          </div>

          <span
            style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#475569',
              backgroundColor: '#f1f5f9',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              flexShrink: 0,
            }}
            title={tagName}
          >
            {tagName}
          </span>

          {!isExpanded && (
            <span
              ref={textRef}
              onMouseEnter={handleMouseEnterText}
              onMouseLeave={handleMouseLeaveText}
              style={{
                fontSize: '13px',
                color: textColor,
                fontWeight: textWeight,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginLeft: '4px',
                flex: 1,
                minWidth: 0,
              }}
            >
              {tag.text ? (
                tag.text
              ) : (
                <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>
                  {t('untranslated', '(未翻译)')}
                </span>
              )}
            </span>
          )}
        </div>

        <button
          onClick={handleToggleReviewed}
          title={tag.reviewed ? t('unmarkReviewed', '取消校对') : t('markReviewed', '标记为已校对')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
            color: tag.reviewed ? '#10b981' : '#94a3b8',
            backgroundColor: tag.reviewed ? '#ecfdf5' : 'transparent',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = tag.reviewed ? '#d1fae5' : '#f1f5f9'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = tag.reviewed ? '#ecfdf5' : 'transparent'
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('enterTranslation', '输入翻译文本...')}
            rows={3}
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: '13px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: '1.4',
              backgroundColor: '#fff',
              color: '#1e293b',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#3b82f6'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1'
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={handleCancel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '28px',
                padding: '0 12px',
                fontSize: '12px',
                fontWeight: '500',
                color: '#64748b',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e2e8f0'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9'
              }}
            >
              {t('cancel', '取消')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '28px',
                padding: '0 12px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#ffffff',
                backgroundColor: '#3b82f6',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                opacity: saving ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6'
              }}
            >
              {saving ? t('saving', '保存中...') : t('save', '保存')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
export default LabelCard

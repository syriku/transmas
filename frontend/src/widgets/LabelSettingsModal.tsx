import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GetGlossary,
  UpdateGlossary,
  GetChapterTags,
  SetChapterTags,
} from '../../bindings/github.com/syriku/transmas/service/agentservice'
import { GlossaryEntry } from '../../bindings/github.com/syriku/aisdk/request/models'
import ModalWrapper from './ModalWrapper'
import SettingItemCard from './SettingItemCard'

interface Props {
  projectName: string
  chapterOrder: number
  tags: string[]
  onSaveTags: (tags: string[]) => void
  onClose: () => void
}

const LabelSettingsModal: React.FC<Props> = ({
  projectName,
  chapterOrder,
  tags,
  onSaveTags,
  onClose,
}) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'glossary' | 'tags'>('glossary')
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([])
  const [localTags, setLocalTags] = useState<string[]>(() =>
    tags.map((tag) => {
      if (tag === 'inside') return t('tagInside', 'Inside')
      if (tag === 'outside') return t('tagOutside', 'Outside')
      return tag
    }),
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([GetGlossary(projectName), GetChapterTags(projectName, chapterOrder)])
      .then(([glossaryData, tagsData]) => {
        setGlossary(glossaryData || [])
        // Map backend raw tags to display tags
        const displayTags = (tagsData || []).map((tag) => {
          if (tag === 'inside') return t('tagInside', 'Inside')
          if (tag === 'outside') return t('tagOutside', 'Outside')
          return tag
        })
        setLocalTags(displayTags)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load settings data:', err)
        setLoading(false)
      })
  }, [projectName, chapterOrder, t])

  const handleSave = async () => {
    // Clean and validate tags, mapping them back to raw values
    const cleaned = localTags
      .map((tVal) => {
        const trimmed = tVal.trim()
        if (trimmed === t('tagInside', 'Inside') || trimmed === 'Inside' || trimmed === '框内') {
          return 'inside'
        }
        if (trimmed === t('tagOutside', 'Outside') || trimmed === 'Outside' || trimmed === '框外') {
          return 'outside'
        }
        return trimmed
      })
      .filter(Boolean)

    const unique = Array.from(new Set(cleaned))

    if (unique.length === 0) {
      alert(t('lastTagWarning', 'At least one tag is required'))
      return
    }
    if (unique.length > 7) {
      alert(t('maxTagsWarning', 'Maximum of 7 tags is allowed'))
      return
    }

    setSaving(true)
    try {
      await Promise.all([
        UpdateGlossary(projectName, glossary),
        SetChapterTags(projectName, chapterOrder, unique),
      ])
      onSaveTags(unique)
      onClose()
    } catch (err: any) {
      alert(t('failedToSave', '保存失败: ') + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddGlossary = () => {
    const entry = new GlossaryEntry()
    entry.source = ''
    entry.target = ''
    entry.note = ''
    setGlossary([...glossary, entry])
  }

  const handleDeleteGlossary = (index: number) => {
    setGlossary(glossary.filter((_, i) => i !== index))
  }

  const handleChangeGlossary = (index: number, field: keyof GlossaryEntry, value: any) => {
    const updated = [...glossary]
    updated[index] = { ...updated[index], [field]: value } as GlossaryEntry
    setGlossary(updated)
  }

  const handleAddTag = () => {
    if (localTags.length >= 7) return
    setLocalTags([...localTags, ''])
  }

  const handleDeleteTag = (index: number) => {
    if (localTags.length <= 1) {
      alert(t('lastTagWarning', 'At least one tag is required'))
      return
    }
    setLocalTags(localTags.filter((_, i) => i !== index))
  }

  const handleChangeTag = (index: number, value: string) => {
    const updated = [...localTags]
    updated[index] = value
    setLocalTags(updated)
  }

  return (
    <ModalWrapper title={t('settings')} onClose={onClose} onSave={handleSave} saving={saving}>
      {loading ? (
        <p style={{ textAlign: 'center' }}>{t('loading')}</p>
      ) : (
        <div>
          {/* Tab Headers */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid #eee',
              marginBottom: '20px',
              paddingBottom: '8px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('glossary')}
              style={{
                width: 'auto',
                height: 'auto',
                lineHeight: 'normal',
                margin: '0',
                whiteSpace: 'nowrap',
                padding: '8px 16px',
                border: 'none',
                background: 'none',
                borderBottom:
                  activeTab === 'glossary' ? '2px solid #007bff' : '2px solid transparent',
                color: activeTab === 'glossary' ? '#007bff' : '#666',
                fontWeight: activeTab === 'glossary' ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.2s',
              }}
            >
              {t('glossary')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tags')}
              style={{
                width: 'auto',
                height: 'auto',
                lineHeight: 'normal',
                margin: '0',
                whiteSpace: 'nowrap',
                padding: '8px 16px',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === 'tags' ? '2px solid #007bff' : '2px solid transparent',
                color: activeTab === 'tags' ? '#007bff' : '#666',
                fontWeight: activeTab === 'tags' ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.2s',
              }}
            >
              {t('tagManagement')}
            </button>
          </div>

          {/* Tab Contents */}
          {activeTab === 'glossary' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {glossary.map((entry, i) => (
                <SettingItemCard key={i} onDelete={() => handleDeleteGlossary(i)}>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        flex: '1 1 200px',
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                        {t('source')}
                      </span>
                      <input
                        type="text"
                        value={entry.source}
                        onChange={(e) => handleChangeGlossary(i, 'source', e.target.value)}
                        style={{
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #ddd',
                          boxSizing: 'border-box',
                          width: '100%',
                        }}
                      />
                    </label>
                    <label
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        flex: '1 1 200px',
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                        {t('target')}
                      </span>
                      <input
                        type="text"
                        value={entry.target}
                        onChange={(e) => handleChangeGlossary(i, 'target', e.target.value)}
                        style={{
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #ddd',
                          boxSizing: 'border-box',
                          width: '100%',
                        }}
                      />
                    </label>
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                      {t('note')}
                    </span>
                    <textarea
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        boxSizing: 'border-box',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                      value={entry.note}
                      onChange={(e) => handleChangeGlossary(i, 'note', e.target.value)}
                    />
                  </label>
                </SettingItemCard>
              ))}
              <div
                onClick={handleAddGlossary}
                style={{
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  border: '2px dashed #ccc',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#666',
                  transition: 'all 0.2s',
                  marginTop: '10px',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              >
                {t('addEntry')}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {localTags.map((tag, i) => (
                <SettingItemCard key={i} onDelete={() => handleDeleteTag(i)}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                      {t('tag')} #{i + 1}
                    </span>
                    <input
                      type="text"
                      value={tag}
                      placeholder={t('tagPlaceholder')}
                      onChange={(e) => handleChangeTag(i, e.target.value)}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #ddd',
                        boxSizing: 'border-box',
                        width: '100%',
                      }}
                    />
                  </label>
                </SettingItemCard>
              ))}
              {localTags.length < 7 && (
                <div
                  onClick={handleAddTag}
                  style={{
                    padding: '16px',
                    backgroundColor: '#f8f9fa',
                    border: '2px dashed #ccc',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: '#666',
                    transition: 'all 0.2s',
                    marginTop: '10px',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  {t('addTag')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ModalWrapper>
  )
}

export default LabelSettingsModal

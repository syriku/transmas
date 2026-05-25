import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GetGlossary,
  UpdateGlossary,
} from '../../bindings/github.com/syriku/transmas/service/agentservice'
import { GlossaryEntry } from '../../bindings/github.com/syriku/aisdk/request/models'
import ModalWrapper from './ModalWrapper'
import SettingItemCard from './SettingItemCard'

interface Props {
  projectName: string
  onClose: () => void
}

const GlossaryModal: React.FC<Props> = ({ projectName, onClose }) => {
  const { t } = useTranslation()
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    GetGlossary(projectName)
      .then((list) => {
        setGlossary(list || [])
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [projectName])

  const handleSave = async () => {
    setSaving(true)
    try {
      await UpdateGlossary(projectName, glossary)
      onClose()
    } catch (err: any) {
      alert(t('failedToSave') + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = () => {
    const entry = new GlossaryEntry()
    entry.source = ''
    entry.target = ''
    entry.note = ''
    setGlossary([...glossary, entry])
  }

  const handleDelete = (index: number) => {
    setGlossary(glossary.filter((_, i) => i !== index))
  }

  const handleChange = (index: number, field: keyof GlossaryEntry, value: any) => {
    const updated = [...glossary]
    updated[index] = { ...updated[index], [field]: value } as GlossaryEntry
    setGlossary(updated)
  }

  return (
    <ModalWrapper
      title={t('glossarySettings', { projectName })}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
    >
      {loading ? (
        <p style={{ textAlign: 'center' }}>{t('loading')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {glossary.map((entry, i) => (
            <SettingItemCard key={i} onDelete={() => handleDelete(i)}>
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
                    onChange={(e) => handleChange(i, 'source', e.target.value)}
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
                    onChange={(e) => handleChange(i, 'target', e.target.value)}
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
                  onChange={(e) => handleChange(i, 'note', e.target.value)}
                />
              </label>
            </SettingItemCard>
          ))}
          <div
            onClick={handleAdd}
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
      )}
    </ModalWrapper>
  )
}
export default GlossaryModal

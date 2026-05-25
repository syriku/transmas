import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GetGlossary,
  UpdateGlossary,
  GetProjectAiConfigKey,
  UpdateProjectAiConfigKey,
  GetProjectTranslatorKey,
  UpdateProjectTranslatorKey,
  GetAiConfig,
  GetTranslators,
} from '../../bindings/github.com/syriku/transmas/service/agentservice'
import { GlossaryEntry } from '../../bindings/github.com/syriku/aisdk/request/models'
import ModalWrapper from './ModalWrapper'
import SettingItemCard from './SettingItemCard'

interface Props {
  projectName: string
  workDir: string
  onSelectWorkDir: () => void
  onClose: () => void
}

const ProjectSettingsModal: React.FC<Props> = ({
  projectName,
  workDir,
  onSelectWorkDir,
  onClose,
}) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'project' | 'glossary'>('project')
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([])
  const [aiConfigKey, setAiConfigKey] = useState('')
  const [translatorKey, setTranslatorKey] = useState('')
  const [aiConfigs, setAiConfigs] = useState<string[]>([])
  const [translators, setTranslators] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      GetGlossary(projectName),
      GetProjectAiConfigKey(projectName),
      GetProjectTranslatorKey(projectName),
      GetAiConfig(),
      GetTranslators(),
    ])
      .then(([glossaryData, aiKey, transKey, allAiConfigs, allTranslators]) => {
        setGlossary(glossaryData || [])
        setAiConfigKey(aiKey || '')
        setTranslatorKey(transKey || '')
        setAiConfigs(Object.keys(allAiConfigs || {}))
        setTranslators(Object.keys(allTranslators || {}))
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
      await Promise.all([
        UpdateGlossary(projectName, glossary),
        UpdateProjectAiConfigKey(projectName, aiConfigKey),
        UpdateProjectTranslatorKey(projectName, translatorKey),
      ])
      onClose()
    } catch (err: any) {
      alert(t('failedToSave') + err.message)
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

  return (
    <ModalWrapper
      title={t('projectSettings', { projectName })}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
    >
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
              onClick={() => setActiveTab('project')}
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
                  activeTab === 'project' ? '2px solid #007bff' : '2px solid transparent',
                color: activeTab === 'project' ? '#007bff' : '#666',
                fontWeight: activeTab === 'project' ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.2s',
              }}
            >
              {t('projectSettingsTab')}
            </button>
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
          </div>

          {/* Tab Contents */}
          {activeTab === 'project' ? (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                  {t('workDirectory')}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    readOnly
                    type="text"
                    value={workDir}
                    placeholder={t('notSet')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ddd',
                      backgroundColor: '#fafafa',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={onSelectWorkDir}
                    style={{
                      height: '38px',
                      minWidth: '80px',
                      width: 'auto',
                      padding: '0 16px',
                      backgroundColor: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      color: '#333',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = '#007bff'
                      e.currentTarget.style.color = '#007bff'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = '#ddd'
                      e.currentTarget.style.color = '#333'
                    }}
                  >
                    {t('browse')}
                  </button>
                </div>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                  {t('selectAiConfig')}
                </span>
                <select
                  value={aiConfigKey}
                  onChange={(e) => setAiConfigKey(e.target.value)}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    boxSizing: 'border-box',
                    width: '100%',
                    backgroundColor: 'white',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                >
                  <option value="">{t('selectNone')}</option>
                  {aiConfigs.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {aiConfigs.length === 0 && (
                  <span style={{ fontSize: '12px', color: '#888' }}>
                    {t('noAiConfigAvailable')}
                  </span>
                )}
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                  {t('selectTranslator')}
                </span>
                <select
                  value={translatorKey}
                  onChange={(e) => setTranslatorKey(e.target.value)}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    boxSizing: 'border-box',
                    width: '100%',
                    backgroundColor: 'white',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                >
                  <option value="">{t('selectNone')}</option>
                  {translators.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {translators.length === 0 && (
                  <span style={{ fontSize: '12px', color: '#888' }}>
                    {t('noTranslatorAvailable')}
                  </span>
                )}
              </label>
            </div>
          ) : (
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
          )}
        </div>
      )}
    </ModalWrapper>
  )
}

export default ProjectSettingsModal

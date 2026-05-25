import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GetTranslators,
  UpdateTranslators,
} from '../../bindings/github.com/syriku/transmas/service/agentservice'
import { GetLanguagesMap } from '../../bindings/github.com/syriku/transmas/service/systemservice'
import { Translator } from '../../bindings/github.com/syriku/aisdk/request/models'
import ModalWrapper from './ModalWrapper'
import SettingItemCard from './SettingItemCard'

interface Props {
  onClose: () => void
}

const TranslatorsModal: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<{ key: string; translator: Translator }[]>([])
  const [languages, setLanguages] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([GetTranslators(), GetLanguagesMap()])
      .then(([data, langs]) => {
        const list = Object.entries(data || {}).map(([key, trans]) => ({
          key,
          translator: trans ?? new Translator(),
        }))
        setEntries(list)
        setLanguages((langs as Record<number, string>) || {})
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const translatorsMap: Record<string, Translator> = {}
      for (const { key, translator } of entries) {
        if (key.trim()) {
          translatorsMap[key.trim()] = translator
        }
      }
      await UpdateTranslators(translatorsMap)
      onClose()
    } catch (err: any) {
      alert(t('failedToSave') + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = () => {
    const newTranslator = new Translator()
    newTranslator.source_lang = 0
    newTranslator.target_lang = 0
    newTranslator.style_prompt = ''
    newTranslator.template = ''
    setEntries([...entries, { key: '', translator: newTranslator }])
  }

  const handleDelete = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index))
  }

  const handleChangeKey = (index: number, newKey: string) => {
    const updated = [...entries]
    updated[index] = { ...updated[index], key: newKey }
    setEntries(updated)
  }

  const handleChangeTranslator = (index: number, field: keyof Translator, value: any) => {
    const updated = [...entries]
    updated[index] = {
      ...updated[index],
      translator: { ...updated[index].translator, [field]: value } as Translator,
    }
    setEntries(updated)
  }

  return (
    <ModalWrapper
      title={t('translatorsSettings')}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
    >
      {loading ? (
        <p style={{ textAlign: 'center' }}>{t('loading')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {entries.map(({ key, translator }, i) => (
            <SettingItemCard key={i} onDelete={() => handleDelete(i)}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                  {t('translatorName')}
                </span>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => handleChangeKey(i, e.target.value)}
                  placeholder={t('translatorNamePlaceholder')}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    boxSizing: 'border-box',
                    width: '100%',
                    outline: 'none',
                  }}
                />
              </label>
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
                    {t('sourceLanguage')}
                  </span>
                  <select
                    value={translator.source_lang}
                    onChange={(e) =>
                      handleChangeTranslator(i, 'source_lang', parseInt(e.target.value, 10))
                    }
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ddd',
                      boxSizing: 'border-box',
                      width: '100%',
                      backgroundColor: 'white',
                    }}
                  >
                    <option value={-1}>{t('unknown')}</option>
                    {Object.entries(languages).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
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
                    {t('targetLanguage')}
                  </span>
                  <select
                    value={translator.target_lang}
                    onChange={(e) =>
                      handleChangeTranslator(i, 'target_lang', parseInt(e.target.value, 10))
                    }
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ddd',
                      boxSizing: 'border-box',
                      width: '100%',
                      backgroundColor: 'white',
                    }}
                  >
                    <option value={-1}>{t('unknown')}</option>
                    {Object.entries(languages).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                  {t('stylePrompt')}
                </span>
                <textarea
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    boxSizing: 'border-box',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                  value={translator.style_prompt}
                  onChange={(e) => handleChangeTranslator(i, 'style_prompt', e.target.value)}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                  {t('template')}
                </span>
                <textarea
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    boxSizing: 'border-box',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                  value={translator.template}
                  onChange={(e) => handleChangeTranslator(i, 'template', e.target.value)}
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
            {t('addTranslator')}
          </div>
        </div>
      )}
    </ModalWrapper>
  )
}
export default TranslatorsModal

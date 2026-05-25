import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GetAiConfig,
  UpdateAiConfig,
} from '../../bindings/github.com/syriku/transmas/service/agentservice'
import { UserConfig } from '../../bindings/github.com/syriku/aisdk/api/models'
import ModalWrapper from './ModalWrapper'
import SettingItemCard from './SettingItemCard'

interface Props {
  onClose: () => void
}

const API_TYPE_OPEN_AI = 0
const API_TYPE_CLAUDE = 1

const AiConfigModal: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<{ key: string; config: UserConfig }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    GetAiConfig()
      .then((data) => {
        const list = Object.entries(data || {}).map(([key, config]) => ({
          key,
          config: config ?? new UserConfig(),
        }))
        setEntries(list)
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
      const aiConfig: { [key: string]: UserConfig } = {}
      for (const { key, config } of entries) {
        if (key.trim()) {
          aiConfig[key.trim()] = config
        }
      }
      await UpdateAiConfig(aiConfig)
      onClose()
    } catch (err: any) {
      alert(t('failedToSave') + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = () => {
    const newConfig = new UserConfig()
    newConfig.provider = ''
    newConfig.type = API_TYPE_OPEN_AI
    newConfig.api_key = ''
    setEntries([...entries, { key: '', config: newConfig }])
  }

  const handleDelete = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index))
  }

  const handleChangeKey = (index: number, newKey: string) => {
    const updated = [...entries]
    updated[index] = { ...updated[index], key: newKey }
    setEntries(updated)
  }

  const handleChangeConfig = (index: number, field: keyof UserConfig, value: any) => {
    const updated = [...entries]
    updated[index] = {
      ...updated[index],
      config: { ...updated[index].config, [field]: value } as UserConfig,
    }
    setEntries(updated)
  }

  return (
    <ModalWrapper
      title={t('aiConfigSettings')}
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
    >
      {loading ? (
        <p style={{ textAlign: 'center' }}>{t('loading')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {entries.map(({ key, config }, i) => (
            <SettingItemCard key={i} onDelete={() => handleDelete(i)}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                  {t('aiConfigName')}
                </span>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => handleChangeKey(i, e.target.value)}
                  placeholder={t('aiConfigNamePlaceholder')}
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
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                  {t('aiProvider')}
                </span>
                <input
                  type="text"
                  value={config.provider}
                  onChange={(e) => handleChangeConfig(i, 'provider', e.target.value)}
                  placeholder={t('aiProviderPlaceholder')}
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
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                  {t('aiType')}
                </span>
                <select
                  value={config.type}
                  onChange={(e) => handleChangeConfig(i, 'type', parseInt(e.target.value, 10))}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    boxSizing: 'border-box',
                    width: '100%',
                    backgroundColor: 'white',
                  }}
                >
                  <option value={API_TYPE_OPEN_AI}>OpenAI</option>
                  <option value={API_TYPE_CLAUDE}>Claude</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                  {t('aiApiKey')}
                </span>
                <input
                  type="password"
                  value={config.api_key}
                  onChange={(e) => handleChangeConfig(i, 'api_key', e.target.value)}
                  placeholder={t('aiApiKeyPlaceholder')}
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
            {t('addAiConfig')}
          </div>
        </div>
      )}
    </ModalWrapper>
  )
}

export default AiConfigModal

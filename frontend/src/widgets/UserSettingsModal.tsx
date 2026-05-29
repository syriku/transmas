import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GetTranslators,
  UpdateTranslators,
  GetAiConfig,
  UpdateAiConfig,
  GetWebExtensionEnabled,
  SetWebExtensionEnabled,
} from '../../bindings/github.com/syriku/transmas/service/agentservice'
import { GetLanguagesMap } from '../../bindings/github.com/syriku/transmas/service/systemservice'
import { Translator } from '../../bindings/github.com/syriku/aisdk/request/models'
import { UserConfig } from '../../bindings/github.com/syriku/aisdk/api/models'
import ModalWrapper from './ModalWrapper'
import SettingItemCard from './SettingItemCard'

interface Props {
  onClose: () => void
}

const API_TYPE_OPEN_AI = 0
const API_TYPE_CLAUDE = 1

const UserSettingsModal: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'translators' | 'aiconfig' | 'system'>('translators')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Translators tab states
  const [translators, setTranslators] = useState<{ key: string; translator: Translator }[]>([])
  const [languages, setLanguages] = useState<Record<number, string>>({})

  // AI Config tab states
  const [aiConfigs, setAiConfigs] = useState<{ key: string; config: UserConfig }[]>([])

  // System Settings tab states
  const [webExtensionEnabled, setWebExtensionEnabled] = useState(false)

  useEffect(() => {
    Promise.all([GetTranslators(), GetLanguagesMap(), GetAiConfig(), GetWebExtensionEnabled()])
      .then(([transData, langs, aiData, webEnabled]) => {
        const transList = Object.entries(transData || {}).map(([key, trans]) => ({
          key,
          translator: trans ?? new Translator(),
        }))
        setTranslators(transList)
        setLanguages((langs as Record<number, string>) || {})

        const aiList = Object.entries(aiData || {}).map(([key, config]) => ({
          key,
          config: config ?? new UserConfig(),
        }))
        setAiConfigs(aiList)
        setWebExtensionEnabled(webEnabled || false)

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
      // 1. Prepare and validate translators
      const translatorsMap: Record<string, Translator> = {}
      for (const { key, translator } of translators) {
        if (key.trim()) {
          translatorsMap[key.trim()] = translator
        }
      }

      // 2. Prepare and validate AI configs
      const aiConfigMap: Record<string, UserConfig> = {}
      for (const { key, config } of aiConfigs) {
        if (key.trim()) {
          aiConfigMap[key.trim()] = config
        }
      }

      // 3. Save all changes
      await Promise.all([
        UpdateTranslators(translatorsMap),
        UpdateAiConfig(aiConfigMap),
        SetWebExtensionEnabled(webExtensionEnabled),
      ])
      onClose()
    } catch (err: any) {
      alert(t('failedToSave') + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Translator operations
  const handleAddTranslator = () => {
    const newTranslator = new Translator()
    newTranslator.source_lang = 0
    newTranslator.target_lang = 0
    newTranslator.style_prompt = ''
    newTranslator.template = ''
    setTranslators([...translators, { key: '', translator: newTranslator }])
  }

  const handleDeleteTranslator = (index: number) => {
    setTranslators(translators.filter((_, i) => i !== index))
  }

  const handleChangeTranslatorKey = (index: number, newKey: string) => {
    const updated = [...translators]
    updated[index] = { ...updated[index], key: newKey }
    setTranslators(updated)
  }

  const handleChangeTranslatorField = (index: number, field: keyof Translator, value: any) => {
    const updated = [...translators]
    updated[index] = {
      ...updated[index],
      translator: { ...updated[index].translator, [field]: value } as Translator,
    }
    setTranslators(updated)
  }

  // AI Config operations
  const handleAddAiConfig = () => {
    const newConfig = new UserConfig()
    newConfig.provider = ''
    newConfig.type = API_TYPE_OPEN_AI
    newConfig.api_key = ''
    setAiConfigs([...aiConfigs, { key: '', config: newConfig }])
  }

  const handleDeleteAiConfig = (index: number) => {
    setAiConfigs(aiConfigs.filter((_, i) => i !== index))
  }

  const handleChangeAiConfigKey = (index: number, newKey: string) => {
    const updated = [...aiConfigs]
    updated[index] = { ...updated[index], key: newKey }
    setAiConfigs(updated)
  }

  const handleChangeAiConfigField = (index: number, field: keyof UserConfig, value: any) => {
    const updated = [...aiConfigs]
    updated[index] = {
      ...updated[index],
      config: { ...updated[index].config, [field]: value } as UserConfig,
    }
    setAiConfigs(updated)
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
              onClick={() => setActiveTab('translators')}
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
                  activeTab === 'translators' ? '2px solid #007bff' : '2px solid transparent',
                color: activeTab === 'translators' ? '#007bff' : '#666',
                fontWeight: activeTab === 'translators' ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.2s',
              }}
            >
              {t('translators')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('aiconfig')}
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
                  activeTab === 'aiconfig' ? '2px solid #007bff' : '2px solid transparent',
                color: activeTab === 'aiconfig' ? '#007bff' : '#666',
                fontWeight: activeTab === 'aiconfig' ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.2s',
              }}
            >
              {t('aiConfig')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('system')}
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
                  activeTab === 'system' ? '2px solid #007bff' : '2px solid transparent',
                color: activeTab === 'system' ? '#007bff' : '#666',
                fontWeight: activeTab === 'system' ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.2s',
              }}
            >
              {t('systemSettings')}
            </button>
          </div>

          {/* Tab Contents */}
          {activeTab === 'translators' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {translators.map(({ key, translator }, i) => (
                <SettingItemCard key={i} onDelete={() => handleDeleteTranslator(i)}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                      {t('translatorName')}
                    </span>
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => handleChangeTranslatorKey(i, e.target.value)}
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
                          handleChangeTranslatorField(
                            i,
                            'source_lang',
                            parseInt(e.target.value, 10),
                          )
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
                          handleChangeTranslatorField(
                            i,
                            'target_lang',
                            parseInt(e.target.value, 10),
                          )
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
                      onChange={(e) =>
                        handleChangeTranslatorField(i, 'style_prompt', e.target.value)
                      }
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
                      onChange={(e) => handleChangeTranslatorField(i, 'template', e.target.value)}
                    />
                  </label>
                </SettingItemCard>
              ))}
              <div
                onClick={handleAddTranslator}
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

          {activeTab === 'aiconfig' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {aiConfigs.map(({ key, config }, i) => (
                <SettingItemCard key={i} onDelete={() => handleDeleteAiConfig(i)}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>
                      {t('aiConfigName')}
                    </span>
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => handleChangeAiConfigKey(i, e.target.value)}
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
                      onChange={(e) => handleChangeAiConfigField(i, 'provider', e.target.value)}
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
                      onChange={(e) =>
                        handleChangeAiConfigField(i, 'type', parseInt(e.target.value, 10))
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
                      onChange={(e) => handleChangeAiConfigField(i, 'api_key', e.target.value)}
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
                onClick={handleAddAiConfig}
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

          {activeTab === 'system' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                padding: '24px',
                border: '1px solid #ddd',
                borderRadius: '12px',
                backgroundColor: '#fff',
                boxSizing: 'border-box',
              }}
            >
              <div
                onClick={() => setWebExtensionEnabled(!webExtensionEnabled)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                  {t('enableWebExtension')}
                </span>
                <div
                  style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: webExtensionEnabled ? '#007bff' : '#ccc',
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
                      left: webExtensionEnabled ? '18px' : '2px',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ModalWrapper>
  )
}

export default UserSettingsModal

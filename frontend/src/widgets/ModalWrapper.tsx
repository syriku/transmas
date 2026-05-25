import React, { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  title: string
  onClose: () => void
  onSave: () => void
  saving: boolean
  children: ReactNode
}

const ModalWrapper: React.FC<Props> = ({ title, onClose, onSave, saving, children }) => {
  const { t } = useTranslation()

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '16px',
          width: '80%',
          maxWidth: '800px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px', flexShrink: 0, textAlign: 'center' }}>
          {title}
        </h2>
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>{children}</div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '24px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0 16px',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'auto',
              height: '36px',
              margin: '0',
              whiteSpace: 'nowrap',
              fontSize: '15px',
              fontWeight: '500',
              lineHeight: '1',
            }}
          >
            {t('cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              padding: '0 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'auto',
              height: '36px',
              margin: '0',
              whiteSpace: 'nowrap',
              fontSize: '15px',
              fontWeight: '500',
              lineHeight: '1',
            }}
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalWrapper

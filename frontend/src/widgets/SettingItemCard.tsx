import React, { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  onDelete: () => void
  children: ReactNode
}

const SettingItemCard: React.FC<Props> = ({ onDelete, children }) => {
  const { t } = useTranslation()

  return (
    <div
      style={{
        border: '1px solid #ddd',
        padding: '24px',
        paddingTop: '36px',
        borderRadius: '12px',
        position: 'relative',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        backgroundColor: '#fff',
      }}
    >
      <button
        onClick={onDelete}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          color: '#dc3545',
          backgroundColor: 'transparent',
          border: '1px solid #dc3545',
          borderRadius: '4px',
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 'bold',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 'auto',
          height: 'auto',
          margin: '0',
          whiteSpace: 'nowrap',
        }}
      >
        {t('delete')}
      </button>
      {children}
    </div>
  )
}

export default SettingItemCard

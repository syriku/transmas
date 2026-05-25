import React, { useState } from 'react'

interface ItemCardProps {
  title: string
  hoverTitle?: string
  onClick: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  isAdd?: boolean
  addText?: string
  status?: number
}

const ItemCard: React.FC<ItemCardProps> = ({
  title,
  hoverTitle,
  onClick,
  onContextMenu,
  isAdd = false,
  addText = 'Add Item',
  status,
}) => {
  const handleClick = (_e: React.MouseEvent) => {
    console.log('ItemCard clicked', { title, isAdd })
    onClick()
  }

  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      onClick={handleClick}
      onContextMenu={onContextMenu}
      style={{
        width: '180px',
        height: '260px',
        backgroundColor: isAdd ? 'transparent' : 'white',
        border: isAdd ? '2px dashed #ccc' : '1px solid #ddd',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: '20px',
        boxSizing: 'border-box',
        boxShadow: isAdd ? 'none' : '0 4px 12px rgba(0,0,0,0.05)',
        transition: 'all 0.2s',
        textAlign: 'center',
        position: 'relative',
        outline:
          !isAdd && status === 2
            ? '2px solid #8ee3b4'
            : !isAdd && status === 1
              ? '2px solid #a5d8ff'
              : 'none',
        outlineOffset: '1px',
      }}
      onMouseOver={(e) => {
        setIsHovered(true)
        e.currentTarget.style.transform = 'translateY(-5px)'
        if (!isAdd) {
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'
        } else {
          e.currentTarget.style.borderColor = '#007bff'
        }
      }}
      onMouseOut={(e) => {
        setIsHovered(false)
        e.currentTarget.style.transform = 'translateY(0)'
        if (!isAdd) {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
        } else {
          e.currentTarget.style.borderColor = '#ccc'
        }
      }}
    >
      {!isAdd && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '10px',
            background: 'linear-gradient(to right, rgba(0,0,0,0.1), transparent)',
            borderRight: '1px solid rgba(0,0,0,0.05)',
            borderTopLeftRadius: '12px',
            borderBottomLeftRadius: '12px',
          }}
        />
      )}
      <div style={{ pointerEvents: 'none', width: '100%' }}>
        {isAdd ? (
          <>
            <div style={{ fontSize: '40px', color: '#ccc', marginBottom: '10px' }}>+</div>
            <div style={{ color: '#666', fontWeight: '500' }}>{addText}</div>
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: '20px',
                fontWeight: '700',
                fontStyle: 'italic',
                color: '#2c3e50',
                wordBreak: 'break-word',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 5,
                WebkitBoxOrient: 'vertical',
                lineHeight: '1.4',
              }}
            >
              {title}
            </div>
          </>
        )}
      </div>
      {hoverTitle && !isAdd && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            opacity: isHovered ? 1 : 0,
            visibility: isHovered ? 'visible' : 'hidden',
            transition: 'opacity 0.2s ease, visibility 0.2s ease',
            zIndex: 10,
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#333',
              wordBreak: 'break-word',
              textAlign: 'center',
            }}
          >
            {hoverTitle}
          </div>
        </div>
      )}
    </div>
  )
}

export default ItemCard

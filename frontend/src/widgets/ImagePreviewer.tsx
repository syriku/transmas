import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

export interface ImagePreviewerRef {
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

export interface TagInstance {
  id: string
  tagIndex: number
  x: number // 0 to 1
  y: number // 0 to 1
  text?: string
  translated?: boolean
  reviewed?: boolean
}

interface ImagePreviewerProps {
  imageUrl: string
  loading: boolean
  tags?: string[]
  activeTagIndex?: number
  tagInstances?: TagInstance[]
  onAddTag?: (x: number, y: number) => void
  onMoveTag?: (id: string, x: number, y: number) => void
  onDeleteTag?: (id: string) => void
  onTagClick?: (tag: TagInstance) => void
  onTagHover?: (tag: TagInstance) => void
}

const RAINBOW_COLORS = [
  '#fca5a5', // Pastel Red
  '#fdba74', // Pastel Orange
  '#fde047', // Pastel Yellow
  '#86efac', // Pastel Green
  '#93c5fd', // Pastel Blue
  '#c084fc', // Pastel Indigo/Purple
  '#f472b6', // Pastel Pink/Violet
]

const ImagePreviewer = forwardRef<ImagePreviewerRef, ImagePreviewerProps>(
  (
    {
      imageUrl,
      loading,
      tags,
      activeTagIndex,
      tagInstances = [],
      onAddTag,
      onMoveTag,
      onDeleteTag,
      onTagClick,
      onTagHover,
    },
    ref,
  ) => {
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

    const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
    const [fitScale, setFitScale] = useState(1)
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
    const [isHoveringTag, setIsHoveringTag] = useState(false)

    const containerRef = useRef<HTMLDivElement>(null)

    const updateFitScale = (boxW: number, boxH: number, imgW: number, imgH: number) => {
      if (!boxW || !boxH || !imgW || !imgH) return
      const PADDING = 20
      const maxW = boxW - PADDING * 2
      const maxH = boxH - PADDING * 2
      const scale = Math.min(maxW / imgW, maxH / imgH)
      setFitScale(scale)
    }

    // Reset state on imageUrl change
    useEffect(() => {
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setImgSize({ w: 0, h: 0 })
      setFitScale(1)
    }, [imageUrl])

    // ResizeObserver to dynamically update fitScale when container size changes
    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          if (imgSize.w && imgSize.h) {
            updateFitScale(width, height, imgSize.w, imgSize.h)
          }
        }
      })

      observer.observe(container)
      return () => {
        observer.disconnect()
      }
    }, [imgSize])

    const zoomIn = () => {
      setZoom((z) => Math.min(z * 1.2, 8))
    }

    const zoomOut = () => {
      setZoom((z) => Math.max(z / 1.2, 0.15))
    }

    const resetZoom = () => {
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }

    useImperativeHandle(ref, () => ({
      zoomIn,
      zoomOut,
      resetZoom,
    }))

    const mouseDownPos = useRef<{ x: number; y: number } | null>(null)
    const mouseDownTime = useRef<number>(0)

    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return // Left click only
      if (!imageUrl || loading) return
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      mouseDownPos.current = { x: e.clientX, y: e.clientY }
      mouseDownTime.current = Date.now()
    }

    const handleMouseMove = (e: React.MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      }

      if (!isDragging) return
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }

    const handleMouseUp = (e: React.MouseEvent) => {
      setIsDragging(false)
      if (mouseDownPos.current) {
        const dx = Math.abs(e.clientX - mouseDownPos.current.x)
        const dy = Math.abs(e.clientY - mouseDownPos.current.y)
        const duration = Date.now() - mouseDownTime.current

        if (dx < 5 && dy < 5 && duration < 300) {
          handleImageClick(e)
        }
      }
      mouseDownPos.current = null
    }

    const handleMouseLeave = (e: React.MouseEvent) => {
      handleMouseUp(e)
      setMousePos(null)
    }

    const handleImageClick = (e: React.MouseEvent) => {
      if (!containerRef.current || !onAddTag || !imgSize.w || !imgSize.h) return

      const rect = containerRef.current.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      const displayW = imgSize.w * zoom * fitScale
      const displayH = imgSize.h * zoom * fitScale

      const imgLeft = rect.width / 2 + pan.x - displayW / 2
      const imgTop = rect.height / 2 + pan.y - displayH / 2

      const x = (clickX - imgLeft) / displayW
      const y = (clickY - imgTop) / displayH

      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        onAddTag(x, y)
      }
    }

    const handleTagMouseDown = (e: React.MouseEvent, tag: TagInstance) => {
      e.stopPropagation()
      if (e.button !== 0) return // Left click only

      const startX = e.clientX
      const startY = e.clientY
      const startTagX = tag.x
      const startTagY = tag.y
      const startTime = Date.now()

      const displayW = imgSize.w * zoom * fitScale
      const displayH = imgSize.h * zoom * fitScale

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY
        const dnx = dx / displayW
        const dny = dy / displayH
        const newX = Math.max(0, Math.min(1, startTagX + dnx))
        const newY = Math.max(0, Math.min(1, startTagY + dny))

        if (onMoveTag) {
          onMoveTag(tag.id, newX, newY)
        }
      }

      const handleMouseUp = (upEvent: MouseEvent) => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)

        const dx = Math.abs(upEvent.clientX - startX)
        const dy = Math.abs(upEvent.clientY - startY)
        const duration = Date.now() - startTime

        if (dx < 5 && dy < 5 && duration < 300) {
          if (onTagClick) {
            onTagClick(tag)
          }
        }
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    const { t } = useTranslation()

    const translateTagName = (name: string) => {
      if (name === 'inside') return t('tagInside', '框内')
      if (name === 'outside') return t('tagOutside', '框外')
      return name
    }

    const getTagName = (tagIndex: number) => {
      if (tags && tags[tagIndex] !== undefined) {
        return translateTagName(tags[tagIndex])
      }
      return `Tag ${tagIndex + 1}`
    }

    const handleTagMouseEnter = (tag: TagInstance) => {
      setIsHoveringTag(true)
      if (onTagHover) {
        onTagHover(tag)
      }
    }

    const handleTagMouseLeave = () => {
      setIsHoveringTag(false)
    }

    const handleWheel = (e: React.WheelEvent) => {
      if (!imageUrl || loading) return
      const zoomFactor = 1.1
      let newZoom = zoom
      if (e.deltaY < 0) {
        newZoom = Math.min(zoom * zoomFactor, 8)
      } else {
        newZoom = Math.max(zoom / zoomFactor, 0.15)
      }
      setZoom(newZoom)
    }

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      const w = img.naturalWidth
      const h = img.naturalHeight
      setImgSize({ w, h })

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        updateFitScale(rect.width, rect.height, w, h)
      }
    }

    const activeColor =
      activeTagIndex !== undefined
        ? RAINBOW_COLORS[activeTagIndex % RAINBOW_COLORS.length]
        : '#94a3b8'
    let showCursorPreview = false
    let previewLeft = 0
    let previewTop = 0

    if (
      mousePos &&
      !isDragging &&
      !isHoveringTag &&
      imageUrl &&
      !loading &&
      imgSize.w > 0 &&
      containerRef.current
    ) {
      const rect = containerRef.current.getBoundingClientRect()
      const displayW = imgSize.w * zoom * fitScale
      const displayH = imgSize.h * zoom * fitScale
      const imgLeft = rect.width / 2 + pan.x - displayW / 2
      const imgTop = rect.height / 2 + pan.y - displayH / 2

      const relativeX = mousePos.x - imgLeft
      const relativeY = mousePos.y - imgTop

      if (relativeX >= 0 && relativeX <= displayW && relativeY >= 0 && relativeY <= displayH) {
        showCursorPreview = true
        previewLeft = mousePos.x
        previewTop = mousePos.y
      }
    }

    return (
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        style={{
          height: '100%',
          aspectRatio: '1 / 1.3',
          maxHeight: '100%',
          maxWidth: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#1b2636',
          borderRadius: '12px',
          boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.35)',
          cursor: isDragging ? 'grabbing' : 'default',
          boxSizing: 'border-box',
        }}
      >
        <style>{`
          .tag-container {
            pointer-events: auto;
            opacity: 0.6;
            transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .tag-container:hover {
            opacity: 1 !important;
          }
          .tag-container:hover .tag-label {
            transform: translate(-50%, -8px) scale(1) !important;
            opacity: 1 !important;
          }
          .tag-container:hover > div:first-child {
            transform: scale(1.1);
            box-shadow: 0 6px 14px rgba(0,0,0,0.45) !important;
          }
        `}</style>

        {showCursorPreview && (
          <div
            style={{
              position: 'absolute',
              left: `${previewLeft}px`,
              top: `${previewTop}px`,
              transform: 'translate(-50%, -50%)',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: activeColor,
              border: '1.5px solid #ffffff',
              boxShadow: '0 3px 8px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1b2636',
              fontSize: '10px',
              fontWeight: 'bold',
              textShadow: '0 1px 2px rgba(255, 255, 255, 0.4)',
              opacity: 0.3,
              pointerEvents: 'none',
              zIndex: 19,
            }}
          >
            {tagInstances.length + 1}
          </div>
        )}

        {imageUrl && !loading ? (
          <>
            <img
              src={imageUrl}
              alt="Comic page"
              onLoad={handleImageLoad}
              style={{
                position: 'absolute',
                width: imgSize.w ? `${imgSize.w}px` : 'auto',
                height: imgSize.h ? `${imgSize.h}px` : 'auto',
                left: imgSize.w ? `calc(50% - ${imgSize.w / 2}px)` : '50%',
                top: imgSize.h ? `calc(50% - ${imgSize.h / 2}px)` : '50%',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom * fitScale})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.12s ease-out',
                userSelect: 'none',
                pointerEvents: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}
            />

            {imgSize.w > 0 &&
              tagInstances.map((tag, idx) => {
                const displayW = imgSize.w * zoom * fitScale
                const displayH = imgSize.h * zoom * fitScale
                const transformX = pan.x + (tag.x - 0.5) * displayW
                const transformY = pan.y + (tag.y - 0.5) * displayH
                const color = RAINBOW_COLORS[tag.tagIndex % RAINBOW_COLORS.length]

                return (
                  <div
                    key={tag.id}
                    onMouseDown={(e) => handleTagMouseDown(e, tag)}
                    onMouseEnter={() => handleTagMouseEnter(tag)}
                    onMouseLeave={handleTagMouseLeave}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (onDeleteTag) {
                        onDeleteTag(tag.id)
                      }
                    }}
                    className="tag-container"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: `translate(calc(-50% + ${transformX}px), calc(-50% + ${transformY}px))`,
                      zIndex: 20,
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: '1.5px solid #ffffff',
                        boxShadow: '0 3px 8px rgba(0, 0, 0, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1b2636',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        textShadow: '0 1px 2px rgba(255, 255, 255, 0.4)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {idx + 1}
                    </div>

                    <div
                      className="tag-label"
                      style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translate(-50%, 4px) scale(0.85)',
                        opacity: 0,
                        pointerEvents: 'none',
                        backgroundColor: color,
                        color: '#1b2636',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)',
                        whiteSpace: 'nowrap',
                        border: '1.5px solid #ffffff',
                        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        zIndex: 21,
                      }}
                    >
                      {getTagName(tag.tagIndex)}
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: '0',
                          height: '0',
                          borderLeft: '5px solid transparent',
                          borderRight: '5px solid transparent',
                          borderTop: `5px solid ${color}`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
          </>
        ) : (
          <div
            style={{ color: '#94a3b8', fontSize: '1.2rem', textAlign: 'center', padding: '40px' }}
          >
            {loading
              ? t('loading', '加载中...')
              : t('noChapterPages', '没有配置章节页面。请点击右上角【页面设置】按钮添加。')}
          </div>
        )}

        {/* Photoshop Zoom Overlay Controls */}
        {imageUrl && !loading && imgSize.w > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(27, 38, 54, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '4px 8px',
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <button
              onClick={zoomOut}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '16px',
                cursor: 'pointer',
                width: '24px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              -
            </button>
            <span
              style={{
                color: '#fff',
                fontSize: '12px',
                minWidth: '40px',
                textAlign: 'center',
                fontWeight: 'bold',
              }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={zoomIn}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '16px',
                cursor: 'pointer',
                width: '24px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              +
            </button>
            <button
              onClick={resetZoom}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '0 4px',
                marginLeft: '4px',
              }}
            >
              Fit
            </button>
          </div>
        )}
      </div>
    )
  },
)

ImagePreviewer.displayName = 'ImagePreviewer'

export default ImagePreviewer

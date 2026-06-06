import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'

export interface ImagePreviewerRef {
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

interface ImagePreviewerProps {
  imageUrl: string
  loading: boolean
}

const ImagePreviewer = forwardRef<ImagePreviewerRef, ImagePreviewerProps>(
  ({ imageUrl, loading }, ref) => {
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

    const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
    const [fitScale, setFitScale] = useState(1)

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

    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return // Left click only
      if (!imageUrl || loading) return
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging) return
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
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

    return (
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
          cursor: isDragging ? 'grabbing' : imageUrl && !loading ? 'grab' : 'default',
          boxSizing: 'border-box',
        }}
      >
        {imageUrl && !loading ? (
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
        ) : (
          <div
            style={{ color: '#94a3b8', fontSize: '1.2rem', textAlign: 'center', padding: '40px' }}
          >
            {loading ? '加载中...' : '没有配置章节页面。请点击右上角【页面设置】按钮添加。'}
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

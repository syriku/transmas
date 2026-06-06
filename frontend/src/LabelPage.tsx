import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useApp } from './AppContext'
import {
  GetChapterPageMetas,
  UpdateChapterPages,
} from '../bindings/github.com/syriku/transmas/service/agentservice'
import {
  ListCandidatePages,
  SetWorkspace,
} from '../bindings/github.com/syriku/transmas/service/systemservice'
import { PageMeta } from '../bindings/github.com/syriku/transmas/agents/comicagents/comicdb/models'
import GlossaryModal from './widgets/GlossaryModal'
import Toast from './widgets/Toast'

// PageSetupModal Component
interface PageSetupModalProps {
  projectName: string
  chapterOrder: number
  workDir: string
  chapterDir: string
  currentPages: string[]
  onSave: (pages: string[]) => Promise<void>
  onClose: () => void
}

const PageSetupModal: React.FC<PageSetupModalProps> = ({
  projectName,
  chapterOrder,
  workDir,
  chapterDir,
  currentPages,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation()
  const [candidates, setCandidates] = useState<string[]>([])
  const [leftPages, setLeftPages] = useState<string[]>([])
  const [rightPages, setRightPages] = useState<string[]>([...currentPages])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const separator = workDir.includes('\\') ? '\\' : '/'
  const fullChapterPath = `${workDir}${separator}${chapterDir}`

  useEffect(() => {
    ListCandidatePages(fullChapterPath)
      .then((list) => {
        const sortedCandidates = list || []
        setCandidates(sortedCandidates)
        // leftPages are candidates that are NOT currently in rightPages
        const initialLeft = sortedCandidates.filter((p) => !rightPages.includes(p))
        setLeftPages(initialLeft)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to list candidate pages:', err)
        setLoading(false)
      })
  }, [fullChapterPath])

  const naturalCompare = (a: string, b: string) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  }

  const handleSelectPage = (pageName: string) => {
    setLeftPages((prev) => prev.filter((p) => p !== pageName))
    setRightPages((prev) => [...prev, pageName])
  }

  const handleRemovePage = (pageName: string) => {
    setRightPages((prev) => prev.filter((p) => p !== pageName))
    setLeftPages((prev) => {
      const updated = [...prev, pageName]
      return updated.sort(naturalCompare)
    })
  }

  const handleSelectAll = () => {
    const filteredCandidates = searchQuery
      ? leftPages.filter((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
      : leftPages

    setRightPages((prev) => [...prev, ...filteredCandidates])
    setLeftPages((prev) => prev.filter((p) => !filteredCandidates.includes(p)))
  }

  const handleClearAll = () => {
    setRightPages([])
    setLeftPages([...candidates].sort(naturalCompare))
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    setRightPages((prev) => {
      const updated = [...prev]
      const temp = updated[index]
      updated[index] = updated[index - 1]
      updated[index - 1] = temp
      return updated
    })
  }

  const handleMoveDown = (index: number) => {
    if (index === rightPages.length - 1) return
    setRightPages((prev) => {
      const updated = [...prev]
      const temp = updated[index]
      updated[index] = updated[index + 1]
      updated[index + 1] = temp
      return updated
    })
  }

  const handleConfirmSave = async () => {
    setSaving(true)
    try {
      await onSave(rightPages)
      onClose()
    } catch (err: any) {
      alert(t('failedToSave', '保存失败: ') + err.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredLeftPages = leftPages.filter((p) =>
    p.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '24px',
          borderRadius: '16px',
          width: '780px',
          maxHeight: '90vh',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#1a1f36' }}>
            {t('pageSetupTitle', '页面设置')}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#999',
            }}
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
            {t('loading', '加载中...')}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: '20px',
              flex: 1,
              overflow: 'hidden',
              minHeight: '400px',
              maxHeight: '600px',
            }}
          >
            {/* Left Box: Candidates */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                backgroundColor: '#f8fafc',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>
                  {t('candidatePages', '候选页面')} ({leftPages.length})
                </span>
                <button
                  onClick={handleSelectAll}
                  disabled={leftPages.length === 0}
                  style={{
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: leftPages.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: leftPages.length === 0 ? 0.6 : 1,
                  }}
                >
                  {t('selectAll', '全选')}
                </button>
              </div>

              <input
                type="text"
                placeholder={t('search', '搜索...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  marginBottom: '10px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontSize: '13px',
                }}
              />

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {filteredLeftPages.map((pageName) => (
                  <div
                    key={pageName}
                    onClick={() => handleSelectPage(pageName)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#334155',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6'
                      e.currentTarget.style.backgroundColor = '#eff6ff'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0'
                      e.currentTarget.style.backgroundColor = '#fff'
                    }}
                  >
                    {pageName}
                  </div>
                ))}
                {filteredLeftPages.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '13px',
                      padding: '20px',
                    }}
                  >
                    {t('noMatchingPages', '无可用页面')}
                  </div>
                )}
              </div>
            </div>

            {/* Right Box: Selected */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                backgroundColor: '#f8fafc',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>
                  {t('selectedPages', '已选择页面')} ({rightPages.length})
                </span>
                <button
                  onClick={handleClearAll}
                  disabled={rightPages.length === 0}
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: rightPages.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: rightPages.length === 0 ? 0.6 : 1,
                  }}
                >
                  {t('clearAll', '清除')}
                </button>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {rightPages.map((pageName, idx) => (
                  <div
                    key={pageName}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      color: '#334155',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {idx + 1}. {pageName}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <button
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          color: idx === 0 ? '#cbd5e1' : '#64748b',
                          padding: '2px 4px',
                        }}
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === rightPages.length - 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: idx === rightPages.length - 1 ? 'not-allowed' : 'pointer',
                          color: idx === rightPages.length - 1 ? '#cbd5e1' : '#64748b',
                          padding: '2px 4px',
                        }}
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => handleRemovePage(pageName)}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          marginLeft: '4px',
                          padding: '2px 6px',
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
                {rightPages.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '13px',
                      padding: '40px 20px',
                    }}
                  >
                    {t('noPagesSelected', '请点击左侧页面添加')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div
          style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}
        >
          <button
            disabled={saving}
            onClick={onClose}
            style={{
              height: '36px',
              padding: '0 16px',
              backgroundColor: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#475569',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            {t('cancel', '取消')}
          </button>
          <button
            disabled={saving || loading}
            onClick={handleConfirmSave}
            style={{
              height: '36px',
              padding: '0 16px',
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '8px',
              cursor: saving || loading ? 'not-allowed' : 'pointer',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              opacity: saving || loading ? 0.6 : 1,
            }}
          >
            {saving ? t('saving', '保存中...') : t('save', '保存')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Main LabelPage Component
const LabelPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentProject, currentChapter } = useApp()

  const query = new URLSearchParams(location.search)
  const projectName = query.get('project')
  const chapterOrderStr = query.get('chapter')
  const chapterOrder = chapterOrderStr ? parseInt(chapterOrderStr) : null

  const [pageMetas, setPageMetas] = useState<PageMeta[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [isGlossaryModalOpen, setIsGlossaryModalOpen] = useState(false)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false)

  // Pan & Zoom state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentProject?.WorkDir) {
      SetWorkspace(currentProject.WorkDir).catch((err) => {
        console.error('Failed to set workspace:', err)
      })
    }
  }, [currentProject])

  const fetchPageMetas = async () => {
    if (!projectName || chapterOrder === null) return
    setLoading(true)
    try {
      const metas = await GetChapterPageMetas(projectName, chapterOrder)
      setPageMetas(metas || [])
      setCurrentPageIndex(0)
    } catch (err: any) {
      console.error('Failed to get chapter page metas:', err)
      setToast({
        message: t('failedToReadPages', '加载页面列表失败: ') + err.message,
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPageMetas()
  }, [projectName, chapterOrder])

  // Mouse pan event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Left click only
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
    const zoomFactor = 1.1
    let newZoom = zoom
    if (e.deltaY < 0) {
      newZoom = Math.min(zoom * zoomFactor, 8)
    } else {
      newZoom = Math.max(zoom / zoomFactor, 0.15)
    }
    setZoom(newZoom)
  }

  const resetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const zoomIn = () => {
    setZoom((z) => Math.min(z * 1.2, 8))
  }

  const zoomOut = () => {
    setZoom((z) => Math.max(z / 1.2, 0.15))
  }

  // Keyboard Navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard events if a modal or input is active
      if (isGlossaryModalOpen || isSetupModalOpen) return
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      )
        return

      const key = e.key.toLowerCase()

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        handlePrevPage()
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        handleNextPage()
      } else if (key === 'p') {
        e.preventDefault()
        setIsSetupModalOpen(true)
      } else if (key === 'g') {
        e.preventDefault()
        setIsGlossaryModalOpen(true)
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-') {
        e.preventDefault()
        zoomOut()
      } else if (key === '0' || key === 'f') {
        e.preventDefault()
        resetZoom()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pageMetas, currentPageIndex, isGlossaryModalOpen, isSetupModalOpen, zoom])

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((idx) => idx - 1)
      resetZoom()
    }
  }

  const handleNextPage = () => {
    if (currentPageIndex < pageMetas.length - 1) {
      setCurrentPageIndex((idx) => idx + 1)
      resetZoom()
    }
  }

  const handleSavePages = async (updatedPages: string[]) => {
    if (!projectName || chapterOrder === null) return
    try {
      await UpdateChapterPages(projectName, chapterOrder, updatedPages)
      setToast({ message: t('saveSuccess', '保存成功'), type: 'success' })
      await fetchPageMetas()
    } catch (err: any) {
      console.error(err)
      setToast({ message: t('failedToSave', '保存失败: ') + err.message, type: 'error' })
    }
  }

  const currentPage = pageMetas[currentPageIndex]
  const chapterDir = currentChapter?.Title || ''
  const imageUrl = currentPage
    ? `/local-manga/${encodeURIComponent(chapterDir)}/${encodeURIComponent(currentPage.filename)}`
    : ''

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        height: '100vh',
        width: '100vw',
        padding: '20px 40px',
        paddingTop: '80px',
        boxSizing: 'border-box',
        backgroundColor: '#f5f7fa',
        color: '#333',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Sticky Header */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '40px',
          right: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => navigate(-1)}
            title={t('back', '返回')}
            style={{
              height: '40px',
              width: '40px',
              backgroundColor: 'transparent',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#666',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: '500',
              lineHeight: '1',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f0f0'
              e.currentTarget.style.borderColor = '#ccc'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.borderColor = '#ddd'
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          {projectName && (
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#666' }}>
              {projectName}{' '}
              {currentChapter
                ? `/ Chapter ${currentChapter.Order}: ${currentChapter.Title}`
                : chapterOrder
                  ? `/ Chapter ${chapterOrder}`
                  : ''}
            </h2>
          )}
        </div>

        {/* Toolbar Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setIsSetupModalOpen(true)}
            title="页面设置 (Shortcut: P)"
            style={{
              width: 'auto',
              whiteSpace: 'nowrap',
              height: '40px',
              padding: '0 16px',
              backgroundColor: 'white',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              margin: 0,
              lineHeight: '1',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5'
              e.currentTarget.style.borderColor = '#ccc'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'white'
              e.currentTarget.style.borderColor = '#ddd'
            }}
          >
            ⚙️ {t('pageSetup', '页面设置')}
          </button>

          <button
            onClick={() => setIsGlossaryModalOpen(true)}
            title="术语表 (Shortcut: G)"
            style={{
              width: 'auto',
              whiteSpace: 'nowrap',
              height: '40px',
              padding: '0 16px',
              backgroundColor: 'white',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              margin: 0,
              lineHeight: '1',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5'
              e.currentTarget.style.borderColor = '#ccc'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'white'
              e.currentTarget.style.borderColor = '#ddd'
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            {t('glossary', '术语表')}
          </button>
        </div>
      </div>

      {/* Pagination Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          marginBottom: '12px',
          marginTop: '10px',
          width: '100%',
        }}
      >
        <button
          disabled={currentPageIndex === 0 || loading || pageMetas.length === 0}
          onClick={handlePrevPage}
          style={{
            height: '36px',
            padding: '0 16px',
            backgroundColor:
              currentPageIndex === 0 || loading || pageMetas.length === 0 ? '#f0f0f0' : 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor:
              currentPageIndex === 0 || loading || pageMetas.length === 0
                ? 'not-allowed'
                : 'pointer',
            color: currentPageIndex === 0 || loading || pageMetas.length === 0 ? '#999' : '#333',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            margin: 0,
            outline: 'none',
          }}
        >
          &larr; {t('prevPage', '上一页')}
        </button>

        <span
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#666',
            minWidth: '160px',
            textAlign: 'center',
            backgroundColor: 'white',
            padding: '6px 16px',
            borderRadius: '20px',
            border: '1px solid #eee',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          }}
        >
          {pageMetas.length > 0
            ? `${currentPageIndex + 1} / ${pageMetas.length} (${currentPage?.filename})`
            : '0 / 0'}
        </span>

        <button
          disabled={currentPageIndex === pageMetas.length - 1 || loading || pageMetas.length === 0}
          onClick={handleNextPage}
          style={{
            height: '36px',
            padding: '0 16px',
            backgroundColor:
              currentPageIndex === pageMetas.length - 1 || loading || pageMetas.length === 0
                ? '#f0f0f0'
                : 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor:
              currentPageIndex === pageMetas.length - 1 || loading || pageMetas.length === 0
                ? 'not-allowed'
                : 'pointer',
            color:
              currentPageIndex === pageMetas.length - 1 || loading || pageMetas.length === 0
                ? '#999'
                : '#333',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            margin: 0,
            outline: 'none',
          }}
        >
          {t('nextPage', '下一页')} &rarr;
        </button>
      </div>

      <div style={{ width: '100%', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' }} />

      {/* Photoshop Style Movable/Floating Image Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#1b2636',
          borderRadius: '12px',
          boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.35)',
          cursor: isDragging ? 'grabbing' : imageUrl ? 'grab' : 'default',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Comic page"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.12s ease-out',
              userSelect: 'none',
              pointerEvents: 'none',
              maxHeight: '95%',
              maxWidth: '95%',
              objectFit: 'contain',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          />
        ) : (
          <div
            style={{ color: '#94a3b8', fontSize: '1.2rem', textAlign: 'center', padding: '40px' }}
          >
            {loading
              ? t('loading', '加载中...')
              : t('noPages', '没有配置章节页面。请点击右上角【页面设置】按钮添加。')}
          </div>
        )}

        {/* Photoshop Zoom Overlay Controls */}
        {imageUrl && (
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

      {/* Glossary Modal */}
      {isGlossaryModalOpen && projectName && (
        <GlossaryModal projectName={projectName} onClose={() => setIsGlossaryModalOpen(false)} />
      )}

      {/* Page Setup Modal */}
      {isSetupModalOpen && projectName && chapterOrder !== null && currentProject && (
        <PageSetupModal
          projectName={projectName}
          chapterOrder={chapterOrder}
          workDir={currentProject.WorkDir || ''}
          chapterDir={chapterDir}
          currentPages={pageMetas.map((p) => p.filename)}
          onSave={handleSavePages}
          onClose={() => setIsSetupModalOpen(false)}
        />
      )}

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

export default LabelPage

import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import { useApp } from './AppContext'
import {
  GetChapterPageMetas,
  UpdateChapterPages,
  GetChapterTags,
  UpdatePageLabels,
  ExportLp,
} from '../bindings/github.com/syriku/transmas/service/agentservice'
import {
  ListCandidatePages,
  SetWorkspace,
} from '../bindings/github.com/syriku/transmas/service/systemservice'
import { PageMeta } from '../bindings/github.com/syriku/transmas/agents/comicagents/comicdb/models'
import LabelSettingsModal from './widgets/LabelSettingsModal'
import Toast from './widgets/Toast'
import ImagePreviewer, { ImagePreviewerRef, TagInstance } from './widgets/ImagePreviewer'
import LabelCard from './widgets/LabelCard'

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
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: '1',
                    width: 'auto',
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
                      flexShrink: 0,
                      minHeight: '36px',
                      boxSizing: 'border-box',
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
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: '1',
                    width: 'auto',
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
                      flexShrink: 0,
                      minHeight: '36px',
                      boxSizing: 'border-box',
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
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1',
              width: 'auto',
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
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1',
              width: 'auto',
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
  const [tags, setTags] = useState<string[]>([])
  const [activeTagIndex, setActiveTagIndex] = useState(0)

  const [pageTagInstances, setPageTagInstances] = useState<Record<string, TagInstance[]>>({})
  const [expandedLabelId, setExpandedLabelId] = useState<string | null>(null)

  const previewerRef = useRef<ImagePreviewerRef>(null)

  const currentFilename = pageMetas[currentPageIndex]?.filename

  // Reset expanded card state when current page changes
  useEffect(() => {
    setExpandedLabelId(null)
  }, [currentPageIndex])

  // Scroll expanded label card into view
  useEffect(() => {
    if (expandedLabelId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`label-card-${expandedLabelId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [expandedLabelId])

  const saveLabelsToBackend = async (filename: string, instances: TagInstance[]) => {
    if (!projectName || chapterOrder === null) return
    const backendLabels = instances.map((inst) => {
      const tag = tags[inst.tagIndex] || ''
      return {
        pos: [inst.x, inst.y],
        tag,
        text: inst.text || '',
        translated: inst.translated || false,
        reviewed: inst.reviewed || false,
        page: filename,
      }
    })
    await UpdatePageLabels(projectName, chapterOrder, filename, backendLabels as any)
  }

  const handleAddTag = async (x: number, y: number) => {
    if (!currentFilename || !projectName || chapterOrder === null) return
    const currentList = pageTagInstances[currentFilename] || []
    const newTagId = `${currentFilename}-${currentList.length}`
    const newTag: TagInstance = {
      id: newTagId,
      tagIndex: activeTagIndex,
      x,
      y,
      text: '',
      translated: false,
      reviewed: false,
    }
    const updated = [...currentList, newTag]
    setPageTagInstances((prev) => ({
      ...prev,
      [currentFilename]: updated,
    }))
    try {
      await saveLabelsToBackend(currentFilename, updated)
      setExpandedLabelId(newTagId)
      await fetchPageMetas(true, true)
    } catch (err: any) {
      console.error(err)
      setToast({ message: t('failedToSave', '保存失败: ') + err.message, type: 'error' })
    }
  }

  const handleMoveTag = async (id: string, x: number, y: number) => {
    if (!currentFilename || !projectName || chapterOrder === null) return
    const updated = (pageTagInstances[currentFilename] || []).map((tag) =>
      tag.id === id ? { ...tag, x, y } : tag,
    )
    setPageTagInstances((prev) => ({
      ...prev,
      [currentFilename]: updated,
    }))
    try {
      await saveLabelsToBackend(currentFilename, updated)
    } catch (err: any) {
      console.error(err)
      setToast({ message: t('failedToSave', '保存失败: ') + err.message, type: 'error' })
    }
  }

  const handleDeleteTag = async (id: string) => {
    if (!currentFilename || !projectName || chapterOrder === null) return
    const updated = (pageTagInstances[currentFilename] || []).filter((tag) => tag.id !== id)
    setPageTagInstances((prev) => ({
      ...prev,
      [currentFilename]: updated,
    }))
    if (expandedLabelId === id) {
      setExpandedLabelId(null)
    }
    try {
      await saveLabelsToBackend(currentFilename, updated)
      await fetchPageMetas(true, true)
    } catch (err: any) {
      console.error(err)
      setToast({ message: t('failedToSave', '保存失败: ') + err.message, type: 'error' })
    }
  }

  const handleTagClick = (tag: TagInstance) => {
    console.log('Clicked tag:', tag)
    setExpandedLabelId(tag.id)
  }

  const handleTagHover = (tag: TagInstance) => {
    console.log('Hovered tag:', tag)
  }

  const handleExportLp = async () => {
    if (!projectName || chapterOrder === null || !currentChapter) return
    try {
      const defaultFilename = `${currentChapter.Title.replace(/\.txt$/i, '')}_labels.txt`
      const filePath = await Dialogs.SaveFile({
        Title: t('exportLp', '导出 LP 格式'),
        Filename: defaultFilename,
        Filters: [{ DisplayName: 'Text Files', Pattern: '*.txt' }],
      })
      if (filePath) {
        await ExportLp(projectName, chapterOrder, filePath)
        setToast({ message: t('exportSuccess', '导出成功'), type: 'success' })
      }
    } catch (err: any) {
      console.error('Failed to export LP:', err)
      setToast({ message: t('failedToExport', '导出失败: ') + err.message, type: 'error' })
    }
  }

  useEffect(() => {
    if (currentProject?.WorkDir) {
      SetWorkspace(currentProject.WorkDir).catch((err) => {
        console.error('Failed to set workspace:', err)
      })
    }
  }, [currentProject])

  const fetchPageMetas = async (keepPageIndex = false, silent = false) => {
    if (!projectName || chapterOrder === null) return
    if (!silent) setLoading(true)
    try {
      const fetchedTags = await GetChapterTags(projectName, chapterOrder)
      const currentTags = fetchedTags || []
      setTags(currentTags)

      const metas = await GetChapterPageMetas(projectName, chapterOrder)
      const currentMetas = metas || []
      setPageMetas(currentMetas)

      const tagInstancesMap: Record<string, TagInstance[]> = {}
      currentMetas.forEach((meta) => {
        if (meta.labels) {
          tagInstancesMap[meta.filename] = meta.labels.map((l: any, idx: number) => {
            let tagIndex = currentTags.indexOf(l.tag)
            if (tagIndex === -1) {
              tagIndex = 0
            }
            return {
              id: `${meta.filename}-${idx}`,
              tagIndex,
              x: l.pos ? l.pos[0] : 0,
              y: l.pos ? l.pos[1] : 0,
              text: l.text || '',
              translated: l.translated || false,
              reviewed: l.reviewed || false,
            }
          })
        }
      })
      setPageTagInstances(tagInstancesMap)
      if (!keepPageIndex) {
        setCurrentPageIndex(0)
      }
    } catch (err: any) {
      console.error('Failed to get chapter page metas:', err)
      setToast({
        message: t('failedToReadPages', '加载页面列表失败: ') + err.message,
        type: 'error',
      })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchPageMetas()
  }, [projectName, chapterOrder])

  const translateTag = (tag: string) => {
    if (tag === 'inside' || tag === '框内') return t('tagInside', '框内')
    if (tag === 'outside' || tag === '框外') return t('tagOutside', '框外')
    return tag
  }

  const formatTagName = (tag: string, maxLen?: number) => {
    const translated = translateTag(tag)
    if (maxLen && translated.length > maxLen) {
      return translated.slice(0, maxLen) + '...'
    }
    return translated
  }

  const handleUpdateLabel = async (tagId: string, updatedFields: Partial<TagInstance>) => {
    if (!currentFilename) return
    const updated = (pageTagInstances[currentFilename] || []).map((tag) => {
      if (tag.id === tagId) {
        const nextTag = { ...tag, ...updatedFields }
        if (updatedFields.text !== undefined) {
          nextTag.translated = updatedFields.text.trim().length > 0
        }
        return nextTag
      }
      return tag
    })

    setPageTagInstances((prev) => ({
      ...prev,
      [currentFilename]: updated,
    }))

    try {
      await saveLabelsToBackend(currentFilename, updated)
      await fetchPageMetas(true, true)
    } catch (err: any) {
      console.error(err)
      setToast({ message: t('failedToSave', '保存失败: ') + err.message, type: 'error' })
    }
  }

  const handleToggleAllReviewed = async () => {
    if (!currentFilename) return
    const currentList = pageTagInstances[currentFilename] || []
    if (currentList.length === 0) return

    const allReviewed = currentList.every((t) => t.reviewed)
    const targetStatus = !allReviewed

    const updated = currentList.map((t) => ({ ...t, reviewed: targetStatus }))

    setPageTagInstances((prev) => ({
      ...prev,
      [currentFilename]: updated,
    }))

    try {
      await saveLabelsToBackend(currentFilename, updated)
      await fetchPageMetas(true, true)
    } catch (err: any) {
      console.error(err)
      setToast({ message: t('failedToSave', '保存失败: ') + err.message, type: 'error' })
    }
  }

  const handleSaveTags = (updatedTags: string[]) => {
    setTags(updatedTags)
    if (activeTagIndex >= updatedTags.length) {
      setActiveTagIndex(0)
    }
  }

  const resetZoom = () => {
    previewerRef.current?.resetZoom()
  }

  const zoomIn = () => {
    previewerRef.current?.zoomIn()
  }

  const zoomOut = () => {
    previewerRef.current?.zoomOut()
  }

  // Keyboard Navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGlossaryModalOpen || isSetupModalOpen) return
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      )
        return

      const key = e.key.toLowerCase()

      if (/^[1-7]$/.test(e.key)) {
        const index = parseInt(e.key) - 1
        if (index >= 0 && index < tags.length) {
          e.preventDefault()
          setActiveTagIndex(index)
        }
      }

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
  }, [pageMetas, currentPageIndex, isGlossaryModalOpen, isSetupModalOpen, tags])

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
          {tags.length > 0 && (
            <div style={{ marginRight: '8px', display: 'inline-flex', alignItems: 'center' }}>
              {tags.length === 1 && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#1e40af',
                    height: '40px',
                    boxSizing: 'border-box',
                    maxWidth: '120px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={translateTag(tags[0])}
                >
                  {formatTagName(tags[0], 8)}
                </div>
              )}

              {tags.length === 2 && (
                <div
                  onClick={() => setActiveTagIndex((prev) => (prev === 0 ? 1 : 0))}
                  style={{
                    display: 'inline-flex',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '8px',
                    padding: '2px',
                    height: '40px',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  title={t('toggleActiveTag', '点击切换标签')}
                >
                  {tags.map((tag, i) => {
                    const isSelected = activeTagIndex === i
                    return (
                      <div
                        key={tag}
                        style={{
                          padding: '0 12px',
                          height: '34px',
                          backgroundColor: isSelected ? '#fff' : 'transparent',
                          color: isSelected ? '#1e293b' : '#64748b',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: isSelected ? '700' : '500',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          maxWidth: '80px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          margin: 0,
                          pointerEvents: 'none',
                        }}
                        title={translateTag(tag)}
                      >
                        {formatTagName(tag, 6)}
                      </div>
                    )
                  })}
                </div>
              )}

              {tags.length === 3 && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '40px',
                    boxSizing: 'border-box',
                  }}
                >
                  {tags.map((tag, i) => {
                    const isSelected = activeTagIndex === i
                    return (
                      <label
                        key={tag}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: isSelected ? '#1e40af' : '#475569',
                          padding: '0 12px',
                          backgroundColor: isSelected ? '#eff6ff' : '#fff',
                          border: `1px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`,
                          borderRadius: '8px',
                          transition: 'all 0.15s',
                          height: '38px',
                          boxSizing: 'border-box',
                          userSelect: 'none',
                          maxWidth: '90px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={translateTag(tag)}
                      >
                        <input
                          type="radio"
                          name="activeTagGroup"
                          checked={isSelected}
                          onChange={() => setActiveTagIndex(i)}
                          style={{
                            margin: 0,
                            cursor: 'pointer',
                            accentColor: '#3b82f6',
                          }}
                        />
                        <span
                          style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '70px',
                          }}
                        >
                          {formatTagName(tag, 5)}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}

              {tags.length > 3 && (
                <select
                  value={activeTagIndex}
                  onChange={(e) => setActiveTagIndex(parseInt(e.target.value))}
                  style={{
                    height: '40px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    backgroundColor: '#fff',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#333',
                    outline: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    boxSizing: 'border-box',
                    maxWidth: '150px',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {tags.map((tag, i) => (
                    <option key={tag} value={i}>
                      {translateTag(tag)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <button
            onClick={handleExportLp}
            title={t('exportLp', '导出 LP 格式')}
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
              flexShrink: 0,
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('exportLp', '导出 LP')}
          </button>

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
              flexShrink: 0,
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
              <path d="M18 22H4a2 2 0 0 1-2-2V6" />
              <path d="M22 18H8a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2z" />
              <circle cx="12" cy="6" r="1.5" />
              <path d="m18 12-3.2-3.2a2 2 0 0 0-2.8 0L8 13" />
            </svg>
            {t('pageSetup', '页面设置')}
          </button>

          <button
            onClick={() => setIsGlossaryModalOpen(true)}
            title={t('settingsTitle', '设置 (Shortcut: G)')}
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
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.52 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {t('settings', '设置')}
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
            whiteSpace: 'nowrap',
            flexShrink: 0,
            width: 'auto',
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
            whiteSpace: 'nowrap',
            flexShrink: 0,
            width: 'auto',
          }}
        >
          {t('nextPage', '下一页')} &rarr;
        </button>
      </div>

      <div style={{ width: '100%', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' }} />

      {/* Dual Column Layout (Image Preview on Left, Empty Box on Right) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '30px',
          width: '100%',
          justifyContent: 'center',
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
          paddingLeft: '20px',
          paddingRight: '20px',
          paddingBottom: '20px',
          paddingTop: '10px',
          boxSizing: 'border-box',
        }}
      >
        {/* Left Column: Image Previewer */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            zIndex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxSizing: 'border-box',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <ImagePreviewer
            ref={previewerRef}
            imageUrl={imageUrl}
            loading={loading}
            tags={tags}
            activeTagIndex={activeTagIndex}
            tagInstances={currentFilename ? pageTagInstances[currentFilename] || [] : []}
            onAddTag={handleAddTag}
            onMoveTag={handleMoveTag}
            onDeleteTag={handleDeleteTag}
            onTagClick={handleTagClick}
            onTagHover={handleTagHover}
          />
        </div>

        {/* Right Column: Labels List Panel */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            height: '100%',
          }}
        >
          <div
            style={{
              flex: 1,
              background: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              height: '100%',
            }}
          >
            {/* Panel Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                {t('labelsList', '标注列表')}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {currentFilename && (pageTagInstances[currentFilename] || []).length > 0 && (
                  <button
                    onClick={handleToggleAllReviewed}
                    title={
                      (pageTagInstances[currentFilename] || []).every((t) => t.reviewed)
                        ? t('unmarkAllReviewed', '全部取消校对')
                        : t('markAllReviewed', '全部标记为已校对')
                    }
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s',
                      color: (pageTagInstances[currentFilename] || []).every((t) => t.reviewed)
                        ? '#10b981'
                        : '#94a3b8',
                      backgroundColor: (pageTagInstances[currentFilename] || []).every(
                        (t) => t.reviewed,
                      )
                        ? '#ecfdf5'
                        : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      const isAll = (pageTagInstances[currentFilename] || []).every(
                        (t) => t.reviewed,
                      )
                      e.currentTarget.style.backgroundColor = isAll ? '#d1fae5' : '#f1f5f9'
                    }}
                    onMouseLeave={(e) => {
                      const isAll = (pageTagInstances[currentFilename] || []).every(
                        (t) => t.reviewed,
                      )
                      e.currentTarget.style.backgroundColor = isAll ? '#ecfdf5' : 'transparent'
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                )}
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#475569',
                    backgroundColor: '#e2e8f0',
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  {currentFilename ? (pageTagInstances[currentFilename] || []).length : 0}
                </span>
              </div>
            </div>

            {/* List Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: '#f8fafc',
              }}
            >
              {!currentFilename || (pageTagInstances[currentFilename] || []).length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#94a3b8',
                    gap: '8px',
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  <span style={{ fontSize: '13px' }}>
                    {t('noLabelsOnPage', '当前页面暂无标注，点击图片可新增标注')}
                  </span>
                </div>
              ) : (
                (pageTagInstances[currentFilename] || []).map((tag, idx) => {
                  const isExpanded = expandedLabelId === tag.id
                  return (
                    <LabelCard
                      key={tag.id}
                      tag={tag}
                      index={idx}
                      isExpanded={isExpanded}
                      onExpand={() => setExpandedLabelId(isExpanded ? null : tag.id)}
                      onUpdate={(fields) => handleUpdateLabel(tag.id, fields)}
                      tags={tags}
                      translateTag={translateTag}
                    />
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isGlossaryModalOpen && projectName && chapterOrder !== null && (
        <LabelSettingsModal
          projectName={projectName}
          chapterOrder={chapterOrder}
          tags={tags}
          onSaveTags={handleSaveTags}
          onClose={() => setIsGlossaryModalOpen(false)}
        />
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

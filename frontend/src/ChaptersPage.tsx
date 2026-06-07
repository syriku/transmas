import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Dialogs } from '@wailsio/runtime'
import ItemCard from './widgets/ItemCard'
import ProjectSettingsModal from './widgets/ProjectSettingsModal'
// @ts-ignore
import {
  ListChapters,
  AddChapter,
  ListProjects,
  UpdateProjectDir,
  GetChapterStatus,
  DeleteChapter,
  ExportLp,
  ImportLp,
  ReadChapter,
  ExportTranslatedChapter,
} from '../bindings/github.com/syriku/transmas/service/agentservice'
import {
  SetWorkDir,
  ListCandidateChapters,
  LoadWebNovel,
  InferLpChapterDir,
} from '../bindings/github.com/syriku/transmas/service/systemservice'
import NovelPreviewModal from './widgets/NovelPreviewModal'
import { Novel } from '../bindings/github.com/syriku/kakuyomu-loader/models'

import { useApp } from './AppContext'
import { Chapter, ProjectType } from '../bindings/github.com/syriku/transmas/agents/database/models'
import { EXPORT_SUFFIXES } from './i18n'

const ChaptersPage: React.FC = () => {
  const { t } = useTranslation()
  const { projectName } = useParams<{ projectName: string }>()
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [chapterStatuses, setChapterStatuses] = useState<Map<number, number>>(new Map())
  const [workDir, setWorkDir] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [candidates, setCandidates] = useState<string[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'local' | 'url'>('local')
  const [urlInput, setUrlInput] = useState('')
  const [loadedNovel, setLoadedNovel] = useState<Novel | null>(null)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [lpFilePath, setLpFilePath] = useState('')
  const navigate = useNavigate()
  const { currentProject, setCurrentProject, setCurrentChapter } = useApp()

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    chapter: Chapter
  } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteCountdown, setDeleteCountdown] = useState(4)
  const [deleteTarget, setDeleteTarget] = useState<Chapter | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    let timer: any
    if (showDeleteModal && deleteCountdown > 0) {
      timer = setInterval(() => {
        setDeleteCountdown((prev) => prev - 1)
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [showDeleteModal, deleteCountdown])

  useEffect(() => {
    if (isModalOpen && workDir) {
      ListCandidateChapters(workDir, currentProject?.ProjectType === ProjectType.ProjectTypeComic)
        .then((list: string[]) => {
          const existingTitles = new Set(chapters.map((c) => c.Title))
          const available = (list || []).filter((title) => {
            const hasExisting = existingTitles.has(title)
            const isExported = EXPORT_SUFFIXES.some((suffix) => title.endsWith(suffix))
            return !hasExisting && !isExported
          })
          setCandidates(available)
        })
        .catch((err: any) => {
          console.error('Failed to fetch candidate chapters:', err)
        })
    } else if (!isModalOpen) {
      setCandidates([])
      setIsDropdownOpen(false)
      setModalMode('local')
      setUrlInput('')
    }
  }, [isModalOpen, workDir, chapters, currentProject])

  const fetchProjectDetails = async () => {
    if (!projectName) return
    if (currentProject && currentProject.Title === projectName) {
      setWorkDir(currentProject.WorkDir || '')
      return
    }
    try {
      const projects = await ListProjects()
      const found = projects.find((p: any) => p.Title === projectName)
      if (found) {
        setCurrentProject(found)
        setWorkDir(found.WorkDir || '')
      }
    } catch (err) {
      console.error('Failed to fetch project details:', err)
    }
  }

  const fetchChapters = async () => {
    if (!projectName) return
    console.log(`Fetching chapters for project: ${projectName}`)
    setLoading(true)
    setError('')
    try {
      const list = await ListChapters(projectName)
      console.log('Chapters fetched:', list)
      setChapters(list || [])

      const statuses = new Map<number, number>()
      if (list && list.length > 0) {
        await Promise.all(
          list.map(async (c) => {
            try {
              const status = await GetChapterStatus(projectName, c.Order)
              statuses.set(c.Order, status)
            } catch (err) {
              console.error(`Failed to fetch status for chapter ${c.Order}:`, err)
            }
          }),
        )
      }
      setChapterStatuses(statuses)
    } catch (err: any) {
      console.error('Failed to fetch chapters:', err)
      setError(err.message || t('failedToLoadChapters'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChapters().then()
    fetchProjectDetails().then()
  }, [projectName])

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    if (contextMenu) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [contextMenu])

  const handleSelectWorkDir = async () => {
    if (!projectName) return
    try {
      const selectedDir = await SetWorkDir()
      if (selectedDir) {
        await UpdateProjectDir(projectName, selectedDir)
        setWorkDir(selectedDir)
      }
    } catch (err: any) {
      console.error('Failed to update work directory:', err)
      alert(t('failedToUpdateWorkDir') + err.message)
    }
  }

  const handleAddChapter = async () => {
    if (!newTitle.trim() || !projectName) return

    setIsCreating(true)
    try {
      const nextOrder = chapters.length > 0 ? Math.max(...chapters.map((c) => c.Order)) + 1 : 1
      console.log(
        `Calling AddChapter for ${projectName} with order ${nextOrder}: ${newTitle.trim()}`,
      )
      await AddChapter(projectName, nextOrder, newTitle.trim())
      console.log('AddChapter successful')

      if (lpFilePath) {
        console.log(`Importing LP file: ${lpFilePath}`)
        await ImportLp(projectName, nextOrder, lpFilePath)
        setLpFilePath('')
      }

      setNewTitle('')
      setIsModalOpen(false)
      await fetchChapters()
    } catch (err: any) {
      console.error('Failed to add chapter:', err)
      alert(t('failedToAddChapter') + err.message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleSelectLp = async () => {
    try {
      const filePath = await Dialogs.OpenFile({
        Title: t('importLp', '导入 LP 格式'),
        Filters: [{ DisplayName: 'Text Files', Pattern: '*.txt' }],
      })
      if (filePath) {
        setLpFilePath(filePath)
        if (currentProject?.ProjectType === ProjectType.ProjectTypeComic && workDir) {
          try {
            const inferredDir = await InferLpChapterDir(workDir, filePath)
            if (inferredDir) {
              const existingTitles = new Set(chapters.map((c) => c.Title))
              if (!existingTitles.has(inferredDir)) {
                setNewTitle(inferredDir)
              }
            }
          } catch (inferErr) {
            console.error('Failed to infer LP chapter directory:', inferErr)
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to select LP file:', err)
      alert(t('failedToImport', '导入失败: ') + (err.message || err))
    }
  }

  const handleExportLp = async (chapter: Chapter) => {
    if (!projectName) return
    setContextMenu(null)
    try {
      const defaultFilename = `${chapter.Title.replace(/\.txt$/i, '')}_labels.txt`
      const filePath = await Dialogs.SaveFile({
        Title: t('exportLp', '导出 LP 格式'),
        Filename: defaultFilename,
        Filters: [{ DisplayName: 'Text Files', Pattern: '*.txt' }],
      })
      if (filePath) {
        await ExportLp(projectName, chapter.Order, filePath)
        alert(t('exportSuccess', '导出成功'))
      }
    } catch (err: any) {
      console.error('Failed to export LP:', err)
      alert(t('failedToExport', '导出失败: ') + (err.message || err))
    }
  }

  const handleExportNovel = async (chapter: Chapter) => {
    if (!projectName) return
    setContextMenu(null)
    try {
      const status = chapterStatuses.get(chapter.Order)
      let suffix = t('exportSuffixExported')
      if (status === 2) {
        suffix = t('exportSuffixReviewed')
      } else if (status === 1) {
        suffix = t('exportSuffixTranslated')
      }

      const defaultFilename = `${chapter.Title.replace(/\.txt$/i, '')}${suffix}.txt`
      const filePath = await Dialogs.SaveFile({
        Title: t('export', '导出'),
        Filename: defaultFilename,
        Filters: [{ DisplayName: 'Text Files', Pattern: '*.txt' }],
      })
      if (filePath) {
        await ReadChapter(projectName, chapter.Order, true)
        await ExportTranslatedChapter(filePath)
        alert(t('exportSuccess', '导出成功'))
      }
    } catch (err: any) {
      console.error('Failed to export novel chapter:', err)
      alert(t('failedToExport', '导出失败: ') + (err.message || err))
    }
  }

  const handleAddViaUrlConfirm = async () => {
    if (!urlInput.trim()) return
    setIsCreating(true)
    try {
      const novel = await LoadWebNovel(urlInput.trim())
      if (novel) {
        setLoadedNovel(novel)
        setIsModalOpen(false)
        setIsDropdownOpen(false)
        setModalMode('local')
        setUrlInput('')
        setIsPreviewModalOpen(true)
      } else {
        alert('Failed to load novel content')
      }
    } catch (err: any) {
      console.error('Failed to load web novel:', err)
      alert(t('failedToAddChapter') + (err.message || err))
    } finally {
      setIsCreating(false)
    }
  }

  const handleChapterClick = (chapter: Chapter) => {
    setCurrentChapter(chapter)
    if (currentProject?.ProjectType === ProjectType.ProjectTypeComic) {
      navigate(`/label?project=${encodeURIComponent(projectName || '')}&chapter=${chapter.Order}`)
    } else {
      navigate(`/editor?project=${encodeURIComponent(projectName || '')}&chapter=${chapter.Order}`)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, chapter: Chapter) => {
    e.preventDefault()
    e.stopPropagation()
    const MENU_W = 160
    const MENU_H = 88
    const vw = window.innerWidth
    const vh = window.innerHeight
    const x = Math.min(Math.max(e.clientX, 0), vw - MENU_W - 4)
    const y = Math.min(Math.max(e.clientY, 0), vh - MENU_H - 4)
    setContextMenu({ x, y, chapter })
  }

  const openDeleteModal = (chapter: Chapter) => {
    setDeleteTarget(chapter)
    setDeleteCountdown(4)
    setDeleteError('')
    setDeleting(false)
    setShowDeleteModal(true)
    setContextMenu(null)
  }

  const handleConfirmDelete = async () => {
    if (!projectName || !deleteTarget || deleteCountdown > 0 || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      await DeleteChapter(projectName, deleteTarget.Order)
      setShowDeleteModal(false)
      await fetchChapters()
    } catch (err: any) {
      setDeleteError(err.message || t('failedToDeleteChapter'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      style={{
        padding: '20px 40px',
        paddingTop: '70px',
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: '#f5f7fa',
        color: '#333',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <div style={{ width: '100%' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            marginBottom: '40px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button
                onClick={() => navigate('/home')}
                title={t('backToProjects')}
                style={{
                  height: '40px',
                  width: '40px',
                  margin: '0',
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
              <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '700' }}>{projectName}</h1>
            </div>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              style={{
                height: '40px',
                padding: '0 16px',
                width: 'auto',
                margin: '0',
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#333',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '600',
                lineHeight: '1',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
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
              {t('settings')}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '20px',
              backgroundColor: '#fff1f0',
              border: '1px solid #ffa39e',
              borderRadius: '8px',
              color: '#cf1322',
              marginBottom: '20px',
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px', fontSize: '1.2rem', color: '#666' }}>
            {t('loadingChapters')}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '32px',
            }}
          >
            {chapters
              .sort((a, b) => a.Order - b.Order)
              .map((chapter) => (
                <ItemCard
                  key={chapter.ID}
                  title={t('chapterN', { n: chapter.Order })}
                  hoverTitle={`${chapter.Order}. ${chapter.Title}`}
                  onClick={() => handleChapterClick(chapter)}
                  onContextMenu={(e) => handleContextMenu(e, chapter)}
                  status={chapterStatuses.get(chapter.Order)}
                />
              ))}
            <ItemCard
              title=""
              isAdd
              addText={t('addChapter')}
              onClick={() => setIsModalOpen(true)}
            />
          </div>
        )}
      </div>

      {/* Custom Modal for Adding Chapter */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !isCreating && setIsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '16px',
              width: '400px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              position: 'relative',
            }}
            onClick={(e) => {
              e.stopPropagation()
              setIsDropdownOpen(false)
            }}
          >
            {modalMode === 'local' ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                  }}
                >
                  <h2 style={{ margin: 0 }}>{t('newChapter')}</h2>
                  {currentProject?.ProjectType !== ProjectType.ProjectTypeComic ? (
                    <button
                      onClick={() => setModalMode('url')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#007bff',
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: 0,
                        whiteSpace: 'nowrap',
                        marginRight: '16px',
                      }}
                    >
                      {t('addViaUrl')}
                    </button>
                  ) : (
                    <button
                      onClick={handleSelectLp}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#007bff',
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: 0,
                        whiteSpace: 'nowrap',
                        marginRight: '16px',
                      }}
                    >
                      {lpFilePath ? t('changeLp', '修改 LP 文稿') : t('addViaLp', '从 LP 文稿创建')}
                    </button>
                  )}
                </div>
                {lpFilePath && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      fontSize: '14px',
                      color: '#0369a1',
                    }}
                  >
                    <span
                      style={{
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        maxWidth: '300px',
                      }}
                      title={lpFilePath}
                    >
                      {t('selectedLp', '已选文稿')}: {lpFilePath.split(/[/\\]/).pop()}
                    </span>
                    <button
                      onClick={() => setLpFilePath('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        padding: '0 4px',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div
                  style={{ position: 'relative', marginBottom: '20px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    autoFocus
                    type="text"
                    placeholder={t('chapterTitlePlaceholder')}
                    value={newTitle}
                    onChange={(e) => {
                      setNewTitle(e.target.value)
                      setIsDropdownOpen(true)
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddChapter()}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '16px',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  {isDropdownOpen && candidates.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        marginTop: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1001,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    >
                      {candidates
                        .filter((c) => c.toLowerCase().includes(newTitle.toLowerCase()))
                        .map((candidate) => (
                          <div
                            key={candidate}
                            onClick={() => {
                              setNewTitle(candidate)
                              setIsDropdownOpen(false)
                            }}
                            style={{
                              padding: '10px 16px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f0f7ff')}
                            onMouseOut={(e) =>
                              (e.currentTarget.style.backgroundColor = 'transparent')
                            }
                          >
                            {candidate}
                          </div>
                        ))}
                      {candidates.filter((c) => c.toLowerCase().includes(newTitle.toLowerCase()))
                        .length === 0 && (
                        <div style={{ padding: '10px 16px', color: '#999', fontSize: '14px' }}>
                          {t('noMatchingChapters')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    disabled={isCreating}
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      height: '36px',
                      padding: '0 16px',
                      width: 'auto',
                      margin: '0',
                      whiteSpace: 'nowrap',
                      backgroundColor: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: '#666',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: '1',
                      fontSize: '15px',
                      fontWeight: '500',
                    }}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    disabled={isCreating || !candidates.includes(newTitle.trim())}
                    onClick={handleAddChapter}
                    style={{
                      height: '36px',
                      padding: '0 16px',
                      width: 'auto',
                      margin: '0',
                      whiteSpace: 'nowrap',
                      backgroundColor: '#007bff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor:
                        isCreating || !candidates.includes(newTitle.trim())
                          ? 'not-allowed'
                          : 'pointer',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '15px',
                      opacity: isCreating || !candidates.includes(newTitle.trim()) ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: '1',
                    }}
                  >
                    {isCreating ? t('creating') : t('createChapter')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '20px',
                    marginLeft: '-28px',
                  }}
                >
                  <button
                    onClick={() => setModalMode('local')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: '20px',
                      padding: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ←
                  </button>
                  <h2 style={{ margin: 0, paddingLeft: '18px' }}>{t('addChapterViaUrl')}</h2>
                </div>
                <div
                  style={{ position: 'relative', marginBottom: '20px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    autoFocus
                    disabled={isCreating}
                    type="text"
                    placeholder={isCreating ? 'Loading...' : t('enterUrlPlaceholder')}
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isCreating && handleAddViaUrlConfirm()}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '16px',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      boxSizing: 'border-box',
                      outline: 'none',
                      backgroundColor: isCreating ? '#f5f5f5' : '#fff',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    disabled={isCreating}
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      height: '36px',
                      padding: '0 16px',
                      width: 'auto',
                      margin: '0',
                      whiteSpace: 'nowrap',
                      backgroundColor: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      cursor: isCreating ? 'not-allowed' : 'pointer',
                      color: '#666',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: '1',
                      fontSize: '15px',
                      fontWeight: '500',
                      opacity: isCreating ? 0.6 : 1,
                    }}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleAddViaUrlConfirm}
                    disabled={isCreating || !urlInput.trim()}
                    style={{
                      height: '36px',
                      padding: '0 16px',
                      width: 'auto',
                      margin: '0',
                      whiteSpace: 'nowrap',
                      backgroundColor: '#007bff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isCreating || !urlInput.trim() ? 'not-allowed' : 'pointer',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '15px',
                      opacity: isCreating || !urlInput.trim() ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: '1',
                    }}
                  >
                    {isCreating ? t('creating') : t('confirm')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isSettingsModalOpen && (
        <ProjectSettingsModal
          projectName={projectName || ''}
          workDir={workDir}
          onSelectWorkDir={handleSelectWorkDir}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}

      {isPreviewModalOpen && loadedNovel && (
        <NovelPreviewModal
          novel={loadedNovel}
          projectName={projectName || ''}
          workDir={workDir}
          nextOrder={chapters.length > 0 ? Math.max(...chapters.map((c) => c.Order)) + 1 : 1}
          onClose={() => {
            setIsPreviewModalOpen(false)
            setLoadedNovel(null)
          }}
          onSaveSuccess={async () => {
            setIsPreviewModalOpen(false)
            setLoadedNovel(null)
            await fetchChapters()
          }}
        />
      )}
      {/* Right-click context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            zIndex: 2000,
            minWidth: '140px',
            padding: '4px',
            boxSizing: 'border-box',
          }}
        >
          {currentProject?.ProjectType === ProjectType.ProjectTypeComic ? (
            <button
              onClick={() => handleExportLp(contextMenu.chapter)}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                boxSizing: 'border-box',
                margin: 0,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#333',
                lineHeight: '1.4',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {t('exportLp', '导出 LP')}
            </button>
          ) : (
            <button
              onClick={() => handleExportNovel(contextMenu.chapter)}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                boxSizing: 'border-box',
                margin: 0,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#333',
                lineHeight: '1.4',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {t('export', '导出')}
            </button>
          )}
          <button
            onClick={() => openDeleteModal(contextMenu.chapter)}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              boxSizing: 'border-box',
              margin: 0,
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#dc3545',
              lineHeight: '1.4',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fff5f5')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {t('delete', 'Delete')}
          </button>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
          }}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '440px',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc3545"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: '16px' }}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>

            <h2
              style={{
                marginTop: 0,
                marginBottom: '12px',
                fontSize: '20px',
                fontWeight: '600',
                color: '#1a1a1a',
              }}
            >
              {t('deleteChapterTitle')}
            </h2>

            <p
              style={{
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#666',
                margin: '0 0 8px 0',
              }}
            >
              {t('deleteWarningTextChapter')}
            </p>

            <p
              style={{
                fontSize: '15px',
                fontWeight: '600',
                color: '#333',
                margin: '0 0 24px 0',
              }}
            >
              {deleteTarget.Title}
            </p>

            {deleteError && (
              <p style={{ color: '#dc3545', fontSize: '13px', margin: '0 0 16px 0' }}>
                {deleteError}
              </p>
            )}

            <div
              style={{
                display: 'flex',
                width: '100%',
                gap: '12px',
              }}
            >
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                style={{
                  flex: 1,
                  height: '40px',
                  backgroundColor: '#f3f4f6',
                  color: '#4b5563',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => {
                  if (!deleting) e.currentTarget.style.backgroundColor = '#e5e7eb'
                }}
                onMouseOut={(e) => {
                  if (!deleting) e.currentTarget.style.backgroundColor = '#f3f4f6'
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={deleteCountdown > 0 || deleting}
                onClick={handleConfirmDelete}
                style={{
                  flex: 1,
                  height: '40px',
                  backgroundColor: deleteCountdown > 0 || deleting ? '#fca5a5' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: deleteCountdown > 0 || deleting ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => {
                  if (deleteCountdown === 0 && !deleting)
                    e.currentTarget.style.backgroundColor = '#b91c1c'
                }}
                onMouseOut={(e) => {
                  if (deleteCountdown === 0 && !deleting)
                    e.currentTarget.style.backgroundColor = '#dc3545'
                }}
              >
                {deleting
                  ? t('saving')
                  : deleteCountdown > 0
                    ? t('confirmWithCountdown', { seconds: deleteCountdown })
                    : t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChaptersPage

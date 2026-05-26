import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Editor from './widgets/Editor'
import AlignmentLines from './widgets/AlignmentLines'
import { getParagraphBlocks } from './utils/quillUtils'
import {
  ListProjects,
  ListChapters,
  ReadChapter,
  NextChunk,
  PrevChunk,
  UpdateOriginalChunk,
  UpdateTranslatedChunk,
  SaveChapter,
  GetProjectAiConfigKey,
  GetAiConfig,
  GetProjectTranslatorKey,
  GetTranslators,
  CreateReusableTranslator,
  DestroyReusableTranslator,
  TranslateWithHandle,
  TranslateWithParams,
  GetTranslationEventName,
  CancelTranslation,
  GetChapterMeta,
  SetCurrentChunkTranslated,
  SetCurrentChunkReviewed,
  ExportTranslatedChapter,
} from '../bindings/github.com/syriku/transmas/service/agentservice'
import FloatingSettingsMenu from './widgets/FloatingSettingsMenu'
import Quill from 'quill'
import { useApp } from './AppContext'
import { Events, Dialogs } from '@wailsio/runtime'
import Toast from './widgets/Toast'

function EditorPage() {
  const { t } = useTranslation()
  const [sourceQuill, setSourceQuill] = useState<Quill | null>(null)
  const [targetQuill, setTargetQuill] = useState<Quill | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { currentProject, currentChapter, setCurrentProject, setCurrentChapter } = useApp()

  const [sourceLinesCount, setSourceLinesCount] = useState(0)
  const [targetLinesCount, setTargetLinesCount] = useState(0)
  const editorContainerRef = useRef<HTMLDivElement>(null)

  const query = new URLSearchParams(location.search)
  const projectName = query.get('project')
  const chapterOrderStr = query.get('chapter')
  const chapterOrder = chapterOrderStr ? parseInt(chapterOrderStr) : null

  const [chunkPage, setChunkPage] = useState(1)
  const [hasReachedEnd, setHasReachedEnd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialDelta, setInitialDelta] = useState<any>(null)
  const [initialTargetDelta, setInitialTargetDelta] = useState<any>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showExitPromptModal, setShowExitPromptModal] = useState(false)
  const [showLoadPromptModal, setShowLoadPromptModal] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [totalChunks, setTotalChunks] = useState(1)
  const [translating, setTranslating] = useState(false)
  const [translatorHandle, setTranslatorHandle] = useState<number | null>(null)
  const [chapterMeta, setChapterMeta] = useState<any>(null)
  const [detailed, setDetailed] = useState(false)

  const activeStreamHandleRef = useRef<string | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const streamBufferRef = useRef<{
    nextSeq: number
    pending: Map<number, any>
  }>({ nextSeq: 0, pending: new Map() })

  useEffect(() => {
    if (projectName) {
      setSelectedModel(localStorage.getItem(`transmas_selected_model_${projectName}`) || '')
    }
  }, [projectName])

  useEffect(() => {
    let activeHandle: number | null = null

    const initHandle = async () => {
      if (totalChunks > 1 && projectName && selectedModel) {
        try {
          const handle = await CreateReusableTranslator(projectName, selectedModel)
          activeHandle = handle
          setTranslatorHandle(handle)
          console.log('Created reusable translator handle:', handle)
        } catch (err) {
          console.error('Failed to create reusable translator:', err)
        }
      }
    }

    initHandle()

    return () => {
      if (activeHandle !== null) {
        console.log('Destroying reusable translator handle:', activeHandle)
        DestroyReusableTranslator(activeHandle).catch((err) => {
          console.error('Failed to destroy reusable translator:', err)
        })
      }
    }
  }, [projectName, selectedModel, totalChunks])

  useEffect(() => {
    const syncProject = async () => {
      if (projectName && (!currentProject || currentProject.Title !== projectName)) {
        try {
          const projects = await ListProjects()
          const found = projects.find((p: any) => p.Title === projectName)
          if (found) {
            setCurrentProject(found)
          }
        } catch (err) {
          console.error('Failed to sync project details in editor:', err)
        }
      }
    }
    syncProject()
  }, [projectName, currentProject])

  useEffect(() => {
    if (!sourceQuill || !targetQuill) return

    const updateCounts = () => {
      setSourceLinesCount(getParagraphBlocks(sourceQuill).length)
      setTargetLinesCount(getParagraphBlocks(targetQuill).length)
    }

    // Initial count
    updateCounts()

    const handleSourceChange = () => setTimeout(updateCounts, 0)
    const handleTargetChange = () => setTimeout(updateCounts, 0)

    sourceQuill.on('text-change', handleSourceChange)
    targetQuill.on('text-change', handleTargetChange)

    return () => {
      sourceQuill.off('text-change', handleSourceChange)
      targetQuill.off('text-change', handleTargetChange)
    }
  }, [sourceQuill, targetQuill])

  useEffect(() => {
    const syncChapter = async () => {
      if (
        projectName &&
        chapterOrder !== null &&
        (!currentChapter || currentChapter.Order !== chapterOrder)
      ) {
        try {
          const chapters = await ListChapters(projectName)
          const found = chapters.find((c: any) => c.Order === chapterOrder)
          if (found) {
            setCurrentChapter(found)
          }
        } catch (err) {
          console.error('Failed to sync chapter details in editor:', err)
        }
      }
    }
    syncChapter()
  }, [projectName, chapterOrder, currentChapter])

  const isChunkModified = () => {
    if (!sourceQuill || !initialDelta) {
      console.log('isChunkModified: sourceQuill or initialDelta is null', {
        sourceQuill: !!sourceQuill,
        initialDelta: !!initialDelta,
      })
      return false
    }
    const currentDelta = sourceQuill.getContents()
    const currentStr = JSON.stringify(currentDelta)
    const initialStr = JSON.stringify(initialDelta)
    const modified = currentStr !== initialStr
    console.log('isChunkModified:', modified, { currentStr, initialStr })
    return modified
  }

  const isTargetChunkModified = () => {
    if (!targetQuill || !initialTargetDelta) {
      console.log('isTargetChunkModified: targetQuill or initialTargetDelta is null', {
        targetQuill: !!targetQuill,
        initialTargetDelta: !!initialTargetDelta,
      })
      return false
    }
    const currentDelta = targetQuill.getContents()
    const currentStr = JSON.stringify(currentDelta)
    const initialStr = JSON.stringify(initialTargetDelta)
    const modified = currentStr !== initialStr
    console.log('isTargetChunkModified:', modified, { currentStr, initialStr })
    return modified
  }

  const updateCurrentChunkIfNeeded = async () => {
    const promises: Promise<any>[] = []
    if (isChunkModified()) {
      const currentDelta = sourceQuill!.getContents()
      promises.push(
        UpdateOriginalChunk(currentDelta as any).then(() => {
          setInitialDelta(currentDelta)
        }),
      )
    }
    if (isTargetChunkModified()) {
      const currentDelta = targetQuill!.getContents()
      promises.push(
        UpdateTranslatedChunk(currentDelta as any).then(() => {
          setInitialTargetDelta(currentDelta)
        }),
      )
    }
    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }

  const applyChunkInfo = (chunkInfo: any) => {
    if (!sourceQuill) return
    setChunkPage(chunkInfo.current)
    setHasReachedEnd(chunkInfo.current >= chunkInfo.total)
    setTotalChunks(chunkInfo.total)
    setIsDirty(chunkInfo.dirty)
    if (chunkInfo.delta) {
      sourceQuill.setContents(chunkInfo.delta as any)
    } else {
      sourceQuill.setText('')
    }
    setInitialDelta(sourceQuill.getContents())
    if (targetQuill) {
      if (chunkInfo.translatedDelta) {
        targetQuill.setContents(chunkInfo.translatedDelta as any)
      } else {
        targetQuill.setText('')
      }
      setInitialTargetDelta(targetQuill.getContents())
    }
  }

  const fetchChapterMeta = async () => {
    try {
      const meta = await GetChapterMeta()
      setChapterMeta(meta)
    } catch (err) {
      console.error('Failed to fetch chapter meta:', err)
    }
  }

  const handleTranslatedChange = async (completed: boolean) => {
    try {
      await SetCurrentChunkTranslated(completed)
      const currentlyReviewed = !!chapterMeta?.reviewedChunks?.includes(chunkPage)
      if (!completed && currentlyReviewed) {
        await SetCurrentChunkReviewed(false)
      }
      await fetchChapterMeta()
    } catch (err: any) {
      console.error('Failed to set translated status:', err)
      setToast({ message: t('failedToSave') + (err.message || String(err)), type: 'error' })
    }
  }

  const handleReviewedChange = async (completed: boolean) => {
    try {
      await SetCurrentChunkReviewed(completed)
      await fetchChapterMeta()
    } catch (err: any) {
      console.error('Failed to set reviewed status:', err)
      setToast({ message: t('failedToSave') + (err.message || String(err)), type: 'error' })
    }
  }

  const cancelActiveTranslation = async () => {
    if (activeStreamHandleRef.current) {
      const handle = activeStreamHandleRef.current
      activeStreamHandleRef.current = null
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      try {
        await CancelTranslation(handle)
      } catch (err) {
        console.error('Failed to cancel translation:', err)
      }
    }
    setTranslating(false)
  }

  const handleBack = () => {
    cancelActiveTranslation()
    const modified = isChunkModified() || isTargetChunkModified()
    console.log('handleBack clicked', { modified, isDirty })
    if (modified || isDirty) {
      setShowExitPromptModal(true)
    } else {
      navigate(-1)
    }
  }

  const handleSaveAndExit = async () => {
    setLoading(true)
    try {
      await updateCurrentChunkIfNeeded()
      await SaveChapter()
      setIsDirty(false)
      setShowExitPromptModal(false)
      navigate(-1)
    } catch (err: any) {
      console.error('Failed to save chapter before exit:', err)
      setToast({ message: t('failedToSave') + (err.message || String(err)), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleDiscardAndExit = () => {
    setShowExitPromptModal(false)
    navigate(-1)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await updateCurrentChunkIfNeeded()
      await SaveChapter()
      setIsDirty(false)
      setToast({ message: t('saveSuccess'), type: 'success' })
      await fetchChapterMeta()
    } catch (err: any) {
      console.error('Failed to save chapter:', err)
      setToast({ message: t('failedToSave') + (err.message || String(err)), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!currentChapter) return
    setLoading(true)
    try {
      await updateCurrentChunkIfNeeded()
      await SaveChapter()
      setIsDirty(false)
      const latestMeta = await GetChapterMeta()
      setChapterMeta(latestMeta)

      let suffix = t('exportSuffixExported')
      if (latestMeta && totalChunks > 0) {
        const isAllReviewed = Array.from({ length: totalChunks }, (_, i) => i + 1).every((chunk) =>
          latestMeta.reviewedChunks?.includes(chunk),
        )
        if (isAllReviewed) {
          suffix = t('exportSuffixReviewed')
        } else {
          const isAllTranslated = Array.from({ length: totalChunks }, (_, i) => i + 1).every(
            (chunk) => latestMeta.translatedChunks?.includes(chunk),
          )
          if (isAllTranslated) {
            suffix = t('exportSuffixTranslated')
          }
        }
      }

      const defaultFilename = `${currentChapter.Title.replace(/\.txt$/i, '')}${suffix}.txt`

      const filePath = await Dialogs.SaveFile({
        Title: t('export'),
        Filename: defaultFilename,
        Filters: [{ DisplayName: 'Text Files', Pattern: '*.txt' }],
      })
      if (filePath) {
        await ExportTranslatedChapter(filePath)
        setToast({ message: t('exportSuccess'), type: 'success' })
      }
    } catch (err: any) {
      console.error('Failed to export:', err)
      setToast({ message: t('failedToExport') + (err.message || String(err)), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmLoadForce = async () => {
    setShowLoadPromptModal(false)
    setLoading(true)
    try {
      const forceInfo = await ReadChapter(projectName!, chapterOrder!, true)
      applyChunkInfo(forceInfo)
      await fetchChapterMeta()
    } catch (innerErr: any) {
      setToast({
        message: '强制加载失败: ' + (innerErr.message || String(innerErr)),
        type: 'error',
      })
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelLoadForce = () => {
    setShowLoadPromptModal(false)
    navigate(-1)
  }

  useEffect(() => {
    const loadChapterContent = async () => {
      if (projectName && chapterOrder !== null && sourceQuill && targetQuill) {
        setLoading(true)
        try {
          const chunkInfo = await ReadChapter(projectName, chapterOrder, false)
          if (chunkInfo.unsavedChanges) {
            setShowLoadPromptModal(true)
            return
          }
          applyChunkInfo(chunkInfo)
          await fetchChapterMeta()
        } catch (err: any) {
          console.error('Failed to read chapter:', err)
          const errStr = err.message || String(err)
          setToast({ message: t('failedToReadChapter') + errStr, type: 'error' })
        } finally {
          setLoading(false)
        }
      }
    }
    loadChapterContent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, chapterOrder, sourceQuill, targetQuill])

  const handleNextChunk = async () => {
    await cancelActiveTranslation()
    setLoading(true)
    try {
      await updateCurrentChunkIfNeeded()
      const chunkInfo = await NextChunk()
      if (sourceQuill) {
        if (chunkInfo.delta) {
          sourceQuill.setContents(chunkInfo.delta as any)
        } else {
          sourceQuill.setText('')
        }
        setInitialDelta(sourceQuill.getContents())
      }
      if (targetQuill) {
        if (chunkInfo.translatedDelta) {
          targetQuill.setContents(chunkInfo.translatedDelta as any)
        } else {
          targetQuill.setText('')
        }
        setInitialTargetDelta(targetQuill.getContents())
      }
      setChunkPage(chunkInfo.current)
      setHasReachedEnd(chunkInfo.current >= chunkInfo.total)
      setIsDirty(chunkInfo.dirty)
      await fetchChapterMeta()
    } catch (err: any) {
      console.error('Failed to load next chunk:', err)
      const errStr = err.message || String(err)
      if (errStr.includes('already at the last chunk')) {
        setHasReachedEnd(true)
      } else {
        setToast({ message: t('failedToReadChapter') + errStr, type: 'error' })
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePrevChunk = async () => {
    if (chunkPage <= 1) return
    await cancelActiveTranslation()
    setLoading(true)
    try {
      await updateCurrentChunkIfNeeded()
      const chunkInfo = await PrevChunk()
      if (sourceQuill) {
        if (chunkInfo.delta) {
          sourceQuill.setContents(chunkInfo.delta as any)
        } else {
          sourceQuill.setText('')
        }
        setInitialDelta(sourceQuill.getContents())
      }
      if (targetQuill) {
        if (chunkInfo.translatedDelta) {
          targetQuill.setContents(chunkInfo.translatedDelta as any)
        } else {
          targetQuill.setText('')
        }
        setInitialTargetDelta(targetQuill.getContents())
      }
      setChunkPage(chunkInfo.current)
      setHasReachedEnd(chunkInfo.current >= chunkInfo.total)
      setIsDirty(chunkInfo.dirty)
      await fetchChapterMeta()
    } catch (err: any) {
      console.error('Failed to load previous chunk:', err)
      const errStr = err.message || String(err)
      setToast({ message: t('failedToReadChapter') + errStr, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (activeStreamHandleRef.current) {
        CancelTranslation(activeStreamHandleRef.current).catch((err) => {
          console.error('Failed to cancel translation on unmount:', err)
        })
      }
    }
  }, [])

  const handleTranslate = async () => {
    if (!sourceQuill || !targetQuill || !projectName) return

    // 1. Check if model is selected
    if (!selectedModel) {
      setToast({ message: t('noModelSelected'), type: 'error' })
      return
    }

    // 2. Check settings: both AI Config and Translator must be set
    try {
      const configKey = await GetProjectAiConfigKey(projectName)
      const translatorKey = await GetProjectTranslatorKey(projectName)
      if (!configKey || !translatorKey) {
        setToast({ message: t('settingsMissingError'), type: 'error' })
        return
      }

      const aiConfigs = await GetAiConfig()
      const translators = await GetTranslators()
      if (!aiConfigs[configKey] || !translators[translatorKey]) {
        setToast({ message: t('settingsMissingError'), type: 'error' })
        return
      }
    } catch (err: any) {
      console.error('Failed to verify project settings:', err)
      setToast({ message: t('translationFailed') + (err.message || String(err)), type: 'error' })
      return
    }

    // 3. Clear active stream
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    setTranslating(true)
    targetQuill.setText('')
    streamBufferRef.current = { nextSeq: 0, pending: new Map() }

    // Get event name
    let eventName = 'translation-stream'
    try {
      eventName = await GetTranslationEventName()
    } catch (err) {
      console.error('Failed to get translation event name:', err)
    }

    try {
      // 4. Trigger translation API
      let resp: any
      if (totalChunks === 1) {
        resp = await TranslateWithParams(projectName, selectedModel, detailed)
      } else {
        if (translatorHandle === null) {
          throw new Error('reusable translator handle is not initialized')
        }
        resp = await TranslateWithHandle(translatorHandle, detailed)
      }

      // 5. Store current handle for event matching
      activeStreamHandleRef.current = resp.handle

      if (!resp.async) {
        // Sync response
        targetQuill.setText(resp.translated || '')
        setInitialTargetDelta(targetQuill.getContents())
        setIsDirty(true)
        setToast({ message: t('translationSuccess'), type: 'success' })
        setTranslating(false)
      } else {
        // Async stream response: setup listener
        const unsubscribe = Events.On(eventName, (event: any) => {
          const payload = event.data
          if (payload.handle !== activeStreamHandleRef.current) {
            return
          }

          const buf = streamBufferRef.current
          buf.pending.set(payload.seq, payload)

          // Flush all consecutive chunks starting from nextSeq
          while (buf.pending.has(buf.nextSeq)) {
            const chunk = buf.pending.get(buf.nextSeq)!
            buf.pending.delete(buf.nextSeq)
            buf.nextSeq++

            if (chunk.text) {
              targetQuill.insertText(targetQuill.getLength() - 1, chunk.text)
            }

            if (chunk.error) {
              setToast({ message: t('translationFailed') + chunk.error, type: 'error' })
              setTranslating(false)
              if (unsubscribeRef.current) {
                unsubscribeRef.current()
                unsubscribeRef.current = null
              }
              return
            }

            if (chunk.completed) {
              setInitialTargetDelta(targetQuill.getContents())
              setIsDirty(true)
              setToast({ message: t('translationSuccess'), type: 'success' })
              setTranslating(false)
              if (unsubscribeRef.current) {
                unsubscribeRef.current()
                unsubscribeRef.current = null
              }
              return
            }
          }
        })

        unsubscribeRef.current = unsubscribe
      }
    } catch (err: any) {
      console.error('Translation failed:', err)
      setToast({ message: t('translationFailed') + (err.message || String(err)), type: 'error' })
      setTranslating(false)
    }
  }

  const isTranslated = !!chapterMeta?.translatedChunks?.includes(chunkPage)
  const isReviewed = !!chapterMeta?.reviewedChunks?.includes(chunkPage)

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
            onClick={handleBack}
            title={t('back')}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleExport}
            disabled={loading || translating}
            style={{
              width: 'auto',
              whiteSpace: 'nowrap',
              height: '40px',
              padding: '0 16px',
              backgroundColor: loading || translating ? '#8fc0eb' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading || translating ? 'not-allowed' : 'pointer',
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
              if (!loading && !translating) e.currentTarget.style.backgroundColor = '#0056b3'
            }}
            onMouseOut={(e) => {
              if (!loading && !translating) e.currentTarget.style.backgroundColor = '#007bff'
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
            {t('export')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading || translating}
            style={{
              width: 'auto',
              whiteSpace: 'nowrap',
              height: '40px',
              padding: '0 16px',
              backgroundColor: loading || translating ? '#8fd19e' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading || translating ? 'not-allowed' : 'pointer',
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
              if (!loading && !translating) e.currentTarget.style.backgroundColor = '#218838'
            }}
            onMouseOut={(e) => {
              if (!loading && !translating) e.currentTarget.style.backgroundColor = '#28a745'
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
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {t('save')}
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
          marginBottom: '16px',
          marginTop: '10px',
          width: '100%',
        }}
      >
        <button
          disabled={chunkPage === 1 || loading}
          onClick={handlePrevChunk}
          style={{
            width: 'auto',
            whiteSpace: 'nowrap',
            height: '36px',
            padding: '0 16px',
            backgroundColor: chunkPage === 1 || loading ? '#f0f0f0' : 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: chunkPage === 1 || loading ? 'not-allowed' : 'pointer',
            color: chunkPage === 1 || loading ? '#999' : '#333',
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
          onMouseOver={(e) => {
            if (chunkPage > 1 && !loading) {
              e.currentTarget.style.backgroundColor = '#f0f0f0'
              e.currentTarget.style.borderColor = '#ccc'
            }
          }}
          onMouseOut={(e) => {
            if (chunkPage > 1 && !loading) {
              e.currentTarget.style.backgroundColor = 'white'
              e.currentTarget.style.borderColor = '#ddd'
            }
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
            <path d="m15 18-6-6 6-6" />
          </svg>
          {t('prevChunk')}
        </button>

        <span
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#666',
            minWidth: '100px',
            textAlign: 'center',
            backgroundColor: 'white',
            padding: '6px 16px',
            borderRadius: '20px',
            border: '1px solid #eee',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          }}
        >
          {t('chunkPageInfo', { page: chunkPage })}
        </span>

        <button
          disabled={hasReachedEnd || loading}
          onClick={handleNextChunk}
          style={{
            width: 'auto',
            whiteSpace: 'nowrap',
            height: '36px',
            padding: '0 16px',
            backgroundColor: hasReachedEnd || loading ? '#f0f0f0' : 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: hasReachedEnd || loading ? 'not-allowed' : 'pointer',
            color: hasReachedEnd || loading ? '#999' : '#333',
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
          onMouseOver={(e) => {
            if (!hasReachedEnd && !loading) {
              e.currentTarget.style.backgroundColor = '#f0f0f0'
              e.currentTarget.style.borderColor = '#ccc'
            }
          }}
          onMouseOut={(e) => {
            if (!hasReachedEnd && !loading) {
              e.currentTarget.style.backgroundColor = 'white'
              e.currentTarget.style.borderColor = '#ddd'
            }
          }}
        >
          {t('nextChunk')}
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
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Horizontal divider to separate sticky header and scroll area */}
      <div style={{ width: '100%', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' }} />

      {sourceQuill && targetQuill && isTranslated && sourceLinesCount !== targetLinesCount && (
        <div
          style={{
            backgroundColor: '#ffebeb',
            color: '#d32f2f',
            padding: '12px 24px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid #ffcdd2',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          ⚠️{' '}
          {t('paragraphMismatchWarning', {
            defaultValue: `段落数量不匹配（原文: ${sourceLinesCount} 段, 译文: ${targetLinesCount} 段）`,
          })}
        </div>
      )}

      <div
        ref={editorContainerRef}
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '30px',
          width: '100%',
          justifyContent: 'center',
          position: 'relative',
          flex: 1,
          overflowY: 'auto',
          paddingRight: '8px',
          paddingBottom: '60px',
          boxSizing: 'border-box',
        }}
      >
        <AlignmentLines
          sourceQuill={sourceQuill}
          targetQuill={targetQuill}
          isMatched={sourceLinesCount === targetLinesCount}
          containerRef={editorContainerRef}
        />
        <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
          <Editor
            ref={setSourceQuill}
            plainTextOnly
            autoExpand
            style={{
              minHeight: '500px',
              background: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
          <Editor
            ref={setTargetQuill}
            plainTextOnly
            autoExpand
            style={{
              minHeight: '500px',
              background: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              borderRadius: '8px',
              border:
                isTranslated && sourceQuill && targetQuill && sourceLinesCount !== targetLinesCount
                  ? '2px solid #d32f2f'
                  : isTranslated && isReviewed
                    ? '2px solid #8ee3b4'
                    : isTranslated
                      ? '2px solid #a5d8ff'
                      : '1px solid #e0e0e0',
              transition: 'border-color 0.2s',
            }}
          />
        </div>
      </div>

      {/* Exit confirmation modal */}
      {showExitPromptModal && (
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
            zIndex: 2000,
          }}
          onClick={() => setShowExitPromptModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '16px',
              width: '450px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              boxSizing: 'border-box',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: '600' }}>
              {t('confirm')}
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#555', lineHeight: '1.5' }}>
              {t('unsavedChangesExitPrompt')}
            </p>
            <div
              style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}
            >
              <button
                onClick={() => setShowExitPromptModal(false)}
                style={{
                  width: 'auto',
                  whiteSpace: 'nowrap',
                  height: '36px',
                  padding: '0 16px',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  lineHeight: '1',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white'
                }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDiscardAndExit}
                style={{
                  width: 'auto',
                  whiteSpace: 'nowrap',
                  height: '36px',
                  padding: '0 16px',
                  backgroundColor: '#dc3545',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  lineHeight: '1',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#bd2130'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc3545'
                }}
              >
                {t('discardAndExit')}
              </button>
              <button
                onClick={handleSaveAndExit}
                style={{
                  width: 'auto',
                  whiteSpace: 'nowrap',
                  height: '36px',
                  padding: '0 16px',
                  backgroundColor: '#28a745',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  lineHeight: '1',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#218838'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#28a745'
                }}
              >
                {t('saveAndExit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load confirmation modal */}
      {showLoadPromptModal && (
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
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '16px',
              width: '450px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: '600' }}>
              {t('confirm')}
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#555', lineHeight: '1.5' }}>
              {t('unsavedChangesLoadPrompt')}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelLoadForce}
                style={{
                  width: 'auto',
                  whiteSpace: 'nowrap',
                  height: '36px',
                  padding: '0 16px',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  lineHeight: '1',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white'
                }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirmLoadForce}
                style={{
                  width: 'auto',
                  whiteSpace: 'nowrap',
                  height: '36px',
                  padding: '0 16px',
                  backgroundColor: '#dc3545',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  lineHeight: '1',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#bd2130'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc3545'
                }}
              >
                {t('forceDiscardAndLoad')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <FloatingSettingsMenu
        projectName={projectName}
        setToast={setToast}
        handleTranslate={handleTranslate}
        translating={translating}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        translated={!!chapterMeta?.translatedChunks?.includes(chunkPage)}
        reviewed={!!chapterMeta?.reviewedChunks?.includes(chunkPage)}
        onTranslatedChange={handleTranslatedChange}
        onReviewedChange={handleReviewedChange}
        detailed={detailed}
        onDetailedChange={setDetailed}
      />
    </div>
  )
}

export default EditorPage

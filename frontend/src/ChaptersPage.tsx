import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ItemCard from './widgets/ItemCard'
import ProjectSettingsModal from './widgets/ProjectSettingsModal'
// @ts-ignore
import {
  ListChapters,
  AddChapter,
  ListProjects,
  UpdateProjectDir,
  GetChapterStatus,
} from '../bindings/github.com/syriku/transmas/service/agentservice'
// @ts-ignore
import {
  SetWorkDir,
  ListCandidateChapters,
} from '../bindings/github.com/syriku/transmas/service/systemservice'

import { useApp } from './AppContext'
import { Chapter } from '../bindings/github.com/syriku/transmas/agents/database/models'

const ChaptersPage: React.FC = () => {
  const { t } = useTranslation()
  const { projectName } = useParams<{ projectName: string }>()
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [chapterStatuses, setChapterStatuses] = useState<Record<number, number>>({})
  const [workDir, setWorkDir] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [candidates, setCandidates] = useState<string[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const navigate = useNavigate()
  const { currentProject, setCurrentProject, setCurrentChapter } = useApp()

  useEffect(() => {
    if (isModalOpen && workDir) {
      ListCandidateChapters(workDir)
        .then((list: string[]) => {
          const existingTitles = new Set(chapters.map((c) => c.Title))
          const available = (list || []).filter((title) => !existingTitles.has(title))
          setCandidates(available)
        })
        .catch((err: any) => {
          console.error('Failed to fetch candidate chapters:', err)
        })
    } else if (!isModalOpen) {
      setCandidates([])
      setIsDropdownOpen(false)
    }
  }, [isModalOpen, workDir, chapters])

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

      const statuses: Record<number, number> = {}
      if (list && list.length > 0) {
        await Promise.all(
          list.map(async (c) => {
            try {
              const status = await GetChapterStatus(projectName, c.Order)
              statuses[c.Order] = status
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

  const handleChapterClick = (chapter: Chapter) => {
    setCurrentChapter(chapter)
    navigate(`/editor?project=${encodeURIComponent(projectName || '')}&chapter=${chapter.Order}`)
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
                padding: '0 20px',
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
                fontSize: '14px',
                fontWeight: '500',
                lineHeight: '1',
                whiteSpace: 'nowrap',
              }}
            >
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
                  status={chapterStatuses[chapter.Order]}
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
            }}
            onClick={(e) => {
              e.stopPropagation()
              setIsDropdownOpen(false)
            }}
          >
            <h2 style={{ margin: '0 0 20px 0' }}>{t('newChapter')}</h2>
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
                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
                    isCreating || !candidates.includes(newTitle.trim()) ? 'not-allowed' : 'pointer',
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
    </div>
  )
}

export default ChaptersPage

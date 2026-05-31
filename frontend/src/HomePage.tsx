import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ItemCard from './widgets/ItemCard'
import UserSettingsModal from './widgets/UserSettingsModal'
// @ts-ignore
import {
  ListProjects,
  AddProject,
  RenameProject,
  DeleteProject,
} from '../bindings/github.com/syriku/transmas/service/agentservice'

import { useApp } from './AppContext'
import { ProjectInfo } from '../bindings/github.com/syriku/transmas/agents/database/models'

const HomePage: React.FC = () => {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const navigate = useNavigate()
  const { setCurrentProject, logout } = useApp()

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    project: ProjectInfo
  } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState<ProjectInfo | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteCountdown, setDeleteCountdown] = useState(4)
  const [deleteTarget, setDeleteTarget] = useState<ProjectInfo | null>(null)
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

  const fetchProjects = async () => {
    console.log('Fetching projects...')
    setLoading(true)
    setError('')
    try {
      const list = await ListProjects()
      console.log('Projects fetched:', list)
      setProjects(list || [])
    } catch (err: any) {
      console.error('Failed to fetch projects:', err)
      setError(err.message || t('failedToLoadProjects'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects().then()
  }, [])

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

  const handleAddProject = async () => {
    if (!newTitle.trim()) return

    setIsCreating(true)
    try {
      console.log('Calling AddProject with:', newTitle.trim())
      await AddProject(newTitle.trim())
      console.log('AddProject successful')
      setNewTitle('')
      setIsModalOpen(false)
      await fetchProjects()
    } catch (err: any) {
      console.error('Failed to add project:', err)
      alert(t('failedToAddProject') + err.message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleProjectClick = (project: ProjectInfo) => {
    setCurrentProject(project)
    navigate(`/chapters/${encodeURIComponent(project.Title)}`)
  }

  const handleContextMenu = (e: React.MouseEvent, project: ProjectInfo) => {
    e.preventDefault()
    e.stopPropagation()
    // Clamp menu position synchronously to avoid overflow on any edge.
    // Menu estimated size: ~160w x ~44h. clientX/Y is viewport-relative,
    // matching position:fixed. Works on both WebKit (macOS) and WebView2 (Windows).
    const MENU_W = 160
    const MENU_H = 80
    const vw = window.innerWidth
    const vh = window.innerHeight
    const x = Math.min(Math.max(e.clientX, 0), vw - MENU_W - 4)
    const y = Math.min(Math.max(e.clientY, 0), vh - MENU_H - 4)
    setContextMenu({ x, y, project })
  }

  const openRenameModal = () => {
    if (!contextMenu) return
    setRenameTarget(contextMenu.project)
    setRenameTitle(contextMenu.project.Title)
    setContextMenu(null)
  }

  const handleRename = async () => {
    if (!renameTarget || !renameTitle.trim()) return
    if (renameTitle.trim() === renameTarget.Title) {
      setRenameTarget(null)
      return
    }

    setIsRenaming(true)
    try {
      await RenameProject(renameTarget.Title, renameTitle.trim())
      setRenameTarget(null)
      await fetchProjects()
    } catch (err: any) {
      console.error('Failed to rename project:', err)
      alert(t('failedToRenameProject', 'Failed to rename project: ') + err.message)
    } finally {
      setIsRenaming(false)
    }
  }

  const openDeleteModal = (project: ProjectInfo) => {
    setDeleteTarget(project)
    setDeleteCountdown(4)
    setDeleteError('')
    setDeleting(false)
    setShowDeleteModal(true)
    setContextMenu(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteCountdown > 0 || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      await DeleteProject(deleteTarget.Title)
      setShowDeleteModal(false)
      await fetchProjects()
    } catch (err: any) {
      setDeleteError(err.message || t('failedToDeleteProject'))
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
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '700' }}>{t('myProjects')}</h1>
          <div style={{ display: 'flex', gap: '12px' }}>
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
            <button
              onClick={() => {
                logout()
                navigate('/login')
              }}
              style={{
                height: '40px',
                padding: '0 20px',
                width: 'auto',
                margin: '0',
                backgroundColor: 'transparent',
                border: '1px dashed #dc3545',
                borderRadius: '8px',
                cursor: 'pointer',
                color: '#dc3545',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '500',
                lineHeight: '1',
                whiteSpace: 'nowrap',
              }}
            >
              {t('logout')}
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
            {t('loadingProjects')}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '32px',
            }}
          >
            {projects.map((project) => (
              <ItemCard
                key={project.ID}
                title={project.Title}
                onClick={() => handleProjectClick(project)}
                onContextMenu={(e) => handleContextMenu(e, project)}
              />
            ))}
            <ItemCard
              title=""
              isAdd
              addText={t('addProject')}
              onClick={() => setIsModalOpen(true)}
            />
          </div>
        )}
      </div>

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
          <button
            onClick={openRenameModal}
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
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f7fa')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {t('rename', 'Rename')}
          </button>
          <button
            onClick={() => openDeleteModal(contextMenu.project)}
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

      {/* Custom Modal for Adding Project */}
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
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0' }}>{t('newProject')}</h2>
            <input
              autoFocus
              type="text"
              placeholder={t('projectTitlePlaceholder')}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                boxSizing: 'border-box',
                outline: 'none',
                marginBottom: '20px',
              }}
            />
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
                disabled={isCreating || !newTitle.trim()}
                onClick={handleAddProject}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  width: 'auto',
                  margin: '0',
                  whiteSpace: 'nowrap',
                  backgroundColor: '#007bff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isCreating || !newTitle.trim() ? 'not-allowed' : 'pointer',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '15px',
                  opacity: isCreating || !newTitle.trim() ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1',
                }}
              >
                {isCreating ? t('creating') : t('createProject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
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
          onClick={() => !isRenaming && setRenameTarget(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '16px',
              width: '400px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0' }}>{t('renameProject', 'Rename Project')}</h2>
            <input
              autoFocus
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                borderRadius: '8px',
                border: '1px solid #ddd',
                boxSizing: 'border-box',
                outline: 'none',
                marginBottom: '20px',
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                disabled={isRenaming}
                onClick={() => setRenameTarget(null)}
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
                disabled={isRenaming || !renameTitle.trim()}
                onClick={handleRename}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  width: 'auto',
                  margin: '0',
                  whiteSpace: 'nowrap',
                  backgroundColor: '#007bff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isRenaming || !renameTitle.trim() ? 'not-allowed' : 'pointer',
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '15px',
                  opacity: isRenaming || !renameTitle.trim() ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1',
                }}
              >
                {isRenaming ? t('renaming', 'Renaming...') : t('confirm', 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSettingsModalOpen && <UserSettingsModal onClose={() => setIsSettingsModalOpen(false)} />}

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
              {t('deleteProjectTitle')}
            </h2>

            <p
              style={{
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#666',
                margin: '0 0 8px 0',
              }}
            >
              {t('deleteWarningText')}
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

export default HomePage

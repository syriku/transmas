import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
// @ts-ignore
import {
  AddProject,
  UpdateProjectDir,
} from '../../bindings/github.com/syriku/transmas/service/agentservice'
// @ts-ignore
import { SetWorkDir } from '../../bindings/github.com/syriku/transmas/service/systemservice'
import { ProjectType } from '../../bindings/github.com/syriku/transmas/agents/database/models'

interface AddProjectModalProps {
  onClose: () => void
  onSuccess: () => void
}

const AddProjectModal: React.FC<AddProjectModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [workDir, setWorkDir] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleSelectWorkDir = async () => {
    try {
      const selectedDir = await SetWorkDir()
      if (selectedDir) {
        setWorkDir(selectedDir)
      }
    } catch (err: any) {
      console.error('Failed to select work directory:', err)
      alert(t('failedToUpdateWorkDir', 'Failed to update work directory: ') + err.message)
    }
  }

  const handleCreate = async (type: ProjectType) => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    setIsCreating(true)
    try {
      // 1. Create the project
      await AddProject(trimmedTitle, type)

      // 2. If a working directory is specified, update it
      if (workDir) {
        await UpdateProjectDir(trimmedTitle, workDir)
      }

      onSuccess()
    } catch (err: any) {
      console.error('Failed to add project:', err)
      alert(t('failedToAddProject') + err.message)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={() => !isCreating && onClose()}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '16px',
          width: '440px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 24px 0', fontSize: '20px', fontWeight: '600', color: '#1a1a1a' }}>
          {t('newProject')}
        </h2>

        {/* Project Title Input */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#666',
              marginBottom: '8px',
            }}
          >
            {t('projectTitlePlaceholder')}
          </label>
          <input
            autoFocus
            type="text"
            placeholder={t('projectTitlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isCreating}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '15px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#007bff')}
            onBlur={(e) => (e.target.style.borderColor = '#ddd')}
          />
        </div>

        {/* Work Directory selection */}
        <div style={{ marginBottom: '32px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#666',
              marginBottom: '8px',
            }}
          >
            {t('workDirectory')}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              disabled={isCreating}
              onClick={handleSelectWorkDir}
              style={{
                height: '40px',
                padding: '0 16px',
                width: 'auto',
                margin: '0',
                lineHeight: '1',
                whiteSpace: 'nowrap',
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
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
              </svg>
              {t('selectWorkDir')}
            </button>
            {workDir && (
              <div
                style={{
                  fontSize: '13px',
                  color: '#555',
                  backgroundColor: '#f8f9fa',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef',
                  wordBreak: 'break-all',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  <strong>{t('workDirSelected')} </strong>
                  {workDir}
                </span>
                <button
                  type="button"
                  onClick={() => setWorkDir('')}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '0 4px',
                    width: 'auto',
                    height: 'auto',
                    margin: '0',
                    lineHeight: '1',
                  }}
                  title="Clear"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              disabled={isCreating || !title.trim()}
              onClick={() => handleCreate(ProjectType.ProjectTypeNovel)}
              style={{
                flex: 1,
                width: 'auto',
                margin: '0',
                lineHeight: '1',
                whiteSpace: 'nowrap',
                height: '42px',
                backgroundColor: '#007bff',
                border: 'none',
                borderRadius: '8px',
                cursor: isCreating || !title.trim() ? 'not-allowed' : 'pointer',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                opacity: isCreating || !title.trim() ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => {
                if (!isCreating && title.trim()) e.currentTarget.style.backgroundColor = '#0056b3'
              }}
              onMouseOut={(e) => {
                if (!isCreating && title.trim()) e.currentTarget.style.backgroundColor = '#007bff'
              }}
            >
              {isCreating ? t('creating') : t('createNovelProject')}
            </button>

            <button
              disabled={isCreating || !title.trim()}
              onClick={() => handleCreate(ProjectType.ProjectTypeComic)}
              style={{
                flex: 1,
                width: 'auto',
                margin: '0',
                lineHeight: '1',
                whiteSpace: 'nowrap',
                height: '42px',
                backgroundColor: '#28a745',
                border: 'none',
                borderRadius: '8px',
                cursor: isCreating || !title.trim() ? 'not-allowed' : 'pointer',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px',
                opacity: isCreating || !title.trim() ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => {
                if (!isCreating && title.trim()) e.currentTarget.style.backgroundColor = '#218838'
              }}
              onMouseOut={(e) => {
                if (!isCreating && title.trim()) e.currentTarget.style.backgroundColor = '#28a745'
              }}
            >
              {isCreating ? t('creating') : t('createComicProject')}
            </button>
          </div>

          <button
            disabled={isCreating}
            onClick={onClose}
            style={{
              width: '100%',
              margin: '0',
              lineHeight: '1',
              whiteSpace: 'nowrap',
              height: '38px',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              color: '#666',
              fontWeight: '500',
              fontSize: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              if (!isCreating) e.currentTarget.style.backgroundColor = '#f8f9fa'
            }}
            onMouseOut={(e) => {
              if (!isCreating) e.currentTarget.style.backgroundColor = 'white'
            }}
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddProjectModal

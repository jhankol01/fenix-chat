import { useState, useEffect, useRef } from 'react'
import { Plus, X, ChevronLeft, ChevronRight, Eye, Trash2, Send, ImagePlus, Type } from 'lucide-react'
import api from '../../lib/api'
import useAuthStore from '../../stores/authStore'
import './StoriesBar.css'

const STORY_COLORS = [
  '#7C3AED', '#0ea5e9', '#10b981', '#f43f5e', '#f59e0b',
  '#6366f1', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444',
]

function StoriesBar() {
  const [storyGroups, setStoryGroups] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [createMode, setCreateMode] = useState(null) // null | 'text' | 'photo'
  const [showViewer, setShowViewer] = useState(null) // { groupIndex, storyIndex }
  const [newStoryText, setNewStoryText] = useState('')
  const [selectedColor, setSelectedColor] = useState('#7C3AED')
  const [isCreating, setIsCreating] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const scrollRef = useRef(null)
  const progressRef = useRef(null)
  const timerRef = useRef(null)
  const fileInputRef = useRef(null)
  const user = useAuthStore(s => s.user)

  const loadStories = async () => {
    try {
      const data = await api.get('/stories')
      setStoryGroups(data.stories || [])
    } catch (err) {
      console.error('Error loading stories:', err)
    }
  }

  useEffect(() => {
    loadStories()
    const interval = setInterval(loadStories, 30000) // refresh every 30s
    return () => clearInterval(interval)
  }, [])

  // Handle photo selection
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
    setCreateMode('photo')
  }

  // Create story (text or photo)
  const handleCreate = async () => {
    if (isCreating) return

    if (createMode === 'photo' && photoFile) {
      setIsCreating(true)
      setUploadProgress(10)
      try {
        // Upload photo to B2
        const formData = new FormData()
        formData.append('media', photoFile)
        setUploadProgress(30)
        const uploadRes = await api.upload('/upload/media', formData)
        setUploadProgress(80)

        // Create story with image URL
        await api.post('/stories', {
          content: uploadRes.url,
          type: 'image',
          backgroundColor: selectedColor,
        })
        setUploadProgress(100)
        resetCreate()
        loadStories()
      } catch (err) {
        console.error('Story photo upload error:', err)
        setUploadProgress(0)
      }
      setIsCreating(false)
      return
    }

    // Text story
    if (!newStoryText.trim()) return
    setIsCreating(true)
    try {
      await api.post('/stories', {
        content: newStoryText.trim(),
        type: 'text',
        backgroundColor: selectedColor,
      })
      resetCreate()
      loadStories()
    } catch (_) {}
    setIsCreating(false)
  }

  const resetCreate = () => {
    setNewStoryText('')
    setPhotoPreview(null)
    setPhotoFile(null)
    setUploadProgress(0)
    setShowCreate(false)
    setCreateMode(null)
  }

  // View story
  const openStory = (groupIndex) => {
    setShowViewer({ groupIndex, storyIndex: 0 })
  }

  // Navigate stories
  const nextStory = () => {
    if (!showViewer) return
    const group = storyGroups[showViewer.groupIndex]
    if (showViewer.storyIndex < group.stories.length - 1) {
      setShowViewer({ ...showViewer, storyIndex: showViewer.storyIndex + 1 })
    } else if (showViewer.groupIndex < storyGroups.length - 1) {
      setShowViewer({ groupIndex: showViewer.groupIndex + 1, storyIndex: 0 })
    } else {
      setShowViewer(null)
    }
  }

  const prevStory = () => {
    if (!showViewer) return
    if (showViewer.storyIndex > 0) {
      setShowViewer({ ...showViewer, storyIndex: showViewer.storyIndex - 1 })
    } else if (showViewer.groupIndex > 0) {
      const prevGroup = storyGroups[showViewer.groupIndex - 1]
      setShowViewer({ groupIndex: showViewer.groupIndex - 1, storyIndex: prevGroup.stories.length - 1 })
    }
  }

  // Auto-advance timer + mark as viewed
  useEffect(() => {
    if (!showViewer) return
    const group = storyGroups[showViewer.groupIndex]
    if (!group) return
    const story = group.stories[showViewer.storyIndex]
    if (!story) return

    // Mark as viewed
    api.post(`/stories/${story.id}/view`).catch(() => {})

    // Auto-advance after 5 seconds
    timerRef.current = setTimeout(nextStory, 5000)
    return () => clearTimeout(timerRef.current)
  }, [showViewer])

  const handleDeleteStory = async (storyId) => {
    try {
      await api.delete(`/stories/${storyId}`)
      loadStories()
      setShowViewer(null)
    } catch (_) {}
  }

  const currentGroup = showViewer ? storyGroups[showViewer.groupIndex] : null
  const currentStory = currentGroup ? currentGroup.stories[showViewer.storyIndex] : null
  const myStories = storyGroups.find(g => g.userId === user?.id)

  return (
    <>
      {/* Stories horizontal bar */}
      <div className="stories-bar" ref={scrollRef}>
        {/* Add story button */}
        <button className="stories-bar__add" onClick={() => {
          // If I have stories, open viewer; otherwise open creator
          const myIdx = storyGroups.findIndex(g => g.userId === user?.id)
          if (myIdx >= 0 && storyGroups[myIdx].stories.length > 0) {
            openStory(myIdx)
          } else {
            setShowCreate(true)
          }
        }}>
          <div className={`stories-bar__avatar-ring ${myStories?.hasUnviewed ? 'stories-bar__avatar-ring--unviewed' : ''}`}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Mi story" className="stories-bar__avatar-img" />
            ) : (
              <div className="stories-bar__avatar-placeholder">
                {user?.username?.slice(0, 2).toUpperCase() || '?'}
              </div>
            )}
            <div className="stories-bar__add-icon"><Plus size={12} /></div>
          </div>
          <span className="stories-bar__name">Mi historia</span>
        </button>

        {/* Other users' stories */}
        {storyGroups.filter(g => g.userId !== user?.id).map((group) => (
          <button key={group.userId} className="stories-bar__item" onClick={() => openStory(storyGroups.indexOf(group))}>
            <div className={`stories-bar__avatar-ring ${group.hasUnviewed ? 'stories-bar__avatar-ring--unviewed' : 'stories-bar__avatar-ring--viewed'}`}>
              {group.avatarUrl ? (
                <img src={group.avatarUrl} alt={group.username} className="stories-bar__avatar-img" />
              ) : (
                <div className="stories-bar__avatar-placeholder">
                  {group.username?.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <span className="stories-bar__name">{group.username}</span>
          </button>
        ))}
      </div>

      {/* Create story modal */}
      {showCreate && (
        <div className="stories-create-overlay">
          {/* Mode picker (if no mode selected) */}
          {!createMode && (
            <div className="stories-create-picker">
              <button className="stories-create-picker__close" onClick={() => setShowCreate(false)}>
                <X size={22} color="white" />
              </button>
              <h3 className="stories-create-picker__title">Nueva historia</h3>
              <div className="stories-create-picker__options">
                <button className="stories-create-picker__option" onClick={() => setCreateMode('text')}>
                  <div className="stories-create-picker__icon" style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}>
                    <Type size={28} color="white" />
                  </div>
                  <span>Texto</span>
                </button>
                <button className="stories-create-picker__option" onClick={() => fileInputRef.current?.click()}>
                  <div className="stories-create-picker__icon" style={{ background: 'linear-gradient(135deg, #0ea5e9, #10b981)' }}>
                    <ImagePlus size={28} color="white" />
                  </div>
                  <span>Foto</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePhotoSelect}
              />
            </div>
          )}

          {/* Text creator */}
          {createMode === 'text' && (
            <div className="stories-create" style={{ background: selectedColor }}>
              <div className="stories-create__header">
                <button onClick={() => setCreateMode(null)}><X size={22} color="white" /></button>
                <span>Historia de texto</span>
                <button onClick={handleCreate} disabled={!newStoryText.trim() || isCreating}>
                  <Send size={20} color="white" />
                </button>
              </div>

              <textarea
                className="stories-create__input"
                placeholder="Escribe tu historia..."
                value={newStoryText}
                onChange={(e) => setNewStoryText(e.target.value)}
                autoFocus
                maxLength={500}
              />

              <div className="stories-create__colors">
                {STORY_COLORS.map(color => (
                  <button
                    key={color}
                    className={`stories-create__color ${selectedColor === color ? 'stories-create__color--active' : ''}`}
                    style={{ background: color }}
                    onClick={() => setSelectedColor(color)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Photo creator */}
          {createMode === 'photo' && photoPreview && (
            <div className="stories-create stories-create--photo">
              <div className="stories-create__header">
                <button onClick={() => { setCreateMode(null); setPhotoPreview(null); setPhotoFile(null) }}>
                  <X size={22} color="white" />
                </button>
                <span>Historia con foto</span>
                <button onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? (
                    <div className="stories-create__spinner" />
                  ) : (
                    <Send size={20} color="white" />
                  )}
                </button>
              </div>

              <div className="stories-create__photo-preview">
                <img src={photoPreview} alt="Preview" />
              </div>

              {uploadProgress > 0 && (
                <div className="stories-create__progress">
                  <div className="stories-create__progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}

              <textarea
                className="stories-create__caption"
                placeholder="Agregar texto (opcional)..."
                value={newStoryText}
                onChange={(e) => setNewStoryText(e.target.value)}
                maxLength={200}
              />
            </div>
          )}
        </div>
      )}

      {/* Story viewer fullscreen */}
      {showViewer && currentStory && (
        <div className="stories-viewer" onClick={nextStory}>
          <div className="stories-viewer__content" style={{ background: currentStory.background_color || '#7C3AED' }}>
            {/* Progress bars */}
            <div className="stories-viewer__progress">
              {currentGroup.stories.map((_, i) => (
                <div key={i} className="stories-viewer__progress-bar">
                  <div
                    className={`stories-viewer__progress-fill ${
                      i < showViewer.storyIndex ? 'stories-viewer__progress-fill--done' :
                      i === showViewer.storyIndex ? 'stories-viewer__progress-fill--active' : ''
                    }`}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="stories-viewer__header" onClick={e => e.stopPropagation()}>
              <div className="stories-viewer__user">
                {currentGroup.avatarUrl ? (
                  <img src={currentGroup.avatarUrl} className="stories-viewer__avatar" />
                ) : (
                  <div className="stories-viewer__avatar-text">
                    {currentGroup.username?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <span className="stories-viewer__username">{currentGroup.username}</span>
                  <span className="stories-viewer__time">
                    {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <div className="stories-viewer__actions">
                {currentGroup.userId === user?.id && (
                  <button onClick={() => handleDeleteStory(currentStory.id)}>
                    <Trash2 size={18} color="white" />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); setShowViewer(null) }}>
                  <X size={22} color="white" />
                </button>
              </div>
            </div>

            {/* Story content */}
            {currentStory.type === 'text' ? (
              <div className="stories-viewer__text">
                {currentStory.content}
              </div>
            ) : (
              <img src={currentStory.content} className="stories-viewer__image" alt="Story" />
            )}

            {/* Navigation zones */}
            <div className="stories-viewer__nav-left" onClick={(e) => { e.stopPropagation(); prevStory() }} />
            <div className="stories-viewer__nav-right" onClick={(e) => { e.stopPropagation(); nextStory() }} />
          </div>
        </div>
      )}
    </>
  )
}

export default StoriesBar

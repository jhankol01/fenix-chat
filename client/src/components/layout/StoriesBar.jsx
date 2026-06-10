import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, X, Send, ImagePlus, Type, Trash2, Heart, Video, Eye, Clock } from 'lucide-react'
import api from '../../lib/api'
import useAuthStore from '../../stores/authStore'
import { getSocket } from '../../lib/socket'
import './StoriesBar.css'

const STORY_COLORS = [
  '#7C3AED', '#0ea5e9', '#10b981', '#f43f5e', '#f59e0b',
  '#6366f1', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444',
]

const QUICK_EMOJIS = ['🔥', '❤️', '😂', '😍', '👏', '😮']

function StoriesBar({ autoOpen = false }) {
  const [storyGroups, setStoryGroups] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [createMode, setCreateMode] = useState(null)
  const [showViewer, setShowViewer] = useState(null)
  const [newStoryText, setNewStoryText] = useState('')
  const [selectedColor, setSelectedColor] = useState('#7C3AED')
  const [isCreating, setIsCreating] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Video state
  const [videoPreview, setVideoPreview] = useState(null)
  const [videoFile, setVideoFile] = useState(null)

  // Caption state
  const [captionText, setCaptionText] = useState('')

  // Viewer state
  const [showHeart, setShowHeart] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isPaused, setIsPaused] = useState(false)

  // Viewers list state (for own stories)
  const [showViewersList, setShowViewersList] = useState(false)
  const [viewersList, setViewersList] = useState([])
  const [viewersLoading, setViewersLoading] = useState(false)

  const scrollRef = useRef(null)
  const timerRef = useRef(null)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const lastTapRef = useRef(0)
  const touchStartRef = useRef(null)
  const replyInputRef = useRef(null)
  const videoPlayerRef = useRef(null)

  const user = useAuthStore(s => s.user)

  // ─── Listen for FAB event from ChatList ────────────────────────
  useEffect(() => {
    const handler = () => setShowCreate(true)
    window.addEventListener('openStoryCreate', handler)
    return () => window.removeEventListener('openStoryCreate', handler)
  }, [])

  // ─── Load stories ───────────────────────────────────────────────
  const loadStories = async () => {
    try {
      const data = await api.get('/stories')
      setStoryGroups(data.stories || [])
    } catch (err) {
      console.error('Error loading stories:', err)
    }
  }

  const autoOpenedRef = useRef(false)

  useEffect(() => {
    loadStories()
    const interval = setInterval(loadStories, 30000)
    return () => clearInterval(interval)
  }, [])

  // Auto-open first story when autoOpen=true and stories load
  useEffect(() => {
    if (autoOpen && storyGroups.length > 0 && !autoOpenedRef.current && !showViewer) {
      autoOpenedRef.current = true
      // Find first group with unviewed stories, or just first group
      const unviewedIdx = storyGroups.findIndex(g => g.hasUnviewed)
      const idx = unviewedIdx >= 0 ? unviewedIdx : 0
      openStory(idx)
    }
  }, [autoOpen, storyGroups])

  // ─── Photo handling ─────────────────────────────────────────────
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
    setCreateMode('photo')
  }

  // ─── Video handling ─────────────────────────────────────────────
  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate video duration (max 30s)
    const videoEl = document.createElement('video')
    videoEl.preload = 'metadata'
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(videoEl.src)
      if (videoEl.duration > 30) {
        alert('El video debe ser de máximo 30 segundos')
        return
      }
      setVideoFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => setVideoPreview(ev.target.result)
      reader.readAsDataURL(file)
      setCreateMode('video')
    }
    videoEl.src = URL.createObjectURL(file)
  }

  // ─── Create story ──────────────────────────────────────────────
  const handleCreate = async () => {
    if (isCreating) return

    if (createMode === 'photo' && photoFile) {
      setIsCreating(true)
      setUploadProgress(10)
      try {
        const formData = new FormData()
        formData.append('media', photoFile)
        setUploadProgress(30)
        const uploadRes = await api.upload('/upload/media', formData)
        setUploadProgress(80)
        await api.post('/stories', {
          content: uploadRes.url,
          type: 'image',
          backgroundColor: selectedColor,
          caption: captionText || undefined,
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

    if (createMode === 'video' && videoFile) {
      setIsCreating(true)
      setUploadProgress(10)
      try {
        const formData = new FormData()
        formData.append('media', videoFile)
        setUploadProgress(30)
        const uploadRes = await api.upload('/upload/media', formData)
        setUploadProgress(80)
        await api.post('/stories', {
          content: uploadRes.url,
          type: 'video',
          backgroundColor: selectedColor,
          caption: captionText || undefined,
        })
        setUploadProgress(100)
        resetCreate()
        loadStories()
      } catch (err) {
        console.error('Story video upload error:', err)
        setUploadProgress(0)
      }
      setIsCreating(false)
      return
    }

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
    setVideoPreview(null)
    setVideoFile(null)
    setCaptionText('')
    setUploadProgress(0)
    setShowCreate(false)
    setCreateMode(null)
  }

  // ─── Story navigation ─────────────────────────────────────────
  const openStory = (groupIndex) => {
    setShowViewer({ groupIndex, storyIndex: 0 })
    setReplyText('')
    setShowHeart(false)
    setIsPaused(false)
    setShowViewersList(false)
    setViewersList([])
  }

  // Keep refs in sync for use inside timeouts/closures
  const showViewerRef = useRef(showViewer)
  const storyGroupsRef = useRef(storyGroups)
  useEffect(() => { showViewerRef.current = showViewer }, [showViewer])
  useEffect(() => { storyGroupsRef.current = storyGroups }, [storyGroups])

  const nextStory = useCallback(() => {
    const sv = showViewerRef.current
    const groups = storyGroupsRef.current
    if (!sv) return
    const group = groups[sv.groupIndex]
    if (!group) return
    if (sv.storyIndex < group.stories.length - 1) {
      setShowViewer({ groupIndex: sv.groupIndex, storyIndex: sv.storyIndex + 1 })
    } else if (sv.groupIndex < groups.length - 1) {
      setShowViewer({ groupIndex: sv.groupIndex + 1, storyIndex: 0 })
    } else {
      setShowViewer(null)
    }
  }, [])

  const prevStory = useCallback(() => {
    const sv = showViewerRef.current
    const groups = storyGroupsRef.current
    if (!sv) return
    if (sv.storyIndex > 0) {
      setShowViewer({ groupIndex: sv.groupIndex, storyIndex: sv.storyIndex - 1 })
    } else if (sv.groupIndex > 0) {
      const prevGroup = groups[sv.groupIndex - 1]
      setShowViewer({ groupIndex: sv.groupIndex - 1, storyIndex: prevGroup.stories.length - 1 })
    }
  }, [])

  const nextGroup = useCallback(() => {
    const sv = showViewerRef.current
    const groups = storyGroupsRef.current
    if (!sv) return
    if (sv.groupIndex < groups.length - 1) {
      setShowViewer({ groupIndex: sv.groupIndex + 1, storyIndex: 0 })
    } else {
      setShowViewer(null)
    }
  }, [])

  // ─── Auto-advance timer + mark as viewed ──────────────────────
  useEffect(() => {
    if (!showViewer || isPaused) return
    const group = storyGroups[showViewer.groupIndex]
    if (!group) return
    const story = group.stories[showViewer.storyIndex]
    if (!story) return

    api.post(`/stories/${story.id}/view`).catch(() => {})

    // For video stories, don't use timer — use onEnded event
    if (story.type === 'video') return

    timerRef.current = setTimeout(nextStory, 5000)
    return () => clearTimeout(timerRef.current)
  }, [showViewer, isPaused, nextStory])

  // ─── Reset viewers list on story change ────────────────────────
  useEffect(() => {
    setShowViewersList(false)
    setViewersList([])
  }, [showViewer?.storyIndex, showViewer?.groupIndex])

  // ─── Fetch viewers for own story ───────────────────────────────
  const fetchViewers = async (storyId) => {
    setViewersLoading(true)
    try {
      const data = await api.get(`/stories/${storyId}/viewers`)
      setViewersList(data.viewers || [])
    } catch (err) {
      console.error('Error loading viewers:', err)
      setViewersList([])
    }
    setViewersLoading(false)
  }

  const handleToggleViewers = () => {
    if (showViewersList) {
      setShowViewersList(false)
      return
    }
    if (currentStory) {
      setShowViewersList(true)
      fetchViewers(currentStory.id)
    }
  }

  // ─── Double-tap heart ─────────────────────────────────────────
  const handleContentTap = (e) => {
    const now = Date.now()
    const timeSince = now - lastTapRef.current
    lastTapRef.current = now

    if (timeSince < 300) {
      // Double-tap → heart animation
      e.preventDefault()
      e.stopPropagation()
      triggerHeart()
      return
    }

    // Capture coordinates NOW (React recycles synthetic events)
    const rect = e.currentTarget.getBoundingClientRect()
    const tapX = e.clientX - rect.left
    const tapWidth = rect.width

    // Single tap → wait to see if it's a double-tap
    setTimeout(() => {
      if (Date.now() - lastTapRef.current >= 280) {
        if (tapX < tapWidth * 0.3) {
          prevStory()
        } else {
          nextStory()
        }
      }
    }, 300)
  }

  const triggerHeart = () => {
    setShowHeart(true)
    // Send heart reaction as DM
    const group = storyGroups[showViewer?.groupIndex]
    if (group && group.userId !== user?.id) {
      sendStoryReply('❤️', group.userId)
    }
    setTimeout(() => setShowHeart(false), 1200)
  }

  // ─── Swipe up → next person ───────────────────────────────────
  const handleTouchStart = (e) => {
    touchStartRef.current = {
      y: e.touches[0].clientY,
      x: e.touches[0].clientX,
      time: Date.now(),
    }
  }

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return
    const dy = touchStartRef.current.y - e.changedTouches[0].clientY
    const dx = Math.abs(touchStartRef.current.x - e.changedTouches[0].clientX)
    const dt = Date.now() - touchStartRef.current.time

    // Swipe up: dy > 80px, mostly vertical, quick
    if (dy > 80 && dx < 100 && dt < 500) {
      e.preventDefault()
      nextGroup()
    }
    touchStartRef.current = null
  }

  // ─── Reply (emoji or text) → sends DM ─────────────────────────
  const sendStoryReply = async (content, targetUserId) => {
    try {
      const socket = getSocket()
      if (!socket) return

      // Get or create DM conversation
      const res = await api.post('/conversations', { targetUserId })
      const conversationId = res.conversation?.id

      if (conversationId) {
        socket.emit('send_message', {
          conversationId,
          content: `📸 Respondió a tu historia: ${content}`,
          type: 'text',
        })
      }
    } catch (err) {
      console.error('Story reply error:', err)
    }
  }

  const handleEmojiReply = (emoji) => {
    const group = storyGroups[showViewer?.groupIndex]
    if (!group || group.userId === user?.id) return
    sendStoryReply(emoji, group.userId)
    // Brief visual feedback
    setReplyText(emoji)
    setTimeout(() => setReplyText(''), 1500)
  }

  const handleTextReply = () => {
    if (!replyText.trim()) return
    const group = storyGroups[showViewer?.groupIndex]
    if (!group || group.userId === user?.id) return
    sendStoryReply(replyText.trim(), group.userId)
    setReplyText('')
  }

  const handleDeleteStory = async (storyId) => {
    try {
      await api.delete(`/stories/${storyId}`)
      loadStories()
      setShowViewer(null)
    } catch (_) {}
  }

  // ─── Computed ─────────────────────────────────────────────────
  const currentGroup = showViewer ? storyGroups[showViewer.groupIndex] : null
  const currentStory = currentGroup ? currentGroup.stories[showViewer.storyIndex] : null
  const myStories = storyGroups.find(g => g.userId === user?.id)
  const isOwnStory = currentGroup?.userId === user?.id

  // ─── Time ago helper ──────────────────────────────────────────
  const timeAgo = (date) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000
    if (diff < 60) return 'ahora'
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    return `${Math.floor(diff / 3600)}h`
  }

  return (
    <>
      {/* ═══════ Stories horizontal bar ═══════ */}
      <div className="stories-bar" ref={scrollRef}>
        {/* Add story button */}
        <button className="stories-bar__add" onClick={() => {
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
            <div className="stories-bar__add-icon"><Plus size={14} /></div>
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

      {/* ═══════ Create story modal ═══════ */}
      {showCreate && (
        <div className="stories-create-overlay">
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
                <button className="stories-create-picker__option" onClick={() => videoInputRef.current?.click()}>
                  <div className="stories-create-picker__icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                    <Video size={28} color="white" />
                  </div>
                  <span>Video</span>
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />
              <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleVideoSelect} />
            </div>
          )}

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

          {createMode === 'photo' && photoPreview && (
            <div className="stories-create stories-create--photo">
              <div className="stories-create__header">
                <button onClick={() => { setCreateMode(null); setPhotoPreview(null); setPhotoFile(null); setCaptionText('') }}>
                  <X size={22} color="white" />
                </button>
                <span>Historia con foto</span>
                <button onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? <div className="stories-create__spinner" /> : <Send size={20} color="white" />}
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
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                maxLength={200}
              />
            </div>
          )}

          {createMode === 'video' && videoPreview && (
            <div className="stories-create stories-create--photo">
              <div className="stories-create__header">
                <button onClick={() => { setCreateMode(null); setVideoPreview(null); setVideoFile(null); setCaptionText('') }}>
                  <X size={22} color="white" />
                </button>
                <span>Historia con video</span>
                <button onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? <div className="stories-create__spinner" /> : <Send size={20} color="white" />}
                </button>
              </div>
              <div className="stories-create__photo-preview stories-create__video-preview">
                <video src={videoPreview} controls playsInline style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} />
              </div>
              {uploadProgress > 0 && (
                <div className="stories-create__progress">
                  <div className="stories-create__progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
              <textarea
                className="stories-create__caption"
                placeholder="Agregar texto (opcional)..."
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                maxLength={200}
              />
            </div>
          )}
        </div>
      )}

      {/* ═══════ Story Viewer — Full-Screen Instagram-Style ═══════ */}
      {showViewer && currentStory && (
        <div
          className="stories-viewer"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="stories-viewer__content"
            style={{ background: currentStory.type === 'text' ? (currentStory.background_color || '#7C3AED') : '#000' }}
          >
            {/* Progress bars */}
            <div className="stories-viewer__progress">
              {currentGroup.stories.map((_, i) => (
                <div key={i} className="stories-viewer__progress-bar">
                  <div
                    className={`stories-viewer__progress-fill ${
                      i < showViewer.storyIndex ? 'stories-viewer__progress-fill--done' :
                      i === showViewer.storyIndex ? (isPaused ? 'stories-viewer__progress-fill--paused' : 'stories-viewer__progress-fill--active') : ''
                    }`}
                    style={
                      i === showViewer.storyIndex && currentStory.type === 'video'
                        ? { animationDuration: '30s' }
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="stories-viewer__header">
              <div className="stories-viewer__user">
                {currentGroup.avatarUrl ? (
                  <img src={currentGroup.avatarUrl} className="stories-viewer__avatar" alt="" />
                ) : (
                  <div className="stories-viewer__avatar-text">
                    {currentGroup.username?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <span className="stories-viewer__username">{currentGroup.username}</span>
                  <span className="stories-viewer__time">{timeAgo(currentStory.created_at)}</span>
                </div>
              </div>
              <div className="stories-viewer__actions">
                {isOwnStory && (
                  <button onClick={() => handleDeleteStory(currentStory.id)}>
                    <Trash2 size={18} color="white" />
                  </button>
                )}
                <button onClick={() => setShowViewer(null)}>
                  <X size={22} color="white" />
                </button>
              </div>
            </div>

            {/* Story content — tap zones */}
            <div className="stories-viewer__body" onClick={handleContentTap}>
              {currentStory.type === 'text' ? (
                <div className="stories-viewer__text">
                  {currentStory.content}
                </div>
              ) : currentStory.type === 'video' ? (
                <video
                  ref={videoPlayerRef}
                  src={currentStory.content}
                  className="stories-viewer__video"
                  autoPlay
                  playsInline
                  muted={false}
                  onEnded={nextStory}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <img src={currentStory.content} className="stories-viewer__image" alt="Story" />
              )}

              {/* Heart animation (double-tap) */}
              {showHeart && (
                <div className="stories-viewer__heart">
                  <Heart size={80} fill="white" color="white" />
                </div>
              )}
            </div>

            {/* Caption overlay */}
            {currentStory.caption && (
              <div className="stories-viewer__caption-overlay">
                <p className="stories-viewer__caption-text">{currentStory.caption}</p>
              </div>
            )}

            {/* Swipe up indicator */}
            {showViewer.groupIndex < storyGroups.length - 1 && (
              <div className="stories-viewer__swipe-hint">
                <div className="stories-viewer__swipe-arrow" />
                <span>Desliza para siguiente</span>
              </div>
            )}

            {/* Viewers count (own stories only) */}
            {isOwnStory && (
              <div className="stories-viewer__viewers-trigger" onClick={(e) => { e.stopPropagation(); handleToggleViewers() }}>
                <Eye size={16} />
                <span>{currentStory.view_count || 0}</span>
              </div>
            )}

            {/* Reply bar (only for other people's stories) */}
            {!isOwnStory && (
              <div className="stories-viewer__reply-bar" onClick={e => e.stopPropagation()}>
                <div className="stories-viewer__reply-emojis">
                  {QUICK_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      className="stories-viewer__reply-emoji"
                      onClick={() => handleEmojiReply(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="stories-viewer__reply-input-row">
                  <input
                    ref={replyInputRef}
                    type="text"
                    className="stories-viewer__reply-input"
                    placeholder="Responder..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onFocus={() => setIsPaused(true)}
                    onBlur={() => setIsPaused(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTextReply() }}
                  />
                  {replyText.trim() && (
                    <button className="stories-viewer__reply-send" onClick={handleTextReply}>
                      <Send size={18} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Viewers Bottom Sheet (own stories) */}
            {showViewersList && isOwnStory && (
              <>
                <div className="stories-viewer__viewers-overlay" onClick={() => setShowViewersList(false)} />
                <div className="stories-viewer__viewers-sheet" onClick={(e) => e.stopPropagation()}>
                  <div className="stories-viewer__viewers-sheet-handle" />
                  <div className="stories-viewer__viewers-sheet-header">
                    <Eye size={18} />
                    <span>Vistas ({currentStory.view_count || viewersList.length})</span>
                    <button onClick={() => setShowViewersList(false)}>
                      <X size={18} color="white" />
                    </button>
                  </div>
                  <div className="stories-viewer__viewers-list">
                    {viewersLoading ? (
                      <div className="stories-viewer__viewers-loading">Cargando...</div>
                    ) : viewersList.length === 0 ? (
                      <div className="stories-viewer__viewers-empty">Nadie ha visto esta historia aún</div>
                    ) : (
                      viewersList.map((viewer) => (
                        <div key={viewer.id || viewer.user_id} className="stories-viewer__viewer-item">
                          <div className="stories-viewer__viewer-avatar">
                            {viewer.avatar_url ? (
                              <img src={viewer.avatar_url} alt={viewer.username} />
                            ) : (
                              <span>{viewer.username?.slice(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="stories-viewer__viewer-info">
                            <span className="stories-viewer__viewer-name">{viewer.username}</span>
                            {viewer.viewed_at && (
                              <span className="stories-viewer__viewer-time">
                                <Clock size={12} />
                                {timeAgo(viewer.viewed_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default StoriesBar

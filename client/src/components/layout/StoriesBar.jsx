import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, X, Send, ImagePlus, Type, Trash2, Heart } from 'lucide-react'
import api from '../../lib/api'
import useAuthStore from '../../stores/authStore'
import { getSocket } from '../../lib/socket'
import './StoriesBar.css'

const STORY_COLORS = [
  '#7C3AED', '#0ea5e9', '#10b981', '#f43f5e', '#f59e0b',
  '#6366f1', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444',
]

const QUICK_EMOJIS = ['🔥', '❤️', '😂', '😍', '👏', '😮']

function StoriesBar() {
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

  // Viewer state
  const [showHeart, setShowHeart] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isPaused, setIsPaused] = useState(false)

  const scrollRef = useRef(null)
  const timerRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastTapRef = useRef(0)
  const touchStartRef = useRef(null)
  const replyInputRef = useRef(null)

  const user = useAuthStore(s => s.user)

  // ─── Load stories ───────────────────────────────────────────────
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
    const interval = setInterval(loadStories, 30000)
    return () => clearInterval(interval)
  }, [])

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

  // ─── Story navigation ─────────────────────────────────────────
  const openStory = (groupIndex) => {
    setShowViewer({ groupIndex, storyIndex: 0 })
    setReplyText('')
    setShowHeart(false)
    setIsPaused(false)
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

    timerRef.current = setTimeout(nextStory, 5000)
    return () => clearTimeout(timerRef.current)
  }, [showViewer, isPaused, nextStory])

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
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />
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
                <button onClick={() => { setCreateMode(null); setPhotoPreview(null); setPhotoFile(null) }}>
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
                value={newStoryText}
                onChange={(e) => setNewStoryText(e.target.value)}
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

            {/* Swipe up indicator */}
            {showViewer.groupIndex < storyGroups.length - 1 && (
              <div className="stories-viewer__swipe-hint">
                <div className="stories-viewer__swipe-arrow" />
                <span>Desliza para siguiente</span>
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
          </div>
        </div>
      )}
    </>
  )
}

export default StoriesBar

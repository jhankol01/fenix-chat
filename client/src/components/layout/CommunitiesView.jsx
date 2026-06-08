import { useState, useEffect } from 'react'
import { Plus, Users, Globe, Search, Hash, Volume2, Crown, ChevronRight, X, Copy, Check, Lock, Eye } from 'lucide-react'
import api from '../../lib/api'
import { getSocket } from '../../lib/socket'
import useAuthStore from '../../stores/authStore'
import './CommunitiesView.css'

function CommunitiesView({ onOpenCommunity }) {
  const [tab, setTab] = useState('mine') // mine | discover
  const [myCommunities, setMyCommunities] = useState([])
  const [allCommunities, setAllCommunities] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [showJoinCode, setShowJoinCode] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newIsPublic, setNewIsPublic] = useState(true)
  const [loading, setLoading] = useState(true)
  const user = useAuthStore(s => s.user)

  const loadMine = async () => {
    try {
      const data = await api.get('/communities/mine')
      setMyCommunities(data.communities || [])
    } catch (err) { console.error(err) }
  }

  const loadAll = async () => {
    try {
      const data = await api.get('/communities')
      setAllCommunities(data.communities || [])
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    Promise.all([loadMine(), loadAll()]).finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await api.post('/communities', { name: newName.trim(), description: newDesc.trim(), isPublic: newIsPublic })
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      setNewIsPublic(true)
      loadMine()
      loadAll()
    } catch (err) { console.error(err) }
  }

  const handleJoin = async (communityId) => {
    try {
      await api.post(`/communities/${communityId}/join`)
      loadMine()
      loadAll()
    } catch (err) { console.error(err) }
  }

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return
    try {
      const data = await api.post(`/communities/join/${joinCode.trim()}`)
      if (data.communityId) {
        setShowJoinCode(false)
        setJoinCode('')
        loadMine()
      }
    } catch (err) { console.error(err) }
  }

  const myIds = new Set(myCommunities.map(c => c.id))

  return (
    <div className="communities-view">
      {/* Header */}
      <div className="communities-view__header">
        <h2 className="communities-view__title">Comunidades</h2>
        <div className="communities-view__header-actions">
          <button className="communities-view__btn-icon" onClick={() => setShowJoinCode(true)} title="Unirse con código">
            <Hash size={18} />
          </button>
          <button className="communities-view__btn-create" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Crear
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="communities-view__tabs">
        <button
          className={`communities-view__tab ${tab === 'mine' ? 'communities-view__tab--active' : ''}`}
          onClick={() => setTab('mine')}
        >
          Mis comunidades
        </button>
        <button
          className={`communities-view__tab ${tab === 'discover' ? 'communities-view__tab--active' : ''}`}
          onClick={() => setTab('discover')}
        >
          Descubrir
        </button>
      </div>

      {/* Content */}
      <div className="communities-view__list">
        {loading ? (
          <div className="communities-view__empty">Cargando...</div>
        ) : tab === 'mine' ? (
          myCommunities.length === 0 ? (
            <div className="communities-view__empty">
              <Globe size={48} strokeWidth={1} />
              <p>No estás en ninguna comunidad aún</p>
              <button className="communities-view__btn-create" onClick={() => setTab('discover')}>
                Descubrir comunidades
              </button>
            </div>
          ) : (
            myCommunities.map(c => (
              <CommunityCard key={c.id} community={c} isMember onClick={() => onOpenCommunity?.(c)} />
            ))
          )
        ) : (
          allCommunities.length === 0 ? (
            <div className="communities-view__empty">
              <p>No hay comunidades públicas todavía</p>
            </div>
          ) : (
            allCommunities.map(c => (
              <CommunityCard
                key={c.id}
                community={c}
                isMember={myIds.has(c.id)}
                onJoin={() => handleJoin(c.id)}
                onClick={() => myIds.has(c.id) ? onOpenCommunity?.(c) : handleJoin(c.id)}
              />
            ))
          )
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="communities-view__overlay" onClick={() => setShowCreate(false)}>
          <div className="communities-view__modal" onClick={e => e.stopPropagation()}>
            <div className="communities-view__modal-header">
              <h3>Crear Comunidad</h3>
              <button onClick={() => setShowCreate(false)}><X size={20} /></button>
            </div>
            <input
              className="communities-view__input"
              placeholder="Nombre de la comunidad"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              maxLength={50}
              autoFocus
            />
            <textarea
              className="communities-view__input communities-view__textarea"
              placeholder="Descripción (opcional)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              maxLength={200}
              rows={3}
            />
            <div className="communities-view__privacy-toggle">
              <div className="communities-view__privacy-info">
                {newIsPublic ? <Globe size={18} /> : <Lock size={18} />}
                <div>
                  <div className="communities-view__privacy-label">{newIsPublic ? 'Pública' : 'Privada'}</div>
                  <div className="communities-view__privacy-desc">
                    {newIsPublic ? 'Todos pueden descubrir y unirse' : 'Solo con invitación'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`communities-view__switch ${newIsPublic ? 'communities-view__switch--on' : ''}`}
                onClick={() => setNewIsPublic(!newIsPublic)}
              >
                <div className="communities-view__switch-thumb" />
              </button>
            </div>
            <button
              className="communities-view__btn-create communities-view__btn-full"
              onClick={handleCreate}
              disabled={!newName.trim()}
            >
              <Plus size={16} /> Crear Comunidad
            </button>
          </div>
        </div>
      )}

      {/* Join by Code Modal */}
      {showJoinCode && (
        <div className="communities-view__overlay" onClick={() => setShowJoinCode(false)}>
          <div className="communities-view__modal" onClick={e => e.stopPropagation()}>
            <div className="communities-view__modal-header">
              <h3>Unirse con código</h3>
              <button onClick={() => setShowJoinCode(false)}><X size={20} /></button>
            </div>
            <input
              className="communities-view__input"
              placeholder="Código de invitación"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              autoFocus
            />
            <button
              className="communities-view__btn-create communities-view__btn-full"
              onClick={handleJoinByCode}
              disabled={!joinCode.trim()}
            >
              Unirse
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Community Card ─────────────────────────────────────── */
function CommunityCard({ community, isMember, onJoin, onClick }) {
  const initial = community.name?.slice(0, 2).toUpperCase()

  return (
    <div className="community-card" onClick={onClick}>
      <div className="community-card__banner">
        {community.banner_url ? (
          <img src={community.banner_url} alt="" />
        ) : (
          <div className="community-card__banner-placeholder">
            <span>{initial}</span>
          </div>
        )}
      </div>
      <div className="community-card__body">
        <div className="community-card__info">
          <h3 className="community-card__name">{community.name}</h3>
          {community.description && (
            <p className="community-card__desc">{community.description}</p>
          )}
          <div className="community-card__meta">
            <Users size={13} />
            <span>{community.member_count || 0} miembros</span>
            {community.is_public === false && (
              <span className="community-card__badge community-card__badge--private"><Lock size={11} /> Privada</span>
            )}
            {community.my_role === 'owner' && (
              <span className="community-card__badge"><Crown size={11} /> Creador</span>
            )}
          </div>
        </div>
        {!isMember ? (
          <button className="community-card__join" onClick={e => { e.stopPropagation(); onJoin?.() }}>
            Unirse
          </button>
        ) : (
          <ChevronRight size={18} className="community-card__arrow" />
        )}
      </div>
    </div>
  )
}

export default CommunitiesView

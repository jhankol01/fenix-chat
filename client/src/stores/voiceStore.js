import { create } from 'zustand'

const useVoiceStore = create((set) => ({
  inVoiceRoom: null,       // room ID
  roomName: '',            // e.g. "Sala General"
  communityName: '',       // e.g. "Jhankol call"
  communityId: null,
  isMuted: false,
  participantCount: 0,
  joinedAt: null,          // Date.now() when joined
  
  joinRoom: ({ roomId, roomName, communityName, communityId }) => set({
    inVoiceRoom: roomId,
    roomName,
    communityName,
    communityId,
    isMuted: false,
    participantCount: 1,
    joinedAt: Date.now(),
  }),
  
  leaveRoom: () => set({
    inVoiceRoom: null,
    roomName: '',
    communityName: '',
    communityId: null,
    isMuted: false,
    participantCount: 0,
    joinedAt: null,
  }),
  
  setMuted: (muted) => set({ isMuted: muted }),
  setParticipantCount: (count) => set({ participantCount: count }),
}))

export default useVoiceStore

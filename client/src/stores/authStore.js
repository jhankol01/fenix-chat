import { create } from 'zustand'
import { api, configureApi } from '../lib/api.js'

const useAuthStore = create((set, get) => {
  // Configure API with token getters
  configureApi({
    getToken: () => get().accessToken,
    onRefresh: async () => {
      try {
        await get().refreshSession()
        return true
      } catch {
        get().logout()
        return false
      }
    },
  })

  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true, // true initially to check stored session

    // Update user data locally
    setUser: (userData) => set({ user: userData }),

    // Register
    register: async ({ username, email, password }) => {
      const data = await api.post('/auth/register', { username, email, password })
      return data
    },

    // Login
    login: async ({ email, password, rememberMe }) => {
      const data = await api.post('/auth/login', { email, password, rememberMe })
      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      })
      // Persist refresh token
      localStorage.setItem('fenix_refresh_token', data.refreshToken)
      return data
    },

    // Logout
    logout: async () => {
      const { refreshToken } = get()
      try {
        if (refreshToken) {
          await api.post('/auth/logout', { refreshToken })
        }
      } catch {
        // Ignore logout errors
      }
      // Clear ALL localStorage to remove tokens, preferences, privacy settings, etc.
      localStorage.clear()
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      })
    },

    // Refresh session
    refreshSession: async () => {
      const refreshToken = get().refreshToken || localStorage.getItem('fenix_refresh_token')
      if (!refreshToken) throw new Error('No refresh token')

      const data = await api.post('/auth/refresh', { refreshToken })
      set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      })
      localStorage.setItem('fenix_refresh_token', data.refreshToken)

      // Load user data if not loaded
      if (!get().user) {
        const userData = await api.get('/users/me')
        set({ user: userData, isAuthenticated: true })
      }
    },

    // Initialize — check for stored session
    initialize: async () => {
      const refreshToken = localStorage.getItem('fenix_refresh_token')
      if (!refreshToken) {
        set({ isLoading: false })
        return
      }
      try {
        set({ refreshToken })
        await get().refreshSession()
        set({ isAuthenticated: true, isLoading: false })
      } catch {
        localStorage.removeItem('fenix_refresh_token')
        set({ isLoading: false })
      }
    },
  }
})

export default useAuthStore

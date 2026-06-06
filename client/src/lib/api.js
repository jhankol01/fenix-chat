const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

let getAccessToken = () => null
let onTokenRefresh = null

export function configureApi({ getToken, onRefresh }) {
  getAccessToken = getToken
  onTokenRefresh = onRefresh
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const token = getAccessToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, { ...options, headers })

  // If 401 with TOKEN_EXPIRED, try refresh
  if (res.status === 401 && onTokenRefresh) {
    const data = await res.json().catch(() => ({}))
    if (data.code === 'TOKEN_EXPIRED') {
      const refreshed = await onTokenRefresh()
      if (refreshed) {
        // Retry with new token
        headers['Authorization'] = `Bearer ${getAccessToken()}`
        const retryRes = await fetch(url, { ...options, headers })
        if (!retryRes.ok) {
          const retryData = await retryRes.json().catch(() => ({ error: 'Error del servidor' }))
          throw new ApiError(retryRes.status, retryData)
        }
        return retryRes.json()
      }
    }
    throw new ApiError(401, data)
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Error del servidor' }))
    throw new ApiError(res.status, data)
  }

  return res.json()
}

export class ApiError extends Error {
  constructor(status, data) {
    super(data.error || data.message || 'Error')
    this.status = status
    this.data = data
  }
}

export const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, body) => request(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  patch: (endpoint, body) => request(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
}

export default api

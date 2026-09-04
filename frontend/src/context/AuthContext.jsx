import { createContext, useContext, useState, useEffect } from 'react'
import { api, setUnauthorizedHandler } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rz_user')) } catch { return null }
  })
  const [ready, setReady] = useState(false)

  // Redirection automatique si token expiré (401)
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      window.location.href = '/auth'
    })
  }, [])

  // Valider le token au démarrage
  useEffect(() => {
    const token = localStorage.getItem('rz_token')
    if (!token) { setReady(true); return }
    api.get('/auth/me')
      .then(freshUser => {
        localStorage.setItem('rz_user', JSON.stringify(freshUser))
        setUser(freshUser)
      })
      .catch(() => {
        localStorage.removeItem('rz_token')
        localStorage.removeItem('rz_user')
        setUser(null)
      })
      .finally(() => setReady(true))
  }, [])

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password })
    localStorage.setItem('rz_token', data.token)
    localStorage.setItem('rz_user', JSON.stringify(data.user))
    if (data.emailNotVerified) localStorage.setItem('rz_email_unverified', '1')
    else localStorage.removeItem('rz_email_unverified')
    setUser(data.user)
    return data.user
  }

  // Ouvre une session directement à partir d'un {token, user} déjà obtenu
  // (ex : juste après une inscription qui renvoie un token, sans re-appeler /login).
  const setSession = (data) => {
    localStorage.setItem('rz_token', data.token)
    localStorage.setItem('rz_user', JSON.stringify(data.user))
    if (data.emailNotVerified) localStorage.setItem('rz_email_unverified', '1')
    else localStorage.removeItem('rz_email_unverified')
    setUser(data.user)
  }

  const logout = () => {
    localStorage.removeItem('rz_token')
    localStorage.removeItem('rz_user')
    setUser(null)
  }

  const updateUser = (patch) => {
    const updated = { ...user, ...patch }
    localStorage.setItem('rz_user', JSON.stringify(updated))
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, updateUser, setSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

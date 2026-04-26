import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem('authToken')
    if (!savedToken) {
      setLoading(false)
      return
    }

    fetch('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then(res => {
        if (!res.ok) throw new Error('Token invalid')
        return res.json()
      })
      .then(data => {
        setToken(savedToken)
        setUser(data.user)
      })
      .catch(() => {
        localStorage.removeItem('authToken')
      })
      .finally(() => setLoading(false))
  }, [])

  async function register(email, password, name) {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Registration failed')
    }

    const data = await res.json()
    setUser(data.user)
    setToken(data.token)
    localStorage.setItem('authToken', data.token)
    return data
  }

  async function login(email, password) {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Login failed')
    }

    const data = await res.json()
    setUser(data.user)
    setToken(data.token)
    localStorage.setItem('authToken', data.token)
    return data
  }

  function logout() {
    setUser(null)
    setToken(null)
    localStorage.removeItem('authToken')
  }

  const isLoggedIn = !!token && !!user

  return (
    <AuthContext.Provider value={{ user, token, loading, isLoggedIn, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

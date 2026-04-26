import { useNavigate } from 'react-router-dom'
import { LogOut, LogIn, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginButton() {
  const navigate = useNavigate()
  const { user, isLoggedIn, logout } = useAuth()

  if (!isLoggedIn) {
    // Not logged in
    return (
      <button
        onClick={() => navigate('/auth')}
        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
      >
        <LogIn className="w-4 h-4" />
        Login
      </button>
    )
  }

  // Logged in
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
        <User className="w-4 h-4 text-slate-600" />
        <span className="text-sm font-medium text-slate-700">{user?.email}</span>
      </div>
      <button
        onClick={() => {
          logout()
          navigate('/')
        }}
        className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </button>
    </div>
  )
}

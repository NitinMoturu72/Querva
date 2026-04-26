import { Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import SchemaPage from './pages/SchemaPage'
import ChatPage from './pages/ChatPage'
import AuthPage from './pages/AuthPage'
import { ConversationProvider } from './context/ConversationContext'
import { useAuth } from './context/AuthContext'

export default function App() {
  const { loading } = useAuth()
  const [schema, setSchema] = useState([])
  const [dialect, setDialect] = useState('PostgreSQL')

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent-green)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <ConversationProvider>
      <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/"
        element={
          <LandingPage
            onSchemaLoaded={(s) => setSchema(s)}
            onConversationLoaded={(s, d) => { setSchema(s); setDialect(d) }}
          />
        }
      />
      <Route
        path="/schema"
        element={
          <SchemaPage
            schema={schema}
            setSchema={setSchema}
            dialect={dialect}
            setDialect={setDialect}
          />
        }
      />
      <Route
        path="/chat"
        element={
          schema.length === 0
            ? <Navigate to="/" replace />
            : <ChatPage schema={schema} dialect={dialect} onSchemaChange={setSchema} />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConversationProvider>
  )
}

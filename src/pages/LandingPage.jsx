import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileCode, AlertCircle, ArrowRight, MessageSquare, Loader, Trash2 } from 'lucide-react'
import { parseSchemaFile } from '../lib/schemaParser'
import { deleteConversation } from '../lib/mockAI'
import { useAuth } from '../context/AuthContext'
import { useConversation } from '../context/ConversationContext'

const ACCEPTED = '.sql,.json,.csv'

function mapApiMessages(apiMessages) {
  return (apiMessages || []).map(m => ({
    id: m.id,
    role: m.role,
    text: m.content,
    query: m.sql_query || null,
  }))
}

export default function LandingPage({ onSchemaLoaded, onConversationLoaded }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const { isLoggedIn } = useAuth()
  const { conversations, loadConversations, loadConversation, switchConversation } = useConversation()

  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [convsLoading, setConvsLoading] = useState(false)
  const [resuming, setResuming] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const atLimit = conversations.length >= 5

  useEffect(() => {
    if (!isLoggedIn) return
    setConvsLoading(true)
    loadConversations().finally(() => setConvsLoading(false))
  }, [isLoggedIn])

  async function handleFile(file) {
    if (!file) return
    setError(null)
    setLoading(true)
    try {
      const tables = await parseSchemaFile(file)
      if (tables.length === 0) throw new Error('No tables found in this file.')
      onSchemaLoaded(tables)
      navigate('/schema')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleManual() {
    onSchemaLoaded([])
    navigate('/schema')
  }

  async function handleDeleteConversation(e, conversationId) {
    e.stopPropagation()
    setDeleting(conversationId)
    try {
      await deleteConversation(conversationId)
      await loadConversations()
    } catch (err) {
      setError('Failed to delete conversation.')
    } finally {
      setDeleting(null)
    }
  }

  async function handleResumeConversation(conversationId) {
    setResuming(conversationId)
    setError(null)
    try {
      const data = await loadConversation(conversationId)
      const schema = (data.schema || []).map(t => ({
        ...t,
        columns: (t.columns || []).filter(Boolean),
      }))
      const dialect = data.conversation.dialect || 'PostgreSQL'
      const restoredMessages = mapApiMessages(data.messages)

      onConversationLoaded(schema, dialect)
      switchConversation(conversationId)
      navigate('/chat', { state: { restoredMessages, conversationName: data.conversation.name } })
    } catch (err) {
      setError('Failed to load conversation. Please try again.')
    } finally {
      setResuming(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-xl w-full text-center mb-10">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="font-mono text-6xl md:text-7xl tracking-wide mb-6"
            style={{ color: 'var(--accent-green)' }}
          >
            Querva
          </button>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight mb-3">
            Your AI SQL assistant
          </h1>
          <p className="text-slate-500 text-lg">
            Upload your database <span className="schema-accent">schema</span> and get instant, accurate SQL queries through natural conversation.
          </p>
        </div>

        {/* Upload zone */}
        <div className="max-w-xl w-full space-y-4">
          <div
            onClick={() => !loading && inputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`
              relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all
              ${dragging
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50'}
              ${loading ? 'opacity-60 pointer-events-none' : ''}
            `}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />

            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                <p className="text-slate-500 text-sm schema-accent">Parsing schema...</p>
              </div>
            ) : (
              <>
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-indigo-500" />
                  </div>
                </div>
                <p className="font-medium text-slate-700 mb-1 schema-accent">
                  Drop your schema file here
                </p>
                <p className="text-sm text-slate-400">
                  or click to browse · .sql · .json · .csv
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 animate-in">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <button
            onClick={handleManual}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all schema-accent"
          >
            <FileCode className="w-4 h-4" />
            Enter schema manually
            <ArrowRight className="w-4 h-4 ml-auto text-slate-400" />
          </button>
        </div>

        {/* Previous conversations (logged in) or sign-in prompt (guest) */}
        <div className="max-w-xl w-full mt-6">
          {isLoggedIn ? (
            convsLoading ? (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
                <Loader className="w-3 h-3 animate-spin" />
                Loading conversations...
              </div>
            ) : conversations.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Continue a conversation
                  </p>
                  {atLimit && (
                    <p className="text-xs text-amber-600 font-medium">
                      5/5 — delete one to start a new chat
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  {conversations.map(conv => (
                    <div
                      key={conv.id}
                      className="group w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                    >
                      <button
                        onClick={() => handleResumeConversation(conv.id)}
                        disabled={!!resuming || !!deleting}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resuming === conv.id ? (
                          <Loader className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
                        ) : (
                          <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{conv.name}</p>
                          <p className="text-xs text-slate-400">
                            {conv.dialect} · {conv.message_count} message{conv.message_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        disabled={!!deleting || !!resuming}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0 disabled:cursor-not-allowed"
                        title="Delete conversation"
                      >
                        {deleting === conv.id
                          ? <Loader className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center">
                No saved conversations yet. Start a new one above.
              </p>
            )
          ) : (
            <p className="text-xs text-slate-500 text-center">
              Have an account?{' '}
              <button
                onClick={() => navigate('/auth')}
                className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                Sign in
              </button>
              {' '}or{' '}
              <button
                onClick={() => navigate('/auth')}
                className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
              >
                Sign up
              </button>
            </p>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-400 text-center">
          Supports <span className="font-medium text-slate-500">CREATE TABLE</span> SQL,
          structured JSON, and CSV exports from most DB tools
        </p>
      </main>
    </div>
  )
}

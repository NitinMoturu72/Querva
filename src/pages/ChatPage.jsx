import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Copy, Check, Database, ChevronRight, Pencil, X, ChevronDown, ChevronUp } from 'lucide-react'
import { generateQuery } from '../lib/mockAI'

export default function ChatPage({ schema, dialect, onSchemaChange }) {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Schema loaded — I found **${schema.length} table${schema.length !== 1 ? 's' : ''}**: ${schema.map(t => `\`${t.name}\``).join(', ')}.\n\nAsk me anything — "select all users", "join orders and products", "count rows grouped by status", and so on.`,
      query: null,
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [schemaAlert, setSchemaAlert] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedTable, setExpandedTable] = useState(schema[0]?.id ?? null)
  const [copiedId, setCopiedId] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const question = input.trim()
    if (!question || loading) return
    setInput('')

    const userMsg = { id: Date.now().toString(), role: 'user', text: question, query: null }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const result = await generateQuery(question, schema, dialect)
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: result.message,
          query: result.query,
        }
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Something went wrong. Please try again.', query: null }
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function copyQuery(id, query) {
    navigator.clipboard.writeText(query)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Called from schema sidebar edit navigation
  function goEditSchema() {
    navigate('/schema')
  }

  // Render message text with basic **bold** and `code` support
  function renderText(text) {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
      return (
        <span key={i}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**'))
              return <strong key={j} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>
            if (part.startsWith('`') && part.endsWith('`'))
              return <code key={j} className="font-mono text-xs bg-slate-100 text-indigo-700 rounded px-1 py-0.5">{part.slice(1, -1)}</code>
            return part
          })}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      )
    })
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Topbar */}
      <header className="border-b border-slate-200 bg-white px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Database className="w-3.5 h-3.5 text-white" />
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="font-semibold text-slate-800 tracking-tight hover:text-indigo-700 transition-colors"
          >
            Querva
          </button>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <span className="text-sm text-slate-500">Chat · {dialect}</span>
        </div>
        <button
          onClick={goEditSchema}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit schema
        </button>
      </header>

      {/* Schema updated banner */}
      {schemaAlert && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between animate-in">
          <span className="text-sm text-amber-800 font-medium">⚡ Schema updated — context refreshed</span>
          <button onClick={() => setSchemaAlert(false)} className="text-amber-500 hover:text-amber-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Schema sidebar (read-only) ── */}
        {sidebarOpen && (
          <aside className="w-56 border-r border-slate-200 bg-white flex flex-col overflow-hidden shrink-0">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Schema</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {schema.map(table => (
                <div key={table.id} className="mx-2 mb-1">
                  <button
                    onClick={() => setExpandedTable(expandedTable === table.id ? null : table.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-700 flex-1 truncate">{table.name}</span>
                    {expandedTable === table.id
                      ? <ChevronUp className="w-3 h-3 text-slate-400 shrink-0" />
                      : <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                    }
                  </button>
                  {expandedTable === table.id && (
                    <div className="ml-4 mt-1 mb-2 space-y-0.5">
                      {table.columns.map(col => (
                        <div key={col.id} className="flex items-center gap-2 px-2 py-1 rounded">
                          <span className="font-mono text-xs text-slate-600 flex-1 truncate">{col.name}</span>
                          <span className="text-xs text-slate-400 shrink-0 font-mono">{col.type.split('(')[0]}</span>
                          {col.key !== 'none' && (
                            <span className={`text-xs font-semibold shrink-0 ${col.key === 'PK' ? 'text-amber-500' : col.key === 'FK' ? 'text-blue-500' : 'text-purple-500'}`}>
                              {col.key}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* ── Chat area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Show sidebar toggle when hidden */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="absolute left-0 top-24 z-10 bg-white border border-slate-200 rounded-r-lg px-2 py-3 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
            >
              <Database className="w-4 h-4" />
            </button>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' ? (
                  <div className="max-w-2xl space-y-3 animate-in">
                    {/* Text bubble */}
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 leading-relaxed shadow-sm">
                      {renderText(msg.text)}
                    </div>

                    {/* Query block */}
                    {msg.query && (
                      <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
                          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">SQL · {dialect}</span>
                          <button
                            onClick={() => copyQuery(msg.id, msg.query)}
                            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all font-medium ${
                              copiedId === msg.id
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {copiedId === msg.id
                              ? <><Check className="w-3 h-3" /> Copied!</>
                              : <><Copy className="w-3 h-3" /> Copy</>
                            }
                          </button>
                        </div>
                        <pre className="px-4 py-3 text-sm font-mono text-slate-100 overflow-x-auto leading-relaxed">
                          <code>{msg.query}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="max-w-sm bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm shadow-sm">
                    {msg.text}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start animate-in">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-slate-200 bg-white px-4 py-4 shrink-0">
            <div className="flex items-center gap-3 max-w-3xl mx-auto">
              <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 gap-2 focus-within:border-indigo-400 focus-within:bg-white transition-all">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Ask a question about your schema…"
                  className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                  input.trim() && !loading
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">
              Press Enter to send · queries are generated based on your loaded schema
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

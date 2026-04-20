import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileCode, AlertCircle, ArrowRight, Database } from 'lucide-react'
import { parseSchemaFile } from '../lib/schemaParser'

const ACCEPTED = '.sql,.json,.csv'

export default function LandingPage({ onSchemaLoaded }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-8 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Database className="w-4 h-4 text-white" />
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="font-semibold text-slate-800 tracking-tight hover:text-indigo-700 transition-colors"
        >
          Querva
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="max-w-xl w-full text-center mb-10">
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight mb-3">
            Your AI SQL assistant
          </h1>
          <p className="text-slate-500 text-lg">
            Upload your database schema and get instant, accurate SQL queries through natural conversation.
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
                <p className="text-slate-500 text-sm">Parsing schema…</p>
              </div>
            ) : (
              <>
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-indigo-500" />
                  </div>
                </div>
                <p className="font-medium text-slate-700 mb-1">
                  Drop your schema file here
                </p>
                <p className="text-sm text-slate-400">
                  or click to browse · .sql · .json · .csv
                </p>
              </>
            )}
          </div>

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 animate-in">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Manual entry */}
          <button
            onClick={handleManual}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all"
          >
            <FileCode className="w-4 h-4" />
            Enter schema manually
            <ArrowRight className="w-4 h-4 ml-auto text-slate-400" />
          </button>
        </div>

        {/* Supported formats note */}
        <p className="mt-8 text-xs text-slate-400 text-center">
          Supports <span className="font-medium text-slate-500">CREATE TABLE</span> SQL,
          structured JSON, and CSV exports from most DB tools
        </p>
      </main>
    </div>
  )
}

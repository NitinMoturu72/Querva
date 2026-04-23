import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ChevronRight, ArrowRight, Check } from 'lucide-react'
import { makeTable, makeColumn } from '../lib/schemaParser'

const DIALECTS = ['PostgreSQL', 'MySQL', 'SQLite', 'SQL Server', 'Oracle']
const COL_TYPES = [
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL(10,2)', 'FLOAT', 'DOUBLE',
  'VARCHAR(255)', 'VARCHAR(100)', 'VARCHAR(50)', 'TEXT', 'CHAR(1)',
  'BOOLEAN', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME',
  'JSON', 'UUID', 'BLOB',
]
const KEY_OPTIONS = ['none', 'PK', 'FK', 'UQ']

export default function SchemaPage({ schema, setSchema, dialect, setDialect }) {
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState(schema[0]?.id ?? null)

  const selectedTable = schema.find(t => t.id === selectedId) ?? null

  // ── Table operations ────────────────────────────────────────────────────────
  function addTable() {
    const t = makeTable({ name: `table_${schema.length + 1}`, columns: [] })
    setSchema(prev => [...prev, t])
    setSelectedId(t.id)
  }

  function deleteTable(id) {
    setSchema(prev => prev.filter(t => t.id !== id))
    setSelectedId(prev => {
      if (prev !== id) return prev
      const remaining = schema.filter(t => t.id !== id)
      return remaining[0]?.id ?? null
    })
  }

  function updateTableName(id, name) {
    setSchema(prev => prev.map(t => t.id === id ? { ...t, name } : t))
  }

  // ── Column operations ───────────────────────────────────────────────────────
  function addColumn() {
    if (!selectedId) return
    const col = makeColumn({ name: `column_${(selectedTable?.columns.length ?? 0) + 1}` })
    setSchema(prev => prev.map(t =>
      t.id === selectedId ? { ...t, columns: [...t.columns, col] } : t
    ))
  }

  function deleteColumn(colId) {
    setSchema(prev => prev.map(t =>
      t.id === selectedId
        ? { ...t, columns: t.columns.filter(c => c.id !== colId) }
        : t
    ))
  }

  function updateColumn(colId, field, value) {
    setSchema(prev => prev.map(t =>
      t.id === selectedId
        ? {
            ...t,
            columns: t.columns.map(c =>
              c.id === colId
                ? {
                    ...c,
                    [field]: value,
                    // Clear references if key is no longer FK
                    ...(field === 'key' && value !== 'FK' ? { references: null } : {}),
                  }
                : c
            ),
          }
        : t
    ))
  }

  function updateReference(colId, field, value) {
    setSchema(prev => prev.map(t =>
      t.id === selectedId
        ? {
            ...t,
            columns: t.columns.map(c =>
              c.id === colId
                ? { ...c, references: { ...(c.references || { table: '', column: '' }), [field]: value } }
                : c
            ),
          }
        : t
    ))
  }

  const canChat = schema.length > 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Topbar */}
      <header className="border-b border-slate-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="font-semibold text-slate-800 tracking-tight hover:text-indigo-700 transition-colors"
          >
            Querva
          </button>
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <span className="text-sm text-slate-500 schema-accent">Schema editor</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Dialect selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">Dialect</label>
            <select
              value={dialect}
              onChange={e => setDialect(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {DIALECTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          <button
            onClick={() => canChat && navigate('/chat')}
            disabled={!canChat}
            className={`
              flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all
              ${canChat
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'}
            `}
          >
            Start chatting
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="w-60 border-r border-slate-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest schema-accent">Tables</span>
            <button
              onClick={addTable}
              className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center transition-colors"
              title="Add table"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {schema.length === 0 && (
              <p className="px-4 py-6 text-xs text-slate-400 text-center leading-relaxed">
                No tables yet.<br />Click + to add one.
              </p>
            )}
            {schema.map(table => (
              <div
                key={table.id}
                onClick={() => setSelectedId(table.id)}
                className={`
                  group flex items-center gap-2 px-3 py-2 mx-2 rounded-lg cursor-pointer transition-all
                  ${selectedId === table.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'hover:bg-slate-50 text-slate-700'}
                `}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedId === table.id ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                <span className="text-sm font-medium truncate flex-1">{table.name}</span>
                <span className="text-xs text-slate-400 shrink-0">{table.columns.length}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTable(table.id) }}
                  className="opacity-0 group-hover:opacity-100 ml-1 w-5 h-5 rounded flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Detail panel ── */}
        <main className="flex-1 overflow-auto p-6">
          {!selectedTable ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <p className="text-slate-500 font-medium mb-1">No table selected</p>
              <p className="text-sm text-slate-400">Select a table from the sidebar or create a new one</p>
            </div>
          ) : (
            <div className="max-w-4xl animate-in">
              {/* Table name */}
              <div className="flex items-center gap-3 mb-6">
                <input
                  value={selectedTable.name}
                  onChange={e => updateTableName(selectedTable.id, e.target.value)}
                  className="text-xl font-semibold text-slate-800 bg-transparent border-b-2 border-transparent focus:border-indigo-400 focus:outline-none pb-0.5 transition-colors min-w-0"
                  placeholder="table_name"
                />
                <span className="text-sm text-slate-400 shrink-0">
                  {selectedTable.columns.length} column{selectedTable.columns.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Column table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[2fr_2fr_1fr_1fr_2fr_2fr_40px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <span>Column</span>
                  <span>Type</span>
                  <span>Nullable</span>
                  <span>Key</span>
                  <span>Default</span>
                  <span>References</span>
                  <span />
                </div>

                {/* Rows */}
                {selectedTable.columns.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    No columns yet — add one below.
                  </div>
                )}
                {selectedTable.columns.map((col, idx) => (
                  <div
                    key={col.id}
                    className={`grid grid-cols-[2fr_2fr_1fr_1fr_2fr_2fr_40px] gap-2 px-4 py-2 items-center text-sm transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/50 schema-row-alt'} hover:bg-indigo-50/30`}
                  >
                    {/* Name */}
                    <input
                      value={col.name}
                      onChange={e => updateColumn(col.id, 'name', e.target.value)}
                      className="font-mono text-sm text-slate-800 bg-transparent border border-transparent rounded-lg px-2 py-1 focus:border-indigo-300 focus:outline-none focus:bg-white w-full"
                      placeholder="column_name"
                    />

                    {/* Type */}
                    <select
                      value={col.type}
                      onChange={e => updateColumn(col.id, 'type', e.target.value)}
                      className="text-xs text-slate-700 bg-transparent border border-transparent rounded-lg px-2 py-1 focus:border-indigo-300 focus:outline-none focus:bg-white w-full font-mono"
                    >
                      {COL_TYPES.map(t => <option key={t}>{t}</option>)}
                      {!COL_TYPES.includes(col.type) && <option value={col.type}>{col.type}</option>}
                    </select>

                    {/* Nullable */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => updateColumn(col.id, 'nullable', !col.nullable)}
                        className={`w-8 h-5 rounded-full transition-colors ${col.nullable ? 'bg-emerald-400' : 'bg-slate-200'}`}
                      >
                        <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${col.nullable ? 'translate-x-3' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* Key */}
                    <select
                      value={col.key}
                      onChange={e => updateColumn(col.id, 'key', e.target.value)}
                      className="text-xs font-medium bg-transparent border border-transparent rounded-lg px-2 py-1 focus:border-indigo-300 focus:outline-none focus:bg-white w-full"
                    >
                      {KEY_OPTIONS.map(k => <option key={k}>{k}</option>)}
                    </select>

                    {/* Default */}
                    <input
                      value={col.default}
                      onChange={e => updateColumn(col.id, 'default', e.target.value)}
                      className="text-xs font-mono text-slate-600 bg-transparent border border-transparent rounded-lg px-2 py-1 focus:border-indigo-300 focus:outline-none focus:bg-white w-full"
                      placeholder="—"
                    />

                    {/* References (FK only) */}
                    {col.key === 'FK' ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={col.references?.table || ''}
                          onChange={e => updateReference(col.id, 'table', e.target.value)}
                          className="text-xs bg-transparent border border-transparent rounded-lg px-1 py-1 focus:border-indigo-300 focus:outline-none focus:bg-white flex-1 font-mono"
                        >
                          <option value="">— table —</option>
                          {schema.filter(t => t.id !== selectedId).map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                          ))}
                        </select>
                        <span className="text-slate-300">.</span>
                        <input
                          value={col.references?.column || ''}
                          onChange={e => updateReference(col.id, 'column', e.target.value)}
                          placeholder="col"
                          className="text-xs font-mono bg-transparent border border-transparent rounded-lg px-1 py-1 focus:border-indigo-300 focus:outline-none focus:bg-white w-14"
                        />
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs px-2">—</span>
                    )}

                    {/* Delete column */}
                    <button
                      onClick={() => deleteColumn(col.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add column row */}
                <div className="px-4 py-3 border-t border-slate-100">
                  <button
                    onClick={addColumn}
                    className="flex items-center gap-2 text-sm text-indigo-500 hover:text-indigo-700 font-medium transition-colors schema-accent"
                  >
                    <Plus className="w-4 h-4" />
                    Add column
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

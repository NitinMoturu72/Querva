import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import SchemaPage from './pages/SchemaPage'
import ChatPage from './pages/ChatPage'

export default function App() {
  const [schema, setSchema] = useState([])
  const [dialect, setDialect] = useState('PostgreSQL')

  return (
    <Routes>
      <Route
        path="/"
        element={<LandingPage onSchemaLoaded={(s) => setSchema(s)} />}
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
  )
}

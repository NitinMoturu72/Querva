import { createContext, useContext, useState, useEffect } from 'react'
import { getConversations, getConversation, createConversation as apiCreateConversation } from '../lib/mockAI'

const ConversationContext = createContext()

export function ConversationProvider({ children }) {
  const [conversations, setConversations] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Load all conversations for logged-in user
   */
  async function loadConversations() {
    setLoading(true)
    setError(null)
    try {
      const data = await getConversations()
      // Sort conversations by most recent first (by updatedAt or createdAt)
      const sorted = (data || []).sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime()
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime()
        return dateB - dateA // Most recent first
      })
      setConversations(sorted)
    } catch (err) {
      setError(err.message)
      console.error('Failed to load conversations:', err)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Load specific conversation
   */
  async function loadConversation(conversationId) {
    try {
      const data = await getConversation(conversationId)
      return data
    } catch (err) {
      console.error('Failed to load conversation:', err)
      throw err
    }
  }

  /**
   * Create new conversation and set as current
   */
  async function createConversation(name, dialect, schema) {
    setLoading(true)
    setError(null)
    try {
      const conversation = await apiCreateConversation(name, dialect, schema)
      setConversations(prev => [conversation, ...prev])
      setCurrentConversationId(conversation.id)
      return conversation
    } catch (err) {
      setError(err.message)
      console.error('Failed to create conversation:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  /**
   * Switch to a different conversation
   */
  function switchConversation(conversationId) {
    setCurrentConversationId(conversationId)
  }

  /**
   * Clear current conversation (when starting new chat without saving)
   */
  function clearConversation() {
    setCurrentConversationId(null)
  }

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        currentConversationId,
        loading,
        error,
        loadConversations,
        loadConversation,
        createConversation,
        switchConversation,
        clearConversation,
      }}
    >
      {children}
    </ConversationContext.Provider>
  )
}

/**
 * Hook to use conversation context
 */
export function useConversation() {
  const context = useContext(ConversationContext)
  if (!context) {
    throw new Error('useConversation must be used within ConversationProvider')
  }
  return context
}

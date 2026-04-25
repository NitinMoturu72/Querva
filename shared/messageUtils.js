/**
 * Extract conversation history from messages array
 * Filters out welcome and error messages, optionally limits to last N
 */
export function extractConversationHistory(messages, limit = null) {
  let filtered = messages.filter(msg => msg.id !== 'welcome' && !msg.isError)

  if (limit) {
    filtered = filtered.slice(-limit)
  }

  return filtered.map(msg => ({
    role: msg.role,
    content: msg.text
  }))
}

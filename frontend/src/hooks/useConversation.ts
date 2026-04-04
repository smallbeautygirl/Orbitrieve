import { useRef } from 'react'

const STORAGE_KEY = 'orbitrieve_conversation_id'

function getOrCreateConversationId(): string {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEY, id)
  return id
}

export function useConversation(): { conversationId: string; resetConversation: () => void } {
  const conversationId = useRef(getOrCreateConversationId())

  const resetConversation = (): void => {
    const id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
    conversationId.current = id
  }

  return { conversationId: conversationId.current, resetConversation }
}

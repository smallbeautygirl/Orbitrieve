import { streamChat } from '../api/chatApi'
import { useChatStore } from '../store/chatStore'
import { useConversation } from './useConversation'

const USER_MESSAGES: Record<string, string> = {
  SEARCH_FAILED: "Couldn't search the web right now. Please try again.",
  AGENT_FAILED: 'AI service is temporarily unavailable. Please try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment.',
  INTERNAL_ERROR: 'Something went wrong. Please refresh the page.',
}

export function useChat(): { sendMessage: (message: string) => Promise<void> } {
  const store = useChatStore()
  const { conversationId } = useConversation()

  const sendMessage = async (message: string): Promise<void> => {
    store.addUserMessage(message)
    const assistantId = store.startAssistantMessage()

    const history = useChatStore
      .getState()
      .messages.slice(0, -1) // exclude the new empty assistant message
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      for await (const event of streamChat({ message, conversation_id: conversationId, history })) {
        switch (event.type) {
          case 'thinking':
          case 'searching':
          case 'writing':
            store.setStage(event.type)
            break
          case 'token':
            store.setStage(null)
            if (event.content) store.appendToken(assistantId, event.content)
            break
          case 'sources':
            if (event.sources) store.setSources(assistantId, event.sources)
            break
          case 'done':
            store.finishLoading()
            break
          case 'error':
            store.setError(
              USER_MESSAGES[event.code ?? 'INTERNAL_ERROR'] ?? USER_MESSAGES['INTERNAL_ERROR'],
            )
            break
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        store.setError(USER_MESSAGES['INTERNAL_ERROR'])
      }
    }
  }

  return { sendMessage }
}

import { create } from 'zustand'
import type { Message, Source, Stage } from '../types/chat'

interface ChatStore {
  messages: Message[]
  isLoading: boolean
  currentStage: Stage
  error: string | null
  addUserMessage: (content: string) => string
  startAssistantMessage: () => string
  appendToken: (id: string, token: string) => void
  setStage: (stage: Stage) => void
  setSources: (id: string, sources: Source[]) => void
  setError: (error: string) => void
  finishLoading: () => void
  reset: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoading: false,
  currentStage: null,
  error: null,

  addUserMessage: (content) => {
    const id = crypto.randomUUID()
    set((state) => ({
      messages: [...state.messages, { id, role: 'user', content }],
      isLoading: true,
      currentStage: 'thinking',
      error: null,
    }))
    return id
  },

  startAssistantMessage: () => {
    const id = crypto.randomUUID()
    set((state) => ({
      messages: [...state.messages, { id, role: 'assistant', content: '' }],
    }))
    return id
  },

  appendToken: (id, token) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + token } : m,
      ),
    })),

  setStage: (currentStage) => set({ currentStage }),

  setSources: (id, sources) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, sources } : m)),
    })),

  setError: (error) => set({ error, isLoading: false, currentStage: null }),

  finishLoading: () => set({ isLoading: false, currentStage: null }),

  reset: () => set({ messages: [], isLoading: false, currentStage: null, error: null }),
}))

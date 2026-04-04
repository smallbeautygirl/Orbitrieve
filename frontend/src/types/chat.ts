export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface Source {
  index: number
  title: string
  url: string
  snippet: string
}

export type Stage = 'thinking' | 'searching' | 'writing' | null

export type SSEEventType =
  | 'thinking'
  | 'searching'
  | 'writing'
  | 'token'
  | 'sources'
  | 'done'
  | 'error'

export interface SSEEvent {
  type: SSEEventType
  content?: string
  sources?: Source[]
  code?: string
  error?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

export interface ChatRequest {
  message: string
  conversation_id: string
  history: ChatMessage[]
}

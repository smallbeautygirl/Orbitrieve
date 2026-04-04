import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../../store/chatStore'

beforeEach(() => {
  useChatStore.getState().reset()
})

describe('chatStore', () => {
  it('addUserMessage adds a user message and sets isLoading + thinking stage', () => {
    useChatStore.getState().addUserMessage('Hello')
    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].role).toBe('user')
    expect(state.messages[0].content).toBe('Hello')
    expect(state.isLoading).toBe(true)
    expect(state.currentStage).toBe('thinking')
  })

  it('startAssistantMessage adds empty assistant message and returns its id', () => {
    const id = useChatStore.getState().startAssistantMessage()
    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].id).toBe(id)
    expect(state.messages[0].role).toBe('assistant')
    expect(state.messages[0].content).toBe('')
  })

  it('appendToken appends token content to the correct message', () => {
    const id = useChatStore.getState().startAssistantMessage()
    useChatStore.getState().appendToken(id, 'Hello')
    useChatStore.getState().appendToken(id, ' world')
    expect(useChatStore.getState().messages[0].content).toBe('Hello world')
  })

  it('setSources attaches sources to the correct message', () => {
    const id = useChatStore.getState().startAssistantMessage()
    const sources = [{ index: 1, title: 'Reuters', url: 'https://reuters.com', snippet: 'news' }]
    useChatStore.getState().setSources(id, sources)
    expect(useChatStore.getState().messages[0].sources).toEqual(sources)
  })

  it('setError sets error message and clears loading state', () => {
    useChatStore.getState().setError('Something went wrong')
    const state = useChatStore.getState()
    expect(state.error).toBe('Something went wrong')
    expect(state.isLoading).toBe(false)
    expect(state.currentStage).toBeNull()
  })

  it('reset clears all state', () => {
    useChatStore.getState().addUserMessage('Hello')
    useChatStore.getState().reset()
    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(0)
    expect(state.isLoading).toBe(false)
    expect(state.currentStage).toBeNull()
  })
})

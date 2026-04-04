import { useChatStore } from './store/chatStore'
import { useChat } from './hooks/useChat'
import { useConversation } from './hooks/useConversation'
import { Header } from './components/Header'
import { MessageList } from './components/MessageList'
import { ChatInput } from './components/ChatInput'
import { theme } from './styles/theme'

export default function App(): JSX.Element {
  const { messages, isLoading, currentStage } = useChatStore()
  const { sendMessage } = useChat()
  const { resetConversation } = useConversation()
  const reset = useChatStore((s) => s.reset)

  const handleNewChat = (): void => {
    resetConversation()
    reset()
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: theme.fonts.base,
        backgroundColor: theme.colors.surface,
        maxWidth: '800px',
        margin: '0 auto',
        boxShadow: '0 0 40px rgba(0,0,0,0.06)',
      }}
    >
      <Header onNewChat={handleNewChat} />
      <MessageList messages={messages} currentStage={currentStage} />
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  )
}

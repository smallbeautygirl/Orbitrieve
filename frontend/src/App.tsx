import { useChatStore } from './store/chatStore';
import { useChat } from './hooks/useChat';
import { useConversation } from './hooks/useConversation';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';

export default function App(): JSX.Element {
  const { messages, isLoading, currentStage } = useChatStore();
  const { sendMessage } = useChat();
  const { resetConversation } = useConversation();
  const reset = useChatStore((s) => s.reset);

  const handleNewChat = (): void => {
    resetConversation();
    reset();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#111111',
      }}
    >
      <Header onNewChat={handleNewChat} />
      <MessageList
        messages={messages}
        currentStage={currentStage}
        onSuggestionSelect={sendMessage}
      />
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}

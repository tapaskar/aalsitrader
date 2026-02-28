import { useState, useRef, useEffect, useCallback } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { getAuthHeaders } from '../store/authStore';
import { Send, Users, MessageSquare, Bot, User, Loader2, Sparkles } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface ChatMessage {
  id: string;
  role: 'user' | 'prime';
  content: string;
  timestamp: number;
  intent?: string;
}

export function CommPanel() {
  const { comms, agents, addActivity } = useDashboardStore();
  const [activeTab, setActiveTab] = useState<'chat' | 'squad' | 'alerts'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/prime/chat/history?limit=50`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadHistory();
  }, []);

  const sendMessage = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || isLoading) return;

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/prime/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ message }),
      });

      if (res.ok) {
        const data = await res.json();
        const primeMessage: ChatMessage = {
          id: `prime-${Date.now()}`,
          role: 'prime',
          content: data.response.message,
          timestamp: Date.now(),
          intent: data.response.intent,
        };
        setMessages(prev => [...prev, primeMessage]);

        // Add agent activities to the activity feed
        if (data.response.agentActivities && Array.isArray(data.response.agentActivities)) {
          data.response.agentActivities.forEach((activity: any) => {
            addActivity({
              agentId: activity.agentId,
              agentName: activity.agentName,
              agentGreek: activity.agentGreek,
              agentColor: activity.agentColor,
              type: activity.type || 'info',
              content: activity.content,
              tags: activity.tags || [],
            });
          });
        }
      } else {
        // Handle error
        const primeMessage: ChatMessage = {
          id: `prime-${Date.now()}`,
          role: 'prime',
          content: "I'm having trouble connecting right now. Please try again.",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, primeMessage]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      const primeMessage: ChatMessage = {
        id: `prime-${Date.now()}`,
        role: 'prime',
        content: "Connection error. Please check your network and try again.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, primeMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [inputValue, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getAgentColor = (name: string) => {
    const agent = agents.find((a) => a.name === name);
    return agent?.color || '#6b7280';
  };

  const getAgentGreek = (name: string) => {
    const agent = agents.find((a) => a.name === name);
    return agent?.greek || '?';
  };

  const filteredComms = comms.filter((comm) => {
    if (activeTab === 'squad') return true;
    if (activeTab === 'alerts') return comm.content.includes('ALERT') || comm.content.includes('WARNING');
    return true;
  });

  const quickPrompts = [
    { label: '🔍 Find Trades', prompt: "Scan for buy opportunities" },
    { label: '📊 Portfolio', prompt: "How's my portfolio?" },
    { label: '⚖️ Risk Check', prompt: "What's my risk exposure?" },
    { label: '📈 Analyze', prompt: "Analyze RELIANCE" },
  ];

  return (
    <div className="bg-card rounded-2xl border border-border p-4 md:p-6 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
        <MessageSquare className="w-5 h-5 text-accent" />
        <h3 className="font-semibold">Prime Intelligence</h3>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>AI-Powered</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['chat', 'squad', 'alerts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              activeTab === tab
                ? 'bg-card-hover text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab === 'chat' ? 'Chat with Prime' : tab === 'squad' ? 'Squad Comms' : tab}
          </button>
        ))}
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <Bot className="w-10 h-10 mx-auto mb-3 text-accent opacity-60" />
                <p className="font-medium text-gray-400 mb-1">Chat with Prime</p>
                <p className="text-xs">Ask about stocks, your portfolio, or get trading insights</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'prime' && (
                    <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-accent" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-accent text-white rounded-br-sm'
                        : 'bg-card-hover text-gray-200 rounded-bl-sm border border-border/50'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className={`flex items-center gap-1.5 mt-1 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.intent && msg.role === 'prime' && (
                        <span className="text-[10px] text-gray-500">
                          {msg.intent.replace(/_/g, ' ')}
                        </span>
                      )}
                      {msg.intent && msg.role === 'prime' && (
                        <span className="text-[10px] text-gray-600">·</span>
                      )}
                      <span className={`text-[10px] ${msg.role === 'user' ? 'text-white/50' : 'text-gray-500'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-accent" />
                </div>
                <div className="bg-card-hover rounded-xl px-4 py-3 border border-border/50">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length === 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {quickPrompts.map((qp) => (
                <button
                  key={qp.label}
                  onClick={() => {
                    setInputValue(qp.prompt);
                    inputRef.current?.focus();
                  }}
                  className="px-3 py-1.5 bg-card-hover hover:bg-border rounded-full text-xs text-gray-300 transition-colors border border-border/50"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Prime anything..."
              className="flex-1 bg-card-hover border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-accent"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim()}
              className="p-2.5 bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Squad Comms Tab */}
      {activeTab !== 'chat' && (
        <div className="space-y-3 max-h-[300px] overflow-y-auto flex-1">
          {filteredComms.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Agent communications will appear here</p>
            </div>
          ) : (
            filteredComms.slice(0, 20).map((comm) => (
              <div key={comm.id} className="bg-card-hover rounded-lg p-3 text-sm border border-border/40">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="font-semibold"
                    style={{ color: getAgentColor(comm.from) }}
                  >
                    {getAgentGreek(comm.from)} {comm.from}
                  </span>
                  <span className="text-gray-400">→</span>
                  {comm.to === 'Human' ? (
                    <span className="text-white font-medium">You</span>
                  ) : (
                    <span style={{ color: getAgentColor(comm.to) }}>
                      {getAgentGreek(comm.to)} {comm.to}
                    </span>
                  )}
                </div>
                <p className="text-gray-300 text-xs pl-4 border-l-2 border-border">
                  "{comm.content}"
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

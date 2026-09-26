"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Bot, Zap, MessageSquare, Loader2, AlertCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function CoachChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prompts = [
    "Why did gold spike today?",
    "Review my last trade",
    "What does RSI mean?",
    "Am I overtrading?",
    "How do I set a proper stop loss?",
    "What's the Market Mood telling us?",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setError(null);
    
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    
    try {
      const response = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, history: messages }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }
      
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      setRemaining(data.remaining ?? 0);
    } catch (e: any) {
      setError(e.message);
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I'm having technical difficulties. Please try again in a moment." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">AI Trading Coach</h2>
            <p className="text-xs text-muted-foreground">Powered by Groq · Llama 3.3 70B</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {remaining} messages left today
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Ask me anything about trading, your positions, or market concepts.</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => { setInput(p); sendMessage(); }}
                  className="px-3 py-1.5 text-xs bg-secondary rounded-lg hover:bg-accent transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about RSI, your trades, market mood..."
            disabled={isLoading || remaining === 0}
            className="flex-1 px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || remaining === 0}
            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {remaining === 0 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">Daily limit reached. Try again tomorrow.</p>
        )}
      </div>
    </div>
  );
}

export default CoachChat;
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type AIChatAssistantProps = {
  isLoading?: boolean;
  className?: string;
  initialMessage?: string;
};

export default function AIChatAssistant({
  isLoading = false,
  className = "",
  initialMessage = "I can help you with your blog post. What would you like assistance with today?"
}: AIChatAssistantProps) {
  const [prompt, setPrompt] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: initialMessage }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle sending a message
  const handleSend = async () => {
    if (!prompt.trim()) return;
    
    // Add user message to the chat
    const userMessage: Message = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input field
    const userQuery = prompt;
    setPrompt("");
    
    // Show loading state and record start time
    setChatLoading(true);
    setStartTime(Date.now());
    setResponseTime(null);
    
    try {
      // Get conversation history (last 10 messages or fewer)
      const conversationHistory = messages.slice(-10);
      
      // Call the API
      const response = await fetch("/api/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: userQuery,
          type: "chat_assistant",
          conversation: conversationHistory
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get a response from the AI assistant");
      }

      // Get and process the response
      const data = await response.json();
      
      // Calculate response time
      if (startTime) {
        setResponseTime(Date.now() - startTime);
      }
      
      if (data.response) {
        // Add assistant response to the chat
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response
        }]);
      } else {
        throw new Error("Invalid response from the assistant");
      }
    } catch (error: any) {
      // Handle errors gracefully
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: `Sorry, I encountered an error: ${error.message || "Unknown error"}`
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {isChatOpen ? (
        <Card className="w-[450px] shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-medium">Blog AI Assistant</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={() => setIsChatOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="max-h-[450px] overflow-y-auto pr-2">
                {messages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`mb-3 ${
                      msg.role === 'assistant' 
                        ? 'bg-muted p-4 rounded-lg text-base' 
                        : 'bg-blue-50 p-3 rounded-lg text-base ml-auto max-w-[85%]'
                    }`}
                  >
                    <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  </div>
                ))}
                {chatLoading && (
                  <div className="bg-muted p-4 rounded-lg text-base">
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse flex space-x-2">
                        <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                        <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                        <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                      </div>
                      <span>Generating response...</span>
                    </div>
                  </div>
                )}
                {responseTime && !chatLoading && messages.length > 1 && (
                  <div className="text-xs text-gray-400 text-right mb-2">
                    Response time: {(responseTime / 1000).toFixed(1)}s
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2">
                <Textarea 
                  placeholder="Ask for writing help or ideas..." 
                  className="min-h-12 flex-1 text-base" 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button 
                  size="sm" 
                  className="px-4 h-12" 
                  onClick={handleSend}
                  disabled={chatLoading || isLoading || !prompt.trim()}
                >
                  {chatLoading ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  )}
                  <span className="sr-only">Send</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button 
          className="rounded-full h-16 w-16 shadow-lg" 
          onClick={() => setIsChatOpen(true)}
          size="icon"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span className="sr-only">Open chat</span>
        </Button>
      )}
    </div>
  );
} 
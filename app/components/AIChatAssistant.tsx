"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { Sparkles, User, MessageCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";


type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

type AIChatAssistantProps = {
  isLoading?: boolean;
  className?: string;
  initialMessage?: string;
  onSend?: (prompt: string) => void;
  loading?: boolean;
  placeholder?: string;
  compact?: boolean;
};

export default function AIChatAssistant({
  isLoading = false,
  className = "",
  initialMessage = "I'm your blog post assistant. I can help you with ideas, content structure, or any questions about creating bilingual blog posts. What would you like help with?",
  onSend,
  loading = false,
  placeholder = "Ask for writing help or ideas...",
  compact = false
}: AIChatAssistantProps) {
  const [prompt, setPrompt] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: initialMessage, timestamp: new Date() }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const placeholders = [
    "Help me with college application ideas...",
    "Suggest topics for my education blog...",
    "Tips for writing a scholarship application..."
  ];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Format time to display in a user-friendly way
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Check if the device is mobile on component mount and when window resizes
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Check initially
    checkIfMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkIfMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Add body class to prevent scrolling when chat is open on mobile
  useEffect(() => {
    if (isMobile && isChatOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isMobile, isChatOpen]);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle Escape key press to close chat
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChatOpen) {
        setIsChatOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isChatOpen]);

  // Handle clicking outside to close chat on desktop
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isChatOpen && chatRef.current && !chatRef.current.contains(e.target as Node) && !isMobile) {
        setIsChatOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isChatOpen, isMobile]);

  // Handle sending a message
  const handleSend = async () => {
    if (!prompt.trim()) return;
    
    // If onSend prop is provided, use that instead
    if (onSend) {
      onSend(prompt);
      setPrompt("");
      return;
    }
    
    // Add user message to the chat
    const userMessage: Message = { 
      role: 'user', 
      content: prompt,
      timestamp: new Date()
    };
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
          content: data.response,
          timestamp: new Date()
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
          content: `Sorry, I encountered an error: ${error.message || "Unknown error"}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Handle form submission from the PlaceholdersAndVanishInput
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSend();
  };

  // Handle input change from the PlaceholdersAndVanishInput
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPrompt(e.target.value);
  };

  // If compact mode, render just the input and button
  if (compact) {
    return (
      <div className={`${className}`}>
        <PlaceholdersAndVanishInput
          placeholders={placeholders}
          onChange={handleInputChange}
          onSubmit={handleFormSubmit}
        />
      </div>
    );
  }

  // Chat window animation variants
  const chatVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        type: "spring", 
        damping: 25, 
        stiffness: 300 
      }
    },
    exit: { 
      opacity: 0, 
      y: 30, 
      scale: 0.95,
      transition: { 
        duration: 0.2 
      }
    }
  };

  // Button animation variants
  const buttonVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { 
      scale: 1, 
      opacity: 1,
      transition: { 
        type: "spring", 
        damping: 20, 
        stiffness: 300,
        delay: 0.1
      }
    },
    exit: { 
      scale: 0, 
      opacity: 0,
      transition: { 
        duration: 0.2 
      } 
    },
    tap: {
      scale: 0.95
    },
    hover: {
      scale: 1.05
    }
  };

  return (
    <div className="fixed bottom-0 right-4 z-[9000]" style={{ pointerEvents: 'auto' }}>
      <AnimatePresence mode="wait">
        {isChatOpen ? (
          <React.Fragment key="chat-window">
            {/* Mobile overlay - fullscreen drawer */}
            {isMobile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/30 z-[9050] transition-opacity duration-300" 
                onClick={() => setIsChatOpen(false)}
                style={{ pointerEvents: 'auto' }}
              />
            )}
            
            <motion.div
              ref={chatRef}
              variants={chatVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={`
                ${isMobile 
                  ? 'fixed inset-x-0 bottom-0 top-[30vh] sm:top-auto sm:max-h-[70vh] m-auto sm:m-4 z-[9100] max-w-[500px] rounded-t-xl rounded-b-none' 
                  : 'w-[450px] h-[70vh] shadow-lg rounded-xl z-[9100]'
                }
                bg-white shadow-xl flex flex-col
              `}
              style={{ pointerEvents: 'auto' }}
            >
              {/* New style header with close button */}
              <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0 relative">
                <div className="flex items-center font-medium">
                  <span><Sparkles className="w-4 h-4 mr-2" /></span> 
                  BagelEdu AI Assistant
                </div>
                <motion.button 
                  onClick={() => setIsChatOpen(false)}
                  className="relative w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 z-[9200]"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ pointerEvents: 'auto' }}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </motion.button>
              </div>
              
              {/* Chat content area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                  <div key={index} className="flex flex-col mb-3">
                    <div className={`flex items-start gap-2 ${msg.role === 'assistant' ? '' : 'flex-row-reverse'}`}>
                      {/* Avatar */}
                      <div className={`flex-shrink-0`}>
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
                          msg.role === 'assistant' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-50 text-indigo-600'
                        }`}>
                          {msg.role === 'assistant' 
                            ? <Sparkles className="h-5 w-5" /> 
                            : <User className="h-5 w-5" />
                          }
                        </div>
                      </div>
                      
                      {/* Message bubble */}
                      <div 
                        className={`${
                          msg.role === 'assistant' 
                            ? 'bg-gray-100 rounded-lg rounded-tl-none text-sm max-w-[85%]' 
                            : 'bg-blue-50 rounded-lg rounded-tr-none text-sm max-w-[85%]'
                        } py-3 px-4`}
                      >
                        <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                        
                        {/* Timestamp */}
                        {msg.timestamp && (
                          <div className={`text-xs mt-1.5 text-right ${
                            msg.role === 'assistant' ? 'text-gray-500' : 'text-blue-600/70'
                          }`}>
                            {formatTime(msg.timestamp)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0">
                      <div className="h-9 w-9 rounded-full flex items-center justify-center bg-indigo-100 text-indigo-600">
                        <Sparkles className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="bg-gray-100 py-3 px-4 rounded-lg rounded-tl-none text-sm">
                      <div className="flex items-center gap-2">
                        <div className="animate-pulse flex space-x-2">
                          <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                          <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                          <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                        </div>
                        <TextShimmer className='font-mono text-sm' duration={1}>
                          Generating response...
                        </TextShimmer>
                      </div>
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
              
              {/* Input area */}
              <div className="border-t flex-shrink-0 mt-auto">
                <PlaceholdersAndVanishInput
                  placeholders={placeholders}
                  onChange={handleInputChange}
                  onSubmit={handleFormSubmit}
                  className="px-4 py-3"
                />
              </div>
            </motion.div>
          </React.Fragment>
        ) : (
          <div className="relative" style={{ pointerEvents: 'auto', zIndex: 9999 }}>
            <motion.div
              key="chat-button"
              variants={buttonVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              whileHover="hover"
              whileTap="tap"
              className="relative"
              style={{ pointerEvents: 'auto', zIndex: 9999 }}
            >
              <Button
                onClick={() => setIsChatOpen(true)}
                className="w-14 h-14 rounded-full shadow-md bg-black hover:bg-indigo-700"
                size="icon"
                style={{ pointerEvents: 'auto', zIndex: 9999 }}
              >
                <MessageCircle className="h-6 w-6" />
                <span className="sr-only">Open Chat</span>
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
} 
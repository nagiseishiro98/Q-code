import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowUp, 
  Code, 
  Terminal, 
  Cpu, 
  Search, 
  History, 
  Plus, 
  Layers, 
  ChevronRight, 
  Settings,
  Copy,
  Check,
  Sparkles,
  Command,
  PanelLeft,
  X,
  FileText,
  Square,
  Paperclip,
  Bot,
  ToggleLeft,
  ToggleRight,
  Pencil,
  RotateCcw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { NVIDIA_MODELS } from './constants';
import { cn } from './lib/utils';
import Lenis from 'lenis';
import Prism from 'prismjs';
import { LoadingBreadcrumb } from './components/LoadingBreadcrumb';
import 'prismjs/themes/prism-dark.css';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css';
import { Logo } from './components/Logo';
import { ModelSelector } from './components/ModelSelector';
import { MemoryAndSkillsModal } from './components/MemoryAndSkillsModal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  modelId: string;
  createdAt: number;
}

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return (
      <code className="bg-white/10 px-1.5 py-0.5 rounded text-[13px] font-mono text-white/90" {...props}>
        {children}
      </code>
    );
  }

  const codeContent = String(children).replace(/\n$/, '');
  let highlightedCode = codeContent;
  
  try {
    if (language && Prism.languages[language]) {
      highlightedCode = Prism.highlight(codeContent, Prism.languages[language], language);
    }
  } catch (e) {}

  return (
    <div className="my-6 rounded-[12px] overflow-hidden bg-[#0A0A0A] shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03]">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1.5 mr-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>
          <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold font-mono">{language || 'code'}</span>
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] font-medium text-white/50 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check size={12} className="text-green-400" />
              <span>COPIED</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>COPY</span>
            </>
          )}
        </button>
      </div>
      <pre className={cn("p-4 overflow-x-auto text-[13px] font-mono leading-relaxed", className)} {...props}>
        <code className={className} dangerouslySetInnerHTML={{ __html: highlightedCode || codeContent }} />
      </pre>
    </div>
  );
};

export default function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [memory, setMemory] = useState(() => localStorage.getItem('nv-memory') || '');
  const [skills, setSkills] = useState<{id: string, name: string, content: string}[]>(() => {
    const saved = localStorage.getItem('nv-skills');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('nv-selected-model') || NVIDIA_MODELS[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<{name: string, content: string}[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [menuMessageIndex, setMenuMessageIndex] = useState<number | null>(null);
  const [editInputValue, setEditInputValue] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const startLongPress = (index: number, content: string) => {
    longPressTimer.current = setTimeout(() => {
      setMenuMessageIndex(index);
      setEditInputValue(content);
    }, 500); // 500ms
  };

  const endLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleEditSave = (index: number) => {
    if (!currentChatId) return;
    setChats(prev => prev.map(c => 
      c.id === currentChatId 
        ? { 
            ...c, 
            messages: [
              ...c.messages.slice(0, index),
              { ...c.messages[index], content: editInputValue },
              // Remove everything after the edited user message
            ].slice(0, index + 1)
          }
        : c
    ));
    setEditingMessageIndex(null);
    setEditInputValue('');
    triggerRegenerationAt(index, editInputValue);
  };

  const triggerRegenerationAt = async (index: number, content: string) => {
    if (!currentChatId) return;
    
    // We need to pass the chat that was updated
    const chat = chats.find(c => c.id === currentChatId)!;
    const messagesBefore = chat.messages.slice(0, index);
    const userMessage = { role: 'user', content };
    
    // Update local chat - truncate
    setChats(prev => prev.map(c => 
      c.id === currentChatId 
        ? { ...c, messages: [...messagesBefore, userMessage] }
        : c
    ));
    
    // Run sendMessage
    performSendMessage(userMessage, currentChatId, [...messagesBefore]);
  };

  const handleRegenerate = async (index: number) => {
    if (!currentChatId) return;
    const chat = chats.find(c => c.id === currentChatId)!;
    // Find the user message before this one
    const userMessageIndex = index - 1;
    if (userMessageIndex < 0) return;
    const userMessage = chat.messages[userMessageIndex];
    
    // Truncate
    triggerRegenerationAt(userMessageIndex, userMessage.content);
  };
  
  // Refactored sendMessage logic to be callable
  const performSendMessage = async (userMessage: Message, chatId: string, history: Message[]) => {
    setIsLoading(true);
    const controller = new AbortController();
    setAbortController(controller);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: selectedModel,
          messages: [...history, userMessage],
          stream: true,
          context: [
            memory ? `SYSTEM_MEMORY:\n${memory}` : '',
            skills.map(s => `SKILL: ${s.name}\n${s.content}`).join('\n\n'),
            attachedFiles.map(f => `FILE: ${f.name}\n${f.content}`).join('\n\n')
          ].filter(Boolean).join('\n\n'),
          isAgentMode
        }),
      });
      if (!response.ok) throw new Error('API request failed');
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      setChats(prev => prev.map(c => 
        c.id === chatId 
          ? { ...c, messages: [...c.messages, { role: 'assistant', content: '' }] }
          : c
      ));
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const json = JSON.parse(data);
              const text = json.choices[0]?.delta?.content || '';
              assistantContent += text;
              setChats(prev => prev.map(c => 
                c.id === chatId 
                  ? { 
                      ...c, 
                      messages: c.messages.map((m, i) => 
                        i === c.messages.length - 1 ? { ...m, content: assistantContent } : m
                      )
                    }
                  : c
              ));
            } catch (e) {}
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') console.error(error);
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentChatId) return;
    const userMessage: Message = { role: 'user', content: input };
    const chatId = currentChatId;
    setChats(prev => prev.map(c => 
      c.id === chatId 
        ? { ...c, messages: [...c.messages, userMessage], title: c.messages.length === 0 ? input.slice(0, 30) + '...' : c.title }
        : c
    ));
    setInput('');
    const chat = chats.find(c => c.id === chatId)!;
    performSendMessage(userMessage, chatId, chat.messages);
  };

  useEffect(() => {
    localStorage.setItem('nv-selected-model', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('nv-memory', memory);
  }, [memory]);

  useEffect(() => {
    localStorage.setItem('nv-skills', JSON.stringify(skills));
  }, [skills]);

  const suggestedSkills = useMemo(() => [
    { cmd: '/frontend', label: 'Frontend Architect', desc: 'Focus on UI/UX, React, and Motion', context: 'Focus on building a premium frontend using React, Tailwind CSS, and Framer Motion. Prioritize micro-interactions and accessibility.' },
    { cmd: '/backend', label: 'Backend Specialist', desc: 'Node.js, APIs, and Data systems', context: 'Act as a senior backend engineer. Focus on scalable Express.js structures, middleware, and robust error handling.' },
    { cmd: '/security', label: 'Security Lead', desc: 'Hardening and Auth protocols', context: 'Strictly follow security best practices. Implement OWASP guards, zero-trust patterns, and secure authentication.' },
    { cmd: '/performance', label: 'Performance Guru', desc: 'Optimization and Core Web Vitals', context: 'Optimize for speed. Focus on bundle size, efficient React renders, and smart caching.' }
  ], []);

  const toggleFileAttachment = async (fileName: string) => {
    if (attachedFiles.find(f => f.name === fileName)) {
      setAttachedFiles(prev => prev.filter(f => f.name !== fileName));
      return;
    }

    try {
      const res = await fetch(`/api/files/${fileName}`);
      const data = await res.json();
      if (data.content) {
        setAttachedFiles(prev => [...prev, { name: fileName, content: data.content }]);
      }
    } catch (error) {
      console.error("Failed to attach file", error);
    }
  };

  const allSkills = useMemo(() => [
    ...suggestedSkills,
    ...skills.map(s => ({
      cmd: `/${s.name.replace(/\.[^/.]+$/, "").toLowerCase().replace(/\s+/g, '-')}`,
      label: s.name,
      desc: 'User uploaded skill',
      context: s.content
    }))
  ], [suggestedSkills, skills]);

  const filteredSkills = useMemo(() => {
    if (input.startsWith('/')) {
      const query = input.slice(1).toLowerCase();
      return allSkills.filter(s => s.cmd.toLowerCase().includes(query) || s.label.toLowerCase().includes(query));
    }
    return [];
  }, [input, allSkills]);

  useEffect(() => {
    if (input.startsWith('/') && filteredSkills.length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
    setSelectedSuggestionIndex(0);
  }, [input, filteredSkills.length]);

  const selectSkill = (skill: any) => {
    const [command, ...rest] = input.split(' ');
    const prompt = rest.join(' ');
    
    setInput(''); 
    setShowSuggestions(false);
    
    const userMessage: Message = { 
      role: 'user', 
      content: `[CONTEXT: ${skill.label}] ${skill.context}\n\n${prompt ? `Task: ${prompt}` : 'Task: '}` 
    };
    
    if (!currentChatId) {
      const newChatId = Date.now().toString();
      const newChat: Chat = {
        id: newChatId,
        title: skill.label,
        messages: [userMessage],
        modelId: selectedModel,
        createdAt: Date.now(),
      };
      setChats(prev => [newChat, ...prev]);
      setCurrentChatId(newChatId);
    } else {
      setChats(prev => prev.map(c => 
        c.id === currentChatId ? { ...c, messages: [...c.messages, userMessage] } : c
      ));
    }
  };
  
  const currentChat = chats.find(c => c.id === currentChatId);

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
    });
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  useEffect(() => {
    const container = document.getElementById('chat-container');
    if (!container) return;
    
    // Instead of window, check container scroll
    const isNearBottom = container.clientHeight + container.scrollTop >= container.scrollHeight - 150;
    if (isNearBottom) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'instant' as any
      });
    }
  }, [currentChat?.messages]);

  const createChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Code Project',
      messages: [],
      modelId: selectedModel,
      createdAt: Date.now(),
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
  };

  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-amoled relative text-gray-200">
      {/* Minimal Sidebar */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="h-screen border-r border-white/5 flex flex-col z-20 sticky top-0 bg-[#0A0A0A] shrink-0 overflow-hidden"
          >
            <div className="p-4 flex items-center justify-between w-[260px]">
              <div className="flex items-center">
                <div className="text-white">
                  <Logo size={20} />
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60">
                <PanelLeft size={16} />
              </button>
            </div>

            <div className="p-3 w-[260px]">
              <motion.button 
                whileTap={{ scale: 0.96 }}
                onClick={createChat}
                className="w-full flex items-center gap-2 py-2 px-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm text-white/80"
              >
                <Plus size={14} className="text-white/60" />
                <span className="font-medium">New Project</span>
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-2 w-[260px]">
              <div className="text-[9px] uppercase tracking-widest text-white/30 font-bold px-2 mt-4 mb-2">History</div>
              <AnimatePresence>
                {chats.map(chat => (
                  <motion.button
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={chat.id}
                    onClick={() => setCurrentChatId(chat.id)}
                    className={cn(
                      "w-full text-left py-1.5 px-2 rounded-md transition-colors flex items-center gap-2 text-xs",
                      currentChatId === chat.id ? "bg-white/10 text-white" : "hover:bg-white/5 text-white/60"
                    )}
                  >
                    <History size={12} className={currentChatId === chat.id ? "text-white" : "text-white/30"} />
                    <span className="truncate flex-1">{chat.title}</span>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen relative w-full overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 z-10 sticky top-0 bg-[#0A0A0A]/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-1 hover:bg-white/10 rounded transition-colors mr-2 text-white/60">
                <PanelLeft size={16} />
              </button>
            )}
            <div className="flex items-center gap-2 text-white/60">
              <Cpu size={14} />
              <h1 className="text-xs font-semibold tracking-wide">WORKSPACE</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsSettingsOpen(true)}
               className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
               title="Settings"
             >
               <Settings size={16} />
             </button>
             <button 
               onClick={() => setIsAgentMode(!isAgentMode)}
               className={cn(
                 "flex items-center gap-2 px-2.5 py-1.5 border rounded-md transition-all text-xs font-medium",
                 isAgentMode 
                  ? "bg-purple-500/20 border-purple-500/30 text-purple-300" 
                  : "bg-white/5 border-white/5 hover:bg-white/10 text-white/60"
               )}
             >
               <Bot size={14} className={isAgentMode ? "text-purple-400" : "text-white/40"} />
               <span>Agent Mode</span>
               {isAgentMode ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
             </button>

             <ModelSelector 
               selectedModel={selectedModel} 
               onSelectModel={setSelectedModel}
             />
          </div>
        </header>

        {/* Chat Area */}
        <MemoryAndSkillsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          memory={memory}
          setMemory={setMemory}
          skills={skills}
          setSkills={setSkills}
        />
        <div id="chat-container" className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar scroll-smooth">
          <div className="w-full max-w-3xl mx-auto px-4 py-8 pb-40">
            <div className="max-w-4xl mx-auto space-y-8 pb-32">
            {!currentChat ? (
              <div className="h-[50vh] flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-14 h-14 bg-white/[0.03] border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] rounded-2xl flex items-center justify-center">
                  <Logo size={28} className="text-white/80" />
                </div>
                <h2 className="text-lg font-medium text-white/80">Start building</h2>
                <div className="grid gap-2 w-full max-w-sm">
                   {[
                     { cmd: "Frontend", sub: "React components via Framer Motion" },
                     { cmd: "Backend", sub: "Node.js scalable architectures" }
                   ].map((item, i) => (
                     <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.3 }}
                      key={i}
                      onClick={() => {
                        createChat();
                        setTimeout(() => setInput(`${item.cmd}: ${item.sub}`), 100);
                      }}
                       className="px-4 py-3 bg-transparent border border-white/5 hover:border-white/10 hover:bg-white/5 rounded-lg text-left transition-colors flex items-center justify-between group"
                     >
                       <div>
                         <div className="text-xs font-semibold text-white/80">{item.cmd}</div>
                         <div className="text-[10px] text-white/40">{item.sub}</div>
                       </div>
                       <ChevronRight size={14} className="text-white/20 group-hover:translate-x-0.5 transition-transform" />
                     </motion.button>
                   ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <AnimatePresence>
                  {currentChat.messages.map((m, i) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      key={i}
                      onMouseDown={() => startLongPress(i, m.content)}
                      onMouseUp={endLongPress}
                      onMouseLeave={endLongPress}
                      onTouchStart={() => startLongPress(i, m.content)}
                      onTouchEnd={endLongPress}
                      className={cn(
                        "flex flex-col gap-1.5 relative",
                        m.role === 'user' ? "items-end" : "items-start"
                      )}
                    >
                      {menuMessageIndex === i && (
                        <div className="absolute top-full right-0 mt-2 z-50 bg-[#1A1A1A] border border-white/10 rounded-lg p-2 shadow-2xl flex flex-col gap-1 min-w-[100px]">
                          {m.role === 'user' && (
                            <button 
                              onClick={() => { setEditingMessageIndex(i); setMenuMessageIndex(null); }}
                              className="text-xs text-white/80 hover:text-white px-2 py-1 hover:bg-white/5 rounded text-left"
                            >
                              Edit
                            </button>
                          )}
                          <button 
                            onClick={() => setMenuMessageIndex(null)}
                            className="text-xs text-white/50 hover:text-white px-2 py-1 hover:bg-white/5 rounded text-left"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 text-[9px] text-white/30 uppercase tracking-widest px-1">
                        <div className="flex items-center gap-2">
                          {m.role === 'assistant' ? null : null}
                        </div>
                      </div>
                      <motion.div 
                        layout="position"
                        className={cn(
                          "text-sm leading-relaxed max-w-[85%]",
                          m.role === 'assistant' 
                            ? "text-white/80 prose prose-invert max-w-none w-full custom-md" 
                            : "bg-[#1A1A1A] text-white/90 px-4 py-2.5 rounded-xl border border-white/5"
                        )}
                      >
                        {editingMessageIndex === i ? (
                          <div className="w-[400px] max-w-full bg-[#1A1A1A] border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
                            <textarea
                              value={editInputValue}
                              onChange={(e) => setEditInputValue(e.target.value)}
                              className="w-full bg-transparent border-none outline-none text-sm text-white/90 placeholder:text-white/40 focus:ring-0 resize-none min-h-[100px] font-sans"
                              placeholder="Edit your prompt..."
                            />
                            <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
                              <button 
                                onClick={() => setEditingMessageIndex(null)} 
                                className="px-3 py-1.5 rounded-full text-[11px] font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleEditSave(i)} 
                                className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-white text-black hover:bg-white/90 transition-colors"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          m.role === 'assistant' ? (
                            <div className="custom-md">
                              <ReactMarkdown
                                components={{
                                  code: CodeBlock
                                }}
                              >
                                {m.content}
                              </ReactMarkdown>
                            </div>
                          ) : m.content
                        )}
                      </motion.div>
                      <div className="flex items-center gap-3 mt-1.5 px-1">
                        {m.role === 'assistant' && (
                          <button 
                            onClick={() => handleRegenerate(i)} 
                            className="text-white/30 hover:text-white transition-colors"
                            title="Regenerate"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div 
                      key="loading-indicator"
                      initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)", transition: { duration: 0.4, ease: "easeOut" } }}
                      className="flex flex-col gap-1.5 items-start mt-2"
                    >
                      <LoadingBreadcrumb />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Input Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <AnimatePresence>
              {attachedFiles.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  className="mb-4 flex flex-wrap gap-3 overflow-hidden p-1"
                >
                  {attachedFiles.map((file, idx) => (
                    <motion.div 
                      key={file.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group relative flex items-center gap-3 pl-3 pr-2 py-2 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[16px] shadow-sm hover:shadow-md hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300"
                    >
                      <div className="w-8 h-8 rounded-[12px] bg-white/5 flex items-center justify-center text-white/40 group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-colors">
                        <FileText size={16} />
                      </div>
                      <div className="flex flex-col min-w-[80px]">
                        <span className="text-[11px] font-medium text-white/90 truncate max-w-[120px]">{file.name}</span>
                        <span className="text-[9px] text-white/30 uppercase tracking-[0.05em] font-bold mt-0.5">Context File</span>
                      </div>
                      <button 
                        onClick={() => toggleFileAttachment(file.name)} 
                        className="ml-1 p-1.5 rounded-full hover:bg-white/10 text-white/30 hover:text-white transition-all transform hover:rotate-90"
                      >
                        <X size={12} />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div 
              layout
              className="bg-[#0A0A0A]/40 backdrop-blur-[40px] border border-white/10 rounded-[28px] relative shadow-[0_8px_32px_rgba(0,0,0,0.6),_inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-300 focus-within:border-white/20 focus-within:bg-[#0A0A0A]/60 focus-within:shadow-[0_16px_48px_rgba(0,0,0,0.8),_inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-white/5"
            >
              <AnimatePresence>
                {showSuggestions && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute bottom-[calc(100%+16px)] left-0 right-0 bg-[#1A1A1A]/95 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden shadow-2xl z-50 p-2 flex flex-col gap-1 ring-1 ring-white/5"
                  >
                    {filteredSkills.map((skill, i) => (
                      <button
                        key={skill.cmd}
                        onClick={() => selectSkill(skill)}
                        onMouseEnter={() => setSelectedSuggestionIndex(i)}
                        className={cn(
                          "w-full text-left p-2.5 rounded-md flex items-center justify-between transition-all duration-200 border",
                          selectedSuggestionIndex === i ? "bg-white/10 border-white/10 pl-3" : "hover:bg-white/5 border-transparent"
                        )}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors",
                              selectedSuggestionIndex === i ? "bg-blue-500/20 text-blue-300 border-blue-500/20" : "bg-white/5 text-zinc-400 border-white/5"
                            )}>
                              {skill.cmd}
                            </span>
                            <span className="text-xs font-medium text-white/90">{skill.label}</span>
                          </div>
                          <span className="text-[10px] text-white/40 pl-1">{skill.desc}</span>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="p-2.5 flex flex-col gap-1.5">
                <div className="px-4 pt-1 pb-1">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (showSuggestions) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSelectedSuggestionIndex(prev => (prev + 1) % filteredSkills.length);
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSelectedSuggestionIndex(prev => (prev - 1 + filteredSkills.length) % filteredSkills.length);
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          selectSkill(filteredSkills[selectedSuggestionIndex]);
                        } else if (e.key === 'Escape') {
                          setShowSuggestions(false);
                        }
                        return;
                      }
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask anything..."
                    className="w-full bg-transparent border-none outline-none focus:ring-0 resize-none text-[16px] text-white/90 placeholder:text-white/40 max-h-[300px] overflow-y-auto custom-scrollbar font-sans tracking-[0px] leading-relaxed"
                    rows={1}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 300) + 'px';
                    }}
                  />
                </div>
                <div className="flex justify-between items-center px-2 pb-1">
                  <div className="flex items-center gap-2">
                    <label 
                      className={cn(
                        "p-2.5 rounded-[18px] bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/10 transition-all duration-300 cursor-pointer flex items-center justify-center shrink-0 group relative overflow-hidden",
                        attachedFiles.length > 0 && "bg-white/10 border-white/20"
                      )} 
                      title="Attach context files"
                    >
                      <Paperclip 
                        size={20} 
                        className={cn(
                          "transition-all duration-300 z-10 relative",
                          attachedFiles.length > 0 ? "text-white scale-105" : "text-white/50 group-hover:text-white"
                        )} 
                      />
                      <input 
                        type="file" 
                        multiple
                        className="hidden" 
                        onChange={async (e) => {
                          if (e.target.files) {
                            const files = Array.from(e.target.files);
                            for (const file of files) {
                              if (file.size > 1024 * 1024) {
                                 console.error(`File ${file.name} is too large. Max 1MB allowed.`);
                                 continue;
                              }
                              try {
                                const content = await file.text();
                                setAttachedFiles(prev => {
                                  if (prev.find(f => f.name === file.name)) return prev;
                                  return [...prev, { name: file.name, content }];
                                });
                              } catch (err) {
                                console.error(`Failed to read ${file.name}`, err);
                              }
                            }
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div>
                    {isLoading ? (
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={stopGeneration}
                        className="w-10 h-10 flex items-center justify-center bg-white/[0.03] rounded-full hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-300 border border-white/5 group relative overflow-hidden"
                        title="Stop generation"
                      >
                        <Square size={16} className="text-white/50 group-hover:text-red-400 fill-current transition-colors z-10 relative group-hover:scale-95" />
                        <div className="absolute inset-0 bg-gradient-to-t from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.button>
                    ) : (
                      <motion.button 
                        whileHover={input.trim() ? { scale: 1.05 } : {}}
                        whileTap={input.trim() ? { scale: 0.95 } : {}}
                        onClick={sendMessage}
                        disabled={!input.trim()}
                        className={cn(
                          "w-10 h-10 rounded-full transition-all duration-300 flex items-center justify-center border relative overflow-hidden group",
                          input.trim() 
                            ? "bg-white text-black border-transparent shadow-[0_2px_12px_rgba(255,255,255,0.2)] hover:bg-zinc-200" 
                            : "bg-white/[0.03] border-white/5 text-white/30 pointer-events-none"
                        )}
                      >
                        <ArrowUp size={20} strokeWidth={2.5} className={cn("transition-transform duration-300 z-10 relative", input.trim() ? "group-hover:-translate-y-0.5" : "")} />
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-md h1, .custom-md h2, .custom-md h3 {
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          color: white;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        .custom-md pre {
          background: #0A0A0A !important;
          margin: 0 !important;
          border: none !important;
        }
        .custom-md p {
          color: rgba(255,255,255,0.8);
          line-height: 1.7;
          margin-bottom: 1em;
        }
        .markdown-body {
          color: inherit;
        }
        .animation-delay-150 { animation-delay: 150ms; }
        .animation-delay-300 { animation-delay: 300ms; }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { ChevronDown, Search, Check, Cpu } from 'lucide-react';
import { NVIDIA_MODELS } from '../constants';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ModelSelectorProps {
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onSelectModel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const groupedModels = useMemo(() => {
    const filtered = NVIDIA_MODELS.filter(m => 
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      m.owned_by.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Group by owned_by
    return filtered.reduce((acc, model) => {
      if (!acc[model.owned_by]) acc[model.owned_by] = [];
      acc[model.owned_by].push(model);
      return acc;
    }, {} as Record<string, typeof NVIDIA_MODELS>);
  }, [searchQuery]);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#0A0A0A] border border-white/10 rounded-lg hover:bg-white/5 transition-all text-xs text-white/70 hover:text-white"
      >
        <Cpu size={14} className="text-white/40" />
        <span className="max-w-[140px] truncate">{selectedModel}</span>
        <ChevronDown size={12} className="text-white/40" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="absolute right-0 top-full mt-2 w-[400px] max-h-[500px] bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              <div className="p-3 border-b border-white/5 flex items-center gap-2">
                <Search size={14} className="text-white/40" />
                <input 
                  type="text" 
                  placeholder="Search models..."
                  className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder:text-white/30"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
                {Object.entries(groupedModels).map(([owner, models]) => (
                  <div key={owner}>
                    <div className="px-2 pb-2 text-[10px] uppercase tracking-widest text-white/30 font-bold">{owner}</div>
                    <div className="space-y-0.5">
                      {models.map(m => (
                        <button
                          key={m.id}
                          onClick={() => {
                            onSelectModel(m.id);
                            setIsOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-all",
                            selectedModel === m.id ? "bg-white/10 text-white" : "hover:bg-white/5 text-white/50"
                          )}
                        >
                          <div className="text-xs truncate">{m.id.split('/')[1] || m.id}</div>
                          {selectedModel === m.id && <Check size={12} />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

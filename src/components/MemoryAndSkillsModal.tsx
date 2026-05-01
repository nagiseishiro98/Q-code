import React, { useState, useRef } from 'react';
import { X, Brain, BookOpen, Upload, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Skill {
  id: string;
  name: string;
  content: string;
}

interface MemoryAndSkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory: string;
  setMemory: (val: string) => void;
  skills: Skill[];
  setSkills: (val: Skill[]) => void;
}

export const MemoryAndSkillsModal: React.FC<MemoryAndSkillsModalProps> = ({ 
  isOpen, 
  onClose, 
  memory,
  setMemory,
  skills,
  setSkills
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setSkills([...skills, { id: Date.now().toString(), name: file.name, content }]);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 m-auto z-50 w-full max-w-2xl h-[600px] bg-[#0F0F0F] border border-white/10 rounded-2xl shadow-2xl p-8 flex flex-col gap-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-white">
                <Brain size={20} className="text-blue-400" />
                <h2 className="text-xl font-semibold tracking-tight">Memory & Skills</h2>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-8 min-h-0">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                  <Brain size={12} /> Memory
                </label>
                <textarea
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  placeholder="What should the AI remember about you or your preferences?"
                  className="w-full h-32 bg-[#0A0A0A] border border-white/10 rounded-xl p-4 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-blue-500/50 transition-all font-sans custom-scrollbar"
                />
              </div>

              <div className="flex-1 flex flex-col gap-3 min-h-0">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-widest flex items-center gap-2">
                    <BookOpen size={12} /> Skills
                  </label>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded-full text-[11px] font-medium transition-colors"
                  >
                    <Upload size={12} /> Upload Skill (.md)
                  </button>
                  <input type="file" ref={fileInputRef} accept=".md" onChange={handleFileUpload} className="hidden" />
                </div>
                
                <div className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-xl p-2 overflow-y-auto custom-scrollbar space-y-1">
                  {skills.map(skill => (
                    <div key={skill.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
                      <span className="text-sm text-white/70 font-mono truncate">{skill.name}</span>
                      <button 
                        onClick={() => setSkills(skills.filter(s => s.id !== skill.id))}
                        className="text-white/30 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {skills.length === 0 && (
                    <div className="h-full flex items-center justify-center text-sm text-white/20 italic font-mono">
                      No skills added yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

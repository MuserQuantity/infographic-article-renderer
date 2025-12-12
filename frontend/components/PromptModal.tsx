import React, { useState } from 'react';
import { X, Copy, Check, Sparkles } from 'lucide-react';
import { SYSTEM_PROMPT } from '../constants';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SYSTEM_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] scale-100 animate-in zoom-in-95 duration-200 ring-1 ring-white/20">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-sm rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-md shadow-indigo-200">
               <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">LLM Prompt Generator</h3>
              <p className="text-slate-500 text-xs font-medium mt-0.5">
                Paste this into ChatGPT, Claude, or Gemini
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          <div className="bg-slate-900 rounded-xl p-5 relative group border border-slate-800 shadow-inner">
            <div className="absolute top-4 right-4 flex items-center gap-2">
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800 px-2 py-1 rounded">System Prompt</span>
               <button
                  onClick={handleCopy}
                  className={`p-2 rounded-lg transition-all shadow-lg flex items-center gap-2 border ${
                    copied 
                      ? 'bg-emerald-500 text-white border-emerald-400' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-xs font-bold">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
            </div>
            
            <pre className="font-mono text-xs text-indigo-100/90 whitespace-pre-wrap leading-relaxed pt-10">
              {SYSTEM_PROMPT}
            </pre>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-white rounded-b-2xl flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 font-bold text-sm transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { ArticleRenderer } from './components/ArticleRenderer';
import { PromptModal } from './components/PromptModal';
import { SAMPLE_DATA } from './constants';
import { ArticleData } from './types';
import { 
  PenTool, 
  Eye, 
  Sparkles, 
  AlertCircle,
  Code2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

export default function App() {
  const [jsonInput, setJsonInput] = useState<string>(JSON.stringify(SAMPLE_DATA, null, 2));
  const [parsedData, setParsedData] = useState<ArticleData | null>(SAMPLE_DATA);
  const [error, setError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

  // Parse JSON whenever input changes
  useEffect(() => {
    try {
      const parsed = JSON.parse(jsonInput);
      // Basic schema validation check (very simple)
      if (!parsed.sections || !Array.isArray(parsed.sections)) {
        throw new Error("Invalid schema: 'sections' array is missing.");
      }
      setParsedData(parsed);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [jsonInput]);

  return (
    <div className="min-h-screen bg-stone-950 font-sans">
      
      {/* Editor Sidebar - Always Fixed */}
      <div 
        className={`fixed left-0 top-0 h-screen w-full md:w-1/3 bg-[#1e1e1e] border-r border-stone-800 transition-transform duration-300 ease-in-out flex flex-col z-30 shadow-2xl ${
          isEditorOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header - Always visible at top */}
        <div className="p-4 h-16 border-b border-stone-800 flex items-center justify-between bg-[#1e1e1e] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Code2 className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-stone-300 text-sm tracking-wide">JSON Editor</h2>
          </div>
          <button 
            onClick={() => setIsPromptModalOpen(true)}
            className="text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-1.5 rounded-full font-bold transition-all shadow-lg hover:shadow-indigo-500/20 flex items-center gap-1.5 border border-white/5"
          >
            <Sparkles className="w-3 h-3" />
            Prompt
          </button>
        </div>

        {/* Editor Area - Scrollable independently */}
        <div className="flex-1 relative bg-[#1e1e1e] min-h-0">
          <textarea
            className="absolute inset-0 p-6 font-mono text-xs leading-relaxed resize-none focus:outline-none bg-[#1e1e1e] text-stone-400 selection:bg-indigo-500/30 overflow-auto"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            spellCheck={false}
          />
          {error && (
            <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 backdrop-blur border border-red-700 text-red-100 px-4 py-3 rounded-xl text-sm flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 z-10">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Toggle Button - Fixed positioning */}
      <button
        onClick={() => setIsEditorOpen(!isEditorOpen)}
        className={`hidden md:flex fixed top-1/2 z-50 h-16 w-5 -translate-y-1/2 items-center justify-center rounded-r-xl border-y border-r border-stone-700 bg-stone-800/90 backdrop-blur-sm text-stone-400 shadow-lg transition-all duration-300 hover:bg-indigo-600 hover:border-indigo-500 hover:text-white cursor-pointer ${
          isEditorOpen ? 'left-[33.333333%]' : 'left-0'
        }`}
        title={isEditorOpen ? "Close Sidebar" : "Open Sidebar"}
      >
        {isEditorOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {/* Mobile Toggle for Editor */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsEditorOpen(!isEditorOpen)}
          className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors"
        >
          {isEditorOpen ? <Eye className="w-6 h-6" /> : <PenTool className="w-6 h-6" />}
        </button>
      </div>

      {/* Main Preview Area - With left margin when sidebar is open */}
      <div className={`min-h-screen bg-stone-950 transition-all duration-300 ${
        isEditorOpen ? 'md:ml-[33.333333%]' : 'md:ml-0'
      }`}>
        {/* Scrollable Content Wrapper */}
        <div className="w-full min-h-screen scroll-smooth p-4 md:p-8 lg:p-12 flex flex-col items-center">
          {parsedData ? (
             <ArticleRenderer data={parsedData} />
          ) : (
            <div className="flex items-center justify-center h-full text-stone-500">
              <p>Invalid JSON Data</p>
            </div>
          )}
        </div>
      </div>

      <PromptModal 
        isOpen={isPromptModalOpen} 
        onClose={() => setIsPromptModalOpen(false)} 
      />
    </div>
  );
}
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
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row h-screen overflow-hidden">
      
      {/* Editor Sidebar */}
      <div 
        className={`${
          isEditorOpen ? 'w-full md:w-1/3' : 'w-0'
        } bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col relative z-20 shadow-2xl`}
      >
        <div className="p-4 h-16 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
              <Code2 className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-slate-800 text-sm tracking-wide">JSON Editor</h2>
          </div>
          <button 
            onClick={() => setIsPromptModalOpen(true)}
            className="text-xs bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-4 py-1.5 rounded-full font-bold transition-all shadow-sm hover:shadow-md flex items-center gap-1.5"
          >
            <Sparkles className="w-3 h-3" />
            AI Prompt
          </button>
        </div>

        <div className="flex-1 relative bg-slate-50">
          <textarea
            className="w-full h-full p-6 font-mono text-xs leading-relaxed resize-none focus:outline-none bg-slate-50 text-slate-600 selection:bg-indigo-100"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            spellCheck={false}
          />
          {error && (
            <div className="absolute bottom-4 left-4 right-4 bg-red-50/90 backdrop-blur border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
          )}
        </div>
        
        {/* Toggle Button (Mobile: hidden, Desktop: visible) */}
        <button
          onClick={() => setIsEditorOpen(!isEditorOpen)}
          className="absolute top-1/2 -right-6 hidden md:flex w-6 h-12 bg-white border border-slate-200 rounded-full items-center justify-center text-slate-400 hover:text-indigo-600 hover:scale-110 transition-all shadow-lg z-10 cursor-pointer"
        >
          {isEditorOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 h-full overflow-y-auto bg-slate-100/50 relative scroll-smooth">
        {/* Mobile Toggle for Editor */}
        <div className="md:hidden fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setIsEditorOpen(!isEditorOpen)}
            className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors"
          >
            {isEditorOpen ? <Eye className="w-6 h-6" /> : <PenTool className="w-6 h-6" />}
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="p-4 md:p-8 lg:p-12 min-h-full">
          {!isEditorOpen && (
            <button
              onClick={() => setIsEditorOpen(true)}
              className="fixed left-6 top-6 bg-white p-3 rounded-full shadow-lg border border-slate-100 hover:scale-110 transition-transform hidden md:block z-30"
              title="Open Editor"
            >
              <Code2 className="w-5 h-5 text-slate-600" />
            </button>
          )}

          {parsedData ? (
             <ArticleRenderer data={parsedData} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
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

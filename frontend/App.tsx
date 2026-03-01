import React, { useState, useEffect, useCallback } from 'react';
import { ArticleRenderer } from './components/ArticleRenderer';
import { ArticleData } from './types';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Link,
  FileText,
  FileUp,
  Sparkles,
  ArrowRight,
  X,
  Github
} from 'lucide-react';

// API base URL - 生产环境使用相对路径（通过 nginx 代理），开发环境使用环境变量
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const MANUAL_URL_PREFIX = 'https://manual.local/';

const isManualUrl = (url: string | null) => Boolean(url && url.startsWith(MANUAL_URL_PREFIX));

interface TaskResponse {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stage?: string | null;
  source_type?: 'url' | 'text' | 'dify';
  result: ArticleData | null;
  error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const getProcessingMessage = (
  stage: string | null,
  sourceType: 'url' | 'text' | 'dify' | null
) => {
  if (stage === 'crawling') return '正在爬虫抓取页面...';
  if (stage === 'parsing_document') return '正在解析文档内容...';
  if (stage === 'converting') return '正在提取关键信息并生成结构...';
  if (stage === 'processing_images') return '正在处理并上传图片资源...';
  if (stage === 'saving_result') return '正在保存任务结果...';
  if (stage === 'completed') return '处理完成，正在加载结果...';
  if (stage === 'failed') return '任务执行失败...';

  if (sourceType === 'text') return '正在转换文本内容...';
  if (sourceType === 'dify') return '正在解析文档内容...';
  return '正在爬取和转换文章...';
};

export default function App() {
  const [articleData, setArticleData] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [taskStage, setTaskStage] = useState<string | null>(null);
  const [articleUrl, setArticleUrl] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<'url' | 'text' | 'dify' | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // 输入框状态
  const [inputUrl, setInputUrl] = useState('');
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [showInput, setShowInput] = useState(true);
  const [translateToChinese, setTranslateToChinese] = useState(true);
  const [showDifyModal, setShowDifyModal] = useState(false);
  const [difyMode, setDifyMode] = useState<'file' | 'url'>('file');
  const [difyUrl, setDifyUrl] = useState('');
  const [difyFile, setDifyFile] = useState<File | null>(null);

  // 从 URL 参数获取任务 ID
  const getIdParam = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }, []);

  // 从 URL 参数获取文章链接
  const getUrlParam = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('url');
  }, []);

  // 获取是否强制刷新
  const getForceRefresh = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('refresh') === 'true';
  }, []);

  // 更新浏览器地址栏 URL（优先使用任务 ID）
  const updateBrowserUrl = useCallback((options: { articleUrl?: string | null; taskId?: string | null }) => {
    const params = new URLSearchParams();
    if (options.taskId) {
      params.set('id', options.taskId);
    } else if (options.articleUrl) {
      params.set('url', options.articleUrl);
    }
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, []);

  // 轮询任务状态
  const pollTaskStatus = useCallback(async (taskId: string) => {
    const maxAttempts = 150; // 最多轮询 150 次（5 分钟）
    const pollInterval = 2000; // 每 2 秒轮询一次

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`);

        if (!response.ok) {
          throw new Error(`Failed to get task status: ${response.statusText}`);
        }

        const task: TaskResponse = await response.json();
        setTaskStatus(task.status);
        setTaskStage(task.stage || null);

        const normalizedSourceType = task.source_type || (isManualUrl(task.url) ? 'text' : 'url');
        if (task.url && !isManualUrl(task.url)) {
          setArticleUrl(task.url);
        } else {
          setArticleUrl(null);
        }
        setSourceType(normalizedSourceType);

        if (task.status === 'completed' && task.result) {
          setArticleData(task.result);
          setLoading(false);
          setTaskStatus(null);
          setTaskStage(null);
          return;
        }

        if (task.status === 'failed') {
          throw new Error(task.error || 'Task failed');
        }

        // 等待后继续轮询
        await new Promise(resolve => setTimeout(resolve, pollInterval));

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
        setTaskStatus(null);
        setTaskStage(null);
        return;
      }
    }

    // 超时
    setError('Task timeout: processing took too long');
    setLoading(false);
    setTaskStatus(null);
    setTaskStage(null);
  }, []);

  // 创建或获取任务
  const fetchArticle = useCallback(async (url: string, forceRefresh: boolean = false, translate: boolean = true) => {
    setLoading(true);
    setError(null);
    setTaskStatus('creating');
    setTaskStage(null);
    setArticleUrl(url);
    setSourceType('url');
    setTaskId(null);
    setShareCopied(false);
    setShowInput(false);
    setInputMode('url');

    try {
      const createResponse = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, force_refresh: forceRefresh, translate_to_chinese: translate })
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create task: ${createResponse.statusText}`);
      }

      const task: TaskResponse = await createResponse.json();
      setTaskId(task.id);
      updateBrowserUrl({ taskId: task.id });

      if (task.status === 'completed' && task.result) {
        setArticleData(task.result);
        setLoading(false);
        setTaskStatus(null);
        setTaskStage(null);
        return;
      }

      if (task.status === 'failed') {
        throw new Error(task.error || 'Task failed');
      }

      await pollTaskStatus(task.id);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
      setTaskStatus(null);
      setTaskStage(null);
    }
  }, [pollTaskStatus, updateBrowserUrl]);

  // 创建任务：手动文本
  const fetchArticleFromText = useCallback(async (text: string, translate: boolean = true) => {
    setLoading(true);
    setError(null);
    setTaskStatus('creating');
    setTaskStage(null);
    setArticleUrl(null);
    setSourceType('text');
    setTaskId(null);
    setShareCopied(false);
    setShowInput(false);
    setInputMode('text');

    updateBrowserUrl({ articleUrl: null, taskId: null });

    try {
      const createResponse = await fetch(`${API_BASE_URL}/api/tasks/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, translate_to_chinese: translate })
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create task: ${createResponse.statusText}`);
      }

      const task: TaskResponse = await createResponse.json();
      setTaskId(task.id);
      updateBrowserUrl({ taskId: task.id });

      if (task.status === 'completed' && task.result) {
        setArticleData(task.result);
        setLoading(false);
        setTaskStatus(null);
        setTaskStage(null);
        return;
      }

      if (task.status === 'failed') {
        throw new Error(task.error || 'Task failed');
      }

      await pollTaskStatus(task.id);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
      setTaskStatus(null);
      setTaskStage(null);
    }
  }, [pollTaskStatus, updateBrowserUrl]);

  const fetchArticleFromDify = useCallback(async (
    payload: { file?: File | null; url?: string; translate?: boolean }
  ) => {
    setLoading(true);
    setError(null);
    setTaskStatus('creating');
    setTaskStage(null);
    setArticleUrl(payload.url || null);
    setSourceType('dify');
    setTaskId(null);
    setShareCopied(false);
    setShowInput(false);
    setShowDifyModal(false);

    updateBrowserUrl({ articleUrl: null, taskId: null });

    try {
      const formData = new FormData();
      if (payload.file) {
        formData.append('file', payload.file);
      }
      if (payload.url) {
        formData.append('url', payload.url);
      }
      formData.append('translate_to_chinese', payload.translate === false ? 'false' : 'true');

      const createResponse = await fetch(`${API_BASE_URL}/api/tasks/dify`, {
        method: 'POST',
        body: formData
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create task: ${createResponse.statusText}`);
      }

      const task: TaskResponse = await createResponse.json();
      setTaskId(task.id);
      updateBrowserUrl({ taskId: task.id });

      if (task.status === 'completed' && task.result) {
        setArticleData(task.result);
        setLoading(false);
        setTaskStatus(null);
        setTaskStage(null);
        return;
      }

      if (task.status === 'failed') {
        throw new Error(task.error || 'Task failed');
      }

      await pollTaskStatus(task.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
      setTaskStatus(null);
      setTaskStage(null);
    }
  }, [pollTaskStatus, updateBrowserUrl]);

  // 通过 ID 获取任务
  const fetchTaskById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setTaskStatus('loading');
    setTaskStage(null);
    setTaskId(id);
    setShareCopied(false);
    setShowInput(false);

    updateBrowserUrl({ taskId: id });

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${id}`);

      if (!response.ok) {
        throw new Error(`Failed to get task status: ${response.statusText}`);
      }

      const task: TaskResponse = await response.json();
      setTaskId(task.id);
      setTaskStatus(task.status);
      setTaskStage(task.stage || null);

      const normalizedSourceType = task.source_type || (isManualUrl(task.url) ? 'text' : 'url');
      if (task.url && !isManualUrl(task.url)) {
        setArticleUrl(task.url);
      } else {
        setArticleUrl(null);
      }
      if (normalizedSourceType === 'url') {
        setInputUrl(task.url || '');
        setInputMode('url');
      } else if (normalizedSourceType === 'text') {
        setInputMode('text');
      }
      setSourceType(normalizedSourceType);

      if (task.status === 'completed' && task.result) {
        setArticleData(task.result);
        setLoading(false);
        setTaskStatus(null);
        setTaskStage(null);
        return;
      }

      if (task.status === 'failed') {
        throw new Error(task.error || 'Task failed');
      }

      await pollTaskStatus(task.id);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
      setTaskStatus(null);
      setTaskStage(null);
    }
  }, [pollTaskStatus, updateBrowserUrl]);

  // 强制刷新
  const handleRefresh = () => {
    if (sourceType === 'url' && articleUrl) {
      fetchArticle(articleUrl, true, translateToChinese);
    }
    if (sourceType === 'text' && inputText.trim()) {
      fetchArticleFromText(inputText.trim(), translateToChinese);
    }
  };

  const handleOpenDifyModal = () => {
    setDifyMode('file');
    setDifyUrl('');
    setDifyFile(null);
    setShowDifyModal(true);
  };

  const handleDifySubmit = () => {
    if (difyMode === 'file' && difyFile) {
      fetchArticleFromDify({ file: difyFile, translate: translateToChinese });
    }
    if (difyMode === 'url' && difyUrl.trim()) {
      fetchArticleFromDify({ url: difyUrl.trim(), translate: translateToChinese });
    }
  };

  const handleCopyShareLink = async () => {
    if (!taskId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${taskId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy share link', err);
    }
  };

  // 提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMode === 'url' && inputUrl.trim()) {
      fetchArticle(inputUrl.trim(), false, translateToChinese);
    }
    if (inputMode === 'text' && inputText.trim()) {
      fetchArticleFromText(inputText.trim(), translateToChinese);
    }
  };

  // 返回输入界面
  const handleBack = () => {
    setShowInput(true);
    setArticleData(null);
    setError(null);
    setArticleUrl(null);
    setSourceType(null);
    setTaskId(null);
    setTaskStage(null);
    setShareCopied(false);
    setShowDifyModal(false);
    // 清除地址栏参数
    updateBrowserUrl({ articleUrl: null, taskId: null });
  };

  // 分析文章中的链接
  const handleAnalyzeLink = (url: string) => {
    setInputMode('url');
    setInputUrl(url);
    fetchArticle(url, false, translateToChinese);
  };

  // 初始化：检查 URL 参数
  useEffect(() => {
    const id = getIdParam();
    const url = getUrlParam();
    const forceRefresh = getForceRefresh();

    if (id) {
      fetchTaskById(id);
      return;
    }

    if (url) {
      setInputMode('url');
      setInputUrl(url);
      fetchArticle(url, forceRefresh);
    }
  }, [getIdParam, getUrlParam, getForceRefresh, fetchTaskById, fetchArticle]);

  // 输入界面
  if (showInput && !loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl">
          {/* Logo/Title */}
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-5 sm:mb-6 shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-3">Infographic Renderer</h1>
            <p className="text-sm sm:text-base text-stone-400">输入文章链接或粘贴文本，生成精美信息图</p>
          </div>

          {/* 输入表单 */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-3 gap-2 p-1 bg-stone-900 border border-stone-800 rounded-lg sm:rounded-xl">
              <button
                type="button"
                onClick={() => setInputMode('url')}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  inputMode === 'url'
                    ? 'bg-stone-800 text-white shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                链接
              </button>
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  inputMode === 'text'
                    ? 'bg-stone-800 text-white shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                手动文本
              </button>
              <button
                type="button"
                onClick={handleOpenDifyModal}
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all text-stone-400 hover:text-stone-200 flex items-center justify-center gap-2"
              >
                <FileUp className="w-4 h-4" />
                文档
              </button>
            </div>

            {inputMode === 'url' ? (
              <div className="relative">
                <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-stone-500">
                  <Link className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg sm:rounded-xl pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 text-sm sm:text-base text-white placeholder-stone-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  required
                />
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-3 sm:left-4 top-3 sm:top-4 text-stone-500">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="粘贴你的文章内容或草稿..."
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg sm:rounded-xl pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 text-sm sm:text-base text-white placeholder-stone-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all min-h-[150px] sm:min-h-[180px] resize-y"
                  required
                />
              </div>
            )}

            {/* 翻译选项 */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={translateToChinese}
                  onChange={(e) => setTranslateToChinese(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 bg-stone-800 border border-stone-700 rounded-md peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                  {translateToChinese && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-stone-400 group-hover:text-stone-300 transition-colors text-sm">
                翻译为中文
              </span>
            </label>

            <button
              type="submit"
              disabled={inputMode === 'url' ? !inputUrl.trim() : !inputText.trim()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-stone-700 disabled:to-stone-700 disabled:cursor-not-allowed text-white font-semibold py-3 sm:py-4 px-5 sm:px-6 rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:shadow-none text-sm sm:text-base"
            >
              生成信息图
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </form>

          {/* 使用说明 */}
          <div className="mt-8 sm:mt-10 text-center text-stone-600 text-xs sm:text-sm space-y-2 sm:space-y-3">
            <p>支持文章链接和手动文本输入，系统会自动转换为信息图格式</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 gap-y-2">
              <a
                href="/articles"
                className="inline-flex items-center justify-center gap-1.5 sm:gap-2 text-stone-500 hover:text-stone-300 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                浏览文章库
              </a>
              <a
                href="https://github.com/MuserQuantity/infographic-article-renderer"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 sm:gap-2 text-stone-500 hover:text-stone-300 transition-colors"
              >
                <Github className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                获取Chrome插件
              </a>
            </div>
          </div>
        </div>

        {showDifyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
                <div>
                  <h3 className="text-lg font-semibold text-white">文档解析</h3>
                  <p className="text-xs text-stone-400 mt-1">通过 Dify 工作流提取文本</p>
                </div>
                <button
                  onClick={() => setShowDifyModal(false)}
                  className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-2 p-1 bg-stone-950 border border-stone-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDifyMode('file')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      difyMode === 'file'
                        ? 'bg-stone-800 text-white shadow'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    上传文件
                  </button>
                  <button
                    type="button"
                    onClick={() => setDifyMode('url')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      difyMode === 'url'
                        ? 'bg-stone-800 text-white shadow'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    填写URL
                  </button>
                </div>

                {difyMode === 'file' ? (
                  <div className="space-y-3">
                    <label className="flex items-center justify-between px-4 py-3 bg-stone-950 border border-stone-800 rounded-lg cursor-pointer hover:border-stone-700 transition-colors">
                      <span className="text-sm text-stone-300">选择本地文档</span>
                      <span className="text-xs text-stone-500">DOCX / PDF / TXT</span>
                      <input
                        type="file"
                        accept=".doc,.docx,.pdf,.txt,.md"
                        className="hidden"
                        onChange={(event) => setDifyFile(event.target.files?.[0] || null)}
                      />
                    </label>
                    {difyFile && (
                      <p className="text-xs text-stone-400">已选择: {difyFile.name}</p>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
                      <Link className="w-4 h-4" />
                    </div>
                    <input
                      type="url"
                      value={difyUrl}
                      onChange={(event) => setDifyUrl(event.target.value)}
                      placeholder="https://example.com/file.docx"
                      className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-9 pr-3 py-3 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>将使用当前翻译设置</span>
                  <span>支持常见文档格式</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowDifyModal(false)}
                  className="px-4 py-2 text-sm text-stone-300 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleDifySubmit}
                  disabled={difyMode === 'file' ? !difyFile : !difyUrl.trim()}
                  className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-stone-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  开始解析
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 加载状态
  if (loading) {
    return (
      <div className="fixed inset-0 bg-stone-950 flex items-center justify-center z-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-stone-400 text-lg mb-2">
            {taskStatus === 'loading' && '获取任务中...'}
            {taskStatus === 'creating' && '创建任务中...'}
            {taskStatus === 'pending' && '等待处理...'}
            {taskStatus === 'processing' && (
              getProcessingMessage(taskStage, sourceType)
            )}
          </p>
          {sourceType === 'url' && articleUrl && (
            <p className="text-stone-600 text-sm flex items-center justify-center gap-2 max-w-md mx-auto truncate px-4">
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{articleUrl}</span>
            </p>
          )}
          {!articleUrl && taskId && (
            <p className="text-stone-600 text-sm flex items-center justify-center gap-2 max-w-md mx-auto truncate px-4">
              <Link className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">任务ID: {taskId}</span>
            </p>
          )}
          <button
            onClick={handleBack}
            className="mt-8 text-stone-500 hover:text-stone-300 text-sm transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <div className="bg-red-900/30 border border-red-800 rounded-2xl p-8 max-w-lg w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400 mb-2">处理失败</h2>
          <p className="text-red-300/80 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 bg-stone-700 hover:bg-stone-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              返回
            </button>
            {(sourceType === 'url' || sourceType === 'text') && (
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重试
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 正常渲染
  return (
    <div className="min-h-screen bg-stone-950 font-sans">
      {/* 顶部工具栏 */}
      <div className="fixed top-2 sm:top-4 right-2 sm:right-4 z-50 flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={handleBack}
          className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl shadow-lg transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
        >
          新文章
        </button>
        <a
          href="/articles"
          className="bg-stone-800 hover:bg-stone-700 text-stone-300 p-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl shadow-lg transition-colors text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 sm:gap-2"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">文章库</span>
        </a>
        {taskId && (
          <button
            onClick={handleCopyShareLink}
            className="bg-stone-800 hover:bg-stone-700 text-stone-300 p-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl shadow-lg transition-colors text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 sm:gap-2"
            title="复制可访问链接"
          >
            <Link className="w-4 h-4" />
            <span className="hidden sm:inline">{shareCopied ? '已复制' : '分享链接'}</span>
          </button>
        )}
        {articleUrl && (
          <a
            href={articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-stone-800 hover:bg-stone-700 text-stone-300 p-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl shadow-lg transition-colors text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 sm:gap-2"
            title="查看原文"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">原文</span>
          </a>
        )}
        {sourceType === 'url' && articleUrl && (
          <button
            onClick={handleRefresh}
            className="bg-stone-800 hover:bg-stone-700 text-stone-300 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg transition-colors"
            title="强制刷新"
          >
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
        {sourceType === 'text' && (
          <button
            onClick={handleRefresh}
            className="bg-stone-800 hover:bg-stone-700 text-stone-300 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg transition-colors"
            title="重新生成"
          >
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
      </div>

      {/* 主内容区 */}
      <div className="w-full max-w-full min-h-screen scroll-smooth p-2 sm:p-4 md:p-8 lg:p-12 flex flex-col items-center pt-12 sm:pt-4 overflow-x-hidden box-border">
        {articleData ? (
          <ArticleRenderer data={articleData} onAnalyzeLink={handleAnalyzeLink} />
        ) : (
          <div className="flex items-center justify-center h-screen text-stone-500">
            <p className="text-sm sm:text-base">没有数据</p>
          </div>
        )}
      </div>
    </div>
  );
}

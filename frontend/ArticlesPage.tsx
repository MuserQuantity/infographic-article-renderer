import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Sparkles,
  User
} from 'lucide-react';
import { ArticleListResponse, ArticleListItem } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const MANUAL_URL_PREFIX = 'https://manual.local/';
const PER_PAGE = 9;

const getPageFromLocation = () => {
  const params = new URLSearchParams(window.location.search);
  const pageParam = Number(params.get('page'));
  return Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
};

const isManualUrl = (url: string) => Boolean(url && url.startsWith(MANUAL_URL_PREFIX));

const formatDate = (value?: string | null) => {
  if (!value) return '未知日期';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getSourceLabel = (url: string) => {
  if (isManualUrl(url)) return '手动文本';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '外部来源';
  }
};

const getSourceDetail = (url: string) => {
  if (isManualUrl(url)) return '来自手动粘贴内容';
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${hostname}${path}`;
  } catch {
    return url;
  }
};

const buildPageItems = (current: number, total: number) => {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const items: Array<number | 'dots'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push('dots');
  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }
  if (end < total - 1) items.push('dots');
  items.push(total);
  return items;
};

export default function ArticlesPage() {
  const [page, setPage] = useState(getPageFromLocation);
  const [refreshTick, setRefreshTick] = useState(0);
  const [data, setData] = useState<ArticleListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncPageToUrl = (nextPage: number) => {
    const params = new URLSearchParams(window.location.search);
    if (nextPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(nextPage));
    }
    const nextUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.pushState({}, '', nextUrl);
  };

  useEffect(() => {
    const handlePopState = () => {
      setPage(getPageFromLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchArticles = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/tasks?page=${page}&per_page=${PER_PAGE}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error('无法获取文章列表，请稍后重试');
        }
        const payload: ArticleListResponse = await response.json();
        if (payload.total_pages > 0 && page > payload.total_pages) {
          setPage(payload.total_pages);
          syncPageToUrl(payload.total_pages);
          return;
        }
        setData(payload);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : '未知错误');
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
    return () => controller.abort();
  }, [page, refreshTick]);

  const totalPages = data?.total_pages || 1;
  const totalItems = data?.total_items || 0;
  const items = data?.items || [];

  const pageItems = useMemo(() => buildPageItems(page, totalPages), [page, totalPages]);

  const handlePageChange = (nextPage: number) => {
    if (nextPage === page || nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
    syncPageToUrl(nextPage);
  };

  const renderMeta = (item: ArticleListItem) => {
    const meta = item.meta;
    if (!meta?.author && !meta?.date && !meta?.readTime) {
      return (
        <span className="inline-flex items-center gap-2 text-[var(--muted)]">
          <BookOpen className="h-3.5 w-3.5 text-[color:var(--accent-strong)] opacity-70" />
          暂无作者与阅读信息
        </span>
      );
    }
    return (
      <>
        {meta?.author && (
          <span className="inline-flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-[color:var(--accent-strong)] opacity-70" />
            {meta.author}
          </span>
        )}
        {meta?.date && (
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-[color:var(--accent-strong)] opacity-70" />
            {meta.date}
          </span>
        )}
        {meta?.readTime && (
          <span className="inline-flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-[color:var(--accent-strong)] opacity-70" />
            {meta.readTime}
          </span>
        )}
      </>
    );
  };

  return (
    <div className="articles-theme min-h-screen bg-[var(--paper)] text-[color:var(--ink)] font-[var(--font-sans)] relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,_var(--accent)_0%,_transparent_70%)] opacity-20 blur-3xl"></div>
      <div className="pointer-events-none absolute top-16 right-[-10%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_var(--accent-strong)_0%,_transparent_70%)] opacity-20 blur-3xl"></div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(255,255,255,0.7)_0%,_transparent_55%),radial-gradient(circle_at_80%_0%,_rgba(255,247,237,0.8)_0%,_transparent_45%)]"></div>

      <main className="relative z-10">
        <header className="w-full max-w-6xl mx-auto px-6 pt-14 pb-10 articles-fade">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-3 text-xs tracking-[0.4em] uppercase text-[var(--muted)]">
                <span className="h-px w-10 bg-[var(--accent)]/50"></span>
                Archive
              </div>
              <h1 className="mt-5 text-4xl md:text-5xl font-[var(--font-serif)] text-[color:var(--ink)]">
                文章库
              </h1>
              <p className="mt-4 max-w-xl text-base md:text-lg text-[var(--muted)]">
                最新生成的信息图文章会在这里按时间顺序排列，点击卡片即可进入完整阅读体验。
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <a
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-amber-500/30"
                >
                  <Sparkles className="h-4 w-4" />
                  生成新文章
                </a>
                <button
                  onClick={() => setRefreshTick((prev) => prev + 1)}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--paper-deep)] bg-white/70 px-5 py-2.5 text-sm font-semibold text-[color:var(--ink)] shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <RefreshCw className="h-4 w-4 text-[color:var(--accent-strong)]" />
                  刷新列表
                </button>
              </div>
            </div>
            <div className="w-full max-w-sm rounded-3xl border border-[color:var(--paper-deep)] bg-[var(--card)] p-6 shadow-xl shadow-amber-500/10 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Overview</div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-2xl font-semibold text-[color:var(--ink)]">{totalItems}</div>
                  <div className="text-[var(--muted)]">累计文章</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-[color:var(--ink)]">{page}/{totalPages}</div>
                  <div className="text-[var(--muted)]">当前页码</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="w-full max-w-6xl mx-auto px-6 pb-16">
          {loading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="animate-pulse rounded-3xl border border-[color:var(--paper-deep)] bg-white/70 p-6 shadow-sm"
                >
                  <div className="h-4 w-24 rounded-full bg-stone-200"></div>
                  <div className="mt-6 h-6 w-4/5 rounded bg-stone-200"></div>
                  <div className="mt-3 h-4 w-full rounded bg-stone-200"></div>
                  <div className="mt-2 h-4 w-5/6 rounded bg-stone-200"></div>
                  <div className="mt-6 h-4 w-2/3 rounded bg-stone-200"></div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-3xl border border-dashed border-amber-300 bg-white/80 p-10 text-center">
              <p className="text-lg font-semibold text-[color:var(--ink)]">加载失败</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
              <button
                onClick={() => setRefreshTick((prev) => prev + 1)}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/20"
              >
                <RefreshCw className="h-4 w-4" />
                重试
              </button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-[color:var(--paper-deep)] bg-white/80 p-10 text-center">
              <p className="text-lg font-semibold text-[color:var(--ink)]">还没有生成任何文章</p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                从一篇文章链接或一段文本开始，系统将自动生成信息图页面。
              </p>
              <a
                href="/"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/20"
              >
                <Sparkles className="h-4 w-4" />
                生成第一篇
              </a>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {items.map((item, index) => {
                  const rank = (page - 1) * PER_PAGE + index + 1;
                  const title = item.title?.trim()
                    || (isManualUrl(item.url) ? '手动文本文章' : getSourceLabel(item.url));
                  const subtitle = item.subtitle?.trim()
                    || '点击查看完整的信息图内容与结构化摘要。';
                  const sourceLabel = getSourceLabel(item.url);
                  const sourceDetail = getSourceDetail(item.url);
                  const createdLabel = formatDate(item.created_at || item.updated_at);

                  return (
                    <a
                      key={item.id}
                      href={`/?id=${item.id}`}
                      className="group relative overflow-hidden rounded-3xl border border-[color:var(--paper-deep)] bg-[var(--card)] p-6 shadow-lg shadow-amber-500/5 transition-transform duration-300 hover:-translate-y-1 hover:shadow-amber-500/20 articles-rise"
                      style={{ animationDelay: `${index * 90}ms` }}
                    >
                      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,_var(--accent)_0%,_transparent_70%)] opacity-20"></div>
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        <span>#{rank.toString().padStart(2, '0')}</span>
                        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[10px] tracking-[0.15em] text-[color:var(--accent-strong)]">
                          {sourceLabel}
                        </span>
                      </div>
                      <h3 className="mt-6 text-xl font-[var(--font-serif)] text-[color:var(--ink)] transition-colors duration-200 group-hover:text-[color:var(--accent-strong)]">
                        {title}
                      </h3>
                      <p className="mt-3 text-sm text-[var(--muted)] [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] overflow-hidden">
                        {subtitle}
                      </p>
                      <p className="mt-4 text-xs text-[var(--muted)] opacity-80 [display:-webkit-box] [-webkit-line-clamp:1] [-webkit-box-orient:vertical] overflow-hidden">
                        {sourceDetail}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                        {renderMeta(item)}
                      </div>
                      <div className="mt-6 flex items-center justify-between text-xs text-[var(--muted)]">
                        <span className="inline-flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-[color:var(--accent-strong)] opacity-70" />
                          {createdLabel}
                        </span>
                        <span className="inline-flex items-center gap-2 text-[color:var(--accent-strong)] font-semibold">
                          浏览
                          <ArrowUpRight className="h-4 w-4" />
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--paper-deep)] bg-white/80 px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition-opacity disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </button>
                  {pageItems.map((item, index) => (
                    item === 'dots' ? (
                      <span key={`dots-${index}`} className="px-2 text-sm text-[var(--muted)]">
                        ···
                      </span>
                    ) : (
                      <button
                        key={`page-${item}`}
                        onClick={() => handlePageChange(item)}
                        className={`h-10 w-10 rounded-full text-sm font-semibold transition-all ${
                          item === page
                            ? 'bg-[var(--accent)] text-white shadow-lg shadow-amber-500/30'
                            : 'border border-[color:var(--paper-deep)] bg-white/70 text-[color:var(--ink)] hover:-translate-y-0.5'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  ))}
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--paper-deep)] bg-white/80 px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition-opacity disabled:opacity-40"
                  >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

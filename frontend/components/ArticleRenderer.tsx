import React from 'react';
import {
  ArticleData,
  ContentBlock,
  ArticleSection,
  GridItem,
  StatItem,
  ComparisonRow,
  AccordionItem,
  StepItem,
  ProgressItem,
  DefinitionItem,
  RatingItem
} from '../types';
import { InfographicCard } from './InfographicCard';
import {
  stepsToInfographicSyntax,
  timelineToInfographicSyntax,
  progressToInfographicSyntax,
  prosConsToInfographicSyntax,
  statsToInfographicSyntax,
  comparisonToInfographicSyntax,
} from '../utils/infographicMapper';
import {
  Quote,
  Info,
  CheckCircle2,
  LayoutGrid,
  AlertTriangle,
  List,
  Calendar,
  User,
  Clock,
  TrendingUp,
  TrendingDown,
  Tag,
  Sparkles,
  Image as ImageIcon,
  ArrowRight,
  Code,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Highlighter,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Play,
  Minus,
  ExternalLink,
  Star,
  StarHalf
} from 'lucide-react';

// Whether to use @antv/infographic for rendering (controlled via VITE_USE_ANTV_INFOGRAPHIC in .env)
const USE_ANTV_INFOGRAPHIC = import.meta.env.VITE_USE_ANTV_INFOGRAPHIC === 'true';

// --- Sub-Components ---

const parseInlineMarkdown = (
  str: string,
  onAnalyzeLink?: (url: string) => void
): React.ReactNode[] => {
  if (typeof str !== 'string') {
    return [String(str ?? '')];
  }

  const combinedRegex = /(\*\*.*?\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = combinedRegex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      result.push(str.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];
    if (fullMatch.startsWith('**') && fullMatch.endsWith('**')) {
      result.push(
        <strong key={keyIndex++} className="font-bold text-stone-900 bg-amber-100/60 px-1 rounded-sm">
          {fullMatch.slice(2, -2)}
        </strong>
      );
    } else if (match[2] && match[3]) {
      result.push(
        <SmartLink key={keyIndex++} href={match[3]} onAnalyze={onAnalyzeLink}>
          {match[2]}
        </SmartLink>
      );
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < str.length) {
    result.push(str.slice(lastIndex));
  }

  return result.length > 0 ? result : [str];
};

// 智能链接组件 - 悬停显示菜单
const SmartLink = ({ href, children, onAnalyze }: { href: string; children: React.ReactNode; onAnalyze?: (url: string) => void }) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowMenu(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setShowMenu(false), 150);
  };

  const handleAnalyze = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAnalyze) {
      onAnalyze(href);
    } else {
      // 默认行为：在当前页面导航到分析该 URL
      window.location.href = `/?url=${encodeURIComponent(href)}`;
    }
    setShowMenu(false);
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(href, '_blank', 'noopener,noreferrer');
    setShowMenu(false);
  };

  return (
    <span
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <a
        href={href}
        onClick={(e) => e.preventDefault()}
        className="text-amber-700 hover:text-amber-900 underline decoration-amber-300 hover:decoration-amber-500 underline-offset-2 transition-colors cursor-pointer"
      >
        {children}
      </a>
      {showMenu && (
        <div
          className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-stone-200 py-1 min-w-[160px] animate-in fade-in slide-in-from-top-1 duration-150"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <button
            onClick={handleOpen}
            className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-stone-400" />
            打开链接
          </button>
          <button
            onClick={handleAnalyze}
            className="w-full px-4 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            分析此文章
          </button>
        </div>
      )}
    </span>
  );
};

const ParagraphBlock = ({ text, onAnalyzeLink }: { text: string; onAnalyzeLink?: (url: string) => void }) => (
  <p className="text-stone-800 leading-7 sm:leading-8 md:leading-9 mb-6 sm:mb-8 text-sm sm:text-base md:text-lg tracking-normal text-left font-normal antialiased">
    {parseInlineMarkdown(text, onAnalyzeLink)}
  </p>
);

const QuoteBlock = ({ text, author, onAnalyzeLink }: { text: string; author?: string; onAnalyzeLink?: (url: string) => void }) => {
  // 清理 markdown 引用语法 (> 开头的行)
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  const cleanText = safeText
    .split('\n')
    .map(line => line.replace(/^>\s*/, ''))
    .join('\n')
    .trim();

  return (
    <div className="relative mb-8 sm:mb-12 mt-6 sm:mt-10">
      <div className="border-l-2 border-amber-500 pl-4 sm:pl-8 py-2 pr-2 sm:pr-4">
        <p className="text-lg sm:text-xl md:text-3xl font-serif text-stone-900 mb-4 sm:mb-6 leading-relaxed italic">
          "{parseInlineMarkdown(cleanText, onAnalyzeLink)}"
        </p>
      {author && (
        <div className="flex items-center justify-end gap-3 sm:gap-4">
          <div className="h-px w-8 sm:w-12 bg-stone-300"></div>
          <footer className="text-xs sm:text-sm font-bold text-stone-500 uppercase tracking-wider sm:tracking-widest">
            {author}
          </footer>
        </div>
      )}
    </div>
  </div>
  );
};

const CalloutBlock = ({
  text,
  title,
  variant = 'info',
  onAnalyzeLink,
}: {
  text: string;
  title?: string;
  variant?: 'info' | 'warning' | 'success';
  onAnalyzeLink?: (url: string) => void;
}) => {
  const styles = {
    info: 'bg-sky-50 border-sky-100 text-sky-900',
    warning: 'bg-amber-50 border-amber-100 text-amber-900',
    success: 'bg-emerald-50 border-emerald-100 text-emerald-900'
  };

  const Icon = variant === 'warning' ? AlertTriangle : Info;
  const iconColors = {
    info: 'text-sky-600',
    warning: 'text-amber-600',
    success: 'text-emerald-600'
  };

  return (
    <div className={`flex items-start gap-3 sm:gap-4 p-4 sm:p-6 rounded-lg sm:rounded-xl border ${styles[variant]} mb-6 sm:mb-8`}>
      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5 ${iconColors[variant]}`} />
      <div className="flex-1">
        {title && <h4 className="font-bold mb-1 text-sm sm:text-base md:text-lg">{title}</h4>}
        <p className="opacity-90 leading-relaxed text-xs sm:text-sm md:text-base">{parseInlineMarkdown(text, onAnalyzeLink)}</p>
      </div>
    </div>
  );
};

// 从可能是对象的列表项中提取文本
const extractItemText = (item: unknown): string => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    // 尝试常见的文本字段名
    const obj = item as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.title === 'string') return obj.title;
    if (typeof obj.value === 'string') return obj.value;
    if (typeof obj.label === 'string') return obj.label;
    if (typeof obj.name === 'string') return obj.name;
    // 如果有 description，也尝试
    if (typeof obj.description === 'string') return obj.description;
  }
  return String(item ?? '');
};

const ListBlock = ({
  items,
  title,
  style = 'bullet',
  onAnalyzeLink,
}: {
  items: string[];
  title?: string;
  style?: 'bullet' | 'check' | 'number';
  onAnalyzeLink?: (url: string) => void;
}) => (
  <div className="mb-8 sm:mb-10 pl-1 sm:pl-2">
    {title && <h4 className="font-bold text-stone-900 mb-4 sm:mb-6 text-sm sm:text-base md:text-lg flex items-center gap-2 border-b border-stone-100 pb-2">
      {title}
    </h4>}
    <ul className="space-y-3 sm:space-y-4">
      {items.map((item, idx) => {
        const safeItem = extractItemText(item);
        const content = parseInlineMarkdown(safeItem, onAnalyzeLink);

        return (
          <li key={idx} className="flex gap-3 sm:gap-4 items-start group">
            <span className="flex-shrink-0 mt-1.5">
              {style === 'check' && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />}
              {style === 'bullet' && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-stone-400 mt-2" />}
              {style === 'number' && (
                <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-stone-100 text-stone-600 text-[10px] sm:text-xs font-bold font-mono">
                  {idx + 1}
                </span>
              )}
            </span>
            <span className="text-stone-700 text-sm sm:text-base md:text-lg leading-relaxed border-b border-stone-100 pb-3 sm:pb-4 w-full group-last:border-0">{content}</span>
          </li>
        );
      })}
    </ul>
  </div>
);

const GridBlock = ({ items, columns }: { items: GridItem[]; columns: 1 | 2 | 3 }) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 sm:gap-6 mb-10 sm:mb-12`}>
      {items.map((item, idx) => (
        <div key={idx} className="bg-white p-5 sm:p-8 rounded-lg sm:rounded-xl transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-stone-200/40 group border border-stone-100 hover:border-stone-200 hover:-translate-y-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-white text-stone-800 flex items-center justify-center mb-4 sm:mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
             <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h4 className="font-bold text-stone-800 mb-2 sm:mb-3 text-base sm:text-lg md:text-xl">
            {item.title}
          </h4>
          <p className="text-stone-600 leading-relaxed text-xs sm:text-sm md:text-base">{item.description}</p>
        </div>
      ))}
    </div>
  );
};

const ImageBlock = ({ src, alt, caption }: { src: string; alt: string; caption?: string }) => {
  const [aspect, setAspect] = React.useState('16 / 9');

  const ratioPresets = [
    { label: '1 / 1', value: 1 },
    { label: '4 / 3', value: 4 / 3 },
    { label: '3 / 2', value: 3 / 2 },
    { label: '16 / 9', value: 16 / 9 },
    { label: '21 / 9', value: 21 / 9 },
    { label: '3 / 4', value: 3 / 4 },
    { label: '2 / 3', value: 2 / 3 },
    { label: '9 / 16', value: 9 / 16 },
  ];

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    const nearest = ratioPresets.reduce((best, preset) => {
      const diff = Math.abs(preset.value - ratio);
      return diff < best.diff ? { diff, label: preset.label } : best;
    }, { diff: Number.MAX_VALUE, label: '16 / 9' });
    setAspect(nearest.label);
  };

  return (
    <figure className="mb-14 group">
      <div
        className="overflow-hidden rounded-xl bg-stone-100 shadow-lg relative"
        style={{ aspectRatio: aspect }}
      >
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          className="w-full h-full object-cover block transition-transform duration-700 group-hover:scale-[1.02]"
        />
      </div>
      {caption && (
        <figcaption className="mt-4 text-center">
           <span className="inline-flex items-center gap-2 text-sm text-stone-500 font-medium px-4 py-1 rounded-full bg-stone-50">
            <ImageIcon className="w-3.5 h-3.5" />
            {caption}
           </span>
        </figcaption>
      )}
    </figure>
  );
};

const LegacyStatsBlock = ({ items, columns = 3 }: { items: StatItem[]; columns?: 1 | 2 | 3 }) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
  };

  const trendIcon = (trend?: StatItem['trend']) => {
    if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5" />;
    if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5" />;
    return <div className="w-3.5 h-0.5 bg-current rounded-full" />;
  };

  const trendConfig = (trend?: StatItem['trend']) => {
    if (trend === 'up') return { color: 'text-emerald-700', bg: 'bg-emerald-50' };
    if (trend === 'down') return { color: 'text-rose-700', bg: 'bg-rose-50' };
    return { color: 'text-stone-500', bg: 'bg-stone-100' };
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 mb-12`}>
      {items.map((item, idx) => {
        const style = trendConfig(item.trend);
        return (
          <div key={idx} className="p-6 bg-white rounded-xl border border-stone-200 hover:border-stone-300 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">{item.label}</div>
            <div className="flex items-end gap-3 mb-4">
              <span className="text-3xl md:text-4xl font-serif font-bold text-stone-900 tracking-tight leading-none">{item.value}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold min-w-[60px] justify-center ${style.bg} ${style.color}`}>
                {trendIcon(item.trend)}
                {item.trend === 'up' && '增长'}
                {item.trend === 'down' && '下降'}
                {item.trend === 'flat' && '持平'}
              </div>
              {item.note && <span className="text-xs text-stone-400">{item.note}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const StatsBlock = ({ items, columns = 3 }: { items: StatItem[]; columns?: 1 | 2 | 3 }) => {
  const [useLegacy, setUseLegacy] = React.useState(!USE_ANTV_INFOGRAPHIC);

  if (useLegacy) {
    return <LegacyStatsBlock items={items} columns={columns} />;
  }

  try {
    const syntax = statsToInfographicSyntax(items, columns);
    return (
      <div className="mb-12">
        <InfographicCard
          syntax={syntax}
          height={Math.max(300, Math.ceil(items.length / (columns || 3)) * 150)}
          onError={() => setUseLegacy(true)}
        />
      </div>
    );
  } catch {
    return <LegacyStatsBlock items={items} columns={columns} />;
  }
};

const TagsBlock = ({ items }: { items: string[] }) => (
  <div className="flex flex-wrap gap-2.5 mb-12 pt-4 border-t border-stone-100">
    {items.map((tag, idx) => (
      <span
        key={idx}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 text-xs font-medium hover:from-indigo-100 hover:to-purple-100 transition-all cursor-default border border-indigo-100/50"
      >
        <Tag className="w-3 h-3" />
        {tag}
      </span>
    ))}
  </div>
);

const LegacyTimelineBlock = ({ items }: { items: { title: string; time?: string; desc?: string }[] }) => (
  <div className="relative pl-2 mb-12">
    <div className="absolute left-[15px] top-2 bottom-2 w-px bg-stone-200" />
    <div className="space-y-10">
      {items.map((item, idx) => (
        <div key={idx} className="relative pl-10 group">
          <div className="absolute left-[11px] top-2 w-[9px] h-[9px] rounded-full bg-white border-2 border-stone-400 group-hover:border-stone-900 group-hover:scale-125 transition-all z-10" />
          <div className="">
             {item.time && (
                <span className="text-xs font-bold text-stone-400 mb-1 block font-mono">
                  {item.time}
                </span>
              )}
              <h4 className="font-bold text-stone-800 text-base md:text-lg mb-2">{item.title}</h4>
            {item.desc && <p className="text-stone-600 leading-relaxed text-xs md:text-sm max-w-xl">{item.desc}</p>}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const TimelineBlock = ({ items }: { items: { title: string; time?: string; desc?: string }[] }) => {
  const [useLegacy, setUseLegacy] = React.useState(!USE_ANTV_INFOGRAPHIC);

  if (useLegacy) {
    return <LegacyTimelineBlock items={items} />;
  }

  try {
    const syntax = timelineToInfographicSyntax(items);
    return (
      <div className="mb-12">
        <InfographicCard
          syntax={syntax}
          height={Math.max(350, items.length * 80)}
          onError={() => setUseLegacy(true)}
        />
      </div>
    );
  } catch {
    return <LegacyTimelineBlock items={items} />;
  }
};

const comparisonLabelHeaders = new Set([
  '指标',
  '对比项',
  '对比维度',
  '维度',
  '项目',
  '参数',
  'metric',
  'metrics',
  'feature',
  'features',
  'criteria',
  'criterion',
  'item',
  'items',
  'parameter',
  'parameters',
  'dimension',
  'dimensions',
]);

const normalizeComparison = (columns: string[], rows: ComparisonRow[]) => {
  const maxValues = rows.reduce((max, row) => Math.max(max, row.values.length), 0);
  let labelHeader = '对比项';
  let effectiveColumns = columns;

  const firstColumn = columns[0]?.trim() ?? '';
  const hasLabelHeader =
    columns.length === maxValues + 1 &&
    comparisonLabelHeaders.has(firstColumn.toLowerCase());

  if (hasLabelHeader) {
    labelHeader = firstColumn || labelHeader;
    effectiveColumns = columns.slice(1);
  }

  const columnCount = Math.max(effectiveColumns.length, maxValues);
  const normalizedColumns = effectiveColumns.slice(0, columnCount);
  while (normalizedColumns.length < columnCount) {
    normalizedColumns.push('');
  }
  const normalizedRows = rows.map((row) => {
    const values = row.values.slice(0, columnCount);
    while (values.length < columnCount) {
      values.push('');
    }
    return { ...row, values };
  });
  return { columnCount, columns: normalizedColumns, rows: normalizedRows, labelHeader };
};

const LegacyComparisonBlock = ({ columns, rows }: { columns: string[]; rows: ComparisonRow[] }) => {
  const { columnCount, columns: safeColumns, rows: safeRows, labelHeader } = normalizeComparison(columns, rows);

  return (
    <div className="mb-10 sm:mb-14 rounded-lg sm:rounded-xl border border-stone-200 bg-white">
      <div className="overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: `120px repeat(${columnCount}, minmax(100px, 1fr))`, minWidth: Math.max((columnCount + 1) * 110, 350) }}>
          <div className="bg-stone-50 px-3 py-3 sm:px-6 sm:py-4 text-[10px] sm:text-xs font-bold uppercase text-stone-400 flex items-center whitespace-nowrap">
            {labelHeader}
          </div>
          {safeColumns.map((col, idx) => (
            <div key={idx} className={`bg-stone-50 px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm font-bold text-stone-800 border-l border-stone-200 text-center ${idx === 0 ? 'bg-stone-100/50' : ''}`}>
              {col}
            </div>
          ))}
          {safeRows.map((row, idx) => (
            <React.Fragment key={idx}>
              <div className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm font-bold text-stone-700 border-t border-stone-100 bg-white whitespace-nowrap">
                {row.label}
              </div>
              {row.values.map((val, vIdx) => (
                <div
                  key={vIdx}
                  className={`px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-stone-600 border-t border-l border-stone-100 leading-relaxed text-center ${vIdx === 0 ? 'bg-stone-50/30 font-medium text-stone-900' : ''}`}
                >
                  {val}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

const ComparisonBlock = ({ columns, rows }: { columns: string[]; rows: ComparisonRow[] }) => {
  const [useLegacy, setUseLegacy] = React.useState(!USE_ANTV_INFOGRAPHIC);

  if (useLegacy) {
    return <LegacyComparisonBlock columns={columns} rows={rows} />;
  }

  try {
    const syntax = comparisonToInfographicSyntax(columns, rows);
    return (
      <div className="mb-12">
        <InfographicCard
          syntax={syntax}
          height={Math.max(400, (rows.length + 1) * 60)}
          onError={() => setUseLegacy(true)}
        />
      </div>
    );
  } catch {
    return <LegacyComparisonBlock columns={columns} rows={rows} />;
  }
};

const normalizeTable = (headers: string[], rows: string[][]) => {
  const maxCells = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const columnCount = Math.max(headers.length, maxCells);
  const normalizedHeaders = headers.slice(0, columnCount);
  while (normalizedHeaders.length < columnCount) {
    normalizedHeaders.push('');
  }
  const normalizedRows = rows.map((row) => {
    const cells = row.slice(0, columnCount);
    while (cells.length < columnCount) {
      cells.push('');
    }
    return cells;
  });
  return { columnCount, headers: normalizedHeaders, rows: normalizedRows };
};

const TableBlock = ({ headers, rows }: { headers: string[]; rows: string[][] }) => {
  const { columnCount, headers: safeHeaders, rows: safeRows } = normalizeTable(headers, rows);

  return (
    <div className="mb-10 sm:mb-14 rounded-lg sm:rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-stone-200" style={{ minWidth: Math.max(columnCount * 120, 400) }}>
          <thead>
            <tr className="bg-stone-50">
              {safeHeaders.map((h, idx) => (
                <th key={idx} className="px-3 py-3 sm:px-6 sm:py-4 text-left text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider first:pl-4 sm:first:pl-8 whitespace-nowrap min-w-[100px] sm:min-w-[120px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {safeRows.map((row, idx) => (
              <tr key={idx} className="bg-white hover:bg-stone-50/50 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-stone-700 leading-relaxed first:pl-4 sm:first:pl-8 first:font-medium min-w-[100px] sm:min-w-[120px]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CodeBlock = ({ code, language, title }: { code: string; language?: string; title?: string }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-8 sm:mb-10 rounded-lg sm:rounded-xl overflow-hidden border border-stone-200 bg-stone-900 shadow-lg">
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 bg-stone-800 border-b border-stone-700">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Code className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400 flex-shrink-0" />
          {title && <span className="text-xs sm:text-sm font-medium text-stone-300 truncate">{title}</span>}
          {language && (
            <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-mono bg-stone-700 text-stone-300 flex-shrink-0">
              {language}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded text-[10px] sm:text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-700 transition-colors flex-shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="hidden xs:inline text-emerald-400">已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden xs:inline">复制</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 sm:p-4 overflow-x-auto">
        <pre className="text-xs sm:text-sm font-mono text-stone-100 leading-relaxed whitespace-pre-wrap break-words">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

// --- New Block Components ---

const AccordionBlock = ({ items }: { items: AccordionItem[] }) => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <div className="mb-12 space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="border border-stone-200 rounded-xl overflow-hidden bg-white">
          <button
            onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-stone-50 transition-colors"
          >
            <span className="font-bold text-stone-800 text-base md:text-lg pr-4">{item.question}</span>
            {openIndex === idx ? (
              <ChevronUp className="w-5 h-5 text-stone-400 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-stone-400 flex-shrink-0" />
            )}
          </button>
          {openIndex === idx && (
            <div className="px-6 pb-5 pt-1 border-t border-stone-100">
              <p className="text-stone-600 leading-relaxed text-sm md:text-base">{item.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const LegacyStepsBlock = ({ items }: { items: StepItem[] }) => (
  <div className="mb-12 space-y-6">
    {items.map((item, idx) => (
      <div key={idx} className="flex gap-5 group">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 group-hover:bg-amber-500 transition-colors">
            {item.step}
          </div>
          {idx < items.length - 1 && (
            <div className="w-0.5 flex-1 bg-stone-200 mt-3 group-hover:bg-amber-200 transition-colors" />
          )}
        </div>
        <div className="pb-8 flex-1">
          <h4 className="font-bold text-stone-800 text-base md:text-lg mb-2">{item.title}</h4>
          <p className="text-stone-600 leading-relaxed text-sm md:text-base">{item.description}</p>
        </div>
      </div>
    ))}
  </div>
);

const StepsBlock = ({ items }: { items: StepItem[] }) => {
  const [useLegacy, setUseLegacy] = React.useState(!USE_ANTV_INFOGRAPHIC);

  if (useLegacy) {
    return <LegacyStepsBlock items={items} />;
  }

  try {
    const syntax = stepsToInfographicSyntax(items);
    return (
      <div className="mb-12">
        <InfographicCard
          syntax={syntax}
          height={Math.max(300, items.length * 100)}
          onError={() => setUseLegacy(true)}
        />
      </div>
    );
  } catch {
    return <LegacyStepsBlock items={items} />;
  }
};

const LegacyProgressBlock = ({ items }: { items: ProgressItem[] }) => (
  <div className="mb-12 space-y-5">
    {items.map((item, idx) => {
      const max = item.max || 100;
      const percentage = Math.min((item.value / max) * 100, 100);
      return (
        <div key={idx} className="bg-white p-5 rounded-xl border border-stone-200">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-stone-700 text-sm md:text-base">{item.label}</span>
            <span className="text-sm font-mono font-bold text-stone-500">{item.value}/{max}</span>
          </div>
          <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      );
    })}
  </div>
);

const ProgressBlock = ({ items }: { items: ProgressItem[] }) => {
  const [useLegacy, setUseLegacy] = React.useState(!USE_ANTV_INFOGRAPHIC);

  if (useLegacy) {
    return <LegacyProgressBlock items={items} />;
  }

  try {
    const syntax = progressToInfographicSyntax(items);
    return (
      <div className="mb-12">
        <InfographicCard
          syntax={syntax}
          height={Math.max(300, Math.ceil(items.length / 3) * 200)}
          onError={() => setUseLegacy(true)}
        />
      </div>
    );
  } catch {
    return <LegacyProgressBlock items={items} />;
  }
};

const HighlightBlock = ({
  text,
  color = 'yellow',
  onAnalyzeLink,
}: {
  text: string;
  color?: 'yellow' | 'blue' | 'green' | 'pink';
  onAnalyzeLink?: (url: string) => void;
}) => {
  const colorStyles = {
    yellow: 'bg-amber-50 border-amber-200 text-amber-900',
    blue: 'bg-sky-50 border-sky-200 text-sky-900',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    pink: 'bg-pink-50 border-pink-200 text-pink-900',
  };

  const iconColors = {
    yellow: 'text-amber-500',
    blue: 'text-sky-500',
    green: 'text-emerald-500',
    pink: 'text-pink-500',
  };

  return (
    <div className={`mb-10 px-6 py-5 rounded-xl border-2 border-dashed ${colorStyles[color]} flex items-start gap-4`}>
      <Highlighter className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColors[color]}`} />
      <p className="text-base md:text-lg font-medium leading-relaxed">{parseInlineMarkdown(text, onAnalyzeLink)}</p>
    </div>
  );
};

const DefinitionBlock = ({ items, onAnalyzeLink }: { items: DefinitionItem[]; onAnalyzeLink?: (url: string) => void }) => (
  <div className="mb-12 space-y-4">
    {items.map((item, idx) => (
      <div key={idx} className="bg-stone-50 rounded-xl p-6 border-l-4 border-stone-400">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-stone-500" />
          <dt className="font-bold text-stone-900 text-base md:text-lg">{parseInlineMarkdown(item.term, onAnalyzeLink)}</dt>
        </div>
        <dd className="text-stone-600 leading-relaxed text-sm md:text-base pl-6">{parseInlineMarkdown(item.definition, onAnalyzeLink)}</dd>
      </div>
    ))}
  </div>
);

const LegacyProsConsBlock = ({
  pros,
  cons,
  onAnalyzeLink,
}: {
  pros: string[];
  cons: string[];
  onAnalyzeLink?: (url: string) => void;
}) => (
  <div className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-emerald-200">
        <ThumbsUp className="w-5 h-5 text-emerald-600" />
        <h4 className="font-bold text-emerald-800 text-base md:text-lg">优点</h4>
      </div>
      <ul className="space-y-3">
        {pros.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 flex-shrink-0" />
            <span className="text-emerald-800 text-sm md:text-base leading-relaxed">{parseInlineMarkdown(item, onAnalyzeLink)}</span>
          </li>
        ))}
      </ul>
    </div>
    <div className="bg-rose-50 rounded-xl p-6 border border-rose-100">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-rose-200">
        <ThumbsDown className="w-5 h-5 text-rose-600" />
        <h4 className="font-bold text-rose-800 text-base md:text-lg">缺点</h4>
      </div>
      <ul className="space-y-3">
        {cons.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <Minus className="w-4 h-4 text-rose-500 mt-1 flex-shrink-0" />
            <span className="text-rose-800 text-sm md:text-base leading-relaxed">{parseInlineMarkdown(item, onAnalyzeLink)}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const ProsConsBlock = ({
  pros,
  cons,
  onAnalyzeLink,
}: {
  pros: string[];
  cons: string[];
  onAnalyzeLink?: (url: string) => void;
}) => {
  const [useLegacy, setUseLegacy] = React.useState(!USE_ANTV_INFOGRAPHIC);

  if (useLegacy) {
    return <LegacyProsConsBlock pros={pros} cons={cons} onAnalyzeLink={onAnalyzeLink} />;
  }

  try {
    const syntax = prosConsToInfographicSyntax(pros, cons);
    return (
      <div className="mb-12">
        <InfographicCard
          syntax={syntax}
          height={Math.max(400, Math.max(pros.length, cons.length) * 60)}
          onError={() => setUseLegacy(true)}
        />
      </div>
    );
  } catch {
    return <LegacyProsConsBlock pros={pros} cons={cons} onAnalyzeLink={onAnalyzeLink} />;
  }
};

const VideoBlock = ({ src, platform = 'custom', title }: { src: string; platform?: 'youtube' | 'bilibili' | 'custom'; title?: string }) => {
  const getEmbedUrl = () => {
    if (platform === 'youtube') {
      const videoId = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1] || src;
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (platform === 'bilibili') {
      const bvId = src.match(/BV[\w]+/)?.[0] || src;
      return `https://player.bilibili.com/player.html?bvid=${bvId}&high_quality=1`;
    }
    return src;
  };

  return (
    <div className="mb-12">
      {title && (
        <div className="flex items-center gap-2 mb-4">
          <Play className="w-5 h-5 text-stone-500" />
          <h4 className="font-bold text-stone-800 text-base md:text-lg">{title}</h4>
        </div>
      )}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-stone-900 shadow-lg">
        <iframe
          src={getEmbedUrl()}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
};

const DividerBlock = ({ dividerStyle = 'simple', text }: { dividerStyle?: 'simple' | 'decorated' | 'text'; text?: string }) => {
  if (dividerStyle === 'text' && text) {
    return (
      <div className="my-12 flex items-center gap-4">
        <div className="flex-1 h-px bg-stone-200" />
        <span className="text-sm font-medium text-stone-400 uppercase tracking-widest">{text}</span>
        <div className="flex-1 h-px bg-stone-200" />
      </div>
    );
  }

  if (dividerStyle === 'decorated') {
    return (
      <div className="my-12 flex items-center justify-center gap-3">
        <div className="w-16 h-px bg-stone-300" />
        <div className="w-2 h-2 rounded-full bg-amber-400" />
        <div className="w-2 h-2 rounded-full bg-stone-400" />
        <div className="w-2 h-2 rounded-full bg-amber-400" />
        <div className="w-16 h-px bg-stone-300" />
      </div>
    );
  }

  return <hr className="my-12 border-t border-stone-200" />;
};

const LinkCardBlock = ({ url, title, description, image }: { url: string; title: string; description?: string; image?: string }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="mb-10 block group"
  >
    <div className="flex flex-col md:flex-row gap-4 p-5 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-lg transition-all">
      {image && (
        <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
          <img src={image} alt={title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-stone-800 text-base md:text-lg group-hover:text-amber-600 transition-colors truncate">
            {title}
          </h4>
          <ExternalLink className="w-4 h-4 text-stone-400 flex-shrink-0 mt-1" />
        </div>
        {description && (
          <p className="text-stone-600 text-sm mt-2 line-clamp-2 leading-relaxed">{description}</p>
        )}
        <p className="text-stone-400 text-xs mt-3 truncate">{url}</p>
      </div>
    </div>
  </a>
);

const RatingBlock = ({ items }: { items: RatingItem[] }) => {
  const renderStars = (score: number, maxScore: number = 5) => {
    const stars = [];
    const fullStars = Math.floor(score);
    const hasHalfStar = score % 1 >= 0.5;
    const emptyStars = Math.floor(maxScore) - fullStars - (hasHalfStar ? 1 : 0);

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`full-${i}`} className="w-5 h-5 text-amber-400 fill-amber-400" />);
    }
    if (hasHalfStar) {
      stars.push(<StarHalf key="half" className="w-5 h-5 text-amber-400 fill-amber-400" />);
    }
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-5 h-5 text-stone-200" />);
    }
    return stars;
  };

  return (
    <div className="mb-12 space-y-4">
      {items.map((item, idx) => {
        const maxScore = item.maxScore || 5;
        return (
          <div key={idx} className="flex items-center justify-between p-5 bg-white rounded-xl border border-stone-200 hover:border-stone-300 transition-all">
            <span className="font-bold text-stone-700 text-sm md:text-base">{item.label}</span>
            <div className="flex items-center gap-3">
              <div className="flex gap-0.5">{renderStars(item.score, maxScore)}</div>
              <span className="text-sm font-mono font-bold text-stone-500 min-w-[50px] text-right">
                {item.score}/{maxScore}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const InfographicBlock = ({ syntax, template, theme, height }: { syntax: string; template?: string; theme?: string; height?: number }) => {
  if (!USE_ANTV_INFOGRAPHIC) return null;
  return (
    <div className="mb-12">
      <InfographicCard syntax={syntax} height={height || 400} />
    </div>
  );
};

// --- Main Block Switcher ---

const BlockRenderer: React.FC<{ block: ContentBlock; onAnalyzeLink?: (url: string) => void }> = ({ block, onAnalyzeLink }) => {
  switch (block.type) {
    case 'paragraph':
      return <ParagraphBlock text={block.text} onAnalyzeLink={onAnalyzeLink} />;
    case 'quote':
      return <QuoteBlock text={block.text} author={block.author} onAnalyzeLink={onAnalyzeLink} />;
    case 'callout':
      return <CalloutBlock text={block.text} title={block.title} variant={block.variant} onAnalyzeLink={onAnalyzeLink} />;
    case 'list':
      return <ListBlock items={block.items} title={block.title} style={block.style} onAnalyzeLink={onAnalyzeLink} />;
    case 'grid':
      return <GridBlock items={block.items} columns={block.columns} />;
    case 'image':
      return <ImageBlock src={block.src} alt={block.alt} caption={block.caption} />;
    case 'stat':
      return <StatsBlock items={block.items} columns={block.columns} />;
    case 'tags':
      return <TagsBlock items={block.items} />;
    case 'timeline':
      return <TimelineBlock items={block.items} />;
    case 'comparison':
      return <ComparisonBlock columns={block.columns} rows={block.rows} />;
    case 'table':
      return <TableBlock headers={block.headers} rows={block.rows} />;
    case 'code':
      return <CodeBlock code={block.code} language={block.language} title={block.title} />;
    case 'accordion':
      return <AccordionBlock items={block.items} />;
    case 'steps':
      return <StepsBlock items={block.items} />;
    case 'progress':
      return <ProgressBlock items={block.items} />;
    case 'highlight':
      return <HighlightBlock text={block.text} color={block.color} onAnalyzeLink={onAnalyzeLink} />;
    case 'definition':
      return <DefinitionBlock items={block.items} onAnalyzeLink={onAnalyzeLink} />;
    case 'proscons':
      return <ProsConsBlock pros={block.pros} cons={block.cons} onAnalyzeLink={onAnalyzeLink} />;
    case 'video':
      return <VideoBlock src={block.src} platform={block.platform} title={block.title} />;
    case 'divider':
      return <DividerBlock dividerStyle={block.dividerStyle} text={block.text} />;
    case 'linkcard':
      return <LinkCardBlock url={block.url} title={block.title} description={block.description} image={block.image} />;
    case 'rating':
      return <RatingBlock items={block.items} />;
    case 'infographic':
      return <InfographicBlock syntax={block.syntax} template={block.template} theme={block.theme} height={block.height} />;
    default:
      return null;
  }
};

// --- Section Renderer ---

const SectionRenderer: React.FC<{ section: ArticleSection; index: number; onAnalyzeLink?: (url: string) => void }> = ({ section, index, onAnalyzeLink }) => (
  <div className="mb-12 sm:mb-16 md:mb-20 last:mb-0 relative">
    <div className="flex items-baseline gap-3 sm:gap-4 md:gap-8 mb-8 sm:mb-12 md:mb-16 border-b border-stone-200 pb-4 sm:pb-6">
      <div className="text-3xl sm:text-4xl md:text-5xl font-serif font-black text-stone-100 select-none">
        {String(index + 1).padStart(2, '0')}
      </div>
      <h2 className="text-xl sm:text-2xl md:text-4xl font-serif font-bold text-stone-900 tracking-tight flex-1">
        {section.title}
      </h2>
    </div>
    <div className="max-w-3xl mx-auto">
      {section.content.map((block, idx) => (
        <BlockRenderer key={idx} block={block} onAnalyzeLink={onAnalyzeLink} />
      ))}
    </div>
  </div>
);

// --- Root Component ---

interface ArticleRendererProps {
  data: ArticleData;
  onAnalyzeLink?: (url: string) => void;
}

export const ArticleRenderer: React.FC<ArticleRendererProps> = ({ data, onAnalyzeLink }) => {
  return (
    <div className="max-w-4xl mx-auto bg-white min-h-screen shadow-xl shadow-stone-900/5 overflow-hidden rounded-none md:rounded-3xl ring-1 ring-stone-900/5 transition-all">
      {/* Header */}
      <header className="bg-stone-950 text-white px-4 py-10 sm:px-8 sm:py-16 md:px-24 md:py-32 relative overflow-hidden">
        {/* Subtle noise texture or pattern could go here */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-stone-800 via-stone-900 to-black opacity-80" />

        <div className="relative z-10 max-w-3xl mx-auto text-center md:text-left">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium text-stone-400 uppercase tracking-wider sm:tracking-widest mb-6 sm:mb-8 justify-center md:justify-start">
            {data.meta?.date && (
              <span className="flex items-center gap-1.5 sm:gap-2">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {data.meta.date}
              </span>
            )}
            {data.meta?.readTime && (
              <span className="flex items-center gap-1.5 sm:gap-2">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {data.meta.readTime}
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-7xl font-serif font-black mb-6 sm:mb-8 md:mb-10 leading-tight text-stone-50">
            {data.title}
          </h1>

          {data.subtitle && (
            <p className="text-base sm:text-lg md:text-2xl text-stone-300 font-light leading-relaxed max-w-2xl border-l-2 border-amber-500 pl-3 sm:pl-4 md:pl-6 mx-auto md:mx-0 text-left">
              {data.subtitle}
            </p>
          )}

          {data.meta?.author && (
            <div className="mt-10 sm:mt-16 flex items-center justify-center md:justify-start gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-stone-700 flex items-center justify-center text-stone-300">
                  <User className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] sm:text-xs text-stone-400 uppercase tracking-wider sm:tracking-widest font-bold">Written by</p>
                <p className="text-sm sm:text-base font-bold text-white">{data.meta.author}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content Body */}
      <main className="px-4 py-8 sm:px-6 sm:py-12 md:px-20 md:py-24 bg-white">
        {data.sections.map((section, idx) => (
          <SectionRenderer key={idx} section={section} index={idx} onAnalyzeLink={onAnalyzeLink} />
        ))}

        <footer className="mt-20 sm:mt-32 pt-8 sm:pt-12 border-t border-stone-100 text-center">
          <p className="text-stone-400 text-xs sm:text-sm font-medium flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
            Generated by Infographic Renderer • {new Date().getFullYear()}
          </p>
        </footer>
      </main>
    </div>
  );
};

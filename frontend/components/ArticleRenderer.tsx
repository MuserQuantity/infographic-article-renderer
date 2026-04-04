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
        <strong key={keyIndex++} className="font-bold text-inherit">
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
        className="text-[#bf3627] hover:text-[#8a2019] underline decoration-[#bf3627]/40 hover:decoration-[#bf3627] underline-offset-2 transition-colors cursor-pointer"
      >
        {children}
      </a>
      {showMenu && (
        <div
          className="absolute left-0 top-full mt-1 z-50 bg-[#110f0b] rounded-none shadow-2xl border border-[#2a2520] py-1 min-w-[160px]"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <button
            onClick={handleOpen}
            className="w-full px-4 py-2.5 text-left text-xs text-[#c8c0b4] hover:bg-[#1e1a16] hover:text-white flex items-center gap-2 transition-colors font-mono uppercase tracking-wider"
          >
            <ExternalLink className="w-3 h-3" />
            打开链接
          </button>
          <button
            onClick={handleAnalyze}
            className="w-full px-4 py-2.5 text-left text-xs text-[#bf3627] hover:bg-[#1e1a16] flex items-center gap-2 transition-colors font-mono uppercase tracking-wider"
          >
            <Sparkles className="w-3 h-3" />
            分析此文章
          </button>
        </div>
      )}
    </span>
  );
};

const ParagraphBlock = ({ text, onAnalyzeLink }: { text: string; onAnalyzeLink?: (url: string) => void }) => (
  <p className="text-[#2d2820] leading-[1.85] mb-5 sm:mb-7 text-sm sm:text-base md:text-[1.05rem] tracking-[0.01em] text-left font-normal">
    {parseInlineMarkdown(text, onAnalyzeLink)}
  </p>
);

const QuoteBlock = ({ text, author, onAnalyzeLink }: { text: string; author?: string; onAnalyzeLink?: (url: string) => void }) => {
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  const cleanText = safeText
    .split('\n')
    .map(line => line.replace(/^>\s*/, ''))
    .join('\n')
    .trim();

  return (
    <div className="relative mb-10 sm:mb-14 mt-6 sm:mt-10">
      <div className="border-t-2 border-b border-[#110f0b] pt-5 sm:pt-7 pb-6 sm:pb-8">
        <p className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-[#110f0b] mb-5 sm:mb-7 leading-snug italic">
          {parseInlineMarkdown(cleanText, onAnalyzeLink)}
        </p>
        {author && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-[2px] bg-[#bf3627]" />
            <footer className="text-[10px] sm:text-xs font-bold text-[#bf3627] uppercase tracking-[0.15em] font-mono">
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
  const bandColors = {
    info: 'bg-[#1a3a5c]',
    warning: 'bg-[#bf3627]',
    success: 'bg-[#1e4d2b]',
  };
  const labels = {
    info: 'INFO',
    warning: 'WARN',
    success: 'NOTE',
  };
  const borderColors = {
    info: 'border-[#1a3a5c]',
    warning: 'border-[#bf3627]',
    success: 'border-[#1e4d2b]',
  };

  return (
    <div className={`flex mb-6 sm:mb-8 border-2 ${borderColors[variant]} overflow-hidden`}>
      <div className={`w-9 sm:w-10 flex-shrink-0 flex items-center justify-center ${bandColors[variant]}`}>
        <span
          className="text-white text-[8px] font-black tracking-[0.12em] font-mono select-none"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
        >
          {labels[variant]}
        </span>
      </div>
      <div className="flex-1 px-4 sm:px-6 py-4 sm:py-5 bg-white">
        {title && (
          <h4 className="font-black text-[#110f0b] mb-1.5 text-xs sm:text-sm uppercase tracking-[0.08em]">
            {title}
          </h4>
        )}
        <p className="text-[#2d2820] leading-relaxed text-xs sm:text-sm md:text-base">
          {parseInlineMarkdown(text, onAnalyzeLink)}
        </p>
      </div>
    </div>
  );
};

// 从可能是对象的列表项中提取文本
const extractItemText = (item: unknown): string => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.content === 'string') return obj.content;
    if (typeof obj.title === 'string') return obj.title;
    if (typeof obj.value === 'string') return obj.value;
    if (typeof obj.label === 'string') return obj.label;
    if (typeof obj.name === 'string') return obj.name;
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
  <div className="mb-8 sm:mb-10">
    {title && (
      <h4 className="font-black text-[#110f0b] mb-4 sm:mb-5 text-sm sm:text-base tracking-tight flex items-center gap-2 pb-2 border-b-2 border-[#110f0b]">
        {title}
      </h4>
    )}
    <ul className="space-y-2 sm:space-y-3">
      {items.map((item, idx) => {
        const safeItem = extractItemText(item);
        const content = parseInlineMarkdown(safeItem, onAnalyzeLink);

        return (
          <li key={idx} className="flex gap-3 sm:gap-4 items-start group border-b border-[#e8e2d6] pb-2 sm:pb-3 last:border-0">
            <span className="flex-shrink-0 mt-1.5">
              {style === 'check' && (
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-[#1e4d2b] flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 bg-[#1e4d2b]" />
                </div>
              )}
              {style === 'bullet' && (
                <div className="w-2 h-2 bg-[#bf3627] mt-[3px] flex-shrink-0" />
              )}
              {style === 'number' && (
                <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-[#110f0b] text-white text-[9px] sm:text-[10px] font-black font-mono flex-shrink-0">
                  {String(idx + 1).padStart(2, '0')}
                </span>
              )}
            </span>
            <span className="text-[#2d2820] text-sm sm:text-base leading-relaxed">{content}</span>
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
    <div className={`grid ${gridCols[columns]} mb-10 sm:mb-12 border-t-2 border-l-2 border-[#110f0b]`}>
      {items.map((item, idx) => {
        const isLoneLastItem = idx === items.length - 1 && items.length % columns === 1;
        return (
        <div
          key={idx}
          className={`bg-[#faf8f3] p-5 sm:p-7 relative group hover:bg-white transition-colors duration-200 overflow-hidden border-r-2 border-b-2 border-[#110f0b] ${isLoneLastItem ? 'md:col-span-full' : ''}`}
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#bf3627]" />
          <div
            className="text-[4rem] sm:text-[5rem] font-black leading-none text-[#110f0b]/[0.05] mb-3 select-none font-mono tracking-tighter"
            style={{ fontFamily: "'Bebas Neue', 'DM Mono', monospace" }}
          >
            {String(idx + 1).padStart(2, '0')}
          </div>
          <h4 className="font-black text-[#110f0b] mb-2 sm:mb-3 text-base sm:text-lg tracking-tight leading-tight">
            {item.title}
          </h4>
          <p className="text-[#7a7069] leading-relaxed text-xs sm:text-sm">{item.description}</p>
        </div>
        );
      })}
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
    <figure className="mb-12 group">
      <div
        className="overflow-hidden bg-[#1a1612] relative border-2 border-[#110f0b]"
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
        <figcaption className="mt-3 flex items-center gap-2 text-xs text-[#7a7069] font-mono">
          <div className="w-4 h-px bg-[#bf3627]" />
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

const LegacyStatsBlock = ({ items, columns = 3 }: { items: StatItem[]; columns?: 1 | 2 | 3 }) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
  };

  return (
    <div className={`grid ${gridCols[columns]} mb-10 sm:mb-12 border-t-2 border-[#110f0b]`}>
      {items.map((item, idx) => (
        <div
          key={idx}
          className="py-6 sm:py-8 px-4 sm:px-6 border-b-2 sm:border-b-0 sm:border-r-2 border-[#e8e2d6] last:border-0"
        >
          <div
            className="text-[10px] font-black text-[#7a7069] uppercase tracking-[0.15em] mb-3 font-mono"
          >
            {item.label}
          </div>
          <div
            className="text-5xl sm:text-6xl md:text-7xl font-black text-[#110f0b] leading-none tracking-tighter mb-3"
            style={{ fontFamily: "'Bebas Neue', 'DM Mono', monospace" }}
          >
            {item.value}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold font-mono">
            {item.trend === 'up' && (
              <span className="flex items-center gap-1 text-[#1e4d2b]">
                <TrendingUp className="w-3 h-3" /> 增长
              </span>
            )}
            {item.trend === 'down' && (
              <span className="flex items-center gap-1 text-[#bf3627]">
                <TrendingDown className="w-3 h-3" /> 下降
              </span>
            )}
            {item.trend === 'flat' && (
              <span className="text-[#7a7069]">— 持平</span>
            )}
            {item.note && (
              <span className="text-[#7a7069] font-normal">· {item.note}</span>
            )}
          </div>
        </div>
      ))}
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
  <div className="flex flex-wrap gap-2 mb-10 pt-5 border-t-2 border-[#110f0b]">
    {items.map((tag, idx) => (
      <span
        key={idx}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[#110f0b] text-[10px] sm:text-xs font-bold font-mono uppercase tracking-wider border border-[#110f0b] hover:bg-[#bf3627] hover:text-white hover:border-[#bf3627] transition-all cursor-default"
      >
        <Tag className="w-2.5 h-2.5" />
        {tag}
      </span>
    ))}
  </div>
);

const LegacyTimelineBlock = ({ items }: { items: { title: string; time?: string; desc?: string }[] }) => (
  <div className="relative mb-12">
    <div className="absolute left-[11px] top-2 bottom-2 w-px bg-[#e8e2d6]" />
    <div className="space-y-8 sm:space-y-10">
      {items.map((item, idx) => (
        <div key={idx} className="relative pl-9 sm:pl-10 group">
          <div className="absolute left-[5px] top-1.5 w-[13px] h-[13px] bg-[#bf3627] group-hover:scale-125 transition-all z-10" />
          <div>
            {item.time && (
              <span className="text-[10px] font-black text-[#bf3627] mb-1 block font-mono uppercase tracking-[0.12em]">
                {item.time}
              </span>
            )}
            <h4 className="font-black text-[#110f0b] text-base md:text-lg mb-1.5 tracking-tight">{item.title}</h4>
            {item.desc && (
              <p className="text-[#7a7069] leading-relaxed text-xs sm:text-sm max-w-xl">{item.desc}</p>
            )}
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
  '指标', '对比项', '对比维度', '维度', '项目', '参数',
  'metric', 'metrics', 'feature', 'features', 'criteria', 'criterion',
  'item', 'items', 'parameter', 'parameters', 'dimension', 'dimensions',
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
  while (normalizedColumns.length < columnCount) normalizedColumns.push('');
  const normalizedRows = rows.map((row) => {
    const values = row.values.slice(0, columnCount);
    while (values.length < columnCount) values.push('');
    return { ...row, values };
  });
  return { columnCount, columns: normalizedColumns, rows: normalizedRows, labelHeader };
};

const LegacyComparisonBlock = ({ columns, rows }: { columns: string[]; rows: ComparisonRow[] }) => {
  const { columnCount, columns: safeColumns, rows: safeRows, labelHeader } = normalizeComparison(columns, rows);

  return (
    <div className="mb-10 sm:mb-14 border-2 border-[#110f0b] bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: `minmax(140px, 1.2fr) repeat(${columnCount}, minmax(140px, 1fr))`, minWidth: Math.max((columnCount + 1) * 140, 420) }}>
          <div className="bg-[#110f0b] px-3 py-3 sm:px-6 sm:py-4 text-[10px] font-black uppercase text-[#7a7069] tracking-[0.12em] font-mono flex items-center whitespace-nowrap">
            {labelHeader}
          </div>
          {safeColumns.map((col, idx) => (
            <div key={idx} className="bg-[#110f0b] px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm font-black text-white border-l border-[#2a2520]">
              {col}
            </div>
          ))}
          {safeRows.map((row, idx) => (
            <React.Fragment key={idx}>
              <div className="px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm font-bold text-[#110f0b] border-t border-[#e8e2d6] bg-[#faf8f3] whitespace-normal break-words leading-relaxed">
                {parseInlineMarkdown(row.label)}
              </div>
              {row.values.map((val, vIdx) => (
                <div
                  key={vIdx}
                  className={`px-3 py-3 sm:px-6 sm:py-4 text-xs sm:text-sm text-[#2d2820] border-t border-l border-[#e8e2d6] leading-relaxed text-left whitespace-normal break-words ${vIdx === 0 ? 'font-semibold text-[#110f0b]' : ''}`}
                >
                  {parseInlineMarkdown(val)}
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
  while (normalizedHeaders.length < columnCount) normalizedHeaders.push('');
  const normalizedRows = rows.map((row) => {
    const cells = row.slice(0, columnCount);
    while (cells.length < columnCount) cells.push('');
    return cells;
  });
  return { columnCount, headers: normalizedHeaders, rows: normalizedRows };
};

const TableBlock = ({ headers, rows }: { headers: string[]; rows: string[][] }) => {
  const { columnCount, headers: safeHeaders, rows: safeRows } = normalizeTable(headers, rows);

  return (
    <div className="mb-10 sm:mb-14 border-2 border-[#110f0b] bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full divide-y-2 divide-[#110f0b]" style={{ minWidth: Math.max(columnCount * 120, 400) }}>
          <thead>
            <tr className="bg-[#110f0b]">
              {safeHeaders.map((h, idx) => (
                <th key={idx} className="px-3 py-3 sm:px-5 sm:py-4 text-left text-[10px] font-black text-[#7a7069] uppercase tracking-[0.12em] font-mono first:pl-4 sm:first:pl-6 whitespace-nowrap">
                  {parseInlineMarkdown(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8e2d6]">
            {safeRows.map((row, idx) => (
              <tr key={idx} className={`transition-colors hover:bg-[#faf8f3] ${idx % 2 === 1 ? 'bg-[#faf8f3]/50' : 'bg-white'}`}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-3 sm:px-5 sm:py-4 text-xs sm:text-sm text-[#2d2820] leading-relaxed first:pl-4 sm:first:pl-6 first:font-semibold first:text-[#110f0b]">
                    {parseInlineMarkdown(cell)}
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
    <div className="mb-8 sm:mb-10 border-2 border-[#110f0b] overflow-hidden bg-[#1a1612]">
      <div className="flex items-center justify-between px-3 py-2.5 sm:px-5 sm:py-3 bg-[#110f0b] border-b border-[#2a2520]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Code className="w-3.5 h-3.5 text-[#7a7069] flex-shrink-0" />
          {title && <span className="text-xs font-mono text-[#c8c0b4] truncate">{title}</span>}
          {language && (
            <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-black font-mono bg-[#bf3627]/20 text-[#bf3627] uppercase tracking-wider flex-shrink-0">
              {language}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 text-[10px] sm:text-xs font-mono font-bold text-[#7a7069] hover:text-white hover:bg-[#2a2520] transition-colors flex-shrink-0 uppercase tracking-wider"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-[#1e4d2b]" />
              <span className="hidden xs:inline text-[#1e4d2b]">已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="hidden xs:inline">复制</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 sm:p-5 overflow-x-auto">
        <pre className="text-xs sm:text-sm font-mono text-[#d4cec2] leading-relaxed whitespace-pre-wrap break-words">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

const AccordionBlock = ({ items }: { items: AccordionItem[] }) => {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <div className="mb-12 border-t-2 border-[#110f0b]">
      {items.map((item, idx) => (
        <div key={idx} className={`border-b-2 ${openIndex === idx ? 'border-[#bf3627]' : 'border-[#e8e2d6]'}`}>
          <button
            onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
            className={`w-full flex items-center justify-between px-4 sm:px-6 py-4 text-left transition-colors ${openIndex === idx ? 'bg-[#fdf6f5]' : 'hover:bg-[#faf8f3]'}`}
          >
            <span className="font-bold text-[#110f0b] text-sm sm:text-base tracking-tight pr-4">{item.question}</span>
            {openIndex === idx ? (
              <ChevronUp className="w-4 h-4 text-[#bf3627] flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#7a7069] flex-shrink-0" />
            )}
          </button>
          {openIndex === idx && (
            <div className="px-4 sm:px-6 pb-5 pt-3 bg-white border-t border-[#e8e2d6]">
              <p className="text-[#2d2820] leading-relaxed text-xs sm:text-sm md:text-base">{item.answer}</p>
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
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 bg-[#110f0b] group-hover:bg-[#bf3627] text-white flex items-center justify-center font-black text-xs sm:text-sm flex-shrink-0 transition-colors duration-200 font-mono"
          >
            {String(item.step).padStart(2, '0')}
          </div>
          {idx < items.length - 1 && (
            <div className="w-px flex-1 border-l-2 border-dashed border-[#e8e2d6] mt-2 group-hover:border-[#bf3627]/30 transition-colors" />
          )}
        </div>
        <div className="pb-6 sm:pb-8 flex-1">
          <h4 className="font-black text-[#110f0b] text-base md:text-lg mb-1.5 tracking-tight">{item.title}</h4>
          <p className="text-[#7a7069] leading-relaxed text-xs sm:text-sm md:text-base">{item.description}</p>
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
  <div className="mb-12 space-y-4">
    {items.map((item, idx) => {
      const max = item.max || 100;
      const percentage = Math.min((item.value / max) * 100, 100);
      return (
        <div key={idx} className="border-b border-[#e8e2d6] pb-4 last:border-0">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-[#110f0b] text-xs sm:text-sm uppercase tracking-wider font-mono">{item.label}</span>
            <span className="text-xs font-black font-mono text-[#7a7069]">{item.value}/{max}</span>
          </div>
          <div className="h-1.5 bg-[#e8e2d6] overflow-hidden">
            <div
              className="h-full bg-[#bf3627] transition-all duration-500"
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
  const colorConfig = {
    yellow: { bg: 'bg-[#fffbeb]', border: 'border-[#f59e0b]', text: 'text-[#78350f]', dot: 'bg-[#f59e0b]' },
    blue:   { bg: 'bg-[#eff6ff]', border: 'border-[#3b82f6]', text: 'text-[#1e3a8a]', dot: 'bg-[#3b82f6]' },
    green:  { bg: 'bg-[#f0fdf4]', border: 'border-[#22c55e]', text: 'text-[#14532d]', dot: 'bg-[#22c55e]' },
    pink:   { bg: 'bg-[#fdf2f8]', border: 'border-[#ec4899]', text: 'text-[#831843]', dot: 'bg-[#ec4899]' },
  };
  const c = colorConfig[color];

  return (
    <div className={`mb-10 px-5 sm:px-7 py-5 sm:py-6 ${c.bg} border-l-[4px] ${c.border}`}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={`w-2 h-2 ${c.dot} flex-shrink-0 mt-2`} />
        <p className={`text-base md:text-lg font-semibold leading-relaxed ${c.text}`}>
          {parseInlineMarkdown(text, onAnalyzeLink)}
        </p>
      </div>
    </div>
  );
};

const DefinitionBlock = ({ items, onAnalyzeLink }: { items: DefinitionItem[]; onAnalyzeLink?: (url: string) => void }) => (
  <div className="mb-12 space-y-6">
    {items.map((item, idx) => (
      <div key={idx} className="border-t-2 border-[#110f0b] pt-4">
        <div className="flex items-baseline gap-3 mb-2">
          <dt className="font-black text-[#110f0b] text-base md:text-lg uppercase tracking-[0.06em]">
            {parseInlineMarkdown(item.term, onAnalyzeLink)}
          </dt>
          <span className="text-[#bf3627] font-mono text-[10px] font-bold">n.</span>
        </div>
        <dd className="text-[#2d2820] leading-relaxed text-sm md:text-base pl-4 text-[#7a7069]">
          {parseInlineMarkdown(item.definition, onAnalyzeLink)}
        </dd>
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
  <div className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-px bg-[#110f0b]">
    <div className="bg-white p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-5 pb-3 border-b-2 border-[#1e4d2b]">
        <div className="w-3 h-3 bg-[#1e4d2b]" />
        <h4 className="font-black text-[#1e4d2b] text-sm uppercase tracking-[0.1em] font-mono">优点</h4>
      </div>
      <ul className="space-y-3">
        {pros.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <div className="w-2 h-2 bg-[#1e4d2b] mt-2 flex-shrink-0" />
            <span className="text-[#2d2820] text-xs sm:text-sm leading-relaxed">{parseInlineMarkdown(item, onAnalyzeLink)}</span>
          </li>
        ))}
      </ul>
    </div>
    <div className="bg-white p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-5 pb-3 border-b-2 border-[#bf3627]">
        <div className="w-3 h-3 bg-[#bf3627]" />
        <h4 className="font-black text-[#bf3627] text-sm uppercase tracking-[0.1em] font-mono">缺点</h4>
      </div>
      <ul className="space-y-3">
        {cons.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <div className="w-2 h-2 bg-[#bf3627] mt-2 flex-shrink-0" />
            <span className="text-[#2d2820] text-xs sm:text-sm leading-relaxed">{parseInlineMarkdown(item, onAnalyzeLink)}</span>
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
        <div className="flex items-center gap-2 mb-3">
          <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-[#bf3627] border-b-[5px] border-b-transparent" />
          <h4 className="font-black text-[#110f0b] text-sm sm:text-base uppercase tracking-wider font-mono">{title}</h4>
        </div>
      )}
      <div className="relative aspect-video border-2 border-[#110f0b] overflow-hidden bg-[#1a1612]">
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
        <div className="flex-1 h-px bg-[#e8e2d6]" />
        <span className="text-[10px] font-black text-[#7a7069] uppercase tracking-[0.18em] font-mono">{text}</span>
        <div className="flex-1 h-px bg-[#e8e2d6]" />
      </div>
    );
  }

  if (dividerStyle === 'decorated') {
    return (
      <div className="my-12 flex items-center justify-center gap-2">
        <div className="w-12 h-px bg-[#e8e2d6]" />
        <div className="w-2 h-2 bg-[#bf3627] rotate-45" />
        <div className="w-2 h-2 border border-[#e8e2d6] rotate-45" />
        <div className="w-2 h-2 bg-[#bf3627] rotate-45" />
        <div className="w-12 h-px bg-[#e8e2d6]" />
      </div>
    );
  }

  return <hr className="my-10 border-t border-[#e8e2d6]" />;
};

const LinkCardBlock = ({ url, title, description, image }: { url: string; title: string; description?: string; image?: string }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="mb-10 block group"
  >
    <div className="flex flex-col md:flex-row gap-0 border-2 border-[#110f0b] bg-white hover:border-[#bf3627] transition-colors overflow-hidden">
      {image && (
        <div className="w-full md:w-44 h-28 sm:h-32 bg-[#1a1612] flex-shrink-0 overflow-hidden">
          <img src={image} alt={title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
      <div className="flex-1 min-w-0 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-black text-[#110f0b] text-sm sm:text-base tracking-tight group-hover:text-[#bf3627] transition-colors leading-tight">
            {title}
          </h4>
          <ExternalLink className="w-3.5 h-3.5 text-[#7a7069] flex-shrink-0 mt-0.5" />
        </div>
        {description && (
          <p className="text-[#7a7069] text-xs sm:text-sm mt-1 line-clamp-2 leading-relaxed">{description}</p>
        )}
        <p className="text-[#7a7069]/60 text-[10px] mt-2 truncate font-mono">{url}</p>
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
      stars.push(<Star key={`full-${i}`} className="w-4 h-4 text-[#bf3627] fill-[#bf3627]" />);
    }
    if (hasHalfStar) {
      stars.push(<StarHalf key="half" className="w-4 h-4 text-[#bf3627] fill-[#bf3627]" />);
    }
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-4 h-4 text-[#e8e2d6]" />);
    }
    return stars;
  };

  return (
    <div className="mb-12 border-t-2 border-[#110f0b]">
      {items.map((item, idx) => {
        const maxScore = item.maxScore || 5;
        return (
          <div key={idx} className="flex items-center justify-between py-4 border-b border-[#e8e2d6] last:border-0">
            <span className="font-bold text-[#110f0b] text-xs sm:text-sm uppercase tracking-wider font-mono">{item.label}</span>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex gap-0.5">{renderStars(item.score, maxScore)}</div>
              <span className="text-xs font-black font-mono text-[#7a7069]">
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

const stripTitleNumbering = (title: string): string => {
  return title
    .replace(/^[\d]+(?:\.[\d]+)*\.?\s+/, '')
    .replace(/^[一二三四五六七八九十百千]+[、．.]\s*/, '')
    .replace(/^[（(][一二三四五六七八九十百千\d]+[)）]\s*/, '')
    .replace(/^第[一二三四五六七八九十百千\d]+[章节部分条款篇]\s*[：:\s]\s*/, '')
    .replace(/^第[一二三四五六七八九十百千\d]+[章节部分条款篇]\s+/, '')
    .replace(/^(?:Part|Chapter|Section)\s+[\d.]+[：:\s]\s*/i, '')
    .replace(/^(?:Part|Chapter|Section)\s+[\d.]+\s+/i, '')
    .replace(/^[（(][\d]+[)）]\s*/, '')
    .trim();
};

const SectionRenderer: React.FC<{ section: ArticleSection; index: number; onAnalyzeLink?: (url: string) => void }> = ({ section, index, onAnalyzeLink }) => (
  <div className="mb-14 sm:mb-20 md:mb-24 last:mb-0 relative">
    {/* Giant watermark number */}
    <div
      className="absolute -left-1 sm:-left-2 -top-6 sm:-top-8 leading-none text-[#110f0b]/[0.04] select-none pointer-events-none z-0 font-black tracking-tighter"
      style={{
        fontSize: 'clamp(6rem, 14vw, 11rem)',
        fontFamily: "'Bebas Neue', 'DM Mono', monospace",
      }}
    >
      {String(index + 1).padStart(2, '0')}
    </div>

    {/* Section header */}
    <div className="relative z-10 mb-8 sm:mb-10 pb-4 sm:pb-5">
      <div className="w-6 h-[3px] bg-[#bf3627] mb-3 sm:mb-4" />
      <h2 className="text-2xl sm:text-3xl md:text-[2.2rem] font-serif font-black text-[#110f0b] tracking-tight leading-[1.15]">
        {stripTitleNumbering(section.title)}
      </h2>
      <div className="mt-4 sm:mt-5 w-full h-px bg-[#e8e2d6]" />
    </div>

    <div className="relative z-10 max-w-3xl mx-auto">
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
    <div className="max-w-4xl w-full mx-auto bg-white min-h-screen overflow-hidden md:border-x-2 border-[#110f0b] transition-all box-border">
      {/* Header */}
      <header className="bg-[#110f0b] text-white px-4 py-10 sm:px-8 sm:py-16 md:px-20 md:py-20 relative overflow-hidden">
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,1) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,1) 40px)',
          }}
        />
        {/* Vermillion accent stripe */}
        <div className="absolute left-0 top-0 w-[3px] h-full bg-[#bf3627]" />

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-[10px] sm:text-[11px] font-mono text-[#5a5248] uppercase tracking-[0.16em] mb-7 sm:mb-10">
            {data.meta?.date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> {data.meta.date}
              </span>
            )}
            {data.meta?.readTime && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> {data.meta.readTime}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-[2rem] sm:text-[3rem] md:text-[3.8rem] font-serif font-black mb-6 sm:mb-8 leading-[1.05] text-white tracking-tight">
            {data.title}
          </h1>

          {/* Red rule */}
          <div className="w-14 h-[3px] bg-[#bf3627] mb-5 sm:mb-7" />

          {data.subtitle && (
            <p className="text-sm sm:text-base md:text-lg text-[#8a8077] font-light leading-relaxed max-w-2xl">
              {data.subtitle}
            </p>
          )}

          {data.meta?.author && (
            <div className="mt-10 sm:mt-14 flex items-center gap-3 sm:gap-4 border-t border-[#2a2520] pt-6 sm:pt-8">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-[#bf3627] flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[9px] font-mono text-[#5a5248] uppercase tracking-[0.16em] mb-0.5">AUTHOR</p>
                <p className="text-sm sm:text-base font-bold text-white">{data.meta.author}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content Body */}
      <main className="px-4 py-10 sm:px-6 sm:py-14 md:px-20 md:py-20 bg-white">
        {data.sections.map((section, idx) => (
          <SectionRenderer key={idx} section={section} index={idx} onAnalyzeLink={onAnalyzeLink} />
        ))}

        <footer className="mt-20 sm:mt-28 pt-8 sm:pt-10 border-t-2 border-[#110f0b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#bf3627] rotate-45" />
            <div className="w-2 h-2 border border-[#e8e2d6] rotate-45" />
          </div>
          <p className="text-[#7a7069] text-[10px] sm:text-xs font-mono uppercase tracking-[0.14em] flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[#bf3627]" />
            Infographic Renderer · {new Date().getFullYear()}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 border border-[#e8e2d6] rotate-45" />
            <div className="w-2 h-2 bg-[#bf3627] rotate-45" />
          </div>
        </footer>
      </main>
    </div>
  );
};

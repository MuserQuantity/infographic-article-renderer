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

// --- Sub-Components ---

const ParagraphBlock = ({ text }: { text: string }) => {
  const parseBold = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-stone-900 bg-amber-100/60 px-1 rounded-sm">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <p className="text-stone-700 leading-7 md:leading-8 mb-6 text-base md:text-lg tracking-wide text-justify font-normal">
      {parseBold(text)}
    </p>
  );
};

const QuoteBlock = ({ text, author }: { text: string; author?: string }) => {
  // 清理 markdown 引用语法 (> 开头的行)
  const cleanText = text
    .split('\n')
    .map(line => line.replace(/^>\s*/, ''))
    .join('\n')
    .trim();

  return (
    <div className="relative mb-12 mt-10">
      <div className="border-l-4 border-amber-500 pl-8 py-4 pr-2">
        <p className="text-xl md:text-2xl font-serif text-stone-800 mb-6 leading-relaxed italic">
          "{cleanText}"
        </p>
      {author && (
        <div className="flex items-center justify-end gap-4">
          <div className="h-px w-12 bg-stone-300"></div>
          <footer className="text-sm font-bold text-stone-500 uppercase tracking-widest">
            {author}
          </footer>
        </div>
      )}
    </div>
  </div>
  );
};

const CalloutBlock = ({ text, title, variant = 'info' }: { text: string; title?: string; variant?: 'info' | 'warning' | 'success' }) => {
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
    <div className={`flex items-start gap-4 p-6 rounded-xl border ${styles[variant]} mb-8`}>
      <Icon className={`w-6 h-6 flex-shrink-0 mt-0.5 ${iconColors[variant]}`} />
      <div className="flex-1">
        {title && <h4 className="font-bold mb-1 text-base md:text-lg">{title}</h4>}
        <p className="opacity-90 leading-relaxed text-sm md:text-base">{text}</p>
      </div>
    </div>
  );
};

const ListBlock = ({ items, title, style = 'bullet' }: { items: string[]; title?: string; style?: 'bullet' | 'check' | 'number' }) => (
  <div className="mb-10 pl-2">
    {title && <h4 className="font-bold text-stone-900 mb-6 text-base md:text-lg flex items-center gap-2 border-b border-stone-100 pb-2">
      {title}
    </h4>}
    <ul className="space-y-4">
      {items.map((item, idx) => {
        const content = item.split(/(\*\*.*?\*\*)/g).map((part, i) => 
          part.startsWith('**') && part.endsWith('**') 
            ? <span key={i} className="font-bold text-stone-900">{part.slice(2, -2)}</span> 
            : part
        );

        return (
          <li key={idx} className="flex gap-4 items-start group">
            <span className="flex-shrink-0 mt-1.5">
              {style === 'check' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {style === 'bullet' && <div className="w-2 h-2 rounded-full bg-stone-400 mt-2" />}
              {style === 'number' && (
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 text-stone-600 text-xs font-bold font-mono">
                  {idx + 1}
                </span>
              )}
            </span>
            <span className="text-stone-700 text-base md:text-lg leading-relaxed border-b border-stone-100 pb-4 w-full group-last:border-0">{content}</span>
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
    <div className={`grid ${gridCols[columns]} gap-6 mb-12`}>
      {items.map((item, idx) => (
        <div key={idx} className="bg-stone-50 p-8 rounded-2xl transition-all duration-300 hover:bg-white hover:shadow-xl hover:shadow-stone-200/50 group border border-transparent hover:border-stone-100">
          <div className="w-12 h-12 rounded-xl bg-white text-stone-800 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
             <LayoutGrid className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-stone-800 mb-3 text-lg md:text-xl">
            {item.title}
          </h4>
          <p className="text-stone-600 leading-relaxed text-sm md:text-base">{item.description}</p>
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

const StatsBlock = ({ items, columns = 3 }: { items: StatItem[]; columns?: 1 | 2 | 3 }) => {
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

const TimelineBlock = ({ items }: { items: { title: string; time?: string; desc?: string }[] }) => (
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

const ComparisonBlock = ({ columns, rows }: { columns: string[]; rows: ComparisonRow[] }) => (
  <div className="mb-14 rounded-xl border border-stone-200 bg-white">
    <div className="overflow-x-auto">
      <div className="grid" style={{ gridTemplateColumns: `150px repeat(${columns.length}, minmax(120px, 1fr))`, minWidth: Math.max((columns.length + 1) * 130, 400) }}>
        <div className="bg-stone-50 px-6 py-4 text-xs font-bold uppercase text-stone-400 flex items-center whitespace-nowrap">
          对比项
        </div>
        {columns.map((col, idx) => (
          <div key={idx} className={`bg-stone-50 px-6 py-4 text-sm font-bold text-stone-800 border-l border-stone-200 text-center ${idx === 0 ? 'bg-stone-100/50' : ''}`}>
            {col}
          </div>
        ))}
        {rows.map((row, idx) => (
          <React.Fragment key={idx}>
            <div className="px-6 py-4 text-sm font-bold text-stone-700 border-t border-stone-100 bg-white whitespace-nowrap">
              {row.label}
            </div>
            {row.values.map((val, vIdx) => (
              <div
                key={vIdx}
                className={`px-6 py-4 text-sm text-stone-600 border-t border-l border-stone-100 leading-relaxed text-center ${vIdx === 0 ? 'bg-stone-50/30 font-medium text-stone-900' : ''}`}
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

const TableBlock = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="mb-14 rounded-xl border border-stone-200 bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table className="w-full divide-y divide-stone-200" style={{ minWidth: Math.max(headers.length * 150, 500) }}>
        <thead>
          <tr className="bg-stone-50">
            {headers.map((h, idx) => (
              <th key={idx} className="px-6 py-4 text-left text-xs font-bold text-stone-500 uppercase tracking-wider first:pl-8 whitespace-nowrap min-w-[120px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row, idx) => (
            <tr key={idx} className="bg-white hover:bg-stone-50/50 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-6 py-4 text-sm text-stone-700 leading-relaxed first:pl-8 first:font-medium min-w-[120px]">
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

const CodeBlock = ({ code, language, title }: { code: string; language?: string; title?: string }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-10 rounded-xl overflow-hidden border border-stone-200 bg-stone-900 shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-stone-800 border-b border-stone-700">
        <div className="flex items-center gap-3">
          <Code className="w-4 h-4 text-stone-400" />
          {title && <span className="text-sm font-medium text-stone-300">{title}</span>}
          {language && (
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-stone-700 text-stone-300">
              {language}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-700 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm font-mono text-stone-100 leading-relaxed whitespace-pre-wrap break-words">
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

const StepsBlock = ({ items }: { items: StepItem[] }) => (
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

const ProgressBlock = ({ items }: { items: ProgressItem[] }) => (
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

const HighlightBlock = ({ text, color = 'yellow' }: { text: string; color?: 'yellow' | 'blue' | 'green' | 'pink' }) => {
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
      <p className="text-base md:text-lg font-medium leading-relaxed">{text}</p>
    </div>
  );
};

const DefinitionBlock = ({ items }: { items: DefinitionItem[] }) => (
  <div className="mb-12 space-y-4">
    {items.map((item, idx) => (
      <div key={idx} className="bg-stone-50 rounded-xl p-6 border-l-4 border-stone-400">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-stone-500" />
          <dt className="font-bold text-stone-900 text-base md:text-lg">{item.term}</dt>
        </div>
        <dd className="text-stone-600 leading-relaxed text-sm md:text-base pl-6">{item.definition}</dd>
      </div>
    ))}
  </div>
);

const ProsConsBlock = ({ pros, cons }: { pros: string[]; cons: string[] }) => (
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
            <span className="text-emerald-800 text-sm md:text-base leading-relaxed">{item}</span>
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
            <span className="text-rose-800 text-sm md:text-base leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

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

// --- Main Block Switcher ---

const BlockRenderer: React.FC<{ block: ContentBlock }> = ({ block }) => {
  switch (block.type) {
    case 'paragraph':
      return <ParagraphBlock text={block.text} />;
    case 'quote':
      return <QuoteBlock text={block.text} author={block.author} />;
    case 'callout':
      return <CalloutBlock text={block.text} title={block.title} variant={block.variant} />;
    case 'list':
      return <ListBlock items={block.items} title={block.title} style={block.style} />;
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
      return <HighlightBlock text={block.text} color={block.color} />;
    case 'definition':
      return <DefinitionBlock items={block.items} />;
    case 'proscons':
      return <ProsConsBlock pros={block.pros} cons={block.cons} />;
    case 'video':
      return <VideoBlock src={block.src} platform={block.platform} title={block.title} />;
    case 'divider':
      return <DividerBlock dividerStyle={block.dividerStyle} text={block.text} />;
    case 'linkcard':
      return <LinkCardBlock url={block.url} title={block.title} description={block.description} image={block.image} />;
    case 'rating':
      return <RatingBlock items={block.items} />;
    default:
      return null;
  }
};

// --- Section Renderer ---

const SectionRenderer: React.FC<{ section: ArticleSection; index: number }> = ({ section, index }) => (
  <div className="mb-16 md:mb-20 last:mb-0 relative">
    <div className="flex items-baseline gap-3 md:gap-4 mb-8 md:mb-10 border-b-2 border-black pb-4">
      <div className="text-3xl md:text-4xl font-serif font-black text-stone-200 opacity-50">
        {String(index + 1).padStart(2, '0')}
      </div>
      <h2 className="text-2xl md:text-4xl font-serif font-bold text-stone-900 tracking-tight flex-1">
        {section.title}
      </h2>
    </div>
    <div className="max-w-3xl mx-auto">
      {section.content.map((block, idx) => (
        <BlockRenderer key={idx} block={block} />
      ))}
    </div>
  </div>
);

// --- Root Component ---

interface ArticleRendererProps {
  data: ArticleData;
}

export const ArticleRenderer: React.FC<ArticleRendererProps> = ({ data }) => {
  return (
    <div className="max-w-5xl mx-auto bg-white min-h-[1000px] shadow-2xl shadow-stone-900/10 overflow-hidden rounded-none md:rounded-2xl ring-1 ring-slate-900/5 transition-all">
      {/* Header */}
      <header className="bg-stone-900 text-white p-8 md:p-24 relative overflow-hidden">
        {/* Subtle noise texture or pattern could go here */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-stone-800 via-stone-900 to-black opacity-80" />
        
        <div className="relative z-10 max-w-3xl mx-auto text-center md:text-left">
          <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-stone-400 uppercase tracking-widest mb-8 justify-center md:justify-start">
            {data.meta?.date && (
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" /> {data.meta.date}
              </span>
            )}
            {data.meta?.readTime && (
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4" /> {data.meta.readTime}
              </span>
            )}
          </div>
          
          <h1 className="text-4xl md:text-7xl font-serif font-black mb-8 md:mb-10 leading-tight text-stone-50">
            {data.title}
          </h1>
          
          {data.subtitle && (
            <p className="text-lg md:text-2xl text-stone-300 font-light leading-relaxed max-w-2xl border-l-2 border-amber-500 pl-4 md:pl-6 mx-auto md:mx-0 text-left">
              {data.subtitle}
            </p>
          )}

          {data.meta?.author && (
            <div className="mt-16 flex items-center justify-center md:justify-start gap-4">
              <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center text-stone-300">
                  <User className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Written by</p>
                <p className="font-bold text-white">{data.meta.author}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content Body */}
      <main className="p-6 md:p-20 bg-white">
        {data.sections.map((section, idx) => (
          <SectionRenderer key={idx} section={section} index={idx} />
        ))}
        
        <footer className="mt-32 pt-12 border-t border-stone-100 text-center">
          <p className="text-stone-400 text-sm font-medium flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Generated by Infographic Renderer • {new Date().getFullYear()}
          </p>
        </footer>
      </main>
    </div>
  );
};
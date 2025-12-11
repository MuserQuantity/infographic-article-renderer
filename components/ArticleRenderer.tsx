import React from 'react';
import { 
  ArticleData, 
  ContentBlock, 
  ArticleSection, 
  GridItem,
  StatItem,
  ComparisonRow
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
  Image as ImageIcon
} from 'lucide-react';

// --- Sub-Components ---

const ParagraphBlock = ({ text }: { text: string }) => {
  const parseBold = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900 bg-orange-100 px-1 rounded-sm">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <p className="text-slate-700 leading-8 mb-6 text-lg tracking-wide text-justify">
      {parseBold(text)}
    </p>
  );
};

const QuoteBlock = ({ text, author }: { text: string; author?: string }) => (
  <div className="relative mb-10 mt-8 group">
    <div className="absolute -top-6 -left-4 text-8xl text-orange-200 font-serif opacity-40 select-none z-20">“</div>
    <div className="relative bg-gradient-to-br from-orange-50 to-white p-8 rounded-2xl border border-orange-100 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xl md:text-2xl font-normal text-slate-800 mb-4 leading-relaxed relative z-10">
        {text}
      </p>
      {author && (
        <div className="flex items-center gap-3 justify-end mt-4 pt-4 border-t border-orange-100/50">
          <div className="h-px w-8 bg-orange-300"></div>
          <footer className="text-sm font-bold text-orange-800 uppercase tracking-widest">
            {author}
          </footer>
        </div>
      )}
    </div>
    <div className="absolute -bottom-10 -right-4 text-8xl text-orange-200 font-serif opacity-40 rotate-180 select-none z-20">“</div>
  </div>
);

const CalloutBlock = ({ text, title, variant = 'info' }: { text: string; title?: string; variant?: 'info' | 'warning' | 'success' }) => {
  const styles = {
    info: 'bg-blue-50/50 border-blue-200 text-blue-900 shadow-blue-100',
    warning: 'bg-amber-50/50 border-amber-200 text-amber-900 shadow-amber-100',
    success: 'bg-emerald-50/50 border-emerald-200 text-emerald-900 shadow-emerald-100'
  };

  const Icon = variant === 'warning' ? AlertTriangle : Info;
  const iconColors = {
    info: 'text-blue-600',
    warning: 'text-amber-600',
    success: 'text-emerald-600'
  };

  return (
    <div className={`flex items-center gap-4 p-6 rounded-xl border ${styles[variant]} mb-8 shadow-sm backdrop-blur-sm`}>
      <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center p-2 bg-white rounded-lg shadow-sm ${iconColors[variant]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        {title && <h4 className="font-bold mb-2 text-lg">{title}</h4>}
        <p className="opacity-90 leading-relaxed text-base">{text}</p>
      </div>
    </div>
  );
};

const ListBlock = ({ items, title, style = 'bullet' }: { items: string[]; title?: string; style?: 'bullet' | 'check' | 'number' }) => (
  <div className="mb-8 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
    {title && <h4 className="font-bold text-slate-800 mb-4 text-lg flex items-center gap-2">
      <List className="w-5 h-5 text-indigo-500" />
      {title}
    </h4>}
    <ul className="space-y-4">
      {items.map((item, idx) => {
        const content = item.split(/(\*\*.*?\*\*)/g).map((part, i) => 
          part.startsWith('**') && part.endsWith('**') 
            ? <span key={i} className="font-bold text-slate-900 bg-white px-1 shadow-sm rounded border border-slate-100">{part.slice(2, -2)}</span> 
            : part
        );

        return (
          <li key={idx} className="flex gap-4 items-start group">
            <span className="flex-shrink-0 mt-1 transition-transform group-hover:scale-110">
              {style === 'check' && <div className="p-1 bg-green-100 rounded-full"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>}
              {style === 'bullet' && <div className="w-2.5 h-2.5 rounded-full bg-orange-400 mt-2 ring-4 ring-orange-100" />}
              {style === 'number' && (
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold font-mono border border-indigo-200 shadow-sm">
                  {idx + 1}
                </span>
              )}
            </span>
            <span className="text-slate-700 text-lg leading-relaxed">{content}</span>
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
    <div className={`grid ${gridCols[columns]} gap-5 mb-10`}>
      {items.map((item, idx) => (
        <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
             <LayoutGrid className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-800 mb-3 text-lg group-hover:text-indigo-700 transition-colors">
            {item.title}
          </h4>
          <p className="text-slate-600 text-sm leading-relaxed">{item.description}</p>
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
    <figure className="mb-12 group">
      <div
        className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-lg relative"
        style={{ aspectRatio: aspect }}
      >
        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/5 transition-colors z-10 pointer-events-none" />
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          className="w-full h-full object-cover block transition-transform duration-700 group-hover:scale-[1.02]"
        />
      </div>
      {caption && (
        <figcaption className="mt-3 px-2 text-sm text-slate-500 flex items-center justify-center gap-2 font-medium">
          <ImageIcon className="w-4 h-4 text-indigo-400" />
          {caption}
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
    if (trend === 'up') return <TrendingUp className="w-4 h-4" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4" />;
    return <div className="w-4 h-1 bg-current rounded-full" />;
  };

  const trendConfig = (trend?: StatItem['trend']) => {
    if (trend === 'up') return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' };
    if (trend === 'down') return { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' };
    return { color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-100' };
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 mb-10`}>
      {items.map((item, idx) => {
        const style = trendConfig(item.trend);
        return (
          <div key={idx} className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-20 ${style.bg}`} />
            <div className="relative z-10">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-extrabold text-slate-900 tracking-tight">{item.value}</span>
              </div>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${style.bg} ${style.color} ${style.border}`}>
                {trendIcon(item.trend)}
                {item.trend === 'up' && '增长'}
                {item.trend === 'down' && '下降'}
                {item.trend === 'flat' && '持平'}
                {item.note && <span className="opacity-60 font-normal border-l border-current pl-1.5 ml-0.5">{item.note}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TagsBlock = ({ items }: { items: string[] }) => (
  <div className="flex flex-wrap gap-2 mb-10">
    {items.map((tag, idx) => (
      <span
        key={idx}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
      >
        <Tag className="w-3.5 h-3.5" />
        {tag}
      </span>
    ))}
  </div>
);

const TimelineBlock = ({ items }: { items: { title: string; time?: string; desc?: string }[] }) => (
  <div className="relative pl-6 mb-12">
    <div className="absolute left-[23px] top-4 bottom-4 w-0.5 bg-indigo-100 bg-gradient-to-b from-indigo-200 via-indigo-100 to-transparent" />
    <div className="space-y-8">
      {items.map((item, idx) => (
        <div key={idx} className="relative pl-10 group">
          <div className="absolute left-[18px] top-2 w-3 h-3 rounded-full bg-white border-[3px] border-indigo-500 shadow-md group-hover:scale-125 transition-transform z-10" />
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group-hover:border-indigo-100">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h4 className="font-bold text-slate-800 text-lg">{item.title}</h4>
              {item.time && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full inline-flex items-center gap-1 border border-indigo-100">
                  <Clock className="w-3 h-3" />
                  {item.time}
                </span>
              )}
            </div>
            {item.desc && <p className="text-slate-600 leading-relaxed text-sm">{item.desc}</p>}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ComparisonBlock = ({ columns, rows }: { columns: string[]; rows: ComparisonRow[] }) => (
  <div className="mb-12 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-100">
    <div className="grid" style={{ gridTemplateColumns: `180px repeat(${columns.length}, minmax(0, 1fr))` }}>
      <div className="bg-slate-50/80 px-6 py-4 text-xs font-bold uppercase text-slate-500 border-b border-slate-200 flex items-center">
        对比项
      </div>
      {columns.map((col, idx) => (
        <div key={idx} className={`bg-slate-50/80 px-6 py-4 text-sm font-bold text-slate-800 border-b border-l border-slate-200 text-center ${idx === 0 ? 'bg-indigo-50/50 text-indigo-900' : ''}`}>
          {col}
        </div>
      ))}
      {rows.map((row, idx) => (
        <React.Fragment key={idx}>
          <div className="px-6 py-4 text-sm font-bold text-slate-700 border-b border-slate-100 bg-slate-50/30">
            {row.label}
          </div>
          {row.values.map((val, vIdx) => (
            <div
              key={vIdx}
              className={`px-6 py-4 text-sm text-slate-600 border-b border-l border-slate-100 leading-relaxed text-center ${vIdx === 0 ? 'bg-indigo-50/10 font-medium text-indigo-900' : ''}`}
            >
              {val}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  </div>
);

const TableBlock = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="mb-12 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-100">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead>
          <tr className="bg-slate-50/80">
            {headers.map((h, idx) => (
              <th key={idx} className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider first:pl-8">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, idx) => (
            <tr key={idx} className="bg-white hover:bg-slate-50/50 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-6 py-4 text-sm text-slate-700 leading-relaxed first:pl-8 first:font-medium">
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
    default:
      return null;
  }
};

// --- Section Renderer ---

const SectionRenderer: React.FC<{ section: ArticleSection; index: number }> = ({ section, index }) => (
  <div className="mb-16 last:mb-0 relative">
    <div className="flex items-start gap-5 mb-8">
      <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-slate-200 mt-1">
        {index + 1}
      </div>
      <div className="flex-1 pt-2 border-b-2 border-slate-100 pb-4">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {section.title}
        </h2>
      </div>
    </div>
    <div className="pl-2 md:pl-[68px]">
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
    <div className="max-w-5xl mx-auto bg-white min-h-[1000px] shadow-2xl overflow-hidden rounded-none md:rounded-2xl ring-1 ring-slate-900/5">
      {/* Header */}
      <header className="bg-slate-900 text-white p-12 md:p-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 via-slate-900 to-slate-950 z-0" />
        {/* Abstract decorative elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500 rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-pulse translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500 rounded-full mix-blend-screen filter blur-[100px] opacity-20 -translate-x-1/3 translate-y-1/3"></div>
        
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap gap-4 text-sm font-bold tracking-widest text-indigo-300 uppercase mb-8">
            {data.meta?.date && (
              <span className="flex items-center gap-2 bg-slate-800/50 px-3 py-1 rounded-full backdrop-blur-sm border border-slate-700">
                <Calendar className="w-3.5 h-3.5" /> {data.meta.date}
              </span>
            )}
            {data.meta?.readTime && (
              <span className="flex items-center gap-2 bg-slate-800/50 px-3 py-1 rounded-full backdrop-blur-sm border border-slate-700">
                <Clock className="w-3.5 h-3.5" /> {data.meta.readTime}
              </span>
            )}
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-8 leading-[1.1] tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-400">
            {data.title}
          </h1>
          
          {data.subtitle && (
            <div className="flex gap-6">
              <div className="w-1.5 self-stretch bg-gradient-to-b from-orange-400 to-orange-600 rounded-full"></div>
              <p className="text-xl md:text-2xl text-slate-300 max-w-2xl leading-relaxed font-light">
                {data.subtitle}
              </p>
            </div>
          )}

          {data.meta?.author && (
            <div className="mt-12 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] ring-4 ring-slate-800/50">
                <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center">
                   <User className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <p className="text-xs text-indigo-300 uppercase tracking-widest font-bold mb-0.5">Written by</p>
                <p className="font-bold text-white text-lg">{data.meta.author}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content Body */}
      <main className="p-8 md:p-20 bg-gradient-to-b from-white to-slate-50/50">
        {data.sections.map((section, idx) => (
          <SectionRenderer key={idx} section={section} index={idx} />
        ))}
        
        <footer className="mt-24 pt-12 border-t border-slate-100 text-center">
          <p className="text-slate-400 text-sm font-medium flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" />
            Generated by Infographic Renderer • {new Date().getFullYear()}
          </p>
        </footer>
      </main>
    </div>
  );
};

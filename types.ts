export type ArticleContentType = 
  | 'paragraph' 
  | 'list' 
  | 'quote' 
  | 'callout' 
  | 'grid' 
  | 'image'
  | 'stat'
  | 'tags'
  | 'timeline'
  | 'comparison'
  | 'table';

export interface BaseContent {
  type: ArticleContentType;
  id?: string;
}

export interface TextContent extends BaseContent {
  type: 'paragraph';
  text: string;
}

export interface ListContent extends BaseContent {
  type: 'list';
  title?: string;
  items: string[];
  style?: 'bullet' | 'check' | 'number';
}

export interface QuoteContent extends BaseContent {
  type: 'quote';
  text: string;
  author?: string;
}

export interface CalloutContent extends BaseContent {
  type: 'callout';
  title?: string;
  text: string;
  variant?: 'info' | 'warning' | 'success';
}

export interface GridItem {
  title: string;
  description: string;
  icon?: string; // Icon name
}

export interface GridContent extends BaseContent {
  type: 'grid';
  columns: 1 | 2 | 3;
  items: GridItem[];
}

export interface ImageContent extends BaseContent {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
}

export interface StatItem {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
  note?: string;
}

export interface StatContent extends BaseContent {
  type: 'stat';
  items: StatItem[];
  columns?: 1 | 2 | 3;
}

export interface TagsContent extends BaseContent {
  type: 'tags';
  items: string[];
}

export interface TimelineItem {
  title: string;
  time?: string;
  desc?: string;
}

export interface TimelineContent extends BaseContent {
  type: 'timeline';
  items: TimelineItem[];
}

export interface ComparisonRow {
  label: string;
  values: string[];
}

export interface ComparisonContent extends BaseContent {
  type: 'comparison';
  columns: string[];
  rows: ComparisonRow[];
}

export interface TableContent extends BaseContent {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export type ContentBlock = 
  | TextContent 
  | ListContent 
  | QuoteContent 
  | CalloutContent 
  | GridContent 
  | ImageContent
  | StatContent
  | TagsContent
  | TimelineContent
  | ComparisonContent
  | TableContent;

export interface ArticleSection {
  title: string;
  content: ContentBlock[];
}

export interface ArticleData {
  title: string;
  subtitle?: string;
  meta?: {
    author?: string;
    date?: string;
    readTime?: string;
  };
  sections: ArticleSection[];
}

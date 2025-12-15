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
  | 'table'
  | 'code'
  | 'accordion'
  | 'steps'
  | 'progress'
  | 'highlight'
  | 'definition'
  | 'proscons'
  | 'video'
  | 'divider'
  | 'linkcard'
  | 'rating';

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

export interface CodeContent extends BaseContent {
  type: 'code';
  code: string;
  language?: string;
  title?: string;
}

// New content types

export interface AccordionItem {
  question: string;
  answer: string;
}

export interface AccordionContent extends BaseContent {
  type: 'accordion';
  items: AccordionItem[];
}

export interface StepItem {
  step: number;
  title: string;
  description: string;
}

export interface StepsContent extends BaseContent {
  type: 'steps';
  items: StepItem[];
}

export interface ProgressItem {
  label: string;
  value: number;
  max?: number;
}

export interface ProgressContent extends BaseContent {
  type: 'progress';
  items: ProgressItem[];
}

export interface HighlightContent extends BaseContent {
  type: 'highlight';
  text: string;
  color?: 'yellow' | 'blue' | 'green' | 'pink';
}

export interface DefinitionItem {
  term: string;
  definition: string;
}

export interface DefinitionContent extends BaseContent {
  type: 'definition';
  items: DefinitionItem[];
}

export interface ProsConsContent extends BaseContent {
  type: 'proscons';
  pros: string[];
  cons: string[];
}

export interface VideoContent extends BaseContent {
  type: 'video';
  src: string;
  platform?: 'youtube' | 'bilibili' | 'custom';
  title?: string;
}

export interface DividerContent extends BaseContent {
  type: 'divider';
  dividerStyle?: 'simple' | 'decorated' | 'text';
  text?: string;
}

export interface LinkCardContent extends BaseContent {
  type: 'linkcard';
  url: string;
  title: string;
  description?: string;
  image?: string;
}

export interface RatingItem {
  label: string;
  score: number;
  maxScore?: number;
}

export interface RatingContent extends BaseContent {
  type: 'rating';
  items: RatingItem[];
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
  | TableContent
  | CodeContent
  | AccordionContent
  | StepsContent
  | ProgressContent
  | HighlightContent
  | DefinitionContent
  | ProsConsContent
  | VideoContent
  | DividerContent
  | LinkCardContent
  | RatingContent;

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

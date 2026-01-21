/**
 * infographicMapper.ts
 * 
 * Utility functions to convert existing article content blocks
 * to @antv/infographic syntax (DSL)
 */

import {
  StepItem,
  TimelineItem,
  ProgressItem,
  StatItem,
  ComparisonRow,
} from '../types';

/**
 * Convert StepItem[] to Infographic Syntax for sequence-steps
 * Template: sequence-steps-simple
 */
export function stepsToInfographicSyntax(items: StepItem[]): string {
  const itemsText = items
    .map((item) => {
      return `    - label ${item.title}\n      desc ${item.description}`;
    })
    .join('\n');

  return `infographic sequence-steps-simple
data
  sequences
${itemsText}`;
}

/**
 * Convert TimelineItem[] to Infographic Syntax for sequence-timeline
 * Template: sequence-timeline-simple
 */
export function timelineToInfographicSyntax(items: TimelineItem[]): string {
  const itemsText = items
    .map((item) => {
      const time = item.time ? ` (${item.time})` : '';
      const desc = item.desc ? `\n      desc ${item.desc}` : '';
      return `    - label ${item.title}${time}${desc}`;
    })
    .join('\n');

  return `infographic sequence-timeline-simple
data
  sequences
${itemsText}`;
}

/**
 * Convert ProgressItem[] to Infographic Syntax for circular-progress
 * Template: list-grid-circular-progress
 */
export function progressToInfographicSyntax(items: ProgressItem[]): string {
  const itemsText = items
    .map((item) => {
      const max = item.max || 100;
      const percentage = Math.round((item.value / max) * 100);
      return `    - label ${item.label}\n      value ${percentage}`;
    })
    .join('\n');

  return `infographic list-grid-circular-progress
data
  lists
${itemsText}`;
}

/**
 * Convert pros/cons to Infographic Syntax for binary comparison
 * Template: compare-binary-horizontal-simple-fold
 */
export function prosConsToInfographicSyntax(
  pros: string[],
  cons: string[]
): string {
  const prosText = pros
    .map((item) => `      - label ${item}`)
    .join('\n');
  const consText = cons
    .map((item) => `      - label ${item}`)
    .join('\n');

  return `infographic compare-binary-horizontal-simple-fold
data
  compares
    - label 优点
      children
${prosText}
    - label 缺点
      children
${consText}`;
}

/**
 * Convert StatItem[] to Infographic Syntax for stats display
 * Template: list-grid-simple (for general stats)
 */
export function statsToInfographicSyntax(
  items: StatItem[],
  columns?: 1 | 2 | 3
): string {
  const template = columns === 3 ? 'list-grid-simple' : 'list-row-simple-horizontal-arrow';
  
  const itemsText = items
    .map((item) => {
      const trend = item.trend ? `\n      desc ${getTrendText(item.trend)}` : '';
      const note = item.note ? ` ${item.note}` : '';
      return `    - label ${item.label}\n      value ${item.value}${note}${trend}`;
    })
    .join('\n');

  return `infographic ${template}
data
  lists
${itemsText}`;
}

function getTrendText(trend: 'up' | 'down' | 'flat'): string {
  if (trend === 'up') return '↑ 增长';
  if (trend === 'down') return '↓ 下降';
  return '— 持平';
}

/**
 * Convert comparison table to Infographic Syntax
 * Template: compare-hierarchy-row-letter-card-compact-card
 */
export function comparisonToInfographicSyntax(
  columns: string[],
  rows: ComparisonRow[]
): string {
  // Build comparison structure
  const compareGroups = columns.slice(1).map((col, colIndex) => {
    const children = rows
      .map((row) => {
        const value = row.values[colIndex] || '';
        return `      - label ${row.label}\n        desc ${value}`;
      })
      .join('\n');

    return `    - label ${col}\n      children\n${children}`;
  });

  const comparesText = compareGroups.join('\n');

  return `infographic compare-hierarchy-row-letter-card-compact-card
data
  compares
${comparesText}`;
}

/**
 * Generic mapper: detects content type and returns appropriate syntax
 */
export function contentToInfographicSyntax(
  type: string,
  data: any
): string | null {
  try {
    switch (type) {
      case 'steps':
        return stepsToInfographicSyntax(data.items);
      case 'timeline':
        return timelineToInfographicSyntax(data.items);
      case 'progress':
        return progressToInfographicSyntax(data.items);
      case 'proscons':
        return prosConsToInfographicSyntax(data.pros, data.cons);
      case 'stat':
        return statsToInfographicSyntax(data.items, data.columns);
      case 'comparison':
        return comparisonToInfographicSyntax(data.columns, data.rows);
      default:
        return null;
    }
  } catch (error) {
    console.error(`Failed to convert ${type} to infographic syntax:`, error);
    return null;
  }
}

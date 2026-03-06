import remarkParse from 'remark-parse';
import stripMarkdownPlugin from 'strip-markdown';
import { unified } from 'unified';

const processor = unified().use(remarkParse).use(stripMarkdownPlugin);

/**
 * Strips markdown formatting from text for use in plain-text contexts
 * like native OS notifications.
 *
 * Uses remark ecosystem (strip-markdown plugin) for reliable parsing.
 */
export function stripMarkdown(text: string): string {
  const result = processor.processSync(text);
  return String(result).trim();
}

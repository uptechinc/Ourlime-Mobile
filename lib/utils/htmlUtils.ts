export type InlineToken = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  link?: string;
};

export type ParsedHtmlBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; tokens: InlineToken[] }
  | { type: 'paragraph'; tokens: InlineToken[] }
  | { type: 'list'; ordered: boolean; items: Array<{ tokens: InlineToken[] }> }
  | { type: 'blockquote'; tokens: InlineToken[]; author?: string }
  | { type: 'code'; code: string }
  | { type: 'image'; src: string; alt?: string; caption?: string }
  | { type: 'divider' };

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  sect: '§',
  deg: '°',
  plusmn: '±',
  sup2: '²',
  sup3: '³',
  micro: 'µ',
  para: '¶',
  middot: '·',
  frac14: '¼',
  frac12: '½',
  frac34: '¾',
  times: '×',
  divide: '÷',
  check: '✓',
};

/**
 * Decode HTML entities like &amp;, &#39;, &nbsp;, etc. into regular Unicode characters.
 */
export function decodeHtmlEntities(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/&#(\d+);/g, (_, num) => {
      const parsed = parseInt(num, 10);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const parsed = parseInt(hex, 16);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : '';
    })
    .replace(/&([a-zA-Z0-9]+);/g, (match, entity) => {
      const lower = entity.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, lower)) {
        return NAMED_ENTITIES[lower];
      }
      return match;
    });
}

/**
 * Strip all HTML tags and decode entities into clean plain text for card excerpts, search, etc.
 */
export function stripHtml(html: string | undefined | null): string {
  if (!html || typeof html !== 'string') return '';
  const withoutBlockBreaks = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|table)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return decodeHtmlEntities(withoutBlockBreaks);
}

/**
 * Parses inline HTML string into formatted tokens (bold, italic, links, etc.)
 */
export function parseInlineTokens(htmlChunk: string): InlineToken[] {
  if (!htmlChunk) return [];
  const tokens: InlineToken[] = [];

  // Active formatting state
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let isStrikethrough = false;
  let isCode = false;
  let currentLink: string | undefined = undefined;

  // Regex matching HTML tags or text chunks
  const tagOrTextRegex = /(<[^>]+>|[^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tagOrTextRegex.exec(htmlChunk)) !== null) {
    const chunk = match[1];
    if (!chunk) continue;

    if (chunk.startsWith('<')) {
      const lower = chunk.toLowerCase();
      if (lower.startsWith('<strong') || lower.startsWith('<b ') || lower === '<b>') {
        isBold = true;
      } else if (lower.startsWith('</strong') || lower.startsWith('</b')) {
        isBold = false;
      } else if (lower.startsWith('<em') || lower.startsWith('<i ') || lower === '<i>') {
        isItalic = true;
      } else if (lower.startsWith('</em') || lower.startsWith('</i')) {
        isItalic = false;
      } else if (lower.startsWith('<u ') || lower === '<u>') {
        isUnderline = true;
      } else if (lower.startsWith('</u')) {
        isUnderline = false;
      } else if (lower.startsWith('<s ') || lower === '<s>' || lower.startsWith('<del') || lower.startsWith('<strike')) {
        isStrikethrough = true;
      } else if (lower.startsWith('</s') || lower.startsWith('</del') || lower.startsWith('</strike')) {
        isStrikethrough = false;
      } else if (lower.startsWith('<code ') || lower === '<code>') {
        isCode = true;
      } else if (lower.startsWith('</code')) {
        isCode = false;
      } else if (lower.startsWith('<a ') || lower === '<a>') {
        const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(chunk);
        if (hrefMatch?.[1]) {
          currentLink = decodeHtmlEntities(hrefMatch[1]);
        }
      } else if (lower.startsWith('</a')) {
        currentLink = undefined;
      } else if (lower.startsWith('<br')) {
        tokens.push({ text: '\n' });
      }
    } else {
      const decodedText = decodeHtmlEntities(chunk);
      if (decodedText.length > 0) {
        tokens.push({
          text: decodedText,
          bold: isBold || undefined,
          italic: isItalic || undefined,
          underline: isUnderline || (currentLink ? true : undefined),
          strikethrough: isStrikethrough || undefined,
          code: isCode || undefined,
          link: currentLink,
        });
      }
    }
  }

  return tokens;
}

/**
 * Parses full HTML content into an array of structured native blocks.
 */
export function parseHtmlToBlocks(html: string): ParsedHtmlBlock[] {
  if (!html || typeof html !== 'string') return [];
  const normalized = html.trim();
  if (!normalized) return [];

  // Check if string contains HTML tags
  if (!/<[a-z][\s\S]*>/i.test(normalized)) {
    // Pure plain text: split into paragraphs
    return normalized
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({
        type: 'paragraph',
        tokens: [{ text: p }],
      }));
  }

  const blocks: ParsedHtmlBlock[] = [];

  // Regex to match top-level block elements or plain content
  const blockRegex =
    /<(h[1-6]|p|blockquote|ul|ol|pre|hr|img|figure|div|section)([^>]*)>([\s\S]*?)<\/\1>|<(img|hr)([^>]*)\/?>|([^<]+)/gi;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(normalized)) !== null) {
    const tagName = (match[1] || match[4] || '').toLowerCase();
    const attributes = match[2] || match[5] || '';
    const innerContent = match[3] || '';
    const rawText = match[6];

    if (rawText && rawText.trim()) {
      const decoded = decodeHtmlEntities(rawText).trim();
      if (decoded) {
        blocks.push({
          type: 'paragraph',
          tokens: [{ text: decoded }],
        });
      }
      continue;
    }

    if (tagName.startsWith('h') && tagName.length === 2) {
      const level = Math.min(Math.max(parseInt(tagName[1], 10), 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
      const tokens = parseInlineTokens(innerContent);
      if (tokens.length > 0) {
        blocks.push({ type: 'heading', level, tokens });
      }
    } else if (tagName === 'blockquote') {
      const citeMatch = /<cite[^>]*>([\s\S]*?)<\/cite>/i.exec(innerContent);
      const author = citeMatch?.[1] ? stripHtml(citeMatch[1]) : undefined;
      const cleanQuoteInner = innerContent.replace(/<cite[^>]*>[\s\S]*?<\/cite>/gi, '');
      const tokens = parseInlineTokens(cleanQuoteInner);
      if (tokens.length > 0) {
        blocks.push({ type: 'blockquote', tokens, author });
      }
    } else if (tagName === 'ul' || tagName === 'ol') {
      const ordered = tagName === 'ol';
      const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      const items: Array<{ tokens: InlineToken[] }> = [];
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemRegex.exec(innerContent)) !== null) {
        const itemHtml = itemMatch[1];
        if (itemHtml) {
          const itemTokens = parseInlineTokens(itemHtml);
          if (itemTokens.length > 0) {
            items.push({ tokens: itemTokens });
          }
        }
      }
      if (items.length > 0) {
        blocks.push({ type: 'list', ordered, items });
      }
    } else if (tagName === 'pre') {
      const codeClean = innerContent.replace(/<code[^>]*>([\s\S]*?)<\/code>/i, '$1');
      const decodedCode = decodeHtmlEntities(codeClean).trim();
      if (decodedCode) {
        blocks.push({ type: 'code', code: decodedCode });
      }
    } else if (tagName === 'img') {
      const srcMatch = /src\s*=\s*["']([^"']+)["']/i.exec(attributes);
      const altMatch = /alt\s*=\s*["']([^"']+)["']/i.exec(attributes);
      if (srcMatch?.[1]) {
        blocks.push({
          type: 'image',
          src: decodeHtmlEntities(srcMatch[1]),
          alt: altMatch?.[1] ? decodeHtmlEntities(altMatch[1]) : undefined,
        });
      }
    } else if (tagName === 'figure') {
      const imgSrcMatch = /src\s*=\s*["']([^"']+)["']/i.exec(innerContent);
      const captionMatch = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(innerContent);
      if (imgSrcMatch?.[1]) {
        blocks.push({
          type: 'image',
          src: decodeHtmlEntities(imgSrcMatch[1]),
          caption: captionMatch?.[1] ? stripHtml(captionMatch[1]) : undefined,
        });
      }
    } else if (tagName === 'hr') {
      blocks.push({ type: 'divider' });
    } else if (tagName === 'p' || tagName === 'div' || tagName === 'section') {
      // Check if inner content contains images or headings
      if (/<img/i.test(innerContent)) {
        const imgSrcMatch = /src\s*=\s*["']([^"']+)["']/i.exec(innerContent);
        if (imgSrcMatch?.[1]) {
          blocks.push({
            type: 'image',
            src: decodeHtmlEntities(imgSrcMatch[1]),
          });
        }
      } else {
        const tokens = parseInlineTokens(innerContent);
        if (tokens.length > 0) {
          blocks.push({ type: 'paragraph', tokens });
        }
      }
    }
  }

  return blocks;
}

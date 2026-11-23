// The app's copy of the website's blog content rules (Ourlime-Web lib/blogs&articles/blogSecurity.ts); the server
// (functions/src/BlogContentService.ts) applies the same rules again when a post is published.
// Blog HTML is rendered with dangerouslySetInnerHTML, so it is rebuilt tag by tag the way a browser tokenizes it
// (quotes only count after "=", attributes need no space between them, entities can hide "javascript:"). Text "<" that
// does not start a tag is escaped, so nothing the sanitizer did not rebuild can become markup.
// Keep in step with Ourlime-Web lib/blogs&articles/blogSecurity.ts and functions/src/BlogContentService.ts.
const DROPPED_ELEMENTS_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'form', 'button', 'textarea', 'select', 'noscript', 'noembed', 'noframes',
  'xmp', 'title', 'template', 'applet', 'frameset', 'svg', 'math',
]);
const DROPPED_TAGS = new Set(['embed', 'input', 'meta', 'link', 'base', 'frame', 'plaintext', 'param', 'keygen']);
const URL_ATTRIBUTES = new Set([
  'href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background', 'data', 'lowsrc', 'dynsrc', 'cite',
  'longdesc', 'ping', 'srcset', 'codebase', 'manifest',
]);
const DROPPED_ATTRIBUTES = new Set(['style', 'srcdoc']);
const TAG_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const ATTRIBUTE_NAME_PATTERN = /^[a-z_:][a-z0-9_:.-]*$/;
const UNSAFE_URL_PATTERN = /^(?:javascript|vbscript|data):/;

type HtmlAttribute = { name: string; value: string | null };
type HtmlTag = { name: string; attributes: HtmlAttribute[]; end: number };

function isHtmlWhitespace(character: string | undefined): boolean {
  return character === ' ' || character === '\t' || character === '\n' || character === '\f' || character === '\r';
}

function isAsciiLetter(character: string | undefined): boolean {
  return character !== undefined && /^[a-z]$/i.test(character);
}

/** Reads a tag from just after "<" (or "</") like the HTML tokenizer; null when the input ends inside the tag. */
function readHtmlTag(content: string, start: number): HtmlTag | null {
  let position = start;
  let name = '';
  while (position < content.length && !isHtmlWhitespace(content[position]) && content[position] !== '/' && content[position] !== '>') {
    name += content[position];
    position += 1;
  }
  const attributes: HtmlAttribute[] = [];
  while (position < content.length) {
    const character = content[position];
    if (isHtmlWhitespace(character) || character === '/') {
      position += 1;
      continue;
    }
    if (character === '>') return { name: name.toLowerCase(), attributes, end: position + 1 };
    let attributeName = character;
    position += 1;
    while (position < content.length && !isHtmlWhitespace(content[position]) && content[position] !== '/' && content[position] !== '>' && content[position] !== '=') {
      attributeName += content[position];
      position += 1;
    }
    while (isHtmlWhitespace(content[position])) position += 1;
    if (content[position] !== '=') {
      attributes.push({ name: attributeName.toLowerCase(), value: null });
      continue;
    }
    position += 1;
    while (isHtmlWhitespace(content[position])) position += 1;
    const quote = content[position];
    if (quote === '"' || quote === "'") {
      const closingQuote = content.indexOf(quote, position + 1);
      if (closingQuote === -1) return null;
      attributes.push({ name: attributeName.toLowerCase(), value: content.slice(position + 1, closingQuote) });
      position = closingQuote + 1;
      continue;
    }
    let value = '';
    while (position < content.length && !isHtmlWhitespace(content[position]) && content[position] !== '>') {
      value += content[position];
      position += 1;
    }
    attributes.push({ name: attributeName.toLowerCase(), value });
  }
  return null;
}

function decodeCodePoint(value: number): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
}

/** The URL as the browser resolves it: character references decoded, control characters and whitespace removed. */
function normalizeUrlForCheck(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_match, hex: string) => decodeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_match, decimal: string) => decodeCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;|&newline;/gi, '')
    .replace(/[\u0000- \u007f-\u009f]/g, '')
    .toLowerCase();
}

function isAllowedAttribute(attribute: HtmlAttribute): boolean {
  if (!ATTRIBUTE_NAME_PATTERN.test(attribute.name) || attribute.name.startsWith('on') || DROPPED_ATTRIBUTES.has(attribute.name)) return false;
  return !(URL_ATTRIBUTES.has(attribute.name) && attribute.value !== null && UNSAFE_URL_PATTERN.test(normalizeUrlForCheck(attribute.value)));
}

function serializeAttributes(attributes: HtmlAttribute[]): string {
  return attributes
    .filter(isAllowedAttribute)
    .map((attribute) => (attribute.value === null ? ` ${attribute.name}` : ` ${attribute.name}="${attribute.value.replace(/"/g, '&quot;')}"`))
    .join('');
}

/** Index just past the end of a dropped element's content ("</name ...>"), or the end of the input. */
function skipElementContent(content: string, tagName: string, position: number): number {
  const closingPattern = new RegExp(`</${tagName}`, 'gi');
  closingPattern.lastIndex = position;
  const closing = closingPattern.exec(content);
  if (!closing) return content.length;
  const end = content.indexOf('>', closing.index);
  return end === -1 ? content.length : end + 1;
}

function skipComment(content: string, bodyStart: number): number {
  if (content.startsWith('>', bodyStart)) return bodyStart + 1;
  if (content.startsWith('->', bodyStart)) return bodyStart + 2;
  const endPattern = /--!?>/g;
  endPattern.lastIndex = bodyStart;
  const end = endPattern.exec(content);
  return end ? end.index + end[0].length : content.length;
}

function sanitizeBlogHtml(content: string): string {
  if (!content) return '';

  let output = '';
  let position = 0;
  while (position < content.length) {
    const tagStart = content.indexOf('<', position);
    if (tagStart === -1) {
      output += content.slice(position);
      break;
    }
    output += content.slice(position, tagStart);
    const next = content[tagStart + 1];
    if (isAsciiLetter(next)) {
      const tag = readHtmlTag(content, tagStart + 1);
      // A tag cut off by the end of the input is dropped by browsers, together with the rest.
      if (!tag) break;
      position = tag.end;
      if (DROPPED_ELEMENTS_WITH_CONTENT.has(tag.name)) position = skipElementContent(content, tag.name, position);
      else if (!DROPPED_TAGS.has(tag.name) && TAG_NAME_PATTERN.test(tag.name)) output += `<${tag.name}${serializeAttributes(tag.attributes)}>`;
      continue;
    }
    if (next === '/' && isAsciiLetter(content[tagStart + 2])) {
      const tag = readHtmlTag(content, tagStart + 2);
      if (!tag) break;
      position = tag.end;
      if (!DROPPED_ELEMENTS_WITH_CONTENT.has(tag.name) && !DROPPED_TAGS.has(tag.name) && TAG_NAME_PATTERN.test(tag.name)) output += `</${tag.name}>`;
      continue;
    }
    if (content.startsWith('<!--', tagStart)) {
      position = skipComment(content, tagStart + 4);
      continue;
    }
    if (next === '!' || next === '?' || next === '/') {
      if (next === '/' && tagStart + 2 === content.length) {
        output += '&lt;/';
        position = content.length;
        continue;
      }
      // Bogus comments (<!...>, <?...>, </...>) run to the next ">".
      const end = content.indexOf('>', tagStart + 2);
      position = end === -1 ? content.length : end + 1;
      continue;
    }
    output += '&lt;';
    position = tagStart + 1;
  }
  return output;
}

export class BlogContentService {
  private static instance: BlogContentService;

  private constructor() {}

  public static getInstance(): BlogContentService {
    if (!BlogContentService.instance) BlogContentService.instance = new BlogContentService();
    return BlogContentService.instance;
  }

  public sanitizeHtml(content: string): string {
    return sanitizeBlogHtml(content);
  }

  /** Plain text without tags or repeated whitespace, cut to maximumLength without splitting an emoji. */
  public plainText(value: string, maximumLength: number): string {
    const text = value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length <= maximumLength) return text;
    const cut = text.slice(0, maximumLength);
    return (/[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut).trim();
  }

  /** True when the HTML has visible text (an empty paragraph is not content). */
  public hasText(content: string): boolean {
    return content.replace(/<[^>]*>/g, '').trim().length > 0;
  }

  /** Minutes to read at 200 words a minute, at least one. */
  public readTime(content: string): number {
    return Math.max(1, Math.ceil(content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length / 200));
  }

  public isSafeExternalUrl(value: string): boolean {
    return !value || /^https?:\/\/\S+$/i.test(value.trim());
  }
}

export const blogContentService = BlogContentService.getInstance();

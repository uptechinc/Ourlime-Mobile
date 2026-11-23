import { describe, expect, test } from 'bun:test';

const { blogContentService } = await import('./BlogContentService.ts');
const { blogAuthorizationService } = await import('./BlogAuthorizationService.ts');

/** True when a real tag in the sanitized HTML could still run script. */
const looksExecutable = (html) => (html.match(/<[^>]*>?/g) ?? []).some((tag) => {
  const attributeNames = tag.replace(/"[^"]*"/g, '""');
  return /^<\/?(script|iframe|svg|math|object|embed|form|base|meta|link|style|noscript|title)\b|srcdoc|[\s/"']on[a-z]+\s*=/i.test(attributeNames)
    || /javascript:|vbscript:|data:text/i.test(tag);
});

describe('BlogContentService.sanitizeHtml', () => {
  test('removes script vectors the old pattern-based copy let through', () => {
    for (const attack of [
      '<img/onerror=alert(1) src=x>',
      '<img src="x"onerror="alert(1)">',
      '<a href=javascript:alert(1)>link</a>',
      '<a href="&#106;avascript:alert(1)">link</a>',
      '<a href="jav&#x09;ascript:alert(1)">link</a>',
      '<scr<script></script>ipt>alert(1)</script>',
      '<svg><a xlink:href="javascript:alert(1)">x</a></svg>',
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
      '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
      '<details open ontoggle=alert(1)>',
      '<div style="background:url(javascript:alert(1))">x</div>',
    ]) {
      expect({ attack, executable: looksExecutable(blogContentService.sanitizeHtml(attack)) }).toEqual({ attack, executable: false });
    }
  });

  test('keeps the formatting the blog renderer understands', () => {
    const html = '<h2>Title</h2><p>Some <strong>bold</strong> and <a href="https://ourlime.com">a link</a>.</p><ul><li>One</li></ul><img src="https://cdn.example/a.jpg" alt="A">';
    expect(blogContentService.sanitizeHtml(html)).toBe(html);
    expect(blogContentService.sanitizeHtml('')).toBe('');
    expect(blogContentService.sanitizeHtml('1 < 2')).toBe('1 &lt; 2');
    expect(blogContentService.sanitizeHtml('<p>日本語 😀</p>')).toBe('<p>日本語 😀</p>');
  });
});

describe('BlogContentService text rules', () => {
  test('plain text strips tags, collapses spaces and never splits an emoji', () => {
    expect(blogContentService.plainText('  <b>Hello</b>\n  world ', 100)).toBe('Hello world');
    expect(blogContentService.plainText('ab😀', 3)).toBe('ab');
    expect(blogContentService.plainText('<i></i>', 10)).toBe('');
  });

  test('markup alone is not content', () => {
    expect(blogContentService.hasText('<p></p>')).toBe(false);
    expect(blogContentService.hasText('<p>x</p>')).toBe(true);
  });

  test('read time is one minute per 200 words, at least one', () => {
    const words = (count) => `<p>${Array.from({ length: count }, () => 'word').join(' ')}</p>`;
    expect(blogContentService.readTime('')).toBe(1);
    expect(blogContentService.readTime(words(200))).toBe(1);
    expect(blogContentService.readTime(words(201))).toBe(2);
  });

  test('only http and https source links are allowed', () => {
    expect(blogContentService.isSafeExternalUrl('')).toBe(true);
    expect(blogContentService.isSafeExternalUrl(' https://example.com ')).toBe(true);
    expect(blogContentService.isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(blogContentService.isSafeExternalUrl('https://exa mple.com')).toBe(false);
  });
});

describe('BlogAuthorizationService', () => {
  test('either verification field marks the author verified', () => {
    expect(blogAuthorizationService.isIdentityVerified({ identityVerificationStatus: 'verified' })).toBe(true);
    expect(blogAuthorizationService.isIdentityVerified({ verificationStatus: 'verified' })).toBe(true);
    expect(blogAuthorizationService.isIdentityVerified({ identityVerificationStatus: 'pending' })).toBe(false);
    expect(blogAuthorizationService.isIdentityVerified({})).toBe(false);
  });
});

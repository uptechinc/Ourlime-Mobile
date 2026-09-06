/**
 * Ensures that media URLs originating from Firebase Storage contain
 * the `?alt=media` parameter required to fetch actual media binary content
 * rather than JSON object metadata.
 */
export function ensureMediaUrl(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.includes('firebasestorage.googleapis.com') && !trimmed.includes('alt=media')) {
    const separator = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${separator}alt=media`;
  }
  return trimmed;
}

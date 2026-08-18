/**
 * Extract a YouTube video ID from common URL formats. Returns null if not YouTube.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('?')[0];
      if (id && id.length === 11) return id;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v');
        if (id && id.length === 11) return id;
      }
      const pathMatch = parsed.pathname.match(/^\/(shorts|embed|v|live)\/([a-zA-Z0-9_-]{11})/);
      if (pathMatch) return pathMatch[2];
    }

    return null;
  } catch {
    return null;
  }
}

// Media URLs that already failed to load this session, so lists don't download a broken link on every scroll.
const failedUrls = new Set<string>();

export const failedMediaUrls = {
  has: (url: string | null | undefined): boolean => Boolean(url && failedUrls.has(url)),
  add: (url: string | null | undefined): void => {
    if (url) failedUrls.add(url);
  },
};

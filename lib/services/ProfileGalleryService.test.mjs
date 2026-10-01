import { describe, expect, test } from 'bun:test';
import { profileGalleryService } from './ProfileGalleryService.ts';

describe('ProfileGalleryService', () => {
  test('selects authored image and video media while excluding unsupported files', () => {
    const posts = [
      {
        media: [
          { id: 'image-1', type: 'image', typeUrl: 'https://example.com/image.jpg' },
          { id: 'video-1', type: 'video', typeUrl: 'https://example.com/video.mp4' },
          { id: 'document-1', type: 'document', typeUrl: 'https://example.com/file.pdf' },
        ],
      },
    ];

    const media = profileGalleryService.selectGalleryMedia(posts);

    expect(media.map((mediaItem) => mediaItem.id)).toEqual(['image-1', 'video-1']);
  });

  test('deduplicates media by id and falls back to type plus URL identity', () => {
    const posts = [
      { media: [{ id: 'shared', type: 'image', typeUrl: 'https://example.com/a.jpg' }] },
      {
        media: [
          { id: 'shared', type: 'image', typeUrl: 'https://example.com/a-copy.jpg' },
          { id: '', type: 'video', typeUrl: 'https://example.com/b.mp4' },
          { id: '', type: 'video', typeUrl: 'https://example.com/b.mp4' },
        ],
      },
    ];

    const media = profileGalleryService.selectGalleryMedia(posts);

    expect(media).toHaveLength(2);
    expect(media[0].typeUrl).toBe('https://example.com/a.jpg');
    expect(media[1].typeUrl).toBe('https://example.com/b.mp4');
  });
});

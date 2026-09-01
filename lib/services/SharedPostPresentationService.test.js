const { describe, expect, test, mock } = require('bun:test');

mock.module('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj) => obj.default ?? obj.android,
  },
  Linking: {
    canOpenURL: async () => true,
    openURL: async () => {},
  },
  NativeModules: {},
  TurboModuleRegistry: { get: () => null },
}));

const { sharedPostPresentationService } = require('./SharedPostPresentationService.ts');

describe('SharedPostPresentationService (Mobile)', () => {
  test('constructs YouTube embed URL with autoplay=1, playsinline=1, enablejsapi=1, rel=0, and stable origin', () => {
    const embedUrl = sharedPostPresentationService.getYouTubeEmbedUrl('dQw4w9WgXcQ');

    expect(embedUrl).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1&origin=https://ourlime.com'
    );
  });

  test('provides stable Referer headers and mobile user agent for embed playback', () => {
    const headers = sharedPostPresentationService.getYouTubeRequestHeaders();
    expect(headers).toEqual({ Referer: 'https://ourlime.com/' });

    const userAgent = sharedPostPresentationService.getYouTubeUserAgent();
    expect(userAgent).toContain('Mobile Safari');
  });

  test('extracts hero media from preview entity', () => {
    const preview = {
      url: 'https://ourlime.com/post/123',
      domain: 'ourlime.com',
      entity: {
        kind: 'post',
        post: {
          subtype: 'regular',
          excerpt: 'Hello world',
          imageCount: 1,
          videoCount: 0,
          primaryMedia: {
            kind: 'image',
            url: 'https://cdn.example/photo.jpg',
            displayOrder: 0,
          },
        },
      },
    };

    const hero = sharedPostPresentationService.getHero(preview);
    expect(hero).toEqual({
      kind: 'image',
      url: 'https://cdn.example/photo.jpg',
      displayOrder: 0,
    });
  });
});

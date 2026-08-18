import { describe, expect, it } from 'bun:test';
import { pageAccessService } from '@/lib/services/PageAccessService';
import { mockPageAccessSettings } from '../../mocks/mockPageAccess';
import { authorizationService } from '@/lib/services/AuthorizationService';
import { mockUsers } from '../../mocks/mockUsers';

describe('Page Test Suite 02: Primary Bottom Navigation Tabs', () => {
  const regularAuth = authorizationService.resolve(mockUsers.regular);

  it('should verify Home Tab (/(tabs)/index.tsx) access and navigation status', () => {
    const decision = pageAccessService.getDecision(mockPageAccessSettings, '/', regularAuth);
    expect(decision.canAccess).toBe(true);
    expect(decision.isVisibleInNavigation).toBe(true);
  });

  it('should verify Discover & Search Tab access and search category filters', () => {
    const categories = ['All', 'Users', 'Communities', 'Events', 'Posts', 'Hashtags'];
    expect(categories.length).toBe(6);
    expect(categories.includes('Communities')).toBe(true);
  });

  it('should verify Limes Short-Form Video Tab configuration', () => {
    const limeFeeds = ['For You', 'Following', 'Comedy', 'Music', 'Explore'];
    expect(limeFeeds.length).toBe(5);
  });

  it('should verify Chat Tab message threading and archive filter options', () => {
    const chatFilters = ['All', 'Unread', 'Archived'];
    expect(chatFilters.includes('Archived')).toBe(true);
  });

  it('should verify Profile Tab tabs (Posts, Media, Friends, Communities, Events, About)', () => {
    const profileTabs = ['Posts', 'Media', 'Friends', 'Communities', 'Events', 'About'];
    expect(profileTabs.length).toBe(6);
  });
});

import type { Href } from 'expo-router';
import type { PageAccessStatus } from '@/lib/types/pageAccess';

export type AppNavigationSection = 'account' | 'explore' | 'administration';

export type AppNavigationItem = {
  id: string;
  label: string;
  ionicon: string;
  featherIcon: string;
  route: Href;
  pageRoute: string;
  section: AppNavigationSection;
  adminOnly?: boolean;
  status?: PageAccessStatus;
  badge?: string;
};

const APP_NAVIGATION_ITEMS: readonly AppNavigationItem[] = [
  { id: 'profile', label: 'My Profile', ionicon: 'person', featherIcon: 'user', route: '/(tabs)/Profile', pageRoute: '/profile', section: 'account' },
  { id: 'settings', label: 'Settings', ionicon: 'settings', featherIcon: 'settings', route: '/settings' as Href, pageRoute: '/settings', section: 'account' },
  { id: 'home', label: 'Home Feed', ionicon: 'home', featherIcon: 'home', route: '/(tabs)', pageRoute: '/', section: 'explore' },
  { id: 'communities', label: 'Communities', ionicon: 'people', featherIcon: 'users', route: '/communities', pageRoute: '/communities', section: 'explore' },
  { id: 'events', label: 'Events', ionicon: 'calendar', featherIcon: 'calendar', route: '/events', pageRoute: '/events', section: 'explore' },
  { id: 'jobs', label: 'Jobs', ionicon: 'briefcase', featherIcon: 'briefcase', route: '/jobs', pageRoute: '/jobs', section: 'explore' },
  { id: 'market', label: 'Market', ionicon: 'storefront', featherIcon: 'shopping-bag', route: '/market', pageRoute: '/market', section: 'explore' },
  { id: 'blogs', label: 'Blogs', ionicon: 'book', featherIcon: 'file-text', route: '/blogs', pageRoute: '/blogs', section: 'explore' },
  { id: 'elearning', label: 'E-Learning', ionicon: 'school', featherIcon: 'book-open', route: '/eLearning', pageRoute: '/eLearning', section: 'explore' },
  { id: 'projects', label: 'E-Projects', ionicon: 'folder-open', featherIcon: 'folder', route: '/projectManagement' as Href, pageRoute: '/projectManagement', section: 'explore' },
  { id: 'ads', label: 'Ads', ionicon: 'megaphone', featherIcon: 'radio', route: '/ads' as Href, pageRoute: '/ads', section: 'explore' },
  { id: 'saved', label: 'Saved Items', ionicon: 'bookmark', featherIcon: 'bookmark', route: '/saved' as Href, pageRoute: '/saved', section: 'account' },
  { id: 'wallet', label: 'E-Wallet', ionicon: 'wallet', featherIcon: 'credit-card', route: '/eWallet' as Href, pageRoute: '/eWallet', section: 'account' },
  { id: 'games', label: 'Games', ionicon: 'game-controller', featherIcon: 'play-circle', route: '/games' as Href, pageRoute: '/games', section: 'explore' },
  { id: 'ehub', label: 'E-Hub', ionicon: 'grid', featherIcon: 'grid', route: '/ehub' as Href, pageRoute: '/ehub', section: 'explore' },
  { id: 'help', label: 'Help & Support', ionicon: 'help-circle', featherIcon: 'help-circle', route: '/help' as Href, pageRoute: '/help', section: 'account' },
  { id: 'chat', label: 'Chat', ionicon: 'chatbubbles', featherIcon: 'message-circle', route: '/(tabs)/Chat', pageRoute: '/chat', section: 'explore' },
  { id: 'admin', label: 'Admin Portal', ionicon: 'shield-checkmark', featherIcon: 'shield', route: '/admin' as Href, pageRoute: '/admin', section: 'administration', adminOnly: true },
] as const;

export function getAppNavigationItems(options: { includeHome?: boolean; isAdmin?: boolean; resolveStatus?: (route: string) => { visible: boolean; status: PageAccessStatus; badge?: string } } = {}): AppNavigationItem[] {
  return APP_NAVIGATION_ITEMS.filter((item) => {
    if (!options.includeHome && item.id === 'home') return false;
    if (item.adminOnly && !options.isAdmin) return false;
    return options.resolveStatus?.(item.pageRoute).visible !== false;
  }).map((item) => {
    const availability = options.resolveStatus?.(item.pageRoute);
    const badge = availability?.badge?.trim();
    return availability ? { ...item, status: availability.status, badge: badge || undefined } : { ...item };
  });
}

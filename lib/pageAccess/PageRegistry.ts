import type { PageAccessSetting, PageRegistryEntry } from '@/lib/types/pageAccess';

export const MOBILE_PAGE_REGISTRY: readonly PageRegistryEntry[] = [
  { id: 'system', name: 'Entire Ourlime System', route: '*', description: 'Global availability override for the app', defaultStatus: 'enabled', showInNavigation: false },
  { id: 'home', name: 'Home', route: '/', description: 'Main Ourlime feed', defaultStatus: 'enabled' },
  { id: 'discover', name: 'Discover', route: '/discover', description: 'People and content discovery', defaultStatus: 'enabled' },
  { id: 'communities', name: 'Communities', route: '/communities', description: 'Community discussions and groups', defaultStatus: 'enabled' },
  { id: 'limes', name: 'Limes', route: '/limes', description: 'Short-form social video', defaultStatus: 'enabled' },
  { id: 'messages', name: 'Messages', route: '/chat', description: 'Private chats and messaging', defaultStatus: 'enabled' },
  { id: 'profile', name: 'Profile', route: '/profile', description: 'Profiles and profile settings', defaultStatus: 'enabled' },
  { id: 'profile-settings', name: 'Profile Settings', route: '/settings', description: 'Account and profile settings', defaultStatus: 'enabled' },
  { id: 'notifications', name: 'Notifications', route: '/notifications', description: 'User notifications and alerts', defaultStatus: 'enabled', showInNavigation: false },
  { id: 'post-details', name: 'Post Details', route: '/post', description: 'Post permalinks', defaultStatus: 'enabled', showInNavigation: false },
  { id: 'events', name: 'Events', route: '/events', description: 'Events and meetups', defaultStatus: 'coming_soon' },
  { id: 'jobs', name: 'Jobs', route: '/jobs', description: 'Jobs and opportunities', defaultStatus: 'coming_soon' },
  { id: 'marketplace', name: 'Marketplace', route: '/market', description: 'Products and marketplace', defaultStatus: 'coming_soon' },
  { id: 'blogs', name: 'Blogs', route: '/blogs', description: 'Blogs and articles', defaultStatus: 'coming_soon' },
  { id: 'elearning', name: 'E-Learning', route: '/eLearning', description: 'Courses and learning', defaultStatus: 'coming_soon' },
  { id: 'projects', name: 'E-Projects', route: '/projectManagement', description: 'Project management', defaultStatus: 'coming_soon' },
  { id: 'ads', name: 'Ads', route: '/ads', description: 'Advertising and promotions', defaultStatus: 'coming_soon' },
  { id: 'ads-create', name: 'Create Ad', route: '/ads/create', description: 'Create and launch advertising campaigns', defaultStatus: 'coming_soon', showInNavigation: false },
  { id: 'ads-manage', name: 'Manage Ads', route: '/ads/manage', description: 'View and manage advertising campaigns', defaultStatus: 'coming_soon', showInNavigation: false },
  { id: 'saved-items', name: 'Saved Items', route: '/saved', description: 'Saved content', defaultStatus: 'coming_soon' },
  { id: 'ewallet', name: 'E-Wallet', route: '/eWallet', description: 'Wallet and payments', defaultStatus: 'coming_soon' },
  { id: 'games', name: 'Games', route: '/games', description: 'Ourlime games', defaultStatus: 'coming_soon' },
  { id: 'ehub', name: 'E-Hub', route: '/ehub', description: 'Central hub for Ourlime features', defaultStatus: 'coming_soon' },
  { id: 'geoguesser', name: 'GeoGuesser', route: '/triniGeoGuesser', description: 'Trinidad GeoGuesser game', defaultStatus: 'coming_soon', showInNavigation: false },
  { id: 'wordle', name: 'Wordle', route: '/wordle-game', description: 'Ourlime word game', defaultStatus: 'coming_soon', showInNavigation: false },
  { id: 'help-support', name: 'Help & Support', route: '/help', description: 'Help and support', defaultStatus: 'coming_soon' },
  { id: 'admin', name: 'Admin Portal', route: '/admin', description: 'Administration and management', defaultStatus: 'admin_only' },
  { id: 'admin-dashboard', name: 'Admin Dashboard', route: '/admin/dashboard', description: 'Administration overview', defaultStatus: 'admin_only', showInNavigation: false },
  { id: 'admin-analytics', name: 'Admin Analytics', route: '/admin/analytics', description: 'Platform analytics dashboard', defaultStatus: 'admin_only', showInNavigation: false },
  { id: 'admin-testers', name: 'Admin Testers', route: '/admin/testers', description: 'Beta applications and tester management', defaultStatus: 'admin_only', showInNavigation: false },
  { id: 'admin-page-access', name: 'Admin Page Access', route: '/admin/page-access', description: 'Page availability controls', defaultStatus: 'admin_only', showInNavigation: false },
  { id: 'admin-user-management', name: 'Admin User Management', route: '/admin/user-management', description: 'User account and role management', defaultStatus: 'admin_only', showInNavigation: false },
  { id: 'admin-moderation', name: 'Admin Content Moderation', route: '/admin/moderation', description: 'Content moderation workspace', defaultStatus: 'admin_only', showInNavigation: false },
  { id: 'admin-reports', name: 'Admin Reports', route: '/admin/reports', description: 'Reported-content review workspace', defaultStatus: 'admin_only', showInNavigation: false },
  { id: 'admin-products', name: 'Admin Products', route: '/admin/products', description: 'Marketplace product review', defaultStatus: 'admin_only', showInNavigation: false },
  { id: 'admin-communities', name: 'Admin Communities', route: '/admin/communities', description: 'Community administration', defaultStatus: 'admin_only', showInNavigation: false },
  { id: 'admin-categories', name: 'Admin Categories', route: '/admin/categories', description: 'Marketplace category administration', defaultStatus: 'admin_only', showInNavigation: false },
  { id: 'admin-community-categories', name: 'Admin Community Categories', route: '/admin/community-categories', description: 'Community category administration', defaultStatus: 'admin_only', showInNavigation: false },
  { id: 'admin-stickers', name: 'Admin Stickers', route: '/admin/stickers', description: 'Sticker pack administration', defaultStatus: 'admin_only', showInNavigation: false },
] as const;

const BADGE_TEXT: Record<PageAccessSetting['status'], string> = {
  enabled: '',
  coming_soon: 'Coming Soon',
  maintenance: 'Maintenance',
  beta_only: 'Beta',
  developer_only: 'Developer Only',
  admin_only: 'Admin Only',
  disabled: 'Unavailable',
};

export function getDefaultMobilePageSettings(): PageAccessSetting[] {
  return MOBILE_PAGE_REGISTRY.map((entry, order) => ({
    id: entry.id,
    pageName: entry.name,
    route: entry.route,
    description: entry.description,
    status: entry.defaultStatus,
    showInNavigation: entry.showInNavigation ?? true,
    showPagePreview: entry.defaultStatus !== 'disabled',
    badgeText: BADGE_TEXT[entry.defaultStatus],
    updatedBy: 'system',
    updatedAt: null,
    order,
  }));
}

export function getPageAccessBadge(status: PageAccessSetting['status']): string {
  return BADGE_TEXT[status];
}

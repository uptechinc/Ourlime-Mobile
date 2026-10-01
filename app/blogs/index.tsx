import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft, PenSquare, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import CreateBlogModal from '@/components/blogs/CreateBlogModal';
import BlogListCard from '@/components/blog/BlogListCard';
import IdentityVerificationModal from '@/components/jobs/IdentityVerificationModal';
import CustomModal from '@/components/ui/CustomModal';
import ShareContentSheet from '@/components/sharing/ShareContentSheet';
import { BlogCatalogSkeleton } from '@/components/ui/Skeleton';
import { BlogsAndArticlesService } from '@/lib/blogs&articles/BlogsAndArticlesService';
import { DEFAULT_BLOG_QUERY } from '@/lib/services/BlogCatalogResourceService';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { deepLinkService } from '@/lib/services/DeepLinkService';
import { useBlogCatalog } from '@/lib/hooks/useBlogCatalog';
import type { BlogListItem, BlogListQuery, BlogSortOption, BlogTypeFilter } from '@/lib/types/blog';

// Kept identical to Ourlime-Web app/blogs/page.tsx.
const CATEGORIES = ['Saved', 'All', 'Technology', 'Wellness', 'Marketing', 'Finance', 'Health', 'Business', 'Lifestyle', 'Education', 'Travel'];
const POPULAR_TAGS = ['Technology', 'Wellness', 'Sustainability', 'Marketing', 'Finance', 'Productivity', 'Innovation', 'Mental Health', 'Remote Work', 'Artificial Intelligence'];
const SORT_OPTIONS: { value: BlogSortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'most_liked', label: 'Most Liked' },
  { value: 'most_commented', label: 'Most Commented' },
  { value: 'trending', label: 'Trending' },
];
const TYPE_OPTIONS: { value: BlogTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'blog', label: 'Blogs' },
  { value: 'article', label: 'Articles' },
];

type NoticeState = { title: string; message: string } | null;

const blogService = BlogsAndArticlesService.getInstance();
const authService = AuthService.getInstance();

function isIdentityVerified(profile: UserProfile | null): boolean {
  return profile?.identityVerificationStatus === 'verified' || profile?.verificationStatus === 'verified';
}

export default function BlogsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { activeUserId } = useAppData();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState<BlogListQuery>(DEFAULT_BLOG_QUERY);
  const catalog = useBlogCatalog(activeUserId ?? 'guest', query);
  const blogs = useMemo(() => catalog.data?.items ?? [], [catalog.data?.items]);
  const total = catalog.data?.total ?? 0;
  const availableTags = catalog.data?.popularTags.length ? catalog.data.popularTags : POPULAR_TAGS;

  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [likeCounts, setLikeCounts] = useState<Map<string, number>>(() => new Map());
  const fetchedInteractionIds = useRef(new Set<string>());
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [shareBlog, setShareBlog] = useState<BlogListItem | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  // Server-side search; debounced so typing does not issue a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery((current) => (current.search === searchInput ? current : { ...current, search: searchInput })), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset per-user interaction state when the account changes.
  useEffect(() => {
    fetchedInteractionIds.current.clear();
    setLikedIds(new Set());
    setSavedIds(new Set());
    setProfile(null);
  }, [activeUserId]);

  // Web loads GET /interactions per card to render liked/saved state.
  useEffect(() => {
    if (!activeUserId) return;
    const pending = blogs.filter((blog) => !fetchedInteractionIds.current.has(blog.id));
    if (pending.length === 0) return;
    pending.forEach((blog) => fetchedInteractionIds.current.add(blog.id));
    void Promise.all(pending.map((blog) => blogService.getInteractions(blog.id).then((state) => ({ id: blog.id, ...state })).catch(() => null)))
      .then((results) => {
        setLikedIds((current) => { const next = new Set(current); results.forEach((result) => { if (result?.isLiked) next.add(result.id); }); return next; });
        setSavedIds((current) => { const next = new Set(current); results.forEach((result) => { if (result?.isSaved) next.add(result.id); }); return next; });
      });
  }, [activeUserId, blogs]);

  const updateQuery = (patch: Partial<BlogListQuery>) => setQuery((current) => ({ ...current, ...patch }));

  const requireSignIn = (message: string): boolean => {
    if (activeUserId) return true;
    setNotice({ title: 'Sign in required', message });
    return false;
  };

  const handleSelectCategory = (category: string) => {
    if (category === 'Saved' && !requireSignIn('Please sign in to view your saved blogs.')) return;
    updateQuery({ category });
  };

  const toggleTag = (tag: string) => {
    updateQuery({ tags: query.tags.includes(tag) ? query.tags.filter((existing) => existing !== tag) : [...query.tags, tag] });
  };

  const clearAllFilters = () => {
    setSearchInput('');
    setQuery(DEFAULT_BLOG_QUERY);
  };

  const handleToggleLike = async (blog: BlogListItem) => {
    if (!requireSignIn('Please sign in to like blogs.')) return;
    const wasLiked = likedIds.has(blog.id);
    const previousCount = likeCounts.get(blog.id) ?? blog.likesCount;
    setLikedIds((current) => { const next = new Set(current); if (wasLiked) next.delete(blog.id); else next.add(blog.id); return next; });
    setLikeCounts((current) => new Map(current).set(blog.id, Math.max(0, previousCount + (wasLiked ? -1 : 1))));
    try {
      await blogService.updateInteraction(blog.id, 'like', !wasLiked);
    } catch {
      setLikedIds((current) => { const next = new Set(current); if (wasLiked) next.add(blog.id); else next.delete(blog.id); return next; });
      setLikeCounts((current) => new Map(current).set(blog.id, previousCount));
      setNotice({ title: 'Like not saved', message: 'Could not update your like.' });
    }
  };

  const handleToggleSave = async (blog: BlogListItem) => {
    if (!requireSignIn('Please sign in to save blogs.')) return;
    const wasSaved = savedIds.has(blog.id);
    setSavedIds((current) => { const next = new Set(current); if (wasSaved) next.delete(blog.id); else next.add(blog.id); return next; });
    try {
      await blogService.updateInteraction(blog.id, 'save', !wasSaved);
      if (query.category === 'Saved' && wasSaved) void catalog.refresh();
    } catch {
      setSavedIds((current) => { const next = new Set(current); if (wasSaved) next.add(blog.id); else next.delete(blog.id); return next; });
      setNotice({ title: 'Bookmark not saved', message: 'Could not update your bookmark.' });
    }
  };

  // Web handleCreateBlogClick: login → suspended → identity verification → editor.
  const handleWritePress = async () => {
    if (!activeUserId) {
      setNotice({ title: 'Sign in required', message: 'Please login to create a blog post.' });
      return;
    }
    setIsCheckingAccess(true);
    try {
      const currentProfile = await authService.getUserProfile(activeUserId, true);
      setProfile(currentProfile);
      if (currentProfile?.blogPublishingSuspended) {
        setNotice({ title: 'Publishing suspended', message: 'Your blog publishing privileges have been suspended by moderation.' });
        return;
      }
      if (!isIdentityVerified(currentProfile)) {
        setIsVerificationModalOpen(true);
        return;
      }
      setIsCreateModalOpen(true);
    } catch {
      setNotice({ title: 'Try again', message: 'Your profile could not be loaded. Please retry.' });
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const handleOpenBlog = useCallback((blog: BlogListItem) => {
    blogService.cachePost(blog);
    router.push({ pathname: '/blogs/[id]', params: { id: blog.id } });
  }, [router]);

  const hasActiveFilters = query.search.trim() !== '' || query.category !== 'All' || query.tags.length > 0 || query.type !== 'all' || query.sort !== 'newest';
  const resultsLabel = total > 0
    ? `${total} ${query.type !== 'all' ? `${query.type}${total !== 1 ? 's' : ''}` : `blog${total !== 1 ? 's' : ''}`}${query.search ? ` for '${query.search}'` : ''}${query.tags.length ? ` tagged ${query.tags.join(', ')}` : ''}${query.category !== 'All' ? ` in ${query.category}` : ''} found`
    : 'No blogs found matching your filters';
  const isInitialLoading = !catalog.data && (catalog.status === 'idle' || catalog.status === 'hydrating' || catalog.status === 'refreshing');
  const chipIdle = { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', borderColor: colors.border };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.canvas }]}>
      <View style={[styles.headerBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(tabs)'))} style={styles.headerIconButton} accessibilityLabel="Go back">
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Blogs & Articles</Text>
        <TouchableOpacity activeOpacity={0.8} onPress={() => void handleWritePress()} disabled={isCheckingAccess} style={styles.writeButton} accessibilityLabel="Create Blog">
          {isCheckingAccess ? <ActivityIndicator size="small" color="#ffffff" /> : <PenSquare size={16} color="#ffffff" />}
          <Text style={styles.writeButtonText}>Write</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchFilterRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', borderColor: colors.border }]}>
          <Search size={16} color={colors.secondaryText} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search blogs, topics, authors…"
            placeholderTextColor={colors.secondaryText}
            value={searchInput}
            onChangeText={setSearchInput}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searchInput ? (
            <TouchableOpacity onPress={() => setSearchInput('')} hitSlop={8}><X size={16} color={colors.secondaryText} /></TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => setIsFilterSheetOpen(true)}
          style={[styles.filterIconButton, { backgroundColor: query.sort !== 'newest' || query.type !== 'all' ? (isDark ? 'rgba(16,185,129,0.2)' : '#ecfdf5') : chipIdle.backgroundColor, borderColor: query.sort !== 'newest' || query.type !== 'all' ? '#10b981' : colors.border }]}
          accessibilityLabel="Sort and filter"
        >
          <SlidersHorizontal size={18} color={query.sort !== 'newest' || query.type !== 'all' ? '#10b981' : colors.secondaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={catalog.status === 'refreshing' && Boolean(catalog.data)} onRefresh={() => void catalog.refresh()} tintColor="#10b981" colors={['#10b981']} />}
      >
        {/* Content type */}
        <View style={[styles.segmented, { backgroundColor: chipIdle.backgroundColor, borderColor: colors.border }]}>
          {TYPE_OPTIONS.map((option) => {
            const isSelected = query.type === option.value;
            return (
              <Pressable key={option.value} onPress={() => updateQuery({ type: option.value })} style={[styles.segment, isSelected && styles.segmentActive]}>
                <Text style={[styles.segmentText, { color: isSelected ? '#ffffff' : colors.secondaryText }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CATEGORIES.map((category) => {
            const isSelected = query.category === category;
            return (
              <Pressable key={category} onPress={() => handleSelectCategory(category)} style={[styles.chip, isSelected ? styles.chipActive : chipIdle]}>
                <Text style={[styles.chipText, { color: isSelected ? '#ffffff' : colors.secondaryText }]}>{category}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Popular tags (multi-select, AND) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {availableTags.map((tag) => {
            const isSelected = query.tags.includes(tag);
            return (
              <Pressable key={tag} onPress={() => toggleTag(tag)} style={[styles.tagChip, isSelected ? styles.chipActive : chipIdle]}>
                <Text style={[styles.tagChipText, { color: isSelected ? '#ffffff' : colors.secondaryText }]}>#{tag}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Active filters */}
        {hasActiveFilters ? (
          <View style={styles.activeFilters}>
            {query.search.trim() ? <ActiveChip label={`"${query.search.trim()}"`} onRemove={() => setSearchInput('')} /> : null}
            {query.category !== 'All' ? <ActiveChip label={query.category} onRemove={() => updateQuery({ category: 'All' })} /> : null}
            {query.type !== 'all' ? <ActiveChip label={query.type === 'blog' ? 'Blogs' : 'Articles'} onRemove={() => updateQuery({ type: 'all' })} /> : null}
            {query.sort !== 'newest' ? <ActiveChip label={SORT_OPTIONS.find((option) => option.value === query.sort)?.label ?? query.sort} onRemove={() => updateQuery({ sort: 'newest' })} /> : null}
            {query.tags.map((tag) => <ActiveChip key={tag} label={`#${tag}`} onRemove={() => toggleTag(tag)} />)}
            <Pressable onPress={clearAllFilters} hitSlop={6}><Text style={styles.clearAll}>Clear all</Text></Pressable>
          </View>
        ) : null}

        {catalog.data ? <Text style={[styles.resultsText, { color: colors.secondaryText }]}>{resultsLabel}</Text> : null}

        {isInitialLoading ? (
          <BlogCatalogSkeleton />
        ) : catalog.status === 'error' && !catalog.data ? (
          <View style={[styles.errorBox, { backgroundColor: colors.destructiveSurface }]}>
            <Text style={{ color: colors.destructiveText, fontWeight: '700' }}>Failed to load blogs</Text>
            <TouchableOpacity onPress={() => void catalog.refresh()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Retry</Text></TouchableOpacity>
          </View>
        ) : blogs.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No blogs found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>Try adjusting your filters or search query</Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {blogs.map((blog) => (
              <BlogListCard
                key={blog.id}
                blog={blog}
                isLiked={likedIds.has(blog.id)}
                isSaved={savedIds.has(blog.id)}
                likesCount={likeCounts.get(blog.id) ?? blog.likesCount}
                onPress={() => handleOpenBlog(blog)}
                onLikePress={() => void handleToggleLike(blog)}
                onSavePress={() => void handleToggleSave(blog)}
                onSharePress={() => setShareBlog(blog)}
              />
            ))}
            {catalog.error && catalog.data ? <Text style={{ color: colors.destructive, textAlign: 'center' }}>{catalog.error.message}</Text> : null}
            {catalog.hasMore ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => void catalog.loadMore()} disabled={catalog.status === 'refreshing'} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{catalog.status === 'refreshing' ? 'Loading…' : 'Load more'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Sort & type sheet */}
      <Modal visible={isFilterSheetOpen} transparent animationType="fade" onRequestClose={() => setIsFilterSheetOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsFilterSheetOpen(false)}>
          <Pressable style={[styles.filterSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => undefined}>
            <View style={styles.filterSheetHeader}>
              <Text style={[styles.filterSheetTitle, { color: colors.text }]}>Sort & Filter</Text>
              <TouchableOpacity onPress={() => setIsFilterSheetOpen(false)} hitSlop={8}><X size={20} color={colors.secondaryText} /></TouchableOpacity>
            </View>
            <Text style={[styles.filterSectionLabel, { color: colors.secondaryText }]}>Sort By</Text>
            {SORT_OPTIONS.map((option) => {
              const isSelected = query.sort === option.value;
              return (
                <TouchableOpacity key={option.value} onPress={() => updateQuery({ sort: option.value })} style={[styles.sortRow, isSelected && { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5' }]}>
                  <Text style={[styles.sortRowText, { color: isSelected ? '#10b981' : colors.text, fontWeight: isSelected ? '700' : '500' }]}>{option.label}</Text>
                  {isSelected ? <Check size={18} color="#10b981" /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={() => setIsFilterSheetOpen(false)} style={[styles.primaryButton, { marginTop: 18 }]}>
              <Text style={styles.primaryButtonText}>Show Blogs</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <CreateBlogModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        userId={activeUserId ?? ''}
        onSuccess={() => void catalog.refresh()}
      />
      <IdentityVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        verificationStatus={profile?.identityVerificationStatus ?? profile?.verificationStatus}
        message="Identity verification is required to create or publish blogs."
      />
      {shareBlog ? (
        <ShareContentSheet
          visible
          currentUserId={activeUserId ?? ''}
          contentLabel="blog"
          title={shareBlog.title}
          message={`${shareBlog.title}\n\n${deepLinkService.getBlogShareUrl(shareBlog.id)}`}
          url={deepLinkService.getBlogShareUrl(shareBlog.id)}
          onClose={() => setShareBlog(null)}
        />
      ) : null}
      <CustomModal
        visible={notice !== null}
        type="info"
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
        confirmText={activeUserId ? 'OK' : 'Sign in'}
        cancelText={activeUserId ? undefined : 'Not now'}
        onConfirm={() => { setNotice(null); if (!activeUserId) router.push('/(auth)/login'); }}
        onCancel={() => setNotice(null)}
        onClose={() => setNotice(null)}
      />
    </SafeAreaView>
  );
}

type ActiveChipProps = { label: string; onRemove: () => void };

function ActiveChip({ label, onRemove }: ActiveChipProps) {
  return (
    <Pressable onPress={onRemove} style={styles.activeChip} accessibilityLabel={`Remove filter ${label}`}>
      <Text style={styles.activeChipText}>{label}</Text>
      <X size={12} color="#047857" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerIconButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  writeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, gap: 5 },
  writeButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  searchFilterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 40, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  filterIconButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  scrollContent: { paddingBottom: 100, paddingTop: 12 },
  segmented: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 12, borderWidth: 1, padding: 3 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  segmentActive: { backgroundColor: '#10b981' },
  segmentText: { fontSize: 13, fontWeight: '700' },
  chipRow: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  chip: { paddingHorizontal: 15, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  chipText: { fontSize: 13, fontWeight: '600' },
  tagChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  tagChipText: { fontSize: 12, fontWeight: '600' },
  activeFilters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#d1fae5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  activeChipText: { color: '#047857', fontSize: 12, fontWeight: '700' },
  clearAll: { color: '#10b981', fontSize: 12, fontWeight: '800' },
  resultsText: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, fontSize: 13 },
  feedList: { gap: 14, paddingHorizontal: 16, paddingTop: 10 },
  errorBox: { margin: 16, padding: 18, borderRadius: 16, alignItems: 'center', gap: 12 },
  emptyCard: { margin: 16, paddingVertical: 48, paddingHorizontal: 24, borderRadius: 24, borderWidth: 1, alignItems: 'center', gap: 6 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySubtitle: { fontSize: 13, textAlign: 'center' },
  primaryButton: { backgroundColor: '#10b981', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  filterSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36 },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  filterSheetTitle: { fontSize: 18, fontWeight: '800' },
  filterSectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  sortRowText: { fontSize: 14 },
});

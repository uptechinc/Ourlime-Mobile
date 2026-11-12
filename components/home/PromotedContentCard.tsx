import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Briefcase, ChevronLeft, ChevronRight, Sparkles, Target, Users } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import { Skeleton } from '@/components/ui/Skeleton';
import { promotedContentService, type PromotedContentItem } from '@/lib/services/PromotedContentService';

const ITEMS_PER_PAGE = 3;
const ITEM_GRADIENTS: [string, string][] = [
  ['#3b82f6', '#06b6d4'],
  ['#6366f1', '#a855f7'],
  ['#a855f7', '#ec4899'],
  ['#ec4899', '#f43f5e'],
  ['#f97316', '#ef4444'],
  ['#06b6d4', '#3b82f6'],
];

type PromotedItemRowProps = {
  item: PromotedContentItem;
  gradient: [string, string];
  onPress: () => void;
};

function PromotedItemRow({ item, gradient, onPress }: PromotedItemRowProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const CategoryIcon = item.category === 'Job' ? Briefcase : Users;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.category}: ${item.title}`}
      style={{ marginBottom: 10, overflow: 'hidden', borderRadius: 16, backgroundColor: '#ffffff' }}
    >
      <View style={{ height: 96, overflow: 'hidden' }}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
        {item.image && !imageFailed ? (
          <CachedImage uri={item.image} style={{ width: '100%', height: 96, opacity: 0.75 }} contentFit="cover" onError={() => setImageFailed(true)} accessibilityLabel={item.title} />
        ) : null}
        <View style={{ position: 'absolute', left: 8, top: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#334155' }}>{item.category}</Text>
        </View>
        <LinearGradient colors={gradient} style={{ position: 'absolute', right: 8, top: 8, width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
          <CategoryIcon size={16} color="#ffffff" />
        </LinearGradient>
      </View>
      <View style={{ padding: 12 }}>
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: gradient[0], marginBottom: 3 }}>{item.title}</Text>
        <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, color: '#475569', marginBottom: 8 }}>{item.description}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b' }}>{item.metric}</Text>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>{item.category === 'Job' ? 'Apply' : 'Join'}</Text>
          </LinearGradient>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Mobile version of the website's right-column "Promoted" card: active jobs and popular communities. */
export default function PromotedContentCard() {
  const router = useRouter();
  const [items, setItems] = useState<PromotedContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageStart, setPageStart] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // async/try-finally rather than Promise.finally, which this app's Promise implementation does not provide.
    const load = async () => {
      try {
        const promoted = await promotedContentService.getPromotedContent(6);
        if (!cancelled) setItems(promoted);
      } catch (error: unknown) {
        console.warn('[PromotedContentCard.load] Error:', error instanceof Error ? error.message : 'promotions unavailable');
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const pageCount = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const currentPage = Math.floor(pageStart / ITEMS_PER_PAGE);
  const visibleItems = items.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const handlePaginate = (direction: 1 | -1): void => {
    if (items.length <= ITEMS_PER_PAGE) return;
    setPageStart((previous) => {
      const next = previous + direction * ITEMS_PER_PAGE;
      if (next < 0) return (pageCount - 1) * ITEMS_PER_PAGE;
      if (next >= items.length) return 0;
      return next;
    });
  };

  const handleOpen = (item: PromotedContentItem): void => {
    if (item.category === 'Job') router.push({ pathname: '/jobs/[id]', params: { id: item.id } });
    else router.push({ pathname: '/communities/[id]', params: { id: item.id } });
  };

  // Nothing promoted and nothing loading: leave the feed uncluttered.
  if (!isLoading && items.length === 0) return null;

  return (
    <LinearGradient
      colors={['#a855f7', '#ec4899']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ marginBottom: 14, borderRadius: 24, padding: 16, overflow: 'hidden' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Target size={20} color="#ffffff" />
        <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '700', color: '#ffffff' }}>Promoted</Text>
        <View style={{ marginLeft: 'auto', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, color: '#ffffff' }}>Sponsored</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <TouchableOpacity
          onPress={() => handlePaginate(-1)}
          disabled={pageCount <= 1}
          accessibilityRole="button"
          accessibilityLabel="Previous promotions"
          style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', opacity: pageCount <= 1 ? 0.4 : 1 }}
        >
          <ChevronLeft size={16} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`Promotion page ${currentPage + 1} of ${pageCount}`}>
          {Array.from({ length: pageCount }).map((_, pageIndex) => (
            <View key={pageIndex} style={{ height: 4, borderRadius: 2, width: currentPage === pageIndex ? 16 : 4, backgroundColor: currentPage === pageIndex ? '#ffffff' : 'rgba(255,255,255,0.4)' }} />
          ))}
        </View>
        <TouchableOpacity
          onPress={() => handlePaginate(1)}
          disabled={pageCount <= 1}
          accessibilityRole="button"
          accessibilityLabel="Next promotions"
          style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', opacity: pageCount <= 1 ? 0.4 : 1 }}
        >
          <ChevronRight size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ gap: 10, paddingVertical: 6 }}>
          <Skeleton height={96} borderRadius={16} style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
          <Skeleton width="66%" height={12} style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
          <Skeleton height={96} borderRadius={16} style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
        </View>
      ) : visibleItems.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Sparkles size={28} color="rgba(255,255,255,0.6)" />
          <Text style={{ marginTop: 6, fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>No active promotions</Text>
        </View>
      ) : (
        visibleItems.map((item, index) => (
          <PromotedItemRow
            key={`${item.category}-${item.id}`}
            item={item}
            gradient={ITEM_GRADIENTS[(pageStart + index) % ITEM_GRADIENTS.length]}
            onPress={() => handleOpen(item)}
          />
        ))
      )}
    </LinearGradient>
  );
}

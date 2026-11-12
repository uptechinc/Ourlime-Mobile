import { View, Dimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SkeletonBox, SkeletonCircle } from '@/components/ui/Skeleton';
import { feedCardContainerStyle } from '@/components/home/MiddleSection/MiddleSectionComponent/PostCardSection/feedCardStyles';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

type SkeletonTextLineProps = {
  /** Font size of the real text; the bar is drawn at ~80% of it. */
  fontSize: number;
  /** Line box height of the real text (defaults to the platform's ~1.33x font size). */
  lineHeight?: number;
  width: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
};

/** One line of text: a bar sized like the glyphs, centred in a box as tall as the real line. */
export function SkeletonTextLine({ fontSize, lineHeight, width, style }: SkeletonTextLineProps) {
  return (
    <View style={[{ height: lineHeight ?? Math.round(fontSize * 1.33), justifyContent: 'center' }, style]}>
      <SkeletonBox width={width} height={Math.round(fontSize * 0.8)} borderRadius={4} />
    </View>
  );
}

type SkeletonPostActionProps = {
  iconSize: number;
  marginRight: number;
  showCount?: boolean;
};

function SkeletonPostAction({ iconSize, marginRight, showCount = true }: SkeletonPostActionProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginRight }}>
      <SkeletonCircle size={iconSize} />
      {showCount ? <SkeletonTextLine fontSize={14} width={9} style={{ marginLeft: 7 }} /> : null}
    </View>
  );
}

type SkeletonPostCardProps = {
  /** Whether to draw the edge-to-edge media block (330 tall, like ImageAndVideoPostSection). */
  showMedia?: boolean;
};

/** Mirrors PostCardSection: header, caption, edge-to-edge media, then the like/comment/share/repost bar. */
export function SkeletonPostCard({ showMedia = true }: SkeletonPostCardProps) {
  const { colors } = useAppTheme();
  return (
    <View style={[feedCardContainerStyle, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 14 }]}>
      <View style={{ paddingHorizontal: 16 }}>
        {/* Author row: 48 avatar, name, @handle · time + visibility icon, more-horizontal menu */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <SkeletonCircle size={48} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <SkeletonTextLine fontSize={16} lineHeight={21} width={140} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <SkeletonTextLine fontSize={13} lineHeight={17} width={112} />
                <SkeletonCircle size={12} style={{ marginLeft: 5 }} />
              </View>
            </View>
          </View>
          <View style={{ width: 37, height: 37, alignItems: 'center', justifyContent: 'center' }}>
            <SkeletonBox width={21} height={5} borderRadius={3} />
          </View>
        </View>

        {/* Caption: fontSize 17 / lineHeight 23 */}
        <View style={{ marginTop: 14 }}>
          <SkeletonTextLine fontSize={17} lineHeight={23} width="92%" />
          <SkeletonTextLine fontSize={17} lineHeight={23} width="64%" />
        </View>
      </View>

      {showMedia ? <SkeletonBox width="100%" height={330} borderRadius={0} style={{ marginTop: 12 }} /> : null}

      {/* Action bar: like + count, comment + count, share + count, repost; liked-by avatars on the right */}
      <View style={{ paddingHorizontal: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SkeletonPostAction iconSize={23} marginRight={22} />
            <SkeletonPostAction iconSize={22} marginRight={22} />
            <SkeletonPostAction iconSize={22} marginRight={20} />
            <SkeletonPostAction iconSize={22} marginRight={0} showCount={false} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {[0, 1, 2].map((likedIndex) => (
                <View
                  key={likedIndex}
                  style={{
                    marginLeft: likedIndex > 0 ? -10 : 0,
                    borderWidth: 2,
                    borderColor: colors.surface,
                    borderRadius: 13,
                    zIndex: 3 - likedIndex,
                  }}
                >
                  <SkeletonCircle size={22} />
                </View>
              ))}
            </View>
            <SkeletonTextLine fontSize={13} width={38} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** Discover → Suggested Friends person card (150 wide, 60 avatar, name, @handle, Add Friend button). */
export function SkeletonUserCard() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        width: 150,
        padding: 14,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <SkeletonCircle size={60} />
      <SkeletonTextLine fontSize={15} lineHeight={20} width={96} style={{ marginTop: 10 }} />
      <SkeletonTextLine fontSize={12} lineHeight={16} width={64} style={{ marginTop: 2 }} />
      <SkeletonBox width="100%" height={30} borderRadius={14} style={{ marginTop: 12 }} />
    </View>
  );
}

/** Discover → Featured Communities card (72% screen wide, 110 cover, title, members, "View community"). */
export function SkeletonCommunityCard() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        width: SCREEN_WIDTH * 0.72,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        marginRight: 14,
      }}
    >
      <SkeletonBox width="100%" height={110} borderRadius={0} />
      <View style={{ padding: 14 }}>
        <SkeletonTextLine fontSize={16} lineHeight={21} width="62%" />
        <SkeletonTextLine fontSize={12} lineHeight={16} width={84} style={{ marginTop: 4 }} />
        <SkeletonTextLine fontSize={12} lineHeight={16} width={98} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

/** NotificationsModal card: 46 media badge, title + trash icon, two-line message, time ago. */
export function SkeletonNotificationRow() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <SkeletonCircle size={46} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <SkeletonTextLine fontSize={15} lineHeight={20} width="58%" />
          </View>
          <View style={{ padding: 4 }}>
            <SkeletonBox width={14} height={14} borderRadius={3} />
          </View>
        </View>
        <View style={{ marginTop: 4 }}>
          <SkeletonTextLine fontSize={13} lineHeight={18} width="96%" />
          <SkeletonTextLine fontSize={13} lineHeight={18} width="70%" />
        </View>
        <SkeletonTextLine fontSize={11} lineHeight={15} width={48} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

/** NotificationsModal UNREAD / READ section header (dot, label, count pill, Expand/Collapse + chevron). */
export function SkeletonNotificationSectionHeader() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SkeletonCircle size={8} style={{ marginRight: 8 }} />
        <SkeletonTextLine fontSize={12} width={52} />
        <SkeletonBox width={24} height={19} borderRadius={10} style={{ marginLeft: 8 }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SkeletonTextLine fontSize={12} width={52} style={{ marginHorizontal: 4 }} />
        <SkeletonBox width={15} height={15} borderRadius={4} />
      </View>
    </View>
  );
}

/** Discover → Upcoming Events row (64 image, date, title, map-pin location, share button). */
export function SkeletonDiscoverEventCard() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SkeletonBox width={64} height={64} borderRadius={16} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonTextLine fontSize={11} lineHeight={15} width={72} />
          <SkeletonTextLine fontSize={15} lineHeight={20} width="72%" style={{ marginTop: 2 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <SkeletonCircle size={12} />
            <View style={{ flex: 1, marginLeft: 4 }}>
              <SkeletonTextLine fontSize={12} lineHeight={16} width="60%" />
            </View>
          </View>
        </View>
        <View style={{ padding: 8 }}>
          <SkeletonBox width={18} height={18} borderRadius={5} />
        </View>
      </View>
    </View>
  );
}

/** Discover → Featured Jobs row (44 logo, role, company · type, salary and Apply →). */
export function SkeletonDiscoverJobCard() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
      }}
    >
      <SkeletonBox width={44} height={44} borderRadius={14} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <SkeletonTextLine fontSize={15} lineHeight={20} width="66%" />
        <SkeletonTextLine fontSize={12} lineHeight={16} width="52%" style={{ marginTop: 2 }} />
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <SkeletonTextLine fontSize={12} lineHeight={16} width={56} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <SkeletonTextLine fontSize={12} lineHeight={16} width={34} style={{ marginRight: 4 }} />
          <SkeletonBox width={12} height={12} borderRadius={3} />
        </View>
      </View>
    </View>
  );
}

/** Search tab result row (48 avatar, name, @handle, Add Friend pill). */
export function SkeletonSearchResultRow() {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <SkeletonCircle size={48} />
      <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
        <SkeletonTextLine fontSize={16} lineHeight={21} width="62%" />
        <SkeletonTextLine fontSize={13} lineHeight={17} width="40%" style={{ marginTop: 2 }} />
      </View>
      <SkeletonBox width={90} height={30} borderRadius={16} />
    </View>
  );
}

type SkeletonSearchResultsProps = {
  rowCount?: number;
};

/** Search tab results block: "RESULTS (n)" heading followed by result rows. */
export function SkeletonSearchResults({ rowCount = 4 }: SkeletonSearchResultsProps) {
  return (
    <View>
      <SkeletonTextLine fontSize={14} lineHeight={19} width={96} style={{ marginBottom: 12 }} />
      {Array.from({ length: rowCount }, (_, rowIndex) => (
        <SkeletonSearchResultRow key={`search-result-skeleton-${rowIndex}`} />
      ))}
    </View>
  );
}

/** CommentsModal comment: 38 avatar, rounded control bubble (name, two-line body), Like / Reply actions. */
export function SkeletonCommentRow() {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', marginBottom: 20 }}>
      <SkeletonCircle size={38} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <View
          style={{
            borderRadius: 18,
            borderTopLeftRadius: 5,
            backgroundColor: colors.control,
            paddingHorizontal: 13,
            paddingVertical: 10,
          }}
        >
          <SkeletonTextLine fontSize={13} lineHeight={17} width="58%" />
          <View style={{ marginTop: 5 }}>
            <SkeletonTextLine fontSize={14} lineHeight={19} width="94%" />
            <SkeletonTextLine fontSize={14} lineHeight={19} width="56%" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
            <SkeletonBox width={14} height={14} borderRadius={7} />
            <SkeletonTextLine fontSize={12} lineHeight={16} width={24} style={{ marginLeft: 4 }} />
          </View>
          <SkeletonTextLine fontSize={12} lineHeight={16} width={32} />
        </View>
      </View>
    </View>
  );
}

/** LikesModal user row: 46 avatar, name, @handle, Follow pill and round add-friend button. */
export function SkeletonLikeUserRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <SkeletonCircle size={46} />
        <View style={{ flex: 1, marginLeft: 11 }}>
          <SkeletonTextLine fontSize={14} lineHeight={19} width="58%" />
          <SkeletonTextLine fontSize={13} lineHeight={17} width="36%" />
        </View>
      </View>
      <SkeletonBox width={82} height={35} borderRadius={16} />
      <SkeletonCircle size={38} style={{ marginLeft: 7 }} />
    </View>
  );
}

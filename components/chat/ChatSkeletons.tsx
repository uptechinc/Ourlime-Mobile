import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type TextLineProps = {
  lineHeight: number;
  barHeight: number;
  width: number | `${number}%`;
  color?: string;
};

/** A text line: a bar as tall as the glyphs inside a box as tall as the real line. */
function TextLine({ lineHeight, barHeight, width, color }: TextLineProps): ReactNode {
  return (
    <View style={{ height: lineHeight, justifyContent: 'center' }}>
      <Skeleton width={width} height={barHeight} borderRadius={4} style={color ? { backgroundColor: color } : undefined} />
    </View>
  );
}

/* ── Messages list (app/(tabs)/Chat.tsx) ── */

const CHAT_ROW_WIDTHS = [
  { name: 128, preview: '78%' },
  { name: 104, preview: '62%' },
  { name: 140, preview: '85%' },
  { name: 96, preview: '55%' },
  { name: 120, preview: '70%' },
  { name: 110, preview: '66%' },
] as const;

/** One conversation row: avatar 52 + status dot, name 16 / time 11, preview 13, chevron. */
export function ChatListRowSkeleton({ nameWidth = 128, previewWidth = '78%' }: { nameWidth?: number; previewWidth?: `${number}%` }): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 14,
        borderRadius: 18,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <View>
        <SkeletonCircle size={52} />
        <View
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: colors.border,
            borderWidth: 2,
            borderColor: colors.surface,
          }}
        />
      </View>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
          <TextLine lineHeight={21} barHeight={13} width={nameWidth} />
          <TextLine lineHeight={14} barHeight={9} width={34} />
        </View>
        <TextLine lineHeight={17} barHeight={11} width={previewWidth} />
      </View>

      <Skeleton width={16} height={16} borderRadius={4} style={{ marginLeft: 6 }} />
    </View>
  );
}

/** The conversations list while it loads (the header, search and filter chips stay real above it). */
export function ChatListSkeleton({ count = 6 }: { count?: number }): ReactNode {
  return (
    <View accessibilityLabel="Loading conversations">
      {Array.from({ length: count }, (_, rowIndex) => {
        const rowWidths = CHAT_ROW_WIDTHS[rowIndex % CHAT_ROW_WIDTHS.length];
        return <ChatListRowSkeleton key={`chat-row-skeleton-${rowIndex}`} nameWidth={rowWidths.name} previewWidth={rowWidths.preview} />;
      })}
    </View>
  );
}

/* ── Conversation header (app/chat/[id]) ── */

/** Friend avatar 38 + name 16 / status 12, shown in the header until the friend's profile arrives. */
export function ChatHeaderIdentitySkeleton(): ReactNode {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 4 }} accessibilityLabel="Loading contact">
      <SkeletonCircle size={38} />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <TextLine lineHeight={21} barHeight={13} width={120} />
        <TextLine lineHeight={16} barHeight={9} width={72} />
      </View>
    </View>
  );
}

/* ── Conversation messages (app/chat/[id]) ── */

type BubbleSpec = {
  own: boolean;
  /** Text width of each line inside the bubble. */
  lineWidths: readonly number[];
};

/* Read bottom-up like the real inverted list: the last entry sits right above the composer. */
const BUBBLES: readonly BubbleSpec[] = [
  { own: false, lineWidths: [190] },
  { own: false, lineWidths: [228, 140] },
  { own: true, lineWidths: [150] },
  { own: false, lineWidths: [120] },
  { own: true, lineWidths: [232, 196] },
  { own: true, lineWidths: [96] },
  { own: false, lineWidths: [210, 88] },
  { own: true, lineWidths: [168] },
];

const OWN_BAR_COLOR = 'rgba(255, 255, 255, 0.45)';
const OWN_TIME_COLOR = 'rgba(255, 255, 255, 0.35)';

function MessageBubbleSkeleton({ own, lineWidths }: BubbleSpec): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: own ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        marginBottom: 4,
        paddingHorizontal: 12,
      }}
    >
      {!own ? <SkeletonCircle size={26} style={{ marginRight: 6, marginBottom: 2 }} /> : null}
      <View style={{ maxWidth: '78%' }}>
        {/* Same shape as MessageBubble: 18 radius with a 4 tail corner, 14 x 9 padding */}
        <View
          style={{
            backgroundColor: own ? '#10b981' : colors.elevated,
            borderRadius: 18,
            borderBottomRightRadius: own ? 4 : 18,
            borderBottomLeftRadius: own ? 18 : 4,
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderWidth: own ? 0 : 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          {/* 15pt text on a 21 line */}
          {lineWidths.map((lineWidth, lineIndex) => (
            <TextLine
              key={`bubble-line-${lineIndex}`}
              lineHeight={21}
              barHeight={12}
              width={lineWidth}
              color={own ? OWN_BAR_COLOR : undefined}
            />
          ))}
          {/* Time (10pt) + delivery tick on own messages */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 }}>
            <TextLine lineHeight={13} barHeight={8} width={44} color={own ? OWN_TIME_COLOR : undefined} />
            {own ? <Skeleton width={12} height={12} borderRadius={6} style={{ backgroundColor: OWN_TIME_COLOR }} /> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

type ChatConversationSkeletonProps = {
  /** True when a wallpaper is set, so the list background stays see-through like the real list. */
  transparent?: boolean;
};

/** Message bubbles on both sides, anchored to the bottom like the inverted message list. */
export function ChatConversationSkeleton({ transparent = false }: ChatConversationSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'flex-end',
        overflow: 'hidden',
        paddingVertical: 12,
        backgroundColor: transparent ? 'transparent' : colors.canvas,
      }}
      accessibilityLabel="Loading messages"
    >
      {BUBBLES.map((bubble, bubbleIndex) => (
        <MessageBubbleSkeleton key={`bubble-skeleton-${bubbleIndex}`} own={bubble.own} lineWidths={bubble.lineWidths} />
      ))}
    </View>
  );
}

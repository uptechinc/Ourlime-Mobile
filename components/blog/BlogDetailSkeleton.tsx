import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type TextLinesProps = {
  lines?: number;
  fontSize: number;
  lineHeight: number;
  width?: number | `${number}%`;
  lastLineWidth?: number | `${number}%`;
};

/** Text placeholder that occupies exactly `lines * lineHeight` like the real Text it stands in for. */
function TextLines({ lines = 1, fontSize, lineHeight, width = '100%', lastLineWidth }: TextLinesProps): ReactNode {
  const barHeight = Math.round(fontSize * 0.8);
  return (
    <View>
      {Array.from({ length: lines }).map((_, lineIndex) => (
        <View key={lineIndex} style={{ height: lineHeight, justifyContent: 'center' }}>
          <Skeleton
            width={lineIndex === lines - 1 && lastLineWidth !== undefined ? lastLineWidth : width}
            height={barHeight}
            borderRadius={4}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Article body of app/blogs/[id]/index.tsx while the post loads (the header and progress bar above stay live):
 * meta row, date, title, lead excerpt, author row, Reader Content Notice, cover, tags and content paragraphs.
 */
export default function BlogDetailSkeleton(): ReactNode {
  const { colors, isDark } = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <View style={styles.articleBody}>
        <View style={styles.metaRow}>
          <Skeleton width={92} height={21} borderRadius={8} />
          <View style={styles.readTimeRow}>
            <Skeleton width={13} height={13} borderRadius={7} />
            <Skeleton width={56} height={10} borderRadius={4} />
            <Skeleton width={13} height={13} borderRadius={7} style={{ marginLeft: 8 }} />
            <Skeleton width={22} height={10} borderRadius={4} />
          </View>
        </View>
        <View style={{ marginBottom: 10 }}><TextLines fontSize={12} lineHeight={16} width={120} /></View>

        <View style={{ marginBottom: 12 }}><TextLines lines={2} fontSize={26} lineHeight={34} lastLineWidth="66%" /></View>

        <View style={styles.leadExcerpt}>
          <TextLines lines={2} fontSize={17} lineHeight={26} lastLineWidth="72%" />
        </View>

        <View style={[styles.authorRow, { borderBottomColor: colors.border }]}>
          <SkeletonCircle size={44} />
          <View style={{ flex: 1 }}>
            <View style={styles.authorNameRow}>
              <TextLines fontSize={15} lineHeight={20} width={120} />
              <Skeleton width={52} height={19} borderRadius={999} />
            </View>
            <View style={{ marginTop: 2 }}><TextLines fontSize={12} lineHeight={16} width={150} /></View>
          </View>
        </View>

        <View style={[styles.noticeBox, { backgroundColor: isDark ? '#0f172a' : '#fffbeb' }]}>
          <View style={styles.noticeTitleRow}>
            <Skeleton width={18} height={18} borderRadius={5} />
            <TextLines fontSize={14} lineHeight={19} width={160} />
          </View>
          <TextLines lines={6} fontSize={13} lineHeight={20} lastLineWidth="40%" />
        </View>

        <View style={styles.coverImage}><Skeleton width="100%" height="100%" borderRadius={16} /></View>

        <View style={styles.tagsCloud}>
          {[86, 104, 72].map((tagWidth) => <Skeleton key={tagWidth} width={tagWidth} height={32} borderRadius={999} />)}
        </View>

        <View style={styles.paragraph}><TextLines lines={4} fontSize={16} lineHeight={26} lastLineWidth="70%" /></View>
        <View style={{ marginBottom: 10 }}><TextLines fontSize={22} lineHeight={28} width="55%" /></View>
        <View style={styles.paragraph}><TextLines lines={4} fontSize={16} lineHeight={26} lastLineWidth="50%" /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  articleBody: { paddingHorizontal: 20, paddingTop: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  readTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leadExcerpt: { marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#10b981', paddingLeft: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 14 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noticeBox: { borderLeftWidth: 4, borderLeftColor: '#f59e0b', borderTopRightRadius: 10, borderBottomRightRadius: 10, padding: 14, gap: 8, marginBottom: 18 },
  noticeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coverImage: { width: '100%', aspectRatio: 1200 / 630, marginBottom: 16 },
  tagsCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  paragraph: { marginBottom: 16 },
});

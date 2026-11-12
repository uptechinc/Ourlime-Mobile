import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton } from '@/components/ui/Skeleton';
import type { SkeletonProps } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/**
 * Building blocks shared by the Jobs, E-Projects, Help, Settings and Admin skeletons.
 * They reserve the same vertical space as the real text so a skeleton has the page's exact height.
 */

/** React Native's default line box is roughly 1.33x the font size on both platforms. */
export const defaultLineHeight = (fontSize: number): number => Math.round(fontSize * 1.33);

type SkeletonLineProps = {
  fontSize: number;
  lineHeight?: number;
  width: SkeletonProps['width'];
  style?: StyleProp<ViewStyle>;
  barStyle?: StyleProp<ViewStyle>;
};

/** One line of text: a line-height box holding a bar about as tall as the glyphs. */
export function SkeletonLine({ fontSize, lineHeight, width, style, barStyle }: SkeletonLineProps): ReactNode {
  const boxHeight = lineHeight ?? defaultLineHeight(fontSize);
  return (
    <View style={[{ width, height: boxHeight, justifyContent: 'center' }, style]}>
      <Skeleton width="100%" height={Math.max(6, Math.round(fontSize * 0.8))} borderRadius={4} style={barStyle} />
    </View>
  );
}

type SkeletonParagraphProps = {
  fontSize: number;
  lineHeight?: number;
  lines: number;
  lastLineWidth?: SkeletonProps['width'];
  style?: StyleProp<ViewStyle>;
};

/** Several wrapped lines of body text with a shorter last line. */
export function SkeletonParagraph({ fontSize, lineHeight, lines, lastLineWidth = '60%', style }: SkeletonParagraphProps): ReactNode {
  return (
    <View style={style}>
      {Array.from({ length: lines }).map((_, lineIndex) => (
        <SkeletonLine
          key={lineIndex}
          fontSize={fontSize}
          lineHeight={lineHeight}
          width={lineIndex === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </View>
  );
}

type PageHeaderSkeletonProps = {
  titleWidth?: number;
  showRightSlot?: boolean;
};

/** Mirrors `components/ui/PageHeader`: safe-area top inset, 40pt back slot, centred 18pt title, 40pt right slot. */
export function PageHeaderSkeleton({ titleWidth = 110, showRightSlot = false }: PageHeaderSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: colors.surface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: Platform.OS === 'ios' ? 8 : 12,
          paddingBottom: 12,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ width: 40 }}>
          <View style={{ padding: 8 }}>
            <Skeleton width={24} height={24} borderRadius={6} />
          </View>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <SkeletonLine fontSize={18} width={titleWidth} />
        </View>
        <View style={{ width: 40, alignItems: 'flex-end' }}>
          {showRightSlot ? <Skeleton width={24} height={24} borderRadius={6} /> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

type FilterBarSkeletonProps = {
  style?: StyleProp<ViewStyle>;
};

/** Mirrors `components/ui/FilterBar` with no active filters: the pill "Filters" button plus "Showing everything". */
export function FilterBarSkeleton({ style }: FilterBarSkeletonProps): ReactNode {
  const { colors } = useAppTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 13,
          paddingVertical: 9,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Skeleton width={15} height={15} borderRadius={4} />
        <SkeletonLine fontSize={13} width={42} style={{ marginLeft: 6 }} />
      </View>
      <SkeletonLine fontSize={12} width={112} style={{ marginLeft: 10 }} />
    </View>
  );
}

import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonLine } from '@/components/ui/WorkspaceSkeletonParts';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type PercentWidth = `${number}%`;

/** Label widths for Account, Appearance, Privacy, Notifications, Blocked, Security, Safety, App. */
const TAB_LABEL_WIDTHS = [54, 76, 50, 92, 54, 60, 44, 26];
const INPUT_LABEL_WIDTHS = [70, 68, 64, 24];
const POLICY_LINK_WIDTHS: PercentWidth[] = ['52%', '56%', '70%'];

/** Translucent bars for the active green tab pill. */
const activeBarStyle = { backgroundColor: 'rgba(255,255,255,0.55)' };

/**
 * Whole Settings & Privacy screen on its default Account tab: header with Save, the tab pill bar,
 * then Account Information fields and the policy links. Uses the screen's own isDark palette.
 */
export function SettingsSkeleton(): ReactNode {
  const { isDark } = useAppTheme();
  const dividerColor = isDark ? '#1e293b' : '#f1f5f9';
  const inputStyle = {
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center' as const,
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: dividerColor }}>
        <View style={{ padding: 6 }}>
          <Skeleton width={24} height={24} borderRadius={6} />
        </View>
        <SkeletonLine fontSize={18} width={150} />
        <Skeleton width={62} height={33} borderRadius={20} />
      </View>

      <ScrollView
        horizontal
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 52, flexGrow: 0, borderBottomWidth: 1, borderBottomColor: dividerColor, paddingVertical: 8 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {TAB_LABEL_WIDTHS.map((labelWidth, tabIndex) => (
          <View key={tabIndex} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: tabIndex === 0 ? '#10b981' : dividerColor }}>
            <Skeleton width={15} height={15} borderRadius={4} style={tabIndex === 0 ? activeBarStyle : undefined} />
            <SkeletonLine fontSize={13} width={labelWidth} barStyle={tabIndex === 0 ? activeBarStyle : undefined} />
          </View>
        ))}
      </ScrollView>

      <View style={{ flex: 1, overflow: 'hidden' }}>
        <View style={{ padding: 20, paddingBottom: 40, gap: 16 }}>
          <SkeletonLine fontSize={16} width={170} style={{ marginBottom: 4 }} />
          {INPUT_LABEL_WIDTHS.map((labelWidth, fieldIndex) => (
            <View key={fieldIndex} style={{ gap: 6 }}>
              <SkeletonLine fontSize={13} width={labelWidth} />
              <View style={[inputStyle, fieldIndex === 3 ? { height: 80, justifyContent: 'flex-start', paddingTop: 10 } : { height: 42 }]}>
                <SkeletonLine fontSize={15} width={fieldIndex === 3 ? '82%' : '46%'} />
              </View>
            </View>
          ))}
          <SkeletonLine fontSize={16} width={210} style={{ marginBottom: 4 }} />
          {POLICY_LINK_WIDTHS.map((linkWidth) => (
            <View key={linkWidth} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 13, backgroundColor: isDark ? '#052e2b' : '#ecfdf5' }}>
              <Skeleton width={18} height={18} borderRadius={5} />
              <SkeletonLine fontSize={14} width={linkWidth} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Lock, Sparkles } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type PanelHeaderProps = { icon: ReactNode; title: string; badge?: string; description: string; action?: ReactNode };

/** The white banner card each website project tab starts with. */
export function PanelHeader({ icon, title, badge, description, action }: PanelHeaderProps) {
  const { colors } = useAppTheme();
  return (
    <View style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {icon}
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', flexShrink: 1 }}>{title}</Text>
        {badge ? <Text style={{ fontSize: 11, fontWeight: '800', color: colors.successText, backgroundColor: colors.successSurface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>{badge}</Text> : null}
      </View>
      <Text style={{ color: colors.mutedText, fontSize: 12, lineHeight: 17 }}>{description}</Text>
      {action}
    </View>
  );
}

type PremiumNoticeProps = { title: string; message: string; actionLabel?: string; onUpgrade?: () => void };

/** The amber Free-plan notice the website shows on Premium tabs. */
export function PremiumNotice({ title, message, actionLabel = 'Unlock Features', onUpgrade }: PremiumNoticeProps) {
  const { colors } = useAppTheme();
  return (
    <View style={{ padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#fcd34d', backgroundColor: colors.warningSurface, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Lock size={15} color="#d97706" style={{ marginTop: 2 }} />
        <Text style={{ flex: 1, color: colors.warningText, fontSize: 12, lineHeight: 17 }}><Text style={{ fontWeight: '900' }}>{title} </Text>{message}</Text>
      </View>
      {onUpgrade ? (
        <TouchableOpacity onPress={onUpgrade} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#d97706' }}>
          <Sparkles size={13} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

type EmptyPanelProps = { icon: ReactNode; title: string; message: string; action?: ReactNode };

export function EmptyPanel({ icon, title, message, action }: EmptyPanelProps) {
  const { colors } = useAppTheme();
  return (
    <View style={{ padding: 28, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', gap: 8 }}>
      {icon}
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: colors.mutedText, fontSize: 12, textAlign: 'center', lineHeight: 17 }}>{message}</Text>
      {action}
    </View>
  );
}

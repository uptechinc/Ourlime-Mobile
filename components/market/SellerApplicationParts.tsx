import { Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type SmallButtonProps = { label: string; icon?: string; tone?: 'neutral' | 'danger'; disabled?: boolean; onPress: () => void; accessibilityLabel?: string };

/** Outlined secondary action (Add, Replace, Retry). The form keeps one solid button: Submit. */
export function SellerSmallButton({ label, icon, tone = 'neutral', disabled, onPress, accessibilityLabel }: SmallButtonProps) {
  const { colors } = useAppTheme();
  const color = tone === 'danger' ? colors.destructive : colors.accentText;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} disabled={disabled} onPress={onPress}
    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: tone === 'danger' ? colors.destructiveBorder : colors.successBorder, backgroundColor: tone === 'danger' ? colors.destructiveSurface : colors.successSurface, opacity: disabled ? 0.5 : 1 }}>
    {icon ? <Icon name={icon} size={15} color={color} /> : null}
    <Text style={{ color, fontWeight: '700', fontSize: 14 }}>{label}</Text>
  </TouchableOpacity>;
}

type DocumentRowProps = {
  label: string;
  hint: string;
  required: boolean;
  isImage: boolean;
  fileName: string | null;
  pendingName: string | null;
  error?: string;
  disabled: boolean;
  onChoose: () => void;
  onRemove: () => void;
  onRetryPending: () => void;
  onDiscardPending: () => void;
};

/** One document as a single row: what it is, whether it is added, and one Add/Replace action. */
export function SellerDocumentRow({ label, hint, required, isImage, fileName, pendingName, error, disabled, onChoose, onRemove, onRetryPending, onDiscardPending }: DocumentRowProps) {
  const { colors } = useAppTheme();
  const isAdded = Boolean(fileName);
  const borderColor = error ? colors.destructive : isAdded ? colors.successBorder : colors.border;
  return <View style={{ gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor, backgroundColor: colors.surface }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isAdded ? colors.successSurface : colors.control }}>
        <Icon name={isAdded ? 'check' : isImage ? 'image' : 'file-text'} size={20} color={isAdded ? colors.successText : colors.icon} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{label}</Text>
          <Text style={{ color: required ? colors.warningText : colors.mutedText, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>{required ? 'Required' : 'Optional'}</Text>
        </View>
        <Text numberOfLines={1} style={{ color: isAdded ? colors.successText : colors.mutedText, fontSize: 13 }}>{fileName ?? hint}</Text>
      </View>
      <SellerSmallButton label={isAdded ? 'Replace' : 'Add'} icon={isAdded ? 'refresh-cw' : 'upload'} disabled={disabled} onPress={onChoose} accessibilityLabel={`${isAdded ? 'Replace' : 'Add'} ${label}`} />
    </View>
    {pendingName ? <View style={{ gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.warningSurface }}>
      <Text style={{ color: colors.warningText, fontSize: 13 }}>Upload not finished: {pendingName}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SellerSmallButton label="Retry upload" icon="rotate-cw" disabled={disabled} onPress={onRetryPending} />
        <SellerSmallButton label="Discard" tone="danger" disabled={disabled} onPress={onDiscardPending} />
      </View>
    </View> : null}
    {isAdded ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${label}`} disabled={disabled} onPress={onRemove} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
      <Text style={{ color: colors.destructive, fontSize: 13, fontWeight: '600' }}>Remove file</Text>
    </TouchableOpacity> : null}
    {error ? <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text> : null}
  </View>;
}

type TermsRowProps = { accepted: boolean; expanded: boolean; error?: string; onToggleAccepted: () => void; onToggleExpanded: () => void; onOpenFullTerms: () => void };

/** "I agree" checkbox with the terms summary one tap away, instead of two full-width buttons. */
export function SellerTermsRow({ accepted, expanded, error, onToggleAccepted, onToggleExpanded, onOpenFullTerms }: TermsRowProps) {
  const { colors } = useAppTheme();
  return <View style={{ gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: error ? colors.destructive : colors.border, backgroundColor: colors.surface }}>
    <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel="Accept seller terms" accessibilityState={{ checked: accepted }} onPress={onToggleAccepted}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: accepted ? colors.accent : colors.mutedText, backgroundColor: accepted ? colors.accent : 'transparent' }}>
        {accepted ? <Icon name="check" size={16} color={colors.onAccent} /> : null}
      </View>
      <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>I agree to the seller terms</Text>
    </TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} onPress={onToggleExpanded} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 }}>
      <Text style={{ color: colors.accentText, fontWeight: '600', fontSize: 14 }}>{expanded ? 'Hide terms summary' : 'Read seller terms'}</Text>
      <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accentText} />
    </TouchableOpacity>
    {expanded ? <View style={{ gap: 8 }}>
      <Text style={{ color: colors.secondaryText, fontSize: 14, lineHeight: 20 }}>Provide accurate information and lawful listings. Your identity documents are private and are deleted 30 days after a final approval or rejection. Re-review requires fresh documents. Payments and payouts are not available in this release.</Text>
      <TouchableOpacity accessibilityRole="link" onPress={onOpenFullTerms} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Text style={{ color: colors.accentText, fontWeight: '600', fontSize: 14 }}>Open full terms</Text>
        <Icon name="external-link" size={14} color={colors.accentText} />
      </TouchableOpacity>
    </View> : null}
    {error ? <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text> : null}
  </View>;
}

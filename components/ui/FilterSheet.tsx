import { useEffect, useState } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RotateCcw, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { getAdminTone, radius as adminRadius, space as adminSpace, type as adminType } from '@/lib/admin/adminTokens';

export type FilterOption = { value: string; label: string };
/** Pick exactly one option; `defaultValue` is what Reset returns to. */
export type FilterGroup = {
  kind?: 'single';
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  defaultValue: string;
};
/** Pick any number of options (none selected is the default). */
export type MultiFilterGroup = {
  kind: 'multiple';
  key: string;
  label: string;
  options: FilterOption[];
  values: string[];
};
export type AnyFilterGroup = FilterGroup | MultiFilterGroup;
export type FilterValues = { [groupKey: string]: string | string[] };

/** Reads a single-choice group's value from applied filter values. */
export const readSingleFilter = (values: FilterValues, key: string): string | undefined => {
  const value = values[key];
  return typeof value === 'string' ? value : undefined;
};

/** Reads a multi-choice group's values from applied filter values. */
export const readMultiFilter = (values: FilterValues, key: string): string[] => {
  const value = values[key];
  return Array.isArray(value) ? value : [];
};

type FilterSheetProps = {
  visible: boolean;
  title: string;
  groups: AnyFilterGroup[];
  applyLabel?: string;
  /** 'admin' opts into the admin soft-tone styling (AdminFilterSheet); 'default' (the default) is unchanged for member screens. */
  variant?: 'default' | 'admin';
  onApply: (values: FilterValues) => void;
  onClose: () => void;
};

const toValues = (groups: AnyFilterGroup[], pick: 'current' | 'default'): FilterValues =>
  groups.reduce<FilterValues>((values, group) => ({
    ...values,
    [group.key]: group.kind === 'multiple'
      ? (pick === 'current' ? group.values : [])
      : (pick === 'current' ? group.value : group.defaultValue),
  }), {});

const isOptionSelected = (draft: FilterValues, group: AnyFilterGroup, optionValue: string): boolean => {
  const current = draft[group.key];
  return Array.isArray(current) ? current.includes(optionValue) : current === optionValue;
};

/** Bottom sheet holding a screen's filter and sort groups; changes apply together when the user taps Apply. */
export default function FilterSheet({ visible, title, groups, applyLabel = 'Show results', variant = 'default', onApply, onClose }: FilterSheetProps) {
  const { colors } = useAppTheme();
  const isAdmin = variant === 'admin';
  const positive = getAdminTone(colors, 'positive');
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<FilterValues>(() => toValues(groups, 'current'));

  useEffect(() => {
    if (visible) setDraft(toValues(groups, 'current'));
    // Only re-sync when the sheet opens, so in-progress choices survive parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleApply = (): void => {
    onApply(draft);
    onClose();
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={onClose}>
      {/* Android sizes a translucent modal's root to the window (without system bars); use the full screen so the sheet sits on the bottom edge. */}
      <View style={{ height: Dimensions.get('screen').height, justifyContent: 'flex-end' }}>
        <ModalBackdrop onPress={onClose} accessibilityLabel={`Close ${title.toLowerCase()}`} style={[StyleSheet.absoluteFill, { backgroundColor: colors.modalScrim }]} />
        <ModalMotionSurface variant="sheet" style={{ maxHeight: '85%' }}>
          <SwipeDismissSurface visible={visible} onDismiss={onClose} handleColor={colors.border} accessibilityLabel={`Swipe down to close ${title.toLowerCase()}`} style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 12) + 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 6 }}>
              <Text style={isAdmin ? [adminType.title, { flex: 1, color: colors.text }] : { flex: 1, color: colors.text, fontSize: 19, fontWeight: '900' }}>{title}</Text>
              <TouchableOpacity onPress={onClose} accessibilityLabel={`Close ${title.toLowerCase()}`} hitSlop={isAdmin ? 4 : 12} style={isAdmin ? { width: 40, height: 40, borderRadius: adminRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control } : { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}>
                <X size={19} color={colors.icon} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
              {groups.map((group) => (
                <View key={group.key} style={{ marginTop: 12 }}>
                  <Text style={isAdmin ? [adminType.label, { marginBottom: adminSpace.sm, color: colors.mutedText }] : { marginBottom: 9, color: colors.mutedText, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 }}>{group.label.toUpperCase()}{group.kind === 'multiple' ? '  ·  PICK ANY' : ''}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {group.options.map((option) => {
                      const selected = isOptionSelected(draft, group, option.value);
                      return (
                        <TouchableOpacity
                          key={option.value}
                          onPress={() => setDraft((current) => {
                            if (group.kind !== 'multiple') return { ...current, [group.key]: option.value };
                            const selectedValues = readMultiFilter(current, group.key);
                            return { ...current, [group.key]: selectedValues.includes(option.value) ? selectedValues.filter((value) => value !== option.value) : [...selectedValues, option.value] };
                          })}
                          accessibilityRole={group.kind === 'multiple' ? 'checkbox' : 'radio'}
                          accessibilityState={group.kind === 'multiple' ? { checked: selected } : { selected }}
                          hitSlop={isAdmin ? 2 : undefined}
                          style={isAdmin
                            ? { minHeight: 40, justifyContent: 'center', paddingHorizontal: adminSpace.lg, borderRadius: adminRadius.pill, borderWidth: 1, borderColor: selected ? positive.border : colors.border, backgroundColor: selected ? positive.soft : colors.control }
                            : { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.selectedControl : colors.control }}
                        >
                          <Text style={isAdmin ? [adminType.bodyStrong, { color: selected ? positive.text : colors.secondaryText }] : { color: selected ? colors.selectedText : colors.secondaryText, fontWeight: '800', fontSize: 13 }}>{option.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity onPress={() => setDraft(toValues(groups, 'default'))} style={isAdmin ? { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: adminRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control } : { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.control }}>
                <RotateCcw size={16} color={colors.icon} />
                <Text style={isAdmin ? [adminType.bodyStrong, { marginLeft: adminSpace.sm, color: colors.secondaryText }] : { marginLeft: 7, color: colors.secondaryText, fontWeight: '900' }}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleApply} style={isAdmin ? { flex: 1.7, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: adminRadius.md, borderWidth: 1.5, borderColor: positive.border, backgroundColor: positive.soft } : { flex: 1.7, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent }}>
                <Text style={isAdmin ? [adminType.bodyStrong, { color: positive.text }] : { color: colors.onAccent, fontWeight: '900' }}>{applyLabel}</Text>
              </TouchableOpacity>
            </View>
          </SwipeDismissSurface>
        </ModalMotionSurface>
      </View>
    </Modal>
  );
}

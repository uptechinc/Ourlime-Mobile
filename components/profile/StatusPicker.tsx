import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { presenceService, ACTIVITY_STATUS_COLORS, type StatusPreference } from '@/lib/services/PresenceService';

type StatusOption = { value: StatusPreference; label: string; color: string };

/** Same choices as the website's profile status menu. "Online" = automatic: online while using Ourlime. */
const STATUS_OPTIONS: StatusOption[] = [
  { value: 'auto', label: 'Online', color: ACTIVITY_STATUS_COLORS.online },
  { value: 'busy', label: 'Busy', color: ACTIVITY_STATUS_COLORS.busy },
  { value: 'away', label: 'Away', color: ACTIVITY_STATUS_COLORS.away },
  { value: 'working', label: 'Working', color: ACTIVITY_STATUS_COLORS.working },
  { value: 'offline', label: 'Appear offline', color: ACTIVITY_STATUS_COLORS.offline },
];

type StatusPickerProps = {
  /** The signed-in user (their saved pick loads once it's known). */
  userId: string;
};

/** The signed-in user's own status chip on their profile; tapping it picks what others see. */
export default function StatusPicker({ userId }: StatusPickerProps) {
  const { colors } = useAppTheme();
  const [preference, setPreference] = useState<StatusPreference>('auto');
  const [menuVisible, setMenuVisible] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void presenceService.getStatusPreference(userId).then((value) => {
      if (active) setPreference(value);
    }).catch((error: unknown) => console.warn('[StatusPicker.load] Error:', error instanceof Error ? error.message : error));
    return () => {
      active = false;
    };
  }, [userId]);

  const current = STATUS_OPTIONS.find((option) => option.value === preference) ?? STATUS_OPTIONS[0];

  const handleSelect = (next: StatusPreference): void => {
    const previous = preference;
    setPreference(next);
    setMenuVisible(false);
    setErrorText(null);
    presenceService.setStatusPreference(next).catch((error: unknown) => {
      console.error('[StatusPicker.handleSelect] Error:', error);
      setPreference(previous);
      setErrorText('Status not updated. Please try again.');
    });
  };

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Your status: ${current.label}. Change status`}
        onPress={() => setMenuVisible(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border }}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: current.color }} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{current.label}</Text>
        <Ionicons name="chevron-down" size={12} color={colors.mutedText} />
      </TouchableOpacity>
      {errorText ? <Text style={{ fontSize: 12, color: colors.destructiveText, marginTop: 4 }}>{errorText}</Text> : null}

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable onPress={() => setMenuVisible(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalScrim }}>
          <Pressable style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 32 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 4 }}>Set your status</Text>
            <Text style={{ fontSize: 13, color: colors.mutedText, marginBottom: 10 }}>
              Others see this while you&apos;re using Ourlime, and Offline when you&apos;re not.
            </Text>
            {STATUS_OPTIONS.map((option) => {
              const isCurrent = option.value === preference;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isCurrent }}
                  onPress={() => handleSelect(option.value)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 6, borderRadius: 12, backgroundColor: isCurrent ? colors.control : 'transparent' }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: option.color }} />
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: isCurrent ? '800' : '600', color: colors.text }}>{option.label}</Text>
                  {isCurrent ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { nativeCallService } from '@/lib/services/NativeCallService';
import {
  notificationSoundPreferenceService,
  type NotificationSoundKind,
  type NotificationSoundPreferences,
} from '@/lib/services/NotificationSoundPreferenceService';

export default function NotificationSoundSettings() {
  const { colors } = useAppTheme();
  const [preferences, setPreferences] = useState<NotificationSoundPreferences | null>(null);
  const [busyKind, setBusyKind] = useState<NotificationSoundKind | null>(null);

  useEffect(() => {
    void notificationSoundPreferenceService.getPreferences().then(setPreferences);
    return () => notificationSoundPreferenceService.stop();
  }, []);

  const handleImport = async (kind: NotificationSoundKind) => {
    setBusyKind(kind);
    try {
      const preference = await notificationSoundPreferenceService.importMp3(kind);
      if (preference) setPreferences((current) => current ? { ...current, [kind]: preference } : current);
    } catch (error: unknown) {
      Alert.alert('Sound not imported', error instanceof Error ? error.message : 'Choose another MP3 file.');
    } finally { setBusyKind(null); }
  };

  const handleReset = async (kind: NotificationSoundKind) => {
    const preference = await notificationSoundPreferenceService.reset(kind);
    setPreferences((current) => current ? { ...current, [kind]: preference } : current);
  };

  if (!preferences) return <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />;
  return <View style={{ marginTop: 18 }}><Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>Notification sounds on this device</Text><Text style={{ marginTop: 5, color: colors.mutedText, lineHeight: 19 }}>Custom MP3s play while Ourlime is active. Background and terminated notifications use the phone&apos;s system sound where iOS or Android cannot safely retain arbitrary file access.</Text>
    <SoundRow kind="call" title="Incoming calls" detail={preferences.call.fileName ?? 'Phone system ringtone'} busy={busyKind === 'call'} custom={preferences.call.mode === 'custom'} onImport={() => void handleImport('call')} onPreview={() => void notificationSoundPreferenceService.preview('call')} onStop={() => notificationSoundPreferenceService.stop('call')} onReset={() => void handleReset('call')} colors={colors} />
    <SoundRow kind="message" title="Direct messages" detail={preferences.message.fileName ?? 'Phone system notification sound'} busy={busyKind === 'message'} custom={preferences.message.mode === 'custom'} onImport={() => void handleImport('message')} onPreview={() => void notificationSoundPreferenceService.preview('message')} onStop={() => notificationSoundPreferenceService.stop('message')} onReset={() => void handleReset('message')} colors={colors} />
    {Platform.OS === 'android' ? <TouchableOpacity onPress={() => void nativeCallService.openSystemNotificationSettings().catch((error: unknown) => Alert.alert('Settings unavailable', error instanceof Error ? error.message : 'Open Ourlime settings from Android Settings.'))} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}><Icon name="external-link" size={18} color={colors.accentText} /><Text style={{ marginLeft: 9, color: colors.accentText, fontWeight: '800' }}>Open incoming-call notification settings</Text></TouchableOpacity> : null}
  </View>;
}

type SoundRowProps = { kind: NotificationSoundKind; title: string; detail: string; busy: boolean; custom: boolean; onImport: () => void; onPreview: () => void; onStop: () => void; onReset: () => void; colors: ReturnType<typeof useAppTheme>['colors'] };
function SoundRow({ title, detail, busy, custom, onImport, onPreview, onStop, onReset, colors }: SoundRowProps) {
  return <View style={{ marginTop: 11, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name="volume-2" size={20} color={colors.accent} /><View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: colors.text, fontWeight: '900' }}>{title}</Text><Text numberOfLines={1} style={{ marginTop: 2, color: colors.mutedText, fontSize: 12 }}>{detail}</Text></View>{busy ? <ActivityIndicator color={colors.accent} /> : null}</View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 }}><SoundButton label={custom ? 'Replace MP3' : 'Choose MP3'} onPress={onImport} colors={colors} /><SoundButton label="Preview" onPress={onPreview} colors={colors} /><SoundButton label="Stop" onPress={onStop} colors={colors} />{custom ? <SoundButton label="Use system" onPress={onReset} colors={colors} /> : null}</View></View>;
}

function SoundButton({ label, onPress, colors }: { label: string; onPress: () => void; colors: ReturnType<typeof useAppTheme>['colors'] }) { return <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11, backgroundColor: colors.control }}><Text style={{ color: colors.secondaryText, fontSize: 12, fontWeight: '800' }}>{label}</Text></TouchableOpacity>; }

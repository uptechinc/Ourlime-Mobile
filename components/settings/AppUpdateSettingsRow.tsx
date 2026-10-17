import { Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppUpdate } from '@/lib/hooks/useAppUpdate';
import type { AppUpdateStatus } from '@/lib/services/AppUpdateStateMachine';

const STATUS_LABELS: Record<AppUpdateStatus, string> = {
  idle: 'Tap to check for updates',
  checking: 'Checking…',
  available: 'Update available',
  downloading: 'Downloading update…',
  verifying: 'Checking the download…',
  ready_to_restart: 'Update downloaded: restart to apply',
  ready_to_install: 'Update ready to install',
  installing: 'Installing…',
  error: 'Update not finished: tap to retry',
  up_to_date: 'You\'re up to date',
};

/** Settings → App: the installed build and "Check for updates" (opens the update sheet, even after "Later"). */
export default function AppUpdateSettingsRow() {
  const { colors } = useAppTheme();
  const { status, release, installedVersion, installedVersionCode, openSheet } = useAppUpdate();
  const installedLabel = `Ourlime ${installedVersion || 'unknown'}${installedVersionCode !== null ? ` (${installedVersionCode})` : ''}`;
  const hasUpdate = status === 'available' || status === 'ready_to_install' || status === 'ready_to_restart';
  const statusLabel = status === 'available' && release?.version ? `Version ${release.version} is available` : STATUS_LABELS[status];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Check for updates. ${installedLabel}. ${statusLabel}`}
      onPress={openSheet}
      style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
    >
      <Icon name="download-cloud" size={22} color={colors.accent} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Check for updates</Text>
        <Text style={{ color: colors.mutedText, fontSize: 12, marginTop: 2 }}>{installedLabel}</Text>
        <Text style={{ color: hasUpdate ? colors.accentText : colors.secondaryText, fontSize: 13, marginTop: 4, fontWeight: hasUpdate ? '700' : '500' }}>{statusLabel}</Text>
      </View>
      {hasUpdate ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginRight: 8 }} /> : null}
      <Icon name="chevron-right" size={18} color={colors.mutedText} />
    </TouchableOpacity>
  );
}

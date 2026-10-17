import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppUpdate } from '@/lib/hooks/useAppUpdate';

type AppUpdatePanelProps = {
  /** The blocking "update required" screen: no Later / Close. */
  isBlocking?: boolean;
};

type PanelButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
};

function PanelButton({ label, onPress, variant = 'primary' }: PanelButtonProps) {
  const { colors } = useAppTheme();
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignSelf: 'stretch', borderRadius: 14, paddingVertical: isPrimary ? 15 : 13, alignItems: 'center', marginTop: 8,
        backgroundColor: isPrimary ? colors.accent : 'transparent',
      }}
    >
      <Text style={{ color: isPrimary ? colors.onAccent : colors.accentText, fontSize: isPrimary ? 16 : 15, fontWeight: isPrimary ? '700' : '600' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const formatMegabytes = (bytes: number): string => `${Math.round(bytes / (1024 * 1024))} MB`;

/** Every state of the in-app update flow (offer, download, verify, install / restart, errors, questions). */
export default function AppUpdatePanel({ isBlocking = false }: AppUpdatePanelProps) {
  const { colors } = useAppTheme();
  const update = useAppUpdate();
  const { status, release, prompt } = update;
  const versionLabel = release?.version ? `Ourlime ${release.version}` : 'A new version of Ourlime';
  const closeLabel = isBlocking ? null : 'Later';

  const renderTitle = (title: string, subtitle?: string) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.mutedText, fontSize: 13, marginTop: 4 }}>{subtitle}</Text> : null}
    </View>
  );

  const renderNotes = (notes: string[]) => (notes.length > 0 ? (
    <View style={{ marginBottom: 8 }}>
      {notes.map((note) => (
        <View key={note} style={{ flexDirection: 'row', marginBottom: 6 }}>
          <Text style={{ color: colors.accent, fontSize: 15, marginRight: 8 }}>•</Text>
          <Text style={{ flex: 1, color: colors.secondaryText, fontSize: 15, lineHeight: 21 }}>{note}</Text>
        </View>
      ))}
    </View>
  ) : null);

  if (update.sheetMode === 'whats_new' && !isBlocking) {
    return (
      <View>
        {renderTitle(`What's new in Ourlime ${update.whatsNewVersion}`.trim())}
        {update.whatsNewNotes.length > 0
          ? renderNotes(update.whatsNewNotes)
          : <Text style={{ color: colors.secondaryText, fontSize: 15, lineHeight: 21 }}>Ourlime was updated with fixes and improvements.</Text>}
        <PanelButton label="Got it" onPress={update.dismissSheet} />
      </View>
    );
  }

  // Questions the flow is waiting on come first.
  if (prompt === 'install_permission') {
    return (
      <View>
        {renderTitle('Allow Ourlime to install updates')}
        <Text style={{ color: colors.secondaryText, fontSize: 15, lineHeight: 21 }}>
          Android needs your permission once. In the next screen, turn on &quot;Allow from this source&quot; for Ourlime, then come back here and the update carries on.
        </Text>
        <PanelButton label="Open settings" onPress={() => void update.openInstallPermissionSettings()} />
        <PanelButton label="Not now" variant="secondary" onPress={update.dismissPrompt} />
      </View>
    );
  }
  if (prompt === 'metered_download') {
    return (
      <View>
        {renderTitle('Download on mobile data?')}
        <Text style={{ color: colors.secondaryText, fontSize: 15, lineHeight: 21 }}>
          {`This update is ${update.sizeLabel || 'large'}. You're not on Wi-Fi, so it may use your data plan.`}
        </Text>
        <PanelButton label="Download anyway" onPress={update.confirmMeteredDownload} />
        <PanelButton label="Wait for Wi-Fi" variant="secondary" onPress={update.dismissPrompt} />
      </View>
    );
  }
  if (prompt === 'busy') {
    return (
      <View>
        {renderTitle('Finish what you\'re doing first')}
        <Text style={{ color: colors.secondaryText, fontSize: 15, lineHeight: 21 }}>
          Ourlime can&apos;t restart during a call or while something is uploading. The update will be ready when you&apos;re done.
        </Text>
        <PanelButton label="OK" onPress={update.dismissPrompt} />
      </View>
    );
  }

  switch (status) {
    case 'checking':
      return (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.mutedText, marginTop: 12 }}>Checking for updates…</Text>
        </View>
      );

    case 'downloading':
    case 'verifying': {
      const isVerifying = status === 'verifying';
      const hasSize = update.totalBytes > 0;
      return (
        <View>
          {renderTitle(isVerifying ? 'Checking the download…' : `Downloading ${versionLabel}`)}
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.control, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round((isVerifying || !hasSize ? 1 : update.progress) * 100)}%`, height: '100%', backgroundColor: colors.accent, opacity: !hasSize && !isVerifying ? 0.35 : 1 }} />
          </View>
          <Text style={{ color: colors.mutedText, fontSize: 13, marginTop: 8 }}>
            {isVerifying
              ? 'Making sure the file is genuine and complete.'
              : hasSize
                ? `${Math.round(update.progress * 100)}% · ${formatMegabytes(update.bytesReceived)} of ${formatMegabytes(update.totalBytes)}`
                : 'Downloading in the background. You can keep using Ourlime.'}
          </Text>
          {update.source === 'apk' && !isVerifying ? <PanelButton label="Cancel" variant="secondary" onPress={() => void update.cancelDownload()} /> : null}
          {!isBlocking && update.source === 'ota' ? <PanelButton label="Hide" variant="secondary" onPress={update.dismissSheet} /> : null}
        </View>
      );
    }

    case 'ready_to_restart':
      return (
        <View>
          {renderTitle('Update downloaded', 'Restart Ourlime to apply it.')}
          <Text style={{ color: colors.secondaryText, fontSize: 15, lineHeight: 21 }}>
            It only takes a moment. If you pick Later, it&apos;s applied the next time you open Ourlime.
          </Text>
          <PanelButton label="Restart now" onPress={() => void update.startUpdate()} />
          {closeLabel ? <PanelButton label={closeLabel} variant="secondary" onPress={update.dismissSheet} /> : null}
        </View>
      );

    case 'ready_to_install':
      return (
        <View>
          {renderTitle('Ready to install', versionLabel)}
          <Text style={{ color: colors.secondaryText, fontSize: 15, lineHeight: 21 }}>
            Android will ask you to confirm. Ourlime closes to finish updating; open it again afterwards.
          </Text>
          <PanelButton label="Install" onPress={() => void update.startUpdate()} />
          {closeLabel ? <PanelButton label={closeLabel} variant="secondary" onPress={update.dismissSheet} /> : null}
        </View>
      );

    case 'installing':
      return (
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Ionicons name="download-outline" size={36} color={colors.accent} />
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 10, textAlign: 'center' }}>Installing the update</Text>
          <Text style={{ color: colors.secondaryText, fontSize: 15, lineHeight: 21, marginTop: 6, textAlign: 'center' }}>
            Ourlime will close to finish updating. Open it again afterwards.
          </Text>
        </View>
      );

    case 'error':
      return (
        <View>
          {renderTitle('Update not finished')}
          <Text style={{ color: colors.destructiveText, fontSize: 15, lineHeight: 21 }}>{update.errorMessage ?? 'Something went wrong.'}</Text>
          <PanelButton label="Try again" onPress={() => void (update.release ? update.startUpdate() : update.checkNow())} />
          {closeLabel ? <PanelButton label="Close" variant="secondary" onPress={update.dismissSheet} /> : null}
        </View>
      );

    case 'available': {
      const isOta = update.source === 'ota';
      const details = [release?.version ? `Version ${release.version}` : '', update.sizeLabel].filter(Boolean).join(' · ');
      return (
        <View>
          {renderTitle(isOta ? 'An update is ready' : 'Update available', isOta ? 'A quick download, no reinstall.' : details)}
          {release && !isOta ? renderNotes(release.releaseNotes) : null}
          <PanelButton label="Update now" onPress={() => void update.startUpdate()} />
          {closeLabel ? <PanelButton label={closeLabel} variant="secondary" onPress={update.dismissSheet} /> : null}
        </View>
      );
    }

    case 'up_to_date':
    case 'idle':
    default:
      return (
        <View>
          {renderTitle('You\'re up to date', `Ourlime ${update.installedVersion}${update.installedVersionCode !== null ? ` (${update.installedVersionCode})` : ''}`)}
          {!isBlocking ? <PanelButton label="Close" onPress={update.dismissSheet} /> : null}
        </View>
      );
  }
}

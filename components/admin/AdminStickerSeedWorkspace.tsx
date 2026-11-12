import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import AdminDialog from './AdminDialog';
import { AdminWorkspaceService } from '@/lib/services/AdminWorkspaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const workspaceService = AdminWorkspaceService.getInstance();

/** The website's /admin/seed-stickers tool: populates Firestore with the default sticker packs and stickers. */
export default function AdminStickerSeedWorkspace() {
  const { colors } = useAppTheme();
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleSeed = async (): Promise<void> => {
    setConfirming(false);
    setRunning(true);
    setStatus('Seeding...');
    try {
      setStatus(await workspaceService.seedStickers());
    } catch (seedError: unknown) {
      console.error('[AdminStickerSeedWorkspace.handleSeed] Error:', seedError instanceof Error ? seedError.message : seedError);
      setStatus(`Error: ${seedError instanceof Error ? seedError.message : 'unknown'}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <AdminWorkspaceShell
      title="Seed Stickers"
      subtitle="Default sticker packs and stickers"
      loading={false}
      refreshing={false}
      error={null}
      onRefresh={() => setStatus('')}
    >
      <View style={{ alignItems: 'center', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface }}>
          <Icon name="smile" size={26} color={colors.successText} />
        </View>
        <Text style={{ marginTop: 14, color: colors.text, fontSize: 19, fontWeight: '900' }}>Seed Stickers</Text>
        <Text style={{ marginTop: 6, textAlign: 'center', color: colors.mutedText, lineHeight: 19 }}>
          Click below to populate Firestore with 5 packs and 29 stickers.
        </Text>
        <TouchableOpacity
          disabled={running}
          onPress={() => setConfirming(true)}
          style={{ marginTop: 18, minWidth: 150, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, backgroundColor: '#10b981', opacity: running ? 0.55 : 1 }}
        >
          {running ? <ActivityIndicator size="small" color="#ffffff" /> : null}
          <Text style={{ marginLeft: running ? 8 : 0, color: '#ffffff', fontWeight: '900' }}>{running ? 'Seeding...' : 'Run Seed'}</Text>
        </TouchableOpacity>
        {status ? (
          <Text style={{ marginTop: 16, alignSelf: 'stretch', padding: 12, borderRadius: 12, overflow: 'hidden', color: colors.secondaryText, backgroundColor: colors.control, textAlign: 'center' }}>
            {status}
          </Text>
        ) : null}
      </View>
      <AdminDialog
        visible={confirming}
        title="Run sticker seed?"
        description="This upserts the 5 default sticker packs and adds any of the 29 default stickers that are missing. Existing stickers are not duplicated."
        confirmLabel="Run Seed"
        onConfirm={() => void handleSeed()}
        onClose={() => setConfirming(false)}
      />
    </AdminWorkspaceShell>
  );
}

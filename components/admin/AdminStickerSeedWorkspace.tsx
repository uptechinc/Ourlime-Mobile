import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import AdminScreen from './AdminScreen';
import AdminSection from './AdminSection';
import AdminButton from './AdminButton';
import AdminState from './AdminState';
import AdminDialog, { type AdminDialogStage } from './AdminDialog';
import { AdminWorkspaceService } from '@/lib/services/AdminWorkspaceService';
import { getAdminTone, radius, space, type } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const workspaceService = AdminWorkspaceService.getInstance();

type SeedResult = { tone: 'positive' | 'danger'; message: string } | null;

/** The website's /admin/seed-stickers tool: populates Firestore with the default sticker packs and stickers. */
export default function AdminStickerSeedWorkspace() {
	const { colors } = useAppTheme();
	const positive = getAdminTone(colors, 'positive');
	const [result, setResult] = useState<SeedResult>(null);
	const [running, setRunning] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [dialogStage, setDialogStage] = useState<AdminDialogStage>('idle');
	/** Synchronous guard: a second tap before the state update lands cannot start a second run. */
	const runningRef = useRef(false);

	const openConfirm = () => {
		if (runningRef.current) return;
		setDialogStage('idle');
		setConfirming(true);
	};

	const handleSeed = async (): Promise<void> => {
		if (runningRef.current) return;
		runningRef.current = true;
		setRunning(true);
		setDialogStage('busy');
		setResult(null);
		try {
			const summary = await workspaceService.seedStickers();
			setResult({ tone: 'positive', message: summary });
			setDialogStage('success');
		} catch (seedError: unknown) {
			console.error('[AdminStickerSeedWorkspace.handleSeed] Error:', seedError instanceof Error ? seedError.message : seedError);
			setResult({ tone: 'danger', message: seedError instanceof Error ? seedError.message : 'The sticker seed failed.' });
			setConfirming(false);
			setDialogStage('idle');
		} finally {
			runningRef.current = false;
			setRunning(false);
		}
	};

	const handleCloseDialog = () => {
		if (runningRef.current) return;
		setConfirming(false);
		setDialogStage('idle');
	};

	// No data loads here, so there is no pull-to-refresh.
	return (
		<AdminScreen title="Seed Stickers" subtitle="Default sticker packs and stickers" state={{ kind: 'ready' }}>
			<View style={{ gap: space.lg }}>
				<AdminSection title="Seed default stickers" description="Populates Firestore with 5 packs and 29 stickers. Existing stickers are not duplicated.">
					<AdminButton label={running ? 'Seeding…' : 'Run seed'} icon="play" tone="positive" emphasis="primary" busy={running} disabled={running} onPress={openConfirm} fullWidth />
				</AdminSection>
				{result ? (
					result.tone === 'danger' ? (
						<AdminState kind="inlineError" message={result.message} onRetry={running ? undefined : openConfirm} />
					) : (
						<View accessibilityRole="alert" style={{ padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: positive.border, backgroundColor: positive.soft }}>
							<Text style={[type.body, { color: positive.text }]}>{result.message}</Text>
						</View>
					)
				) : null}
			</View>
			<AdminDialog
				visible={confirming}
				tone="pending"
				icon="database"
				title="Run sticker seed?"
				description="This upserts the 5 default sticker packs and adds any of the 29 default stickers that are missing. Existing stickers are not duplicated."
				confirmLabel="Run seed"
				stage={dialogStage}
				busyTitle="Seeding stickers…"
				busyMessage="Please wait while the packs and stickers are written."
				successTitle="Seed complete"
				successMessage={result?.tone === 'positive' ? result.message : undefined}
				onConfirm={() => void handleSeed()}
				onClose={handleCloseDialog}
			/>
		</AdminScreen>
	);
}

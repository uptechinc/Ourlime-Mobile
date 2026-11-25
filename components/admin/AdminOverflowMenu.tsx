import { useRef, useState } from 'react';
import { Dimensions, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import AdminIconButton from '@/components/admin/AdminIconButton';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { getAdminTone, radius, space, type } from '@/lib/admin/adminTokens';
import type { AdminOverflowItem } from '@/lib/admin/adminTypes';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type { AdminOverflowItem } from '@/lib/admin/adminTypes';

export type AdminOverflowMenuProps = {
	items: AdminOverflowItem[];
	/** 'header' (default) or 'row'; both render a 44pt "⋯" button. */
	trigger?: 'header' | 'row';
	/** Sheet title; default "Actions". */
	title?: string;
	/** accessibilityLabel of the "⋯" button; default "More actions". */
	triggerLabel?: string;
	disabled?: boolean;
};

/**
 * "⋯" button that opens a bottom sheet of secondary actions (rows 52pt, danger items last behind a divider).
 * The sheet closes before the item runs, so an item can safely open an AdminDialog. Danger items must open an
 * AdminDialog rather than act directly.
 */
export default function AdminOverflowMenu({ items, trigger = 'header', title = 'Actions', triggerLabel = 'More actions', disabled = false }: AdminOverflowMenuProps) {
	const { colors } = useAppTheme();
	const insets = useSafeAreaInsets();
	const [visible, setVisible] = useState(false);
	const pendingActionRef = useRef<(() => void) | null>(null);
	const neutralItems = items.filter((item) => item.tone !== 'danger');
	const dangerItems = items.filter((item) => item.tone === 'danger');
	const danger = getAdminTone(colors, 'danger');

	const runPendingAction = () => {
		const action = pendingActionRef.current;
		pendingActionRef.current = null;
		if (!action) return;
		try {
			action();
		} catch (error) {
			console.error('[AdminOverflowMenu] Error:', error);
		}
	};

	const handleClose = () => setVisible(false);

	const handleSelect = (item: AdminOverflowItem) => {
		if (item.disabled) return;
		pendingActionRef.current = item.onPress;
		setVisible(false);
		// iOS cannot present a new Modal (e.g. an AdminDialog) while this one is still dismissing: wait for onDismiss.
		if (Platform.OS !== 'ios') runPendingAction();
	};

	const renderItem = (item: AdminOverflowItem) => {
		const isDanger = item.tone === 'danger';
		const color = isDanger ? danger.text : colors.text;
		return (
			<Pressable
				key={item.key}
				onPress={() => handleSelect(item)}
				disabled={item.disabled}
				accessibilityRole="menuitem"
				accessibilityLabel={item.label}
				accessibilityHint={item.description}
				accessibilityState={{ disabled: item.disabled }}
				style={({ pressed }) => ({
					minHeight: 52,
					flexDirection: 'row',
					alignItems: 'center',
					gap: space.md,
					paddingHorizontal: space.md,
					paddingVertical: space.sm,
					borderRadius: radius.md,
					backgroundColor: pressed ? colors.control : 'transparent',
					opacity: item.disabled ? 0.5 : 1,
				})}
			>
				{item.icon ? <Icon name={item.icon} size={18} color={isDanger ? danger.text : colors.icon} /> : null}
				<View style={{ flex: 1 }}>
					<Text style={[type.bodyStrong, { color }]}>{item.label}</Text>
					{item.description ? <Text style={[type.meta, { color: colors.mutedText }]}>{item.description}</Text> : null}
				</View>
			</Pressable>
		);
	};

	if (!items.length) return null;

	return (
		<>
			<AdminIconButton
				icon={trigger === 'header' ? 'more-vertical' : 'more-horizontal'}
				label={triggerLabel}
				disabled={disabled}
				onPress={() => setVisible(true)}
			/>
			<Modal
				visible={visible}
				transparent
				statusBarTranslucent
				navigationBarTranslucent
				animationType="none"
				presentationStyle="overFullScreen"
				onRequestClose={handleClose}
				onDismiss={runPendingAction}
			>
				{/* Same Android full-screen workaround as FilterSheet, so the sheet sits on the bottom edge. */}
				<View style={{ height: Dimensions.get('screen').height, justifyContent: 'flex-end' }}>
					<ModalBackdrop onPress={handleClose} accessibilityLabel={`Close ${title.toLowerCase()}`} style={[StyleSheet.absoluteFill, { backgroundColor: colors.modalScrim }]} />
					<ModalMotionSurface variant="sheet" style={{ maxHeight: '80%' }}>
						<SwipeDismissSurface
							visible={visible}
							onDismiss={handleClose}
							handleColor={colors.border}
							accessibilityLabel={`Swipe down to close ${title.toLowerCase()}`}
							style={{ borderTopLeftRadius: radius.dialog, borderTopRightRadius: radius.dialog, backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.md) + space.sm }}
						>
							<View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: space.xl, paddingRight: space.sm }}>
								<Text style={[type.title, { flex: 1, color: colors.text }]}>{title}</Text>
								<AdminIconButton icon="x" label={`Close ${title.toLowerCase()}`} onPress={handleClose} />
							</View>
							<ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md }} showsVerticalScrollIndicator={false}>
								{neutralItems.map(renderItem)}
								{neutralItems.length && dangerItems.length ? (
									<View style={{ height: 1, marginVertical: space.sm, marginHorizontal: space.md, backgroundColor: colors.border }} />
								) : null}
								{dangerItems.map(renderItem)}
							</ScrollView>
						</SwipeDismissSurface>
					</ModalMotionSurface>
				</View>
			</Modal>
		</>
	);
}

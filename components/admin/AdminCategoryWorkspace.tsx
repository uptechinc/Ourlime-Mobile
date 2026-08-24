import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import CustomModal from '@/components/ui/CustomModal';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import {
	AdminWorkspaceService,
	type AdminCategoryKind,
	type AdminCategoryRecord,
} from '@/lib/services/AdminWorkspaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type AdminCategoryWorkspaceProps = {
	kind: AdminCategoryKind;
	title: string;
};

const workspaceService = AdminWorkspaceService.getInstance();

export default function AdminCategoryWorkspace({
	kind,
	title,
}: AdminCategoryWorkspaceProps) {
	const { colors } = useAppTheme();
	const [categories, setCategories] = useState<AdminCategoryRecord[]>([]);
	const [query, setQuery] = useState('');
	const [editing, setEditing] = useState<AdminCategoryRecord | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const load = useCallback(
		async (isRefresh = false) => {
			if (isRefresh) setRefreshing(true);
			else setLoading(true);
			setError(null);
			try {
				setCategories(await workspaceService.fetchCategories(kind));
			} catch (loadError: unknown) {
				setError(
					loadError instanceof Error
						? loadError.message
						: 'Categories could not be loaded.'
				);
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[kind]
	);

	useEffect(() => {
		void load();
	}, [load]);
	const visible = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		return normalized
			? categories.filter((category) =>
					`${category.name} ${category.description}`
						.toLowerCase()
						.includes(normalized)
				)
			: categories;
	}, [categories, query]);
	const openCreate = () => {
		setEditing(null);
		setName('');
		setDescription('');
		setIsCreating(true);
	};
	const openEdit = (category: AdminCategoryRecord) => {
		setEditing(category);
		setName(category.name);
		setDescription(category.description);
		setIsCreating(true);
	};

	const handleSave = async () => {
		if (saving) return;
		setSaving(true);
		try {
			if (editing) {
				await workspaceService.updateCategory(
					kind,
					editing.id,
					name,
					description
				);
				setCategories((current) =>
					current.map((category) =>
						category.id === editing.id
							? {
									...category,
									name: name.trim(),
									description: description.trim(),
								}
							: category
					)
				);
				setMessage('Category updated.');
			} else {
				const created = await workspaceService.createCategory(
					kind,
					name,
					description
				);
				setCategories((current) =>
					[...current, created].sort((first, second) =>
						first.name.localeCompare(second.name)
					)
				);
				setMessage('Category created.');
			}
			setIsCreating(false);
		} catch (saveError: unknown) {
			setMessage(
				saveError instanceof Error
					? saveError.message
					: 'Category could not be saved.'
			);
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!editing || saving) return;
		setSaving(true);
		try {
			await workspaceService.deleteCategory(kind, editing.id);
			setCategories((current) =>
				current.filter((category) => category.id !== editing.id)
			);
			setIsCreating(false);
			setMessage('Category deleted.');
		} catch (deleteError: unknown) {
			setMessage(
				deleteError instanceof Error
					? deleteError.message
					: 'Category could not be deleted.'
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<AdminWorkspaceShell
			title={title}
			subtitle="Create, edit, search, and remove canonical categories"
			loading={loading}
			refreshing={refreshing}
			error={error}
			onRefresh={() => void load(true)}
		>
			<View style={{ flexDirection: 'row', marginBottom: 14 }}>
				<View
					style={{
						flex: 1,
						flexDirection: 'row',
						alignItems: 'center',
						borderRadius: 14,
						backgroundColor: colors.input,
						borderWidth: 1,
						borderColor: colors.border,
						paddingHorizontal: 12,
					}}
				>
					<Icon name="search" size={17} color={colors.mutedText} />
					<TextInput
						value={query}
						onChangeText={setQuery}
						placeholder="Search categories"
						placeholderTextColor={colors.mutedText}
						style={{ flex: 1, padding: 11, color: colors.text }}
					/>
				</View>
				<TouchableOpacity
					onPress={openCreate}
					style={{
						marginLeft: 9,
						width: 46,
						alignItems: 'center',
						justifyContent: 'center',
						borderRadius: 14,
						backgroundColor: colors.accent,
					}}
				>
					<Icon name="plus" size={22} color={colors.onAccent} />
				</TouchableOpacity>
			</View>
			{visible.map((category) => (
				<TouchableOpacity
					key={category.id}
					onPress={() => openEdit(category)}
					style={{
						marginBottom: 9,
						padding: 15,
						borderRadius: 16,
						backgroundColor: colors.surface,
						borderWidth: 1,
						borderColor: colors.border,
						flexDirection: 'row',
						alignItems: 'center',
					}}
				>
					<View
						style={{
							width: 42,
							height: 42,
							borderRadius: 13,
							backgroundColor: colors.successSurface,
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<Icon name="tag" size={19} color={colors.accent} />
					</View>
					<View style={{ flex: 1, marginLeft: 11 }}>
						<Text style={{ color: colors.text, fontWeight: '900' }}>
							{category.name}
						</Text>
						<Text
							numberOfLines={1}
							style={{ marginTop: 3, color: colors.mutedText, fontSize: 12 }}
						>
							{category.description || 'No description'}
						</Text>
					</View>
					<Icon name="edit-2" size={17} color={colors.mutedText} />
				</TouchableOpacity>
			))}
			{!visible.length ? (
				<View style={{ paddingVertical: 55, alignItems: 'center' }}>
					<Icon name="tag" size={34} color={colors.mutedText} />
					<Text style={{ marginTop: 10, color: colors.mutedText }}>
						No matching categories.
					</Text>
				</View>
			) : null}
			<Modal
				visible={isCreating}
				transparent
				animationType="fade"
				onRequestClose={() => setIsCreating(false)}
			>
				<SafeAreaView
					edges={['top', 'left', 'right']}
					style={{
						flex: 1,
						justifyContent: 'center',
						padding: 20,
						backgroundColor: 'rgba(15,23,42,0.72)',
					}}
				>
					<View
						style={{
							borderRadius: 22,
							backgroundColor: colors.elevated,
							padding: 18,
						}}
					>
						<View style={{ flexDirection: 'row', alignItems: 'center' }}>
							<Text
								style={{
									flex: 1,
									fontSize: 19,
									fontWeight: '900',
									color: colors.text,
								}}
							>
								{editing ? 'Edit category' : 'New category'}
							</Text>
							<TouchableOpacity onPress={() => setIsCreating(false)}>
								<Icon name="x" size={22} color={colors.icon} />
							</TouchableOpacity>
						</View>
						<Text
							style={{
								marginTop: 16,
								marginBottom: 6,
								color: colors.secondaryText,
								fontWeight: '800',
							}}
						>
							Name
						</Text>
						<TextInput
							value={name}
							onChangeText={setName}
							placeholder="Category name"
							placeholderTextColor={colors.mutedText}
							style={{
								borderRadius: 13,
								borderWidth: 1,
								borderColor: colors.border,
								backgroundColor: colors.input,
								padding: 12,
								color: colors.text,
							}}
						/>
						<Text
							style={{
								marginTop: 14,
								marginBottom: 6,
								color: colors.secondaryText,
								fontWeight: '800',
							}}
						>
							Description
						</Text>
						<TextInput
							value={description}
							onChangeText={setDescription}
							placeholder="Category description"
							placeholderTextColor={colors.mutedText}
							multiline
							style={{
								minHeight: 88,
								textAlignVertical: 'top',
								borderRadius: 13,
								borderWidth: 1,
								borderColor: colors.border,
								backgroundColor: colors.input,
								padding: 12,
								color: colors.text,
							}}
						/>
						<TouchableOpacity
							disabled={saving || !name.trim()}
							onPress={() => void handleSave()}
							style={{
								marginTop: 17,
								alignItems: 'center',
								borderRadius: 14,
								backgroundColor: colors.accent,
								padding: 13,
							}}
						>
							<Text style={{ color: colors.onAccent, fontWeight: '900' }}>
								{saving ? 'Saving…' : 'Save category'}
							</Text>
						</TouchableOpacity>
						{editing ? (
							<TouchableOpacity
								disabled={saving}
								onPress={() => void handleDelete()}
								style={{
									marginTop: 9,
									alignItems: 'center',
									borderRadius: 14,
									backgroundColor: colors.destructiveSurface,
									padding: 13,
								}}
							>
								<Text
									style={{ color: colors.destructiveText, fontWeight: '900' }}
								>
									Delete category
								</Text>
							</TouchableOpacity>
						) : null}
					</View>
				</SafeAreaView>
			</Modal>
			<CustomModal
				visible={Boolean(message)}
				type="info"
				title={title}
				message={message ?? ''}
				onClose={() => setMessage(null)}
			/>
		</AdminWorkspaceShell>
	);
}

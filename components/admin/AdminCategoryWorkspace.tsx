import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { toast } from 'sonner-native';
import AdminScreen, { type AdminScreenState } from './AdminScreen';
import AdminToolbar from './AdminToolbar';
import AdminListRow from './AdminListRow';
import AdminState from './AdminState';
import AdminDialog from './AdminDialog';
import { AdminWorkspaceService, type AdminCategoryKind, type AdminCategoryRecord } from '@/lib/services/AdminWorkspaceService';
import { ADMIN_MIN_TOUCH, radius, space, type } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type AdminCategoryWorkspaceProps = {
	kind: AdminCategoryKind;
	title: string;
};

const workspaceService = AdminWorkspaceService.getInstance();

export default function AdminCategoryWorkspace({ kind, title }: AdminCategoryWorkspaceProps) {
	const { colors } = useAppTheme();
	const [categories, setCategories] = useState<AdminCategoryRecord[]>([]);
	const [query, setQuery] = useState('');
	const [editing, setEditing] = useState<AdminCategoryRecord | null>(null);
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [formError, setFormError] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<AdminCategoryRecord | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const load = useCallback(
		async (isRefresh = false) => {
			if (isRefresh) setRefreshing(true);
			else setLoading(true);
			setError(null);
			try {
				setCategories(await workspaceService.fetchCategories(kind));
			} catch (loadError: unknown) {
				console.error('[AdminCategoryWorkspace.load] Error:', loadError instanceof Error ? loadError.message : loadError);
				setError(loadError instanceof Error ? loadError.message : 'Categories could not be loaded.');
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
		return normalized ? categories.filter((category) => `${category.name} ${category.description}`.toLowerCase().includes(normalized)) : categories;
	}, [categories, query]);

	const openCreate = () => {
		setEditing(null);
		setName('');
		setDescription('');
		setFormError(null);
		setIsFormOpen(true);
	};
	const openEdit = (category: AdminCategoryRecord) => {
		setEditing(category);
		setName(category.name);
		setDescription(category.description);
		setFormError(null);
		setIsFormOpen(true);
	};
	const openDelete = (category: AdminCategoryRecord) => {
		setDeleteError(null);
		setDeleteTarget(category);
	};

	const handleSave = async () => {
		if (saving || !name.trim()) return;
		setSaving(true);
		setFormError(null);
		try {
			if (editing) {
				await workspaceService.updateCategory(kind, editing.id, name, description);
				setCategories((current) =>
					current.map((category) => (category.id === editing.id ? { ...category, name: name.trim(), description: description.trim() } : category))
				);
				toast.success('Category updated.');
			} else {
				const created = await workspaceService.createCategory(kind, name, description);
				setCategories((current) => [...current, created].sort((first, second) => first.name.localeCompare(second.name)));
				toast.success('Category created.');
			}
			setIsFormOpen(false);
		} catch (saveError: unknown) {
			console.error('[AdminCategoryWorkspace.handleSave] Error:', saveError instanceof Error ? saveError.message : saveError);
			// The dialog stays open so nothing typed is lost; the error shows inside it.
			setFormError(saveError instanceof Error ? saveError.message : 'Category could not be saved.');
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!deleteTarget || saving) return;
		setSaving(true);
		setDeleteError(null);
		try {
			await workspaceService.deleteCategory(kind, deleteTarget.id);
			const deletedId = deleteTarget.id;
			setCategories((current) => current.filter((category) => category.id !== deletedId));
			setDeleteTarget(null);
			toast.success('Category deleted.');
		} catch (removeError: unknown) {
			console.error('[AdminCategoryWorkspace.handleDelete] Error:', removeError instanceof Error ? removeError.message : removeError);
			setDeleteError(removeError instanceof Error ? removeError.message : 'Category could not be deleted.');
		} finally {
			setSaving(false);
		}
	};

	const inputStyle = [
		type.body,
		{ minHeight: ADMIN_MIN_TOUCH, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text },
	];

	const screenState: AdminScreenState = loading ? { kind: 'loading', variant: 'list' } : error ? { kind: 'error', message: error } : { kind: 'ready' };

	return (
		<AdminScreen
			title={title}
			subtitle="Create, edit, search, and remove canonical categories"
			state={screenState}
			refreshing={refreshing}
			onRefresh={() => load(true)}
			primaryAction={{ key: 'new', label: 'New', icon: 'plus', onPress: openCreate }}
			toolbar={
				<AdminToolbar
					search={{ value: query, placeholder: 'Search categories', onChange: setQuery }}
					resultSummary={loading ? undefined : `${visible.length} of ${categories.length} categories`}
				/>
			}
		>
			{visible.length ? (
				<View style={{ gap: space.sm }}>
					{visible.map((category) => (
						<AdminListRow
							key={category.id}
							title={category.name}
							subtitle={category.description || 'No description'}
							leading={{ kind: 'icon', name: 'tag', tone: 'positive' }}
							onPress={() => openEdit(category)}
							accessibilityHint="Edits the category"
							overflowActions={[
								{ key: 'edit', label: 'Edit', icon: 'edit-2', onPress: () => openEdit(category) },
								{ key: 'delete', label: 'Delete', icon: 'trash-2', tone: 'danger', onPress: () => openDelete(category) },
							]}
						/>
					))}
				</View>
			) : query.trim() ? (
				<AdminState kind="empty" title="" filtered onClearFilters={() => setQuery('')} />
			) : (
				<AdminState kind="empty" icon="tag" title="No categories yet" description="Create the first one with New." action={{ key: 'new', label: 'New category', icon: 'plus', onPress: openCreate }} />
			)}

			<AdminDialog
				visible={isFormOpen}
				icon={editing ? 'edit-2' : 'tag'}
				title={editing ? 'Edit category' : 'New category'}
				confirmLabel={editing ? 'Save' : 'Create'}
				busy={saving}
				confirmDisabled={!name.trim()}
				onConfirm={() => void handleSave()}
				onClose={() => setIsFormOpen(false)}
			>
				<View style={{ gap: space.md }}>
					{formError ? <AdminState kind="inlineError" message={formError} /> : null}
					<View style={{ gap: space.xs }}>
						<Text style={[type.label, { color: colors.mutedText }]}>Name</Text>
						<TextInput value={name} onChangeText={setName} editable={!saving} placeholder="Category name" placeholderTextColor={colors.mutedText} accessibilityLabel="Category name" style={inputStyle} />
					</View>
					<View style={{ gap: space.xs }}>
						<Text style={[type.label, { color: colors.mutedText }]}>Description</Text>
						<TextInput
							value={description}
							onChangeText={setDescription}
							editable={!saving}
							placeholder="Category description"
							placeholderTextColor={colors.mutedText}
							accessibilityLabel="Category description"
							multiline
							style={[inputStyle, { minHeight: 88, textAlignVertical: 'top' }]}
						/>
					</View>
				</View>
			</AdminDialog>

			<AdminDialog
				visible={Boolean(deleteTarget)}
				tone="danger"
				icon="trash-2"
				title={`Delete ${deleteTarget?.name ?? 'this category'}?`}
				description="This permanently removes the category. Records already using it keep their category name. It cannot be undone."
				confirmLabel="Delete"
				stage={saving ? 'busy' : 'idle'}
				busyTitle="Deleting category…"
				busyMessage="Please wait while the category is removed."
				onConfirm={() => void handleDelete()}
				onClose={() => setDeleteTarget(null)}
			>
				{deleteError ? <AdminState kind="inlineError" message={deleteError} /> : null}
			</AdminDialog>
		</AdminScreen>
	);
}

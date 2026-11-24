import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Archive, ArchiveRestore, ArrowDownUp, Check, FolderKanban, Mail, Pencil, Plus, Search, Trash2, X } from 'lucide-react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import CustomModal from '@/components/ui/CustomModal';
import FilterSheet, { readSingleFilter, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import ProjectFormSheet, { type ProjectFormValues } from '@/components/projectManagement/ProjectFormSheet';
import ProjectCreateSheet, { type ProjectCreateValues } from '@/components/projectManagement/ProjectCreateSheet';
import ProjectLifecycleSheet from '@/components/projectManagement/ProjectLifecycleSheet';
import ProjectActionSheet from '@/components/projectManagement/ProjectActionSheet';
import ProjectCard, { ROLE_LABELS } from '@/components/projectManagement/ProjectCard';
import SessionRetryBanner from '@/components/projectManagement/SessionRetryBanner';
import { ProjectManagementSkeleton } from '@/components/projectManagement/ProjectSkeletons';
import {
  PROJECT_GUTTER, PROJECT_RIPPLE, ProjectButton, ProjectChip, ProjectEmptyState, ProjectScreenHeader, ProjectSheetRow,
} from '@/components/projectManagement/ProjectUiParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { useProjectsResource } from '@/lib/hooks/useProjectsResource';
import { useProjectPulses } from '@/lib/hooks/useProjectPulses';
import { projectService } from '@/lib/services/ProjectService';
import { projectInsightRules } from '@/lib/services/ProjectInsightRules';
import { projectTemplateService } from '@/lib/services/ProjectTemplateService';
import type { ProjectRecord, ProjectRole, ProjectStatus } from '@/lib/types/project';

type StatusFilter = 'open' | 'completed' | 'archived' | 'all';
type RoleFilter = ProjectRole | 'all';
type SortKey = 'activity' | 'name' | 'progress' | 'created';
type SortChoice = `${SortKey}-${'asc' | 'desc'}`;

/** "Open" is active and paused work; archived projects stay out of the default list (audit §10). */
const STATUS_FILTERS: { value: StatusFilter; label: string; matches: (status: ProjectStatus) => boolean }[] = [
  { value: 'open', label: 'Open', matches: (status) => status === 'active' || status === 'on-hold' },
  { value: 'completed', label: 'Completed', matches: (status) => status === 'completed' },
  { value: 'archived', label: 'Archived', matches: (status) => status === 'archived' },
  { value: 'all', label: 'All', matches: () => true },
];
const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Any role' }, { value: 'owner', label: 'I own' }, { value: 'admin', label: 'Admin' }, { value: 'member', label: 'Member' }, { value: 'viewer', label: 'Viewer' },
];
const SORTS: { value: SortChoice; label: string }[] = [
  { value: 'activity-desc', label: 'Recent activity' }, { value: 'activity-asc', label: 'Oldest activity' },
  { value: 'created-desc', label: 'Newest' }, { value: 'created-asc', label: 'Oldest' },
  { value: 'name-asc', label: 'Name A–Z' }, { value: 'name-desc', label: 'Name Z–A' },
  { value: 'progress-desc', label: 'Most progress' }, { value: 'progress-asc', label: 'Least progress' },
];
const DEFAULT_SORT: SortChoice = 'activity-desc';
const isSortChoice = (value: string | undefined): value is SortChoice => SORTS.some((sort) => sort.value === value);

/** Cached records can come back from disk with dates as strings; always read them as Date. */
const toTime = (value: Date | string | undefined): number => (value ? new Date(value).getTime() || 0 : 0);
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

export default function ProjectManagementScreen() {
  const router = useRouter();
  const { getDecision } = usePageAccess();
  const canMutate = getDecision('/projectManagement').canMutate;
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { colors } = useAppTheme();
  const { activeUserId, nativeSession } = useAppData();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [error, setError] = useState('');
  const [workingProjectId, setWorkingProjectId] = useState<string | null>(null);
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectRecord | null>(null);
  const [menuProject, setMenuProject] = useState<ProjectRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [statusTarget, setStatusTarget] = useState<ProjectRecord | null>(null);
  const [declineTarget, setDeclineTarget] = useState<ProjectRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [sortChoice, setSortChoice] = useState<SortChoice>(DEFAULT_SORT);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, sortDir] = sortChoice.split('-') as [SortKey, 'asc' | 'desc'];
  const sessionReady = Boolean(activeUserId);
  const mutationReady = Boolean(activeUserId && nativeSession.status === 'ready' && nativeSession.uid === activeUserId);
  const { resource: projectResource, refresh: refreshProjects } = useProjectsResource(activeUserId ?? '', mutationReady);
  const projects = useMemo(() => projectResource.data ?? [], [projectResource.data]);
  const loading = projectResource.data === null && (projectResource.status === 'idle' || projectResource.status === 'hydrating');
  const hasBlockingError = Boolean(projectResource.error && !projectResource.data);
  const createCapability = projectService.getMutationCapability('create_project', null, { signedIn: Boolean(activeUserId), sessionReady: mutationReady, pageCanMutate: canMutate });
  const showList = sessionReady && !loading && !hasBlockingError;

  useFocusEffect(useCallback(() => { setOpeningProjectId(null); }, [setOpeningProjectId]));

  const invitations = useMemo(() => projects.filter((project) => project.membershipStatus === 'pending')
    .sort((first, second) => (first.id === projectId ? -1 : second.id === projectId ? 1 : 0)), [projectId, projects]);
  const acceptedProjects = useMemo(() => projects.filter((project) => project.membershipStatus !== 'pending'), [projects]);
  const { pulses, reload: reloadPulses } = useProjectPulses(acceptedProjects, activeUserId ?? '');

  const statusCounts = useMemo(() => Object.fromEntries(STATUS_FILTERS.map((filter) => [filter.value, acceptedProjects.filter((project) => filter.matches(project.status)).length])) as { [key in StatusFilter]: number }, [acceptedProjects]);
  const roleCounts = useMemo(() => Object.fromEntries(ROLE_FILTERS.map((filter) => [filter.value, filter.value === 'all' ? acceptedProjects.length : acceptedProjects.filter((project) => project.role === filter.value).length])) as { [key in RoleFilter]: number }, [acceptedProjects]);

  const visibleProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const statusMatcher = STATUS_FILTERS.find((filter) => filter.value === statusFilter) ?? STATUS_FILTERS[0];
    const filtered = acceptedProjects.filter((project) => (!term || `${project.name} ${project.description} ${project.tags.join(' ')}`.toLowerCase().includes(term))
      && statusMatcher.matches(project.status)
      && (roleFilter === 'all' || project.role === roleFilter));
    const sorted = [...filtered].sort((first, second) => {
      const comparison = sortBy === 'name' ? first.name.localeCompare(second.name)
        : sortBy === 'progress' ? first.progress - second.progress
          : sortBy === 'created' ? toTime(first.createdAt) - toTime(second.createdAt)
            : toTime(first.updatedAt) - toTime(second.updatedAt);
      return sortDir === 'asc' ? comparison : -comparison;
    });
    return sorted.sort((first, second) => (first.id === projectId ? -1 : second.id === projectId ? 1 : 0));
  }, [acceptedProjects, projectId, roleFilter, searchTerm, sortBy, sortDir, statusFilter]);

  const openCount = statusCounts.open;
  const overdueTotal = [...pulses.values()].reduce((sum, pulse) => sum + pulse.overdueTasks, 0);
  const mineTotal = [...pulses.values()].reduce((sum, pulse) => sum + pulse.myOpenTasks, 0);
  const summary = acceptedProjects.length === 0 ? 'Plan work with others: tasks, milestones and the team in one place.'
    : [plural(openCount, 'open project', 'open projects'), mineTotal > 0 ? plural(mineTotal, 'task for you', 'tasks for you') : '', overdueTotal > 0 ? `${overdueTotal} overdue` : ''].filter(Boolean).join(' · ');

  const handleRefresh = async (): Promise<void> => {
    await refreshProjects();
    void reloadPulses();
  };

  /** Session/page checks for any project change (the same gate the server applies). */
  const ensureCanChange = (): boolean => {
    if (!createCapability.allowed) { setError(createCapability.reason); return false; }
    setError('');
    return true;
  };

  const handleRespond = async (respondProjectId: string, action: 'accept' | 'decline') => {
    if (!canMutate || !mutationReady || workingProjectId) return;
    setWorkingProjectId(respondProjectId);
    setError('');
    try {
      await projectService.respondToInvite(respondProjectId, action);
      toast.success(action === 'accept' ? 'Invitation accepted' : 'Invitation declined');
      await refreshProjects();
    } catch (responseError: unknown) {
      setError(responseError instanceof Error ? responseError.message : `The invitation could not be ${action}ed.`);
    } finally {
      setWorkingProjectId(null);
    }
  };

  const handleCreate = async (values: ProjectCreateValues, onProgress: (label: string) => void): Promise<void> => {
    if (!createCapability.allowed) throw new Error(createCapability.reason);
    const result = await projectTemplateService.createFromTemplate({ ...values, startDate: projectInsightRules.today() }, (stage, done, total) => {
      onProgress(stage === 'project' ? 'Creating the project…' : `Adding the starter plan (${done} of ${total})…`);
    });
    setCreateOpen(false);
    if (result.starter && result.starter.failed > 0) {
      toast.error(`Project created. ${result.starter.created} of ${result.starter.total} starter items were added; add the rest from the project.`);
    } else {
      toast.success('Project created');
    }
    void refreshProjects();
    setOpeningProjectId(result.projectId);
    router.push({ pathname: '/projectManagement/[id]', params: result.template.suggestInvite ? { id: result.projectId, invite: '1' } : { id: result.projectId } });
  };

  const handleSaveEdit = async (values: ProjectFormValues): Promise<void> => {
    if (!editTarget) return;
    await projectService.updateProjectSettings(editTarget.id, values);
    setEditTarget(null);
    toast.success('Project updated');
    await refreshProjects();
  };

  /** Status change from the card menu, checked against the status this list shows (the sheet shows any error). */
  const handleTransition = async (project: ProjectRecord, toStatus: ProjectStatus, reason: string): Promise<void> => {
    setWorkingProjectId(project.id);
    try {
      await projectService.transitionProject(project.id, { expectedStatus: project.status, toStatus, reason });
      await refreshProjects();
    } finally {
      setWorkingProjectId(null);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await projectService.deleteProject(deleteTarget.id);
      setDeleteTarget(null);
      toast.success('Project deleted');
      await refreshProjects();
    } catch (deleteError: unknown) {
      setDeleteTarget(null);
      setError(deleteError instanceof Error ? deleteError.message : 'The project could not be deleted.');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenProject = (selectedProjectId: string): void => {
    if (openingProjectId) return;
    setOpeningProjectId(selectedProjectId);
    router.push({ pathname: '/projectManagement/[id]', params: { id: selectedProjectId } });
  };

  const handleOpenCreate = (): void => { if (ensureCanChange()) setCreateOpen(true); };

  const sortGroups: FilterGroup[] = [{ key: 'sort', label: 'Sort by', options: SORTS, value: sortChoice, defaultValue: DEFAULT_SORT }];
  const handleApplySort = (values: FilterValues): void => {
    const nextSort = readSingleFilter(values, 'sort');
    if (isSortChoice(nextSort)) setSortChoice(nextSort);
  };
  const sortLabel = SORTS.find((sort) => sort.value === sortChoice)?.label ?? 'Recent activity';
  const hasFilters = Boolean(searchTerm.trim()) || statusFilter !== 'open' || roleFilter !== 'all';
  const statusLabel = (STATUS_FILTERS.find((filter) => filter.value === statusFilter)?.label ?? 'Open').toLowerCase();

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <ProjectScreenHeader title="E-Projects" onBack={() => router.back()} />
      <SessionRetryBanner />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={projectResource.status === 'refreshing'} onRefresh={() => void handleRefresh()} tintColor="#10b981" />}>
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.introTitle}>Your projects</Text>
          {showList ? <Text style={styles.introText}>{summary}</Text> : null}
          {sessionReady ? <ProjectButton label="New project" icon={<Plus size={18} color="#ffffff" />} onPress={handleOpenCreate} isDisabled={!createCapability.allowed} accessibilityHint="Start from a template or a blank project" /> : null}
          {sessionReady && !createCapability.allowed && !loading ? <Text style={styles.hint}>{createCapability.reason}</Text> : null}
        </View>

        {!activeUserId ? <View style={styles.stateCard}><Text style={styles.stateTitle}>Sign in to use E-Projects</Text><Text style={styles.hint}>Your projects and invitations are private to your account.</Text></View> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {projectResource.error && projectResource.data ? <Text accessibilityRole="alert" style={styles.staleNotice}>Showing saved projects. {projectResource.error.message}</Text> : null}
        {hasBlockingError ? (
          <View style={styles.stateCard}>
            <Text accessibilityRole="alert" style={styles.stateTitle}>Projects could not be loaded</Text>
            <Text style={styles.hint}>{projectResource.error?.message}</Text>
            <ProjectButton label="Try again" onPress={() => void refreshProjects()} variant="secondary" />
          </View>
        ) : null}
        {loading ? <ProjectManagementSkeleton /> : null}

        {showList && invitations.length > 0 ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Invitations ({invitations.length})</Text>
            {invitations.map((project) => {
              const isWorking = workingProjectId === project.id;
              const disabled = !canMutate || !mutationReady || workingProjectId !== null;
              return (
                <View key={project.id} style={[styles.inviteCard, project.id === projectId && styles.focused]}>
                  <View style={styles.inviteTop}>
                    <View style={styles.inviteIcon}><Mail size={18} color={colors.accentText} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={2} style={styles.inviteTitle}>{project.name}</Text>
                      <Text numberOfLines={1} style={styles.hint}>{project.invitedByName || 'The project owner'} invited you as {ROLE_LABELS[project.role].toLowerCase()}</Text>
                    </View>
                  </View>
                  {project.description ? <Text numberOfLines={3} style={styles.inviteText}>{project.description}</Text> : null}
                  <View style={styles.inviteActions}>
                    <ProjectButton label="Accept" icon={<Check size={18} color="#ffffff" />} isBusy={isWorking} isDisabled={disabled} onPress={() => void handleRespond(project.id, 'accept')} accessibilityLabel={`Accept invitation to ${project.name}`} style={{ flex: 1 }} />
                    <ProjectButton label="Decline" variant="secondary" isDisabled={disabled} onPress={() => setDeclineTarget(project)} accessibilityLabel={`Decline invitation to ${project.name}`} style={{ flex: 1 }} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {showList && acceptedProjects.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.searchBox}>
              <Search size={18} color={colors.mutedText} />
              <TextInput value={searchTerm} onChangeText={setSearchTerm} placeholder="Search projects" placeholderTextColor={colors.mutedText} accessibilityLabel="Search projects" returnKeyType="search" style={styles.searchInput} />
              {searchTerm ? <Pressable onPress={() => setSearchTerm('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} style={styles.clearButton}><X size={18} color={colors.mutedText} /></Pressable> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipRow}>
              {STATUS_FILTERS.map((filter) => <ProjectChip key={filter.value} label={filter.label} count={statusCounts[filter.value]} isSelected={statusFilter === filter.value} onPress={() => setStatusFilter(filter.value)} accessibilityLabel={`${filter.label} projects, ${statusCounts[filter.value]}`} />)}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipRow}>
              {ROLE_FILTERS.filter((filter) => filter.value === 'all' || roleCounts[filter.value] > 0 || roleFilter === filter.value).map((filter) => (
                <ProjectChip key={filter.value} label={filter.label} isSelected={roleFilter === filter.value} onPress={() => setRoleFilter(filter.value)} accessibilityLabel={`Role filter: ${filter.label}`} />
              ))}
            </ScrollView>
            <View style={styles.listHeader}>
              <Text style={styles.listCount}>{plural(visibleProjects.length, 'project', 'projects')}</Text>
              <Pressable onPress={() => setSortOpen(true)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel={`Sort: ${sortLabel}. Change sort`} style={styles.sortButton}>
                <ArrowDownUp size={15} color={colors.secondaryText} />
                <Text numberOfLines={1} style={styles.sortText}>{sortLabel}</Text>
              </Pressable>
            </View>

            {visibleProjects.length === 0 ? (
              <ProjectEmptyState
                icon={<Search size={32} color={colors.mutedText} />}
                title={searchTerm.trim() ? 'No projects match your search' : `No ${statusLabel} projects`}
                hint={statusFilter === 'open' ? 'Completed and archived projects are under their own filters.' : 'Try another filter.'}
                secondaryLabel={hasFilters ? 'Show all projects' : undefined}
                onSecondary={hasFilters ? () => { setSearchTerm(''); setStatusFilter('all'); setRoleFilter('all'); } : undefined}
              />
            ) : visibleProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                pulse={pulses.get(project.id)}
                isFocused={project.id === projectId}
                isOpening={openingProjectId === project.id || workingProjectId === project.id}
                isDisabled={openingProjectId !== null}
                onOpen={handleOpenProject}
                onMenu={project.isOwner || project.role === 'admin' ? setMenuProject : undefined}
              />
            ))}
          </View>
        ) : null}

        {showList && acceptedProjects.length === 0 ? (
          <View style={styles.stateCard}>
            <ProjectEmptyState
              icon={<FolderKanban size={36} color={colors.accentText} />}
              title={invitations.length > 0 ? 'Accept an invitation or start your own' : 'No projects yet'}
              hint="Start from a template such as a class project, an event or a volunteer campaign, or begin with a blank project. Only people you invite can see it."
              actionLabel={createCapability.allowed ? 'Start a project' : undefined}
              onAction={createCapability.allowed ? handleOpenCreate : undefined}
            />
          </View>
        ) : null}
      </ScrollView>

      <ProjectActionSheet visible={menuProject !== null} title={menuProject?.name ?? ''} onClose={() => setMenuProject(null)}>
        {menuProject ? <>
          <ProjectSheetRow label="Edit details" detail="Name, purpose, colour, target date and tags" icon={<Pencil size={18} color={colors.icon} />} onPress={() => { const project = menuProject; setMenuProject(null); if (ensureCanChange()) setEditTarget(project); }} />
          <ProjectSheetRow
            label={menuProject.status === 'archived' ? 'Restore project…' : 'Change status…'}
            detail="Pause, complete, archive or restore, with a note for the team"
            icon={menuProject.status === 'archived' ? <ArchiveRestore size={18} color={colors.icon} /> : <Archive size={18} color={colors.icon} />}
            onPress={() => { const project = menuProject; setMenuProject(null); if (ensureCanChange()) setStatusTarget(project); }}
          />
          {menuProject.isOwner ? <ProjectSheetRow label="Delete project" tone="danger" icon={<Trash2 size={18} color={colors.destructive} />} onPress={() => { const project = menuProject; setMenuProject(null); if (ensureCanChange()) setDeleteTarget(project); }} /> : null}
        </> : null}
      </ProjectActionSheet>

      <FilterSheet visible={sortOpen} title="Sort projects" groups={sortGroups} applyLabel="Sort" onApply={handleApplySort} onClose={() => setSortOpen(false)} />
      <ProjectCreateSheet visible={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
      <ProjectFormSheet visible={editTarget !== null} project={editTarget} title="Edit project" onClose={() => setEditTarget(null)} onSubmit={handleSaveEdit} />
      <ProjectLifecycleSheet
        visible={statusTarget !== null}
        projectName={statusTarget?.name ?? ''}
        status={statusTarget?.status ?? 'active'}
        initialTarget={statusTarget?.status === 'archived' ? 'active' : null}
        onClose={() => setStatusTarget(null)}
        onConfirm={async (toStatus, reason) => { if (statusTarget) await handleTransition(statusTarget, toStatus, reason); }}
        onStale={() => { setStatusTarget(null); toast.error('This project changed since the list loaded. The list was refreshed.'); void refreshProjects(); }}
      />
      <CustomModal
        visible={declineTarget !== null}
        type="warning"
        title="Decline invitation?"
        message={`You will remove the invitation to ${declineTarget?.name ?? 'this project'}. The project owner can invite you again later.`}
        confirmText="Decline"
        cancelText="Cancel"
        onConfirm={() => { const project = declineTarget; setDeclineTarget(null); if (project) void handleRespond(project.id, 'decline'); }}
        onCancel={() => setDeclineTarget(null)}
        onClose={() => setDeclineTarget(null)}
      />
      <CustomModal
        visible={deleteTarget !== null}
        type="danger"
        title="Delete project?"
        message={`${deleteTarget?.name ?? 'This project'} and all of its tasks will be removed for every member. To keep a record instead, archive it.`}
        confirmText="Delete project"
        cancelText="Cancel"
        isLoading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
        onClose={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: PROJECT_GUTTER, paddingBottom: 48, gap: 16 },
  intro: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 10 },
  introTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  introText: { color: colors.secondaryText, fontSize: 14, lineHeight: 20 },
  hint: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  section: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  inviteCard: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface, gap: 10 },
  inviteTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inviteIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface },
  inviteTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  inviteText: { color: colors.secondaryText, fontSize: 14, lineHeight: 20 },
  inviteActions: { flexDirection: 'row', gap: 10 },
  focused: { borderColor: colors.accent, borderWidth: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchInput: { flex: 1, minHeight: 48, color: colors.text, fontSize: 15 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chipRow: { gap: 8, paddingVertical: 2 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  listCount: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 10, borderRadius: 10, maxWidth: '65%', overflow: 'hidden' },
  sortText: { color: colors.secondaryText, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12, overflow: 'hidden' },
  staleNotice: { color: colors.warningText, backgroundColor: colors.warningSurface, borderRadius: 12, padding: 12, overflow: 'hidden' },
  stateCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  stateTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
});

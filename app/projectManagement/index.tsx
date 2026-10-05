import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Activity, Archive, ArchiveRestore, ArrowDownUp, ArrowRight, Briefcase, CalendarDays, Check, CheckCircle2, CheckSquare, Clock, Crown, FolderOpen, MoreHorizontal, Pencil, Plus, Search, Trash2, UserRound, Users, X } from 'lucide-react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import PageHeader from '@/components/ui/PageHeader';
import CustomModal from '@/components/ui/CustomModal';
import ProjectFormSheet, { type ProjectFormValues } from '@/components/projectManagement/ProjectFormSheet';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { projectService } from '@/lib/services/ProjectService';
import type { ProjectRecord, ProjectRole, ProjectStatus } from '@/lib/types/project';
import { useAppData } from '@/lib/contexts/AppDataContext';
import SessionRetryBanner from '@/components/projectManagement/SessionRetryBanner';
import { ProjectManagementSkeleton } from '@/components/ui/Skeleton';
import { useProjectsResource } from '@/lib/hooks/useProjectsResource';

type SortKey = 'activity' | 'name' | 'progress' | 'created';
type FormTarget = { mode: 'create' } | { mode: 'edit'; project: ProjectRecord } | null;

const STATUS_FILTERS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'on-hold', label: 'On Hold' }, { value: 'archived', label: 'Archived' },
];
const ROLE_FILTERS: { value: ProjectRole | 'all'; label: string }[] = [
  { value: 'all', label: 'All Roles' }, { value: 'owner', label: 'Owner' }, { value: 'admin', label: 'Admin' }, { value: 'member', label: 'Member' }, { value: 'viewer', label: 'Viewer' },
];
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'activity', label: 'Activity' }, { value: 'name', label: 'Name' }, { value: 'progress', label: 'Progress' }, { value: 'created', label: 'Created Date' },
];

/** Cached records can come back from disk with dates as strings; always read them as Date. */
const toTime = (value: Date | string | undefined): number => (value ? new Date(value).getTime() || 0 : 0);
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

function formatLastActivity(value: Date | string | undefined): string {
  const time = toTime(value);
  if (!time) return 'No activity yet';
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(time).toLocaleDateString();
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Calendar date (YYYY-MM-DD) shown in words, never shifted through UTC.
function formatDueDate(value: string | null | undefined): string | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match ? `${MONTH_NAMES[Number(match[2]) - 1] ?? match[2]} ${Number(match[3])}, ${match[1]}` : null;
}

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
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [menuProject, setMenuProject] = useState<ProjectRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<ProjectRole | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('activity');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const sessionReady = Boolean(activeUserId);
  const mutationReady = Boolean(activeUserId && nativeSession.status === 'ready' && nativeSession.uid === activeUserId);
  const { resource: projectResource, refresh: refreshProjects } = useProjectsResource(activeUserId ?? '', mutationReady);
  const projects = useMemo(() => projectResource.data ?? [], [projectResource.data]);
  const loading = projectResource.data === null && (projectResource.status === 'idle' || projectResource.status === 'hydrating');
  const createCapability = projectService.getMutationCapability('create_project', null, { signedIn: Boolean(activeUserId), sessionReady: mutationReady, pageCanMutate: canMutate });

  useFocusEffect(useCallback(() => {
    setOpeningProjectId(null);
  }, [setOpeningProjectId]));

  const handleRespond = async (respondProjectId: string, action: 'accept' | 'decline') => {
    if (!canMutate || !mutationReady || workingProjectId) return;
    setWorkingProjectId(respondProjectId);
    setError('');
    try {
      await projectService.respondToInvite(respondProjectId, action);
      await refreshProjects();
    } catch (responseError: unknown) {
      setError(responseError instanceof Error ? responseError.message : `The invitation could not be ${action}ed.`);
    } finally {
      setWorkingProjectId(null);
    }
  };

  /** Session/page checks for any project change (the same gate the server applies). */
  const ensureCanChange = (): boolean => {
    if (!createCapability.allowed) { setError(createCapability.reason); return false; }
    setError('');
    return true;
  };

  const handleSubmitForm = async (values: ProjectFormValues): Promise<void> => {
    if (!formTarget) return;
    if (formTarget.mode === 'create') {
      const createdProjectId = await projectService.createProject(values);
      setFormTarget(null);
      toast.success('Project created');
      await refreshProjects();
      setOpeningProjectId(createdProjectId);
      // Like the website's "Initial Members": the new board opens with the invite picker ready.
      router.push({ pathname: '/projectManagement/[id]', params: { id: createdProjectId, invite: '1' } });
      return;
    }
    await projectService.updateProjectSettings(formTarget.project.id, values);
    setFormTarget(null);
    toast.success('Project updated');
    await refreshProjects();
  };

  const handleToggleArchive = async (project: ProjectRecord): Promise<void> => {
    setMenuProject(null);
    if (!ensureCanChange() || workingProjectId) return;
    const nextStatus: ProjectStatus = project.status === 'archived' ? 'active' : 'archived';
    setWorkingProjectId(project.id);
    try {
      await projectService.updateProjectSettings(project.id, { status: nextStatus });
      toast.success(nextStatus === 'archived' ? 'Project archived' : 'Project restored');
      await refreshProjects();
    } catch (archiveError: unknown) {
      setError(archiveError instanceof Error ? archiveError.message : 'The project could not be updated.');
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

  const focusProject = (items: ProjectRecord[]) => [...items].sort((firstProject, secondProject) =>
    firstProject.id === projectId ? -1 : secondProject.id === projectId ? 1 : 0);
  const invitations = focusProject(projects.filter((project) => project.membershipStatus === 'pending'));
  const acceptedProjects = projects.filter((project) => project.membershipStatus !== 'pending');

  // Same search / filters / sort as the website's ProjectToolbar.
  const visibleProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = acceptedProjects.filter((project) => (!term || `${project.name} ${project.description}`.toLowerCase().includes(term))
      && (statusFilter === 'all' || project.status === statusFilter)
      && (roleFilter === 'all' || project.role === roleFilter));
    const sorted = [...filtered].sort((first, second) => {
      const comparison = sortBy === 'name' ? first.name.localeCompare(second.name)
        : sortBy === 'progress' ? first.progress - second.progress
          : sortBy === 'created' ? toTime(first.createdAt) - toTime(second.createdAt)
            : toTime(first.updatedAt) - toTime(second.updatedAt);
      return sortDir === 'asc' ? comparison : -comparison;
    });
    return focusProject(sorted);
    // focusProject only depends on projectId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedProjects, projectId, roleFilter, searchTerm, sortBy, sortDir, statusFilter]);

  const stats = {
    active: acceptedProjects.filter((project) => project.status === 'active').length,
    completed: acceptedProjects.filter((project) => project.status === 'completed').length,
    totalTasks: acceptedProjects.reduce((sum, project) => sum + project.totalTasks, 0),
    owned: acceptedProjects.filter((project) => project.isOwner).length,
  };
  const heroTasks = visibleProjects.reduce((sum, project) => sum + project.totalTasks, 0);
  const menuCanEdit = Boolean(menuProject && (menuProject.isOwner || menuProject.role === 'admin'));

  const renderFilterRow = <T extends string>(options: { value: T; label: string }[], selected: T, onSelect: (value: T) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {options.map((option) => (
        <TouchableOpacity key={option.value} onPress={() => onSelect(option.value)} style={[styles.chip, selected === option.value && styles.chipSelected]}>
          <Text style={[styles.chipText, selected === option.value && styles.chipTextSelected]}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <PageHeader title="E-Projects" onBackPress={() => router.back()} />
      <SessionRetryBanner />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={projectResource.status === 'refreshing'} onRefresh={() => void refreshProjects()} tintColor="#10b981" />}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Briefcase size={30} color="#052e16" />
            <View style={styles.heroCopy}><Text style={styles.heroTitle}>Project Management</Text><Text style={styles.heroText}>Manage your projects, track progress, and collaborate with your team</Text></View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}><Text style={styles.heroStatValue}>{visibleProjects.length}</Text><Text style={styles.heroStatLabel}>{visibleProjects.length === 1 ? 'Total Project' : 'Total Projects'}</Text></View>
            <View style={styles.heroStat}><Text style={styles.heroStatValue}>{heroTasks}</Text><Text style={styles.heroStatLabel}>{heroTasks === 1 ? 'Total Task' : 'Total Tasks'}</Text></View>
          </View>
        </View>

        {!activeUserId ? <View style={styles.stateCard}><Text style={styles.stateTitle}>Sign in to use E-Projects</Text><Text style={styles.cardText}>Your projects and invitations are private to your account.</Text></View> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {projectResource.error && projectResource.data ? <Text accessibilityRole="alert" style={styles.staleNotice}>Showing saved projects. {projectResource.error.message}</Text> : null}
        {projectResource.error && !projectResource.data ? <View style={styles.stateCard}><Text accessibilityRole="alert" style={styles.error}>{projectResource.error.message}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry projects" onPress={() => void refreshProjects()} style={styles.retryButton}><Text style={styles.acceptText}>Retry</Text></TouchableOpacity></View> : null}
        {loading ? <ProjectManagementSkeleton /> : null}

        {sessionReady && !loading ? <View style={styles.statsGrid}>
          {[
            { label: stats.active === 1 ? 'Active Project' : 'Active Projects', value: String(stats.active), Icon: Activity, tint: colors.successSurface, iconColor: colors.accent },
            { label: stats.completed === 1 ? 'Completed Project' : 'Completed Projects', value: String(stats.completed), Icon: CheckCircle2, tint: '#dbeafe', iconColor: '#3b82f6' },
            { label: stats.totalTasks === 1 ? 'Total Task' : 'Total Tasks', value: String(stats.totalTasks), Icon: CheckSquare, tint: '#ede9fe', iconColor: '#8b5cf6' },
            { label: 'Your Role', value: 'Owner', sub: `in ${plural(stats.owned, 'project', 'projects')}`, Icon: Crown, tint: '#fef3c7', iconColor: '#d97706' },
          ].map((item) => (
            <View key={item.label} style={styles.statCard}>
              <View style={styles.flex}><Text numberOfLines={2} style={styles.statLabel}>{item.label}</Text><Text style={styles.statValue}>{item.value}</Text>{item.sub ? <Text style={styles.statSub}>{item.sub}</Text> : null}</View>
              <View style={[styles.statIcon, { backgroundColor: item.tint }]}><item.Icon size={20} color={item.iconColor} /></View>
            </View>
          ))}
        </View> : null}

        {sessionReady && !loading && invitations.length > 0 ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Invitations ({invitations.length})</Text>
          {invitations.map((project) => <View key={project.id} style={[styles.card, styles.inviteCard, project.id === projectId && styles.focusedCard]}>
            <Text style={styles.cardTitle}>{project.name}</Text><Text style={styles.cardText}>{project.description || 'You have been invited to collaborate on this project.'}</Text>
            <Text style={styles.inviter}>Invited by {project.invitedByName || 'Project owner'} · {project.role}</Text>
            <View style={styles.actions}>
              <TouchableOpacity disabled={!canMutate || !mutationReady || workingProjectId === project.id} onPress={() => void handleRespond(project.id, 'accept')} style={[styles.acceptButton, !mutationReady && styles.disabled]}><Check size={17} color="#ffffff" /><Text style={styles.acceptText}>Accept</Text></TouchableOpacity>
              <TouchableOpacity disabled={!canMutate || !mutationReady || workingProjectId === project.id} onPress={() => void handleRespond(project.id, 'decline')} style={[styles.declineButton, !mutationReady && styles.disabled]}><X size={17} color={colors.destructiveText} /><Text style={styles.declineText}>Decline</Text></TouchableOpacity>
            </View>
          </View>)}
        </View> : null}

        {sessionReady && !loading ? <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Projects ({visibleProjects.length})</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Create project" onPress={() => { if (ensureCanChange()) setFormTarget({ mode: 'create' }); }} style={[styles.createButton, !createCapability.allowed && styles.disabled]}><Plus size={20} color="#ffffff" /></TouchableOpacity>
          </View>
          <View style={styles.searchBox}><Search size={17} color={colors.mutedText} /><TextInput value={searchTerm} onChangeText={setSearchTerm} placeholder="Search projects..." placeholderTextColor={colors.mutedText} style={styles.searchInput} /></View>
          {renderFilterRow(STATUS_FILTERS, statusFilter, setStatusFilter)}
          {renderFilterRow(ROLE_FILTERS, roleFilter, setRoleFilter)}
          <View style={styles.sortRow}>
            <View style={styles.flex}>{renderFilterRow(SORTS, sortBy, setSortBy)}</View>
            <TouchableOpacity accessibilityLabel={sortDir === 'desc' ? 'Sort descending' : 'Sort ascending'} onPress={() => setSortDir((dir) => (dir === 'desc' ? 'asc' : 'desc'))} style={styles.sortDir}>
              <ArrowDownUp size={16} color={colors.text} /><Text style={styles.chipText}>{sortDir === 'desc' ? 'Desc' : 'Asc'}</Text>
            </TouchableOpacity>
          </View>

          {visibleProjects.length === 0 ? <View style={styles.empty}><FolderOpen size={38} color={colors.mutedText} /><Text style={styles.emptyTitle}>{acceptedProjects.length === 0 ? 'No projects yet' : 'No matching projects'}</Text><Text style={styles.cardText}>{acceptedProjects.length === 0 ? 'Create your first project or accept a team invitation.' : 'Try a different search or filter.'}</Text></View> : visibleProjects.map((project) => {
            const dueLabel = formatDueDate(project.dueDate);
            const canEdit = project.isOwner || project.role === 'admin';
            return (
              <TouchableOpacity
                key={project.id}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Open ${project.name} project board`}
                disabled={openingProjectId !== null}
                onPress={() => handleOpenProject(project.id)}
                style={[styles.card, project.id === projectId && styles.focusedCard, (openingProjectId === project.id || workingProjectId === project.id) && styles.openingCard]}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{project.name}</Text>
                  {canEdit ? <TouchableOpacity accessibilityLabel={`Options for ${project.name}`} hitSlop={8} onPress={() => setMenuProject(project)} style={styles.menuButton}><MoreHorizontal size={18} color={colors.mutedText} /></TouchableOpacity> : null}
                </View>
                <View style={styles.badges}>
                  <Text style={[styles.badge, styles.statusBadge, project.status === 'archived' && styles.mutedBadge, project.status === 'on-hold' && styles.warningBadge]}>{project.status}</Text>
                  <Text style={[styles.badge, styles.roleBadge]}>{project.role}</Text>
                </View>
                <Text style={styles.cardText}>{project.description || 'No description'}</Text>
                <View style={styles.meta}><UserRound size={15} color={colors.mutedText} /><Text numberOfLines={1} style={[styles.metaText, styles.flex]}>Owner: {project.ownerName || 'Project owner'}</Text></View>
                <View style={styles.progressHeader}><Text style={styles.metaText}>Progress</Text><Text style={styles.progressValue}>{project.progress}%</Text></View>
                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, project.progress))}%` }]} /></View>
                <View style={styles.metaRow}>
                  <View style={styles.meta}><CheckSquare size={14} color={colors.mutedText} /><Text style={styles.metaText}>{project.completedTasks}/{plural(project.totalTasks, 'task', 'tasks')}</Text></View>
                  <View style={styles.meta}><Users size={14} color={colors.mutedText} /><Text style={styles.metaText}>{plural(project.teamMembers, 'member', 'members')}</Text></View>
                </View>
                <View style={styles.metaRow}>
                  <View style={styles.meta}><Clock size={14} color={colors.mutedText} /><Text style={styles.metaText}>Last activity: {formatLastActivity(project.updatedAt)}</Text></View>
                  {dueLabel ? <View style={styles.meta}><CalendarDays size={14} color={colors.mutedText} /><Text style={styles.metaText}>Due: {dueLabel}</Text></View> : null}
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.role}>Your role: {project.role}</Text>
                  <View style={styles.meta}>
                    {openingProjectId === project.id ? <ActivityIndicator size="small" color={colors.accent} /> : <ArrowRight size={14} color={colors.accent} />}
                    <Text style={styles.openText}>{openingProjectId === project.id ? 'Opening…' : 'Open Board'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View> : null}
      </ScrollView>

      {/* Card options (website: Edit / Archive / Delete) */}
      <Modal visible={menuProject !== null} transparent animationType="fade" onRequestClose={() => setMenuProject(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuProject(null)}>
          <Pressable style={styles.menuSheet}>
            <Text numberOfLines={1} style={styles.menuTitle}>{menuProject?.name}</Text>
            {menuCanEdit && menuProject ? <TouchableOpacity style={styles.menuItem} onPress={() => { const project = menuProject; setMenuProject(null); if (ensureCanChange()) setFormTarget({ mode: 'edit', project }); }}><Pencil size={18} color={colors.text} /><Text style={styles.menuText}>Edit</Text></TouchableOpacity> : null}
            {menuCanEdit && menuProject ? <TouchableOpacity style={styles.menuItem} onPress={() => void handleToggleArchive(menuProject)}>{menuProject.status === 'archived' ? <ArchiveRestore size={18} color={colors.text} /> : <Archive size={18} color={colors.text} />}<Text style={styles.menuText}>{menuProject.status === 'archived' ? 'Unarchive' : 'Archive'}</Text></TouchableOpacity> : null}
            {menuProject?.isOwner ? <TouchableOpacity style={styles.menuItem} onPress={() => { const project = menuProject; setMenuProject(null); if (ensureCanChange()) setDeleteTarget(project); }}><Trash2 size={18} color={colors.destructive} /><Text style={[styles.menuText, { color: colors.destructiveText }]}>Delete</Text></TouchableOpacity> : null}
            <TouchableOpacity style={styles.menuCancel} onPress={() => setMenuProject(null)}><Text style={styles.menuText}>Cancel</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ProjectFormSheet
        visible={formTarget !== null}
        project={formTarget?.mode === 'edit' ? formTarget.project : null}
        onClose={() => setFormTarget(null)}
        onSubmit={handleSubmitForm}
      />
      <CustomModal
        visible={deleteTarget !== null}
        type="danger"
        title="Delete project?"
        message={`${deleteTarget?.name ?? 'This project'} and all of its tasks will be permanently removed for every member.`}
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

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 48, gap: 18 }, flex: { flex: 1 },
  hero: { borderRadius: 22, padding: 18, backgroundColor: '#34d399', gap: 16 }, heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, heroCopy: { flex: 1 }, heroTitle: { color: '#052e16', fontSize: 21, fontWeight: '900' }, heroText: { color: '#064e3b', fontSize: 13, marginTop: 3 },
  heroStats: { flexDirection: 'row', gap: 10 }, heroStat: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.28)' }, heroStatValue: { color: '#ffffff', fontSize: 24, fontWeight: '900' }, heroStatLabel: { color: '#064e3b', fontSize: 12, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, statCard: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, statLabel: { color: colors.mutedText, fontSize: 12 }, statValue: { color: colors.text, fontSize: 22, fontWeight: '900' }, statSub: { color: colors.mutedText, fontSize: 11 }, statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 12 }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, createButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input }, searchInput: { flex: 1, minHeight: 44, color: colors.text },
  chipRow: { gap: 8, paddingRight: 8 }, chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control }, chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent }, chipText: { color: colors.secondaryText, fontSize: 12, fontWeight: '800' }, chipTextSelected: { color: colors.onAccent },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, sortDir: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16, gap: 9 }, inviteCard: { borderColor: '#6ee7b7' }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, cardTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '800' }, cardText: { color: colors.mutedText, fontSize: 14, lineHeight: 20 }, inviter: { color: colors.text, fontSize: 13, fontWeight: '700' },
  menuButton: { padding: 4, borderRadius: 999 }, badges: { flexDirection: 'row', gap: 6 }, badge: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3, fontSize: 11, fontWeight: '800', textTransform: 'capitalize', overflow: 'hidden' }, statusBadge: { color: colors.successText, backgroundColor: colors.successSurface }, mutedBadge: { color: colors.mutedText, backgroundColor: colors.control }, warningBadge: { color: colors.warningText, backgroundColor: colors.warningSurface }, roleBadge: { color: '#6d28d9', backgroundColor: '#ede9fe' },
  focusedCard: { borderColor: colors.accent, borderWidth: 2 }, openingCard: { opacity: 0.72 },
  meta: { flexDirection: 'row', gap: 6, alignItems: 'center' }, metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }, metaText: { color: colors.mutedText, fontSize: 12 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' }, progressValue: { color: colors.text, fontSize: 12, fontWeight: '800' }, progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.control, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }, role: { color: colors.accentText, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' }, openText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 }, acceptButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, acceptText: { color: colors.onAccent, fontWeight: '800' }, declineButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: colors.destructiveSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, declineText: { color: colors.destructiveText, fontWeight: '800' }, disabled: { opacity: 0.5 },
  empty: { alignItems: 'center', paddingVertical: 34, gap: 8 }, emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' }, error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12 }, staleNotice: { color: colors.warningText, backgroundColor: colors.warningSurface, borderRadius: 12, padding: 12 }, stateCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 18, gap: 9 }, stateTitle: { color: colors.text, fontSize: 17, fontWeight: '800' }, retryButton: { alignSelf: 'flex-start', minHeight: 44, borderRadius: 12, backgroundColor: colors.accent, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'flex-end' }, menuSheet: { backgroundColor: colors.surface, padding: 16, paddingBottom: 32, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 4 }, menuTitle: { color: colors.mutedText, fontSize: 13, fontWeight: '700', marginBottom: 6, paddingHorizontal: 4 }, menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 6 }, menuText: { color: colors.text, fontSize: 15, fontWeight: '700' }, menuCancel: { marginTop: 6, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: colors.control },
});

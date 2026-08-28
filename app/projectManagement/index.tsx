import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ArrowRight, Check, FolderOpen, Plus, UserRound, Users, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PageHeader from '@/components/ui/PageHeader';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { projectService } from '@/lib/services/ProjectService';
import type { ProjectRecord } from '@/lib/types/project';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';

export default function ProjectManagementScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [workingProjectId, setWorkingProjectId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const swipeDismiss = useSwipeDismiss({ visible: createOpen, onDismiss: () => setCreateOpen(false), disabled: creating });

  const loadProjects = useCallback(async (claimInvites: boolean) => {
    setError('');
    try {
      if (claimInvites) await projectService.claimEmailInvites().catch(() => 0);
      setProjects(await projectService.listForCurrentUser());
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Projects could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadProjects(true); }, [loadProjects]);

  const handleRespond = async (projectId: string, action: 'accept' | 'decline') => {
    setWorkingProjectId(projectId);
    setError('');
    try {
      await projectService.respondToInvite(projectId, action);
      await loadProjects(false);
    } catch (responseError: unknown) {
      setError(responseError instanceof Error ? responseError.message : `The invitation could not be ${action}ed.`);
    } finally {
      setWorkingProjectId(null);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      await projectService.createProject({ name, description });
      setName(''); setDescription(''); setCreateOpen(false);
      await loadProjects(false);
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : 'The project could not be created.');
    } finally {
      setCreating(false);
    }
  };

  const focusProject = (items: ProjectRecord[]) => [...items].sort((firstProject, secondProject) =>
    firstProject.id === projectId ? -1 : secondProject.id === projectId ? 1 : 0);
  const invitations = focusProject(projects.filter((project) => project.membershipStatus === 'pending'));
  const acceptedProjects = focusProject(projects.filter((project) => project.membershipStatus === 'accepted'));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <PageHeader title="E-Projects" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadProjects(true); }} tintColor="#10b981" />}>
        <View style={styles.hero}>
          <FolderOpen size={30} color="#052e16" />
          <View style={styles.heroCopy}><Text style={styles.heroTitle}>Project Management</Text><Text style={styles.heroText}>Collaborate, track progress, and respond to team invitations.</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Create project" onPress={() => setCreateOpen(true)} style={styles.createButton}><Plus size={20} color="#ffffff" /></TouchableOpacity>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#10b981" style={styles.loader} /> : null}
        {!loading && invitations.length > 0 ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Invitations ({invitations.length})</Text>
          {invitations.map((project) => <View key={project.id} style={[styles.card, styles.inviteCard, project.id === projectId && styles.focusedCard]}>
            <Text style={styles.cardTitle}>{project.name}</Text><Text style={styles.cardText}>{project.description || 'You have been invited to collaborate on this project.'}</Text>
            <Text style={styles.inviter}>Invited by {project.invitedByName || 'Project owner'} · {project.role}</Text>
            <View style={styles.actions}>
              <TouchableOpacity disabled={workingProjectId === project.id} onPress={() => void handleRespond(project.id, 'accept')} style={styles.acceptButton}><Check size={17} color="#ffffff" /><Text style={styles.acceptText}>Accept</Text></TouchableOpacity>
              <TouchableOpacity disabled={workingProjectId === project.id} onPress={() => void handleRespond(project.id, 'decline')} style={styles.declineButton}><X size={17} color={colors.destructiveText} /><Text style={styles.declineText}>Decline</Text></TouchableOpacity>
            </View>
          </View>)}
        </View> : null}
        {!loading ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Projects ({acceptedProjects.length})</Text>
          {acceptedProjects.length === 0 ? <View style={styles.empty}><FolderOpen size={38} color={colors.mutedText} /><Text style={styles.emptyTitle}>No projects yet</Text><Text style={styles.cardText}>Create your first project or accept a team invitation.</Text></View> : acceptedProjects.map((project) => (
            <TouchableOpacity
              key={project.id}
              activeOpacity={0.75}
              onPress={() => router.push(`/projectManagement/${project.id}` as never)}
              style={[styles.card, project.id === projectId && styles.focusedCard]}
            >
              <View style={styles.cardHeader}><Text style={styles.cardTitle}>{project.name}</Text><Text style={styles.status}>{project.status}</Text></View>
              <Text style={styles.cardText}>{project.description || 'No description'}</Text>
              <View style={styles.meta}><UserRound size={15} color={colors.mutedText} /><Text numberOfLines={1} style={[styles.metaText, styles.flex]}>Owner: {project.ownerName || 'Project owner'}</Text></View>
              <View style={styles.meta}><Users size={15} color={colors.mutedText} /><Text style={styles.metaText}>{project.teamMembers} members · {project.totalTasks} tasks · {project.progress}%</Text></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text style={styles.role}>Your role: {project.role}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>Open Board</Text>
                  <ArrowRight size={14} color={colors.accent} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View> : null}
      </ScrollView>
      <Modal visible={createOpen} transparent animationType="none" onRequestClose={swipeDismiss.dismissWithAnimation}><View style={styles.modalBackdrop}><Animated.View style={[styles.modalCard, swipeDismiss.animatedStyle]}>
        <SwipeDismissHandle gesture={swipeDismiss.gesture} color={colors.border} animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close project creation" />
        <Text style={styles.modalTitle}>Create Project</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Project name" placeholderTextColor={colors.mutedText} style={styles.input} />
        <TextInput value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={colors.mutedText} multiline style={[styles.input, styles.descriptionInput]} />
        <View style={styles.actions}><TouchableOpacity onPress={() => setCreateOpen(false)} style={styles.declineButton}><Text style={styles.declineText}>Cancel</Text></TouchableOpacity><TouchableOpacity disabled={creating || !name.trim()} onPress={() => void handleCreate()} style={[styles.acceptButton, (!name.trim() || creating) && styles.disabled]}>{creating ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.acceptText}>Create</Text>}</TouchableOpacity></View>
      </Animated.View></View></Modal>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 18, paddingBottom: 48, gap: 20 },
  hero: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, padding: 18, backgroundColor: '#34d399', gap: 12 }, heroCopy: { flex: 1 }, heroTitle: { color: '#052e16', fontSize: 21, fontWeight: '900' }, heroText: { color: '#064e3b', fontSize: 13, marginTop: 3 }, createButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#047857', alignItems: 'center', justifyContent: 'center' },
  section: { gap: 12 }, sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16, gap: 9 }, inviteCard: { borderColor: '#6ee7b7' }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, cardTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '800' }, cardText: { color: colors.mutedText, fontSize: 14, lineHeight: 20 }, inviter: { color: colors.text, fontSize: 13, fontWeight: '700' },
  focusedCard: { borderColor: colors.accent, borderWidth: 2 },
  status: { color: colors.successText, backgroundColor: colors.successSurface, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' }, meta: { flexDirection: 'row', gap: 6, alignItems: 'center' }, metaText: { color: colors.mutedText, fontSize: 12 }, flex: { flex: 1 }, role: { color: colors.accentText, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 }, acceptButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, acceptText: { color: colors.onAccent, fontWeight: '800' }, declineButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: colors.destructiveSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, declineText: { color: colors.destructiveText, fontWeight: '800' }, disabled: { opacity: 0.5 },
  empty: { alignItems: 'center', paddingVertical: 34, gap: 8 }, emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' }, loader: { marginVertical: 40 }, error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12 }, modalBackdrop: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'flex-end' }, modalCard: { backgroundColor: colors.surface, padding: 20, paddingBottom: 36, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 14 }, modalTitle: { color: colors.text, fontSize: 20, fontWeight: '900' }, input: { borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, backgroundColor: colors.control }, descriptionInput: { minHeight: 100, textAlignVertical: 'top' },
});

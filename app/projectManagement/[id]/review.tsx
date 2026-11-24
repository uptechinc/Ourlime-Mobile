import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Eye, FileText, Flag, Link2, MessageCircleQuestion, Package } from 'lucide-react-native';
import { toast } from 'sonner-native';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { PROJECT_GUTTER, PROJECT_RIPPLE, ProjectButton, ProjectEmptyState, ProjectPill, ProjectScreenHeader, ProjectSection, type ProjectTone } from '@/components/projectManagement/ProjectUiParts';
import { ProjectNoteSheet, formatWhen } from '@/components/projectManagement/ProjectFormParts';
import { formatCalendarDate } from '@/components/projectManagement/projectFormat';
import { DELIVERABLE_NOTE_LIMIT, projectOperationsService, QUESTION_TEXT_LIMIT } from '@/lib/services/ProjectOperationsService';
import type { PortalDeliverable, PortalQuestion, StakeholderPortal } from '@/lib/types/project';

const STATUS: { [status: string]: { label: string; tone: ProjectTone } } = {
  draft: { label: 'In progress', tone: 'neutral' }, submitted: { label: 'Waiting for review', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' }, changes_requested: { label: 'Changes requested', tone: 'danger' },
};
type Prompt = { kind: 'accept' | 'changes'; deliverable: PortalDeliverable } | { kind: 'ask' } | { kind: 'answer'; question: PortalQuestion };

function promptMessage(prompt: Prompt | null): string {
  if (!prompt) return '';
  if (prompt.kind === 'accept' || prompt.kind === 'changes') return `You are reviewing version ${prompt.deliverable.revision} of "${prompt.deliverable.title}". Your decision and the time are recorded.`;
  if (prompt.kind === 'answer') return prompt.question.body;
  return 'The project team sees your question.';
}

/**
 * What a client or reviewer sees (website /projectManagement/[projectId]/review): only the milestones and deliverables
 * shared with them and the project's questions, never tasks, the team, time or anything else. A pending invitee accepts
 * or declines here. Project members can open it to check what is shared.
 */
export default function ProjectReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = typeof id === 'string' ? id : '';
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();
  const [portal, setPortal] = useState<StakeholderPortal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const load = useCallback(async () => {
    if (!projectId || !activeUserId) return;
    setError('');
    try {
      setPortal(await projectOperationsService.portal(projectId));
    } catch (failure: unknown) {
      console.error('[ProjectReviewScreen.load] Error:', failure);
      setPortal(null);
      setError('This project is not shared with you, or the invitation is no longer available.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeUserId, projectId]);
  useEffect(() => { void load(); }, [load]);

  const respond = async (decision: 'accept' | 'decline'): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await projectOperationsService.respondToReview(projectId, decision);
      toast.success(decision === 'accept' ? 'Invitation accepted' : 'Invitation declined');
      if (decision === 'decline') router.replace('/projectManagement');
      else await load();
    } catch (failure: unknown) {
      toast.error(failure instanceof Error ? failure.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const leave = async (): Promise<void> => {
    if (!activeUserId || busy) return;
    setBusy(true);
    try {
      await projectOperationsService.removeStakeholder(projectId, activeUserId);
      toast.success('You no longer have access');
      router.replace('/projectManagement');
    } catch (failure: unknown) {
      toast.error(failure instanceof Error ? failure.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
      setLeaveOpen(false);
    }
  };

  const header = <ProjectScreenHeader title={portal?.project.name ?? 'Project review'} subtitle="Shared with you" onBack={() => router.back()} />;
  if (loading) return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>{header}<ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} /></SafeAreaView>;
  if (!portal) {
    return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      {header}
      <View style={{ flex: 1, justifyContent: 'center', padding: PROJECT_GUTTER }}>
        <ProjectEmptyState icon={<Eye size={40} color={colors.mutedText} />} title="Nothing to review" hint={error} actionLabel="Try again" onAction={() => { setLoading(true); void load(); }} secondaryLabel="Back to projects" onSecondary={() => router.replace('/projectManagement')} />
      </View>
    </SafeAreaView>;
  }

  const { viewer } = portal;
  const isStakeholder = viewer.role === 'client' || viewer.role === 'reviewer';
  const canAsk = viewer.role === 'client' && viewer.status === 'accepted';
  const muted = { color: colors.mutedText, fontSize: 13, lineHeight: 18 } as const;

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: PROJECT_GUTTER, gap: 12, paddingBottom: 48 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor="#10b981" />}>
        {!isStakeholder ? <Text style={muted}>Preview: this is everything clients and reviewers see on this project.</Text> : null}

        {viewer.status === 'pending' ? (
          <ProjectSection title={`You were invited as a ${viewer.role}`} icon={<Eye size={18} color={colors.accent} />}>
            <Text style={muted}>You will see only the milestones and deliverables the team shares with you, and you can {viewer.role === 'client' ? 'ask questions and ' : ''}sign off work they ask you to review. You will not see the team, tasks or anything else.</Text>
            {viewer.expiresAt ? <Text style={muted}>This invitation expires {formatWhen(viewer.expiresAt)}.</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ProjectButton label="Decline" variant="secondary" onPress={() => void respond('decline')} isDisabled={busy} style={{ flex: 1 }} />
              <ProjectButton label="Accept" onPress={() => void respond('accept')} isBusy={busy} style={{ flex: 1 }} />
            </View>
          </ProjectSection>
        ) : <>
          <ProjectSection title={`Milestones (${portal.milestones.length})`} icon={<Flag size={18} color={colors.accent} />}>
            {portal.milestones.length === 0 ? <Text style={muted}>No milestones are shared with you yet.</Text> : portal.milestones.map((milestone) => (
              <View key={milestone.id} style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {milestone.completed ? <CheckCircle2 size={16} color={colors.successText} /> : null}
                  <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' }}>{milestone.name}</Text>
                  <ProjectPill label={milestone.completed ? 'Done' : 'In progress'} tone={milestone.completed ? 'success' : 'neutral'} />
                </View>
                {milestone.dueDate ? <Text style={muted}>Due {formatCalendarDate(milestone.dueDate)}</Text> : null}
                {milestone.description ? <Text style={muted}>{milestone.description}</Text> : null}
              </View>
            ))}
          </ProjectSection>

          <ProjectSection title={`Deliverables (${portal.deliverables.length})`} icon={<Package size={18} color={colors.accent} />}>
            {portal.deliverables.length === 0 ? <Text style={muted}>No deliverables are shared with you yet.</Text> : portal.deliverables.map((deliverable, index) => {
              const status = STATUS[deliverable.status] ?? { label: deliverable.status, tone: 'neutral' as ProjectTone };
              return (
                <View key={deliverable.id} style={{ gap: 6, paddingTop: index === 0 ? 0 : 12, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{deliverable.title}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <ProjectPill label={status.label} tone={status.tone} />
                    {deliverable.revision ? <ProjectPill label={`Version ${deliverable.revision}`} tone="neutral" /> : null}
                  </View>
                  {deliverable.dueDate ? <Text style={muted}>Due {formatCalendarDate(deliverable.dueDate)}</Text> : null}
                  {deliverable.description ? <Text style={muted}>{deliverable.description}</Text> : null}
                  {deliverable.acceptanceCriteria.length ? <View style={{ gap: 3 }}>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Acceptance criteria</Text>
                    {deliverable.acceptanceCriteria.map((criterion) => <Text key={criterion} style={muted}>• {criterion}</Text>)}
                  </View> : null}
                  {deliverable.evidence.map((evidence) => (
                    <Pressable key={evidence.id} onPress={() => void Linking.openURL(evidence.url)} android_ripple={PROJECT_RIPPLE} accessibilityRole="link" accessibilityLabel={`Open ${evidence.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, overflow: 'hidden' }}>
                      {evidence.kind === 'file' ? <FileText size={16} color={colors.accent} /> : <Link2 size={16} color={colors.accent} />}
                      <Text numberOfLines={1} style={{ flex: 1, color: colors.accent, fontSize: 13, fontWeight: '700' }}>{evidence.name}</Text>
                    </Pressable>
                  ))}
                  {deliverable.review ? <Text style={muted}>{deliverable.review.decision === 'accepted' ? 'Accepted' : 'Changes requested'} on version {deliverable.review.revision} by {deliverable.review.decidedRole === 'stakeholder' ? 'a client or reviewer' : 'the project team'}, {formatWhen(deliverable.review.decidedAt)}{deliverable.review.note ? `: "${deliverable.review.note}"` : ''}</Text> : null}
                  {deliverable.canReview && isStakeholder ? (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <ProjectButton isCompact variant="danger" label="Request changes" onPress={() => setPrompt({ kind: 'changes', deliverable })} style={{ flex: 1 }} />
                      <ProjectButton isCompact label="Accept" onPress={() => setPrompt({ kind: 'accept', deliverable })} style={{ flex: 1 }} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </ProjectSection>

          <ProjectSection title="Questions" icon={<MessageCircleQuestion size={18} color={colors.accent} />} action={canAsk ? <ProjectButton isCompact variant="secondary" label="Ask" onPress={() => setPrompt({ kind: 'ask' })} /> : null}>
            {portal.questions.length === 0 ? <Text style={muted}>No questions yet.</Text> : portal.questions.map((question, index) => (
              <View key={question.id} style={{ gap: 4, paddingTop: index === 0 ? 0 : 10, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{question.body}</Text>
                <Text style={muted}>{question.mine ? 'You asked' : question.askedByRole === 'stakeholder' ? 'A client asked' : 'The project team asked'}{question.createdAt ? `, ${formatWhen(question.createdAt)}` : ''}</Text>
                {question.status === 'answered' ? <Text style={{ color: colors.secondaryText, fontSize: 13 }}>Answer: {question.answer}</Text> : <Text style={muted}>Waiting for an answer</Text>}
                {isStakeholder && viewer.status === 'accepted' && question.status !== 'answered' && question.askedByRole === 'team' ? <ProjectButton isCompact variant="secondary" label="Answer" onPress={() => setPrompt({ kind: 'answer', question })} style={{ alignSelf: 'flex-start' }} /> : null}
              </View>
            ))}
          </ProjectSection>

          {isStakeholder ? <ProjectButton variant="danger" label="Leave this project" onPress={() => setLeaveOpen(true)} /> : null}
        </>}
      </ScrollView>

      <ProjectNoteSheet
        visible={prompt !== null}
        title={prompt?.kind === 'accept' ? 'Accept this deliverable?' : prompt?.kind === 'changes' ? 'Request changes?' : prompt?.kind === 'ask' ? 'Ask the project team' : 'Answer the team'}
        message={promptMessage(prompt)}
        label={prompt?.kind === 'changes' ? 'What needs to change' : prompt?.kind === 'ask' ? 'Your question' : prompt?.kind === 'answer' ? 'Your answer' : 'Note (optional)'}
        confirmLabel={prompt?.kind === 'accept' ? 'Accept' : prompt?.kind === 'changes' ? 'Request changes' : prompt?.kind === 'ask' ? 'Ask' : 'Send answer'}
        isRequired={prompt?.kind !== 'accept'}
        tone={prompt?.kind === 'changes' ? 'danger' : 'primary'}
        maxLength={prompt?.kind === 'ask' || prompt?.kind === 'answer' ? QUESTION_TEXT_LIMIT : DELIVERABLE_NOTE_LIMIT}
        onClose={() => setPrompt(null)}
        onConfirm={async (note) => {
          if (!prompt) return;
          if (prompt.kind === 'accept' || prompt.kind === 'changes') {
            await projectOperationsService.reviewDeliverable(projectId, prompt.deliverable.id, prompt.kind === 'accept' ? 'accepted' : 'changes_requested', note, prompt.deliverable.revision);
            toast.success(prompt.kind === 'accept' ? 'Deliverable accepted' : 'Changes requested');
          } else if (prompt.kind === 'answer') {
            await projectOperationsService.answerQuestion(projectId, prompt.question.id, note);
            toast.success('Answer sent');
          } else {
            await projectOperationsService.askQuestion(projectId, note);
            toast.success('Question sent');
          }
          await load();
        }}
      />
      <CustomModal
        visible={leaveOpen}
        type="danger"
        title="Leave this project?"
        message="You will no longer see anything shared on it. The team can invite you again."
        confirmText="Leave"
        cancelText="Stay"
        isLoading={busy}
        onConfirm={() => void leave()}
        onCancel={() => setLeaveOpen(false)}
        onClose={() => setLeaveOpen(false)}
      />
    </SafeAreaView>
  );
}

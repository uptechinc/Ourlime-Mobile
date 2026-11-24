import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';
import { Eye, Flag, MessageCircleQuestion, UserPlus } from 'lucide-react-native';
import { toast } from 'sonner-native';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { PanelHeader } from '@/components/projectManagement/ProjectPanelParts';
import { ProjectButton, ProjectPill, ProjectSection } from '@/components/projectManagement/ProjectUiParts';
import { ProjectEditSheet, ProjectListRow, ProjectNoteSheet, ProjectOptionChips, ProjectTextField, formatWhen, projectListStyle } from '@/components/projectManagement/ProjectFormParts';
import { formatCalendarDate } from '@/components/projectManagement/projectFormat';
import { projectOperationsService, QUESTION_TEXT_LIMIT } from '@/lib/services/ProjectOperationsService';
import type { Milestone, PortalQuestion, ProjectStakeholder, StakeholderRole } from '@/lib/types/project';

type ProjectClientsPanelProps = {
  projectId: string;
  milestones: Milestone[];
  stakeholders: ProjectStakeholder[];
  stakeholderNames: { [uid: string]: string };
  /** The owner or an admin, on an active project. */
  canManage: boolean;
  /** A contributor on an active project (asks and answers questions). */
  canWrite: boolean;
  onReload: () => Promise<void>;
  onOpenReview: () => void;
};

const ROLE_OPTIONS: { value: StakeholderRole; label: string }[] = [{ value: 'client', label: 'Client' }, { value: 'reviewer', label: 'Reviewer' }];
const ROLE_HINT: { [role in StakeholderRole]: string } = {
  client: 'Sees what you share, asks and answers questions, and signs off deliverables that name them.',
  reviewer: 'Sees what you share, answers questions and signs off deliverables that name them.',
};

/**
 * Clients and reviewers (website ProjectClientsTab): people outside the team with an Ourlime account, invited by
 * username. They see only the milestones and deliverables shared with them and the questions, never the rest of the
 * project. Owners and admins invite, change roles, remove and share; contributors ask and answer questions.
 */
export default function ProjectClientsPanel({ projectId, milestones, stakeholders, stakeholderNames, canManage, canWrite, onReload, onOpenReview }: ProjectClientsPanelProps) {
  const { colors } = useAppTheme();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [role, setRole] = useState<StakeholderRole>('client');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [removing, setRemoving] = useState<ProjectStakeholder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PortalQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [answering, setAnswering] = useState<PortalQuestion | null>(null);

  const loadQuestions = useCallback(async () => {
    try {
      setQuestions((await projectOperationsService.portal(projectId)).questions);
    } catch (error: unknown) {
      console.error('[ProjectClientsPanel.loadQuestions] Error:', error);
    } finally {
      setQuestionsLoading(false);
    }
  }, [projectId]);
  useEffect(() => { void loadQuestions(); }, [loadQuestions]);

  const run = async (id: string, work: () => Promise<void>, done: string): Promise<void> => {
    if (busyId) return;
    setBusyId(id);
    try {
      await work();
      toast.success(done);
      await onReload();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'That did not save. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleInvite = async (): Promise<void> => {
    if (saving) return;
    if (!recipient.trim()) { setFormError('Enter their Ourlime username.'); return; }
    setSaving(true);
    setFormError('');
    try {
      await projectOperationsService.inviteStakeholder(projectId, recipient, role);
      toast.success('Invitation sent');
      setInviteOpen(false);
      setRecipient('');
      await onReload();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'The invitation could not be sent. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const nameOf = (uid: string): string => stakeholderNames[uid] ?? 'Ourlime member';
  const sharedCount = milestones.filter((milestone) => milestone.sharedWithStakeholders).length;

  return (
    <View style={{ gap: 12 }}>
      <PanelHeader
        icon={<Eye size={18} color={colors.accent} />}
        title="Clients and reviewers"
        description="Invite people outside the team to see chosen milestones and deliverables, ask questions and sign off. They never see tasks, the team, time or the rest of the project."
        action={<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {canManage ? <ProjectButton label="Invite" icon={<UserPlus size={18} color="#ffffff" />} onPress={() => { setFormError(''); setInviteOpen(true); }} /> : null}
          <ProjectButton variant="secondary" label="See what they see" onPress={onOpenReview} />
        </View>}
      />

      <ProjectSection title={`People (${stakeholders.length})`}>
        {stakeholders.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 13 }}>Nobody outside the team has access yet.</Text> : (
          <View style={projectListStyle(colors)}>
            {stakeholders.map((stakeholder, index) => {
              const busy = busyId === stakeholder.uid;
              const expired = stakeholder.status === 'pending' && stakeholder.expiresAt !== null && stakeholder.expiresAt.getTime() <= Date.now();
              return (
                <ProjectListRow
                  key={stakeholder.id}
                  isFirst={index === 0}
                  title={nameOf(stakeholder.uid)}
                  detail={stakeholder.status === 'accepted' ? ROLE_HINT[stakeholder.role] : expired ? 'Invitation expired' : `Invited${stakeholder.expiresAt ? `, expires ${formatWhen(stakeholder.expiresAt)}` : ''}`}
                  right={<ProjectPill label={stakeholder.role === 'client' ? 'Client' : 'Reviewer'} tone={stakeholder.status === 'accepted' ? 'success' : 'warning'} />}
                >
                  {canManage ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                      {stakeholder.status === 'accepted' ? <ProjectButton isCompact variant="secondary" label={`Make ${stakeholder.role === 'client' ? 'reviewer' : 'client'}`} isBusy={busy} onPress={() => void run(stakeholder.uid, () => projectOperationsService.setStakeholderRole(projectId, stakeholder.uid, stakeholder.role === 'client' ? 'reviewer' : 'client'), 'Role changed')} /> : null}
                      {stakeholder.status === 'pending' ? <ProjectButton isCompact variant="secondary" label="Send again" isBusy={busy} onPress={() => void run(stakeholder.uid, () => projectOperationsService.inviteStakeholder(projectId, stakeholder.uid, stakeholder.role), 'Invitation sent again')} /> : null}
                      <ProjectButton isCompact variant="danger" label={stakeholder.status === 'pending' ? 'Cancel invitation' : 'Remove access'} isDisabled={busy} onPress={() => setRemoving(stakeholder)} />
                    </View>
                  ) : null}
                </ProjectListRow>
              );
            })}
          </View>
        )}
      </ProjectSection>

      <ProjectSection title={`Shared milestones (${sharedCount})`} icon={<Flag size={16} color={colors.mutedText} />}>
        {milestones.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 13 }}>No milestones yet.</Text> : milestones.map((milestone) => (
          <View key={milestone.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{milestone.name}</Text>
              {milestone.dueDate ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>Due {formatCalendarDate(milestone.dueDate)}</Text> : null}
            </View>
            {busyId === `m_${milestone.id}` ? <ActivityIndicator color={colors.accent} /> : (
              <Switch
                value={milestone.sharedWithStakeholders === true}
                disabled={!canManage || busyId !== null}
                onValueChange={(shared) => void run(`m_${milestone.id}`, () => projectOperationsService.shareMilestone(projectId, milestone.id, shared), shared ? 'Milestone shared' : 'Milestone no longer shared')}
                accessibilityLabel={`Share ${milestone.name} with clients and reviewers`}
              />
            )}
          </View>
        ))}
        <Text style={{ color: colors.mutedText, fontSize: 12 }}>Share deliverables from the Deliverables page.</Text>
      </ProjectSection>

      <ProjectSection title="Questions" icon={<MessageCircleQuestion size={16} color={colors.mutedText} />} action={canWrite ? <ProjectButton isCompact variant="secondary" label="Ask clients" onPress={() => setAsking(true)} /> : null}>
        {questionsLoading ? <ActivityIndicator color={colors.accent} /> : questions.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 13 }}>No questions yet.</Text> : (
          <View style={projectListStyle(colors)}>
            {questions.map((question, index) => (
              <ProjectListRow
                key={question.id}
                isFirst={index === 0}
                title={question.body}
                detail={[question.askedByRole === 'stakeholder' ? 'From a client' : 'From the team', formatWhen(question.createdAt), question.status === 'answered' ? `Answer: ${question.answer}` : 'Waiting for an answer'].filter(Boolean).join(' · ')}
                right={canWrite && question.status !== 'answered' && question.askedByRole === 'stakeholder' ? <ProjectButton isCompact label="Answer" onPress={() => setAnswering(question)} /> : null}
              />
            ))}
          </View>
        )}
      </ProjectSection>

      <ProjectEditSheet visible={inviteOpen} title="Invite a client or reviewer" subtitle="They need an Ourlime account. They see only what you share with them." saveLabel="Send invitation" isSaving={saving} error={formError} onSave={() => void handleInvite()} onClose={() => setInviteOpen(false)}>
        <ProjectTextField label="Their Ourlime username" value={recipient} onChangeText={setRecipient} keyboardType="url" isRequired />
        <ProjectOptionChips label="Role" value={role} options={ROLE_OPTIONS} onChange={setRole} />
        <Text style={{ color: colors.mutedText, fontSize: 12 }}>{ROLE_HINT[role]} The invitation expires after 14 days.</Text>
      </ProjectEditSheet>

      <ProjectNoteSheet
        visible={asking}
        title="Ask your clients"
        message="Every client on this project sees the question and can answer it."
        label="Your question"
        confirmLabel="Ask"
        isRequired
        maxLength={QUESTION_TEXT_LIMIT}
        onClose={() => setAsking(false)}
        onConfirm={async (body) => { await projectOperationsService.askQuestion(projectId, body); toast.success('Question sent'); await loadQuestions(); }}
      />
      <ProjectNoteSheet
        visible={answering !== null}
        title="Answer the client"
        message={answering?.body ?? ''}
        label="Your answer"
        confirmLabel="Send answer"
        isRequired
        maxLength={QUESTION_TEXT_LIMIT}
        onClose={() => setAnswering(null)}
        onConfirm={async (answer) => { if (!answering) return; await projectOperationsService.answerQuestion(projectId, answering.id, answer); toast.success('Answer sent'); await loadQuestions(); }}
      />

      <CustomModal
        visible={removing !== null}
        type="danger"
        title={removing?.status === 'pending' ? 'Cancel this invitation?' : 'Remove their access?'}
        message={`${removing ? nameOf(removing.uid) : ''} will no longer see anything on this project.`}
        confirmText={removing?.status === 'pending' ? 'Cancel invitation' : 'Remove access'}
        cancelText="Keep"
        onConfirm={() => { const target = removing; setRemoving(null); if (target) void run(target.uid, () => projectOperationsService.removeStakeholder(projectId, target.uid), 'Access removed'); }}
        onCancel={() => setRemoving(null)}
        onClose={() => setRemoving(null)}
      />
    </View>
  );
}

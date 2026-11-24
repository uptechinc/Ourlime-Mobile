import { useMemo, useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { CheckCircle2, ChevronDown, ChevronUp, FileText, Link2, Package, Paperclip, Plus, Trash2 } from 'lucide-react-native';
import { toast } from 'sonner-native';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { EmptyPanel, PanelHeader } from '@/components/projectManagement/ProjectPanelParts';
import { PROJECT_RIPPLE, ProjectButton, ProjectIconButton, ProjectPill, type ProjectTone } from '@/components/projectManagement/ProjectUiParts';
import { ProjectDayField, ProjectEditSheet, ProjectNoteSheet, ProjectOptionChips, ProjectTextField, formatWhen, projectListStyle } from '@/components/projectManagement/ProjectFormParts';
import { formatCalendarDate } from '@/components/projectManagement/projectFormat';
import {
  DELIVERABLE_CRITERIA_LIMIT, DELIVERABLE_CRITERION_LENGTH, DELIVERABLE_DESCRIPTION_LIMIT, DELIVERABLE_NOTE_LIMIT, DELIVERABLE_TITLE_LIMIT, projectOperationsService,
} from '@/lib/services/ProjectOperationsService';
import type { DeliverableFieldsInput, DeliverableStatus, Milestone, ProjectDeliverable, ProjectStakeholder, TeamMember } from '@/lib/types/project';

type ProjectDeliverablesPanelProps = {
  projectId: string;
  deliverables: ProjectDeliverable[];
  milestones: Milestone[];
  /** Accepted team members (owners of a deliverable). */
  members: TeamMember[];
  /** Accepted clients and reviewers, when that module is on (they can be named as reviewers). */
  stakeholders: ProjectStakeholder[];
  stakeholderNames: { [uid: string]: string };
  currentUserId: string;
  /** A contributor (owner, admin or member) on an active project. */
  canWrite: boolean;
  /** The owner or an admin, on an active project. */
  canManage: boolean;
  stakeholdersEnabled: boolean;
  isLoading: boolean;
  loadError: string;
  onReload: () => Promise<void>;
};

type Prompt = { kind: 'submit' | 'accept' | 'changes' | 'reopen'; deliverable: ProjectDeliverable };
type FormState = DeliverableFieldsInput & { criteriaText: string };

export const DELIVERABLE_STATUS_COPY: { [status in DeliverableStatus]: { label: string; tone: ProjectTone } } = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Waiting for review', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  changes_requested: { label: 'Changes requested', tone: 'danger' },
};
const HISTORY_COPY: { [action: string]: string } = {
  created: 'Added', updated: 'Edited', evidence_added: 'Evidence added', evidence_removed: 'Evidence removed', submitted: 'Submitted for review',
  accepted: 'Accepted', changes_requested: 'Changes requested', reopened: 'Reopened', shared: 'Shared with clients and reviewers', unshared: 'No longer shared',
};
const emptyForm = (): FormState => ({ title: '', description: '', milestoneId: '', ownerId: '', dueDate: '', acceptanceCriteria: [], criteriaText: '' });

/**
 * Deliverables (website ProjectDeliverablesTab): what each milestone hands over, with acceptance criteria, evidence and
 * a review (draft, submitted, accepted or changes requested). Managers or named clients/reviewers sign off; every
 * step records who and when.
 */
export default function ProjectDeliverablesPanel(props: ProjectDeliverablesPanelProps) {
  const { projectId, deliverables, milestones, members, stakeholders, stakeholderNames, currentUserId, canWrite, canManage, stakeholdersEnabled, isLoading, loadError, onReload } = props;
  const { colors } = useAppTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProjectDeliverable | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [linkFor, setLinkFor] = useState<ProjectDeliverable | null>(null);
  const [link, setLink] = useState({ url: '', name: '' });
  const [sharing, setSharing] = useState<ProjectDeliverable | null>(null);
  const [share, setShare] = useState<{ shared: boolean; reviewerIds: string[] }>({ shared: false, reviewerIds: [] });
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState<ProjectDeliverable | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const nameOf = useMemo(() => {
    const names = new Map(members.map((member) => [member.id, member.name]));
    return (uid: string): string => (uid === currentUserId ? 'You' : names.get(uid) ?? stakeholderNames[uid] ?? 'Someone outside the team');
  }, [currentUserId, members, stakeholderNames]);
  const groups = useMemo(() => {
    const byMilestone = new Map<string, ProjectDeliverable[]>();
    for (const deliverable of deliverables) {
      const key = milestones.some((milestone) => milestone.id === deliverable.milestoneId) ? deliverable.milestoneId : '';
      byMilestone.set(key, [...(byMilestone.get(key) ?? []), deliverable]);
    }
    return [...milestones.filter((milestone) => byMilestone.has(milestone.id)).map((milestone) => ({ id: milestone.id, name: milestone.name, items: byMilestone.get(milestone.id) ?? [] })),
      ...(byMilestone.has('') ? [{ id: '', name: 'Not linked to a milestone', items: byMilestone.get('') ?? [] }] : [])];
  }, [deliverables, milestones]);
  const acceptedStakeholders = stakeholders.filter((stakeholder) => stakeholder.status === 'accepted');

  const canEdit = (deliverable: ProjectDeliverable): boolean => canWrite && (canManage || deliverable.createdBy === currentUserId || deliverable.ownerId === currentUserId)
    && (deliverable.status === 'draft' || deliverable.status === 'changes_requested');

  const run = async (deliverableId: string, work: () => Promise<void>, done: string): Promise<void> => {
    if (busyId) return;
    setBusyId(deliverableId);
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

  const openForm = (deliverable: ProjectDeliverable | 'new'): void => {
    setFormError('');
    setForm(deliverable === 'new' ? emptyForm() : { ...deliverable, criteriaText: deliverable.acceptanceCriteria.join('\n') });
    setEditing(deliverable);
  };

  const handleSave = async (): Promise<void> => {
    if (saving || !editing) return;
    if (!form.title.trim()) { setFormError('Give the deliverable a title.'); return; }
    const acceptanceCriteria = form.criteriaText.split('\n').map((line) => line.trim()).filter(Boolean);
    if (acceptanceCriteria.length > DELIVERABLE_CRITERIA_LIMIT) { setFormError(`Keep it to ${DELIVERABLE_CRITERIA_LIMIT} acceptance criteria.`); return; }
    const fields: DeliverableFieldsInput = { title: form.title, description: form.description, milestoneId: form.milestoneId, ownerId: form.ownerId, dueDate: form.dueDate, acceptanceCriteria };
    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') await projectOperationsService.createDeliverable(projectId, fields);
      else {
        const changed: Partial<DeliverableFieldsInput> = {};
        (Object.keys(fields) as (keyof DeliverableFieldsInput)[]).forEach((key) => {
          if (JSON.stringify(fields[key]) !== JSON.stringify(editing[key])) Object.assign(changed, { [key]: fields[key] });
        });
        if (Object.keys(changed).length === 0) { setEditing(null); return; }
        await projectOperationsService.updateDeliverable(projectId, editing.id, changed);
      }
      toast.success(editing === 'new' ? 'Deliverable added' : 'Deliverable updated');
      setEditing(null);
      await onReload();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'The deliverable could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFile = async (deliverable: ProjectDeliverable): Promise<void> => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await run(deliverable.id, () => projectOperationsService.addEvidenceFile(projectId, deliverable.id, { uri: asset.uri, name: asset.name, size: asset.size ?? 0, mimeType: asset.mimeType ?? 'application/octet-stream' }), 'Evidence attached');
  };

  const handleAddLink = async (): Promise<void> => {
    if (!linkFor || saving) return;
    setSaving(true);
    setFormError('');
    try {
      await projectOperationsService.addEvidenceLink(projectId, linkFor.id, link.url, link.name);
      toast.success('Evidence link added');
      setLinkFor(null);
      await onReload();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'The link could not be added. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async (): Promise<void> => {
    if (!sharing || saving) return;
    setSaving(true);
    setFormError('');
    try {
      await projectOperationsService.shareDeliverable(projectId, sharing.id, share.shared, share.reviewerIds);
      toast.success(share.shared ? 'Shared with clients and reviewers' : 'No longer shared');
      setSharing(null);
      await onReload();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'Sharing could not be changed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const promptCopy = prompt ? {
    submit: { title: 'Submit for review?', message: 'Reviewers check it against its acceptance criteria. You cannot edit it while it waits.', label: 'Note for reviewers (optional)', confirm: 'Submit', required: false },
    accept: { title: 'Accept this deliverable?', message: `You are signing off version ${prompt.deliverable.revision}. Your name and the time are recorded.`, label: 'Note (optional)', confirm: 'Accept', required: false },
    changes: { title: 'Request changes?', message: `Say what needs to change in version ${prompt.deliverable.revision}.`, label: 'What needs to change', confirm: 'Request changes', required: true },
    reopen: { title: 'Reopen this deliverable?', message: 'It goes back to draft so it can be changed and reviewed again.', label: 'Why it is reopened', confirm: 'Reopen', required: true },
  }[prompt.kind] : null;

  return (
    <View style={{ gap: 12 }}>
      <PanelHeader
        icon={<Package size={18} color={colors.accent} />}
        title="Deliverables"
        description="What each milestone hands over. Add acceptance criteria and evidence, then submit it for review."
        action={canWrite ? <ProjectButton label="Add deliverable" icon={<Plus size={18} color="#ffffff" />} onPress={() => openForm('new')} /> : null}
      />
      {loadError ? <Text accessibilityRole="alert" style={{ color: colors.destructiveText, fontSize: 13 }}>{loadError}</Text> : null}
      {!isLoading && deliverables.length === 0 && !loadError ? <EmptyPanel icon={<Package size={26} color={colors.mutedText} />} title="No deliverables yet" message="Add one for each thing a milestone should hand over, such as a report, a venue booking or a finished design." /> : null}

      {groups.map((group) => (
        <View key={group.id || 'none'} style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ color: colors.secondaryText, fontSize: 13, fontWeight: '800' }}>{group.name}</Text>
          <View style={projectListStyle(colors)}>
            {group.items.map((deliverable, index) => {
              const open = expandedId === deliverable.id;
              const status = DELIVERABLE_STATUS_COPY[deliverable.status];
              const editable = canEdit(deliverable);
              const isBusy = busyId === deliverable.id;
              return (
                <View key={deliverable.id} style={{ borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }}>
                  <Pressable onPress={() => setExpandedId(open ? null : deliverable.id)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${deliverable.title}. ${status.label}. ${open ? 'Hide details' : 'Show details'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 56, overflow: 'hidden' }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text numberOfLines={2} style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{deliverable.title}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        <ProjectPill label={status.label} tone={status.tone} />
                        {deliverable.sharedWithStakeholders ? <ProjectPill label="Shared" tone="info" /> : null}
                      </View>
                      <Text style={{ color: colors.mutedText, fontSize: 12 }}>{[nameOf(deliverable.ownerId), deliverable.dueDate ? `Due ${formatCalendarDate(deliverable.dueDate)}` : '', `${deliverable.acceptanceCriteria.length} criteria`, `${deliverable.evidence.length} evidence`].filter(Boolean).join(' · ')}</Text>
                    </View>
                    {open ? <ChevronUp size={18} color={colors.mutedText} /> : <ChevronDown size={18} color={colors.mutedText} />}
                  </Pressable>
                  {open ? (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                      {deliverable.description ? <Text style={{ color: colors.secondaryText, fontSize: 13, lineHeight: 19 }}>{deliverable.description}</Text> : null}
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Acceptance criteria</Text>
                      {deliverable.acceptanceCriteria.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>None yet. Add at least one before submitting.</Text>
                        : deliverable.acceptanceCriteria.map((criterion) => <View key={criterion} style={{ flexDirection: 'row', gap: 6 }}><CheckCircle2 size={14} color={colors.mutedText} style={{ marginTop: 2 }} /><Text style={{ flex: 1, color: colors.secondaryText, fontSize: 13 }}>{criterion}</Text></View>)}
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>Evidence</Text>
                      {deliverable.evidence.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>No evidence yet.</Text> : deliverable.evidence.map((evidence) => (
                        <View key={evidence.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Pressable onPress={() => void Linking.openURL(evidence.url)} android_ripple={PROJECT_RIPPLE} accessibilityRole="link" accessibilityLabel={`Open ${evidence.name}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, overflow: 'hidden' }}>
                            {evidence.kind === 'file' ? <FileText size={16} color={colors.accent} /> : <Link2 size={16} color={colors.accent} />}
                            <Text numberOfLines={1} style={{ flex: 1, color: colors.accent, fontSize: 13, fontWeight: '700' }}>{evidence.name}</Text>
                          </Pressable>
                          {editable ? <ProjectIconButton size={44} accessibilityLabel={`Remove ${evidence.name}`} onPress={() => void run(deliverable.id, () => projectOperationsService.removeEvidence(projectId, deliverable.id, evidence.id), 'Evidence removed')}><Trash2 size={16} color={colors.destructive} /></ProjectIconButton> : null}
                        </View>
                      ))}
                      {deliverable.review ? (
                        <Text style={{ color: colors.secondaryText, fontSize: 12 }}>
                          {deliverable.review.decision === 'accepted' ? 'Accepted' : 'Changes requested'} by {deliverable.review.decidedRole === 'stakeholder' ? `${nameOf(deliverable.review.decidedBy)} (client or reviewer)` : nameOf(deliverable.review.decidedBy)} on version {deliverable.review.revision}, {formatWhen(deliverable.review.decidedAt)}{deliverable.review.note ? `: "${deliverable.review.note}"` : ''}
                        </Text>
                      ) : null}
                      {deliverable.sharedWithStakeholders ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>Clients and reviewers can see this.{deliverable.reviewerIds.length ? ` Named reviewers: ${deliverable.reviewerIds.map(nameOf).join(', ')}.` : ''}</Text> : null}

                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {editable ? <ProjectButton isCompact variant="secondary" label="Edit" onPress={() => openForm(deliverable)} isDisabled={isBusy} /> : null}
                        {editable ? <ProjectButton isCompact variant="secondary" label="Add link" icon={<Link2 size={16} color={colors.text} />} onPress={() => { setFormError(''); setLink({ url: '', name: '' }); setLinkFor(deliverable); }} isDisabled={isBusy} /> : null}
                        {editable ? <ProjectButton isCompact variant="secondary" label="Add file" icon={<Paperclip size={16} color={colors.text} />} onPress={() => void handleAddFile(deliverable)} isBusy={isBusy} isDisabled={isBusy} /> : null}
                        {editable ? <ProjectButton isCompact label="Submit for review" onPress={() => setPrompt({ kind: 'submit', deliverable })} isDisabled={isBusy} /> : null}
                        {canManage && deliverable.status === 'submitted' ? <ProjectButton isCompact label="Accept" onPress={() => setPrompt({ kind: 'accept', deliverable })} isDisabled={isBusy} /> : null}
                        {canManage && deliverable.status === 'submitted' ? <ProjectButton isCompact variant="danger" label="Request changes" onPress={() => setPrompt({ kind: 'changes', deliverable })} isDisabled={isBusy} /> : null}
                        {canManage && deliverable.status === 'accepted' ? <ProjectButton isCompact variant="secondary" label="Reopen" onPress={() => setPrompt({ kind: 'reopen', deliverable })} isDisabled={isBusy} /> : null}
                        {canManage && stakeholdersEnabled ? <ProjectButton isCompact variant="secondary" label="Share and reviewers" onPress={() => { setFormError(''); setShare({ shared: deliverable.sharedWithStakeholders, reviewerIds: deliverable.reviewerIds }); setSharing(deliverable); }} isDisabled={isBusy} /> : null}
                        {deliverable.status !== 'accepted' && canWrite && (canManage || (deliverable.createdBy === currentUserId && deliverable.status === 'draft'))
                          ? <ProjectButton isCompact variant="danger" label="Delete" onPress={() => setDeleting(deliverable)} isDisabled={isBusy} /> : null}
                      </View>

                      {deliverable.history.length > 0 ? (
                        <View style={{ gap: 4 }}>
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>History</Text>
                          {[...deliverable.history].reverse().slice(0, 10).map((entry, entryIndex) => (
                            <Text key={`${entry.at}_${entryIndex}`} style={{ color: colors.mutedText, fontSize: 12 }}>
                              {formatWhen(entry.at)} · {HISTORY_COPY[entry.action] ?? 'Changed'}{entry.revision ? ` (version ${entry.revision})` : ''} · {nameOf(entry.actorId)}{entry.note ? ` · "${entry.note}"` : ''}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <ProjectEditSheet visible={editing !== null} title={editing === 'new' ? 'Add a deliverable' : 'Edit deliverable'} saveLabel={editing === 'new' ? 'Add deliverable' : 'Save'} isSaving={saving} error={formError} onSave={() => void handleSave()} onClose={() => setEditing(null)}>
        <ProjectTextField label="Title" value={form.title} onChangeText={(title) => setForm({ ...form, title })} isRequired maxLength={DELIVERABLE_TITLE_LIMIT} />
        <ProjectTextField label="Description" value={form.description} onChangeText={(description) => setForm({ ...form, description })} multiline maxLength={DELIVERABLE_DESCRIPTION_LIMIT} />
        <ProjectOptionChips label="Milestone" value={form.milestoneId} options={[{ value: '', label: 'None' }, ...milestones.map((milestone) => ({ value: milestone.id, label: milestone.name }))]} onChange={(milestoneId) => setForm({ ...form, milestoneId })} />
        <ProjectOptionChips label="Owner" value={form.ownerId} options={[{ value: '', label: 'Me' }, ...members.filter((member) => member.id !== currentUserId).map((member) => ({ value: member.id, label: member.name }))]} onChange={(ownerId) => setForm({ ...form, ownerId })} />
        <ProjectDayField label="Due date" value={form.dueDate} onChange={(dueDate) => setForm({ ...form, dueDate })} />
        <ProjectTextField label="Acceptance criteria (one per line)" value={form.criteriaText} onChangeText={(criteriaText) => setForm({ ...form, criteriaText })} multiline maxLength={DELIVERABLE_CRITERIA_LIMIT * (DELIVERABLE_CRITERION_LENGTH + 1)} hint="Reviewers check the deliverable against each line." />
      </ProjectEditSheet>

      <ProjectEditSheet visible={linkFor !== null} title="Add an evidence link" saveLabel="Add link" isSaving={saving} error={formError} onSave={() => void handleAddLink()} onClose={() => setLinkFor(null)}>
        <ProjectTextField label="Link (https://…)" value={link.url} onChangeText={(url) => setLink({ ...link, url })} keyboardType="url" isRequired />
        <ProjectTextField label="Name (optional)" value={link.name} onChangeText={(name) => setLink({ ...link, name })} maxLength={200} />
      </ProjectEditSheet>

      <ProjectEditSheet visible={sharing !== null} title="Share with clients and reviewers" subtitle="They see only the deliverables and milestones you share, never the rest of the project." saveLabel="Save" isSaving={saving} error={formError} onSave={() => void handleShare()} onClose={() => setSharing(null)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
          <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' }}>Share this deliverable</Text>
          <Switch value={share.shared} onValueChange={(shared) => setShare({ shared, reviewerIds: shared ? share.reviewerIds : [] })} accessibilityLabel="Share this deliverable with clients and reviewers" />
        </View>
        {share.shared ? (
          acceptedStakeholders.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 13 }}>No client or reviewer has accepted yet. Invite them from the Clients page.</Text> : (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.secondaryText, fontSize: 13, fontWeight: '700' }}>Who can sign it off (optional)</Text>
              {acceptedStakeholders.map((stakeholder) => {
                const selected = share.reviewerIds.includes(stakeholder.uid);
                return <View key={stakeholder.uid} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
                  <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>{stakeholderNames[stakeholder.uid] ?? 'Client or reviewer'} ({stakeholder.role})</Text>
                  <Switch value={selected} onValueChange={(next) => setShare({ ...share, reviewerIds: next ? [...share.reviewerIds, stakeholder.uid].slice(0, 10) : share.reviewerIds.filter((id) => id !== stakeholder.uid) })} accessibilityLabel={`Let ${stakeholderNames[stakeholder.uid] ?? 'this person'} sign off`} />
                </View>;
              })}
            </View>
          )
        ) : null}
      </ProjectEditSheet>

      <ProjectNoteSheet
        visible={prompt !== null}
        title={promptCopy?.title ?? ''}
        message={promptCopy?.message ?? ''}
        label={promptCopy?.label ?? ''}
        confirmLabel={promptCopy?.confirm ?? ''}
        isRequired={promptCopy?.required ?? false}
        tone={prompt?.kind === 'changes' ? 'danger' : 'primary'}
        maxLength={DELIVERABLE_NOTE_LIMIT}
        onClose={() => setPrompt(null)}
        onConfirm={async (note) => {
          if (!prompt) return;
          const { deliverable } = prompt;
          if (prompt.kind === 'submit') await projectOperationsService.submitDeliverable(projectId, deliverable.id, deliverable.revision, note);
          else if (prompt.kind === 'accept') await projectOperationsService.reviewDeliverable(projectId, deliverable.id, 'accepted', note, deliverable.revision);
          else if (prompt.kind === 'changes') await projectOperationsService.reviewDeliverable(projectId, deliverable.id, 'changes_requested', note, deliverable.revision);
          else await projectOperationsService.reopenDeliverable(projectId, deliverable.id, note);
          toast.success(prompt.kind === 'submit' ? 'Submitted for review' : prompt.kind === 'accept' ? 'Deliverable accepted' : prompt.kind === 'changes' ? 'Changes requested' : 'Deliverable reopened');
          await onReload();
        }}
      />

      <CustomModal
        visible={deleting !== null}
        type="danger"
        title="Delete this deliverable?"
        message={`"${deleting?.title ?? ''}" and its evidence list are removed. The project activity keeps a record that it was deleted.`}
        confirmText="Delete"
        cancelText="Keep"
        onConfirm={() => { const target = deleting; setDeleting(null); if (target) void run(target.id, () => projectOperationsService.deleteDeliverable(projectId, target.id), 'Deliverable deleted'); }}
        onCancel={() => setDeleting(null)}
        onClose={() => setDeleting(null)}
      />
    </View>
  );
}

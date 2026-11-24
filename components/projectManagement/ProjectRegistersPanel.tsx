import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronUp, Plus, Scale, Search } from 'lucide-react-native';
import { toast } from 'sonner-native';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { EmptyPanel, PanelHeader } from '@/components/projectManagement/ProjectPanelParts';
import { PROJECT_RIPPLE, ProjectButton, ProjectPill, ProjectSegmented, type ProjectTone } from '@/components/projectManagement/ProjectUiParts';
import { ProjectDayField, ProjectEditSheet, ProjectNoteSheet, ProjectOptionChips, ProjectTextField, formatWhen, projectListStyle } from '@/components/projectManagement/ProjectFormParts';
import { formatCalendarDate } from '@/components/projectManagement/projectFormat';
import { projectOperationsService, REGISTER_TEXT_LIMIT, REGISTER_TITLE_LIMIT, type RegisterCursor } from '@/lib/services/ProjectOperationsService';
import type { IssueSeverity, ProjectRegisterKind, ProjectRegisterRecord, RegisterFieldsInput, RegisterLevel, TeamMember } from '@/lib/types/project';

type ProjectRegistersPanelProps = {
  projectId: string;
  members: TeamMember[];
  currentUserId: string;
  /** A contributor (owner, admin or member) on an active project. */
  canWrite: boolean;
  /** The owner or an admin, on an active project. */
  canManage: boolean;
};

type Move = { to: string; label: string; managerOnly: boolean; requesterAllowed: boolean; noteRequired: boolean; tone: 'primary' | 'danger' };
type FormState = Required<Pick<RegisterFieldsInput, 'title' | 'description' | 'ownerId' | 'dueDate'>> & {
  likelihood: RegisterLevel; impact: RegisterLevel; mitigation: string; severity: IssueSeverity; resolution: string;
  decision: string; rationale: string; decidedOn: string; reason: string; impactSummary: string;
};

const KIND_COPY: { [kind in ProjectRegisterKind]: { tab: string; one: string; add: string; empty: string } } = {
  risk: { tab: 'Risks', one: 'risk', add: 'Add a risk', empty: 'A risk is something that might happen. Note it early with how likely it is, its impact and what you will do about it.' },
  issue: { tab: 'Issues', one: 'issue', add: 'Add an issue', empty: 'An issue is a problem that is already happening. Give it an owner and track it to resolution.' },
  decision: { tab: 'Decisions', one: 'decision', add: 'Record a decision', empty: 'Record what was decided and why, so it can be found later instead of lost in chat.' },
  change_request: { tab: 'Changes', one: 'change request', add: 'Request a change', empty: 'Ask to change scope or dates. A project owner or admin approves or rejects it.' },
};
const STATUS_COPY: { [status: string]: { label: string; tone: ProjectTone } } = {
  open: { label: 'Open', tone: 'warning' }, mitigating: { label: 'Mitigating', tone: 'info' }, closed: { label: 'Closed', tone: 'neutral' }, occurred: { label: 'Happened', tone: 'danger' },
  in_progress: { label: 'In progress', tone: 'info' }, resolved: { label: 'Resolved', tone: 'success' },
  decided: { label: 'Decided', tone: 'success' }, superseded: { label: 'Superseded', tone: 'neutral' }, reversed: { label: 'Reversed', tone: 'danger' },
  proposed: { label: 'Waiting for a decision', tone: 'warning' }, approved: { label: 'Approved', tone: 'success' }, rejected: { label: 'Rejected', tone: 'danger' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' }, implemented: { label: 'Implemented', tone: 'success' },
};
const LEVELS: { value: RegisterLevel; label: string }[] = [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }];
const SEVERITIES: { value: IssueSeverity; label: string }[] = [...LEVELS, { value: 'critical', label: 'Critical' }];

/** Allowed status moves for a record, matching the server's ProjectRegisterService.canMove. */
function movesFor(kind: ProjectRegisterKind, from: string): Move[] {
  const move = (to: string, label: string, extra: Partial<Move> = {}): Move => ({ to, label, managerOnly: false, requesterAllowed: false, noteRequired: false, tone: 'primary', ...extra });
  if (kind === 'risk') return [move('open', 'Mark open'), move('mitigating', 'Mitigating'), move('closed', 'Close', { noteRequired: true }), move('occurred', 'It happened', { noteRequired: true, tone: 'danger' })].filter((entry) => entry.to !== from);
  if (kind === 'issue') return [move('open', 'Reopen'), move('in_progress', 'In progress'), move('resolved', 'Resolved', { noteRequired: true }), move('closed', 'Close')].filter((entry) => entry.to !== from);
  if (kind === 'decision') return from === 'decided' ? [move('superseded', 'Superseded', { noteRequired: true }), move('reversed', 'Reversed', { noteRequired: true, tone: 'danger' })] : [];
  if (from === 'proposed') return [move('approved', 'Approve', { managerOnly: true }), move('rejected', 'Reject', { managerOnly: true, noteRequired: true, tone: 'danger' }), move('withdrawn', 'Withdraw', { requesterAllowed: true })];
  if (from === 'approved') return [move('implemented', 'Mark implemented', { managerOnly: true })];
  return [];
}

const blankForm = (): FormState => ({ title: '', description: '', ownerId: '', dueDate: '', likelihood: 'medium', impact: 'medium', mitigation: '', severity: 'medium', resolution: '', decision: '', rationale: '', decidedOn: '', reason: '', impactSummary: '' });

/**
 * Risks, issues, the decision log and change requests (website ProjectRegistersTab). Each register keeps a history;
 * change requests wait for a project owner or admin to approve or reject them. Viewers read only.
 */
export default function ProjectRegistersPanel({ projectId, members, currentUserId, canWrite, canManage }: ProjectRegistersPanelProps) {
  const { colors } = useAppTheme();
  const [kind, setKind] = useState<ProjectRegisterKind>('risk');
  const [records, setRecords] = useState<ProjectRegisterRecord[]>([]);
  const [cursor, setCursor] = useState<RegisterCursor | null>(null);
  // The page cursor belongs to the register shown; switching register reloads from the first page.
  const cursorRef = useRef<RegisterCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProjectRegisterRecord[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProjectRegisterRecord | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [moving, setMoving] = useState<{ record: ProjectRegisterRecord; move: Move } | null>(null);
  const [deleting, setDeleting] = useState<ProjectRegisterRecord | null>(null);

  const nameOf = useMemo(() => { const names = new Map(members.map((member) => [member.id, member.name])); return (uid: string): string => (uid === currentUserId ? 'You' : names.get(uid) ?? 'A former member'); }, [currentUserId, members]);

  const load = useCallback(async (more = false) => {
    setLoading(true);
    setLoadError('');
    try {
      const page = await projectOperationsService.listRecords(projectId, kind, more ? cursorRef.current : null);
      setRecords((current) => (more ? [...current, ...page.records] : page.records));
      cursorRef.current = page.cursor;
      setCursor(page.cursor);
    } catch (error: unknown) {
      console.error('[ProjectRegistersPanel.load] Error:', error);
      setLoadError('This register could not be loaded. Try again.');
    } finally {
      setLoading(false);
    }
  }, [kind, projectId]);

  useEffect(() => { setRecords([]); cursorRef.current = null; setCursor(null); setSearch('');setSearchResults(null); setExpandedId(null); void load(); }, [load]);

  const handleSearch = async (): Promise<void> => {
    const word = search.trim().split(/\s+/)[0] ?? '';
    if (word.length < 3) { setSearchResults(null); return; }
    try {
      setSearchResults(await projectOperationsService.searchDecisions(projectId, word));
    } catch (error: unknown) {
      console.error('[ProjectRegistersPanel.handleSearch] Error:', error);
      toast.error('Search did not work. Try again.');
    }
  };

  const openForm = (record: ProjectRegisterRecord | 'new'): void => {
    setFormError('');
    setForm(record === 'new' ? blankForm() : {
      title: record.title, description: record.description, ownerId: record.ownerId, dueDate: record.dueDate,
      likelihood: record.likelihood || 'medium', impact: record.impact || 'medium', mitigation: record.mitigation, severity: record.severity || 'medium', resolution: record.resolution,
      decision: record.decision, rationale: record.rationale, decidedOn: record.decidedOn, reason: record.reason, impactSummary: record.impactSummary,
    });
    setEditing(record);
  };

  const fieldsFor = (state: FormState): RegisterFieldsInput => {
    const common = { title: state.title, description: state.description, ownerId: state.ownerId, dueDate: state.dueDate };
    if (kind === 'risk') return { ...common, likelihood: state.likelihood, impact: state.impact, mitigation: state.mitigation };
    if (kind === 'issue') return { ...common, severity: state.severity, resolution: state.resolution };
    if (kind === 'decision') return { ...common, decision: state.decision, rationale: state.rationale, decidedOn: state.decidedOn };
    return { ...common, reason: state.reason, impactSummary: state.impactSummary };
  };

  const handleSave = async (): Promise<void> => {
    if (!editing || saving) return;
    if (!form.title.trim()) { setFormError('Add a title.'); return; }
    if (kind === 'decision' && !form.decision.trim()) { setFormError('Say what was decided.'); return; }
    if (kind === 'change_request' && !form.reason.trim()) { setFormError('Say why the change is needed.'); return; }
    const fields = fieldsFor(form);
    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') await projectOperationsService.createRecord(projectId, kind, fields);
      else {
        const before = fieldsFor({ ...blankForm(), ...Object.fromEntries(Object.entries(editing).filter(([, value]) => typeof value === 'string')) as Partial<FormState> });
        const changed = Object.fromEntries(Object.entries(fields).filter(([key, value]) => value !== before[key as keyof RegisterFieldsInput])) as RegisterFieldsInput;
        if (Object.keys(changed).length === 0) { setEditing(null); return; }
        await projectOperationsService.updateRecord(projectId, kind, editing.id, changed);
      }
      toast.success(editing === 'new' ? 'Added' : 'Saved');
      setEditing(null);
      await load();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'This could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const shown = searchResults ?? records;
  const copy = KIND_COPY[kind];

  return (
    <View style={{ gap: 12 }}>
      <PanelHeader
        icon={<Scale size={18} color={colors.accent} />}
        title="Risks and decisions"
        description="Risks might happen; issues are happening. Decisions are kept as searchable records, and change requests need an owner or admin to approve them."
        action={canWrite ? <ProjectButton label={copy.add} icon={<Plus size={18} color="#ffffff" />} onPress={() => openForm('new')} /> : null}
      />
      <ProjectSegmented accessibilityLabel="Register" value={kind} onChange={setKind} options={(Object.keys(KIND_COPY) as ProjectRegisterKind[]).map((value) => ({ value, label: KIND_COPY[value].tab }))} />

      {kind === 'decision' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input }}>
          <Search size={18} color={colors.mutedText} />
          <TextInput value={search} onChangeText={(value) => { setSearch(value); if (!value.trim()) setSearchResults(null); }} onSubmitEditing={() => void handleSearch()} returnKeyType="search" placeholder="Search decisions by a word" placeholderTextColor={colors.mutedText} accessibilityLabel="Search decisions" style={{ flex: 1, color: colors.text, fontSize: 15 }} />
        </View>
      ) : null}
      {searchResults ? <Text style={{ color: colors.mutedText, fontSize: 12 }}>{searchResults.length} {searchResults.length === 1 ? 'decision matches' : 'decisions match'} "{search.trim().split(/\s+/)[0]}".</Text> : null}

      {loadError ? <Text accessibilityRole="alert" style={{ color: colors.destructiveText, fontSize: 13 }}>{loadError}</Text> : null}
      {!loading && shown.length === 0 && !loadError ? <EmptyPanel icon={<Scale size={26} color={colors.mutedText} />} title={searchResults ? 'No matching decisions' : `No ${copy.tab.toLowerCase()} yet`} message={searchResults ? 'Try another word from the title or the decision.' : copy.empty} /> : null}

      {shown.length > 0 ? (
        <View style={projectListStyle(colors)}>
          {shown.map((record, index) => {
            const open = expandedId === record.id;
            const status = STATUS_COPY[record.status] ?? { label: record.status || 'Unknown', tone: 'neutral' as ProjectTone };
            const own = record.createdBy === currentUserId || record.ownerId === currentUserId;
            const requester = record.requestedBy === currentUserId || record.createdBy === currentUserId;
            const moves = canWrite ? movesFor(kind, record.status).filter((move) => (move.managerOnly ? canManage : canManage || (move.requesterAllowed ? requester : own))) : [];
            const editable = canWrite && (canManage || own) && (kind !== 'change_request' || record.status === 'proposed');
            const facts = kind === 'risk' ? `Likelihood ${record.likelihood || '?'} · Impact ${record.impact || '?'}` : kind === 'issue' ? `Severity ${record.severity || '?'}` : kind === 'decision' ? (record.decidedOn ? `Decided ${formatCalendarDate(record.decidedOn)}` : '') : `Requested by ${nameOf(record.requestedBy)}`;
            return (
              <View key={record.id} style={{ borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <Pressable onPress={() => setExpandedId(open ? null : record.id)} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${record.title}. ${status.label}. ${facts}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 56, overflow: 'hidden' }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text numberOfLines={2} style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{record.title}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      <ProjectPill label={status.label} tone={status.tone} />
                      {kind === 'risk' && record.score >= 6 ? <ProjectPill label="High exposure" tone="danger" /> : null}
                    </View>
                    <Text style={{ color: colors.mutedText, fontSize: 12 }}>{[facts, record.ownerId ? `Owner ${nameOf(record.ownerId)}` : '', record.dueDate ? `Due ${formatCalendarDate(record.dueDate)}` : ''].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {open ? <ChevronUp size={18} color={colors.mutedText} /> : <ChevronDown size={18} color={colors.mutedText} />}
                </Pressable>
                {open ? (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                    {kind === 'decision' && record.decision ? <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19 }}>Decision: {record.decision}</Text> : null}
                    {record.description ? <Text style={{ color: colors.secondaryText, fontSize: 13, lineHeight: 19 }}>{record.description}</Text> : null}
                    {record.mitigation ? <Text style={{ color: colors.secondaryText, fontSize: 13 }}>Mitigation: {record.mitigation}</Text> : null}
                    {record.resolution ? <Text style={{ color: colors.secondaryText, fontSize: 13 }}>Resolution: {record.resolution}</Text> : null}
                    {record.rationale ? <Text style={{ color: colors.secondaryText, fontSize: 13 }}>Why: {record.rationale}</Text> : null}
                    {record.reason ? <Text style={{ color: colors.secondaryText, fontSize: 13 }}>Why the change: {record.reason}</Text> : null}
                    {record.impactSummary ? <Text style={{ color: colors.secondaryText, fontSize: 13 }}>Effect on scope and dates: {record.impactSummary}</Text> : null}
                    {record.verdict ? <Text style={{ color: colors.secondaryText, fontSize: 12 }}>{record.verdict.status === 'approved' ? 'Approved' : 'Rejected'} by {nameOf(record.verdict.by)}, {formatWhen(record.verdict.at)}{record.verdict.selfApproved ? ' (approved their own request)' : ''}{record.verdict.note ? `: "${record.verdict.note}"` : ''}</Text> : null}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {editable ? <ProjectButton isCompact variant="secondary" label="Edit" onPress={() => openForm(record)} /> : null}
                      {moves.map((move) => <ProjectButton key={move.to} isCompact variant={move.tone === 'danger' ? 'danger' : 'secondary'} label={move.label} onPress={() => setMoving({ record, move })} />)}
                      {canManage && !(kind === 'change_request' && ['approved', 'rejected', 'implemented'].includes(record.status)) ? <ProjectButton isCompact variant="danger" label="Delete" onPress={() => setDeleting(record)} /> : null}
                    </View>
                    {record.history.length > 0 ? (
                      <View style={{ gap: 3 }}>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>History</Text>
                        {[...record.history].reverse().slice(0, 10).map((entry, entryIndex) => (
                          <Text key={`${entry.at}_${entryIndex}`} style={{ color: colors.mutedText, fontSize: 12 }}>
                            {formatWhen(entry.at)} · {entry.action === 'status' ? `${STATUS_COPY[entry.from]?.label ?? entry.from} to ${STATUS_COPY[entry.to]?.label ?? entry.to}` : entry.action === 'created' ? 'Added' : `Edited ${entry.changed.join(', ')}`} · {nameOf(entry.actorId)}{entry.note ? ` · "${entry.note}"` : ''}
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
      ) : null}
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {!searchResults && cursor && !loading ? <ProjectButton variant="secondary" label="Load more" onPress={() => void load(true)} /> : null}

      <ProjectEditSheet visible={editing !== null} title={editing === 'new' ? copy.add : `Edit ${copy.one}`} saveLabel={editing === 'new' ? 'Add' : 'Save'} isSaving={saving} error={formError} onSave={() => void handleSave()} onClose={() => setEditing(null)}>
        <ProjectTextField label="Title" value={form.title} onChangeText={(title) => setForm({ ...form, title })} isRequired maxLength={REGISTER_TITLE_LIMIT} />
        {kind === 'decision' ? <ProjectTextField label="What was decided" value={form.decision} onChangeText={(decision) => setForm({ ...form, decision })} multiline isRequired maxLength={REGISTER_TEXT_LIMIT} /> : null}
        {kind === 'change_request' ? <ProjectTextField label="Why the change is needed" value={form.reason} onChangeText={(reason) => setForm({ ...form, reason })} multiline isRequired maxLength={REGISTER_TEXT_LIMIT} /> : null}
        <ProjectTextField label={kind === 'decision' ? 'Context' : 'Description'} value={form.description} onChangeText={(description) => setForm({ ...form, description })} multiline maxLength={REGISTER_TEXT_LIMIT} />
        {kind === 'risk' ? <>
          <ProjectOptionChips label="Likelihood" value={form.likelihood} options={LEVELS} onChange={(likelihood) => setForm({ ...form, likelihood })} />
          <ProjectOptionChips label="Impact" value={form.impact} options={LEVELS} onChange={(impact) => setForm({ ...form, impact })} />
          <ProjectTextField label="Mitigation" value={form.mitigation} onChangeText={(mitigation) => setForm({ ...form, mitigation })} multiline maxLength={REGISTER_TEXT_LIMIT} />
        </> : null}
        {kind === 'issue' ? <>
          <ProjectOptionChips label="Severity" value={form.severity} options={SEVERITIES} onChange={(severity) => setForm({ ...form, severity })} />
          <ProjectTextField label="Resolution" value={form.resolution} onChangeText={(resolution) => setForm({ ...form, resolution })} multiline maxLength={REGISTER_TEXT_LIMIT} />
        </> : null}
        {kind === 'decision' ? <>
          <ProjectTextField label="Why" value={form.rationale} onChangeText={(rationale) => setForm({ ...form, rationale })} multiline maxLength={REGISTER_TEXT_LIMIT} />
          <ProjectDayField label="Decided on" value={form.decidedOn} placeholder="Today" onChange={(decidedOn) => setForm({ ...form, decidedOn })} />
        </> : null}
        {kind === 'change_request' ? <ProjectTextField label="Effect on scope and dates" value={form.impactSummary} onChangeText={(impactSummary) => setForm({ ...form, impactSummary })} multiline maxLength={REGISTER_TEXT_LIMIT} /> : null}
        <ProjectOptionChips label="Owner" value={form.ownerId} options={[{ value: '', label: 'Nobody yet' }, ...members.map((member) => ({ value: member.id, label: member.id === currentUserId ? 'Me' : member.name }))]} onChange={(ownerId) => setForm({ ...form, ownerId })} />
        {kind !== 'decision' ? <ProjectDayField label="Due date" value={form.dueDate} onChange={(dueDate) => setForm({ ...form, dueDate })} /> : null}
      </ProjectEditSheet>

      <ProjectNoteSheet
        visible={moving !== null}
        title={moving ? `${moving.move.label}: ${moving.record.title}` : ''}
        message={moving?.move.managerOnly ? 'Your decision, name and the time are recorded.' : 'The change is recorded in this record\'s history.'}
        label={moving?.move.noteRequired ? 'Note' : 'Note (optional)'}
        confirmLabel={moving?.move.label ?? ''}
        isRequired={moving?.move.noteRequired ?? false}
        tone={moving?.move.tone ?? 'primary'}
        onClose={() => setMoving(null)}
        onConfirm={async (note) => {
          if (!moving) return;
          await projectOperationsService.setRecordStatus(projectId, kind, moving.record.id, moving.move.to, note);
          toast.success('Status changed');
          await load();
        }}
      />

      <CustomModal
        visible={deleting !== null}
        type="danger"
        title={`Delete this ${copy.one}?`}
        message={`"${deleting?.title ?? ''}" is removed. The project activity keeps a record that it was deleted.`}
        confirmText="Delete"
        cancelText="Keep"
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (!target) return;
          void projectOperationsService.deleteRecord(projectId, kind, target.id).then(() => { toast.success('Deleted'); return load(); }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'It could not be deleted.'));
        }}
        onCancel={() => setDeleting(null)}
        onClose={() => setDeleting(null)}
      />
    </View>
  );
}

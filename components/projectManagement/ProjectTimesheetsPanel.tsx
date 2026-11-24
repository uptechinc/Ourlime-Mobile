import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Clock, Lock, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { EmptyPanel, PanelHeader } from '@/components/projectManagement/ProjectPanelParts';
import { ProjectButton, ProjectIconButton, ProjectPill, ProjectSection } from '@/components/projectManagement/ProjectUiParts';
import { ProjectDayField, ProjectEditSheet, ProjectListRow, ProjectNoteSheet, ProjectOptionChips, ProjectTextField, projectListStyle } from '@/components/projectManagement/ProjectFormParts';
import { formatCalendarDate, formatDuration, toCalendarString } from '@/components/projectManagement/projectFormat';
import { projectOperationsService, TIME_NOTE_LIMIT, TIME_REASON_LIMIT } from '@/lib/services/ProjectOperationsService';
import type { ProjectRecord, ProjectTimeEntry, ProjectTimeSummary, Task, TeamMember } from '@/lib/types/project';

type ProjectTimesheetsPanelProps = {
  project: ProjectRecord;
  tasks: Task[];
  teamMembers: TeamMember[];
  currentUserId: string;
  /** Owners and admins also see team totals (never other people's entries or notes). */
  canManage: boolean;
  /** Contributors of an active project can log, correct and remove their own time. */
  canLog: boolean;
  /** Start the log form on this task (from a task's details). */
  initialTaskId?: string;
};

type OwnRow = { id: string; taskId: string; minutes: number; date: string; note: string; source: ProjectTimeEntry['source'] | 'embedded'; status: 'active' | 'void'; corrected: boolean; voidReason: string };
type LogForm = { taskId: string; hours: string; minutes: string; date: string; note: string };

const parseMinutes = (hours: string, minutes: string): number => {
  const total = Math.round((Number(hours.replace(',', '.')) || 0) * 60 + (Number(minutes) || 0));
  return Number.isFinite(total) ? total : 0;
};

/**
 * The time log (website ProjectTimesheetsTab). Private by design: each person sees and changes only their own entries
 * (plus their own older entries still kept inside tasks). Owners and admins also see totals by person and by task, with
 * estimate against actual, but never anyone else's entries or notes. Nothing tracks activity; time is typed in or
 * comes from your own timer.
 */
export default function ProjectTimesheetsPanel({ project, tasks, teamMembers, currentUserId, canManage, canLog, initialTaskId }: ProjectTimesheetsPanelProps) {
  const { colors } = useAppTheme();
  const [entries, setEntries] = useState<ProjectTimeEntry[]>([]);
  const [summary, setSummary] = useState<ProjectTimeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<LogForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [correcting, setCorrecting] = useState<OwnRow | null>(null);
  const [correction, setCorrection] = useState<LogForm & { reason: string }>({ taskId: '', hours: '0', minutes: '0', date: '', note: '', reason: '' });
  const [removing, setRemoving] = useState<OwnRow | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [own, totals] = await Promise.all([projectOperationsService.listOwnTime(project.id), canManage ? projectOperationsService.timeSummary(project.id) : Promise.resolve(null)]);
      setEntries(own);
      setSummary(totals);
    } catch (error: unknown) {
      console.error('[ProjectTimesheetsPanel.load] Error:', error);
      setLoadError('Your time log could not be loaded. Pull to refresh or try again.');
    } finally {
      setLoading(false);
    }
  }, [canManage, project.id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (initialTaskId && canLog) setForm({ taskId: initialTaskId, hours: '0', minutes: '30', date: toCalendarString(new Date()), note: '' });
  }, [canLog, initialTaskId]);

  const taskTitle = useMemo(() => { const titles = new Map(tasks.map((task) => [task.id, task.title])); return (taskId: string): string => titles.get(taskId) ?? 'A removed task'; }, [tasks]);
  const memberName = useMemo(() => { const names = new Map(teamMembers.map((member) => [member.id, member.name])); return (uid: string): string => names.get(uid) ?? 'A former member'; }, [teamMembers]);

  // Older entries still embedded in task documents: only your own are shown; managers' totals include everyone's.
  const embedded = useMemo(() => tasks.flatMap((task) => task.timeEntries.map((entry) => ({ ...entry, taskId: task.id }))), [tasks]);
  const ownRows = useMemo<OwnRow[]>(() => [
    ...entries.map((entry): OwnRow => ({ id: entry.id, taskId: entry.taskId, minutes: entry.minutes, date: entry.date, note: entry.note, source: entry.source, status: entry.status, corrected: entry.corrections.length > 0, voidReason: entry.voidReason })),
    ...embedded.filter((entry) => entry.userId === currentUserId).map((entry): OwnRow => ({ id: `embedded_${entry.id}`, taskId: entry.taskId, minutes: entry.duration || 0, date: entry.date || (entry.startTime ? entry.startTime.slice(0, 10) : ''), note: entry.description || '', source: 'embedded', status: 'active', corrected: false, voidReason: '' })),
  ].sort((first, second) => second.date.localeCompare(first.date)), [currentUserId, embedded, entries]);
  const ownTotal = ownRows.filter((row) => row.status === 'active').reduce((sum, row) => sum + row.minutes, 0);

  const teamTotals = useMemo(() => {
    if (!canManage) return null;
    const byMember = { ...(summary?.byMember ?? {}) };
    const byTask = { ...(summary?.byTask ?? {}) };
    let total = summary?.totalMinutes ?? 0;
    for (const entry of embedded) {
      const minutes = entry.duration || 0;
      if (!minutes || !entry.userId) continue;
      byMember[entry.userId] = (byMember[entry.userId] ?? 0) + minutes;
      byTask[entry.taskId] = (byTask[entry.taskId] ?? 0) + minutes;
      total += minutes;
    }
    return { total, byMember, byTask };
  }, [canManage, embedded, summary]);

  const openLog = (): void => {
    setFormError('');
    setForm({ taskId: tasks[0]?.id ?? '', hours: '0', minutes: '30', date: toCalendarString(new Date()), note: '' });
  };

  const handleLog = async (): Promise<void> => {
    if (!form || saving) return;
    const minutes = parseMinutes(form.hours, form.minutes);
    if (!form.taskId) { setFormError('Choose the task you worked on.'); return; }
    if (minutes < 1 || minutes > 1440) { setFormError('Log between 1 minute and 24 hours.'); return; }
    setSaving(true);
    setFormError('');
    try {
      await projectOperationsService.logTime(project.id, form.taskId, minutes, form.date, form.note);
      toast.success('Time logged');
      setForm(null);
      await load();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'The time could not be logged. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const openCorrection = (row: OwnRow): void => {
    setFormError('');
    setCorrection({ taskId: row.taskId, hours: String(Math.floor(row.minutes / 60)), minutes: String(row.minutes % 60), date: row.date, note: row.note, reason: '' });
    setCorrecting(row);
  };

  const handleCorrect = async (): Promise<void> => {
    if (!correcting || saving) return;
    const minutes = parseMinutes(correction.hours, correction.minutes);
    if (minutes < 1 || minutes > 1440) { setFormError('Log between 1 minute and 24 hours.'); return; }
    if (!correction.reason.trim()) { setFormError('Say why you are correcting this entry.'); return; }
    const changes = {
      ...(minutes !== correcting.minutes ? { minutes } : {}),
      ...(correction.date && correction.date !== correcting.date ? { date: correction.date } : {}),
      ...(correction.note.trim() !== correcting.note ? { note: correction.note.trim() } : {}),
    };
    if (Object.keys(changes).length === 0) { setFormError('Change the time, day or note first.'); return; }
    setSaving(true);
    setFormError('');
    try {
      await projectOperationsService.correctTime(project.id, correcting.id, changes, correction.reason);
      toast.success('Entry corrected');
      setCorrecting(null);
      await load();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'The entry could not be corrected. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const taskOptions = tasks.slice(0, 40).map((task) => ({ value: task.id, label: task.title.length > 28 ? `${task.title.slice(0, 27)}…` : task.title }));
  const managerTasks = teamTotals ? tasks.filter((task) => (teamTotals.byTask[task.id] ?? 0) > 0 || task.estimatedTime > 0).sort((first, second) => (teamTotals.byTask[second.id] ?? 0) - (teamTotals.byTask[first.id] ?? 0)) : [];

  return (
    <View style={{ gap: 12 }}>
      <PanelHeader
        icon={<Clock size={18} color={colors.accent} />}
        title="Time log"
        description="Log the time you spend on tasks. Only you can see your entries; project owners and admins see totals, never your entries or notes."
        action={canLog ? <ProjectButton label="Log time" icon={<Plus size={18} color="#ffffff" />} onPress={openLog} isDisabled={tasks.length === 0} /> : null}
      />

      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {loadError ? <Text accessibilityRole="alert" style={{ color: colors.destructiveText, fontSize: 13 }}>{loadError}</Text> : null}

      <ProjectSection title={`Your time · ${formatDuration(ownTotal)}`} icon={<Lock size={16} color={colors.mutedText} />}>
        {ownRows.length === 0 && !loading ? <Text style={{ color: colors.mutedText, fontSize: 13 }}>You have not logged time on this project yet.</Text> : null}
        {ownRows.length > 0 ? (
          <View style={projectListStyle(colors)}>
            {ownRows.map((row, index) => (
              <ProjectListRow
                key={row.id}
                isFirst={index === 0}
                title={`${taskTitle(row.taskId)} · ${formatDuration(row.minutes)}`}
                detail={[formatCalendarDate(row.date, 'No day'), row.note || 'No note', row.status === 'void' ? `Removed: ${row.voidReason}` : row.corrected ? 'Corrected' : '', row.source === 'embedded' ? 'Older entry kept with the task' : ''].filter(Boolean).join(' · ')}
                right={row.source !== 'embedded' && row.status === 'active' && canLog ? (
                  <View style={{ flexDirection: 'row' }}>
                    <ProjectIconButton size={44} accessibilityLabel={`Correct ${formatDuration(row.minutes)} on ${taskTitle(row.taskId)}`} onPress={() => openCorrection(row)}><Pencil size={18} color={colors.icon} /></ProjectIconButton>
                    <ProjectIconButton size={44} accessibilityLabel={`Remove ${formatDuration(row.minutes)} on ${taskTitle(row.taskId)}`} onPress={() => setRemoving(row)}><Trash2 size={18} color={colors.destructive} /></ProjectIconButton>
                  </View>
                ) : row.status === 'void' ? <ProjectPill label="Removed" tone="neutral" /> : null}
              />
            ))}
          </View>
        ) : null}
      </ProjectSection>

      {teamTotals ? (
        <>
          <ProjectSection title={`Team total · ${formatDuration(teamTotals.total)}`}>
            <Text style={{ color: colors.mutedText, fontSize: 12 }}>Totals only. Each person's entries and notes stay private to them.</Text>
            {Object.keys(teamTotals.byMember).length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 13 }}>No time logged yet.</Text> : (
              <View style={projectListStyle(colors)}>
                {Object.entries(teamTotals.byMember).sort((first, second) => second[1] - first[1]).map(([uid, minutes], index) => (
                  <ProjectListRow key={uid} isFirst={index === 0} title={memberName(uid)} right={<Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{formatDuration(minutes)}</Text>} />
                ))}
              </View>
            )}
          </ProjectSection>
          <ProjectSection title="Estimate against actual">
            {managerTasks.length === 0 ? <Text style={{ color: colors.mutedText, fontSize: 13 }}>Tasks with an estimate or logged time show here.</Text> : (
              <View style={projectListStyle(colors)}>
                {managerTasks.map((task, index) => {
                  const actual = teamTotals.byTask[task.id] ?? 0;
                  const estimate = Math.round(task.estimatedTime * 60);
                  const over = estimate > 0 && actual > estimate;
                  return <ProjectListRow key={task.id} isFirst={index === 0} title={task.title} detail={`Estimate ${estimate ? formatDuration(estimate) : 'not set'} · Logged ${formatDuration(actual)}`} right={over ? <ProjectPill label="Over estimate" tone="warning" /> : null} />;
                })}
              </View>
            )}
          </ProjectSection>
        </>
      ) : null}

      {!loading && ownRows.length === 0 && !teamTotals && !canLog ? <EmptyPanel icon={<Clock size={26} color={colors.mutedText} />} title="Nothing to show" message="Viewers do not log time. Your own time appears here once you log some." /> : null}

      <ProjectEditSheet visible={form !== null} title="Log time" subtitle="Only you see this entry. Owners and admins see totals." saveLabel="Log time" isSaving={saving} error={formError} onSave={() => void handleLog()} onClose={() => setForm(null)}>
        {form ? <>
          <ProjectOptionChips label="Task" value={form.taskId} options={taskOptions} onChange={(taskId) => setForm({ ...form, taskId })} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><ProjectTextField label="Hours" value={form.hours} onChangeText={(hours) => setForm({ ...form, hours: hours.replace(/[^0-9.,]/g, '') })} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><ProjectTextField label="Minutes" value={form.minutes} onChangeText={(minutes) => setForm({ ...form, minutes: minutes.replace(/[^0-9]/g, '') })} keyboardType="number-pad" /></View>
          </View>
          <ProjectDayField label="Day" value={form.date} placeholder="Today" onChange={(date) => setForm({ ...form, date })} />
          <ProjectTextField label="Note (optional)" value={form.note} onChangeText={(note) => setForm({ ...form, note })} multiline maxLength={TIME_NOTE_LIMIT} />
        </> : null}
      </ProjectEditSheet>

      <ProjectEditSheet visible={correcting !== null} title="Correct this entry" subtitle="The previous values are kept with the entry." saveLabel="Save correction" isSaving={saving} error={formError} onSave={() => void handleCorrect()} onClose={() => setCorrecting(null)}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><ProjectTextField label="Hours" value={correction.hours} onChangeText={(hours) => setCorrection({ ...correction, hours: hours.replace(/[^0-9.,]/g, '') })} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><ProjectTextField label="Minutes" value={correction.minutes} onChangeText={(minutes) => setCorrection({ ...correction, minutes: minutes.replace(/[^0-9]/g, '') })} keyboardType="number-pad" /></View>
        </View>
        <ProjectDayField label="Day" value={correction.date} onChange={(date) => setCorrection({ ...correction, date })} />
        <ProjectTextField label="Note" value={correction.note} onChangeText={(note) => setCorrection({ ...correction, note })} multiline maxLength={TIME_NOTE_LIMIT} />
        <ProjectTextField label="Why the correction" value={correction.reason} onChangeText={(reason) => setCorrection({ ...correction, reason })} isRequired maxLength={TIME_REASON_LIMIT} />
      </ProjectEditSheet>

      <ProjectNoteSheet
        visible={removing !== null}
        title="Remove this entry?"
        message="It stays on record as removed and stops counting in totals."
        label="Why you are removing it"
        confirmLabel="Remove entry"
        tone="danger"
        isRequired
        maxLength={TIME_REASON_LIMIT}
        onClose={() => setRemoving(null)}
        onConfirm={async (reason) => {
          if (!removing) return;
          await projectOperationsService.voidTime(project.id, removing.id, reason);
          toast.success('Entry removed');
          await load();
        }}
      />
    </View>
  );
}

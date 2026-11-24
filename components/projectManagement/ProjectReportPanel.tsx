import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { BarChart3, Download, RefreshCw } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { PanelHeader } from '@/components/projectManagement/ProjectPanelParts';
import { ProjectButton, ProjectProgressBar, ProjectSection } from '@/components/projectManagement/ProjectUiParts';
import { ProjectListRow, formatWhen, projectListStyle } from '@/components/projectManagement/ProjectFormParts';
import { formatCalendarDate, formatDuration } from '@/components/projectManagement/projectFormat';
import { projectOperationsService } from '@/lib/services/ProjectOperationsService';
import { projectExportService } from '@/lib/services/ProjectExportService';
import type { ProjectReport } from '@/lib/types/project';

type ProjectReportPanelProps = {
  projectId: string;
  nameOf: (uid: string) => string;
};

const STATUS_WORDS: { [status: string]: string } = {
  draft: 'Draft', submitted: 'Waiting for review', accepted: 'Accepted', changes_requested: 'Changes requested',
  proposed: 'Waiting', approved: 'Approved', rejected: 'Rejected', withdrawn: 'Withdrawn', implemented: 'Implemented',
};

/**
 * The project report (website report page): progress, milestones, deliverables, risks and issues, change requests,
 * decisions and time totals, all worked out by the server from a bounded read. Share it as a CSV. No money in this
 * phase. Time follows the time log's privacy: owners and admins see team totals, everyone else their own.
 */
export default function ProjectReportPanel({ projectId, nameOf }: ProjectReportPanelProps) {
  const { colors } = useAppTheme();
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await projectOperationsService.report(projectId));
    } catch (failure: unknown) {
      console.error('[ProjectReportPanel.load] Error:', failure);
      setError(failure instanceof Error ? failure.message : 'The report could not be made. Try again.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const handleExport = async (): Promise<void> => {
    if (!report || exporting) return;
    setExporting(true);
    try {
      await projectExportService.exportReportToCsv(report, nameOf);
    } catch (failure: unknown) {
      toast.error(failure instanceof Error ? failure.message : 'The CSV could not be shared.');
    } finally {
      setExporting(false);
    }
  };

  const muted = { color: colors.mutedText, fontSize: 13 } as const;
  return (
    <View style={{ gap: 12 }}>
      <PanelHeader
        icon={<BarChart3 size={18} color={colors.accent} />}
        title="Project report"
        description={report ? `Made ${formatWhen(report.generatedAt)}. Figures come from the server, not this phone.` : 'Progress, milestones, deliverables, risks and time, from the server.'}
        action={<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <ProjectButton label="Share CSV" icon={<Download size={18} color="#ffffff" />} onPress={() => void handleExport()} isBusy={exporting} isDisabled={!report} />
          <ProjectButton variant="secondary" label="Refresh" icon={<RefreshCw size={16} color={colors.text} />} onPress={() => void load()} isDisabled={loading} />
        </View>}
      />
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructiveText, fontSize: 13 }}>{error}</Text> : null}
      {report ? <>
        {report.truncated.length ? <Text style={muted}>This report reads at most a set number of records; it shows only the first {report.truncated.join(', ')}.</Text> : null}
        <ProjectSection title={`Progress · ${report.project.progress}%`}>
          <ProjectProgressBar value={report.project.progress} accessibilityLabel="Project progress" />
          <Text style={muted}>{report.tasks.total} tasks: {report.tasks.todo} to do, {report.tasks.inProgress} in progress, {report.tasks.done} done.</Text>
          <Text style={muted}>{report.tasks.overdue} overdue · {report.tasks.waiting} waiting on other tasks · {report.tasks.conflicts} with date conflicts · {report.tasks.estimateHours} hours estimated</Text>
          {report.project.endDate ? <Text style={muted}>Target date {formatCalendarDate(report.project.endDate)}</Text> : null}
        </ProjectSection>

        <ProjectSection title={`Milestones (${report.milestones.length})`}>
          {report.milestones.length === 0 ? <Text style={muted}>No milestones.</Text> : <View style={projectListStyle(colors)}>
            {report.milestones.map((milestone, index) => <ProjectListRow key={milestone.id} isFirst={index === 0} title={milestone.name} detail={`${milestone.dueDate ? `Due ${formatCalendarDate(milestone.dueDate)}` : 'No date'} · ${milestone.doneCount} of ${milestone.taskCount} tasks done${milestone.completed ? ' · Complete' : ''}`} />)}
          </View>}
        </ProjectSection>

        {report.deliverables ? <ProjectSection title={`Deliverables (${report.deliverables.rows.length})`}>
          <Text style={muted}>{Object.entries(report.deliverables.counts).map(([status, count]) => `${count} ${(STATUS_WORDS[status] ?? status).toLowerCase()}`).join(' · ') || 'None yet.'}</Text>
          {report.deliverables.rows.length > 0 ? <View style={projectListStyle(colors)}>
            {report.deliverables.rows.map((row, index) => <ProjectListRow key={row.id} isFirst={index === 0} title={row.title} detail={`${STATUS_WORDS[row.status] ?? row.status} · version ${row.revision} · ${nameOf(row.ownerId)}${row.dueDate ? ` · due ${formatCalendarDate(row.dueDate)}` : ''}`} />)}
          </View> : null}
        </ProjectSection> : null}

        {report.registers ? <ProjectSection title="Risks, issues and changes">
          <Text style={muted}>{report.registers.risks.open} open risks · {report.registers.issues.open} open issues · {report.registers.decisions} decisions recorded</Text>
          <Text style={muted}>Change requests: {Object.entries(report.registers.changeRequests.counts).map(([status, count]) => `${count} ${(STATUS_WORDS[status] ?? status).toLowerCase()}`).join(' · ') || 'none'}</Text>
          {report.registers.risks.rows.slice(0, 10).map((risk) => <Text key={risk.id} style={{ color: colors.secondaryText, fontSize: 13 }}>Risk: {risk.title} ({risk.status}, likelihood {risk.likelihood}, impact {risk.impact})</Text>)}
          {report.registers.issues.rows.slice(0, 10).map((issue) => <Text key={issue.id} style={{ color: colors.secondaryText, fontSize: 13 }}>Issue: {issue.title} ({issue.status}, severity {issue.severity})</Text>)}
        </ProjectSection> : null}

        {report.time ? <ProjectSection title={`${report.time.scope === 'team' ? 'Team time' : 'Your time'} · ${formatDuration(report.time.totalMinutes)}`}>
          {report.time.scope === 'own' ? <Text style={muted}>Only your own time is shown. Owners and admins see team totals.</Text> : null}
          {report.time.byMember.map((member) => <Text key={member.userId} style={{ color: colors.secondaryText, fontSize: 13 }}>{nameOf(member.userId)}: {formatDuration(member.minutes)}</Text>)}
        </ProjectSection> : null}

        {report.outcome ? <ProjectSection title="Outcome">
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{report.outcome.summary || 'No summary was written.'}</Text>
          <Text style={muted}>{report.outcome.acceptedCount} accepted deliverables · recorded {formatWhen(report.outcome.recordedAt)}</Text>
        </ProjectSection> : null}
      </> : null}
    </View>
  );
}

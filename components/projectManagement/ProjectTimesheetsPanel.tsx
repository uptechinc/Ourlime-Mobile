import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Clock, Download, Lock } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { EmptyPanel, PanelHeader, PremiumNotice } from '@/components/projectManagement/ProjectPanelParts';
import { formatDuration } from '@/components/projectManagement/projectFormat';
import { projectEntitlementService } from '@/lib/services/ProjectEntitlementService';
import { projectExportService } from '@/lib/services/ProjectExportService';
import type { ProjectRecord, Task, TeamMember } from '@/lib/types/project';

type ProjectTimesheetsPanelProps = {
  project: ProjectRecord;
  tasks: Task[];
  teamMembers: TeamMember[];
  onOpenUpgrade: () => void;
};

/** Website ProjectTimesheetsTab: every time entry across tasks, filterable by member, with a Premium CSV export. */
export default function ProjectTimesheetsPanel({ project, tasks, teamMembers, onOpenUpgrade }: ProjectTimesheetsPanelProps) {
  const { colors } = useAppTheme();
  const isPremium = projectEntitlementService.isPremium(project);
  const [selectedMember, setSelectedMember] = useState('all');
  const [exporting, setExporting] = useState(false);

  const entries = useMemo(() => {
    const names = new Map(teamMembers.map((member) => [member.id, member.name]));
    return tasks
      .flatMap((task) => task.timeEntries.map((entry) => ({ ...entry, taskTitle: task.title, userName: names.get(entry.userId) || 'Team Member' })))
      .sort((first, second) => new Date(second.date || second.startTime).getTime() - new Date(first.date || first.startTime).getTime());
  }, [tasks, teamMembers]);
  const visible = selectedMember === 'all' ? entries : entries.filter((entry) => entry.userId === selectedMember);
  const totalMinutes = visible.reduce((sum, entry) => sum + (entry.duration || 0), 0);

  const handleExport = async (): Promise<void> => {
    if (!isPremium) { toast.error('Timesheet CSV export is a Premium feature'); onOpenUpgrade(); return; }
    if (exporting) return;
    setExporting(true);
    try {
      await projectExportService.exportTimesheetToCsv(project, visible.map((entry) => ({
        date: entry.date || (entry.startTime ? new Date(entry.startTime).toLocaleDateString() : ''),
        userName: entry.userName, taskTitle: entry.taskTitle, duration: entry.duration, description: entry.description || '',
      })));
      toast.success('Timesheet exported to CSV');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'The timesheet could not be exported.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <PanelHeader
        icon={<Clock size={18} color={colors.accent} />}
        title="Project Timesheets & Logs"
        badge="Time Audit"
        description="Aggregated audit log of all time tracked by team members across project tasks."
        action={(
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: colors.mutedText, fontSize: 10, fontWeight: '800' }}>TOTAL LOGGED</Text>
              <Text style={{ color: colors.accent, fontSize: 20, fontWeight: '900' }}>{formatDuration(totalMinutes)}</Text>
            </View>
            <TouchableOpacity onPress={() => void handleExport()} disabled={exporting} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
              {exporting ? <ActivityIndicator size="small" color={colors.accent} /> : isPremium ? <Download size={14} color={colors.text} /> : <Lock size={14} color={colors.mutedText} />}
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>Export Timesheet</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      {!isPremium ? <PremiumNotice title="Timesheets:" message="Free plan shows the time log. Upgrade to Premium for exportable weekly and monthly timesheets." onUpgrade={onOpenUpgrade} /> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {[{ id: 'all', name: `All Team Members (${teamMembers.length})` }, ...teamMembers.map((member) => ({ id: member.id, name: member.name }))].map((option) => {
          const selected = option.id === selectedMember;
          return (
            <TouchableOpacity key={option.id} onPress={() => setSelectedMember(option.id)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.surface }}>
              <Text numberOfLines={1} style={{ color: selected ? colors.onAccent : colors.secondaryText, fontSize: 12, fontWeight: '800' }}>{option.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {visible.length === 0 ? (
        <EmptyPanel icon={<Clock size={26} color={colors.mutedText} />} title="No time logged yet" message="Time tracked on tasks (timer sessions and manual logs) appears here." />
      ) : (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          {visible.map((entry, index) => (
            <View key={`${entry.taskId}-${entry.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>{entry.taskTitle}</Text>
                <Text numberOfLines={2} style={{ color: colors.secondaryText, fontSize: 12 }}>{entry.description || 'No notes'}</Text>
                <Text style={{ color: colors.mutedText, fontSize: 11 }}>{entry.userName} · {entry.date || (entry.startTime ? new Date(entry.startTime).toLocaleDateString() : '')}</Text>
              </View>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '900' }}>{formatDuration(entry.duration || 0)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

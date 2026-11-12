import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp, Users } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import UserAvatar from '@/components/ui/UserAvatar';
import { EmptyPanel, PanelHeader, PremiumNotice } from '@/components/projectManagement/ProjectPanelParts';
import { STATUS_LABELS, formatDuration, isAssignedTo, priorityColor, taskMinutes } from '@/components/projectManagement/projectFormat';
import { projectEntitlementService } from '@/lib/services/ProjectEntitlementService';
import type { ProjectRecord, Task, TeamMember } from '@/lib/types/project';

type ProjectWorkloadPanelProps = {
  project: ProjectRecord;
  tasks: Task[];
  teamMembers: TeamMember[];
  onOpenUpgrade: () => void;
  onSelectTask: (task: Task) => void;
};

// Same capacity model as the website's ProjectWorkloadView.
const STANDARD_WEEKLY_CAPACITY_HOURS = 40;

/** Website ProjectWorkloadView: per-member task load, estimated hours vs 40h capacity, and logged time. */
export default function ProjectWorkloadPanel({ project, tasks, teamMembers, onOpenUpgrade, onSelectTask }: ProjectWorkloadPanelProps) {
  const { colors } = useAppTheme();
  const isPremium = projectEntitlementService.isPremium(project);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const workloads = useMemo(() => teamMembers.map((member) => {
    const assigned = tasks.filter((task) => isAssignedTo(task, member.id));
    const estimatedHours = assigned.reduce((sum, task) => sum + (task.estimatedTime || 0), 0);
    const loggedMinutes = assigned.reduce((sum, task) => sum + taskMinutes(task), 0);
    const capacity: 'under' | 'balanced' | 'overloaded' = estimatedHours < 15 ? 'under' : estimatedHours > 40 ? 'overloaded' : 'balanced';
    return {
      member,
      assigned,
      estimatedHours,
      loggedMinutes,
      done: assigned.filter((task) => task.status === 'done').length,
      active: assigned.filter((task) => task.status === 'in-progress').length,
      utilization: Math.min(150, Math.round((estimatedHours / STANDARD_WEEKLY_CAPACITY_HOURS) * 100)),
      capacity,
    };
  }), [tasks, teamMembers]);

  const capacityStyle = { overloaded: { label: 'Overloaded', color: '#e11d48' }, balanced: { label: 'Balanced', color: '#10b981' }, under: { label: 'Light Workload', color: '#3b82f6' } };

  return (
    <View style={{ gap: 12 }}>
      <PanelHeader
        icon={<Users size={18} color={colors.accent} />}
        title="Team Workload & Resource Allocation"
        badge="Capacity Management"
        description="Monitor task distribution and hours across team members to prevent over-utilization and bottlenecks."
      />
      {!isPremium ? (
        <PremiumNotice
          title="Resource Balancing:"
          message="Free tier includes basic capacity views. Upgrade to Premium for AI-powered workload balancing, automated capacity re-assignment, and cross-project utilization."
          onUpgrade={onOpenUpgrade}
        />
      ) : null}
      {workloads.length === 0 ? (
        <EmptyPanel icon={<Users size={26} color={colors.mutedText} />} title="No team members" message="No team members found in this project." />
      ) : (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          {workloads.map((workload, index) => {
            const expanded = expandedId === workload.member.id;
            const style = capacityStyle[workload.capacity];
            return (
              <View key={workload.member.id} style={{ padding: 14, gap: 10, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border }}>
                <TouchableOpacity activeOpacity={0.75} onPress={() => setExpandedId(expanded ? null : workload.member.id)} style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <UserAvatar profileImage={workload.member.avatar} firstName={workload.member.name} size={38} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '800', flexShrink: 1 }}>{workload.member.name}</Text>
                        <Text style={{ color: colors.mutedText, fontSize: 10, fontWeight: '700', textTransform: 'capitalize', backgroundColor: colors.control, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, overflow: 'hidden' }}>{workload.member.role}</Text>
                      </View>
                      <Text style={{ color: colors.mutedText, fontSize: 12 }}>{workload.assigned.length} task{workload.assigned.length !== 1 ? 's' : ''} ({workload.active} active, {workload.done} done)</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: colors.mutedText, fontSize: 9, fontWeight: '800' }}>LOGGED TIME</Text>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>{formatDuration(workload.loggedMinutes)}</Text>
                    </View>
                    {expanded ? <ChevronUp size={16} color={colors.mutedText} /> : <ChevronDown size={16} color={colors.mutedText} />}
                  </View>
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.secondaryText, fontSize: 11 }}>{workload.estimatedHours}h estimated / {STANDARD_WEEKLY_CAPACITY_HOURS}h capacity</Text>
                      <Text style={{ color: style.color, fontSize: 11, fontWeight: '800' }}>{style.label}</Text>
                    </View>
                    <View style={{ height: 7, borderRadius: 999, backgroundColor: colors.control, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${Math.min(100, workload.utilization)}%`, backgroundColor: style.color }} />
                    </View>
                  </View>
                </TouchableOpacity>
                {expanded ? (
                  workload.assigned.length === 0 ? (
                    <Text style={{ color: colors.mutedText, fontSize: 12 }}>No tasks currently assigned to this member.</Text>
                  ) : (
                    <View style={{ gap: 6 }}>
                      {workload.assigned.map((task) => (
                        <TouchableOpacity key={task.id} onPress={() => onSelectTask(task)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.control }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: priorityColor(task.priority) }} />
                          <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 12, fontWeight: '700' }}>{task.title}</Text>
                          <Text style={{ color: colors.mutedText, fontSize: 11 }}>{task.estimatedTime || 0}h · {STATUS_LABELS[task.status]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

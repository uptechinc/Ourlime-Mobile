import { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight, Flag, Layers } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { PanelHeader, PremiumNotice } from '@/components/projectManagement/ProjectPanelParts';
import { STATUS_LABELS, parseCalendarString } from '@/components/projectManagement/projectFormat';
import { projectEntitlementService } from '@/lib/services/ProjectEntitlementService';
import type { Milestone, Priority, ProjectRecord, Task } from '@/lib/types/project';

type ProjectTimelinePanelProps = {
  project: ProjectRecord;
  tasks: Task[];
  milestones: Milestone[];
  onOpenUpgrade: () => void;
  onSelectTask: (task: Task) => void;
};

const DAYS_TO_SHOW = 28;
const DAY_WIDTH = 30;
const TITLE_WIDTH = 140;
const DAY_MS = 24 * 60 * 60 * 1000;
const BAR_COLORS: { [priority in Priority]: string } = { urgent: '#f43f5e', high: '#f97316', medium: '#3b82f6', low: '#10b981' };

function dayStart(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Website ProjectTimelineView: a 28-day Gantt grid with milestone flags, scrolled sideways on a phone. */
export default function ProjectTimelinePanel({ project, tasks, milestones, onOpenUpgrade, onSelectTask }: ProjectTimelinePanelProps) {
  const { colors } = useAppTheme();
  const isPremium = projectEntitlementService.isPremium(project);
  const [offsetDays, setOffsetDays] = useState(0);

  const startDate = useMemo(() => {
    const date = dayStart(new Date());
    date.setDate(date.getDate() - 3 + offsetDays);
    return date;
  }, [offsetDays]);
  const days = useMemo(() => Array.from({ length: DAYS_TO_SHOW }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  }), [startDate]);
  const todayTime = dayStart(new Date()).getTime();
  const sortedTasks = useMemo(() => [...tasks].sort((first, second) => (parseCalendarString(first.dueDate)?.getTime() ?? 0) - (parseCalendarString(second.dueDate)?.getTime() ?? 0)), [tasks]);
  const gridWidth = DAYS_TO_SHOW * DAY_WIDTH;
  const dayIndex = (date: Date): number => Math.round((dayStart(date).getTime() - startDate.getTime()) / DAY_MS);

  return (
    <View style={{ gap: 12 }}>
      <PanelHeader
        icon={<Layers size={18} color={colors.accent} />}
        title="Gantt Chart & Visual Timeline"
        badge="Timeline Schedule"
        description="Track task timelines, deadlines, and milestone flags across calendar days."
        action={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity accessibilityLabel="Previous 7 days" onPress={() => setOffsetDays((value) => value - 7)} style={{ padding: 7, borderRadius: 9, backgroundColor: colors.control }}><ChevronLeft size={16} color={colors.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setOffsetDays(0)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: colors.control }}><Text style={{ color: colors.text, fontSize: 12, fontWeight: '800' }}>Today</Text></TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Next 7 days" onPress={() => setOffsetDays((value) => value + 7)} style={{ padding: 7, borderRadius: 9, backgroundColor: colors.control }}><ChevronRight size={16} color={colors.text} /></TouchableOpacity>
          </View>
        )}
      />
      {!isPremium ? (
        <PremiumNotice
          title="Gantt Timeline View:"
          message="Free plan includes basic read-only preview. Upgrade to Premium for interactive drag-to-reschedule, auto-dependency shifting, and critical path analysis."
          onUpgrade={onOpenUpgrade}
        />
      ) : null}

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden', flexDirection: 'row' }}>
        {/* Fixed task title column */}
        <View style={{ width: TITLE_WIDTH, borderRightWidth: 1, borderRightColor: colors.border }}>
          <View style={{ height: 40, justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.control }}>
            <Text style={{ color: colors.mutedText, fontSize: 10, fontWeight: '900' }}>TASK TITLE</Text>
          </View>
          {milestones.length > 0 ? (
            <View style={{ height: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, backgroundColor: 'rgba(147,51,234,0.08)' }}>
              <Flag size={12} color="#9333ea" /><Text style={{ color: '#9333ea', fontSize: 11, fontWeight: '800' }}>Milestones</Text>
            </View>
          ) : null}
          {sortedTasks.map((task) => (
            <TouchableOpacity key={task.id} onPress={() => onSelectTask(task)} style={{ height: 44, justifyContent: 'center', paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{task.title}</Text>
              <Text style={{ color: task.status === 'done' ? '#15803d' : colors.mutedText, fontSize: 10, fontWeight: '700' }}>{STATUS_LABELS[task.status]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ width: gridWidth }}>
            <View style={{ height: 40, flexDirection: 'row', backgroundColor: colors.control }}>
              {days.map((day) => {
                const isToday = day.getTime() === todayTime;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <View key={day.getTime()} style={{ width: DAY_WIDTH, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? 'rgba(16,185,129,0.2)' : undefined }}>
                    <Text style={{ fontSize: 9, color: colors.mutedText }}>{day.toLocaleDateString('en-US', { weekday: 'narrow' })}</Text>
                    <Text style={{ fontSize: 11, fontWeight: isToday ? '900' : '600', color: isToday ? colors.accent : isWeekend ? colors.mutedText : colors.text }}>{day.getDate()}</Text>
                  </View>
                );
              })}
            </View>
            {milestones.length > 0 ? (
              <View style={{ height: 34, backgroundColor: 'rgba(147,51,234,0.08)' }}>
                {milestones.map((milestone) => {
                  const date = parseCalendarString(milestone.dueDate);
                  if (!date) return null;
                  const index = dayIndex(date);
                  if (index < 0 || index >= DAYS_TO_SHOW) return null;
                  return (
                    <View key={milestone.id} style={{ position: 'absolute', top: 7, left: index * DAY_WIDTH + 2, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: '#9333ea', maxWidth: 120 }}>
                      <Flag size={9} color="#ffffff" />
                      <Text numberOfLines={1} style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>{milestone.name}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {sortedTasks.length === 0 ? (
              <Text style={{ padding: 20, color: colors.mutedText, fontSize: 12 }}>No tasks available to display on the timeline.</Text>
            ) : sortedTasks.map((task) => {
              const taskStart = parseCalendarString(task.startDate) ?? (task.createdAt ? new Date(task.createdAt) : new Date());
              const taskDue = parseCalendarString(task.dueDate) ?? new Date(taskStart.getTime() + DAY_MS * 2);
              const startIndex = Math.max(0, dayIndex(taskStart));
              const endIndex = Math.min(DAYS_TO_SHOW - 1, dayIndex(taskDue));
              const span = Math.max(1, endIndex - startIndex + 1);
              const visible = endIndex >= 0 && startIndex < DAYS_TO_SHOW;
              const todayIndex = dayIndex(new Date());
              return (
                <TouchableOpacity key={task.id} activeOpacity={0.8} onPress={() => onSelectTask(task)} style={{ height: 44, borderTopWidth: 1, borderTopColor: colors.border, justifyContent: 'center' }}>
                  {todayIndex >= 0 && todayIndex < DAYS_TO_SHOW ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: todayIndex * DAY_WIDTH, width: DAY_WIDTH, backgroundColor: 'rgba(16,185,129,0.08)' }} /> : null}
                  {visible ? (
                    <View style={{ position: 'absolute', left: startIndex * DAY_WIDTH + 1, width: Math.max(span * DAY_WIDTH - 2, 30), height: 26, borderRadius: 8, backgroundColor: BAR_COLORS[task.priority], justifyContent: 'center', paddingHorizontal: 6, opacity: task.status === 'done' ? 0.6 : 1 }}>
                      <Text numberOfLines={1} style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>{task.progress}%</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

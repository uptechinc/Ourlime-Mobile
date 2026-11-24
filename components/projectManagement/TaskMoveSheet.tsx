import { Check, CheckCircle2, Circle, CircleDot, ExternalLink } from 'lucide-react-native';
import { View } from 'react-native';
import ProjectActionSheet from '@/components/projectManagement/ProjectActionSheet';
import { ProjectSheetRow } from '@/components/projectManagement/ProjectUiParts';
import { STATUS_LABELS } from '@/components/projectManagement/projectFormat';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { TASK_STATUS_ORDER } from '@/lib/services/ProjectInsightRules';
import type { Status, Task } from '@/lib/types/project';

type TaskMoveSheetProps = {
  task: Task | null;
  onClose: () => void;
  onMove: (task: Task, status: Status) => void;
  onOpen: (task: Task) => void;
};

const STATUS_DETAIL: { [status in Status]: string } = {
  todo: 'Not started yet',
  'in-progress': 'Someone is working on it',
  done: 'Finished',
};

/** The accessible alternative to dragging a card between board columns: pick the column from a list. */
export default function TaskMoveSheet({ task, onClose, onMove, onOpen }: TaskMoveSheetProps) {
  const { colors } = useAppTheme();
  const iconFor = (status: Status) => (status === 'done' ? <CheckCircle2 size={18} color={colors.icon} /> : status === 'in-progress' ? <CircleDot size={18} color={colors.icon} /> : <Circle size={18} color={colors.icon} />);
  return (
    <ProjectActionSheet visible={task !== null} title="Move to…" subtitle={task?.title} onClose={onClose}>
      {task ? <>
        {TASK_STATUS_ORDER.map((status) => {
          const isCurrent = task.status === status;
          return (
            <ProjectSheetRow
              key={status}
              label={STATUS_LABELS[status]}
              detail={isCurrent ? 'Current column' : STATUS_DETAIL[status]}
              icon={iconFor(status)}
              isSelected={isCurrent}
              accessibilityLabel={isCurrent ? `${STATUS_LABELS[status]}, current column` : `Move to ${STATUS_LABELS[status]}`}
              right={isCurrent ? <Check size={18} color={colors.accentText} /> : undefined}
              onPress={() => { onClose(); if (!isCurrent) onMove(task, status); }}
            />
          );
        })}
        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
        <ProjectSheetRow label="Open task" detail="Details, checklist, comments and files" icon={<ExternalLink size={18} color={colors.icon} />} onPress={() => { onClose(); onOpen(task); }} />
      </> : null}
    </ProjectActionSheet>
  );
}

import type { Priority, Status, Task } from '@/lib/types/project';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Website useProjectDetails.formatDuration: "2h 15m". */
export function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Website useProjectDetails.formatFileSize. */
export function formatFileSize(bytes: number): string {
  if (!bytes) return '0 Bytes';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const index = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(2))} ${sizes[index]}`;
}

/** Calendar date (YYYY-MM-DD) in words, never shifted through UTC. */
export function formatCalendarDate(value: string | null | undefined, fallback = ''): string {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match ? `${MONTH_NAMES[Number(match[2]) - 1] ?? match[2]} ${Number(match[3])}, ${match[1]}` : (value || fallback);
}

/** Local calendar date as 'YYYY-MM-DD' (the format the website's task and project forms save). */
export function toCalendarString(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseCalendarString(value: string | null | undefined): Date | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

export const STATUS_LABELS: { [status in Status]: string } = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' };

export const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#64748b' },
  { value: 'medium', label: 'Medium', color: '#ca8a04' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

export function priorityColor(priority: Priority): string {
  return PRIORITY_OPTIONS.find((option) => option.value === priority)?.color ?? '#64748b';
}

export function statusColor(status: Status): string {
  return status === 'done' ? '#10b981' : status === 'in-progress' ? '#3b82f6' : '#64748b';
}

export function taskMinutes(task: Task): number {
  return task.timeEntries.reduce((total, entry) => total + (entry.duration || 0), 0);
}

/** A member is on a task when they are the assignee, in the assignees list, or the task is for everyone. */
export function isAssignedTo(task: Task, memberId: string): boolean {
  return task.assignedToAll === true || task.assignee === memberId || (task.assignees ?? []).includes(memberId);
}

// Same labels as the website's auditConfig.ts, plus the short action keys the task callable writes.
const AUDIT_LABELS: { [action: string]: string } = {
  task_created: 'Task created', task_updated: 'Task updated', status_changed: 'Status changed', subtask_added: 'Subtask added',
  subtask_updated: 'Subtask updated', comment_added: 'Comment added', time_entry_added: 'Time entry added',
  attachment_added: 'Attachment added', attachment_deleted: 'Attachment deleted',
  create: 'Task created', update: 'Task updated', add_subtask: 'Subtask added', toggle_subtask: 'Subtask updated', comment: 'Comment added',
  edit_comment: 'Comment edited', delete_comment: 'Comment deleted', time: 'Time entry added', add_attachment: 'Attachment added',
  delete_attachment: 'Attachment deleted', archive: 'Task archived', restore: 'Task restored', delete: 'Task deleted',
};

export function auditLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action.replace(/_/g, ' ');
}

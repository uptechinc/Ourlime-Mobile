import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { mobileExportService } from '@/lib/services/MobileExportService';
import type { Milestone, ProjectRecord, Task, TeamMember } from '@/lib/types/project';

const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fileSafe = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * Website lib/projects/ProjectExportService.ts on the phone: the tasks CSV and the printable project summary are written
 * to the cache folder and handed to the share sheet (the summary is an HTML page the viewer can print or save as PDF).
 */
export class ProjectExportService {
  private static instance: ProjectExportService;

  private constructor() {}

  public static getInstance(): ProjectExportService {
    if (!ProjectExportService.instance) ProjectExportService.instance = new ProjectExportService();
    return ProjectExportService.instance;
  }

  private assigneeNames(task: Task, memberNames: Map<string, string>): string {
    if (task.assignedToAll) return 'All Team Members';
    if (task.assignees && task.assignees.length > 0) return task.assignees.map((id) => memberNames.get(id) || 'Unknown').join(', ');
    return memberNames.get(task.assignee) || 'Unassigned';
  }

  private memberNames(teamMembers: TeamMember[]): Map<string, string> {
    return new Map(teamMembers.map((member) => [member.id, member.name]));
  }

  /** Same columns as the website's exportTasksToCsv. */
  public async exportTasksToCsv(project: ProjectRecord, tasks: Task[], teamMembers: TeamMember[]): Promise<void> {
    const names = this.memberNames(teamMembers);
    const rows = tasks.map((task) => {
      const completedSubtasks = task.subTasks.filter((subTask) => subTask.completed).length;
      return {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignees: this.assigneeNames(task, names),
        dueDate: task.dueDate || 'No due date',
        estimatedTime: String(task.estimatedTime || 0),
        timeSpent: String(task.timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0)),
        subtasks: task.subTasks.length > 0 ? `${completedSubtasks}/${task.subTasks.length}` : 'None',
        tags: task.tags.join(', '),
        createdAt: task.createdAt ? new Date(task.createdAt).toLocaleDateString() : '',
      };
    });
    await mobileExportService.exportToCsv(`${fileSafe(project.name)}_tasks_${today()}`, [
      { header: 'Task Title', key: 'title' }, { header: 'Status', key: 'status' }, { header: 'Priority', key: 'priority' },
      { header: 'Assignees', key: 'assignees' }, { header: 'Due Date', key: 'dueDate' }, { header: 'Estimated Hours', key: 'estimatedTime' },
      { header: 'Time Spent (Minutes)', key: 'timeSpent' }, { header: 'Subtasks Progress', key: 'subtasks' }, { header: 'Tags', key: 'tags' },
      { header: 'Created At', key: 'createdAt' },
    ], rows);
  }

  /** Same columns as the website's timesheet CSV (ProjectTimesheetsTab). */
  public async exportTimesheetToCsv(project: ProjectRecord, entries: { date: string; userName: string; taskTitle: string; duration: number; description: string }[]): Promise<void> {
    await mobileExportService.exportToCsv(`${fileSafe(project.name)}_timesheet_${today()}`, [
      { header: 'Date', key: 'date' }, { header: 'Team Member', key: 'userName' }, { header: 'Task Title', key: 'taskTitle' },
      { header: 'Duration (Minutes)', key: 'duration' }, { header: 'Hours', key: 'hours' }, { header: 'Notes', key: 'description' },
    ], entries.map((entry) => ({ ...entry, duration: String(entry.duration), hours: (entry.duration / 60).toFixed(2) })));
  }

  /** Website exportProjectSummaryToPdf: the same summary page, shared as an HTML file to print or save as PDF. */
  public async exportProjectSummary(project: ProjectRecord, tasks: Task[], teamMembers: TeamMember[], milestones: Milestone[]): Promise<void> {
    const names = this.memberNames(teamMembers);
    const totalTasks = tasks.length;
    const completed = tasks.filter((task) => task.status === 'done').length;
    const inProgress = tasks.filter((task) => task.status === 'in-progress').length;
    const todo = tasks.filter((task) => task.status === 'todo').length;
    const totalMinutes = tasks.reduce((sum, task) => sum + task.timeEntries.reduce((taskSum, entry) => taskSum + (entry.duration || 0), 0), 0);
    const percentDone = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
    const cell = 'padding:8px;border-bottom:1px solid #e5e7eb;';
    const taskRows = tasks.map((task) => `<tr><td style="${cell}">${escapeHtml(task.title)}</td><td style="${cell}text-transform:capitalize">${task.status}</td><td style="${cell}text-transform:capitalize">${task.priority}</td><td style="${cell}">${escapeHtml(this.assigneeNames(task, names))}</td><td style="${cell}">${task.dueDate ? escapeHtml(task.dueDate) : '-'}</td></tr>`).join('');
    const milestoneRows = milestones.length > 0
      ? milestones.map((milestone) => `<tr><td style="${cell}font-weight:500">${escapeHtml(milestone.name)}</td><td style="${cell}">${milestone.dueDate ? escapeHtml(milestone.dueDate) : '-'}</td><td style="${cell}">${milestone.completed ? 'Completed' : 'In Progress'}</td></tr>`).join('')
      : `<tr><td colspan="3" style="${cell}color:#6b7280">No milestones yet.</td></tr>`;
    const stat = (value: string, label: string): string => `<div class="stat-box"><div class="stat-val">${value}</div><div class="stat-lbl">${label}</div></div>`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(project.name)} - Project Summary</title>
<style>body{font-family:-apple-system,Roboto,sans-serif;color:#111827;padding:20px;line-height:1.5}h1{font-size:22px;margin-bottom:4px;color:#03a84e}.meta{color:#6b7280;font-size:14px;margin-bottom:20px}.stats-grid{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}.stat-box{flex:1;min-width:120px;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;background:#f9fafb}.stat-val{font-size:20px;font-weight:bold}.stat-lbl{font-size:12px;color:#6b7280;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}th{text-align:left;padding:8px;background:#f3f4f6;border-bottom:2px solid #d1d5db;font-size:12px;text-transform:uppercase;color:#4b5563}h2{font-size:18px;margin-top:24px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}</style></head>
<body><h1>${escapeHtml(project.name)}</h1><div class="meta">Exported on ${new Date().toLocaleDateString()} | Plan: ${project.planTier === 'premium' ? 'Premium' : 'Free'}</div>
<p style="color:#4b5563">${escapeHtml(project.description || 'No description provided.')}</p>
<div class="stats-grid">${stat(String(totalTasks), 'Total Tasks')}${stat(`${percentDone}%`, 'Completion Rate')}${stat(`${todo} / ${inProgress} / ${completed}`, 'To Do / In Progress / Done')}${stat(`${(totalMinutes / 60).toFixed(1)}h`, 'Time Logged')}</div>
<h2>Milestones</h2><table><thead><tr><th>Milestone</th><th>Due Date</th><th>Status</th></tr></thead><tbody>${milestoneRows}</tbody></table>
<h2>Tasks</h2><table><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Assignees</th><th>Due Date</th></tr></thead><tbody>${taskRows}</tbody></table>
</body></html>`;
    const fileUri = `${FileSystem.cacheDirectory || ''}${fileSafe(project.name)}_summary_${today()}.html`;
    await FileSystem.writeAsStringAsync(fileUri, html, { encoding: FileSystem.EncodingType.UTF8 });
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    await Sharing.shareAsync(fileUri, { mimeType: 'text/html', dialogTitle: `${project.name} summary`, UTI: 'public.html' });
  }
}

export const projectExportService = ProjectExportService.getInstance();

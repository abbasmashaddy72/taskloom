import { PRIORITIES, STATUSES, type ImportProject, type Priority, type Status } from './types';

const statusFromMark: Record<string, Status> = {
  ' ': 'pending', x: 'completed', X: 'completed', '-': 'in_progress', '/': 'in_progress', '!': 'blocked', '?': 'failed',
};
const markFromStatus: Record<Status, string> = {
  pending: ' ', completed: 'x', in_progress: '-', blocked: '!', failed: '?',
};
const clean = (str: string) => str.replace(/\s+/g, ' ').trim();

function parseLine(body: string, symbol: string) {
  const parts = body.split(/\s+\|\s+/);
  const title = clean(parts.shift() ?? '');
  let status = statusFromMark[symbol] ?? 'pending';
  let priority: Priority = 'medium';
  let dueDate: string | null = null;
  for (const item of parts) {
    const match = /^(status|priority|due|date)\s*:\s*(.+)$/i.exec(item.trim());
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim().toLowerCase();
    if (key === 'status' && STATUSES.includes(value as Status)) status = value as Status;
    if (key === 'priority' && PRIORITIES.includes(value as Priority)) priority = value as Priority;
    if ((key === 'due' || key === 'date') && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value) dueDate = value;
  }
  return { title, status, priority, dueDate };
}

export function parseMarkdown(markdown: string, fallbackName = 'Imported project'): ImportProject {
  if (!markdown.trim()) throw new Error('Markdown is empty.');
  if (markdown.length > 1_000_000) throw new Error('Markdown exceeds the 1 MB import limit.');
  const result: ImportProject = { name: fallbackName, description: '', lists: [] };
  let currentList: ImportProject['lists'][number] | null = null;
  let currentTask: ImportProject['lists'][number]['tasks'][number] | null = null;
  let sawProject = false;
  let count = 0;
  for (const original of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const line = original.replace(/\t/g, '  ');
    const project = /^#\s+(?:Project:\s*)?(.+)\s*$/i.exec(line);
    if (project && !sawProject) {
      result.name = clean(project[1]);
      sawProject = true;
      continue;
    }
    const list = /^##\s+(?:List:\s*)?(.+)\s*$/i.exec(line);
    if (list) {
      currentList = { title: clean(list[1]), tasks: [] };
      result.lists.push(currentList);
      currentTask = null;
      continue;
    }
    if (/^>\s+/.test(line) && !result.description && !currentList) {
      result.description = clean(line.replace(/^>\s*/, ''));
      continue;
    }
    // Supports Markdown task checkboxes and ordinary Markdown bullets.
    const bullet = /^(\s*)[-*+]\s+(?:\[([ xX\-/!?])\]\s*)?(.+?)\s*$/.exec(line);
    if (!bullet) continue;
    const indent = bullet[1].length;
    const parsed = parseLine(bullet[3], bullet[2] ?? ' ');
    if (!parsed.title) continue;
    count++;
    if (count > 2000) throw new Error('An import may contain at most 2,000 tasks and subtasks.');
    if (!currentList) {
      currentList = { title: 'General', tasks: [] };
      result.lists.push(currentList);
    }
    if (indent >= 2 && currentTask) {
      currentTask.subtasks.push({ title: parsed.title, status: parsed.status, dueDate: parsed.dueDate });
    } else {
      currentTask = { ...parsed, subtasks: [] };
      currentList.tasks.push(currentTask);
    }
  }
  if (!result.lists.length || !result.lists.some(l => l.tasks.length)) throw new Error('No tasks found. Use Markdown bullets such as "- [ ] My task".');
  return result;
}

export function toMarkdown(project: ImportProject): string {
  const lines = [`# Project: ${project.name}`];
  if (project.description) lines.push('', `> ${project.description.replace(/\n/g, ' ')}`);
  for (const list of project.lists) {
    lines.push('', `## List: ${list.title}`, '');
    for (const task of list.tasks) {
      const meta = [`priority:${task.priority}`];
      if (task.dueDate) meta.push(`due:${task.dueDate}`);
      lines.push(`- [${markFromStatus[task.status]}] ${task.title}${meta.length ? ` | ${meta.join(' | ')}` : ''}`);
      for (const subtask of task.subtasks) {
        lines.push(`  - [${markFromStatus[subtask.status]}] ${subtask.title}${subtask.dueDate ? ` | due:${subtask.dueDate}` : ''}`);
      }
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

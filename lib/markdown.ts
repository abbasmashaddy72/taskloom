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

/** Parse every checklist row as a single-level subtask (including nested checkbox rows). */
export function parseChecklist(markdown: string): {title: string; status: Status; dueDate: string | null}[] {
  if (!markdown.trim()) throw new Error('Paste a Markdown checklist first.');
  if (markdown.length > 1_000_000) throw new Error('Markdown exceeds the 1 MB import limit.');
  const rows: {title: string; status: Status; dueDate: string | null}[] = [];
  for (const line of markdown.replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n')) {
    const match = /^\s*[-*+]\s+(?:\[([ xX\-/!?])\]\s*)?(.+?)\s*$/.exec(line);
    if (!match) continue;
    const parsed = parseLine(match[2], match[1] ?? ' ');
    if (!parsed.title) continue;
    if (parsed.title.length > 160) throw new Error(`Subtask title exceeds 160 characters: ${parsed.title.slice(0, 40)}…`);
    rows.push({title: parsed.title, status: parsed.status, dueDate: parsed.dueDate});
    if (rows.length > 2000) throw new Error('At most 2,000 subtasks may be imported.');
  }
  if (!rows.length) throw new Error('No checklist items found. Use "- [ ] Subtask" lines.');
  return rows;
}

/** Section-aware Markdown checklist: preserves headings, task status, and source details. */
export type ChecklistItem = {
  title: string;
  description: string;
  status: Status;
  dueDate: string | null;
  section: string | null;
};
export type ChecklistDocument = {
  title: string;
  intro: string;
  notes: string;
  sections: string[];
  items: ChecklistItem[];
};

const stripInlineMarkdown = (text: string): string => clean(text
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/\*\*(.*?)\*\*/g, '$1')
  .replace(/__(.*?)__/g, '$1')
  .replace(/`([^`]+)`/g, '$1'));

const shortTitle = (text: string): string => {
  if (text.length <= 160) return text;
  const beginning = text.slice(0, 157);
  const wordBoundary = beginning.lastIndexOf(' ');
  return `${(wordBoundary > 90 ? beginning.slice(0, wordBoundary) : beginning).trimEnd()}…`;
};

export function parseChecklistDocument(markdown: string): ChecklistDocument {
  if (!markdown.trim()) throw new Error('Paste a Markdown checklist first.');
  if (markdown.length > 1_000_000) throw new Error('Markdown exceeds the 1 MB import limit.');
  const document: ChecklistDocument = {title: '', intro: '', notes: '', sections: [], items: []};
  let section: string | null = null;
  let inNotes = false;
  const introLines: string[] = [];
  const noteLines: string[] = [];
  for (const originalLine of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const line = originalLine.replace(/\t/g, '  ');
    const header = /^#\s+(.+?)\s*$/.exec(line);
    if (header && !document.title) {
      document.title = clean(header[1]);
      continue;
    }
    const heading = /^##\s+(?:List:\s*)?(.+?)\s*$/i.exec(line);
    if (heading) {
      const headingName = clean(heading[1]);
      inNotes = /^verification notes?$/i.test(headingName);
      if (inNotes) { section = null; continue; }
      if (document.sections.some(s => s.toLocaleLowerCase() === headingName.toLocaleLowerCase())) {
        throw new Error(`Duplicate checklist heading: ${headingName}`);
      }
      if (headingName.length > 160) throw new Error('A checklist heading exceeds 160 characters.');
      document.sections.push(headingName);
      section = headingName;
      continue;
    }
    if (inNotes) {
      noteLines.push(line);
      continue;
    }
    const bullet = /^\s*[-*+]\s+(?:\[([ xX\-/!?])\]\s*)?(.+?)\s*$/.exec(line);
    if (bullet) {
      const parsed = parseLine(bullet[2], bullet[1] ?? ' ');
      const readable = stripInlineMarkdown(parsed.title);
      if (!readable) continue;
      document.items.push({
        title: shortTitle(readable),
        description: readable.length > 160 || parsed.title !== readable ? parsed.title : '',
        status: parsed.status,
        dueDate: parsed.dueDate,
        section,
      });
      if (document.items.length > 2000) throw new Error('At most 2,000 subtasks may be imported.');
      continue;
    }
    if (!section && line.trim()) introLines.push(line.trim());
  }
  document.intro = introLines.join('\n').trim();
  document.notes = noteLines.join('\n').trim();
  if (!document.items.length) throw new Error('No checklist items found. Use "- [ ] Subtask" lines.');
  if (document.intro.length > 5000 || document.notes.length > 10000) throw new Error('Checklist introduction or verification notes exceed the size limit.');
  return document;
}

export function checklistToMarkdown(document: ChecklistDocument): string {
  const lines: string[] = [];
  if (document.title) lines.push(`# ${document.title}`, '');
  if (document.intro) lines.push(document.intro, '');
  const mark = (item: ChecklistItem) => `- [${markFromStatus[item.status]}] ${item.description || item.title}${item.dueDate ? ` | due:${item.dueDate}` : ''}`;
  for (const item of document.items.filter(item => item.section === null)) lines.push(mark(item));
  for (const heading of document.sections) {
    lines.push('', `## List: ${heading}`);
    for (const item of document.items.filter(item => item.section === heading)) lines.push(mark(item));
  }
  if (document.notes) lines.push('', '## Verification Notes', '', document.notes);
  return `${lines.join('\n').trim()}\n`;
}

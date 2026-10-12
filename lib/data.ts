import 'server-only';
import { getDb } from './mongodb';
import type { Attachment, ImportBatch, Project, ProjectTaskLink, Snapshot, Subtask, SubtaskSection, Task, TaskLink, TaskList } from './types';
import { ObjectId, type Document } from 'mongodb';

const date = (value: unknown) => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const base = (row: Document) => ({id: String(row._id), createdAt: date(row.createdAt)});

export async function getSnapshot(): Promise<Snapshot> {
  try {
    const db = await getDb();
    const [projectRows, listRows, taskRows, subtaskRows, sectionRows, attachmentRows, linkRows, projectLinkRows, importRows] = await Promise.all([
      db.collection('projects').find().sort({ createdAt: 1 }).toArray(),
      db.collection('lists').find().sort({ position: 1, createdAt: 1 }).toArray(),
      db.collection('tasks').find().sort({ position: 1, createdAt: 1 }).toArray(),
      db.collection('subtasks').find().sort({ position: 1, createdAt: 1 }).toArray(),
      db.collection('subtask_sections').find().sort({ position: 1, createdAt: 1 }).toArray(),
      db.collection('attachments').find().sort({ createdAt: -1 }).toArray(),
      db.collection('task_links').find().toArray(),
      db.collection('project_task_links').find().toArray(),
      db.collection('import_batches').find({}, { projection: { snapshot: 0, generated: 0 } }).sort({ createdAt: -1 }).limit(100).toArray(),
    ]);
    const projects: Project[] = projectRows.map(p => ({ ...base(p), name: String(p.name), description: String(p.description ?? ''), color: String(p.color ?? '#6965db'), updatedAt: date(p.updatedAt) }));
    const lists: TaskList[] = listRows.map(l => ({ ...base(l), projectId: String(l.projectId), title: String(l.title), description: String(l.description ?? ''), position: Number(l.position ?? 0) }));
    const tasks: Task[] = taskRows.map(t => ({ ...base(t), projectId: String(t.projectId), listId: String(t.listId), title: String(t.title), description: String(t.description ?? ''), status: t.status as Task['status'], priority: t.priority as Task['priority'], dueDate: t.dueDate ? String(t.dueDate) : null, position: Number(t.position ?? 0), updatedAt: date(t.updatedAt), checklistTitle: String(t.checklistTitle ?? ''), checklistIntro: String(t.checklistIntro ?? ''), checklistNotes: String(t.checklistNotes ?? '') }));
    const subtasks: Subtask[] = subtaskRows.map(s => ({ ...base(s), projectId: String(s.projectId), taskId: String(s.taskId), title: String(s.title), status: s.status as Subtask['status'], dueDate: s.dueDate ? String(s.dueDate) : null, position: Number(s.position ?? 0), sectionId: s.sectionId ? String(s.sectionId) : null, description: String(s.description ?? '') }));
    const subtaskSections: SubtaskSection[] = sectionRows.map(s => ({...base(s), projectId: String(s.projectId), taskId: String(s.taskId), title: String(s.title), position: Number(s.position ?? 0)}));
    const attachments: Attachment[] = attachmentRows.map(a => ({id: String(a._id), taskId: String(a.taskId), projectId: String(a.projectId), label: String(a.label), filename: String(a.filename), size: Number(a.size), createdAt: date(a.createdAt)}));
    const links: TaskLink[] = linkRows.map(l => ({ id: String(l._id), firstTaskId: String(l.firstTaskId), secondTaskId: String(l.secondTaskId), createdAt: date(l.createdAt) }));
    const projectLinks: ProjectTaskLink[] = projectLinkRows.map(l => ({id: String(l._id), taskId: String(l.taskId), targetProjectId: String(l.targetProjectId), createdAt: date(l.createdAt)}));
    const imports: ImportBatch[] = importRows.map(b => ({ id: String(b._id), projectId: String(b.projectId), targetTaskId: b.targetTaskId ? String(b.targetTaskId) : null, source: String(b.source), mode: String(b.mode), status: b.status as ImportBatch['status'], createdAt: date(b.createdAt), lists: Number(b.lists ?? 0), tasks: Number(b.tasks ?? 0), subtasks: Number(b.subtasks ?? 0) }));
    return { projects, lists, tasks, subtasks, subtaskSections, attachments, links, projectLinks, imports, attachmentsEnabled: Boolean((process.env.AWS_BUCKET || process.env.S3_BUCKET) && (process.env.AWS_DEFAULT_REGION || process.env.S3_REGION || process.env.AWS_REGION)), databaseOnline: true };
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    return { projects: [], lists: [], tasks: [], subtasks: [], subtaskSections: [], attachments: [], links: [], projectLinks: [], imports: [], attachmentsEnabled: Boolean((process.env.AWS_BUCKET || process.env.S3_BUCKET) && (process.env.AWS_DEFAULT_REGION || process.env.S3_REGION || process.env.AWS_REGION)), databaseOnline: false, error: 'MongoDB is offline. Start the local database with docker compose up -d, then refresh.' };
  }
}

export const oid = (id: string): ObjectId => {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new Error('Invalid item identifier.');
  return new ObjectId(id);
};

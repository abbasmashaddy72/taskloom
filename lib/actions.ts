'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getDb } from './mongodb';
import { cleanupAttachments } from './storage';
import { oid } from './data';
import { parseMarkdown } from './markdown';
import { PRIORITIES, STATUSES, type Priority, type Status } from './types';

const now = () => new Date();
const name = (value: string, field = 'Name', max = 160) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`);
  const s = value.trim();
  if (s.length > max) throw new Error(`${field} must be under ${max} characters.`);
  return s;
};
const description = (value?: string) => {
  if (typeof value !== 'string') return '';
  if (value.length > 5000) throw new Error('Description must be under 5000 characters.');
  return value.trim();
};
const status = (value: Status): Status => {
  if (!STATUSES.includes(value)) throw new Error('Invalid status.');
  return value;
};
const priority = (value: Priority): Priority => {
  if (!PRIORITIES.includes(value)) throw new Error('Invalid priority.');
  return value;
};
const due = (value?: string | null): string | null => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error('Date must be a valid YYYY-MM-DD value.');
  }
  return value;
};
const finish = () => revalidatePath('/');
const requireProject = async (db: Awaited<ReturnType<typeof getDb>>, id: string) => {
  if (!await db.collection('projects').findOne({ _id: oid(id) })) throw new Error('Project not found.');
};
const requireList = async (db: Awaited<ReturnType<typeof getDb>>, listId: string, projectId?: string) => {
  const list = await db.collection('lists').findOne({ _id: oid(listId) });
  if (!list || (projectId && list.projectId !== projectId)) throw new Error('Task list not found in this project.');
  return list;
};
const requireTask = async (db: Awaited<ReturnType<typeof getDb>>, id: string) => {
  const task = await db.collection('tasks').findOne({ _id: oid(id) });
  if (!task) throw new Error('Task not found.');
  return task;
};

export async function createProject(input: { name: string; description?: string; color?: string }) {
  const db = await getDb();
  const color = /^#[0-9a-f]{6}$/i.test(input.color ?? '') ? input.color! : '#6965db';
  const result = await db.collection('projects').insertOne({ name: name(input.name), description: description(input.description), color, createdAt: now(), updatedAt: now() });
  finish();
  return { id: String(result.insertedId) };
}
export async function updateProject(id: string, input: { name: string; description?: string; color?: string }) {
  const db = await getDb();
  const current = await db.collection('projects').findOne({ _id: oid(id) });
  if (!current) throw new Error('Project not found.');
  const color = input.color && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : String(current.color);
  await db.collection('projects').updateOne({ _id: oid(id) }, { $set: { name: name(input.name), description: description(input.description), color, updatedAt: now() } });
  finish();
}
export async function deleteProject(id: string) {
  const db = await getDb();
  await requireProject(db, id);
  // Standalone MongoDB: cascade deletes are intentionally not transactional.
  // Deleting children first makes retries safe if the process stops mid-operation.
  await cleanupAttachments((await db.collection('tasks').find({ projectId: id }, { projection: { _id: 1 } }).toArray()).map(t => String(t._id)));
  await db.collection('subtasks').deleteMany({ projectId: id });
  await db.collection('tasks').deleteMany({ projectId: id });
  await db.collection('lists').deleteMany({ projectId: id });
  await db.collection('projects').deleteOne({ _id: oid(id) });
  finish();
}

export async function createList(input: { projectId: string; title: string; description?: string }) {
  const db = await getDb();
  await requireProject(db, input.projectId);
  const result = await db.collection('lists').insertOne({ projectId: input.projectId, title: name(input.title, 'List title'), description: description(input.description), position: Date.now(), createdAt: now() });
  finish();
  return { id: String(result.insertedId) };
}
export async function updateList(id: string, input: { title: string; description?: string }) {
  const db = await getDb();
  if (!await db.collection('lists').findOne({ _id: oid(id) })) throw new Error('List not found.');
  await db.collection('lists').updateOne({ _id: oid(id) }, { $set: { title: name(input.title, 'List title'), description: description(input.description) } });
  finish();
}
export async function deleteList(id: string) {
  const db = await getDb();
  const list = await requireList(db, id);
  const ids = await db.collection('tasks').find({ listId: id }, { projection: { _id: 1 } }).toArray();
  await cleanupAttachments(ids.map(t => String(t._id)));
  await db.collection('subtasks').deleteMany({ taskId: { $in: ids.map(t => String(t._id)) } });
  await db.collection('tasks').deleteMany({ listId: id });
  await db.collection('lists').deleteOne({ _id: oid(id), projectId: list.projectId });
  finish();
}

export type TaskInput = { projectId: string; listId: string; title: string; description?: string; status: Status; priority: Priority; dueDate?: string | null };
export async function createTask(input: TaskInput) {
  const db = await getDb();
  await requireList(db, input.listId, input.projectId);
  const result = await db.collection('tasks').insertOne({ projectId: input.projectId, listId: input.listId, title: name(input.title, 'Task title'), description: description(input.description), status: status(input.status), priority: priority(input.priority), dueDate: due(input.dueDate), position: Date.now(), createdAt: now(), updatedAt: now() });
  finish();
  return { id: String(result.insertedId) };
}
export async function updateTask(id: string, input: TaskInput) {
  const db = await getDb();
  const existing = await requireTask(db, id);
  if (existing.projectId !== input.projectId) throw new Error('Cannot move a task between projects.');
  await requireList(db, input.listId, input.projectId);
  await db.collection('tasks').updateOne({ _id: oid(id) }, { $set: { listId: input.listId, title: name(input.title, 'Task title'), description: description(input.description), status: status(input.status), priority: priority(input.priority), dueDate: due(input.dueDate), updatedAt: now() } });
  finish();
}
export async function updateTaskStatus(id: string, value: Status) {
  const db = await getDb();
  const updated = await db.collection('tasks').updateOne({ _id: oid(id) }, { $set: { status: status(value), updatedAt: now() } });
  if (!updated.matchedCount) throw new Error('Task not found.');
  finish();
}
export async function deleteTask(id: string) {
  const db = await getDb();
  await requireTask(db, id);
  await cleanupAttachments([id]);
  await db.collection('subtasks').deleteMany({ taskId: id });
  await db.collection('tasks').deleteOne({ _id: oid(id) });
  finish();
}

export type SubtaskInput = { taskId: string; title: string; status: Status; dueDate?: string | null };
export async function createSubtask(input: SubtaskInput) {
  const db = await getDb();
  const task = await requireTask(db, input.taskId);
  const result = await db.collection('subtasks').insertOne({ taskId: input.taskId, projectId: task.projectId, title: name(input.title, 'Subtask title'), status: status(input.status), dueDate: due(input.dueDate), position: Date.now(), createdAt: now() });
  finish();
  return { id: String(result.insertedId) };
}
export async function updateSubtask(id: string, input: SubtaskInput) {
  const db = await getDb();
  const existing = await db.collection('subtasks').findOne({ _id: oid(id) });
  if (!existing || existing.taskId !== input.taskId) throw new Error('Subtask not found.');
  await db.collection('subtasks').updateOne({ _id: oid(id) }, { $set: { title: name(input.title, 'Subtask title'), status: status(input.status), dueDate: due(input.dueDate) } });
  finish();
}
export async function updateSubtaskStatus(id: string, value: Status) {
  const db = await getDb();
  const updated = await db.collection('subtasks').updateOne({ _id: oid(id) }, { $set: { status: status(value) } });
  if (!updated.matchedCount) throw new Error('Subtask not found.');
  finish();
}
export async function deleteSubtask(id: string) {
  const db = await getDb();
  const deleted = await db.collection('subtasks').deleteOne({ _id: oid(id) });
  if (!deleted.deletedCount) throw new Error('Subtask not found.');
  finish();
}

export async function importMarkdown(input: { markdown: string; projectId?: string | null; filename?: string }) {
  const parsed = parseMarkdown(input.markdown, input.filename?.replace(/\.md$/i, '') || 'Imported project');
  const db = await getDb();
  const targetId = input.projectId || undefined;
  if (targetId) await requireProject(db, targetId);
  const createdId = targetId ? undefined : new ObjectId();
  const projectId = targetId ?? String(createdId);
  const insertedListIds: ObjectId[] = [];
  const insertedTaskIds: ObjectId[] = [];
  const insertedSubtaskIds: ObjectId[] = [];
  const timestamp = now();
  try {
    if (createdId) await db.collection('projects').insertOne({ _id: createdId, name: name(parsed.name), description: description(parsed.description), color: '#6965db', createdAt: timestamp, updatedAt: timestamp });
    let nTasks = 0;
    let nSubtasks = 0;
    for (const [index, list] of parsed.lists.entries()) {
      const listId = new ObjectId();
      await db.collection('lists').insertOne({ _id: listId, projectId, title: name(list.title, 'List title'), description: '', position: Date.now() + index, createdAt: timestamp });
      insertedListIds.push(listId);
      for (const [taskIndex, task] of list.tasks.entries()) {
        const taskId = new ObjectId();
        await db.collection('tasks').insertOne({ _id: taskId, projectId, listId: String(listId), title: name(task.title, 'Task title'), description: '', status: status(task.status), priority: priority(task.priority), dueDate: due(task.dueDate), position: Date.now() + taskIndex, createdAt: timestamp, updatedAt: timestamp });
        insertedTaskIds.push(taskId);
        nTasks++;
        for (const [subIndex, sub] of task.subtasks.entries()) {
          const subId = new ObjectId();
          await db.collection('subtasks').insertOne({ _id: subId, taskId: String(taskId), projectId, title: name(sub.title, 'Subtask title'), status: status(sub.status), dueDate: due(sub.dueDate), position: Date.now() + subIndex, createdAt: timestamp });
          insertedSubtaskIds.push(subId);
          nSubtasks++;
        }
      }
    }
    finish();
    return { projectId, lists: parsed.lists.length, tasks: nTasks, subtasks: nSubtasks };
  } catch (error) {
    // Compensating cleanup works on local standalone MongoDB with no replica-set transaction support.
    await Promise.allSettled([
      db.collection('subtasks').deleteMany({ _id: { $in: insertedSubtaskIds } }),
      db.collection('tasks').deleteMany({ _id: { $in: insertedTaskIds } }),
      db.collection('lists').deleteMany({ _id: { $in: insertedListIds } }),
    ]);
    if (createdId) await db.collection('projects').deleteOne({ _id: createdId }).catch(() => {});
    throw error;
  }
}

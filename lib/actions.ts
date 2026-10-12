'use server';

import { ObjectId, type Document, type WithId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getDb } from './mongodb';
import { cleanupAttachments } from './storage';
import { oid } from './data';
import { parseMarkdown, parseChecklistDocument } from './markdown';
import { assertNoActiveLinks, assertOnlyImported, assertUnchanged } from './import-guards';
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
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  ) {
    throw new Error('Date must be a valid YYYY-MM-DD value.');
  }
  return value;
};
const finish = () => revalidatePath('/');
const requireProject = async (db: Awaited<ReturnType<typeof getDb>>, id: string) => {
  if (!(await db.collection('projects').findOne({ _id: oid(id) }))) throw new Error('Project not found.');
};
const requireList = async (db: Awaited<ReturnType<typeof getDb>>, listId: string, projectId?: string) => {
  const list = await db.collection('lists').findOne({ _id: oid(listId) });
  if (!list || (projectId && list.projectId !== projectId))
    throw new Error('Task list not found in this project.');
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
  const result = await db.collection('projects').insertOne({
    name: name(input.name),
    description: description(input.description),
    color,
    createdAt: now(),
    updatedAt: now(),
  });
  finish();
  return { id: String(result.insertedId) };
}
export async function updateProject(
  id: string,
  input: { name: string; description?: string; color?: string },
) {
  const db = await getDb();
  const current = await db.collection('projects').findOne({ _id: oid(id) });
  if (!current) throw new Error('Project not found.');
  const color = input.color && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : String(current.color);
  await db.collection('projects').updateOne(
    { _id: oid(id) },
    {
      $set: {
        name: name(input.name),
        description: description(input.description),
        color,
        updatedAt: now(),
      },
    },
  );
  finish();
}
export async function deleteProject(id: string) {
  const db = await getDb();
  await requireProject(db, id);
  // Standalone MongoDB: cascade deletes are intentionally not transactional.
  // Deleting children first makes retries safe if the process stops mid-operation.
  await cleanupAttachments(
    (
      await db
        .collection('tasks')
        .find({ projectId: id }, { projection: { _id: 1 } })
        .toArray()
    ).map((t) => String(t._id)),
  );
  const projectTaskIds = (
    await db
      .collection('tasks')
      .find({ projectId: id }, { projection: { _id: 1 } })
      .toArray()
  ).map((t) => String(t._id));
  await db.collection('task_links').deleteMany({
    $or: [{ firstTaskId: { $in: projectTaskIds } }, { secondTaskId: { $in: projectTaskIds } }],
  });
  await db
    .collection('project_task_links')
    .deleteMany({ $or: [{ taskId: { $in: projectTaskIds } }, { targetProjectId: id }] });
  // Archive history instead of offering an impossible undo after project deletion.
  await db
    .collection('import_batches')
    .updateMany({ projectId: id, status: 'applied' }, { $set: { status: 'expired', invalidatedAt: now() } });
  await db.collection('subtasks').deleteMany({ projectId: id });
  await db.collection('subtask_sections').deleteMany({ projectId: id });
  await db.collection('tasks').deleteMany({ projectId: id });
  await db.collection('lists').deleteMany({ projectId: id });
  await db.collection('projects').deleteOne({ _id: oid(id) });
  finish();
}

export async function createList(input: { projectId: string; title: string; description?: string }) {
  const db = await getDb();
  await requireProject(db, input.projectId);
  const result = await db.collection('lists').insertOne({
    projectId: input.projectId,
    title: name(input.title, 'List title'),
    description: description(input.description),
    position: Date.now(),
    createdAt: now(),
  });
  finish();
  return { id: String(result.insertedId) };
}
export async function updateList(id: string, input: { title: string; description?: string }) {
  const db = await getDb();
  if (!(await db.collection('lists').findOne({ _id: oid(id) }))) throw new Error('List not found.');
  await db
    .collection('lists')
    .updateOne(
      { _id: oid(id) },
      { $set: { title: name(input.title, 'List title'), description: description(input.description) } },
    );
  finish();
}
export async function deleteList(id: string) {
  const db = await getDb();
  const list = await requireList(db, id);
  const ids = await db
    .collection('tasks')
    .find({ listId: id }, { projection: { _id: 1 } })
    .toArray();
  await cleanupAttachments(ids.map((t) => String(t._id)));
  await db.collection('task_links').deleteMany({
    $or: [
      { firstTaskId: { $in: ids.map((t) => String(t._id)) } },
      { secondTaskId: { $in: ids.map((t) => String(t._id)) } },
    ],
  });
  await db.collection('project_task_links').deleteMany({ taskId: { $in: ids.map((t) => String(t._id)) } });
  await db.collection('subtasks').deleteMany({ taskId: { $in: ids.map((t) => String(t._id)) } });
  await db.collection('subtask_sections').deleteMany({ taskId: { $in: ids.map((t) => String(t._id)) } });
  await db.collection('tasks').deleteMany({ listId: id });
  await db.collection('lists').deleteOne({ _id: oid(id), projectId: list.projectId });
  finish();
}

export type TaskInput = {
  projectId: string;
  listId: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  dueDate?: string | null;
};
export async function createTask(input: TaskInput) {
  const db = await getDb();
  await requireList(db, input.listId, input.projectId);
  const result = await db.collection('tasks').insertOne({
    projectId: input.projectId,
    listId: input.listId,
    title: name(input.title, 'Task title'),
    description: description(input.description),
    status: status(input.status),
    priority: priority(input.priority),
    dueDate: due(input.dueDate),
    position: Date.now(),
    createdAt: now(),
    updatedAt: now(),
  });
  finish();
  return { id: String(result.insertedId) };
}
export async function updateTask(id: string, input: TaskInput) {
  const db = await getDb();
  const existing = await requireTask(db, id);
  if (existing.projectId !== input.projectId) throw new Error('Cannot move a task between projects.');
  await requireList(db, input.listId, input.projectId);
  await db.collection('tasks').updateOne(
    { _id: oid(id) },
    {
      $set: {
        listId: input.listId,
        title: name(input.title, 'Task title'),
        description: description(input.description),
        status: status(input.status),
        priority: priority(input.priority),
        dueDate: due(input.dueDate),
        updatedAt: now(),
      },
    },
  );
  finish();
}
export async function updateTaskStatus(id: string, value: Status) {
  const db = await getDb();
  const updated = await db
    .collection('tasks')
    .updateOne({ _id: oid(id) }, { $set: { status: status(value), updatedAt: now() } });
  if (!updated.matchedCount) throw new Error('Task not found.');
  finish();
}
export async function deleteTask(id: string) {
  const db = await getDb();
  await requireTask(db, id);
  await cleanupAttachments([id]);
  await db.collection('task_links').deleteMany({ $or: [{ firstTaskId: id }, { secondTaskId: id }] });
  await db.collection('project_task_links').deleteMany({ taskId: id });
  await db.collection('subtasks').deleteMany({ taskId: id });
  await db.collection('subtask_sections').deleteMany({ taskId: id });
  await db.collection('tasks').deleteOne({ _id: oid(id) });
  finish();
}

const verifiedSection = async (
  db: Awaited<ReturnType<typeof getDb>>,
  taskId: string,
  sectionId?: string | null,
): Promise<string | null> => {
  if (!sectionId) return null;
  const section = await db.collection('subtask_sections').findOne({ _id: oid(sectionId), taskId });
  if (!section) throw new Error('This subtask heading does not belong to the selected task.');
  return sectionId;
};

export async function createSubtaskSection(input: { taskId: string; title: string }) {
  const db = await getDb();
  const task = await requireTask(db, input.taskId);
  const title = name(input.title, 'Heading');
  const existing = await db.collection('subtask_sections').find({ taskId: input.taskId }).toArray();
  if (existing.some((s) => String(s.title).toLocaleLowerCase() === title.toLocaleLowerCase()))
    throw new Error('A heading with that name already exists in this task.');
  const result = await db.collection('subtask_sections').insertOne({
    taskId: input.taskId,
    projectId: task.projectId,
    title,
    position: Date.now(),
    createdAt: now(),
  });
  finish();
  return { id: String(result.insertedId) };
}
export async function renameSubtaskSection(id: string, titleInput: string) {
  const db = await getDb();
  const section = await db.collection('subtask_sections').findOne({ _id: oid(id) });
  if (!section) throw new Error('Heading not found.');
  const title = name(titleInput, 'Heading');
  const siblings = await db.collection('subtask_sections').find({ taskId: section.taskId }).toArray();
  if (
    siblings.some(
      (s) => String(s._id) !== id && String(s.title).toLocaleLowerCase() === title.toLocaleLowerCase(),
    )
  )
    throw new Error('A heading with that name already exists.');
  await db.collection('subtask_sections').updateOne({ _id: oid(id) }, { $set: { title } });
  finish();
}
export async function deleteSubtaskSection(id: string, mode: 'keep' | 'delete' = 'keep') {
  const db = await getDb();
  const section = await db.collection('subtask_sections').findOne({ _id: oid(id) });
  if (!section) throw new Error('Heading not found.');
  if (mode !== 'keep' && mode !== 'delete') throw new Error('Unknown heading deletion mode.');
  if (mode === 'delete') {
    // Deleting child records first makes a retry safe on standalone MongoDB.
    await db.collection('subtasks').deleteMany({ taskId: section.taskId, sectionId: id });
  } else {
    // Preserve subtasks and move them into Uncategorised.
    await db
      .collection('subtasks')
      .updateMany({ taskId: section.taskId, sectionId: id }, { $set: { sectionId: null } });
  }
  await db.collection('subtask_sections').deleteOne({ _id: oid(id) });
  finish();
}
export async function moveSubtaskSection(id: string, direction: 'up' | 'down') {
  const db = await getDb();
  const current = await db.collection('subtask_sections').findOne({ _id: oid(id) });
  if (!current) throw new Error('Heading not found.');
  const sections = (await db.collection('subtask_sections').find({ taskId: current.taskId }).toArray()).sort(
    (a, b) => Number(a.position) - Number(b.position),
  );
  const index = sections.findIndex((row) => String(row._id) === id);
  const other = sections[index + (direction === 'up' ? -1 : 1)];
  if (!other) return;
  const firstPosition = Number(current.position);
  await db
    .collection('subtask_sections')
    .updateOne({ _id: current._id }, { $set: { position: Number(other.position) } });
  await db
    .collection('subtask_sections')
    .updateOne({ _id: other._id }, { $set: { position: firstPosition } });
  finish();
}

export type SubtaskInput = {
  taskId: string;
  title: string;
  status: Status;
  dueDate?: string | null;
  description?: string;
  sectionId?: string | null;
};
export async function createSubtask(input: SubtaskInput) {
  const db = await getDb();
  const task = await requireTask(db, input.taskId);
  const sectionId = await verifiedSection(db, input.taskId, input.sectionId);
  const result = await db.collection('subtasks').insertOne({
    taskId: input.taskId,
    projectId: task.projectId,
    title: name(input.title, 'Subtask title'),
    description: description(input.description),
    sectionId,
    status: status(input.status),
    dueDate: due(input.dueDate),
    position: Date.now(),
    createdAt: now(),
  });
  finish();
  return { id: String(result.insertedId) };
}
export async function updateSubtask(id: string, input: SubtaskInput) {
  const db = await getDb();
  const existing = await db.collection('subtasks').findOne({ _id: oid(id) });
  if (!existing || existing.taskId !== input.taskId) throw new Error('Subtask not found.');
  const sectionId =
    input.sectionId === undefined
      ? (existing.sectionId ?? null)
      : await verifiedSection(db, input.taskId, input.sectionId);
  await db.collection('subtasks').updateOne(
    { _id: oid(id) },
    {
      $set: {
        title: name(input.title, 'Subtask title'),
        description: description(input.description),
        sectionId,
        status: status(input.status),
        dueDate: due(input.dueDate),
      },
    },
  );
  finish();
}
export async function updateSubtaskStatus(id: string, value: Status) {
  const db = await getDb();
  const updated = await db
    .collection('subtasks')
    .updateOne({ _id: oid(id) }, { $set: { status: status(value) } });
  if (!updated.matchedCount) throw new Error('Subtask not found.');
  finish();
}
export async function deleteSubtask(id: string) {
  const db = await getDb();
  const deleted = await db.collection('subtasks').deleteOne({ _id: oid(id) });
  if (!deleted.deletedCount) throw new Error('Subtask not found.');
  finish();
}

/** Cross-project references do not duplicate work or ownership. */
export async function linkTasks(firstId: string, secondId: string) {
  if (firstId === secondId) throw new Error('A task cannot link to itself.');
  const db = await getDb();
  const [first, second] = await Promise.all([requireTask(db, firstId), requireTask(db, secondId)]);
  if (first.projectId === second.projectId) throw new Error('Select a task in a different project.');
  const [firstTaskId, secondTaskId] = [firstId, secondId].sort();
  const key = `${firstTaskId}:${secondTaskId}`;
  await db
    .collection('task_links')
    .updateOne(
      { key },
      { $setOnInsert: { key, firstTaskId, secondTaskId, createdAt: now() } },
      { upsert: true },
    );
  finish();
}
export async function unlinkTasks(firstId: string, secondId: string) {
  const db = await getDb();
  const [a, b] = [firstId, secondId].map(oid);
  if (!(await db.collection('tasks').findOne({ _id: a }))) throw new Error('Source task no longer exists.');
  const ids = [String(a), String(b)].sort();
  await db.collection('task_links').deleteOne({ key: `${ids[0]}:${ids[1]}` });
  finish();
}

/** Make one existing task visible from another project's Linked Tasks section. */
export async function linkTaskToProject(taskId: string, targetProjectId: string) {
  const db = await getDb();
  const task = await requireTask(db, taskId);
  await requireProject(db, targetProjectId);
  if (task.projectId === targetProjectId) throw new Error('The task already belongs to this project.');
  const key = `${taskId}:${targetProjectId}`;
  await db
    .collection('project_task_links')
    .updateOne(
      { key },
      { $setOnInsert: { key, taskId, targetProjectId, createdAt: now() } },
      { upsert: true },
    );
  finish();
}
export async function unlinkTaskFromProject(taskId: string, targetProjectId: string) {
  const db = await getDb();
  await requireTask(db, taskId);
  await db.collection('project_task_links').deleteOne({ taskId, targetProjectId });
  finish();
}

type ImportMode = 'append' | 'replace_list' | 'replace_matching';
type ImportRow = WithId<Document>;

type ImportArchive = {
  tasks: ImportRow[];
  subtasks: ImportRow[];
  sections?: ImportRow[];
  attachments: ImportRow[];
  links: ImportRow[];
  projectLinks: ImportRow[];
};

type StoredBatch = Document & {
  projectId: string;
  targetTaskId?: string | null;
  createdProject?: boolean;
  generated: {
    lists: ImportRow[];
    tasks: ImportRow[];
    subtasks: ImportRow[];
  };
  snapshot: ImportArchive;
  generatedSections?: ImportRow[];
  snapshotSections?: ImportRow[];
  metadataBefore?: Record<string, string>;
  metadataAfter?: Record<string, string>;
  createdProjectDoc?: ImportRow;
};

const emptyArchive = () => ({
  tasks: [] as ImportRow[],
  subtasks: [] as ImportRow[],
  sections: [] as ImportRow[],
  attachments: [] as ImportRow[],
  links: [] as ImportRow[],
  projectLinks: [] as ImportRow[],
});
const identity = (rows: ImportRow[]) => rows.map((r) => String(r._id));
const insertRows = async (db: Awaited<ReturnType<typeof getDb>>, collection: string, rows: ImportRow[]) => {
  if (rows.length) await db.collection(collection).insertMany(rows, { ordered: true });
};
const removeRows = async (db: Awaited<ReturnType<typeof getDb>>, collection: string, rows: ImportRow[]) => {
  if (rows.length) await db.collection(collection).deleteMany({ _id: { $in: rows.map((r) => r._id) } });
};
const snapshotTasks = async (db: Awaited<ReturnType<typeof getDb>>, taskRows: ImportRow[]) => {
  const taskIds = identity(taskRows);
  if (!taskIds.length) return emptyArchive();
  const [subtasks, sections, attachments, links, projectLinks] = await Promise.all([
    db
      .collection('subtasks')
      .find({ taskId: { $in: taskIds } })
      .toArray(),
    db
      .collection('subtask_sections')
      .find({ taskId: { $in: taskIds } })
      .toArray(),
    db
      .collection('attachments')
      .find({ taskId: { $in: taskIds } })
      .toArray(),
    db
      .collection('task_links')
      .find({ $or: [{ firstTaskId: { $in: taskIds } }, { secondTaskId: { $in: taskIds } }] })
      .toArray(),
    db
      .collection('project_task_links')
      .find({ taskId: { $in: taskIds } })
      .toArray(),
  ]);
  return { tasks: taskRows, subtasks, sections, attachments, links, projectLinks };
};
const dropSnapshot = async (
  db: Awaited<ReturnType<typeof getDb>>,
  snapshot: ReturnType<typeof emptyArchive>,
) => {
  await removeRows(db, 'task_links', snapshot.links);
  await removeRows(db, 'project_task_links', snapshot.projectLinks);
  await removeRows(db, 'attachments', snapshot.attachments);
  await removeRows(db, 'subtasks', snapshot.subtasks);
  await removeRows(db, 'subtask_sections', snapshot.sections ?? []);
  await removeRows(db, 'tasks', snapshot.tasks);
};
const restoreSnapshot = async (db: Awaited<ReturnType<typeof getDb>>, snapshot: ImportArchive) => {
  for (const [collection, rows] of [
    ['tasks', snapshot.tasks],
    ['subtask_sections', snapshot.sections ?? []],
    ['subtasks', snapshot.subtasks],
    ['attachments', snapshot.attachments],
    ['task_links', snapshot.links],
    ['project_task_links', snapshot.projectLinks],
  ] as const) {
    for (const row of rows) {
      await db.collection(collection).replaceOne({ _id: row._id }, row, { upsert: true });
    }
  }
};
const countRows = (generated: StoredBatch['generated']) => ({
  lists: generated.lists.length,
  tasks: generated.tasks.length,
  subtasks: generated.subtasks.length,
});

/** Batch records make new imports and replacement of existing lists reversible. */
export async function importMarkdown(input: {
  markdown: string;
  projectId?: string | null;
  filename?: string;
  mode?: ImportMode;
  targetListId?: string;
}) {
  const parsed = parseMarkdown(input.markdown, input.filename?.replace(/\.md$/i, '') || 'Imported project');
  const db = await getDb();
  const targetId = input.projectId || undefined;
  const mode: ImportMode = input.mode ?? 'append';
  if (!['append', 'replace_list', 'replace_matching'].includes(mode)) throw new Error('Invalid import mode.');
  if (!targetId && mode !== 'append') throw new Error('Replacement requires an existing project.');
  if (targetId) await requireProject(db, targetId);
  const createdId = targetId ? null : new ObjectId();
  const projectId = targetId || String(createdId);
  const timestamp = now();
  const projectDoc = createdId
    ? {
        _id: createdId,
        name: name(parsed.name),
        description: description(parsed.description),
        color: '#6965db',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    : null;
  const original = emptyArchive();
  const generated = { lists: [] as ImportRow[], tasks: [] as ImportRow[], subtasks: [] as ImportRow[] };
  const replacementListIds = new Set<string>();
  const existingLists = targetId ? await db.collection('lists').find({ projectId }).toArray() : [];
  const targetList =
    mode === 'replace_list' ? existingLists.find((l) => String(l._id) === input.targetListId) : null;
  if (mode === 'replace_list' && !targetList) throw new Error('Select a valid destination list.');
  const plans: { source: (typeof parsed.lists)[number]; listId: string }[] = [];
  if (mode === 'replace_list') {
    replacementListIds.add(String(targetList!._id));
    for (const source of parsed.lists) plans.push({ source, listId: String(targetList!._id) });
  } else {
    for (const [index, source] of parsed.lists.entries()) {
      const matched =
        mode === 'replace_matching'
          ? existingLists.find(
              (l) => String(l.title).trim().toLocaleLowerCase() === source.title.toLocaleLowerCase(),
            )
          : undefined;
      if (matched) {
        if (replacementListIds.has(String(matched._id)))
          throw new Error(`Duplicate imported list: ${source.title}`);
        replacementListIds.add(String(matched._id));
        plans.push({ source, listId: String(matched._id) });
      } else {
        const _id = new ObjectId();
        generated.lists.push({
          _id,
          projectId,
          title: name(source.title, 'List title'),
          description: '',
          position: Date.now() + index,
          createdAt: timestamp,
        });
        plans.push({ source, listId: String(_id) });
      }
    }
  }
  // Validate and generate all records before deleting anything.
  let n = 0;
  for (const { source, listId } of plans) {
    for (const task of source.tasks) {
      const _id = new ObjectId();
      generated.tasks.push({
        _id,
        projectId,
        listId,
        title: name(task.title, 'Task title'),
        description: '',
        status: status(task.status),
        priority: priority(task.priority),
        dueDate: due(task.dueDate),
        position: timestamp.getTime() + n++,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      for (const sub of task.subtasks) {
        generated.subtasks.push({
          _id: new ObjectId(),
          taskId: String(_id),
          projectId,
          title: name(sub.title, 'Subtask title'),
          status: status(sub.status),
          dueDate: due(sub.dueDate),
          position: timestamp.getTime() + n++,
          createdAt: timestamp,
        });
      }
    }
  }
  const oldTasks = replacementListIds.size
    ? await db
        .collection('tasks')
        .find({ listId: { $in: [...replacementListIds] } })
        .toArray()
    : [];
  const archive = await snapshotTasks(db, oldTasks);
  Object.assign(original, archive);
  if (JSON.stringify(original).length > 10_000_000)
    throw new Error(
      'Replacement is too large for safe rollback storage. Split this import into smaller lists.',
    );
  const batchId = new ObjectId();
  await db.collection('import_batches').insertOne({
    _id: batchId,
    status: 'preparing',
    projectId,
    source: input.filename || parsed.name,
    mode: targetId ? mode : 'new_project',
    createdProject: Boolean(createdId),
    createdProjectDoc: projectDoc,
    replacedListIds: [...replacementListIds],
    targetTaskId: null,
    createdAt: timestamp,
    ...countRows(generated),
    generated,
    snapshot: original,
  });
  try {
    if (projectDoc) await db.collection('projects').insertOne(projectDoc);
    await dropSnapshot(db, original);
    await insertRows(db, 'lists', generated.lists);
    await insertRows(db, 'tasks', generated.tasks);
    await insertRows(db, 'subtasks', generated.subtasks);
    await db.collection('import_batches').updateOne({ _id: batchId }, { $set: { status: 'applied' } });
    finish();
    return { projectId, batchId: String(batchId), ...countRows(generated) };
  } catch (error) {
    try {
      await removeRows(db, 'subtasks', generated.subtasks);
      await removeRows(db, 'tasks', generated.tasks);
      await removeRows(db, 'lists', generated.lists);
      await restoreSnapshot(db, original);
      if (createdId) await db.collection('projects').deleteOne({ _id: createdId });
      await db.collection('import_batches').deleteOne({ _id: batchId });
    } catch (recoveryError) {
      await db
        .collection('import_batches')
        .updateOne({ _id: batchId }, { $set: { status: 'needs_recovery', failure: String(recoveryError) } })
        .catch(() => {});
      throw new Error(
        `Import failed and automatic recovery was incomplete. Preserve import batch ${batchId} for manual recovery.`,
      );
    }
    throw error;
  }
}

/** Import Markdown task headings as first-class sections; archive replacements for safe undo. */
export async function importTaskChecklist(input: {
  taskId: string;
  markdown: string;
  replace?: boolean;
  mode?: 'append' | 'replace_all' | 'replace_matching';
}) {
  const parsed = parseChecklistDocument(input.markdown);
  const mode = input.mode ?? (input.replace ? 'replace_all' : 'append');
  if (!['append', 'replace_all', 'replace_matching'].includes(mode))
    throw new Error('Invalid checklist import mode.');
  const db = await getDb();
  const task = await requireTask(db, input.taskId);
  const timestamp = now();
  const previousSections = await db.collection('subtask_sections').find({ taskId: input.taskId }).toArray();
  const previousSubtasks = await db.collection('subtasks').find({ taskId: input.taskId }).toArray();
  const oldByTitle = new Map(previousSections.map((s) => [String(s.title).toLocaleLowerCase(), s]));
  const generatedSections: ImportRow[] = [];
  const sectionByTitle = new Map<string, string>();
  for (const [index, heading] of parsed.sections.entries()) {
    const existing = mode !== 'replace_all' ? oldByTitle.get(heading.toLocaleLowerCase()) : undefined;
    if (existing) {
      sectionByTitle.set(heading, String(existing._id));
      continue;
    }
    const sectionId = new ObjectId();
    generatedSections.push({
      _id: sectionId,
      taskId: input.taskId,
      projectId: task.projectId,
      title: name(heading, 'Heading'),
      position: timestamp.getTime() + index,
      createdAt: timestamp,
    });
    sectionByTitle.set(heading, String(sectionId));
  }
  const affectedSections = new Set(
    mode === 'replace_matching'
      ? [...sectionByTitle.values()].filter((id) => previousSections.some((s) => String(s._id) === id))
      : [],
  );
  const original = emptyArchive();
  if (mode === 'replace_all') {
    original.subtasks = previousSubtasks;
    original.sections = previousSections;
  } else if (mode === 'replace_matching') {
    original.subtasks = previousSubtasks.filter(
      (s) =>
        affectedSections.has(String(s.sectionId ?? '')) ||
        (parsed.items.some((i) => i.section === null) && !s.sectionId),
    );
  }
  const originalMeta = {
    checklistTitle: String(task.checklistTitle ?? ''),
    checklistIntro: String(task.checklistIntro ?? ''),
    checklistNotes: String(task.checklistNotes ?? ''),
  };
  const updatedMeta = {
    checklistTitle: mode === 'replace_all' ? parsed.title : originalMeta.checklistTitle || parsed.title,
    checklistIntro: mode === 'replace_all' ? parsed.intro : originalMeta.checklistIntro || parsed.intro,
    checklistNotes: mode === 'replace_all' ? parsed.notes : originalMeta.checklistNotes || parsed.notes,
  };
  const generated = {
    lists: [] as ImportRow[],
    tasks: [] as ImportRow[],
    subtasks: parsed.items.map((sub, index) => ({
      _id: new ObjectId(),
      projectId: task.projectId,
      taskId: input.taskId,
      sectionId: sub.section ? (sectionByTitle.get(sub.section) ?? null) : null,
      title: name(sub.title, 'Subtask title'),
      description: description(sub.description),
      status: status(sub.status),
      dueDate: due(sub.dueDate),
      position: timestamp.getTime() + index,
      createdAt: timestamp,
    })) as ImportRow[],
  };
  const batchId = new ObjectId();
  await db.collection('import_batches').insertOne({
    _id: batchId,
    projectId: task.projectId,
    targetTaskId: input.taskId,
    source: parsed.title || 'Task checklist',
    mode: `subtasks_${mode}`,
    status: 'preparing',
    createdAt: timestamp,
    ...countRows(generated),
    generated,
    snapshot: original,
    generatedSections,
    snapshotSections: original.sections,
    metadataBefore: originalMeta,
    metadataAfter: updatedMeta,
  });
  try {
    await removeRows(db, 'subtasks', original.subtasks);
    await removeRows(db, 'subtask_sections', original.sections);
    await insertRows(db, 'subtask_sections', generatedSections);
    await insertRows(db, 'subtasks', generated.subtasks);
    await db.collection('tasks').updateOne({ _id: oid(input.taskId) }, { $set: updatedMeta });
    await db.collection('import_batches').updateOne({ _id: batchId }, { $set: { status: 'applied' } });
    finish();
    return {
      batchId: String(batchId),
      subtasks: generated.subtasks.length,
      sections: generatedSections.length,
      mode,
    };
  } catch (error) {
    try {
      await removeRows(db, 'subtasks', generated.subtasks);
      await removeRows(db, 'subtask_sections', generatedSections);
      await insertRows(db, 'subtask_sections', original.sections);
      await insertRows(db, 'subtasks', original.subtasks);
      await db.collection('tasks').updateOne({ _id: oid(input.taskId) }, { $set: originalMeta });
      await db.collection('import_batches').deleteOne({ _id: batchId });
    } catch {
      await db
        .collection('import_batches')
        .updateOne({ _id: batchId }, { $set: { status: 'needs_recovery' } })
        .catch(() => {});
      throw new Error(`Import failed; preserve batch ${batchId} for manual recovery.`);
    }
    throw error;
  }
}

/** Safe undo: refuses to discard tasks/subtasks that have changed since the import. */
export async function undoImport(batchId: string) {
  const db = await getDb();
  const batch = (await db
    .collection('import_batches')
    .findOne({ _id: oid(batchId), status: 'applied' })) as StoredBatch | null;
  if (!batch) throw new Error('This import is not available for undo.');
  await requireProject(db, batch.projectId);
  const generated = batch.generated;
  const original = batch.snapshot;
  const generatedSections = batch.generatedSections ?? [];
  const ids = identity(generated.tasks);
  const subIds = identity(generated.subtasks);
  const listIds = identity(generated.lists);
  const [currentTasks, currentSubs, referenced, listTasks, newAttachments, newProjectLinks] =
    await Promise.all([
      db
        .collection('tasks')
        .find({ _id: { $in: generated.tasks.map((t) => t._id) } })
        .toArray(),
      db
        .collection('subtasks')
        .find({ _id: { $in: generated.subtasks.map((s) => s._id) } })
        .toArray(),
      db
        .collection('task_links')
        .find({ $or: [{ firstTaskId: { $in: ids } }, { secondTaskId: { $in: ids } }] })
        .toArray(),
      db
        .collection('tasks')
        .find({ listId: { $in: listIds } })
        .toArray(),
      db.collection('attachments').countDocuments({ taskId: { $in: ids } }),
      db.collection('project_task_links').countDocuments({ taskId: { $in: ids } }),
    ]);
  assertUnchanged(currentTasks, generated.tasks, 'Imported tasks');
  assertUnchanged(currentSubs, generated.subtasks, 'Imported subtasks');
  if (generatedSections.length) {
    const currentSections = await db
      .collection('subtask_sections')
      .find({ _id: { $in: generatedSections.map((s) => s._id) } })
      .toArray();
    assertUnchanged(currentSections, generatedSections, 'Imported headings');
    const contents = await db
      .collection('subtasks')
      .find({ sectionId: { $in: identity(generatedSections) } })
      .toArray();
    assertOnlyImported(contents, subIds, 'subtasks under an imported heading');
  }
  assertNoActiveLinks(referenced.length);
  if (newAttachments)
    throw new Error('Imported tasks have attachments. Remove or move the attachments before undo.');
  if (newProjectLinks)
    throw new Error('Imported tasks are linked to other projects. Unlink them before undo.');
  assertOnlyImported(listTasks, ids, 'tasks to an imported list');
  const childTasks = await db
    .collection('subtasks')
    .find({ taskId: { $in: ids } })
    .toArray();
  assertOnlyImported(childTasks, subIds, 'subtasks to an imported task');
  if (batch.targetTaskId) {
    if (!(await db.collection('tasks').findOne({ _id: oid(batch.targetTaskId) })))
      throw new Error('Target task was deleted. Undo is blocked.');
    if (batch.mode === 'replace_subtasks' || batch.mode === 'subtasks_replace_all') {
      const current = await db.collection('subtasks').find({ taskId: batch.targetTaskId }).toArray();
      assertUnchanged(current, generated.subtasks, 'Imported subtasks');
      const sections = await db.collection('subtask_sections').find({ taskId: batch.targetTaskId }).toArray();
      assertUnchanged(sections, generatedSections, 'Imported headings');
    }
    if (batch.metadataAfter) {
      const target = await requireTask(db, batch.targetTaskId);
      for (const [key, expected] of Object.entries(batch.metadataAfter)) {
        if (String(target[key] ?? '') !== expected)
          throw new Error('Checklist notes changed since import. Undo is blocked.');
      }
    }
  }
  if (original.projectLinks.length) {
    const targetIds = [...new Set(original.projectLinks.map((l) => String(l.targetProjectId)))];
    const current = await db.collection('projects').countDocuments({ _id: { $in: targetIds.map(oid) } });
    if (current !== targetIds.length)
      throw new Error(
        'A project referenced by the archived shortcuts no longer exists. Undo requires manual review.',
      );
  }
  if (original.links.length) {
    const externalIds = [
      ...new Set(
        original.links
          .flatMap((l) => [String(l.firstTaskId), String(l.secondTaskId)])
          .filter((id) => !identity(original.tasks).includes(id)),
      ),
    ];
    const surviving = externalIds.length
      ? await db.collection('tasks').countDocuments({ _id: { $in: externalIds.map(oid) } })
      : 0;
    if (surviving !== externalIds.length)
      throw new Error('A previously linked external task was removed. Undo requires manual review.');
  }
  if (batch.createdProject) {
    if (batch.createdProjectDoc) {
      const current = await db.collection('projects').findOne({ _id: oid(batch.projectId) });
      assertUnchanged(current ? [current] : [], [batch.createdProjectDoc], 'Imported project');
    }
    const otherLists = await db
      .collection('lists')
      .countDocuments({ projectId: batch.projectId, _id: { $nin: generated.lists.map((l) => l._id) } });
    const otherTasks = await db
      .collection('tasks')
      .countDocuments({ projectId: batch.projectId, _id: { $nin: generated.tasks.map((t) => t._id) } });
    const shortcuts = await db
      .collection('project_task_links')
      .countDocuments({ targetProjectId: batch.projectId });
    if (otherLists || otherTasks || shortcuts)
      throw new Error(
        'This project has received additional work or shortcuts since import. Undo would remove it; move that work first.',
      );
  }
  const changedListRows = await db
    .collection('lists')
    .find({ _id: { $in: generated.lists.map((l) => l._id) } })
    .toArray();
  assertUnchanged(changedListRows, generated.lists, 'Imported lists');
  // Protect existing replacement lists from newly added tasks.
  const replacedListIds = (batch.replacedListIds as string[] | undefined) ?? [
    ...new Set(original.tasks.map((t) => String(t.listId))),
  ];
  for (const listId of replacedListIds) {
    const current = await db.collection('tasks').find({ listId }).toArray();
    assertOnlyImported(current, ids, 'tasks to a replaced list');
  }
  const acquired = await db
    .collection('import_batches')
    .updateOne({ _id: batch._id, status: 'applied' }, { $set: { status: 'undoing' } });
  if (!acquired.modifiedCount) throw new Error('Import is already being changed.');
  try {
    await removeRows(db, 'subtasks', generated.subtasks);
    await removeRows(db, 'subtask_sections', generatedSections);
    await removeRows(db, 'tasks', generated.tasks);
    await removeRows(db, 'lists', generated.lists);
    await restoreSnapshot(db, original);
    if (batch.targetTaskId && batch.metadataBefore) {
      await db
        .collection('tasks')
        .updateOne({ _id: oid(batch.targetTaskId) }, { $set: batch.metadataBefore });
    }
    if (batch.createdProject) await db.collection('projects').deleteOne({ _id: oid(batch.projectId) });
    await db
      .collection('import_batches')
      .updateOne(
        { _id: batch._id },
        { $set: { status: 'undone', undoneAt: now() }, $unset: { snapshot: '', generated: '' } },
      );
    finish();
  } catch (error) {
    await db
      .collection('import_batches')
      .updateOne({ _id: batch._id }, { $set: { status: 'needs_recovery', failure: String(error) } })
      .catch(() => {});
    throw new Error(`Undo was interrupted. Batch ${batchId} needs manual recovery; do not retry blindly.`);
  }
}

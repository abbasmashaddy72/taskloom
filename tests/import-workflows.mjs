/** Offline behavior test for server actions. Uses a deliberately small MongoDB test double.
 * Execute: node --test tests/import-workflows.mjs (typescript is a development dependency)
 * This is NOT a replacement for a live MongoDB/RustFS acceptance test.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ts = require('typescript');
let sequence = 0;
class ObjectId {
  constructor(value) {
    this.value = value || (++sequence).toString(16).padStart(24, '0');
  }
  toString() {
    return this.value;
  }
  toJSON() {
    return this.value;
  }
}
const copy = (value) =>
  value instanceof ObjectId
    ? new ObjectId(String(value))
    : value instanceof Date
      ? new Date(value)
      : Array.isArray(value)
        ? value.map(copy)
        : value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copy(child)]))
          : value;
const same = (a, b) => String(a) === String(b);
function matches(row, selector = {}) {
  return Object.entries(selector).every(([key, expected]) => {
    if (key === '$or') return expected.some((query) => matches(row, query));
    const actual = row[key];
    if (
      expected &&
      typeof expected === 'object' &&
      !(expected instanceof ObjectId) &&
      !(expected instanceof Date) &&
      !Array.isArray(expected)
    ) {
      if ('$in' in expected) return expected.$in.some((value) => same(actual, value));
      if ('$nin' in expected) return expected.$nin.every((value) => !same(actual, value));
    }
    return same(actual, expected);
  });
}
class Collection {
  rows = [];
  async insertOne(row) {
    const record = copy(row);
    record._id ??= new ObjectId();
    if (this.rows.some((old) => same(old._id, record._id))) throw new Error('Duplicate ID');
    this.rows.push(record);
    return { insertedId: record._id };
  }
  async insertMany(rows) {
    for (const row of rows) await this.insertOne(row);
  }
  async findOne(query = {}) {
    return copy(this.rows.find((row) => matches(row, query)) || null);
  }
  find(query = {}) {
    let result = this.rows.filter((row) => matches(row, query));
    return {
      sort() {
        return this;
      },
      limit(n) {
        result = result.slice(0, n);
        return this;
      },
      async toArray() {
        return copy(result);
      },
    };
  }
  async countDocuments(query = {}) {
    return this.rows.filter((row) => matches(row, query)).length;
  }
  async deleteMany(query) {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !matches(row, query));
    return { deletedCount: before - this.rows.length };
  }
  async deleteOne(query) {
    const index = this.rows.findIndex((row) => matches(row, query));
    if (index < 0) return { deletedCount: 0 };
    this.rows.splice(index, 1);
    return { deletedCount: 1 };
  }
  async updateOne(query, update, options = {}) {
    let row = this.rows.find((row) => matches(row, query));
    const already = Boolean(row);
    if (!row && !options.upsert) return { matchedCount: 0, modifiedCount: 0 };
    if (!row) {
      row = { _id: new ObjectId(), ...copy(query) };
      this.rows.push(row);
    }
    if (!already) Object.assign(row, copy(update.$setOnInsert || {}));
    Object.assign(row, copy(update.$set || {}));
    for (const key of Object.keys(update.$unset || {})) delete row[key];
    return { matchedCount: already ? 1 : 0, modifiedCount: 1 };
  }
  async updateMany(query, update) {
    let count = 0;
    for (const row of this.rows.filter((row) => matches(row, query))) {
      Object.assign(row, copy(update.$set || {}));
      count++;
    }
    return { modifiedCount: count };
  }
  async replaceOne(query, document, options = {}) {
    let index = this.rows.findIndex((row) => matches(row, query));
    if (index < 0 && !options.upsert) return { matchedCount: 0 };
    if (index < 0) this.rows.push(copy(document));
    else this.rows[index] = copy(document);
    return { matchedCount: index < 0 ? 0 : 1 };
  }
}
function setup() {
  const collections = new Map();
  const db = {
    collection(name) {
      if (!collections.has(name)) collections.set(name, new Collection());
      return collections.get(name);
    },
  };
  const compile = (filename) =>
    ts.transpileModule(readFileSync(resolve(filename), 'utf8'), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
  const modules = {};
  const load = (path, dependencies) => {
    const mod = { exports: {} };
    const executable = vm.runInThisContext(`(function(require,module,exports){${compile(path)}\n})`, {
      filename: path,
    });
    executable(
      (name) => {
        if (name in dependencies) return dependencies[name];
        if (name === 'node:assert') return require(name);
        throw new Error(`Unexpected module dependency ${name} in ${path}`);
      },
      mod,
      mod.exports,
    );
    return mod.exports;
  };
  modules.types = load('lib/types.ts', {});
  modules.markdown = load('lib/markdown.ts', { './types': modules.types });
  modules.guards = load('lib/import-guards.ts', {});
  const actions = load('lib/actions.ts', {
    mongodb: { ObjectId },
    'next/cache': { revalidatePath() {} },
    './mongodb': { getDb: async () => db },
    './storage': { cleanupAttachments: async () => {} },
    './data': {
      oid(id) {
        if (!/^[a-f0-9]{24}$/.test(id)) throw new Error('Invalid ID');
        return new ObjectId(id);
      },
    },
    './markdown': modules.markdown,
    './types': modules.types,
    './import-guards': modules.guards,
  });
  return { db, actions };
}

test('new project import is undoable when untouched', async () => {
  const { db, actions } = setup();
  const result = await actions.importMarkdown({
    markdown: '# Project: Alpha\n## List: Development\n- [ ] Task A\n  - [x] First test',
  });
  assert.equal(result.lists, 1);
  assert.equal(result.tasks, 1);
  assert.equal(await db.collection('projects').countDocuments(), 1);
  await actions.undoImport(result.batchId);
  assert.equal(await db.collection('projects').countDocuments(), 0);
  assert.equal(await db.collection('tasks').countDocuments(), 0);
  assert.equal(
    (await db.collection('import_batches').findOne({ _id: new ObjectId(result.batchId) })).status,
    'undone',
  );
});

test('replace one list archives and restores attachments, links, task IDs and subtasks', async () => {
  const { db, actions } = setup();
  const projectA = (await actions.createProject({ name: 'Alpha' })).id;
  const projectB = (await actions.createProject({ name: 'Beta' })).id;
  const listA = (await actions.createList({ projectId: projectA, title: 'Development' })).id;
  const listB = (await actions.createList({ projectId: projectB, title: 'QA' })).id;
  const original = (
    await actions.createTask({
      projectId: projectA,
      listId: listA,
      title: 'Keep ID',
      status: 'pending',
      priority: 'medium',
    })
  ).id;
  const other = (
    await actions.createTask({
      projectId: projectB,
      listId: listB,
      title: 'Other task',
      status: 'pending',
      priority: 'medium',
    })
  ).id;
  const sub = (await actions.createSubtask({ taskId: original, title: 'Old step', status: 'completed' })).id;
  await db
    .collection('attachments')
    .insertOne({ taskId: original, projectId: projectA, key: 'stable-attachment', label: 'Old file' });
  await actions.linkTasks(original, other);
  await actions.linkTaskToProject(original, projectB);
  const result = await actions.importMarkdown({
    projectId: projectA,
    mode: 'replace_list',
    targetListId: listA,
    markdown: '## List: Updates\n- [-] New task',
  });
  assert.equal(await db.collection('tasks').countDocuments({ _id: new ObjectId(original) }), 0);
  assert.equal(await db.collection('attachments').countDocuments({ taskId: original }), 0);
  assert.equal(await db.collection('task_links').countDocuments(), 0);
  assert.equal(await db.collection('project_task_links').countDocuments(), 0);
  assert.equal(
    (await db.collection('import_batches').findOne({ _id: new ObjectId(result.batchId) })).snapshot
      .attachments.length,
    1,
  );
  await actions.undoImport(result.batchId);
  assert.equal(await db.collection('tasks').countDocuments({ _id: new ObjectId(original) }), 1);
  assert.equal(await db.collection('subtasks').countDocuments({ _id: new ObjectId(sub) }), 1);
  assert.equal(await db.collection('attachments').countDocuments({ taskId: original }), 1);
  assert.equal(await db.collection('task_links').countDocuments(), 1);
  assert.equal(await db.collection('project_task_links').countDocuments(), 1);
});

test('undo protects changed imported tasks and extra tasks in empty replaced lists', async () => {
  const { db, actions } = setup();
  const project = (await actions.createProject({ name: 'Alpha' })).id;
  const emptyList = (await actions.createList({ projectId: project, title: 'Empty' })).id;
  const result = await actions.importMarkdown({
    projectId: project,
    mode: 'replace_list',
    targetListId: emptyList,
    markdown: '- [ ] First',
  });
  await actions.createTask({
    projectId: project,
    listId: emptyList,
    title: 'Created afterward',
    status: 'pending',
    priority: 'medium',
  });
  await assert.rejects(actions.undoImport(result.batchId), /New tasks/);
  const second = await actions.importMarkdown({
    projectId: project,
    markdown: '## List: New\n- [ ] Imported',
  });
  const imported = await db
    .collection('tasks')
    .findOne({ listId: (await db.collection('lists').findOne({ title: 'New' }))._id.toString() });
  await actions.updateTaskStatus(imported._id.toString(), 'completed');
  await assert.rejects(actions.undoImport(second.batchId), /changed/);
});

test('task checklist imports can replace and undo existing subtasks', async () => {
  const { db, actions } = setup();
  const project = (await actions.createProject({ name: 'Alpha' })).id;
  const list = (await actions.createList({ projectId: project, title: 'Development' })).id;
  const taskId = (
    await actions.createTask({
      projectId: project,
      listId: list,
      title: 'Main',
      status: 'pending',
      priority: 'medium',
    })
  ).id;
  const initial = (await actions.createSubtask({ taskId, title: 'Original', status: 'pending' })).id;
  const result = await actions.importTaskChecklist({
    taskId,
    replace: true,
    markdown: '- [x] Done\n- [-] Working',
  });
  assert.equal(result.subtasks, 2);
  assert.equal(await db.collection('subtasks').countDocuments({ _id: new ObjectId(initial) }), 0);
  await actions.undoImport(result.batchId);
  assert.equal(await db.collection('subtasks').countDocuments({ _id: new ObjectId(initial) }), 1);
});

test('cross-project shortcut keeps one task and disallows self-project', async () => {
  const { db, actions } = setup();
  const p1 = (await actions.createProject({ name: 'P1' })).id;
  const p2 = (await actions.createProject({ name: 'P2' })).id;
  const list = (await actions.createList({ projectId: p1, title: 'Development' })).id;
  const task = (
    await actions.createTask({
      projectId: p1,
      listId: list,
      title: 'One source of truth',
      status: 'pending',
      priority: 'medium',
    })
  ).id;
  await actions.linkTaskToProject(task, p2);
  await actions.linkTaskToProject(task, p2);
  assert.equal(await db.collection('project_task_links').countDocuments(), 1);
  assert.equal(await db.collection('tasks').countDocuments(), 1);
  await assert.rejects(actions.linkTaskToProject(task, p1), /already belongs/);
  await actions.unlinkTaskFromProject(task, p2);
  assert.equal(await db.collection('project_task_links').countDocuments(), 0);
});

test('replace matching list names, add nonmatching lists and restore on undo', async () => {
  const { db, actions } = setup();
  const projectId = (await actions.createProject({ name: 'Alpha' })).id;
  const existingList = (await actions.createList({ projectId, title: 'Development' })).id;
  const oldTask = (
    await actions.createTask({
      projectId,
      listId: existingList,
      title: 'Old',
      status: 'pending',
      priority: 'medium',
    })
  ).id;
  const result = await actions.importMarkdown({
    projectId,
    mode: 'replace_matching',
    markdown: '## List: development\n- [ ] Replaced\n## List: Planning\n- [x] Added',
  });
  assert.equal(result.lists, 1);
  assert.equal(result.tasks, 2);
  assert.equal(await db.collection('tasks').countDocuments({ _id: new ObjectId(oldTask) }), 0);
  await actions.undoImport(result.batchId);
  assert.equal(await db.collection('tasks').countDocuments({ _id: new ObjectId(oldTask) }), 1);
  assert.equal(await db.collection('lists').countDocuments({ projectId }), 1);
});

test('duplicate matching headings do not damage existing tasks', async () => {
  const { db, actions } = setup();
  const projectId = (await actions.createProject({ name: 'Alpha' })).id;
  const listId = (await actions.createList({ projectId, title: 'Development' })).id;
  const taskId = (
    await actions.createTask({ projectId, listId, title: 'Protected', status: 'pending', priority: 'medium' })
  ).id;
  await assert.rejects(
    actions.importMarkdown({
      projectId,
      mode: 'replace_matching',
      markdown: '## List: Development\n- [ ] A\n## List: development\n- [ ] B',
    }),
    /Duplicate imported list/,
  );
  assert.equal(await db.collection('tasks').countDocuments({ _id: new ObjectId(taskId) }), 1);
  assert.equal(await db.collection('import_batches').countDocuments(), 0);
});

test('imported project cannot be undone after its name changes', async () => {
  const { actions } = setup();
  const result = await actions.importMarkdown({ markdown: '# Project: A\n## List: Main\n- [ ] Item' });
  await actions.updateProject(result.projectId, { name: 'Renamed' });
  await assert.rejects(actions.undoImport(result.batchId), /Imported project have changed/);
});

test('section-aware task import stores 6 headings, details, notes and is undoable', async () => {
  const { db, actions } = setup();
  const projectId = (await actions.createProject({ name: 'Insure360' })).id;
  const listId = (await actions.createList({ projectId, title: 'Development' })).id;
  const taskId = (
    await actions.createTask({
      projectId,
      listId,
      title: 'Parent task',
      status: 'pending',
      priority: 'medium',
    })
  ).id;
  const markdown = readFileSync('examples/insure360-development-subtasks.md', 'utf8');
  const result = await actions.importTaskChecklist({ taskId, markdown });
  assert.equal(result.subtasks, 44);
  assert.equal(result.sections, 6);
  assert.equal(await db.collection('subtask_sections').countDocuments({ taskId }), 6);
  const rows = await db.collection('subtasks').find({ taskId }).toArray();
  assert.equal(rows.length, 44);
  assert.equal(rows[0].title.startsWith('T1 '), true);
  assert.ok(rows.some((s) => s.description.includes('without bypassing core security')));
  const task = await db.collection('tasks').findOne({ _id: new ObjectId(taskId) });
  assert.match(task.checklistIntro, /Completed and verified/);
  assert.match(task.checklistNotes, /Do not mark a task completed/);
  await actions.undoImport(result.batchId);
  assert.equal(await db.collection('subtasks').countDocuments({ taskId }), 0);
  assert.equal(await db.collection('subtask_sections').countDocuments({ taskId }), 0);
  const undone = await db.collection('tasks').findOne({ _id: new ObjectId(taskId) });
  assert.equal(undone.checklistNotes, '');
});

test('section-aware replace-all archives and restores original headings and subtasks', async () => {
  const { db, actions } = setup();
  const projectId = (await actions.createProject({ name: 'Demo' })).id;
  const listId = (await actions.createList({ projectId, title: 'Tasks' })).id;
  const taskId = (
    await actions.createTask({ projectId, listId, title: 'Main', status: 'pending', priority: 'medium' })
  ).id;
  const sectionId = (await actions.createSubtaskSection({ taskId, title: 'Older heading' })).id;
  const originalId = (
    await actions.createSubtask({ taskId, sectionId, title: 'Old work', status: 'pending' })
  ).id;
  const result = await actions.importTaskChecklist({
    taskId,
    mode: 'replace_all',
    markdown: '## List: New heading\n- [x] Done',
  });
  assert.equal(await db.collection('subtasks').countDocuments({ _id: new ObjectId(originalId) }), 0);
  assert.equal(await db.collection('subtask_sections').countDocuments({ _id: new ObjectId(sectionId) }), 0);
  await actions.undoImport(result.batchId);
  assert.equal(await db.collection('subtasks').countDocuments({ _id: new ObjectId(originalId) }), 1);
  assert.equal(await db.collection('subtask_sections').countDocuments({ _id: new ObjectId(sectionId) }), 1);
});

test('replace-matching headings leaves other sections and work untouched', async () => {
  const { db, actions } = setup();
  const projectId = (await actions.createProject({ name: 'Demo' })).id;
  const listId = (await actions.createList({ projectId, title: 'Tasks' })).id;
  const taskId = (
    await actions.createTask({ projectId, listId, title: 'Main', status: 'pending', priority: 'medium' })
  ).id;
  const a = (await actions.createSubtaskSection({ taskId, title: 'Admin' })).id;
  const b = (await actions.createSubtaskSection({ taskId, title: 'Comms' })).id;
  const oldA = (await actions.createSubtask({ taskId, sectionId: a, title: 'Old admin', status: 'pending' }))
    .id;
  const oldB = (await actions.createSubtask({ taskId, sectionId: b, title: 'Unrelated', status: 'pending' }))
    .id;
  const result = await actions.importTaskChecklist({
    taskId,
    mode: 'replace_matching',
    markdown: '## List: Admin\n- [x] New admin\n## List: Security\n- [ ] New security',
  });
  assert.equal(await db.collection('subtasks').countDocuments({ _id: new ObjectId(oldA) }), 0);
  assert.equal(await db.collection('subtasks').countDocuments({ _id: new ObjectId(oldB) }), 1);
  assert.equal(await db.collection('subtask_sections').countDocuments({ taskId }), 3);
  await actions.undoImport(result.batchId);
  assert.equal(await db.collection('subtasks').countDocuments({ _id: new ObjectId(oldA) }), 1);
  assert.equal(await db.collection('subtasks').countDocuments({ _id: new ObjectId(oldB) }), 1);
  assert.equal(await db.collection('subtask_sections').countDocuments({ taskId }), 2);
});

test('undo refuses changes to imported heading or newly added subtasks', async () => {
  const { db, actions } = setup();
  const projectId = (await actions.createProject({ name: 'Demo' })).id;
  const listId = (await actions.createList({ projectId, title: 'Tasks' })).id;
  const taskId = (
    await actions.createTask({ projectId, listId, title: 'Main', status: 'pending', priority: 'medium' })
  ).id;
  const a = await actions.importTaskChecklist({ taskId, markdown: '## List: First\n- [ ] One' });
  const section = await db.collection('subtask_sections').findOne({ taskId });
  await actions.renameSubtaskSection(String(section._id), 'Renamed');
  await assert.rejects(actions.undoImport(a.batchId), /changed/);
  await actions.renameSubtaskSection(String(section._id), 'First');
  await actions.createSubtask({
    taskId,
    sectionId: String(section._id),
    title: 'Added later',
    status: 'pending',
  });
  await assert.rejects(actions.undoImport(a.batchId), /New subtasks/);
});

test('removing a heading retains its tasks as uncategorised', async () => {
  const { db, actions } = setup();
  const projectId = (await actions.createProject({ name: 'Demo' })).id;
  const listId = (await actions.createList({ projectId, title: 'Tasks' })).id;
  const taskId = (
    await actions.createTask({ projectId, listId, title: 'Main', status: 'pending', priority: 'medium' })
  ).id;
  const sectionId = (await actions.createSubtaskSection({ taskId, title: 'Admin' })).id;
  const itemId = (await actions.createSubtask({ taskId, sectionId, title: 'Safe task', status: 'pending' }))
    .id;
  await actions.deleteSubtaskSection(sectionId);
  assert.equal((await db.collection('subtasks').findOne({ _id: new ObjectId(itemId) })).sectionId, null);
  assert.equal(await db.collection('subtask_sections').countDocuments({ taskId }), 0);
});

test('replacing a project list archives and restores its nested task headings', async () => {
  const { db, actions } = setup();
  const projectId = (await actions.createProject({ name: 'Alpha' })).id;
  const listId = (await actions.createList({ projectId, title: 'Development' })).id;
  const taskId = (
    await actions.createTask({ projectId, listId, title: 'Main', status: 'pending', priority: 'medium' })
  ).id;
  const sectionId = (await actions.createSubtaskSection({ taskId, title: 'Review' })).id;
  const childId = (await actions.createSubtask({ taskId, sectionId, title: 'Check', status: 'pending' })).id;
  const imported = await actions.importMarkdown({
    projectId,
    mode: 'replace_list',
    targetListId: listId,
    markdown: '- [ ] Replacement',
  });
  assert.equal(await db.collection('subtask_sections').countDocuments({ _id: new ObjectId(sectionId) }), 0);
  await actions.undoImport(imported.batchId);
  assert.equal(await db.collection('subtask_sections').countDocuments({ _id: new ObjectId(sectionId) }), 1);
  assert.equal(
    (await db.collection('subtasks').findOne({ _id: new ObjectId(childId) })).sectionId,
    sectionId,
  );
});

test('replace-all clears old checklist notes and undo restores them', async () => {
  const { db, actions } = setup();
  const projectId = (await actions.createProject({ name: 'Demo' })).id;
  const listId = (await actions.createList({ projectId, title: 'Tasks' })).id;
  const taskId = (
    await actions.createTask({ projectId, listId, title: 'Main', status: 'pending', priority: 'medium' })
  ).id;
  const first = await actions.importTaskChecklist({
    taskId,
    markdown: '# Original checklist\n## List: One\n- [ ] Task\n## Verification Notes\nKeep record.',
  });
  const replaced = await actions.importTaskChecklist({
    taskId,
    mode: 'replace_all',
    markdown: '## List: Two\n- [ ] New',
  });
  assert.equal((await db.collection('tasks').findOne({ _id: new ObjectId(taskId) })).checklistNotes, '');
  await actions.undoImport(replaced.batchId);
  assert.equal(
    (await db.collection('tasks').findOne({ _id: new ObjectId(taskId) })).checklistNotes,
    'Keep record.',
  );
  assert.equal(
    (await db.collection('import_batches').findOne({ _id: new ObjectId(first.batchId) })).status,
    'applied',
  );
});

test('deleting a heading and its subtasks does not affect other headings', async () => {
  const { db, actions } = setup();
  const projectId = (await actions.createProject({ name: 'Demo' })).id;
  const listId = (await actions.createList({ projectId, title: 'Tasks' })).id;
  const taskId = (
    await actions.createTask({ projectId, listId, title: 'Main', status: 'pending', priority: 'medium' })
  ).id;
  const firstId = (await actions.createSubtaskSection({ taskId, title: 'Admin' })).id;
  const secondId = (await actions.createSubtaskSection({ taskId, title: 'Comms' })).id;
  const removedId = (
    await actions.createSubtask({ taskId, sectionId: firstId, title: 'Remove', status: 'pending' })
  ).id;
  const preservedId = (
    await actions.createSubtask({ taskId, sectionId: secondId, title: 'Keep', status: 'pending' })
  ).id;
  await actions.deleteSubtaskSection(firstId, 'delete');
  assert.equal(await db.collection('subtasks').countDocuments({ _id: new ObjectId(removedId) }), 0);
  assert.equal(await db.collection('subtasks').countDocuments({ _id: new ObjectId(preservedId) }), 1);
  assert.equal(await db.collection('subtask_sections').countDocuments({ _id: new ObjectId(firstId) }), 0);
  assert.equal(await db.collection('subtask_sections').countDocuments({ _id: new ObjectId(secondId) }), 1);
});

test('invalid heading deletion mode leaves both heading and subtasks untouched', async () => {
  const { db, actions } = setup();
  const projectId = (await actions.createProject({ name: 'Demo' })).id;
  const listId = (await actions.createList({ projectId, title: 'Tasks' })).id;
  const taskId = (
    await actions.createTask({ projectId, listId, title: 'Main', status: 'pending', priority: 'medium' })
  ).id;
  const sectionId = (await actions.createSubtaskSection({ taskId, title: 'Protected' })).id;
  const itemId = (
    await actions.createSubtask({ taskId, sectionId, title: 'Protected task', status: 'pending' })
  ).id;
  await assert.rejects(actions.deleteSubtaskSection(sectionId, 'nonsense'), /Unknown heading deletion mode/);
  assert.equal(await db.collection('subtask_sections').countDocuments({ _id: new ObjectId(sectionId) }), 1);
  assert.equal(await db.collection('subtasks').countDocuments({ _id: new ObjectId(itemId) }), 1);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMarkdown, toMarkdown } from '../lib/markdown';

const sample = `# Project: Insure360
> Insurance platform

## List: Engineering
- [ ] T1 Push to Git | priority:high | due:2026-10-12
  - [x] Configure remote
  - [-] Review branch
- [-] T2 Audit code | priority:medium
- [!] T3 Blocked on credentials

## List: Release
- [x] T4 Release done`;

test('reads project, lists, tasks, statuses, metadata and subtasks', () => {
  const p = parseMarkdown(sample);
  assert.equal(p.name, 'Insure360');
  assert.equal(p.lists.length, 2);
  assert.equal(p.lists[0].tasks.length, 3);
  assert.equal(p.lists[0].tasks[0].priority, 'high');
  assert.equal(p.lists[0].tasks[0].dueDate, '2026-10-12');
  assert.equal(p.lists[0].tasks[0].subtasks[0].status, 'completed');
  assert.equal(p.lists[0].tasks[1].status, 'in_progress');
  assert.equal(p.lists[0].tasks[2].status, 'blocked');
});

test('export/import roundtrip', () => {
  const original = parseMarkdown(sample);
  const restored = parseMarkdown(toMarkdown(original));
  assert.deepEqual(restored, original);
});

test('creates a General list for Markdown without headings', () => {
  const p = parseMarkdown('- [ ] First\n  - [x] Child');
  assert.equal(p.lists[0].title, 'General');
  assert.equal(p.lists[0].tasks[0].subtasks.length, 1);
});

test('rejects blank or invalid inputs', () => {
  assert.throws(() => parseMarkdown(' '), /empty/);
  assert.throws(() => parseMarkdown('# Project: Empty'), /No tasks/);
});

test('ignores impossible due dates and enforces the import size limit', () => {
  const p = parseMarkdown('- [ ] Test | due:2026-02-31');
  assert.equal(p.lists[0].tasks[0].dueDate, null);
  assert.throws(() => parseMarkdown('- [ ] Task' + ' '.repeat(1_000_001)), /1 MB/);
});

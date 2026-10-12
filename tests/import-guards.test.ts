import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { assertNoActiveLinks, assertOnlyImported, assertUnchanged } from '../lib/import-guards';
import { parseChecklist, parseMarkdown } from '../lib/markdown';

test('pastable checklist preserves checkbox statuses and metadata', () => {
  const items = parseChecklist(
    '## List: One\n- [x] Verify | due:2026-10-20\n  - [-] Implement\n- [!] Blocked\n- [?] Failed\n- [ ] Pending',
  );
  assert.deepEqual(
    items.map((x) => x.status),
    ['completed', 'in_progress', 'blocked', 'failed', 'pending'],
  );
  assert.equal(items[0].dueDate, '2026-10-20');
});
test('pasted content requires checklist rows and limits task title', () => {
  assert.throws(() => parseChecklist('plain text'), /No checklist/);
  assert.throws(() => parseChecklist('- [ ] ' + 'x'.repeat(161)), /160/);
});
test('large markdown tasklists remain valid for project import', () => {
  const source = '## List: Development\n- [ ] T1 Fix menus\n- [-] T2 Import subtasks\n  - [x] Verified step';
  const parsed = parseMarkdown(source);
  assert.equal(parsed.lists[0].tasks.length, 2);
  assert.equal(parsed.lists[0].tasks[1].subtasks[0].status, 'completed');
});
test('rollback refuses changed or deleted imported records', () => {
  const rows = [{ _id: 'a', title: 'A', status: 'pending' }];
  assert.doesNotThrow(() => assertUnchanged(rows, rows, 'Tasks'));
  assert.throws(() => assertUnchanged([{ ...rows[0], status: 'completed' }], rows, 'Tasks'), /changed/);
  assert.throws(() => assertUnchanged([], rows, 'Tasks'), /changed/);
});
test('rollback refuses newly added work or links', () => {
  assert.doesNotThrow(() => assertOnlyImported([{ _id: 'a' }], ['a'], 'tasks'));
  assert.throws(() => assertOnlyImported([{ _id: 'b' }], ['a'], 'tasks'), /New tasks/);
  assert.throws(() => assertNoActiveLinks(1), /Unlink/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { checklistToMarkdown, parseChecklistDocument } from '../lib/markdown';

const source = readFileSync('examples/insure360-development-subtasks.md', 'utf8');

test('original Insure360 document imports 6 headings and 44 subtasks without modification', () => {
  const imported = parseChecklistDocument(source);
  assert.equal(imported.title, 'Insure360 — Development Tasklist');
  assert.equal(imported.sections.length, 6);
  assert.equal(imported.items.length, 44);
  assert.deepEqual(imported.items.map(item => item.section).filter((value, i, array) => array.indexOf(value) === i), imported.sections);
  assert.equal(imported.items[0].title.startsWith('T1 Improve tenant'), true);
  assert.equal(imported.items.at(-1)?.title.startsWith('T44 Deliver'), true);
  assert.match(imported.intro, /Completed and verified/);
  assert.match(imported.notes, /Do not mark a task completed until verified/);
  assert.equal(imported.items.every(item => item.title.length <= 160), true);
});

test('long original rows preserve complete content as subtask detail', () => {
  const original = source.split('\n').find(line => line.startsWith('- [ ] **T25**'))!;
  const item = parseChecklistDocument(original).items[0];
  assert.equal(item.title.length <= 160, true);
  assert.ok(item.description.includes('without bypassing core security'));
});

test('section export/import keeps sections, statuses and verification notes', () => {
  const initial = parseChecklistDocument(source.replace('- [ ] **T38**', '- [x] **T38**'));
  const again = parseChecklistDocument(checklistToMarkdown(initial));
  assert.deepEqual(again.sections, initial.sections);
  assert.deepEqual(again.items.map(i => i.status), initial.items.map(i => i.status));
  assert.equal(again.items.length, 44);
  assert.equal(again.notes, initial.notes);
});

test('duplicates and invalid checklists are rejected', () => {
  assert.throws(() => parseChecklistDocument('## List: Same\n- [ ] One\n## Same\n- [ ] Two'), /Duplicate/);
  assert.throws(() => parseChecklistDocument('## List: Blank'), /No checklist items/);
});

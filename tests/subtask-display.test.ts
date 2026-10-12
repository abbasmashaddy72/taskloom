import assert from 'node:assert/strict';
import test from 'node:test';
import { subtaskDetails } from '../lib/subtask-display';

test('empty and Markdown-only duplicate descriptions stay hidden', () => {
  assert.equal(subtaskDetails('T4 Fix Platform Settings.', ''), null);
  assert.equal(subtaskDetails('T4 Fix Platform Settings.', '**T4** Fix Platform Settings.'), null);
  assert.equal(
    subtaskDetails('T5 Update `EmailServiceProviderEnum`.', '**T5** Update `EmailServiceProviderEnum`.'),
    null,
  );
});

test('long imported source and genuinely different descriptions remain expandable', () => {
  const title = 'T25 Fix permission discovery and entitlement restrictions…';
  const full =
    '**T25** Fix permission discovery and entitlement restrictions and add a controlled temporary switch without bypassing security.';
  assert.match(subtaskDetails(title, full) ?? '', /without bypassing security/);
  assert.equal(
    subtaskDetails('T1 Verify deployment', 'Run the smoke tests first.'),
    'Run the smoke tests first.',
  );
});

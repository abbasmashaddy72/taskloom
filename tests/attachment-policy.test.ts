import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_REQUEST, MAX_ATTACHMENTS_PER_TASK, attachmentLabel, permittedFilename, safeFilename } from '../lib/attachment-policy';

test('S3 attachment limits are explicit', () => {
  assert.equal(MAX_ATTACHMENT_BYTES, 10 * 1024 * 1024);
  assert.equal(MAX_ATTACHMENTS_PER_REQUEST, 5);
  assert.equal(MAX_ATTACHMENTS_PER_TASK, 20);
});
test('extension allowlist rejects browser-active formats', () => {
  for (const extension of ['pdf', 'PDF', 'docx', 'md', 'png', 'zip']) assert.equal(permittedFilename(`report.${extension}`), true);
  for (const filename of ['script.html', 'vector.svg', 'evil.exe', '.env', 'package', '']) assert.equal(permittedFilename(filename), false);
});
test('display names are required and bounded', () => {
  assert.equal(attachmentLabel('  Project report  '), 'Project report');
  assert.throws(() => attachmentLabel(' '));
  assert.throws(() => attachmentLabel('x'.repeat(121)));
});
test('storage keys cannot contain path separators', () => {
  assert.equal(safeFilename('../folder\\report.pdf'), '.._folder_report.pdf');
  assert.equal(safeFilename('test\r\nfile.txt'), 'test__file.txt');
});

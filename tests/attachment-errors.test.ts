import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storageErrorDiagnostics, storageFailure, validationFailure } from '../lib/attachment-errors';

test('invalid file input is a client error', () => {
  const failure = validationFailure(new Error('Invalid file'));
  assert.equal(failure.status, 400);
  assert.equal(failure.code, 'INVALID_ATTACHMENT');
  assert.match(failure.error, /Invalid file/);
});

test('unknown S3 failures are never mislabeled as HTTP 400', () => {
  const failure = storageFailure(new Error('secret network endpoint'));
  assert.equal(failure.status, 502);
  assert.equal(failure.code, 'S3_UPLOAD_FAILED');
  assert.doesNotMatch(failure.error, /secret/);
});

test('AWS access and region errors have actionable non-secret messages', () => {
  for (const name of ['AccessDenied', 'InvalidAccessKeyId', 'CredentialsProviderError']) {
    const error = new Error('Do not leak credentials');
    error.name = name;
    assert.equal(storageFailure(error).code, 'S3_ACCESS_DENIED');
  }
  const error = new Error('Bad S3 region');
  error.name = 'AuthorizationHeaderMalformed';
  assert.equal(storageFailure(error).code, 'S3_REGION_MISMATCH');
});

test('nonexistent bucket is surfaced explicitly', () => {
  const error = new Error('Bucket not found');
  error.name = 'NoSuchBucket';
  assert.equal(storageFailure(error).code, 'S3_BUCKET_NOT_FOUND');
});

test('nested DNS and TCP connection errors get actionable responses', () => {
  for (const code of ['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN']) {
    const error = new Error('Sensitive endpoint must not be returned', {
      cause: Object.assign(new Error('connect'), { code }),
    });
    assert.equal(storageFailure(error).code, 'S3_CONNECTION_FAILED');
    assert.equal(storageErrorDiagnostics(error).causeCode, code);
    assert.ok(!JSON.stringify(storageErrorDiagnostics(error)).includes('Sensitive endpoint'));
  }
});

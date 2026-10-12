import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storageSettings, StorageConfigurationError } from '../lib/storage-config';
import { storageFailure } from '../lib/attachment-errors';

const base = { AWS_BUCKET: 'taskloom', AWS_DEFAULT_REGION: 'us-east-1' };

test('accepts RustFS root endpoint using path-style addressing', () => {
  const result = storageSettings({
    ...base,
    AWS_ENDPOINT: 'https://rustfs.test',
    AWS_USE_PATH_STYLE_ENDPOINT: 'true',
  });
  assert.equal(result.endpoint, 'https://rustfs.test');
  assert.equal(result.forcePathStyle, true);
});

test('rejects RustFS endpoint containing a bucket prefix', () => {
  assert.throws(
    () => storageSettings({ ...base, AWS_ENDPOINT: 'https://rustfs.test/insure360' }),
    StorageConfigurationError,
  );
});

test('rejects accidental credentials inside S3 URLs', () => {
  assert.throws(
    () => storageSettings({ ...base, AWS_ENDPOINT: 'https://secret:password@rustfs.test' }),
    StorageConfigurationError,
  );
});

test('requires either both static credentials or neither', () => {
  assert.throws(() => storageSettings({ ...base, AWS_ACCESS_KEY_ID: 'lerd' }), StorageConfigurationError);
});

test('maps configuration errors to actionable 503', () => {
  const result = storageFailure(new StorageConfigurationError('Use a bucket-free API root.'));
  assert.equal(result.status, 503);
  assert.equal(result.code, 'S3_CONFIGURATION_INVALID');
});

test('explicit host endpoint takes precedence over Lerd container-only AWS_ENDPOINT', () => {
  const settings = storageSettings({
    ...base,
    AWS_ENDPOINT: 'http://lerd-rustfs:9000',
    AWS_URL: 'http://localhost:9000',
    TASKLOOM_S3_ENDPOINT: 'http://127.0.0.1:9000',
    AWS_USE_PATH_STYLE_ENDPOINT: 'true',
  });
  assert.equal(settings.endpoint, 'http://127.0.0.1:9000');
  assert.equal(settings.forcePathStyle, true);
});

test('explicit bucket takes precedence over Lerd AWS_BUCKET', () => {
  const settings = storageSettings({ ...base, AWS_BUCKET: 'lerd', TASKLOOM_S3_BUCKET: 'taskloom' });
  assert.equal(settings.bucket, 'taskloom');
});

test('Lerd environment remains available when overrides are absent', () => {
  const settings = storageSettings({ ...base, AWS_BUCKET: 'lerd', AWS_ENDPOINT: 'http://lerd-rustfs:9000' });
  assert.equal(settings.bucket, 'lerd');
  assert.equal(settings.endpoint, 'http://lerd-rustfs:9000');
});

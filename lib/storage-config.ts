/** Server-side S3 configuration validation without network calls or credential logging. */
export type StorageSettings = {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
};

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigurationError';
  }
}

export type StorageEnvironment = Readonly<Record<string, string | undefined>>;

export function storageSettings(env: StorageEnvironment = process.env): StorageSettings {
  // Taskloom-specific overrides take precedence over Lerd's process-level AWS_* variables.
  const bucket = (env.TASKLOOM_S3_BUCKET || env.AWS_BUCKET || env.S3_BUCKET || '').trim();
  const region = (env.AWS_DEFAULT_REGION || env.S3_REGION || env.AWS_REGION || '').trim();
  if (!bucket || !region) {
    throw new StorageConfigurationError('S3 is not configured. Set AWS_BUCKET and AWS_DEFAULT_REGION.');
  }

  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim() || undefined;
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim() || undefined;
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new StorageConfigurationError(
      'Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or neither when using an IAM role.',
    );
  }

  const rawEndpoint = (env.TASKLOOM_S3_ENDPOINT || env.AWS_ENDPOINT || env.S3_ENDPOINT || '').trim();
  let endpoint: string | undefined;
  if (rawEndpoint) {
    let url: URL;
    try {
      url = new URL(rawEndpoint);
    } catch {
      throw new StorageConfigurationError('AWS_ENDPOINT must be an absolute HTTP(S) URL.');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new StorageConfigurationError(
        'AWS_ENDPOINT must be an HTTP(S) S3 API URL without credentials, query parameters, or fragments.',
      );
    }
    // RustFS uses the S3 API root. A bucket name in the base path makes AWS SDK sign the wrong URI.
    if (/(^|\.)rustfs\.test$/i.test(url.hostname) && url.pathname !== '/') {
      throw new StorageConfigurationError(
        'RustFS AWS_ENDPOINT must be the S3 API root (for example https://rustfs.test), without a bucket or /insure360 path. Set AWS_BUCKET separately.',
      );
    }
    endpoint = url.toString().replace(/\/$/, '');
  }

  return {
    bucket,
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle:
      (env.AWS_USE_PATH_STYLE_ENDPOINT || env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true',
    ...(accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : {}),
    ...(env.AWS_SESSION_TOKEN?.trim() ? { sessionToken: env.AWS_SESSION_TOKEN.trim() } : {}),
  };
}

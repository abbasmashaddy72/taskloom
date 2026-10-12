import { StorageConfigurationError } from './storage-config';
/** Safe client messages for attachment failures; never expose AWS credentials or raw request data. */
export type AttachmentFailure = { status: number; code: string; error: string };

function errorCode(cause: unknown): string {
  if (!cause || typeof cause !== 'object') return '';
  const error = cause as { name?: string; code?: string; Code?: string; cause?: unknown };
  return error.Code || error.code || (error.name && error.name !== 'Error' ? error.name : '') || errorCode(error.cause);
}

/** Log only non-secret SDK metadata, not raw messages, URLs, headers or credentials. */
export function storageErrorDiagnostics(cause: unknown): { name: string; code: string; causeCode: string; status?: number } {
  const error = cause && typeof cause === 'object' ? cause as {
    name?: string; code?: string; cause?: unknown; $metadata?: { httpStatusCode?: number };
  } : {};
  return {
    name: error.name || 'UnknownError',
    code: errorCode(cause) || 'UnknownError',
    causeCode: errorCode(error.cause) || 'none',
    ...(error.$metadata?.httpStatusCode ? { status: error.$metadata.httpStatusCode } : {}),
  };
}


export function storageFailure(cause: unknown): AttachmentFailure {
  if (cause instanceof StorageConfigurationError) return {
    status: 503, code: 'S3_CONFIGURATION_INVALID', error: cause.message,
  };
  const code = errorCode(cause);
  if (['NoSuchBucket', 'NotFound'].includes(code)) return {
    status: 502, code: 'S3_BUCKET_NOT_FOUND', error: 'S3 bucket was not found. Check AWS_BUCKET and AWS_DEFAULT_REGION.',
  };
  if (['AccessDenied', 'Forbidden', 'InvalidAccessKeyId', 'SignatureDoesNotMatch', 'CredentialsProviderError', 'ExpiredToken', 'InvalidToken'].includes(code)) return {
    status: 502, code: 'S3_ACCESS_DENIED', error: 'S3 access failed. Check AWS credentials, bucket permissions, and the configured region.',
  };
  if (['AuthorizationHeaderMalformed', 'PermanentRedirect', 'IllegalLocationConstraintException'].includes(code)) return {
    status: 502, code: 'S3_REGION_MISMATCH', error: 'S3 bucket and client regions differ. Check AWS_DEFAULT_REGION and AWS_ENDPOINT.',
  };
  if (['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) {
    return { status: 502, code: 'S3_CONNECTION_FAILED', error: 'Cannot reach the S3 API endpoint. Check AWS_ENDPOINT and the Lerd RustFS service.' };
  }
  return { status: 502, code: 'S3_UPLOAD_FAILED', error: 'Could not upload to S3. Check the endpoint, bucket, network and server logs.' };
}

export function validationFailure(cause: unknown): AttachmentFailure {
  return { status: 400, code: 'INVALID_ATTACHMENT', error: cause instanceof Error ? cause.message : 'Invalid attachment request.' };
}

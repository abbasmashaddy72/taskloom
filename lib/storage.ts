import 'server-only';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getDb } from './mongodb';
import { safeFilename } from './attachment-policy';
export { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_TASK, MAX_ATTACHMENTS_PER_REQUEST, permittedFilename, attachmentLabel } from './attachment-policy';

export const objectKey = (taskId: string, filename: string) => `taskloom/tasks/${taskId}/${randomUUID()}-${safeFilename(filename)}`;

function bucket() {
  const value = process.env.AWS_BUCKET || process.env.S3_BUCKET;
  if (!value || !region()) throw new Error('S3 is not configured. Set AWS_BUCKET and AWS_DEFAULT_REGION in .env.local.');
  return value;
}
function region() {
  return process.env.AWS_DEFAULT_REGION || process.env.S3_REGION || process.env.AWS_REGION;
}
let cached: S3Client | undefined;
function s3() {
  bucket();
  if (!cached) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) throw new Error('Both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when using static credentials.');
    const endpoint = process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT;
    cached = new S3Client({
      region: region(),
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: (process.env.AWS_USE_PATH_STYLE_ENDPOINT || process.env.S3_FORCE_PATH_STYLE) === 'true',
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey, ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}) } } : {}),
    });
  }
  return cached;
}
export async function uploadObject(key: string, contents: Uint8Array) {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: contents, ContentType: 'application/octet-stream' }));
}
export async function removeObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
export async function downloadUrl(key: string, filename: string) {
  // Attachment disposition + octet-stream prevents active content being rendered inline.
  const safe = safeFilename(filename).replace(/"/g, '_');
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentDisposition: `attachment; filename="${safe}"`, ResponseContentType: 'application/octet-stream' }), { expiresIn: 60 });
}
export async function cleanupAttachments(taskIds: string[]) {
  if (!taskIds.length) return;
  const db = await getDb();
  const records = await db.collection('attachments').find({ taskId: { $in: taskIds } }).toArray();
  for (const record of records) {
    await removeObject(String(record.key));
    await db.collection('attachments').deleteOne({ _id: record._id });
  }
}

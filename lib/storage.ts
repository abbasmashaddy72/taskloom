import 'server-only';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getDb } from './mongodb';
import { safeFilename } from './attachment-policy';
import { storageSettings } from './storage-config';
export { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_TASK, MAX_ATTACHMENTS_PER_REQUEST, permittedFilename, attachmentLabel } from './attachment-policy';

export const objectKey = (taskId: string, filename: string) => `taskloom/tasks/${taskId}/${randomUUID()}-${safeFilename(filename)}`;

function bucket() {
  return storageSettings().bucket;
}

let cached: S3Client | undefined;
function s3() {
  if (!cached) {
    const { region, endpoint, forcePathStyle, accessKeyId, secretAccessKey, sessionToken } = storageSettings();
    cached = new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle,
      ...(accessKeyId && secretAccessKey ? {
        credentials: {
          accessKeyId,
          secretAccessKey,
          ...(sessionToken ? { sessionToken } : {}),
        },
      } : {}),
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

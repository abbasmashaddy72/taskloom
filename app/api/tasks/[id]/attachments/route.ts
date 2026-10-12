import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { writeFromSameOrigin } from '@/lib/request-origin';
import { oid } from '@/lib/data';
import { storageErrorDiagnostics, storageFailure, validationFailure } from '@/lib/attachment-errors';
import { storageSettings } from '@/lib/storage-config';
import { attachmentLabel, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_REQUEST, MAX_ATTACHMENTS_PER_TASK, objectKey, permittedFilename, removeObject, uploadObject } from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!writeFromSameOrigin(request)) return NextResponse.json({ code: 'INVALID_ORIGIN', error: 'Invalid request origin. Upload from the Taskloom site URL.' }, {status:403});
  let uploaded: string | undefined;
  try {
    const { id } = await context.params;
    if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ code: 'INVALID_TASK', error: 'Invalid task identifier.' }, { status: 400 });
    let db: Awaited<ReturnType<typeof getDb>>;
    try { db = await getDb(); }
    catch (error) {
      console.error('Attachment upload: MongoDB unavailable:', error instanceof Error ? error.name : 'unknown');
      return NextResponse.json({ code: 'DATABASE_UNAVAILABLE', error: 'MongoDB is unavailable. Check the Taskloom database connection.' }, { status: 503 });
    }
    const task = await db.collection('tasks').findOne({ _id: oid(id) });
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    try { storageSettings(); }
    catch (error) {
      const failure = storageFailure(error);
      return NextResponse.json(failure, { status: failure.status });
    }
    const form = await request.formData();
    const files = form.getAll('file');
    const labels = form.getAll('label');
    const tokens = form.getAll('token');
    if (!files.length || files.length > MAX_ATTACHMENTS_PER_REQUEST || files.length !== labels.length || files.length !== tokens.length) return NextResponse.json({ error: 'Select 1–5 files with a name for each.' }, { status: 400 });
    let validated: { file: File; label: string; token: string }[];
    try {
      validated = files.map((file, index) => {
        if (!(file instanceof File) || !(file.size > 0 && file.size <= MAX_ATTACHMENT_BYTES) || !permittedFilename(file.name)) throw new Error('Only non-empty PDF, image, document, Markdown, CSV, JSON, and ZIP files up to 10 MB are allowed.');
        const token = String(tokens[index] ?? '');
        if (!/^[a-f0-9-]{36}$/i.test(token)) throw new Error('Invalid attachment request token.');
        return { file, label: attachmentLabel(String(labels[index] ?? '')), token };
      });
      if (new Set(validated.map(row => row.token)).size !== validated.length) throw new Error('Duplicate attachments in request.');
    } catch (error) {
      const failure = validationFailure(error);
      return NextResponse.json({ code: failure.code, error: failure.error }, { status: failure.status });
    }
    const alreadySaved = await db.collection('attachments').find({taskId:id,clientToken:{$in:validated.map(row=>row.token)}}).toArray();
    if (await db.collection('attachments').countDocuments({ taskId: id }) + files.length - alreadySaved.length > MAX_ATTACHMENTS_PER_TASK) return NextResponse.json({ error: 'Maximum 20 attachments per task.' }, { status: 400 });
    const saved = [];
    for (const { file, label, token } of validated) {
      const existing = alreadySaved.find(row => row.clientToken === token);
      if (existing) {saved.push({id:String(existing._id),label:String(existing.label),filename:String(existing.filename)});continue;}

      uploaded = objectKey(id, file.name);
      try {
        await uploadObject(uploaded, new Uint8Array(await file.arrayBuffer()));
      } catch (error) {
        const failure = storageFailure(error);
        console.error('Attachment S3 upload failed:', storageErrorDiagnostics(error));
        uploaded = undefined;
        return NextResponse.json({ code: failure.code, error: failure.error }, { status: failure.status });
      }
      try {
        const result = await db.collection('attachments').insertOne({ taskId: id, projectId: task.projectId, clientToken: token, label, filename: file.name, key: uploaded, size: file.size, createdAt: new Date() });
        saved.push({ id: String(result.insertedId), label, filename: file.name });
        uploaded = undefined;
      } catch (error) {
        if (uploaded) await removeObject(uploaded).catch(() => {});
        uploaded = undefined;
        throw error;
      }
    }
    return NextResponse.json({ attachments: saved }, { status: 201 });
  } catch (error) {
    if (uploaded) await removeObject(uploaded).catch(() => {});
    console.error('Attachment processing failed:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ code: 'ATTACHMENT_PROCESSING_FAILED', error: 'Could not save the attachment. Check the server logs and retry.' }, { status: 500 });
  }
}

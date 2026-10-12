import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { writeFromSameOrigin } from '@/lib/request-origin';
import { oid } from '@/lib/data';
import { removeObject } from '@/lib/storage';

export const runtime = 'nodejs';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  if (!writeFromSameOrigin(request)) return NextResponse.json({error:'Invalid request origin.'},{status:403});
  try {
    const { id, attachmentId } = await context.params;
    const db = await getDb();
    if (!await db.collection('tasks').findOne({ _id: oid(id) })) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    const record = await db.collection('attachments').findOne({ _id: oid(attachmentId), taskId: id });
    if (!record) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });
    await removeObject(String(record.key));
    await db.collection('attachments').deleteOne({ _id: record._id });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not delete attachment.' }, { status: 400 });
  }
}

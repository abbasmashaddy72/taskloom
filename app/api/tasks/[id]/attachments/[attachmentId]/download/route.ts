import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { oid } from '@/lib/data';
import { downloadUrl } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const { id, attachmentId } = await context.params;
    const db = await getDb();
    if (!(await db.collection('tasks').findOne({ _id: oid(id) })))
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    const record = await db.collection('attachments').findOne({ _id: oid(attachmentId), taskId: id });
    if (!record) return NextResponse.json({ error: 'Attachment not found.' }, { status: 404 });
    return NextResponse.redirect(await downloadUrl(String(record.key), String(record.filename)), {
      status: 303,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not open attachment.' },
      { status: 400 },
    );
  }
}

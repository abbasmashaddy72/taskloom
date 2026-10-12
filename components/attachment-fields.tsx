'use client';

import { Download, FilePlus2, Trash2 } from 'lucide-react';
import type { Attachment } from '@/lib/types';
import type { RequestConfirmation } from './shared';

export type FileRow = { id: string; label: string; file: File | null };
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.zip,.json';

export async function uploadFiles(taskId: string, rows: FileRow[]) {
  if (!rows.length) return;
  if (
    rows.length > 20 ||
    rows.some(
      (row) =>
        !row.file ||
        row.file.size === 0 ||
        row.file.size > MAX_FILE_BYTES ||
        !row.label.trim() ||
        row.label.trim().length > 120,
    )
  )
    throw new Error('Each file needs a name and must be between 1 byte and 10 MB.');
  for (let i = 0; i < rows.length; i += 5) {
    const form = new FormData();
    for (const row of rows.slice(i, i + 5)) {
      form.append('file', row.file!);
      form.append('label', row.label.trim());
      form.append('token', row.id);
    }
    const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/attachments`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      const message = (await response.json().catch(() => ({}))) as { code?: string; error?: string };
      throw new Error(message.error || `Attachment upload failed (HTTP ${response.status}).`);
    }
  }
}

export function AttachmentFields({
  taskId,
  existing,
  enabled,
  loading,
  pending,
  setPending,
  remove,
  confirm,
}: {
  confirm: RequestConfirmation;
  taskId?: string;
  existing: Attachment[];
  enabled: boolean;
  loading: boolean;
  pending: FileRow[];
  setPending: (rows: FileRow[]) => void;
  remove: (id: string) => Promise<void>;
}) {
  const append = () => {
    if (pending.length + existing.length >= 20) return;
    setPending([...pending, { id: crypto.randomUUID(), label: '', file: null }]);
  };
  return (
    <section className="hairline rounded-xl border p-4" style={{ background: 'var(--surface-2)' }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <FilePlus2 size={16} />
            Attachments
          </h3>
          <p className="muted mt-1 text-[11px]">
            Multiple files with custom names · Max 10 MB per file · 20 per task
          </p>
        </div>
        <button
          type="button"
          className="btn !text-xs"
          disabled={!enabled || loading || pending.length + existing.length >= 20}
          onClick={append}
        >
          <FilePlus2 size={14} />
          Add file
        </button>
      </div>
      {!enabled && (
        <p className="mb-3 rounded-lg border border-amber-500/30 p-3 text-xs text-amber-600 dark:text-amber-300">
          S3 attachments are disabled. Configure AWS_BUCKET and AWS_DEFAULT_REGION in .env.local and restart
          the server.
        </p>
      )}
      {existing.length > 0 && (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead>
              <tr className="muted hairline border-b">
                <th className="py-2 font-semibold">Name</th>
                <th className="py-2 font-semibold">Stored file</th>
                <th className="py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {existing.map((row) => (
                <tr className="hairline border-b" key={row.id}>
                  <td className="max-w-[150px] truncate py-2 font-semibold" title={row.label}>
                    {row.label}
                  </td>
                  <td className="max-w-[170px] truncate py-2" title={row.filename}>
                    {row.filename}{' '}
                    <span className="muted">({Math.max(1, Math.ceil(row.size / 1024))} KB)</span>
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end gap-1">
                      <a
                        className="icon-btn"
                        href={`/api/tasks/${encodeURIComponent(taskId!)}/attachments/${row.id}/download`}
                        aria-label={`Download ${row.label}`}
                        title="Download"
                      >
                        <Download size={15} />
                      </a>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${row.label}`}
                        title="Remove"
                        disabled={loading}
                        onClick={() =>
                          confirm({
                            title: 'Remove attachment?',
                            description: `Permanently remove “${row.label}” from this task and delete its stored object?`,
                            confirmLabel: 'Remove file',
                            destructive: true,
                            onConfirm: () => void remove(row.id),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pending.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-xs">
            <thead>
              <tr className="muted hairline border-b">
                <th className="py-2 font-semibold">Display name</th>
                <th className="py-2 font-semibold">File</th>
                <th className="py-2 text-right font-semibold">Remove</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.id} className="hairline border-b">
                  <td className="py-2 pr-2">
                    <input
                      className="field !px-2 !py-2 !text-xs"
                      aria-label="Attachment name"
                      required
                      maxLength={120}
                      value={row.label}
                      onChange={(e) =>
                        setPending(
                          pending.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r)),
                        )
                      }
                      placeholder="e.g. Test report"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label="Choose attachment"
                      required
                      className="block w-full min-w-[175px] text-xs file:mr-2 file:rounded-md file:border-0 file:p-1.5"
                      type="file"
                      accept={ACCEPTED}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setPending(
                          pending.map((r) =>
                            r.id === row.id
                              ? { ...r, file, label: r.label || file?.name.replace(/\.[^.]+$/, '') || '' }
                              : r,
                          ),
                        );
                      }}
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Remove pending file"
                      onClick={() => setPending(pending.filter((r) => r.id !== row.id))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!existing.length && !pending.length && <p className="muted text-xs">No attachments added.</p>}
    </section>
  );
}

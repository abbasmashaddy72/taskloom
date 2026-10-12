/** Shared, dependency-free upload limits and filename validation. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TASK = 20;
export const MAX_ATTACHMENTS_PER_REQUEST = 5;

const extensions = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'txt',
  'md',
  'csv',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'zip',
  'json',
]);

export function permittedFilename(filename: string): boolean {
  const extension = filename.split('.').pop()?.toLowerCase();
  return Boolean(extension && extensions.has(extension) && filename.length <= 255);
}

export function attachmentLabel(value: string): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 120) throw new Error('Every attachment needs a name (1–120 characters).');
  return cleaned;
}

export function safeFilename(value: string): string {
  return (
    value
      .replace(/[\\/\r\n\x00-\x1f]/g, '_')
      .replace(/[^a-zA-Z0-9._ -]/g, '_')
      .slice(-120) || 'attachment'
  );
}

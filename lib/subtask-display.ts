/** Hide source-Markdown repeats while retaining the full source text in MongoDB. */
export function subtaskDetails(title: string, description: string | undefined): string | null {
  if (!description || !description.trim()) return null;
  const readable = (text: string): string => text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const full = readable(description);
  const short = readable(title);
  if (!full || full === short) return null;
  return full;
}

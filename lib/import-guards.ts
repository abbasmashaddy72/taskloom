/** Pure rollback integrity checks; deliberately fail closed on changed imported work. */
export function assertUnchanged<T extends { _id: unknown }>(actual: T[], expected: T[], label: string) {
  const current = new Map(actual.map(row => [String(row._id), JSON.stringify(row)]));
  if (actual.length !== expected.length || current.size !== expected.length || expected.some(row => current.get(String(row._id)) !== JSON.stringify(row))) {
    throw new Error(`${label} have changed since import. Undo is blocked to protect newer work.`);
  }
}
export function assertOnlyImported<T extends { _id: unknown }>(actual: T[], importedIds: string[], label: string) {
  const allowed = new Set(importedIds);
  if (actual.some(row => !allowed.has(String(row._id)))) {
    throw new Error(`New ${label} were added after import. Undo is blocked to protect newer work.`);
  }
}
export function assertNoActiveLinks(count: number) {
  if (count > 0) throw new Error('Imported tasks have links to other projects. Unlink them before undo.');
}

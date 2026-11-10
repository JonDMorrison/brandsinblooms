/** A newsletter's subject and preview are send-time fields, not prerequisites to editing. */
export async function resolveStudioDraftId(
  existingId: string | null | undefined,
  saveDraft: () => Promise<string | null>,
): Promise<string | null> {
  if (existingId) return existingId;
  const first = await saveDraft();
  if (first) return first;
  return saveDraft();
}

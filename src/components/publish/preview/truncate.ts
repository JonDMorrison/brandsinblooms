// src/components/publish/preview/truncate.ts
export const truncateWithMore = (text: string, n: number) =>
  text && text.length > n ? text.slice(0, n).trim() + "…" : text || "";
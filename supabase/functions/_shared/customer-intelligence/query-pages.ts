export interface QueryPage<T> { data: T[] | null; error: {message: string} | null; }
/** A complete scan, or a clear error. Never disguise a page limit as a complete answer. */
export async function readAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<QueryPage<T>>, maximum = 250000): Promise<T[]> {
  const rows: T[] = [], size = 1000;
  for (let from = 0; ; from += size) {
    const {data, error} = await fetchPage(from, from + size - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    if (rows.length + page.length > maximum) throw new Error(`The analysis exceeds the ${maximum.toLocaleString()}-record safety limit. No partial total was returned. Use a narrower source period or request a larger server-side analysis.`);
    rows.push(...page);
    if (page.length < size) return rows;
  }
}

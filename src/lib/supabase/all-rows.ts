import "server-only";

// The database API returns at most a set number of rows per request (1,000 locally). This
// asks for the next range until every row is in, so a list is never cut short, whatever that
// cap is (independent check F4). The query must have a stable order.
// When the query asks for a count (`select(..., { count: "exact" })`), the loop stops as soon
// as it has that many rows, so a short list takes one request instead of two. Without a
// count it asks again until a request comes back empty.
type Page<T> = PromiseLike<{ data: T[] | null; error: { code?: string } | null; count?: number | null }>;
const PAGE = 1000;

export async function allRows<T>(range: (from: number, to: number) => Page<T>): Promise<{ data: T[]; error: null } | { data: null; error: { code?: string } }> {
  const rows: T[] = [];
  for (;;) {
    const { data, error, count } = await range(rows.length, rows.length + PAGE - 1);
    if (error) return { data: null, error };
    if (!data || data.length === 0) return { data: rows, error: null };
    rows.push(...data);
    if (typeof count === "number" && rows.length >= count) return { data: rows, error: null };
  }
}

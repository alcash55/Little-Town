import { expect, spyOn } from "bun:test";

/** Stub only declared WOM misses; keep the suite's Supabase requests real. */
export function stubWomMisses(supabaseUrl: string) {
  const originalFetch = globalThis.fetch;
  const allowedRsns = new Set<string>();
  const usernames: string[] = [];
  const unexpectedRequests: string[] = [];
  const supabaseOrigin = new URL(supabaseUrl).origin;
  const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
    async (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString()
      );
      if (url.origin === supabaseOrigin) return originalFetch(input, init);

      const username = url.searchParams.get("username");
      const method =
        init?.method ?? (input instanceof Request ? input.method : "GET");
      if (
        url.origin === "https://api.wiseoldman.net" &&
        url.pathname === "/v2/names" &&
        method === "GET" &&
        username !== null &&
        allowedRsns.has(username)
      ) {
        usernames.push(username);
        return Response.json([]);
      }

      unexpectedRequests.push(`${method} ${url.href}`);
      throw new Error(`Unexpected test network request: ${method} ${url.href}`);
    }
  );

  return {
    allowedRsns,
    usernames,
    unexpectedRequests,
    restore() {
      fetchSpy.mockRestore();
      // Lookup errors are caught by production code. Assert outside that catch
      // so an undeclared request cannot silently turn into a passing WOM miss.
      expect(unexpectedRequests).toEqual([]);
    },
  };
}

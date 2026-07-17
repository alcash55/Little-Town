/**
 * Formats a failed `fetchWithAuth`/`fetch` Response into a user-facing (and
 * log-facing) message that always carries the HTTP status and, where
 * available, the server's own error text — never just `response.statusText`.
 *
 * Bug-report investigation (prod incident, 2026-07-17): Board Builder's
 * "Failed to send bingo details: " message had a dangling colon with nothing
 * after it. `response.statusText` is the culprit — browsers report an empty
 * string for `statusText` on HTTP/2 responses (no reason phrase on the
 * wire), which is exactly how the hosted backend is served in production.
 * It looked fine locally (HTTP/1.1 always has a reason phrase) and in any
 * `fetch` polyfill that fills the value in from the status code, which is
 * why it shipped. `describeApiError` reads the JSON error body first and
 * always appends the numeric status, so the message is meaningful even when
 * the body is empty/unparseable and `statusText` is blank.
 */

export interface ApiErrorInfo {
  status: number;
  /** Message pulled from the response body, if any (e.g. `error` field). */
  bodyMessage: string | null;
  /**
   * Human-readable, always non-empty: "<reason> (HTTP <status>)". Falls back
   * to `defaultReason` when the body has no usable message.
   */
  message: string;
  /** True for 401/403 — the caller is unauthenticated or lacks permission, as opposed to a real failure. */
  isPermissionError: boolean;
}

const extractBodyMessage = (body: unknown): string | null => {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error.trim()) return record.error;
  if (typeof record.message === 'string' && record.message.trim()) return record.message;
  return null;
};

export async function describeApiError(
  response: Response,
  defaultReason = 'Request failed',
): Promise<ApiErrorInfo> {
  let bodyMessage: string | null = null;
  try {
    // `.clone()` so a caller that also wants the raw body isn't left with an
    // already-consumed stream.
    const body: unknown = await response.clone().json();
    bodyMessage = extractBodyMessage(body);
  } catch {
    // No JSON body (or not JSON at all) — fall through to defaultReason.
  }

  const reason = bodyMessage ?? defaultReason;

  return {
    status: response.status,
    bodyMessage,
    message: `${reason} (HTTP ${response.status})`,
    isPermissionError: response.status === 401 || response.status === 403,
  };
}

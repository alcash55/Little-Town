import { describe, expect, it } from 'vitest';
import { describeApiError } from './apiError';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

describe('describeApiError — error-message formatting (bug-report investigation, prod incident)', () => {
  // The actual prod bug: `response.statusText` is empty for HTTP/2 responses
  // (no reason phrase on the wire), producing "Failed to send bingo
  // details: " with a dangling colon and no reason. describeApiError must
  // never rely on statusText, and must always produce a non-empty message.
  it('never emits a dangling/empty tail even when the body carries no message', async () => {
    const response = new Response('', { status: 403, statusText: '' });
    const info = await describeApiError(response, 'Failed to send bingo details');
    expect(info.message).toBe('Failed to send bingo details (HTTP 403)');
    expect(info.message.trim().endsWith(':')).toBe(false);
    expect(info.status).toBe(403);
  });

  it('prefers the server-provided `error` field over the default reason', async () => {
    const response = jsonResponse(403, { error: 'User role user is not authorized to access this route' });
    const info = await describeApiError(response, 'Failed to send bingo details');
    expect(info.message).toBe('User role user is not authorized to access this route (HTTP 403)');
    expect(info.bodyMessage).toBe('User role user is not authorized to access this route');
  });

  it('falls back to a `message` field if `error` is absent', async () => {
    const response = jsonResponse(500, { message: 'Database unavailable' });
    const info = await describeApiError(response, 'Failed to save board');
    expect(info.message).toBe('Database unavailable (HTTP 500)');
  });

  it('falls back to the default reason for a non-JSON body', async () => {
    const response = new Response('<html>502 Bad Gateway</html>', { status: 502 });
    const info = await describeApiError(response, 'Failed to save board');
    expect(info.message).toBe('Failed to save board (HTTP 502)');
    expect(info.bodyMessage).toBeNull();
  });

  it('falls back to the default reason for an empty body', async () => {
    const response = new Response('', { status: 404 });
    const info = await describeApiError(response, 'Failed to load bingo details');
    expect(info.message).toBe('Failed to load bingo details (HTTP 404)');
  });

  it('ignores a blank `error` string in the body and falls back to the default reason', async () => {
    const response = jsonResponse(400, { error: '   ' });
    const info = await describeApiError(response, 'Failed to modify bingo details');
    expect(info.message).toBe('Failed to modify bingo details (HTTP 400)');
  });

  it.each([401, 403])('flags %i as a permission error', async (status) => {
    const info = await describeApiError(jsonResponse(status, {}), 'x');
    expect(info.isPermissionError).toBe(true);
  });

  it.each([400, 404, 500, 502])('does not flag %i as a permission error', async (status) => {
    const info = await describeApiError(jsonResponse(status, {}), 'x');
    expect(info.isPermissionError).toBe(false);
  });

  it('does not consume the body for other callers (clones before reading)', async () => {
    const response = jsonResponse(403, { error: 'nope' });
    await describeApiError(response, 'x');
    // The original response's body must still be readable afterwards.
    const body = await response.json();
    expect(body).toEqual({ error: 'nope' });
  });
});

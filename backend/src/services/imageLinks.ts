/**
 * Imgur link ingestion for the Discord screenshot pipeline.
 *
 * Users sometimes paste an imgur link instead of attaching an image.
 * `extractImgurCandidates` finds and *validates* those links from raw
 * message text (pure, no I/O). `downloadImgurImage` then fetches the actual
 * bytes for a validated candidate with the hardening rules described in
 * TEAM-BRIEF.md (no redirects, timeout, size cap, content-type + magic-byte
 * verification). Both are unit-tested in isolation from Discord/Supabase.
 */

// -------------------------------------------------------
// Extraction / validation (pure — no network)
// -------------------------------------------------------

/** Extension as it appeared in the URL. Only used to build the initial
 * download request — the actual stored extension always comes from the
 * downloaded bytes (see `DetectedExt` below), never from user input. */
export type ImgurUrlExt = "png" | "jpg" | "jpeg" | "gif" | "webp";

export interface ImgurCandidate {
  id: string;
  ext: ImgurUrlExt;
}

const MAX_LINKS_PER_MESSAGE = 3;

// Finds raw URL-shaped substrings in free text. Deliberately dumb — every
// match still gets fed through `new URL()` below, so a permissive regex here
// is safe (it can never widen what's actually accepted).
const URL_CANDIDATE_RE = /https?:\/\/[^\s<>"']+/g;

const ALLOWED_HOSTS = new Set(["imgur.com", "www.imgur.com", "i.imgur.com"]);

// Known imgur app routes that look like a valid id but aren't one. Albums
// (`a/`) and galleries (`gallery/`) are explicitly out of scope per the brief;
// the rest are defensive (this list is not claimed to be exhaustive — imgur
// could add routes — but the id-shape + host-allowlist checks are the real
// security boundary, this is just a scope filter).
const RESERVED_PATHS = new Set([
  "a",
  "gallery",
  "t",
  "user",
  "r",
  "upload",
  "removalrequest",
  "signin",
  "register",
  "settings",
  "search",
  "topic",
]);

const ID_RE = /^[A-Za-z0-9]{5,10}$/;
const I_IMGUR_SEGMENT_RE = /^([A-Za-z0-9]+)\.(png|jpe?g|gif|webp)$/i;

/**
 * Validates one candidate URL string against the imgur link contract.
 * Never does a substring match — always goes through `new URL()` and checks
 * protocol/hostname/username/password/port explicitly, which is what
 * defeats tricks like `https://i.imgur.com@evil.com/x.png` (that parses to
 * hostname `evil.com`, username `i.imgur.com`) and
 * `https://i.imgur.com.evil.com/x.png` (hostname is the whole string, not a
 * suffix match against the allowlist).
 */
function parseImgurUrl(raw: string): ImgurCandidate | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (!ALLOWED_HOSTS.has(url.hostname)) return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.port !== "") return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;
  const segment = segments[0];

  if (url.hostname === "i.imgur.com") {
    const match = I_IMGUR_SEGMENT_RE.exec(segment);
    if (!match) return null;
    const [, id, ext] = match;
    if (RESERVED_PATHS.has(id.toLowerCase())) return null;
    if (!ID_RE.test(id)) return null;
    return { id, ext: ext.toLowerCase() as ImgurUrlExt };
  }

  // imgur.com / www.imgur.com — page link, no extension in the URL.
  if (RESERVED_PATHS.has(segment.toLowerCase())) return null;
  if (!ID_RE.test(segment)) return null;
  return { id: segment, ext: "png" };
}

/**
 * Pulls every valid imgur link out of a Discord message's raw text, capped
 * at `MAX_LINKS_PER_MESSAGE`. Anything that doesn't parse as an accepted
 * imgur URL shape is skipped with a debug log rather than throwing — a
 * message full of unrelated links must never break ingest.
 */
export function extractImgurCandidates(content: string): ImgurCandidate[] {
  const matches = content.match(URL_CANDIDATE_RE) ?? [];
  const candidates: ImgurCandidate[] = [];

  for (const raw of matches) {
    const candidate = parseImgurUrl(raw);
    if (!candidate) {
      console.debug(`[discordScreenshots] Ignoring non-imgur or invalid link: ${raw}`);
      continue;
    }
    if (candidates.length >= MAX_LINKS_PER_MESSAGE) {
      console.log(
        `[discordScreenshots] Ignoring imgur link beyond the ${MAX_LINKS_PER_MESSAGE}-per-message cap: ${raw}`,
      );
      continue;
    }
    candidates.push(candidate);
  }

  return candidates;
}

// -------------------------------------------------------
// Download hardening (network)
// -------------------------------------------------------

/** Extension as detected from the downloaded bytes — this, never the URL's
 * extension, is what gets used in the storage path and content type. */
export type DetectedExt = "png" | "jpg" | "webp" | "gif";

export type ImgurDownloadSkipReason =
  | "redirected"
  | "http_error"
  | "content_type_mismatch"
  | "magic_byte_mismatch"
  | "too_large"
  | "network_error";

export type ImgurDownloadResult =
  | { ok: true; buffer: Buffer; contentType: string; ext: DetectedExt; id: string }
  | { ok: false; reason: ImgurDownloadSkipReason };

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 20 * 1024 * 1024;

const CONTENT_TYPE_TO_EXT: Record<string, DetectedExt> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function hasMagicBytes(buffer: Buffer, ext: DetectedExt): boolean {
  switch (ext) {
    case "png":
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    case "jpg":
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "gif":
      return buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "GIF8";
    case "webp":
      return (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
      );
  }
}

/**
 * Downloads and validates a single imgur image for a candidate that already
 * passed `extractImgurCandidates`. Implements the full security contract:
 * the fetch URL is rebuilt from validated parts (never the user's original
 * string), redirects are treated as "removed" rather than followed, the
 * request is time-boxed, the body is size-capped while streaming (never
 * buffered unbounded), and the declared Content-Type must match the actual
 * magic bytes before the buffer is trusted.
 */
export async function downloadImgurImage(candidate: ImgurCandidate): Promise<ImgurDownloadResult> {
  const url = `https://i.imgur.com/${candidate.id}.${candidate.ext}`;

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    console.error(`[discordScreenshots] Imgur fetch failed for id ${candidate.id}:`, e);
    return { ok: false, reason: "network_error" };
  }

  // imgur 302s deleted/unavailable images to a placeholder — treat any
  // redirect as "unavailable", never follow it.
  if (response.status >= 300 && response.status < 400) {
    console.log(
      `[discordScreenshots] Imgur link ${candidate.id} redirected (removed/unavailable) — skipping.`,
    );
    return { ok: false, reason: "redirected" };
  }

  if (!response.ok) {
    console.warn(
      `[discordScreenshots] Imgur fetch for ${candidate.id} returned ${response.status} — skipping.`,
    );
    return { ok: false, reason: "http_error" };
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = CONTENT_TYPE_TO_EXT[contentType];
  if (!ext) {
    console.warn(
      `[discordScreenshots] Imgur ${candidate.id} had unexpected content-type "${contentType}" — skipping.`,
    );
    return { ok: false, reason: "content_type_mismatch" };
  }

  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader !== null && Number(contentLengthHeader) > MAX_BYTES) {
    console.warn(
      `[discordScreenshots] Imgur ${candidate.id} exceeds the ${MAX_BYTES}-byte cap per Content-Length — skipping.`,
    );
    return { ok: false, reason: "too_large" };
  }

  if (!response.body) {
    console.warn(`[discordScreenshots] Imgur ${candidate.id} had no response body — skipping.`);
    return { ok: false, reason: "network_error" };
  }

  // Stream and count bytes as they arrive rather than buffering an
  // unbounded body — a malicious/misbehaving server that ignores its own
  // Content-Length can't blow up memory here.
  const chunks: Buffer[] = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        console.warn(
          `[discordScreenshots] Imgur ${candidate.id} exceeded the ${MAX_BYTES}-byte cap while streaming — aborting.`,
        );
        return { ok: false, reason: "too_large" };
      }
      chunks.push(Buffer.from(value));
    }
  } catch (e) {
    console.error(`[discordScreenshots] Imgur ${candidate.id} stream read failed:`, e);
    return { ok: false, reason: "network_error" };
  }

  const buffer = Buffer.concat(chunks);
  if (!hasMagicBytes(buffer, ext)) {
    console.warn(
      `[discordScreenshots] Imgur ${candidate.id} content-type "${contentType}" didn't match its magic bytes — skipping.`,
    );
    return { ok: false, reason: "magic_byte_mismatch" };
  }

  return { ok: true, buffer, contentType, ext, id: candidate.id };
}

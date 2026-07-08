import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { Attachment, Message } from "discord.js";

// -------------------------------------------------------
// Module mocks — ingestMessage talks to Supabase (via getDb) and to
// db/bingos.js + db/bingoSubmissions.js. None of that is real here: we mock
// each module ingestMessage imports so this test never touches a network or
// a database, only the ingest logic + the real imageLinks.ts extraction and
// download-hardening code (fetch is stubbed instead).
// -------------------------------------------------------

const submissionExistsMock = mock(async (_discordMessageId: string) => false);
const insertPendingSubmissionMock = mock(async (_input: unknown) => {});

mock.module("../../src/db/bingoSubmissions.js", () => ({
  submissionExistsByDiscordMessageId: submissionExistsMock,
  insertPendingSubmission: insertPendingSubmissionMock,
  SCREENSHOTS_BUCKET: "screenshots",
}));

const getActiveBingoMock = mock(async () => ({ id: "bingo-1", status: "active" }));

mock.module("../../src/db/bingos.js", () => ({
  getActiveBingo: getActiveBingoMock,
}));

const uploadMock = mock(async (_path: string, _body: unknown, _opts: unknown) => ({ error: null }));
const storageFromMock = mock((_bucket: string) => ({ upload: uploadMock }));

mock.module("../../src/db/client.js", () => ({
  getDb: () => ({ storage: { from: storageFromMock } }),
}));

// Imported dynamically *after* the mocks above are registered, so
// discordScreenshots.js resolves the mocked db modules rather than the real
// ones (which would throw on a missing SUPABASE_URL).
const { ingestMessage } = await import("../../src/services/discordScreenshots.js");

// -------------------------------------------------------
// Fixtures
// -------------------------------------------------------

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const originalFetch = globalThis.fetch;

interface FakeAttachment {
  id: string;
  name: string;
  url: string;
  contentType: string;
}

function makeMessage(opts: {
  id: string;
  content?: string;
  attachments?: FakeAttachment[];
  bot?: boolean;
}): Message {
  const attachments = new Map(
    (opts.attachments ?? []).map((a) => [a.id, a as unknown as Attachment]),
  );
  return {
    id: opts.id,
    content: opts.content ?? "",
    attachments,
    author: { bot: opts.bot ?? false, tag: "Tester#0001", id: "999999999999999999" },
  } as unknown as Message;
}

function stubFetch(): void {
  globalThis.fetch = mock((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    // Both the attachment downloader and the imgur downloader go through
    // this same global fetch — route by URL.
    if (url.startsWith("https://i.imgur.com/")) {
      return Promise.resolve(
        new Response(PNG_BYTES, { status: 200, headers: { "content-type": "image/png" } }),
      );
    }
    if (url === "https://cdn.example.com/attachment.png") {
      return Promise.resolve(
        new Response(PNG_BYTES, { status: 200, headers: { "content-type": "image/png" } }),
      );
    }
    return Promise.reject(new Error(`unexpected fetch in test: ${url}`));
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  submissionExistsMock.mockClear();
  submissionExistsMock.mockImplementation(async () => false);
  insertPendingSubmissionMock.mockClear();
  getActiveBingoMock.mockClear();
  uploadMock.mockClear();
  storageFromMock.mockClear();
  stubFetch();
});

// -------------------------------------------------------
// Tests
// -------------------------------------------------------

describe("ingestMessage — imgur link ingestion", () => {
  test("link-only message (no attachments) creates a pending submission", async () => {
    const message = makeMessage({ id: "msg-1", content: "found this https://imgur.com/abcde1" });

    await ingestMessage(message);

    expect(insertPendingSubmissionMock).toHaveBeenCalledTimes(1);
    const call = insertPendingSubmissionMock.mock.calls[0][0] as {
      bingoId: string;
      discordMessageId: string;
      imagePath: string;
      notes?: string;
    };
    // Exactly one total item (no attachments + one valid link) -> bare message id, no suffix.
    expect(call.discordMessageId).toBe("msg-1");
    expect(call.bingoId).toBe("bingo-1");
    expect(call.imagePath).toBe("bingo-1/msg-1-imgur-abcde1.png");
    expect(call.notes).toContain("Tester#0001");

    expect(storageFromMock).toHaveBeenCalledWith("screenshots");
    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [uploadedPath, , uploadOpts] = uploadMock.mock.calls[0] as [string, unknown, { contentType: string }];
    expect(uploadedPath).toBe("bingo-1/msg-1-imgur-abcde1.png");
    expect(uploadOpts.contentType).toBe("image/png");
  });

  test("message with 1 attachment + 1 link produces :0 / :1 suffixed ids, attachment first", async () => {
    const message = makeMessage({
      id: "msg-2",
      content: "and also https://imgur.com/xyzab2",
      attachments: [
        {
          id: "att-1",
          name: "shot.png",
          url: "https://cdn.example.com/attachment.png",
          contentType: "image/png",
        },
      ],
    });

    await ingestMessage(message);

    expect(insertPendingSubmissionMock).toHaveBeenCalledTimes(2);
    const calls = insertPendingSubmissionMock.mock.calls.map(
      (c) => (c[0] as { discordMessageId: string }).discordMessageId,
    );
    expect(calls).toEqual(["msg-2:0", "msg-2:1"]);

    // sanitizeFileName replaces ":" (not in its allowed charset) with "_" —
    // same treatment the attachment path already gets for its filename, now
    // applied uniformly to the discord_message_id-derived path prefix too.
    const paths = uploadMock.mock.calls.map((c) => c[0] as string);
    expect(paths).toEqual(["bingo-1/msg-2_0-shot.png", "bingo-1/msg-2_1-imgur-xyzab2.png"]);
  });

  test("already-ingested message (discord_message_id exists) no-ops", async () => {
    submissionExistsMock.mockImplementation(async () => true);
    const message = makeMessage({ id: "msg-3", content: "https://imgur.com/dupe123" });

    await ingestMessage(message);

    expect(insertPendingSubmissionMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  test("a failed link download does not block a later attachment on the same message", async () => {
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("https://i.imgur.com/")) {
        // Simulate a removed image (redirect) for the link.
        return Promise.resolve(new Response(null, { status: 302 }));
      }
      return Promise.resolve(
        new Response(PNG_BYTES, { status: 200, headers: { "content-type": "image/png" } }),
      );
    }) as unknown as typeof fetch;

    const message = makeMessage({
      id: "msg-4",
      content: "https://imgur.com/removed1",
      attachments: [
        {
          id: "att-2",
          name: "shot2.png",
          url: "https://cdn.example.com/attachment.png",
          contentType: "image/png",
        },
      ],
    });

    await ingestMessage(message);

    // Attachment still ingested even though the link failed; only one row created.
    expect(insertPendingSubmissionMock).toHaveBeenCalledTimes(1);
    const call = insertPendingSubmissionMock.mock.calls[0][0] as { discordMessageId: string };
    // Still 2 total items (1 attachment + 1 candidate link, even though the
    // link ultimately fails download) so the suffix rule still applies.
    expect(call.discordMessageId).toBe("msg-4:0");
  });

  test("no attachments and no valid links is a no-op (does not even check for an active bingo)", async () => {
    const message = makeMessage({ id: "msg-5", content: "no links or images here" });

    await ingestMessage(message);

    expect(getActiveBingoMock).not.toHaveBeenCalled();
    expect(insertPendingSubmissionMock).not.toHaveBeenCalled();
  });
});

import { describe, test, expect, mock, afterEach } from "bun:test";

import {
  extractImgurCandidates,
  downloadImgurImage,
  type ImgurCandidate,
} from "../../src/services/imageLinks.js";

// -------------------------------------------------------
// Fixtures — minimal-but-valid bytes for each accepted format, plus a
// deliberately wrong one for the magic-byte mismatch test.
// -------------------------------------------------------

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const GIF_BYTES = Buffer.from("GIF89a" + "\0".repeat(10));
const WEBP_BYTES = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
  Buffer.from([0, 0, 0, 0]),
]);
const NOT_AN_IMAGE_BYTES = Buffer.from("<html>not an image</html>");

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response): void {
  globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    return impl(url, init);
  }) as unknown as typeof fetch;
}

// -------------------------------------------------------
// extractImgurCandidates — extraction/validation table tests
// -------------------------------------------------------

describe("extractImgurCandidates — happy paths", () => {
  test("i.imgur.com direct link with png extension", () => {
    const result = extractImgurCandidates("look at this https://i.imgur.com/7PiSDtp.png cool right");
    expect(result).toEqual([{ id: "7PiSDtp", ext: "png" }]);
  });

  test.each([
    ["jpg", "jpg"],
    ["jpeg", "jpeg"],
    ["gif", "gif"],
    ["webp", "webp"],
  ])("i.imgur.com direct link with %s extension", (ext) => {
    const result = extractImgurCandidates(`https://i.imgur.com/abcDE123.${ext}`);
    expect(result).toEqual([{ id: "abcDE123", ext }]);
  });

  test("imgur.com page link defaults ext to png", () => {
    const result = extractImgurCandidates("https://imgur.com/7PiSDtp");
    expect(result).toEqual([{ id: "7PiSDtp", ext: "png" }]);
  });

  test("www.imgur.com page link is accepted", () => {
    const result = extractImgurCandidates("https://www.imgur.com/7PiSDtp");
    expect(result).toEqual([{ id: "7PiSDtp", ext: "png" }]);
  });

  test("multiple valid links in one message, in order", () => {
    const result = extractImgurCandidates(
      "first https://imgur.com/aaaaa1 then https://i.imgur.com/bbbbb2.jpg",
    );
    expect(result).toEqual([
      { id: "aaaaa1", ext: "png" },
      { id: "bbbbb2", ext: "jpg" },
    ]);
  });

  test("caps at 3 valid links per message, ignoring the rest", () => {
    const content = [
      "https://imgur.com/aaaaa1",
      "https://imgur.com/bbbbb2",
      "https://imgur.com/ccccc3",
      "https://imgur.com/ddddd4",
      "https://imgur.com/eeeee5",
    ].join(" ");
    const result = extractImgurCandidates(content);
    expect(result).toHaveLength(3);
    expect(result.map((c) => c.id)).toEqual(["aaaaa1", "bbbbb2", "ccccc3"]);
  });

  test("no links in message returns empty array", () => {
    expect(extractImgurCandidates("just some regular chat, no links here")).toEqual([]);
  });
});

describe("extractImgurCandidates — hostile / malformed URLs are rejected", () => {
  const hostileCases: [string, string][] = [
    ["plain http:// scheme is rejected (not https)", "http://i.imgur.com/7PiSDtp.png"],
    [
      "userinfo trick: hostname is actually evil.com",
      "https://i.imgur.com@evil.com/x.png",
    ],
    [
      "path trick: hostname is actually evil.com",
      "https://evil.com/i.imgur.com/x.png",
    ],
    [
      "subdomain trick: hostname is i.imgur.com.evil.com, not an allowed exact host",
      "https://i.imgur.com.evil.com/x.png",
    ],
    ["explicit port is rejected", "https://i.imgur.com:8443/7PiSDtp.png"],
    ["userinfo without an @ trick host still rejected", "https://user:pass@i.imgur.com/7PiSDtp.png"],
    ["album path (a/) is out of scope", "https://imgur.com/a/abc1234"],
    ["gallery path is out of scope", "https://imgur.com/gallery/abc1234"],
    ["upload path is reserved", "https://imgur.com/upload"],
    ["user path is reserved", "https://imgur.com/user/someone"],
    ["id too short (4 chars)", "https://imgur.com/abcd"],
    ["id too long (11 chars)", "https://imgur.com/abcdefghijk"],
    ["id with path traversal", "https://imgur.com/../etc/passwd"],
    ["id with non-alphanumeric characters", "https://imgur.com/abc-123"],
    ["i.imgur.com with unsupported extension", "https://i.imgur.com/7PiSDtp.svg"],
    ["i.imgur.com with no extension at all", "https://i.imgur.com/7PiSDtp"],
    ["completely unrelated domain", "https://example.com/7PiSDtp.png"],
  ];

  test.each(hostileCases)("%s", (_label, url) => {
    expect(extractImgurCandidates(url)).toEqual([]);
  });
});

// -------------------------------------------------------
// downloadImgurImage — download hardening (stubbed fetch, no live network)
// -------------------------------------------------------

describe("downloadImgurImage", () => {
  const candidate: ImgurCandidate = { id: "7PiSDtp", ext: "png" };

  test("happy path returns the buffer and the detected content type/ext", async () => {
    stubFetch((url) => {
      expect(url).toBe("https://i.imgur.com/7PiSDtp.png");
      return new Response(PNG_BYTES, {
        status: 200,
        headers: { "content-type": "image/png", "content-length": String(PNG_BYTES.length) },
      });
    });

    const result = await downloadImgurImage(candidate);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.id).toBe("7PiSDtp");
      expect(result.ext).toBe("png");
      expect(result.contentType).toBe("image/png");
      expect(Buffer.compare(result.buffer, PNG_BYTES)).toBe(0);
    }
  });

  test("never fetches the user's original URL — always rebuilds from validated parts", async () => {
    let requestedUrl = "";
    stubFetch((url) => {
      requestedUrl = url;
      return new Response(PNG_BYTES, { status: 200, headers: { "content-type": "image/png" } });
    });

    await downloadImgurImage({ id: "abcDE123", ext: "jpg" });
    expect(requestedUrl).toBe("https://i.imgur.com/abcDE123.jpg");
  });

  test("passes redirect: manual and an AbortSignal to fetch", async () => {
    let seenInit: RequestInit | undefined;
    globalThis.fetch = mock((_input: RequestInfo | URL, init?: RequestInit) => {
      seenInit = init;
      return Promise.resolve(
        new Response(PNG_BYTES, { status: 200, headers: { "content-type": "image/png" } }),
      );
    }) as unknown as typeof fetch;

    await downloadImgurImage(candidate);
    expect(seenInit?.redirect).toBe("manual");
    expect(seenInit?.signal).toBeInstanceOf(AbortSignal);
  });

  test("302 (deleted/unavailable image) is skipped, not followed", async () => {
    stubFetch(() => new Response(null, { status: 302, headers: { location: "/removed.png" } }));

    const result = await downloadImgurImage(candidate);
    expect(result).toEqual({ ok: false, reason: "redirected" });
  });

  test("other 3xx statuses are also skipped as redirects", async () => {
    stubFetch(() => new Response(null, { status: 301 }));
    const result = await downloadImgurImage(candidate);
    expect(result).toEqual({ ok: false, reason: "redirected" });
  });

  test("non-2xx, non-3xx status is skipped", async () => {
    stubFetch(() => new Response(null, { status: 404 }));
    const result = await downloadImgurImage(candidate);
    expect(result).toEqual({ ok: false, reason: "http_error" });
  });

  test("wrong Content-Type is skipped", async () => {
    stubFetch(() => new Response(PNG_BYTES, { status: 200, headers: { "content-type": "text/html" } }));
    const result = await downloadImgurImage(candidate);
    expect(result).toEqual({ ok: false, reason: "content_type_mismatch" });
  });

  test("missing Content-Type is skipped", async () => {
    stubFetch(() => new Response(PNG_BYTES, { status: 200 }));
    const result = await downloadImgurImage(candidate);
    expect(result).toEqual({ ok: false, reason: "content_type_mismatch" });
  });

  test("magic-byte mismatch (Content-Type image/png, body not actually PNG) is skipped", async () => {
    stubFetch(
      () => new Response(NOT_AN_IMAGE_BYTES, { status: 200, headers: { "content-type": "image/png" } }),
    );
    const result = await downloadImgurImage(candidate);
    expect(result).toEqual({ ok: false, reason: "magic_byte_mismatch" });
  });

  test.each([
    ["jpeg", JPEG_BYTES, "image/jpeg", "jpg"],
    ["gif", GIF_BYTES, "image/gif", "gif"],
    ["webp", WEBP_BYTES, "image/webp", "webp"],
  ])("magic bytes for %s are recognized as valid", async (_label, bytes, contentType, expectedExt) => {
    stubFetch(() => new Response(bytes, { status: 200, headers: { "content-type": contentType } }));
    const result = await downloadImgurImage(candidate);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ext).toBe(expectedExt);
  });

  test("body larger than the 20 MiB cap per Content-Length header is rejected without downloading", async () => {
    const oversizedLength = 20 * 1024 * 1024 + 1;
    stubFetch(
      () =>
        new Response(PNG_BYTES, {
          status: 200,
          headers: { "content-type": "image/png", "content-length": String(oversizedLength) },
        }),
    );
    const result = await downloadImgurImage(candidate);
    expect(result).toEqual({ ok: false, reason: "too_large" });
  });

  test("body exceeding the cap while streaming is aborted even without a Content-Length header", async () => {
    const CHUNK = new Uint8Array(5 * 1024 * 1024).fill(0x89); // 5 MiB chunks, no content-length
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // 5 chunks of 5 MiB = 25 MiB, over the 20 MiB cap, streamed without
        // ever declaring Content-Length — only the streaming counter can catch this.
        for (let i = 0; i < 5; i++) controller.enqueue(CHUNK);
        controller.close();
      },
    });
    globalThis.fetch = mock(
      () =>
        new Response(stream, {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    ) as unknown as typeof fetch;

    const result = await downloadImgurImage(candidate);
    expect(result).toEqual({ ok: false, reason: "too_large" });
  });

  test("network error (fetch throws) is treated as a skip, not an unhandled rejection", async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error("ECONNRESET"))) as unknown as typeof fetch;
    const result = await downloadImgurImage(candidate);
    expect(result).toEqual({ ok: false, reason: "network_error" });
  });
});

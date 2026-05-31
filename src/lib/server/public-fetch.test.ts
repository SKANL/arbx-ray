import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicJson } from "./public-fetch";

describe("fetchPublicJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed json and leaves the shared errors array untouched on success", async () => {
    const errors: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch,
    );

    const payload = await fetchPublicJson("https://example.test/data", errors, {
      userAgent: "ArbX-Ray test",
    });

    expect(payload).toEqual({ ok: true });
    expect(errors).toEqual([]);
    expect(fetch).toHaveBeenCalledWith(
      "https://example.test/data",
      expect.objectContaining({
        cache: "no-store",
        headers: { "User-Agent": "ArbX-Ray test" },
      }),
    );
  });

  it("normalizes non-ok HTTP responses into the shared errors array", async () => {
    const errors: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limited", { status: 429, statusText: "Too Many Requests" })) as unknown as typeof fetch,
    );

    const payload = await fetchPublicJson("https://example.test/limited", errors);

    expect(payload).toBeUndefined();
    expect(errors).toEqual(["https://example.test/limited: 429 Too Many Requests"]);
  });

  it("normalizes thrown fetch failures into the shared errors array", async () => {
    const errors: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    );

    const payload = await fetchPublicJson("https://example.test/down", errors);

    expect(payload).toBeUndefined();
    expect(errors).toEqual(["https://example.test/down: network down"]);
  });
});

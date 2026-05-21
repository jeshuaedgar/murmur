import { describe, expect, it } from "vitest";
import { getErrorMessage } from "@/lib/toast";

function payload(code: string, message: string, detail?: string) {
  return JSON.stringify({
    code,
    message,
    detail: detail ?? null,
  });
}

describe("toast error mapping", () => {
  it("maps unsupported media errors to a friendly status", () => {
    expect(getErrorMessage(payload("unsupported_media", "bad"))).toBe(
      "Unsupported audio format. Use WAV, MP3, or M4A.",
    );
  });

  it("maps decode errors to a friendly status", () => {
    expect(getErrorMessage(payload("audio_decode_error", "bad"))).toBe(
      "Audio file could not be decoded.",
    );
  });

  it("maps missing codec errors to a friendly status", () => {
    expect(getErrorMessage(payload("missing_codec", "bad"))).toBe(
      "Audio codec unavailable in this build.",
    );
  });
});

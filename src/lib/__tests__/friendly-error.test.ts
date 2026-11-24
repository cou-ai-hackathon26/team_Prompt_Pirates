import { describe, expect, it } from "vitest";
import { friendlyError } from "~/lib/friendly-error";

describe("friendlyError", () => {
  it("turns network failures into a Bangla retry message", () => {
    for (const m of ["Failed to fetch", "Load failed", "TypeError: fetch failed", "NetworkError when attempting to fetch resource."])
      expect(friendlyError({ message: m })).toMatch(/ইন্টারনেট সংযোগ/);
  });
  it("keeps our Bangla server messages", () => {
    expect(friendlyError({ message: "AI এখন সাড়া দিচ্ছে না।" })).toBe("AI এখন সাড়া দিচ্ছে না।");
  });
  it("hides raw English server errors", () => {
    expect(friendlyError({ message: "Unknown area" })).toMatch(/সার্ভারে সমস্যা/);
  });
});

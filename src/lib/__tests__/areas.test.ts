import { describe, expect, it } from "vitest";
import { searchAreas } from "~/lib/area-search";
import {
  AREAS,
  DISTRICTS,
  areaName,
  areaNameEn,
  getArea,
  isValidArea,
  nearestArea,
  resolveAreaId,
} from "~/lib/areas";

const ids = (q: string) => searchAreas(q).map((a) => a.id);

describe("area data", () => {
  it("covers all 64 districts with unique area ids", () => {
    expect(DISTRICTS).toHaveLength(64);
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
    for (const d of DISTRICTS) expect(AREAS.some((a) => a.d === d.id)).toBe(true);
  });

  it("keeps every area inside Bangladesh's bounding box", () => {
    for (const a of AREAS) {
      expect(a.lat).toBeGreaterThan(20.5);
      expect(a.lat).toBeLessThan(26.7);
      expect(a.lng).toBeGreaterThan(88);
      expect(a.lng).toBeLessThan(92.8);
    }
  });

  it("resolves legacy ids from before the nationwide list", () => {
    expect(resolveAreaId("sonapur")).toBe("noakhali.sonapur");
    expect(getArea("mirpur")?.id).toBe("dhaka.mirpur");
    expect(isValidArea("cumilla-sadar")).toBe(true);
    expect(isValidArea("atlantis")).toBe(false);
  });

  it("names areas with their district to tell repeated names apart", () => {
    expect(areaName("noakhali.companiganj")).toBe("কোম্পানীগঞ্জ, নোয়াখালী");
    expect(areaName("sylhet.companiganj")).toBe("কোম্পানীগঞ্জ, সিলেট");
    expect(areaNameEn("noakhali.begumganj")).toBe("Begumganj, Noakhali");
  });
});

describe("searchAreas", () => {
  it("finds an area typed in Bangla, English or Banglish", () => {
    expect(ids("বেগমগঞ্জ")[0]).toBe("noakhali.begumganj");
    expect(ids("begumganj")[0]).toBe("noakhali.begumganj");
    expect(ids("begumgonj")[0]).toBe("noakhali.begumganj");
    expect(ids("বেগমগন্জ")[0]).toBe("noakhali.begumganj");
  });

  it("matches a partial Bangla word as the user types", () => {
    expect(ids("সোনা")).toContain("noakhali.sonapur");
  });

  it("lists a district's sadar upazila first for a district search", () => {
    const r = ids("নোয়াখালী");
    expect(r[0]).toBe("noakhali.noakhali-sadar");
    expect(r.every((id) => id.startsWith("noakhali."))).toBe(true);
  });

  it("narrows repeated names with the district", () => {
    expect(ids("companiganj sylhet")[0]).toBe("sylhet.companiganj");
    expect(ids("কোম্পানীগঞ্জ নোয়াখালী")[0]).toBe("noakhali.companiganj");
  });

  it("accepts old English district spellings", () => {
    expect(ids("chittagong kotwali")[0]).toBe("chattogram.kotwali");
    expect(ids("comilla")[0]).toBe("cumilla.cumilla-sadar");
  });

  it("returns nothing for empty or unknown input", () => {
    expect(ids("")).toEqual([]);
    expect(ids("xqzt")).toEqual([]);
  });
});

describe("nearestArea", () => {
  it("maps a GPS point to the nearest verified area", () => {
    expect(nearestArea({ lat: 22.87, lng: 91.1 })?.area.d).toBe(5); // Maijdee, Noakhali
    expect(nearestArea({ lat: 23.807, lng: 90.368 })?.area.id).toBe("dhaka.mirpur");
  });

  it("returns null far outside Bangladesh", () => {
    expect(nearestArea({ lat: 28.6, lng: 77.2 })).toBeNull(); // Delhi
  });
});

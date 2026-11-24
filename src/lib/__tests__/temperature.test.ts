import { describe, expect, it } from "vitest";
import { parseTemperatureF } from "~/lib/temperature";

describe("parseTemperatureF", () => {
  it("accepts English and Bangla digits", () => {
    expect(parseTemperatureF("102").f).toBe(102);
    expect(parseTemperatureF("১০২.৫").f).toBe(102.5);
    expect(parseTemperatureF("১০১।৪").f).toBe(101.4);
  });

  it("treats 35-42 as Celsius", () => {
    const p = parseTemperatureF("39");
    expect(p.fromCelsius).toBe(true);
    expect(p.f).toBe(102.2);
  });

  it("keeps partial input without a value (typing in progress)", () => {
    expect(parseTemperatureF("1").f).toBeNull();
    expect(parseTemperatureF("10").f).toBeNull();
    expect(parseTemperatureF("").error).toBeNull();
  });

  it("flags out-of-range values", () => {
    expect(parseTemperatureF("120").error).not.toBeNull();
  });
});

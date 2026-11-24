import { describe, expect, it } from "vitest";
import { emptySymptoms } from "~/lib/ai/schemas";
import { flagMissedDangerSigns } from "~/lib/ai/safety-net";

const T =
  "আমার গত পরশু থেকে জ্বর হচ্ছে। বমি বমি ভাব বা পেট ব্যথা আবার হচ্ছে, রক্তপাত আছে। পানি খেতে পারছি, প্রস্রাব হচ্ছে।";

describe("flagMissedDangerSigns", () => {
  it("flags abdominal pain that the model dropped (real case from testing)", () => {
    const s = {
      ...emptySymptoms,
      fever: true,
      bleedingOther: true,
      canDrinkFluids: true,
    };
    const out = flagMissedDangerSigns(T, s, []);
    expect(out).toContain("abdominalPain");
    expect(out).toContain("vomitingCount24h");
    expect(out).toContain("noUrine6h");
  });

  it("does not flag a group the model already filled", () => {
    const s = {
      ...emptySymptoms,
      abdominalPain: "mild" as const,
      bleedingOther: true,
      vomitingCount24h: 0,
      noUrine6h: false,
      canDrinkFluids: true,
    };
    const out = flagMissedDangerSigns(T, s, []);
    expect(out).not.toContain("abdominalPain");
    expect(out).not.toContain("bleedingGums");
  });

  it("flags all bleeding fields only when the model filled none of them", () => {
    const out = flagMissedDangerSigns(
      "দাঁত দিয়ে রক্ত পড়ছে",
      { ...emptySymptoms },
      [],
    );
    expect(out).toEqual(
      expect.arrayContaining(["bleedingGums", "bleedingOther"]),
    );
  });

  it("keeps the model's own unclear fields and adds nothing for unrelated text", () => {
    expect(
      flagMissedDangerSigns("আজকে ভালো আছে", { ...emptySymptoms }, [
        "temperatureF",
      ]),
    ).toEqual(["temperatureF"]);
  });
});

import { describe, expect, it } from "vitest";
import { timezoneSchema, updateOrganizationSchema } from "./organization.js";

describe("timezoneSchema", () => {
  it("accepts a real IANA identifier", () => {
    expect(timezoneSchema.safeParse("Europe/Sofia").success).toBe(true);
  });

  it("rejects a non-IANA string", () => {
    expect(timezoneSchema.safeParse("Not/AZone").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(timezoneSchema.safeParse("").success).toBe(false);
  });
});

describe("updateOrganizationSchema", () => {
  it("accepts a valid timezone", () => {
    const result = updateOrganizationSchema.safeParse({
      timezone: "America/New_York",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid timezone before persistence", () => {
    const result = updateOrganizationSchema.safeParse({
      timezone: "Fake/Timezone",
    });
    expect(result.success).toBe(false);
  });
});

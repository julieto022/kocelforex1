import { describe, expect, it } from "vitest";

import { defaultCustomRules } from "@/lib/trading/strategies/custom-rules";
import { parsePortableStrategy } from "@/lib/trading/strategies/portable";

const validPortableStrategy = {
  format: "kocel-strategy",
  schemaVersion: 1,
  name: "Portable Momentum",
  category: "Custom",
  description: "A portable strategy document.",
  shortDescription: "Portable test strategy",
  engine: "custom-rules",
  symbols: ["EURUSD"],
  timeframes: ["M5"],
  markets: ["forex"],
  configuration: { customRules: defaultCustomRules },
};

describe("portable strategy JSON", () => {
  it("accepts a supported engine with valid rules", () => {
    expect(parsePortableStrategy(validPortableStrategy).engine).toBe("custom-rules");
  });

  it("rejects unsupported runtime engines", () => {
    expect(() =>
      parsePortableStrategy({ ...validPortableStrategy, engine: "arbitrary-code" }),
    ).toThrow(/Unsupported strategy engine/);
  });

  it("requires valid rules for the custom-rules runtime", () => {
    expect(() => parsePortableStrategy({ ...validPortableStrategy, configuration: {} })).toThrow(
      /configuration\.customRules/,
    );
  });
});

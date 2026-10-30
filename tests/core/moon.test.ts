import { expect, test } from "vitest";
import { moonPhase } from "../../src/core/moon";

test("this morning: waning gibbous around 81%", () => {
  const m = moonPhase(new Date("2026-10-30T10:26:00Z"));
  expect(m.name).toBe("Waning Gibbous");
  expect(m.illumination).toBeGreaterThanOrEqual(0.79);
  expect(m.illumination).toBeLessThanOrEqual(0.83);
  expect(m.waxing).toBe(false);
});

test("full and new moons", () => {
  expect(moonPhase(new Date("2026-11-24T12:00:00Z")).name).toBe("Full Moon");
  expect(moonPhase(new Date("2026-11-09T12:00:00Z")).name).toBe("New Moon");
});

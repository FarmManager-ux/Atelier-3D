import { describe, expect, it } from "vitest";
import { readPreferences } from "./preferences";

describe("preferências", () => {
  it("usa valores por omissão quando não há nada guardado", () => {
    expect(readPreferences({ preferences: {} })).toEqual({ followUpDays: 7, defaultCapacity: 8 });
  });
  it("lê valores válidos e ignora inválidos", () => {
    expect(readPreferences({ preferences: { followUpDays: 14, defaultCapacity: 10 } })).toEqual({ followUpDays: 14, defaultCapacity: 10 });
    expect(readPreferences({ preferences: { followUpDays: -3, defaultCapacity: "x" } })).toEqual({ followUpDays: 7, defaultCapacity: 8 });
    expect(readPreferences({ preferences: { followUpDays: 5 } })).toEqual({ followUpDays: 5, defaultCapacity: 8 });
  });
});

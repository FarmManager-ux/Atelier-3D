import { describe, expect, it } from "vitest";
import { isValidPortugueseNif } from "./nif";

describe("isValidPortugueseNif", () => {
  // NIFs de exemplo construídos pelo algoritmo, sem pertencerem a pessoas reais conhecidas.
  it.each(["123456789", "501964843", "999999990"])("aceita %s", (n) => {
    expect(isValidPortugueseNif(n)).toBe(true);
  });
  it.each(["123456788", "000000000", "12345678", "1234567890", "abcdefghi", "", "423456780"])(
    "rejeita %s",
    (n) => expect(isValidPortugueseNif(n)).toBe(false),
  );
  it("ignora espaços", () => expect(isValidPortugueseNif("123 456 789")).toBe(true));
});

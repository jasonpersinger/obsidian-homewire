import { expect, test } from "vitest";
import { isHttpUrl } from "../../src/core/safeUrl";

test("allows http and https", () => {
  expect(isHttpUrl("https://a.b")).toBe(true);
  expect(isHttpUrl("http://a.b/x?y=1")).toBe(true);
});

test("rejects everything else", () => {
  for (const v of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "", null, undefined, "not a url"]) {
    expect(isHttpUrl(v)).toBe(false);
  }
});

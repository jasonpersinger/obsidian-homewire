import { describe, expect, test } from "vitest";
import { extractOpenTasks, setTaskChecked } from "../../src/core/tasks";

const md = "# Day\n- [ ] call about truck\n- [x] done\n  - [ ] nested\n* [ ] star\ntext";

describe("extractOpenTasks", () => {
  test("finds unchecked items with 0-based line numbers", () => {
    expect(extractOpenTasks(md)).toEqual([
      { line: 1, text: "call about truck" },
      { line: 3, text: "nested" },
      { line: 4, text: "star" },
    ]);
  });
  test("uppercase X counts as done and empty items are skipped", () => {
    expect(extractOpenTasks("- [X] upper\n- [ ] \n- [ ]")).toEqual([]);
  });
});

describe("setTaskChecked", () => {
  test("ticks the line and leaves every other line identical", () => {
    const out = setTaskChecked(md, 1, "call about truck", true)!;
    const lines = out.split("\n");
    expect(lines[1]).toBe("- [x] call about truck");
    expect(lines.filter((_, i) => i !== 1)).toEqual(md.split("\n").filter((_, i) => i !== 1));
  });
  test("keeps CRLF line endings", () => {
    const crlf = "a\r\n- [ ] one\r\nb\r\n";
    expect(setTaskChecked(crlf, 1, "one", true)).toBe("a\r\n- [x] one\r\nb\r\n");
  });
  test("moved line: ticks the single other unchecked line with that text", () => {
    const moved = "new top line\n# Day\n- [ ] call about truck\n- [ ] other";
    const out = setTaskChecked(moved, 1, "call about truck", true)!;
    expect(out.split("\n")[2]).toBe("- [x] call about truck");
    expect(out.split("\n")[1]).toBe("# Day");
  });
  test("moved line with no match returns null", () => {
    expect(setTaskChecked("- [ ] something else", 0, "call about truck", true)).toBeNull();
  });
  test("moved line with several matches returns null", () => {
    expect(setTaskChecked("x\n- [ ] dup\n- [ ] dup", 0, "dup", true)).toBeNull();
  });
  test("already checked returns null", () => {
    expect(setTaskChecked("- [x] done", 0, "done", true)).toBeNull();
  });
  test("can uncheck", () => {
    expect(setTaskChecked("- [x] done", 0, "done", false)).toBe("- [ ] done");
  });
});

describe("code blocks and frontmatter (0.5.1)", () => {
  const md = "---\ntodo: \"- [ ] not a task\"\n---\n- [ ] real\n```md\n- [ ] in code\n```\n~~~\n- [ ] in tilde code\n~~~\n- [ ] also real";
  test("only real tasks are listed", () => {
    expect(extractOpenTasks(md)).toEqual([{ line: 3, text: "real" }, { line: 10, text: "also real" }]);
  });
  test("a moved task is never matched inside a code block", () => {
    const moved = "x\n```\n- [ ] dup\n```\n- [ ] dup";
    expect(setTaskChecked(moved, 0, "dup", true)!.split("\n")[4]).toBe("- [x] dup");
  });
});

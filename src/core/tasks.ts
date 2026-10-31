// Markdown checkbox items: finding open ones and ticking one safely.

export interface OpenTask { line: number; text: string }

const TASK = /^(\s*[-*] \[)( |x|X)(\] )(.+)$/;
const TASK_MARK = /^(\s*[-*] \[)( |x|X)(\] )/;

/** For each line: true if it's inside frontmatter or a fenced code block, where checkboxes aren't tasks. */
export function codeLines(lines: string[]): boolean[] {
  const out: boolean[] = [];
  let fence: string | null = null;
  let frontmatter = lines[0]?.replace(/\r$/, "") === "---";
  lines.forEach((raw, i) => {
    const l = raw.replace(/\r$/, "");
    if (frontmatter) {
      out.push(true);
      if (i > 0 && (l === "---" || l === "...")) frontmatter = false;
      return;
    }
    const m = /^\s*(`{3,}|~{3,})/.exec(l);
    if (fence) {
      out.push(true);
      if (m && m[1]![0] === fence[0] && m[1]!.length >= fence.length) fence = null;
    } else if (m) {
      fence = m[1]!;
      out.push(true);
    } else out.push(false);
  });
  return out;
}

export function extractOpenTasks(markdown: string): OpenTask[] {
  const out: OpenTask[] = [];
  const lines = markdown.split(/\r?\n/);
  const code = codeLines(lines);
  lines.forEach((l, line) => {
    if (code[line]) return;
    const m = TASK.exec(l);
    const text = m?.[4]?.trim();
    if (m && m[2] === " " && text) out.push({ line, text });
  });
  return out;
}

/**
 * Sets the checkbox on `line` if it still holds `expectedText`. If the file
 * changed and the line moved, ticks the one other line with that text in the
 * opposite state; returns null when that is ambiguous or nothing would change.
 */
export function setTaskChecked(markdown: string, line: number, expectedText: string, checked: boolean): string | null {
  const lines = markdown.split("\n"); // "\r" stays on each line, so CRLF survives the join
  const code = codeLines(lines);
  const want = checked ? " " : "x";
  const matches = (i: number, anyState: boolean) => {
    if (code[i]) return false;
    const m = TASK.exec((lines[i] ?? "").replace(/\r$/, ""));
    if (!m || m[4]?.trim() !== expectedText) return false;
    return anyState || m[2]!.toLowerCase() === want;
  };

  let target = -1;
  if (matches(line, true)) {
    if (!matches(line, false)) return null; // already in the requested state
    target = line;
  } else {
    const found = lines.map((_, i) => i).filter((i) => matches(i, false));
    if (found.length !== 1) return null;
    target = found[0]!;
  }
  lines[target] = lines[target]!.replace(TASK_MARK, `$1${checked ? "x" : " "}$3`);
  return lines.join("\n");
}

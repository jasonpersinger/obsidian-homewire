// Markdown checkbox items: finding open ones and ticking one safely.

export interface OpenTask { line: number; text: string }

const TASK = /^(\s*[-*] \[)( |x|X)(\] )(.+)$/;
const TASK_MARK = /^(\s*[-*] \[)( |x|X)(\] )/;

export function extractOpenTasks(markdown: string): OpenTask[] {
  const out: OpenTask[] = [];
  markdown.split(/\r?\n/).forEach((l, line) => {
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
  const want = checked ? " " : "x";
  const matches = (i: number, anyState: boolean) => {
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

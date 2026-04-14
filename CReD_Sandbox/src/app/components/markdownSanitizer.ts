function countUnescapedToken(input: string, token: string): number {
  if (!token) return 0;
  let count = 0;
  for (let i = 0; i <= input.length - token.length; i += 1) {
    if (input.slice(i, i + token.length) !== token) continue;
    let backslashes = 0;
    for (let j = i - 1; j >= 0 && input[j] === "\\"; j -= 1) {
      backslashes += 1;
    }
    if (backslashes % 2 === 0) count += 1;
    i += token.length - 1;
  }
  return count;
}

function normalizeBrokenLineWraps(text: string): string {
  if (!text) return text;
  let out = text.replace(/\r\n/g, "\n");
  out = out.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.replace(/([^\n])\n([^\n])/g, "$1 $2");
  out = out.replace(/[ \t]{2,}/g, " ");
  return out.trim();
}

function normalizeUnicodeStars(text: string): string {
  return text.replace(/∗/g, "*");
}

function normalizeSpacedMathTokens(text: string): string {
  let out = text;
  // f ( x ) -> f(x)
  out = out.replace(/\b([A-Za-z])\s*\(\s*([A-Za-z])\s*\)/g, "$1($2)");
  // u ( 0 ) = u ( 1 ) = 0 -> u(0) = u(1) = 0
  out = out.replace(/\b([A-Za-z])\s*\(\s*(\d+)\s*\)/g, "$1($2)");
  // matrixK -> matrix K
  out = out.replace(/([a-z])([A-Z])/g, "$1 $2");
  // collapse repeated immediate token runs (e.g. f(x) f(x))
  out = out.replace(/\b([A-Za-z]\([A-Za-z0-9]+\))\s+\1\b/g, "$1");
  return out;
}

function normalizeEmphasisDelimiters(text: string): string {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  return lines
    .map((line) => (countUnescapedToken(line, "**") % 2 === 1 ? line.replace(/\*\*/g, "\\*\\*") : line))
    .join("\n");
}

function normalizeMathDelimiters(text: string): string {
  if (!text) return text;
  return text
    .split(/\r?\n/)
    .map((line) => (countUnescapedToken(line, "$") % 2 === 1 ? line.replace(/\$/g, "\\$") : line))
    .join("\n");
}

/**
 * Escape dollar signs when they clearly indicate currency values (e.g. $215),
 * but keep valid math like $3s$, $3$, and $x+1$ untouched.
 */
export function escapeCurrencyDollarSigns(text: string): string {
  return text.replace(/\$(?=\s*[\d,])/g, (marker, offset) => {
    const afterDollar = text.slice(offset + 1);
    const rest = afterDollar.replace(/^\s*/, "");
    const numMatch = rest.match(/^([\d,]+(?:\.\d+)?)/);
    if (!numMatch) return marker;
    const afterNum = rest.slice(numMatch[1].length);
    const ch = afterNum[0];
    if (ch && /[a-zA-Z]/.test(ch)) return marker;
    if (afterNum.trimStart().startsWith("$")) return marker;
    return "\\$";
  });
}

export function sanitizeMarkdownMathInput(text: string): string {
  return escapeCurrencyDollarSigns(
    normalizeMathDelimiters(
      normalizeEmphasisDelimiters(normalizeSpacedMathTokens(normalizeUnicodeStars(normalizeBrokenLineWraps(text ?? "")))),
    ),
  );
}

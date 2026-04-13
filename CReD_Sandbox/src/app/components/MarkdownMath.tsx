import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * remark-math treats `$...$` as inline math. Dollar amounts like `$215` therefore start
 * a math span that runs until the next `$`, producing broken KaTeX (often one character per line).
 * Escape `$` when it clearly starts a **money** amount — but NOT when it is math like `$3s + 5d$`
 * (digit + variable) or `$3$` (digit closed by next `$`), which our old rule broke.
 */
export function escapeCurrencyDollarSigns(text: string): string {
  return text.replace(/\$(?=\s*[\d,])/g, (marker, offset) => {
    const afterDollar = text.slice(offset + 1);
    const rest = afterDollar.replace(/^\s*/, "");
    const numMatch = rest.match(/^([\d,]+(?:\.\d+)?)/);
    if (!numMatch) return marker;
    const afterNum = rest.slice(numMatch[1].length);
    const ch = afterNum[0];
    // $3s, $2x — coefficient times variable; keep as math
    if (ch && /[a-zA-Z]/.test(ch)) return marker;
    // $3$ … — inline math for a number; keep
    if (afterNum.trimStart().startsWith("$")) return marker;
    // Otherwise treat as currency (e.g. $215, $1,234.50)
    return "\\$";
  });
}

/**
 * Renders Markdown + LaTeX. Use `$...$` for inline math and `$$...$$` for display math.
 * `compact`: map `<p>` → `<span>` so content is valid inside `<button>` (MCQ options).
 */
const compactComponents: Components = {
  p: ({ children }) => <span className="block">{children}</span>,
};

type MarkdownMathProps = {
  children: string;
  className?: string;
  /** Use inside buttons / tight UI where block `<p>` is invalid HTML */
  variant?: 'default' | 'compact';
};

export function MarkdownMath({ children, className, variant = 'default' }: MarkdownMathProps) {
  const source = escapeCurrencyDollarSigns(children ?? '');
  return (
    <div
      className={className}
      style={{
        lineHeight: variant === 'compact' ? 1.45 : 1.6,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={variant === 'compact' ? compactComponents : undefined}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

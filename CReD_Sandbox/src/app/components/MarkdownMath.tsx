import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './markdown-math.css';
import { sanitizeMarkdownMathInput } from './markdownSanitizer';

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
  const source = sanitizeMarkdownMathInput(children ?? '');
  return (
    <div
      className={['cred-markdown-math', className].filter(Boolean).join(' ')}
      style={{
        lineHeight: variant === 'compact' ? 1.45 : 1.6,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { output: 'html', throwOnError: false, strict: 'ignore' }]]}
        components={variant === 'compact' ? compactComponents : undefined}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

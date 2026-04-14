import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import { sanitizeMarkdownMathInput } from "./markdownSanitizer";

const processor = unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeStringify);

export async function renderMarkdownToTrustedHtml(markdown: string): Promise<string> {
  const safeInput = sanitizeMarkdownMathInput(markdown ?? "");
  const file = await processor.process(safeInput);
  return String(file);
}

export async function renderOptionsToTrustedHtml(options: string[] | null | undefined): Promise<string[] | null> {
  if (!options || options.length === 0) return null;
  const rendered = await Promise.all(options.map((opt) => renderMarkdownToTrustedHtml(opt)));
  return rendered;
}

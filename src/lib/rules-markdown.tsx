import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const ALLOWED_TAGS = [
  "p", "ul", "ol", "li", "strong", "em", "br", "hr",
  "h2", "h3", "h4", "a", "code", "blockquote",
];

const ALLOWED_ATTR = ["href", "target", "rel"];

export const renderMarkdown = (source: string | null | undefined): string => {
  if (!source) return "";
  const html = md.render(source);
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
};

interface RulesMarkdownProps {
  md: string | null | undefined;
  className?: string;
}

export const RulesMarkdown = ({ md: source, className }: RulesMarkdownProps) => {
  const html = renderMarkdown(source);
  if (!html) return null;
  return (
    <div
      className={
        "prose prose-sm max-w-none text-foreground [&_a]:text-primary [&_a]:underline [&_strong]:text-foreground [&_p]:my-2 [&_ul]:my-2 [&_li]:my-0.5 " +
        (className ?? "")
      }
      // eslint-disable-next-line react/no-danger -- sanitized via DOMPurify
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export interface PlayerStep {
  title: string;
  body: string;
}

/**
 * Parse markdown like:
 *   1. **Title**\n   Body text\n
 * Returns ordered list of {title, body}.
 */
export const parsePlayerSteps = (source: string | null | undefined): PlayerStep[] => {
  if (!source) return [];
  const lines = source.split("\n");
  const steps: PlayerStep[] = [];
  let current: PlayerStep | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const headerMatch = line.match(/^\s*\d+\.\s+\*\*(.+?)\*\*\s*$/);
    if (headerMatch) {
      if (current) steps.push(current);
      current = { title: headerMatch[1].trim(), body: "" };
      continue;
    }
    const inlineMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (inlineMatch && !current) {
      steps.push({ title: inlineMatch[1].trim(), body: "" });
      continue;
    }
    if (current && line.trim()) {
      current.body = current.body ? `${current.body} ${line.trim()}` : line.trim();
    }
  }
  if (current) steps.push(current);
  return steps;
};
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  contentMd: string;
  version?: string;
}

/**
 * Render simple Markdown → HTML (sin libs externas para mantener el bundle).
 * Soporta encabezados, listas, párrafos y negrita.
 */
const renderMd = (md: string) => {
  const lines = md.split("\n");
  const out: JSX.Element[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    out.push(
      <ul key={`ul-${out.length}`} className="my-2 list-disc space-y-1 pl-5 text-sm">
        {listBuffer.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inline(item) }} />
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const inline = (text: string) =>
    escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs">$1</code>');

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("# ")) {
      flushList();
      out.push(
        <h1 key={out.length} className="mb-2 mt-4 font-display text-xl font-bold">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      flushList();
      out.push(
        <h2 key={out.length} className="mb-2 mt-4 font-display text-base font-semibold">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      flushList();
      out.push(
        <h3 key={out.length} className="mb-1 mt-3 text-sm font-semibold">
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
    } else if (line === "") {
      flushList();
    } else {
      flushList();
      out.push(
        <p
          key={out.length}
          className="my-2 text-sm leading-relaxed text-foreground"
          dangerouslySetInnerHTML={{ __html: inline(line) }}
        />,
      );
    }
  }
  flushList();
  return out;
};

export const LegalDocViewer = ({ open, onOpenChange, title, contentMd, version }: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader className="text-left">
          <SheetTitle>{title}</SheetTitle>
          {version && (
            <SheetDescription>Versión {version}</SheetDescription>
          )}
        </SheetHeader>
        <ScrollArea className="-mx-6 mt-4 h-[calc(85vh-100px)] px-6">
          <div className="pb-12">{renderMd(contentMd)}</div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

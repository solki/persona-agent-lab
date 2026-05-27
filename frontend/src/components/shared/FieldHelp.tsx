import { CircleHelp } from "lucide-react";
import { useState, useRef, useEffect } from "react";

type HelpPattern = "tooltip" | "popover";

interface FieldHelpProps {
  pattern: HelpPattern;
  content: string;
  title?: string;
}

export function FieldHelp({ pattern, content, title }: FieldHelpProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (pattern === "tooltip") {
    return (
      <span className="relative inline-flex items-center group -mt-px" aria-hidden="true">
        <CircleHelp size={14} className="text-muted-foreground group-hover:text-amber-400 transition-colors cursor-help" />
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 rounded-md border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-50"
        >
          {content}
        </span>
      </span>
    );
  }

  return (
    <span ref={ref} className="relative inline-flex items-center -mt-px">
      <button
        type="button"
        tabIndex={-1}
        aria-label={title ? `Help: ${title}` : "Help"}
        onClick={() => setOpen(!open)}
        className="inline-flex cursor-pointer"
      >
        <CircleHelp size={14} className="text-muted-foreground hover:text-amber-400 transition-colors" />
      </button>
      {open ? (
        <span
          role="dialog"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-72 rounded-md border border-border bg-popover px-3 py-2.5 shadow-md z-50"
        >
          {title ? <p className="mb-1 text-xs font-semibold text-foreground">{title}</p> : null}
          <p className="text-xs leading-relaxed text-popover-foreground whitespace-pre-wrap">{content}</p>
        </span>
      ) : null}
    </span>
  );
}

import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "focus-ring min-h-24 w-full rounded-sm border border-input bg-input px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-40",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

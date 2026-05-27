import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground", className)} {...props} />;
}

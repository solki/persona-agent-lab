import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "focus-ring flex h-10 w-full rounded-sm border border-input bg-input px-3 py-2 font-mono text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-40",
      className
    )}
    {...props}
  />
));
Select.displayName = "Select";

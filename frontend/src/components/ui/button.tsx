import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "outline" | "destructive" | "ghost";

const variants: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/85 shadow-sm",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-border bg-transparent hover:bg-panel-hover text-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/85 shadow-sm",
  ghost: "text-muted-foreground hover:bg-panel-hover hover:text-foreground"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-sm text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4",
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
}

const variants = {
  default: "bg-primary/10 text-primary",
  secondary: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/10 text-destructive",
  outline: "border border-border bg-card text-foreground",
  success: "bg-success/12 text-success",
  warning: "bg-warning/14 text-warning",
  info: "bg-info/12 text-info",
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";

export { Badge };

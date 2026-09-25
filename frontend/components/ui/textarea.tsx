import * as React from "react"
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[88px] w-full resize-y rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-[0_1px_2px_hsl(var(--shadow-color)/0.04)] transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea };

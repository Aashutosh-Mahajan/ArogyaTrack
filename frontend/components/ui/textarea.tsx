import React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-heading ring-offset-background transition-all duration-200 placeholder:text-muted-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50 focus-visible:border-teal-500 disabled:cursor-not-allowed disabled:opacity-50 hover:border-teal-300 resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };

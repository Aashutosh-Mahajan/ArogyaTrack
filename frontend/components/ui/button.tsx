import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-pill text-sm font-semibold ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-teal-800 to-teal-700 text-white shadow-button hover:from-teal-900 hover:to-teal-800 hover:-translate-y-0.5 hover:shadow-soft-lg",
        destructive: "bg-destructive text-destructive-foreground shadow-button hover:bg-destructive/90 hover:-translate-y-0.5",
        outline: "border-2 border-teal-600 bg-white text-teal-700 hover:bg-teal-600 hover:text-white hover:-translate-y-0.5 transition-all",
        secondary: "bg-teal-50 text-teal-700 hover:bg-teal-100 hover:-translate-y-0.5",
        ghost: "hover:bg-teal-50 hover:text-teal-700 rounded-xl",
        link: "text-teal-600 underline-offset-4 hover:underline hover:text-teal-700",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 rounded-pill px-4 text-sm",
        lg: "h-14 rounded-pill px-10 text-base",
        icon: "h-12 w-12 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

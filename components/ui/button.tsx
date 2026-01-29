import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[loading=true]:pointer-events-none data-[loading=true]:cursor-wait [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 data-[loading=true]:border data-[loading=true]:border-primary data-[loading=true]:bg-primary/70",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 data-[loading=true]:border data-[loading=true]:border-destructive data-[loading=true]:bg-destructive/70",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[loading=true]:border-current",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 data-[loading=true]:border data-[loading=true]:border-secondary data-[loading=true]:bg-secondary/60",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
  loadingText?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      loadingText,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || isLoading
    const content = isLoading ? (
      <span className="inline-flex items-center gap-1 align-middle">
        <span>{loadingText ?? "Lädt"}</span>
        <div className="loader loader-inline" aria-hidden="true">
          <div />
          <div />
          <div />
        </div>
      </span>
    ) : (
      children
    )
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        data-loading={isLoading ? "true" : undefined}
        aria-busy={isLoading ? true : undefined}
        disabled={isDisabled}
        {...props}
      >
        {content}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
